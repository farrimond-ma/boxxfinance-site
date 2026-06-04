/**
 * Boxx Finance — Search Console Action Engine
 *
 * Runs after search-console-insights.js has written data to the sheet.
 * Takes three autonomous actions every Monday:
 *
 * ACTION 1 — Auto-fix low CTR (highest value, lowest effort)
 *   Pages ranking on page 1 but not getting clicks need better titles/meta.
 *   Claude rewrites the top 5 low-CTR meta titles and descriptions.
 *   Updates blogPosts.json → live within hours of next deploy.
 *
 * ACTION 2 — Schedule content gaps as PM blog posts
 *   Queries where Google already shows us but we have no dedicated article.
 *   These go to top of PM blog queue — search data proves real user demand.
 *
 * ACTION 3 — Flag page-2 articles for content refresh
 *   Articles ranking 11-30 need improvement, not replacement.
 *   Writes a 'Needs Refresh' list to the sheet for manual review or
 *   future automated refresh workflow.
 *
 * Run: node search-console-actions.js [--dry-run]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');

const GITHUB_OWNER   = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO    = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE      = 'src/data/blogPosts.json';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'https://boxxfinance.co.uk';

// How many of each opportunity to act on per week
const MAX_META_FIXES      = 5;  // Low CTR: rewrite meta title/desc
const MAX_CONTENT_GAPS    = 5;  // Content gaps: schedule as PM blogs
const MAX_REFRESH_FLAGS   = 10; // Page 2: flag for content refresh

const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  let credentials;
  try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
  catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ─── Read Search Console data from sheet ─────────────────────────────────────

async function readSearchConsoleData(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Search_Console!A:G',
  });
  const rows = res.data.values || [];
  if (rows.length < 3) return { lowCtr: [], contentGaps: [], page2: [] };

  const lowCtr      = [];
  const contentGaps = [];
  const page2       = [];

  for (const row of rows.slice(2)) { // skip header rows
    if (!row[0] || !row[1]) continue;
    const type = (row[1] || '').toLowerCase();
    const entry = {
      query:       row[0],
      position:    parseFloat(row[2]) || 0,
      impressions: parseInt(row[3])   || 0,
      clicks:      parseInt(row[4])   || 0,
      ctr:         row[5] || '0%',
      opportunity: row[6] || '',
    };
    if (type.includes('low ctr'))      lowCtr.push(entry);
    else if (type.includes('content')) contentGaps.push(entry);
    else if (type.includes('page 2'))  page2.push(entry);
  }

  return { lowCtr, contentGaps, page2 };
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  return { sha: data.sha, posts: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, message) {
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message, sha: latest.sha, branch: 'main',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
  });
}

// ─── ACTION 1: Auto-fix low CTR meta titles and descriptions ─────────────────

async function improveMetaForPage(post, query) {
  const prompt = `You are an SEO specialist improving the meta title and description for a UK commercial finance article.

The article is ranking for "${query}" but has a low click-through rate from Google.

CURRENT TITLE: ${post.metaTitle || post.title}
CURRENT DESCRIPTION: ${post.metaDescription || '(none)'}
ARTICLE TOPIC: ${post.title}
SEARCH QUERY: ${query}

Write an improved meta title and description that will get more clicks from someone searching "${query}".

Rules:
- Meta title: max 60 characters, must include the exact query or close variant, compelling and specific
- Meta description: 140-155 characters, answers what the searcher wants to know, includes a benefit, ends with implicit CTA
- UK English, no generic phrases like "find out more" or "click here"
- Write for a business owner searching this query, not a general audience

Return ONLY:
TITLE: [new title]
DESCRIPTION: [new description]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const titleMatch = text.match(/TITLE:\s*(.+)/);
  const descMatch  = text.match(/DESCRIPTION:\s*(.+)/);

  return {
    metaTitle:       titleMatch ? titleMatch[1].trim() : null,
    metaDescription: descMatch  ? descMatch[1].trim()  : null,
  };
}

async function action1_fixLowCTR(posts, lowCtrData, isDryRun) {
  console.log('\n─── ACTION 1: Fix low CTR meta titles/descriptions ───');

  // Find blog posts that match low CTR queries
  const toFix = [];
  for (const entry of lowCtrData.slice(0, MAX_META_FIXES * 3)) {
    const queryWords = entry.query.toLowerCase().split(' ');
    const match = posts.find(p =>
      p.status === 'published' &&
      queryWords.some(w => w.length > 4 && (p.slug.includes(w) || (p.keywords || '').toLowerCase().includes(w)))
    );
    if (match && !toFix.find(f => f.slug === match.slug)) {
      toFix.push({ post: match, query: entry.query, ctr: entry.ctr });
    }
    if (toFix.length >= MAX_META_FIXES) break;
  }

  if (toFix.length === 0) {
    console.log('  No matching articles found for low CTR queries');
    return 0;
  }

  let fixed = 0;
  for (const { post, query, ctr } of toFix) {
    console.log(`  Improving: "${post.slug}" (query: "${query}", CTR: ${ctr})`);
    if (isDryRun) { console.log('  [DRY RUN] Would rewrite meta'); fixed++; continue; }

    const improved = await improveMetaForPage(post, query);
    if (improved.metaTitle) {
      console.log(`    Title: ${improved.metaTitle}`);
      post.metaTitle = improved.metaTitle;
    }
    if (improved.metaDescription) {
      console.log(`    Desc:  ${improved.metaDescription}`);
      post.metaDescription = improved.metaDescription;
    }
    fixed++;
    await new Promise(r => setTimeout(r, 500)); // rate limit
  }

  return fixed;
}

// ─── ACTION 2: Schedule content gaps as PM blog posts ────────────────────────

async function action2_scheduleContentGaps(sheets, posts, contentGaps, isDryRun) {
  console.log('\n─── ACTION 2: Schedule content gaps as PM blog posts ───');

  if (contentGaps.length === 0) {
    console.log('  No content gaps to schedule');
    return 0;
  }

  // Read ContentEngine to find available PM slots and existing slugs
  const ceRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:K',
  });
  const ceRows = ceRes.data.values || [];
  const existingSlugs = new Set(ceRows.map(r => r[10]).filter(Boolean));
  const publishedSlugs = new Set(posts.map(p => p.slug));

  // Find dates that have AM but no PM blog
  const today   = new Date().toISOString().split('T')[0];
  const cutoff  = new Date(); cutoff.setDate(cutoff.getDate() + 90);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  const dateMap = new Map();
  let maxId = 0;
  for (const row of ceRows) {
    const id   = parseInt(row[0], 10);
    const type = (row[1] || '').toLowerCase();
    const date = (row[3] || '').trim();
    const slot = (row[4] || 'AM').toUpperCase();
    const slug = row[10] || '';
    if (!isNaN(id) && id > maxId) maxId = id;
    if (type !== 'blog' || date < today || date > cutoffDate) continue;
    if (!dateMap.has(date)) dateMap.set(date, { hasAM: false, hasPM: false });
    const entry = dateMap.get(date);
    if (slot === 'AM') entry.hasAM = true;
    if (slot === 'PM') entry.hasPM = true;
    if (slug) existingSlugs.add(slug);
  }

  const availableSlots = [...dateMap.entries()]
    .filter(([, v]) => v.hasAM && !v.hasPM)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date]) => date);

  // Generate slug from query
  const toSlug = q => q.toLowerCase().replace(/\b20\d{2}\b/g,'').replace(/[^a-z0-9\s]/g,'')
    .replace(/\s+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'');

  const SERVICE_MAP = {
    'bridging':'Bridging Finance','commercial mortgage':'Commercial Mortgage',
    'development finance':'Development Finance','invoice finance':'Invoice Finance',
    'asset finance':'Asset Finance','business loan':'Business Loans',
    'working capital':'Working Capital','trade finance':'Trade Finance',
    'cashflow':'Cashflow Finance','mezzanine':'Mezzanine Finance',
    'structured finance':'Structured Finance',
  };
  const SERVICE_URLS = {
    'Bridging Finance':'/funding-solutions/bridging-finance',
    'Development Finance':'/funding-solutions/development-finance',
    'Commercial Mortgage':'/funding-solutions/commercial-mortgages',
    'Invoice Finance':'/funding-solutions/invoice-finance',
    'Asset Finance':'/funding-solutions/asset-finance',
    'Business Loans':'/funding-solutions/business-loans',
    'Working Capital':'/funding-solutions/working-capital',
    'Trade Finance':'/funding-solutions/trade-finance',
    'Cashflow Finance':'/funding-solutions/cashflow-finance',
    'Mezzanine Finance':'/funding-solutions/mezzanine-finance',
    'Structured Finance':'/funding-solutions/structured-finance',
  };
  const SERVICE_AUTHORS = {
    'Bridging Finance':'Mark Higgins','Development Finance':'Mark Higgins',
    'Commercial Mortgage':'Mark Higgins','Mezzanine Finance':'Mark Higgins',
    'Structured Finance':'Mark Higgins','Invoice Finance':'Andrew Farrimond',
    'Asset Finance':'Andrew Farrimond','Business Loans':'Andrew Farrimond',
    'Working Capital':'Andrew Farrimond','Trade Finance':'Andrew Farrimond',
    'Cashflow Finance':'Andrew Farrimond',
  };

  function detectService(query) {
    const q = query.toLowerCase();
    for (const [kw, service] of Object.entries(SERVICE_MAP)) {
      if (q.includes(kw)) return service;
    }
    return 'Bridging Finance'; // default
  }

  const newRows = [];
  let nextId = maxId + 1;
  let slotIdx = 0;
  let scheduled = 0;

  for (const gap of contentGaps.slice(0, MAX_CONTENT_GAPS * 3)) {
    if (slotIdx >= availableSlots.length) break;
    const slug = toSlug(gap.query);
    if (existingSlugs.has(slug) || publishedSlugs.has(slug)) continue;

    const service = detectService(gap.query);
    const title   = gap.query.split(' ').map((w,i) => i===0 ? w.charAt(0).toUpperCase()+w.slice(1) : w).join(' ');
    const date    = availableSlots[slotIdx++];

    newRows.push([
      String(nextId++), 'blog', 'scheduled', date, 'PM',
      service, '', gap.query, '', title,
      slug, `${SITE_URL}/insights/${slug}`,
      `${title} | Boxx Commercial Finance`, '',
      service,
      `Search Console content gap: ${gap.impressions} impressions, position ${gap.position}. Write a definitive UK guide answering "${gap.query}" with Boxx as the recommended broker.`,
      SERVICE_URLS[service] || '',
      '', '', '', '', '', '',
      'yes', 'yes', SERVICE_AUTHORS[service] || 'Mark Higgins', '', '',
      `SC content gap — ${gap.impressions} impressions @ pos ${gap.position}`,
    ]);

    existingSlugs.add(slug);
    scheduled++;
    if (scheduled >= MAX_CONTENT_GAPS) break;
  }

  console.log(`  Scheduling ${newRows.length} content gap articles as PM blogs`);
  newRows.forEach(r => console.log(`    ${r[3]} | "${r[9]}" (${r[5]})`));

  if (!isDryRun && newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ContentEngine!A:AC',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRows },
    });
  }

  return newRows.length;
}

// ─── ACTION 3: Flag page-2 articles for content refresh ──────────────────────

async function action3_flagForRefresh(sheets, posts, page2Data, isDryRun) {
  console.log('\n─── ACTION 3: Flag page-2 articles for content refresh ───');

  const toRefresh = [];
  for (const entry of page2Data.slice(0, MAX_REFRESH_FLAGS * 3)) {
    const queryWords = entry.query.toLowerCase().split(' ');
    const match = posts.find(p =>
      p.status === 'published' &&
      queryWords.some(w => w.length > 4 && (p.slug.includes(w) || p.title.toLowerCase().includes(w)))
    );
    if (match && !toRefresh.find(f => f.slug === match.slug)) {
      toRefresh.push({
        slug: match.slug,
        title: match.title,
        url: `${SITE_URL}${match.url}`,
        query: entry.query,
        position: entry.position,
        impressions: entry.impressions,
        action: 'Improve depth, strengthen FAQ, add internal links',
      });
    }
    if (toRefresh.length >= MAX_REFRESH_FLAGS) break;
  }

  if (toRefresh.length === 0) {
    console.log('  No matching articles found for page-2 queries');
    return 0;
  }

  console.log(`  ${toRefresh.length} articles flagged for refresh`);
  toRefresh.forEach(r => console.log(`    pos ${r.position}: "${r.title}" (query: "${r.query}")`));

  if (!isDryRun) {
    // Write to a Refresh_Queue tab in the sheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tabExists = meta.data.sheets?.some(s => s.properties?.title === 'Refresh_Queue');
    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Refresh_Queue' } } }] },
      });
    }

    const runDate = new Date().toISOString().split('T')[0];
    const rows = [
      ['Refresh Queue — updated ' + runDate],
      ['SLUG', 'TITLE', 'URL', 'TARGET QUERY', 'POSITION', 'IMPRESSIONS', 'RECOMMENDED ACTION', 'STATUS'],
      ...toRefresh.map(r => [r.slug, r.title, r.url, r.query, r.position, r.impressions, r.action, 'pending']),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Refresh_Queue!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }

  return toRefresh.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Search Console Actions     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN — no changes will be written\n');

  const auth   = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Reading Search Console data from sheet...');
  const { lowCtr, contentGaps, page2 } = await readSearchConsoleData(sheets);
  console.log(`  Low CTR: ${lowCtr.length}, Content gaps: ${contentGaps.length}, Page 2: ${page2.length}`);

  if (lowCtr.length + contentGaps.length + page2.length === 0) {
    console.log('\n  No Search Console data found — has the insights script run yet?');
    console.log('  Run search-console-insights.js first.\n');
    return;
  }

  console.log('\nLoading blogPosts.json...');
  const { posts } = await getBlogPostsFile();
  console.log(`  ${posts.length} published posts loaded`);

  // ACTION 1: Fix low CTR meta
  const metaFixed = await action1_fixLowCTR(posts, lowCtr, isDryRun);

  // ACTION 2: Schedule content gaps
  const gapsScheduled = await action2_scheduleContentGaps(sheets, posts, contentGaps, isDryRun);

  // ACTION 3: Flag page-2 for refresh
  const refreshFlagged = await action3_flagForRefresh(sheets, posts, page2, isDryRun);

  // Push blogPosts.json if meta was improved
  if (metaFixed > 0 && !isDryRun) {
    console.log('\nPushing updated meta to blogPosts.json...');
    await pushBlogPostsFile(posts, `seo: improved meta for ${metaFixed} low-CTR pages`);
    console.log('  ✅ Meta updates live — deploy will follow automatically');
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Meta titles/descriptions improved : ${metaFixed}`);
  console.log(`  Content gap articles scheduled    : ${gapsScheduled}`);
  console.log(`  Articles flagged for refresh       : ${refreshFlagged}`);
  console.log('═══════════════════════════════════════════════');
  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
