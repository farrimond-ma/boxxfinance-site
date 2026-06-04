/**
 * Boxx Finance — Backlink Outreach System
 *
 * Monitors UK bridging finance trade publications via RSS for new articles
 * where Boxx Commercial Finance could contribute expert insight or request
 * a mention/link.
 *
 * For each relevant new article:
 *   1. Generates a 150-200 word expert comment from Mark or Andrew
 *   2. Generates a personalized outreach email to the journalist/editor
 *   3. Saves everything to a 'Backlink_Prospects' tab in Google Sheets
 *
 * Runs weekly (Mondays after the visibility checker).
 * Humans review the drafts and send the best ones manually.
 *
 * Run: node backlink-outreach.js [--dry-run]
 */

require('dotenv').config();
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'https://boxxfinance.co.uk';
const SHEET_TAB      = 'Backlink_Prospects';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Target publications ──────────────────────────────────────────────────────
// RSS feeds of UK bridging finance and property trade press

const PUBLICATIONS = [
  {
    name:    'Bridging & Commercial',
    rss:     'https://www.bridgingandcommercial.co.uk/feed/',
    contact: 'editor@bridgingandcommercial.co.uk',
    da:      45,
    notes:   'Primary trade press for bridging finance. Regularly publishes lender/broker case studies.',
  },
  {
    name:    'Property Reporter',
    rss:     'https://propertyreporter.co.uk/feed/',
    contact: 'news@propertyreporter.co.uk',
    da:      38,
    notes:   'Property investment news. Covers bridging for investors.',
  },
  {
    name:    'Mortgage Solutions',
    rss:     'https://www.mortgagesolutions.co.uk/feed/',
    contact: 'editorial@mortgagesolutions.co.uk',
    da:      52,
    notes:   'Mortgage trade press. Regularly covers specialist finance.',
  },
  {
    name:    'Property Investor Today',
    rss:     'https://www.propertyinvestortoday.co.uk/feed/',
    contact: 'info@propertyinvestortoday.co.uk',
    da:      35,
    notes:   'Property investor audience — ideal for bridging case studies.',
  },
  {
    name:    'Mortgage Finance Gazette',
    rss:     'https://www.mortgagefinancegazette.com/feed/',
    contact: 'editorial@mortgagefinancegazette.com',
    da:      40,
    notes:   'Finance trade press. Expert comment opportunities.',
  },
  {
    name:    'Development Finance Today',
    rss:     'https://developmentfinancetoday.co.uk/feed/',
    contact: 'editor@developmentfinancetoday.co.uk',
    da:      30,
    notes:   'Development and bridging finance specialist.',
  },
];

// ─── Bridging finance keywords to filter for ─────────────────────────────────

const BRIDGING_KEYWORDS = [
  'bridging', 'bridge loan', 'bridge finance', 'short-term finance',
  'short term loan', 'auction finance', 'chain break', 'development exit',
  'property finance', 'regulated bridge', 'unregulated bridge',
  'ltv', 'exit strategy', 'refurbishment finance', 'planning gain',
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
    catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Ensure Backlink_Prospects tab exists ─────────────────────────────────────

async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(s => s.properties?.title === SHEET_TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
    });
    // Write header
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB}!A1:M1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[
        'Date Found', 'Publication', 'DA', 'Article Title', 'Article URL',
        'Keywords Matched', 'Suggested Author', 'Expert Comment Draft',
        'Outreach Email Draft', 'Editor Contact', 'Status', 'Date Sent', 'Notes',
      ]] },
    });
    console.log(`  Created ${SHEET_TAB} tab`);
  }
}

// ─── Get already-processed URLs ───────────────────────────────────────────────

async function getProcessedUrls(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!E2:E`,
  });
  return new Set((res.data.values || []).map(r => r[0]).filter(Boolean));
}

// ─── Fetch and parse RSS feed ─────────────────────────────────────────────────

async function fetchRSS(publication) {
  try {
    const res = await fetch(publication.rss, {
      headers: { 'User-Agent': 'BoxxFinance-BacklinkMonitor/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`  ${publication.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRSSItems(xml, publication);
  } catch (err) {
    console.warn(`  ${publication.name}: ${err.message}`);
    return [];
  }
}

function parseRSSItems(xml, publication) {
  const items = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const item of itemMatches) {
    const title   = extractTag(item, 'title');
    const link    = extractTag(item, 'link') || extractTag(item, 'guid');
    const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'dc:date');
    const desc    = extractTag(item, 'description') || extractTag(item, 'content:encoded') || '';

    if (!title || !link) continue;

    // Only include articles from the last 7 days
    const age = pubDate ? Date.now() - new Date(pubDate).getTime() : 0;
    if (pubDate && age > 7 * 24 * 60 * 60 * 1000) continue;

    // Check for bridging finance relevance
    const fullText = (title + ' ' + desc).toLowerCase();
    const matched = BRIDGING_KEYWORDS.filter(kw => fullText.includes(kw.toLowerCase()));

    if (matched.length > 0) {
      items.push({
        title:       stripHtml(title),
        url:         link.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: stripHtml(desc).substring(0, 500),
        pubDate:     pubDate || new Date().toISOString(),
        publication,
        keywords:    matched.slice(0, 5).join(', '),
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<\\!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
}

// ─── Generate expert comment + outreach email via Claude ──────────────────────

async function generateOutreach(article) {
  // Alternate between Mark (property focus) and Andrew (cashflow/business)
  // For bridging finance, Mark is the primary voice
  const author    = 'Mark Higgins';
  const authorBio = 'Mark Higgins, bridging finance specialist at Boxx Commercial Finance';

  const prompt = `You are helping ${authorBio} respond to a trade press article about bridging finance.

ARTICLE: "${article.title}"
PUBLICATION: ${article.publication.name}
SUMMARY: ${article.description}
URL: ${article.url}

Generate two things:

1. EXPERT_COMMENT (150-200 words):
   A genuine, insightful expert comment that adds value to the article's discussion.
   - Written in first person as ${author}
   - Draws on real-world bridging finance experience
   - Adds a specific insight or data point the article didn't mention
   - Mentions "Boxx Commercial Finance" once, naturally
   - Ends with a subtle offer: "Happy to provide further insight or a case study if useful"
   - No fluff, no marketing speak — sounds like a practitioner

2. OUTREACH_EMAIL (100-150 words):
   A brief, professional email to the editor requesting a mention or offering expert contribution.
   - From: ${author}, Boxx Commercial Finance
   - Subject line included
   - References the specific article
   - Offers: (a) expert comment for the article, (b) a case study, or (c) to be a regular source
   - Includes our website: ${SITE_URL}
   - Professional but not stiff

Format exactly:
EXPERT_COMMENT:
[comment text]

OUTREACH_EMAIL:
Subject: [subject line]
[email body]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const commentMatch = text.match(/EXPERT_COMMENT:\n([\s\S]*?)(?=OUTREACH_EMAIL:|$)/);
  const emailMatch   = text.match(/OUTREACH_EMAIL:\n([\s\S]*?)$/);

  return {
    author,
    expertComment: commentMatch ? commentMatch[1].trim() : '',
    outreachEmail: emailMatch   ? emailMatch[1].trim()   : '',
  };
}

// ─── Save prospects to sheet ──────────────────────────────────────────────────

async function saveToSheet(sheets, prospects) {
  if (prospects.length === 0) return;

  const today = new Date().toISOString().split('T')[0];
  const rows  = prospects.map(p => [
    today,
    p.article.publication.name,
    p.article.publication.da,
    p.article.title,
    p.article.url,
    p.article.keywords,
    p.outreach.author,
    p.outreach.expertComment,
    p.outreach.outreachEmail,
    p.article.publication.contact,
    'new',
    '',
    p.article.publication.notes,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A:M`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Backlink Outreach Monitor      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN\n');

  const sheets = await getSheetsClient();
  await ensureTab(sheets);

  const processedUrls = await getProcessedUrls(sheets);
  console.log(`Previously processed: ${processedUrls.size} articles\n`);

  // Fetch all feeds
  const allArticles = [];
  for (const pub of PUBLICATIONS) {
    process.stdout.write(`Fetching ${pub.name}... `);
    const articles = await fetchRSS(pub);
    const newArticles = articles.filter(a => !processedUrls.has(a.url));
    console.log(`${articles.length} bridging articles, ${newArticles.length} new`);
    allArticles.push(...newArticles);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal new bridging finance articles: ${allArticles.length}`);

  if (allArticles.length === 0) {
    console.log('No new articles found. Done.\n');
    return;
  }

  // Generate outreach for each new article (max 10 per run to control costs)
  const toProcess = allArticles.slice(0, 10);
  const prospects  = [];

  for (const article of toProcess) {
    console.log(`\nGenerating outreach for: "${article.title.slice(0, 60)}..."`);
    console.log(`  Publication: ${article.publication.name} | Keywords: ${article.keywords}`);

    if (isDryRun) {
      console.log('  [DRY RUN] Would generate expert comment + outreach email');
      continue;
    }

    try {
      const outreach = await generateOutreach(article);
      prospects.push({ article, outreach });
      console.log(`  ✅ Expert comment: ${outreach.expertComment.slice(0, 80)}...`);
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.warn(`  ❌ Generation failed: ${err.message}`);
    }
  }

  if (prospects.length > 0) {
    console.log(`\nSaving ${prospects.length} prospects to ${SHEET_TAB} tab...`);
    await saveToSheet(sheets, prospects);
    console.log('✅ Saved');
  }

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  ${prospects.length} new outreach opportunities queued         ║`);
  console.log(`║  Review drafts in the Backlink_Prospects tab     ║`);
  console.log(`║  Send the best ones manually — 2-3 per week max  ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
