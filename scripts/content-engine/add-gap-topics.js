/**
 * add-gap-topics.js
 *
 * Queues the curated competitor-gap topics in src/data/contentGapTopics.json
 * into the ContentEngine sheet as scheduled blog rows.
 *
 * These came from the sitemap analysis in docs/competitor-content-gaps.md:
 * topics two competitors invest in and Boxx has little or no coverage of.
 * Unlike add-visibility-content.js, which derives topics automatically from
 * AI mention rates, this list is hand-written and reviewed — hence a separate
 * data file rather than generated titles.
 *
 * Idempotent. Reruns skip anything whose slug is already in the sheet or
 * already published, so a repeat run adds nothing.
 *
 * Run: node add-gap-topics.js [--dry-run] [--slot AM|PM] [--start YYYY-MM-DD]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Octokit } = require('@octokit/rest');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB         = 'ContentEngine';
const SERVICE        = 'Bridging Finance';   // must match publish-blog.yml's SERVICE_FILTER, or these will never publish
const SERVICE_URL    = '/funding-solutions/bridging-loans';
const TOPICS_FILE    = path.resolve(__dirname, '../../src/data/contentGapTopics.json');
const GITHUB_OWNER   = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO    = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE      = 'src/data/blogPosts.json';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

function toSlug(s) {
  return String(s).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Published posts as well as sheet rows: a topic may have been published
// through another route since the gap analysis was written.
async function getPublishedSlugs() {
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
    const raw = data.content && data.encoding !== 'none'
      ? data.content
      : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
    return new Set(JSON.parse(Buffer.from(raw, 'base64').toString('utf8')).map(p => p.slug));
  } catch (err) {
    console.warn(`  ⚠ Could not read published posts (${err.message}) — relying on sheet slugs only.`);
    return new Set();
  }
}

// Column contract matches buildPmBlogRow in add-visibility-content.js (A..AC).
// Keep the two in step: a mismatch here writes silently malformed rows that
// only surface when the publisher reads the wrong field.
function buildRow(id, date, slot, topic, author) {
  const slug = toSlug(topic.title);
  return [
    String(id), 'blog', 'scheduled', date, slot,
    SERVICE, '',
    topic.keyword, '', topic.title, slug,
    `https://boxxfinance.co.uk/insights/${slug}`,
    `${topic.title} | Boxx Finance`, '',
    SERVICE, topic.brief, SERVICE_URL,
    '', '', '',
    '', '', '',
    'yes', 'yes', author,
    '', '',
    'Competitor content gap — see docs/competitor-content-gaps.md',
  ];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const slotArg  = process.argv.indexOf('--slot');
  const slot     = slotArg !== -1 && process.argv[slotArg + 1] ? process.argv[slotArg + 1].toUpperCase() : 'PM';
  const startArg = process.argv.indexOf('--start');

  console.log('\n[Add competitor-gap topics to ContentEngine]\n');
  if (isDryRun) console.log('DRY RUN — nothing will be written\n');

  const { topics } = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  console.log(`${topics.length} curated topic(s) in ${path.basename(TOPICS_FILE)}`);

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${CE_TAB}!A2:AC` });
  const rows = res.data.values || [];

  const existingSlugs = new Set(rows.map(r => (r[10] || '').trim()).filter(Boolean));
  const publishedSlugs = await getPublishedSlugs();
  const maxId = rows.reduce((m, r) => Math.max(m, parseInt(r[0], 10) || 0), 0);

  // Alternate authors, matching how the rest of the engine spreads them.
  const authors = ['Mark Higgins', 'Tara Jameson'];

  // Default: start tomorrow, one per day. The publisher takes rows with
  // publishDate <= today, so dating them forward keeps them from all becoming
  // eligible at once and jumping the existing queue.
  const start = startArg !== -1 && process.argv[startArg + 1]
    ? new Date(process.argv[startArg + 1])
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  const newRows = [];
  let id = maxId + 1;
  let dayOffset = 0;
  for (const topic of topics) {
    const slug = toSlug(topic.title);
    if (existingSlugs.has(slug))  { console.log(`  skip (already queued):    ${slug}`); continue; }
    if (publishedSlugs.has(slug)) { console.log(`  skip (already published): ${slug}`); continue; }

    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset++);
    const date = d.toISOString().split('T')[0];

    newRows.push(buildRow(id, date, slot, topic, authors[newRows.length % authors.length]));
    console.log(`  queue ${date} [${slot}] ${slug}`);
    existingSlugs.add(slug);
    id++;
  }

  if (newRows.length === 0) {
    console.log('\nNothing new to add — every topic is already queued or published.');
    return;
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would append ${newRows.length} row(s) to ${CE_TAB}.`);
    console.log('First row:', JSON.stringify(newRows[0].slice(0, 12)));
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A:AC`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newRows },
  });
  console.log(`\n✅ Appended ${newRows.length} row(s) to ${CE_TAB}.`);
  console.log('The duplicate-coverage guard in publish-blog.js still applies at publish time —');
  console.log('a topic that turns out to overlap existing coverage will be skipped and marked there.');
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
