/**
 * regenerate-locations.js
 *
 * Re-generates the content field (and metaTitle / metaDescription / faqSchema)
 * for every page in locationPages.json using the winning-formula GPT prompt.
 *
 * Safe to run multiple times — it always re-fetches the live file from GitHub.
 *
 * Usage:
 *   node regenerate-locations.js                        # regenerate ALL pages
 *   node regenerate-locations.js --slug business-loans-london   # one specific page
 *   node regenerate-locations.js --dry-run              # log pages, no changes
 *
 * Environment variables (via .env or GitHub Actions secrets):
 *   OPENAI_API_KEY, GH_TOKEN (or GITHUB_PAT), GOOGLE_CREDENTIALS, SPREADSHEET_ID
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const { google } = require('googleapis');

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO = process.env.GITHUB_REPO || 'boxxfinance-site';
const LOCATION_FILE = 'src/data/locationPages.json';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Parse CLI flags
const args = process.argv.slice(2);
const targetSlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const dryRun = args.includes('--dry-run');

// ─── Google Sheets auth ───────────────────────────────────────────────────────

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Get published blogs for internal linking ─────────────────────────────────

async function getPublishedBlogs(sheets, service) {
  if (!SPREADSHEET_ID || !sheets) return [];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:L',
  });

  const rows = res.data.values || [];
  const blogs = [];

  for (const row of rows) {
    const type    = (row[1]  || '').toLowerCase().trim();
    const status  = (row[2]  || '').toLowerCase().trim();
    const rowSvc  = (row[5]  || '').toLowerCase().trim();
    const title   = row[9]   || '';
    const url     = row[11]  || '';

    if (type === 'blog' && status === 'published' && rowSvc === service.toLowerCase() && url) {
      blogs.push({
        url: url.startsWith('http') ? url : `https://boxxfinance.co.uk${url}`,
        title,
      });
    }
  }

  return blogs.slice(0, 4);
}

// ─── Generate location page (winning formula) ─────────────────────────────────

async function generateLocationPage(service, city, slug, relatedBlogs) {
  const serviceSlug = service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const serviceUrl  = `https://boxxfinance.co.uk/funding-solutions/${serviceSlug}`;

  const blogLinksText = relatedBlogs.length > 0
    ? `\nRelated blog posts — link naturally using the exact post title as anchor text:\n${relatedBlogs.map(b => `${b.url} — "${b.title}"`).join('\n')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 6000,
    messages: [
      {
        role: 'system',
        content: `You are an experienced UK commercial finance broker at Boxx Commercial Finance writing a location-specific landing page. Write as a trusted local expert who genuinely understands the business finance landscape in this city. Natural, human, advisory tone — as if speaking directly to a local business owner. Never use em dashes. Never use generic AI phrases ("in today's landscape", "navigating the challenges", etc.). No markdown, no backticks, no code fences. Return only a raw JSON object with no wrapper, no explanation.`,
      },
      {
        role: 'user',
        content: `Write a location landing page for ${service} in ${city}. Return as a single JSON object with exactly these keys:

slug, title, metaTitle, metaDescription, faqSchema, content

OUTPUT FORMAT RULES:
- content must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page'
- Do NOT include an <h1> tag — the title is rendered separately on the page
- No markdown, backticks, code fences, or curly quotes — raw JSON only
- slug format: ${serviceSlug}-${city.toLowerCase().replace(/\s+/g, '-')} (e.g. business-loans-leeds)
- title format: "${service} ${city}" (e.g. "Business Loans Leeds")
- metaTitle format: "${service} ${city} | Boxx Commercial Finance"

CONTENT STRUCTURE — follow this exact order:

1. OPENING PARAGRAPH (2–3 sentences, 60–80 words)
Start with clear intent matching: "Looking for ${service} in ${city}?" or similar. Directly answer why a ${city} business owner would come to this page. Mention Boxx Commercial Finance and link it to ${serviceUrl} using anchor text like "${service.toLowerCase()} for ${city} businesses".

2. <h2>What We Can Fund in ${city}</h2>
Specific types of businesses and deals common in ${city} — think about the actual economy of this city (manufacturing, retail, hospitality, property, logistics, professional services, etc.). What would a local business owner typically need ${service.toLowerCase()} for? Be specific and local — not generic. 3–4 short paragraphs or a practical list.

3. <h2>${city} Business Finance: What You Need to Know</h2>
THIS IS THE MOST IMPORTANT SECTION. Genuine local market insight:
- The ${city} business and property landscape (growth sectors, key industries, economic context)
- Common deal types and funding structures seen in this area
- Lender appetite and how it applies to ${city} businesses
- Any regional factors relevant to ${service.toLowerCase()} in this city
This must feel written by someone who actually brokers deals in ${city} — not a generic paragraph with the city name swapped in. 2–3 substantive paragraphs.

4. <h2>Our ${service} Solutions for ${city} Businesses</h2>
What Boxx actually offers — amounts, terms, lender types, timescales. Link ${serviceUrl} at least once more using keyword-rich anchor text (e.g. "specialist ${service.toLowerCase()} solutions"). Practical and specific — no waffle. 1–2 paragraphs.

5. <h2>A Recent ${city} Success Story</h2>
An anonymised but realistic case study. "Recently, we helped a ${city}-based [specific type of business]..." — include a realistic funding amount, the challenge they faced, what product was arranged, and the outcome. This is highly persuasive for local visitors. 1 solid paragraph.

6. <h2>How the Process Works</h2>
Four clear steps: initial enquiry → lender matching → offer received → completion. Brief and reassuring — show it's straightforward. Use a numbered list or 4 short sentences.

7. <h2>Frequently Asked Questions</h2>
4–6 Q&As using <dl><dt><dd> tags. Questions should be exactly what a ${city} business owner would type into Google or ask an AI model, e.g.:
- "Can I get ${service.toLowerCase()} in ${city}?"
- "How quickly can ${service.toLowerCase()} be arranged in ${city}?"
- "What are the requirements for ${service.toLowerCase()} in ${city}?"
- "Does Boxx Commercial Finance work with businesses in ${city}?"
Keep answers direct and specific to ${city} where possible.

8. CLOSING CTA PARAGRAPH
Short and direct — 2–3 sentences. Encourage the reader to get in touch. Link to https://boxxfinance.co.uk/chat-about-funding using anchor text like "speak to a ${service.toLowerCase()} specialist" or "discuss your funding needs with our team". End with a brief confidence statement.

WORD COUNT: Minimum 1000 words in the content field.

TONE AND QUALITY:
- Every section must feel genuinely written for ${city} — not a template with city name swapped
- Short paragraphs throughout
- Include natural keyword variations: "${service.toLowerCase()} ${city.toLowerCase()}", "${service.toLowerCase()} broker ${city.toLowerCase()}", "business finance ${city.toLowerCase()}", "SME funding ${city.toLowerCase()}"
- Mention "Boxx Commercial Finance" 2–3 times
- Link https://boxxfinance.co.uk/about-us as "Boxx Commercial Finance" the first time the brand name appears

INTERNAL LINKS — mandatory, keyword-rich anchor text only:
- ${serviceUrl}: at least 2 links, anchor text like "${service.toLowerCase()} for ${city} businesses" or "specialist ${service.toLowerCase()} solutions"
- https://boxxfinance.co.uk/about-us: link brand name "Boxx Commercial Finance" first time it appears
- https://boxxfinance.co.uk/chat-about-funding: in closing CTA
- NEVER invent URLs — only use URLs explicitly provided
${blogLinksText}

faqSchema: valid @type: FAQPage object, exactly matching the FAQ section in content`,
      },
    ],
  });

  let raw = response.choices[0].message.content;
  raw = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .trim();

  let page;
  try {
    page = JSON.parse(raw);
  } catch (err) {
    console.error('  GPT returned invalid JSON. Raw output (first 500 chars):');
    console.error(raw.substring(0, 500));
    throw new Error(`Failed to parse GPT response as JSON for ${service} in ${city}`);
  }

  return page;
}

// ─── GitHub: read file ─────────────────────────────────────────────────────────

async function readLocationFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
  });
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, pages: JSON.parse(content) };
}

// ─── GitHub: write file ────────────────────────────────────────────────────────

async function writeLocationFile(pages, sha, message) {
  const content = Buffer.from(JSON.stringify(pages, null, 2)).toString('base64');
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
    message,
    content,
    sha,
    branch: 'main',
  });
  return data.content.sha;
}

// ─── Deduplicate pages by slug (keep last — most recent publish) ──────────────

function deduplicatePages(pages) {
  const seen = new Map();
  for (const page of pages) {
    seen.set(page.slug, page); // later entries overwrite earlier ones
  }
  return Array.from(seen.values());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Location Page Regenerator  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (dryRun) console.log('⚠  DRY RUN — no changes will be written\n');

  // ── Connect to Sheets (optional — used for related blog links) ──────────────
  let sheets = null;
  try {
    sheets = await getSheetsClient();
    console.log('Connected to Google Sheets for related blog lookups');
  } catch {
    console.log('Could not connect to Sheets — will generate without related blog links');
  }

  // ── Read current location pages ─────────────────────────────────────────────
  console.log('\nReading locationPages.json from GitHub...');
  let { sha, pages } = await readLocationFile();
  console.log(`  Found ${pages.length} pages (before dedup)`);

  // Deduplicate first
  const dedupedPages = deduplicatePages(pages);
  if (dedupedPages.length < pages.length) {
    console.log(`  Removed ${pages.length - dedupedPages.length} duplicate slug(s)`);
  }
  pages = dedupedPages;
  console.log(`  Processing ${pages.length} unique pages`);

  // Filter to target slug if specified
  const toProcess = targetSlug
    ? pages.filter(p => p.slug === targetSlug)
    : pages;

  if (targetSlug && toProcess.length === 0) {
    console.log(`\n  No page found with slug "${targetSlug}". Available slugs:`);
    pages.forEach(p => console.log(`    - ${p.slug}`));
    return;
  }

  console.log(`\nRegenerating ${toProcess.length} page(s):\n`);
  toProcess.forEach(p => console.log(`  - ${p.slug} (${p.service}, ${p.location})`));

  if (dryRun) {
    console.log('\n⚠  Dry run complete — no pages were changed.');
    return;
  }

  // ── Regenerate each page ─────────────────────────────────────────────────────
  let regenerated = 0;

  for (const page of toProcess) {
    console.log(`\n── ${page.slug} ──`);

    const service = page.service;
    const city    = page.location;

    if (!service || !city) {
      console.log(`  Skipping — missing service or location field`);
      continue;
    }

    // Fetch related blogs for internal linking
    const relatedBlogs = sheets ? await getPublishedBlogs(sheets, service) : [];
    if (relatedBlogs.length > 0) {
      console.log(`  Found ${relatedBlogs.length} related blog(s) for ${service}`);
    }

    try {
      console.log(`  Generating content via GPT-4o...`);
      const generated = await generateLocationPage(service, city, page.slug, relatedBlogs);

      // Update the page object in-place
      const idx = pages.findIndex(p => p.slug === page.slug);
      if (idx !== -1) {
        pages[idx] = {
          ...pages[idx],
          // Keep existing metadata fields that are correct
          title:           pages[idx].title || generated.title,
          metaTitle:       generated.metaTitle || pages[idx].metaTitle,
          metaDescription: generated.metaDescription || pages[idx].metaDescription,
          faqSchema:       generated.faqSchema || null,
          // Replace the content
          content:         generated.content,
        };
        console.log(`  ✅ Generated (${generated.content.length} chars)`);
      }

      regenerated++;
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }

    // Small delay between GPT calls to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  if (regenerated === 0) {
    console.log('\nNo pages were successfully regenerated.');
    return;
  }

  // ── Push updated file to GitHub ──────────────────────────────────────────────
  console.log(`\nPushing updated locationPages.json (${regenerated} page(s) updated)...`);
  const slugList = toProcess.slice(0, regenerated).map(p => p.slug).join(', ');
  const message = `Regenerate location pages with winning-formula prompt (${regenerated} pages): ${slugList.substring(0, 100)}`;

  await writeLocationFile(pages, sha, message);
  console.log(`  ✅ Pushed to GitHub`);

  console.log(`\n✅ Done! Regenerated ${regenerated} location page(s).\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
