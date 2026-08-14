// Pushes Backlink_Prospects rows from the ContentEngine sheet into the Boxx
// applications CRM (a separate project — see docs/backlink-crm-sync.md for
// the receiving-endpoint spec handed to that project).
//
// Design: this is a one-way, insert-only feed. Every run sends the FULL
// current set of prospect rows to the CRM, keyed by article_url. The CRM is
// expected to insert a row only if that article_url doesn't already exist,
// and never touch a row that's already there — status, date_sent and notes
// become CRM-owned editable fields the moment a row lands, and re-running
// this sync must never clobber edits made in the CRM. That's why there's no
// "already synced" tracking on the sheet side: idempotency is the CRM's
// job (dedup by article_url), which is simpler and safer than trying to
// keep two systems' state in sync from here.
//
// Usage:
//   node sync-backlinks-to-crm.js            — sync and report
//   node sync-backlinks-to-crm.js --dry-run  — report what would be sent, no requests

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const BACKLINK_TAB = 'Backlink_Prospects';
const CRM_URL = process.env.CRM_BACKLINKS_URL;
const CRM_KEY = process.env.CRM_BACKLINKS_KEY;
const isDryRun = process.argv.includes('--dry-run');

// Backlink_Prospects columns: Date Found(A) Publication(B) DA(C)
// Article Title(D) Article URL(E) Keywords Matched(F) Suggested Author(G)
// Expert Comment Draft(H) Outreach Email Draft(I) Editor Contact(J)
// Status(K) Date Sent(L) Notes(M)
const COLS = {
  dateFound: 0, publication: 1, da: 2, articleTitle: 3, articleUrl: 4,
  keywordsMatched: 5, suggestedAuthor: 6, expertComment: 7, outreachEmail: 8,
  editorContact: 9,
};

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
  console.log('║   Sync backlink prospects to CRM                 ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!isDryRun && (!CRM_URL || !CRM_KEY)) {
    throw new Error('CRM_BACKLINKS_URL and CRM_BACKLINKS_KEY must be set (not needed for --dry-run)');
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BACKLINK_TAB}!A2:M`,
  });
  const rows = (res.data.values || []).filter(r => r.length > 3 && r[COLS.articleUrl]);
  console.log(`${rows.length} backlink prospect(s) in the sheet.\n`);

  if (rows.length === 0) {
    console.log('Nothing to sync.');
    return;
  }

  if (isDryRun) {
    console.log('Dry run — first 5 rows that would be sent:');
    rows.slice(0, 5).forEach(r => console.log(`  ${r[COLS.publication]} — ${r[COLS.articleTitle]}`));
    console.log(`\n...and ${Math.max(0, rows.length - 5)} more. No requests made.`);
    return;
  }

  let sent = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const params = new URLSearchParams();
    params.append('intake_key', CRM_KEY);
    params.append('article_url', row[COLS.articleUrl] || '');
    params.append('date_found', row[COLS.dateFound] || '');
    params.append('publication', row[COLS.publication] || '');
    params.append('domain_authority', row[COLS.da] || '');
    params.append('article_title', row[COLS.articleTitle] || '');
    params.append('keywords_matched', row[COLS.keywordsMatched] || '');
    params.append('suggested_author', row[COLS.suggestedAuthor] || '');
    params.append('expert_comment_draft', row[COLS.expertComment] || '');
    params.append('outreach_email_draft', row[COLS.outreachEmail] || '');
    params.append('editor_contact', row[COLS.editorContact] || '');

    try {
      const res = await fetch(CRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      sent++;
      if (data.inserted) inserted++;
      else if (data.skipped || data.ok) skipped++;
      else { failed++; console.warn(`  ⚠ ${row[COLS.articleUrl]}: ${data.error || `HTTP ${res.status}`}`); }
    } catch (err) {
      failed++;
      console.warn(`  ⚠ ${row[COLS.articleUrl]}: ${err.message}`);
    }
  }

  console.log(`\nSent: ${sent}  New: ${inserted}  Already in CRM: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
