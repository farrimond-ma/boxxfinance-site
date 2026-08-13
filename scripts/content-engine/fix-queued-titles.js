// One-off repair for the title-casing bug fixed in search-console-actions.js
// (commit 3b8d35a): two row-builders wrote the title as the raw keyword/query
// with only the first letter capitalized, e.g. "Bridging loan property below
// mortgage threshold". That fix only stops NEW rows — any row already sitting
// in the ContentEngine queue with status "scheduled" still has the bad title
// baked in and will publish it as-is. This scans those rows and rewrites the
// title (and metaTitle) with proper word-by-word Title Case wherever the
// title is just the keyword re-cased — the precise signature of the bug, so
// this won't touch any row with a genuinely hand-shaped headline.
//
// Usage:
//   node fix-queued-titles.js            — scan, report, and fix in the sheet
//   node fix-queued-titles.js --dry-run  — scan and report only, no writes

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB = 'ContentEngine';
const isDryRun = process.argv.includes('--dry-run');

const STOPWORDS = ['a','an','the','and','but','or','for','nor','on','at','to',
  'by','in','of','up','as','is','vs'];

function toTitle(text) {
  return text
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 || !STOPWORDS.includes(w.toLowerCase()))
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.toLowerCase())
    .join(' ');
}

// Bug signature: the title is exactly the keyword, just re-cased at the
// first letter — i.e. it was never actually written as a headline.
function looksLikeBug(title, keyword) {
  if (!title || !keyword) return false;
  return title.trim().toLowerCase() === keyword.trim().toLowerCase();
}

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

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Fix queued titles with the raw-keyword bug     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A2:AC`,
  });
  const rows = res.data.values || [];
  console.log(`Scanning ${rows.length} ContentEngine rows...\n`);

  const fixes = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = (row[2] || '').toLowerCase();
    const keyword = row[7] || '';
    const title = row[9] || '';
    if (status !== 'scheduled') continue; // only unpublished rows are safe to rewrite
    if (!looksLikeBug(title, keyword)) continue;

    const newTitle = toTitle(keyword);
    if (newTitle === title) continue; // already fine (e.g. single word)

    const rowIndex = i + 2; // sheet row number (A2 = row 2)
    const newMetaTitle = `${newTitle} | Boxx Finance`;
    fixes.push({ rowIndex, oldTitle: title, newTitle, newMetaTitle });
  }

  if (fixes.length === 0) {
    console.log('No affected queued rows found — nothing to fix.');
    return;
  }

  console.log(`Found ${fixes.length} affected row(s):\n`);
  fixes.forEach(f => console.log(`  Row ${f.rowIndex}: "${f.oldTitle}" → "${f.newTitle}"`));

  if (isDryRun) {
    console.log('\nDry run — no changes written.');
    return;
  }

  const data = [];
  for (const f of fixes) {
    data.push({ range: `${CE_TAB}!J${f.rowIndex}`, values: [[f.newTitle]] });
    data.push({ range: `${CE_TAB}!M${f.rowIndex}`, values: [[f.newMetaTitle]] });
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });

  console.log(`\n✅ Fixed ${fixes.length} row(s) in the sheet.`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
