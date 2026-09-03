/**
 * add-service-topics.js
 *
 * Queues the curated launch content in src/data/serviceContentTopics.json into
 * the ContentEngine sheet as scheduled blog rows.
 *
 * Background: the site narrowed to six focus services (2026-09), but the
 * publishing pipeline only ever produced bridging content — publish-blog.yml
 * runs with SERVICE_FILTER set. Secured loans, bad credit mortgages and buy to
 * let refinance therefore had a service page each and nothing supporting them.
 * This seeds that supporting content.
 *
 * Rows are interleaved across the three services rather than queued in blocks,
 * so the published sequence does not read as three runs of eight near-identical
 * articles — which is both what a reader would notice and what the duplicate
 * guard in publish-blog.js exists to prevent.
 *
 * Idempotent. Reruns skip anything whose slug is already queued or already
 * published, so a repeat run adds nothing.
 *
 * IMPORTANT: these rows only publish if publish-blog.yml's SERVICE_FILTER
 * includes their service. It accepts a comma-separated list — see the note
 * beside it in the workflow.
 *
 * Run: node add-service-topics.js [--dry-run] [--slot AM|PM]
 *                                 [--start YYYY-MM-DD] [--service "Secured Loans"]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Octokit } = require('@octokit/rest');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB         = 'ContentEngine';
const TOPICS_FILE    = path.resolve(__dirname, '../../src/data/serviceContentTopics.json');
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

// GOOGLE_CREDENTIALS is stored base64-encoded; try that first and fall back to
// raw JSON, matching every other script in this directory.
async function getSheets() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS is not set');
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is not set');
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
  } catch {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

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

// Column contract A..AC, matching buildRow in add-gap-topics.js. Keep the two
// in step: a mismatch writes silently malformed rows that only surface when the
// publisher reads the wrong field.
function buildRow(id, date, slot, service, serviceUrl, topic, author) {
  const slug = toSlug(topic.title);
  return [
    String(id), 'blog', 'scheduled', date, slot,
    service, '',
    topic.keyword, '', topic.title, slug,
    `https://boxxfinance.co.uk/insights/${slug}`,
    `${topic.title} | Boxx Finance`, '',
    service, topic.brief, serviceUrl,
    '', '', '',
    '', '', '',
    'yes', 'yes', author,
    '', '',
    'Focus-service launch content — see src/data/serviceContentTopics.json',
  ];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const slotArg  = process.argv.indexOf('--slot');
  const slot     = slotArg !== -1 && process.argv[slotArg + 1] ? process.argv[slotArg + 1].toUpperCase() : 'PM';
  const startArg = process.argv.indexOf('--start');
  const svcArg   = process.argv.indexOf('--service');
  const onlySvc  = svcArg !== -1 && process.argv[svcArg + 1] ? process.argv[svcArg + 1].toLowerCase() : null;

  console.log('\n[Add focus-service topics to ContentEngine]\n');
  if (isDryRun) console.log('DRY RUN — nothing will be written\n');

  const { services } = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  const active = onlySvc
    ? services.filter(s => s.service.toLowerCase() === onlySvc)
    : services;

  if (active.length === 0) {
    console.error(`No service matching "${process.argv[svcArg + 1]}" in ${path.basename(TOPICS_FILE)}.`);
    console.error(`Available: ${services.map(s => s.service).join(', ')}`);
    process.exit(1);
  }
  console.log(`${active.length} service(s), ${active.reduce((n, s) => n + s.topics.length, 0)} topic(s)`);

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${CE_TAB}!A2:AC` });
  const rows = res.data.values || [];

  const existingSlugs = new Set(rows.map(r => (r[10] || '').trim()).filter(Boolean));
  const publishedSlugs = await getPublishedSlugs();
  const maxId = rows.reduce((m, r) => Math.max(m, parseInt(r[0], 10) || 0), 0);

  // Round-robin across services so the published order alternates rather than
  // running eight secured-loan articles back to back.
  const queues = active.map(s => ({ ...s, remaining: [...s.topics] }));
  const interleaved = [];
  while (queues.some(q => q.remaining.length)) {
    for (const q of queues) {
      const topic = q.remaining.shift();
      if (topic) interleaved.push({ service: q.service, serviceUrl: q.serviceUrl, topic });
    }
  }

  const authors = ['Mark Higgins', 'Tara Jameson'];

  // Default: start tomorrow, one per day. The publisher takes rows with
  // publishDate <= today, so dating them forward stops them all becoming
  // eligible at once and jumping the existing bridging queue.
  const start = startArg !== -1 && process.argv[startArg + 1]
    ? new Date(process.argv[startArg + 1])
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  const newRows = [];
  let id = maxId + 1;
  let dayOffset = 0;
  for (const { service, serviceUrl, topic } of interleaved) {
    const slug = toSlug(topic.title);
    if (existingSlugs.has(slug))  { console.log(`  skip (already queued):    ${slug}`); continue; }
    if (publishedSlugs.has(slug)) { console.log(`  skip (already published): ${slug}`); continue; }

    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset++);
    const date = d.toISOString().split('T')[0];

    newRows.push(buildRow(id, date, slot, service, serviceUrl, topic, authors[newRows.length % authors.length]));
    console.log(`  queue ${date} [${slot}] ${service.padEnd(22)} ${slug}`);
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
  console.log('Reminder: these publish only if publish-blog.yml\'s SERVICE_FILTER includes their service.');
  console.log('The duplicate-coverage guard in publish-blog.js still applies at publish time.');
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
