/**
 * Boxx Finance — Fix Bridging Finance Schedule
 *
 * Diagnoses and repairs a bug in pivot-to-bridging.js's cursor calculation:
 * that script seeds `lastDate` from the latest publishDate among
 * scheduled-Bridging-Finance rows AND any published row. If a stray row in
 * ContentEngine carries a far-future publishDate (e.g. a typo'd year), it
 * poisons `lastDate`, and every newly-scheduled Bridging Finance post then
 * gets dated years from now — invisible to publish-blog.js's `publishDate <= today`
 * check, so nothing ever gets published.
 *
 * This script:
 *   1. Reports any row with publishDate >= 2027-01-01 (candidates for the
 *      row that poisoned the cursor)
 *   2. Finds Bridging Finance blog rows that are 'scheduled' far in the future
 *      (the batch the pivot mis-dated) and re-dates them sequentially
 *      starting tomorrow, 1/day — preserving their original relative order
 *      (and therefore the Mark/Andrew alternation baked in at creation)
 *
 * Run: node fix-bridging-schedule.js [--dry-run]
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const FOCUS_SERVICE  = 'Bridging Finance';
const FAR_FUTURE     = '2027-01-01';

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

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Fix Bridging Finance Schedule  ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  if (isDryRun) console.log('⚠  DRY RUN — no changes written\n');

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];
  console.log(`Read ${rows.length} rows. Today = ${today}\n`);

  // ── 1. Report any row with a suspiciously far-future publishDate ──────────
  console.log(`── Rows with publishDate >= ${FAR_FUTURE} (candidates for cursor poisoning) ──`);
  let garbageCount = 0;
  rows.forEach((row, i) => {
    const d = (row[3] || '').trim();
    if (d >= FAR_FUTURE) {
      garbageCount++;
      console.log(`  row ${i + 2}: id=${row[0]} type=${row[1]} status=${row[2]} date=${d} service="${row[5] || ''}" slug=${row[10] || ''} title="${(row[9] || '').slice(0, 60)}"`);
    }
  });
  if (!garbageCount) console.log('  (none found)');
  console.log('');

  // ── 2. Find the mis-dated Bridging Finance blog batch and re-date it ──────
  const toFix = [];
  rows.forEach((row, i) => {
    const type    = (row[1] || '').toLowerCase().trim();
    const status  = (row[2] || '').toLowerCase().trim();
    const service = (row[5] || '').trim();
    const d       = (row[3] || '').trim();
    if (type === 'blog' && status === 'scheduled' && service === FOCUS_SERVICE && d >= FAR_FUTURE) {
      toFix.push({ rowIndex: i + 2, currentDate: d, row });
    }
  });

  console.log(`── Bridging Finance blog rows mis-scheduled in the far future: ${toFix.length} ──`);
  if (!toFix.length) {
    console.log('  Nothing to fix.');
    return;
  }

  // Preserve original relative order (and the Mark/Andrew alternation baked
  // in at creation time) by sorting on the (wrong) date they were given —
  // they were created in increasing-date order, so this recovers sequence.
  toFix.sort((a, b) => a.currentDate.localeCompare(b.currentDate));

  const cursor = addDays(today, 1); // start tomorrow
  console.log(`  Re-dating ${toFix.length} rows starting ${cursor} (tomorrow), 1/day:\n`);

  const updates = [];
  toFix.forEach((item, idx) => {
    const newDate = addDays(cursor, idx);
    console.log(`    row ${item.rowIndex}: ${item.currentDate} → ${newDate}   id=${item.row[0]}  author=${item.row[25] || ''}  slug=${item.row[10] || ''}`);
    updates.push({ range: `ContentEngine!D${item.rowIndex}`, values: [[newDate]] });
  });

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes written. Re-run without --dry-run to apply.');
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });
  console.log(`\n✅ Re-dated ${updates.length} Bridging Finance blog rows. First one now lands ${cursor}.`);
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
