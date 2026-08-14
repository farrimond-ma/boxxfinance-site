// One-off repair for bugs that only affect ALREADY-QUEUED / DRAFTED content —
// code fixes elsewhere only stop NEW rows being written wrong, they never
// touch rows already sitting in the sheet from before the fix landed:
//
//   1. author === 'Andrew Farrimond' (ContentEngine) — Andrew was removed
//      from the site (see the blogPosts.json / linkedinNews.json fix
//      earlier), but rows queued before that fix still carry the old author
//      and publish it as-is (author photo/bio then falls back to Mark
//      Higgins while the NAME stays "Andrew Farrimond" — a mismatched byline
//      on the live page).
//   2. "Boxx Commercial Finance" anywhere in a row's text columns, in BOTH
//      the ContentEngine tab (metaTitle, metaDescription, contentBrief — the
//      latter fed directly into the AI generation prompt, so an unfixed
//      brief keeps echoing the old name into future articles) and the
//      Backlink_Prospects tab (Expert Comment Draft / Outreach Email Draft —
//      text meant to be sent to journalists/editors as-is).
//
// Scans ContentEngine (blog + location, status='scheduled') and
// Backlink_Prospects (status='new', i.e. not yet sent) across every relevant
// text column, and writes back only the specific cells that actually
// changed — not whole rows — to avoid clobbering anything else in a row
// that other workflows may be concurrently touching.
//
// Usage:
//   node fix-queued-content.js            — scan, report, and fix in the sheet
//   node fix-queued-content.js --dry-run  — scan and report only, no writes

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB = 'ContentEngine';
const BACKLINK_TAB = 'Backlink_Prospects';
const isDryRun = process.argv.includes('--dry-run');

// Column letters, matching the schema documented in publish-blog.js
// getScheduledRow() and seed-trigger-content.js — A2:AD, 0-indexed here.
const COLS = {
  type: 1, status: 2, title: 9, metaTitle: 12, metaDescription: 13,
  contentBrief: 15, author: 25,
};
const COL_LETTERS = {
  title: 'J', metaTitle: 'M', metaDescription: 'N', contentBrief: 'P', author: 'Z',
};

// Backlink_Prospects columns: Date Found(A) Publication(B) DA(C)
// Article Title(D) Article URL(E) Keywords Matched(F) Suggested Author(G)
// Expert Comment Draft(H) Outreach Email Draft(I) Editor Contact(J)
// Status(K) Date Sent(L) Notes(M)
const BL_COLS = { status: 10, expertComment: 7, outreachEmail: 8 };
const BL_COL_LETTERS = { expertComment: 'H', outreachEmail: 'I' };

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function scanBacklinkProspects(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BACKLINK_TAB}!A2:M`,
  });
  const rows = res.data.values || [];
  console.log(`Scanning ${rows.length} Backlink_Prospects rows...\n`);

  const updates = [];
  let rowsTouched = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = (row[BL_COLS.status] || '').toLowerCase().trim();
    if (status !== 'new') continue; // only un-sent drafts are safe to rewrite

    const rowIndex = i + 2;
    let touched = false;

    for (const field of ['expertComment', 'outreachEmail']) {
      const val = row[BL_COLS[field]] || '';
      if (val.includes('Boxx Commercial Finance')) {
        const fixed = val.split('Boxx Commercial Finance').join('Boxx Finance');
        updates.push({ range: `${BACKLINK_TAB}!${BL_COL_LETTERS[field]}${rowIndex}`, values: [[fixed]] });
        touched = true;
      }
    }
    if (touched) rowsTouched++;
  }

  return { updates, rowsTouched };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Fix queued author + brand-name bugs            ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A2:AD`,
  });
  const rows = res.data.values || [];
  console.log(`Scanning ${rows.length} ContentEngine rows...\n`);

  const updates = []; // { range, value }
  let authorFixCount = 0;
  let brandFixCount = 0;
  let rowsTouched = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = (row[COLS.status] || '').toLowerCase().trim();
    if (status !== 'scheduled') continue; // only unpublished rows are safe to rewrite

    const rowIndex = i + 2; // sheet row number (A2 = row 2)
    let touched = false;

    // Bug 1: stale author, blog rows only
    if ((row[COLS.type] || '').toLowerCase().trim() === 'blog' && (row[COLS.author] || '').trim() === 'Andrew Farrimond') {
      updates.push({ range: `${CE_TAB}!${COL_LETTERS.author}${rowIndex}`, values: [['Tara Jameson']] });
      authorFixCount++;
      touched = true;
    }

    // Bug 2: old brand name, any text column
    for (const field of ['title', 'metaTitle', 'metaDescription', 'contentBrief']) {
      const val = row[COLS[field]] || '';
      if (val.includes('Boxx Commercial Finance')) {
        const fixed = val.split('Boxx Commercial Finance').join('Boxx Finance');
        updates.push({ range: `${CE_TAB}!${COL_LETTERS[field]}${rowIndex}`, values: [[fixed]] });
        brandFixCount++;
        touched = true;
      }
    }

    if (touched) rowsTouched++;
  }

  const backlinkResult = await scanBacklinkProspects(sheets);
  updates.push(...backlinkResult.updates);
  rowsTouched += backlinkResult.rowsTouched;

  console.log(`Rows touched: ${rowsTouched}`);
  console.log(`  Author fixes (Andrew Farrimond -> Tara Jameson): ${authorFixCount}`);
  console.log(`  Brand-name fixes (Boxx Commercial Finance -> Boxx Finance), ContentEngine: ${brandFixCount}`);
  console.log(`  Brand-name fixes, Backlink_Prospects: ${backlinkResult.updates.length}`);
  console.log(`  Total cell writes: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  if (isDryRun) {
    console.log('Dry run — sample of first 10 writes:');
    updates.slice(0, 10).forEach(u => console.log(`  ${u.range}: "${String(u.values[0][0]).slice(0, 80)}"`));
    console.log('\nDry run — no changes written.');
    return;
  }

  // Sheets batchUpdate has no hard limit on entry count for reasonable sizes,
  // but chunk defensively to keep individual requests well under API limits.
  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: chunk },
    });
    console.log(`  Wrote batch ${Math.floor(i / BATCH) + 1} (${chunk.length} cells)`);
  }

  console.log(`\n✅ Fixed ${rowsTouched} row(s), ${updates.length} cell(s) in the sheet.`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
