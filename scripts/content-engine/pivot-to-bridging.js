/**
 * Boxx Finance — Pivot to Bridging Finance
 *
 * Strategic pivot: concentrate all content on Bridging Finance for 5-6 months
 * to build topical authority and become the go-to resource in that niche.
 *
 * This script:
 *   1. Marks all scheduled non-bridging blog rows in ContentEngine as 'paused'
 *      (location pages are also paused for non-bridging services)
 *   2. Reads bridging finance keywords from Keyword_Backlog
 *   3. Schedules new bridging finance blog posts (1/day, alternating Mark/Andrew)
 *   4. Schedules bridging finance location pages for all 250 UK cities (5/day)
 *
 * Run: node pivot-to-bridging.js [--dry-run]
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID   = process.env.SPREADSHEET_ID;
const FOCUS_SERVICE    = 'Bridging Finance';
const MAX_SCHEDULE_DAYS = 90;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function toSlug(text) {
  return text.toLowerCase().replace(/\b20\d{2}\b/g,'').replace(/[^a-z0-9\s]/g,'')
    .replace(/\s+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'');
}

// ─── Read existing ContentEngine rows ────────────────────────────────────────

async function readContentEngine(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  return res.data.values || [];
}

// ─── Step 1: Pause all non-bridging scheduled rows ──────────────────────────

async function pauseNonBridgingRows(sheets, rows, isDryRun) {
  const toPause = [];

  for (let i = 0; i < rows.length; i++) {
    const row     = rows[i];
    const type    = (row[1] || '').toLowerCase();
    const status  = (row[2] || '').toLowerCase();
    const service = (row[5] || '');

    if (status !== 'scheduled') continue;
    if (type !== 'blog' && type !== 'location') continue;

    // Keep bridging finance rows
    const isBridging = service === FOCUS_SERVICE || service === 'Bridging Finance';
    if (isBridging) continue;

    toPause.push({ rowIndex: i + 2, service, type, title: row[9] || row[6] || '' });
  }

  console.log(`  Rows to pause: ${toPause.length} non-bridging scheduled rows`);
  if (toPause.length > 0) {
    console.log(`  Sample: ${toPause.slice(0,3).map(r => `[${r.service}] ${r.title.slice(0,40)}`).join(', ')}`);
  }

  if (isDryRun || toPause.length === 0) return toPause.length;

  // Batch update status to 'paused' in chunks of 500
  const BATCH = 500;
  for (let start = 0; start < toPause.length; start += BATCH) {
    const chunk = toPause.slice(start, start + BATCH);
    const requests = chunk.map(r => ({
      range: `ContentEngine!C${r.rowIndex}`,
      values: [['paused']],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { valueInputOption: 'RAW', data: requests },
    });
    process.stdout.write(`\r  Paused ${Math.min(start + BATCH, toPause.length)} / ${toPause.length} rows...`);
  }
  console.log('');
  return toPause.length;
}

// ─── Step 2: Load bridging keywords from Keyword_Backlog ─────────────────────

async function loadBridgingKeywords(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Keyword_Backlog!A2:H',
  });
  const rows = res.data.values || [];

  const PRIORITY_ORDER = { '1': 0, '2': 1, '3': 2 };
  const STATUS_ORDER   = { 'scheduled-year1': 0, 'backlog': 1 };

  return rows
    .filter(r => r[1] === FOCUS_SERVICE && r[2])
    .map(r => ({
      service: FOCUS_SERVICE,
      keyword: (r[2] || '').toLowerCase().trim(),
      priority: r[4] || '3',
      status:   r[5] || 'backlog',
    }))
    .sort((a, b) => {
      const sDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      return sDiff !== 0 ? sDiff : (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    })
    .map((r, idx) => {
      const title = r.keyword.split(' ').map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
      const slug  = toSlug(r.keyword);
      // Alternate between Mark and Andrew for both LinkedIn channels
      const author = idx % 2 === 0 ? 'Mark Higgins' : 'Andrew Farrimond';
      return {
        service: FOCUS_SERVICE, keyword: r.keyword, title, slug, author,
        brief: `Expert UK guide on "${r.keyword}" for property investors and developers. Cover what it is, how it works, rates, eligibility, and why Boxx Commercial Finance is the right broker. 1,200+ words with FAQ schema. Mention Boxx 3-4 times naturally.`,
      };
    });
}

// ─── Step 3: Load cities from UK_Places ──────────────────────────────────────

async function loadCities(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'UK_Places!A2:E',
  });
  return (res.data.values || []).filter(r => r[1]).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(r => r[1]);
}

// ─── Build row arrays ─────────────────────────────────────────────────────────

const SERVICE_META = {
  'Bridging Finance': {
    slug: 'bridging-finance',
    serviceUrl: '/funding-solutions/bridging-finance',
    category: 'Bridging Finance',
  },
};

function buildBlogRow(id, date, topic) {
  const meta = SERVICE_META[FOCUS_SERVICE];
  return [
    String(id), 'blog', 'scheduled', date, 'AM',
    FOCUS_SERVICE, '', topic.keyword, '', topic.title,
    topic.slug, `https://boxxfinance.co.uk/insights/${topic.slug}`,
    `${topic.title} | Boxx Commercial Finance`, '',
    meta.category, topic.brief, meta.serviceUrl,
    '', '', '', '', '', '',
    'yes', 'yes', topic.author, '', '',
    'Bridging Finance pivot 2026',
  ];
}

function buildLocationRow(id, date, city) {
  const meta = SERVICE_META[FOCUS_SERVICE];
  const citySlug = city.toLowerCase().replace(/\s+/g,'-').replace(/'/g,'');
  const slug  = `bridging-finance-${citySlug}`;
  const title = `Bridging Finance ${city}`;
  return [
    String(id), 'location', 'scheduled', date, 'PM',
    FOCUS_SERVICE, city, `bridging finance ${city.toLowerCase()}`, '', title,
    slug, `/locations/${slug}`,
    `${title} | Boxx Commercial Finance`, '',
    'Location', '', meta.serviceUrl,
    '', '', '', '', '', '',
    'yes', 'no', 'Mark Higgins', '', '',
    'Bridging Finance pivot 2026',
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Pivot to Bridging Finance       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN — no changes written\n');

  const sheets = await getSheetsClient();

  // ── Step 1: Pause non-bridging rows ─────────────────────────────────────────
  console.log('Step 1: Reading ContentEngine...');
  const ceRows = await readContentEngine(sheets);
  console.log(`  ${ceRows.length} total rows`);

  console.log('  Pausing non-bridging scheduled rows...');
  const pausedCount = await pauseNonBridgingRows(sheets, ceRows, isDryRun);
  console.log(`  ✅ ${pausedCount} rows paused`);

  // Find last scheduled date and max ID across ALL rows (including just-paused)
  let lastDate = new Date().toISOString().split('T')[0];
  let maxId = 0;
  const existingSlugs = new Set();

  for (const row of ceRows) {
    const d = (row[3] || '').trim();
    const status = (row[2] || '').toLowerCase();
    // Only count active (scheduled/published) bridging rows for last date
    if (d && status === 'scheduled' && row[5] === FOCUS_SERVICE && d > lastDate) lastDate = d;
    if (d && status === 'published' && d > lastDate) lastDate = d;
    const idNum = parseInt(row[0], 10);
    if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
    const slug = (row[10] || '').trim();
    if (slug) existingSlugs.add(slug);
  }

  // ── Step 2: Load bridging keywords ──────────────────────────────────────────
  console.log('\nStep 2: Loading Bridging Finance keywords...');
  const keywords = await loadBridgingKeywords(sheets);
  console.log(`  ${keywords.length} keywords loaded from Keyword_Backlog`);

  // ── Step 3: Load cities ──────────────────────────────────────────────────────
  console.log('\nStep 3: Loading UK cities...');
  const cities = await loadCities(sheets);
  console.log(`  ${cities.length} cities loaded from UK_Places`);

  // ── Step 4: Build schedule ───────────────────────────────────────────────────
  console.log('\nStep 4: Building schedule...');

  const cursor     = addDays(lastDate, 1);
  const cutoffDate = addDays(cursor, MAX_SCHEDULE_DAYS - 1);
  let nextId       = maxId + 1;

  console.log(`  Scheduling window: ${cursor} → ${cutoffDate}`);

  const newRows = [];

  // Blog rows: 1/day, alternating Mark/Andrew
  const blogQueue = keywords.filter(k => !existingSlugs.has(k.slug));
  for (let i = 0; i < blogQueue.length; i++) {
    const date = addDays(cursor, i);
    if (date > cutoffDate) break;
    newRows.push({ date, row: buildBlogRow(nextId++, date, blogQueue[i]) });
  }

  // Location rows: 5/day (Bridging Finance × all cities)
  const locQueue = cities.filter(c => {
    const slug = `bridging-finance-${c.toLowerCase().replace(/\s+/g,'-').replace(/'/g,'')}`;
    return !existingSlugs.has(slug);
  });
  for (let i = 0; i < locQueue.length; i++) {
    const date = addDays(cursor, Math.floor(i / 5));
    if (date > cutoffDate) break;
    newRows.push({ date, row: buildLocationRow(nextId++, date, locQueue[i]) });
  }

  newRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.row[1] === 'blog' ? -1 : 1;
  });

  const blogCount = newRows.filter(r => r.row[1] === 'blog').length;
  const locCount  = newRows.filter(r => r.row[1] === 'location').length;

  console.log(`  Blog rows  : ${blogCount} (alternating Mark/Andrew)`);
  console.log(`  Location rows: ${locCount} (Bridging Finance × cities)`);
  console.log(`  Total new   : ${newRows.length}`);
  console.log(`  Date range  : ${newRows[0]?.date} → ${newRows[newRows.length-1]?.date}`);

  if (isDryRun) {
    console.log('\n⚠  DRY RUN — first 5 rows that would be added:');
    newRows.slice(0,5).forEach(r => console.log(`  ${r.row[3]} | ${r.row[1]} | ${r.row[9] || r.row[6]} (${r.row[25]})`));
    return;
  }

  if (newRows.length === 0) {
    console.log('\nNo new rows to add — schedule already full for this window.');
    return;
  }

  // ── Step 5: Append to ContentEngine ─────────────────────────────────────────
  console.log('\nStep 5: Writing to ContentEngine...');
  const BATCH = 500;
  const values = newRows.map(r => r.row);
  for (let start = 0; start < values.length; start += BATCH) {
    const chunk = values.slice(start, start + BATCH);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ContentEngine!A:AC',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: chunk },
    });
    console.log(`  Appended ${start + 1}–${Math.min(start + BATCH, values.length)}`);
  }

  console.log(`\n✅ Pivot complete!`);
  console.log(`   Paused ${pausedCount} non-bridging rows`);
  console.log(`   Added ${blogCount} bridging finance blog posts (Mark + Andrew alternating)`);
  console.log(`   Added ${locCount} bridging finance location pages`);
  console.log(`   Content scheduled through: ${newRows[newRows.length-1]?.date}\n`);
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
