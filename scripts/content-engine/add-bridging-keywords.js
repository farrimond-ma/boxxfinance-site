/**
 * Add high-intent bridging finance keywords to Keyword_Backlog.
 * These capture users who can't get a standard mortgage and need bridging:
 * - NatWest/mainstream lender rejections
 * - Unmortgageable properties
 * - Auction purchases
 * - Speed requirements
 * - Chain break situations
 * Run: node add-bridging-keywords.js [--dry-run]
 */
require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── New high-intent keywords ─────────────────────────────────────────────────
// All Bridging Finance, Priority 1 (highest commercial intent)

const NEW_KEYWORDS = [
  // Mainstream lender rejection / unmortgageable
  'bridging loan when mortgage rejected uk',
  'bridging finance unmortgageable property',
  'finance for property mortgage lender refused',
  'bridging loan property below mortgage threshold',
  'short term finance when bank says no uk',
  'alternative to mortgage for property purchase uk',
  'bridging loan instead of mortgage uk',

  // Unmortgageable property types
  'bridging loan uninhabitable property uk',
  'finance for property without kitchen uk',
  'bridging loan derelict property uk',
  'short term loan property no running water uk',
  'bridging finance property in poor condition uk',
  'bridging loan non standard construction uk',
  'short term finance for unmortgageable property uk',

  // Auction purchases (28-day completion)
  'bridging finance auction property uk',
  'how to finance auction property uk',
  'bridging loan 28 day completion uk',
  'auction finance 28 days uk',
  'fast bridging loan for auction property',
  'property auction finance same day decision',
  'bridging loan for unconditional auction',
  'finance for property auction uk guide',

  // Speed / fast completion
  'same day bridging loan uk',
  'bridging finance 24 hours uk',
  'fastest bridging loan uk',
  'emergency property finance uk',
  'quick bridging loan for property uk',
  'bridging loan fast completion uk',
  'how quickly can i get a bridging loan uk',

  // Chain break
  'bridging loan to break property chain',
  'chain break finance uk',
  'bridging loan sell before you buy uk',
  'property chain problems bridging finance',
  'bridging finance to avoid losing property',
  'stop property chain collapsing bridging loan',

  // Bridge to mortgage strategy
  'bridge to mortgage uk',
  'bridging finance while waiting for mortgage',
  'bridging loan to buy then remortgage',
  'buy refurbish remortgage bridging finance',
  'brr strategy bridging finance uk',

  // Development exit
  'development exit bridging finance uk',
  'bridging loan when development mortgage ends',
  'exit finance for property developers uk',
  'bridging loan to sell completed development',

  // Bad credit / adverse
  'bridging loan with bad credit uk',
  'bridging finance ccj uk',
  'bridging loan poor credit history',
  'bridging loan after bankruptcy uk',
  'bridging finance defaults uk',
  'can i get a bridging loan with bad credit',

  // Property types mainstream lenders avoid
  'bridging loan hmo conversion uk',
  'bridging finance mixed use property uk',
  'bridging loan commercial to residential conversion',
  'bridging finance office to residential permitted development',
  'bridging loan listed building uk',
  'bridging finance above commercial premises',
  'bridging loan for barn conversion uk',

  // Planning gain scenarios
  'bridging loan to buy land with planning permission',
  'bridging finance planning gain uk',
  'short term loan while awaiting planning permission',
  'bridging loan to buy before planning granted',

  // Foreign nationals / expats
  'bridging loan for foreign nationals uk',
  'bridging finance for expats buying uk property',
  'uk bridging loan non resident',

  // Specific use cases
  'bridging loan to pay inheritance tax uk',
  'bridging finance divorce settlement uk',
  'bridging loan for probate property uk',
  'bridging loan to release equity quickly uk',
  'short term loan against property uk',
];

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

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n[Add High-Intent Bridging Finance Keywords]\n');
  if (isDryRun) console.log('DRY RUN\n');

  const sheets = await getSheetsClient();

  // Read existing keywords to avoid duplicates
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Keyword_Backlog!A2:C',
  });
  const existing = res.data.values || [];
  const existingKeywords = new Set(existing.map(r => (r[2] || '').toLowerCase().trim()));
  const maxId = Math.max(...existing.map(r => parseInt(r[0]) || 0));

  console.log(`Existing keywords: ${existing.length} (max ID: ${maxId})`);

  const toAdd = NEW_KEYWORDS.filter(kw => !existingKeywords.has(kw.toLowerCase().trim()));
  console.log(`New keywords to add: ${toAdd.length} (${NEW_KEYWORDS.length - toAdd.length} already present)`);

  if (isDryRun) {
    console.log('\nKeywords that would be added:');
    toAdd.forEach((kw, i) => console.log(`  ${maxId + i + 1}. ${kw}`));
    return;
  }

  if (toAdd.length === 0) {
    console.log('All keywords already present. Nothing to add.');
    return;
  }

  // Build rows: id, service, keyword, cluster, priority, status
  const rows = toAdd.map((kw, i) => [
    String(maxId + i + 1),
    'Bridging Finance',
    kw,
    'High Intent',
    '1',             // Priority 1 — highest commercial intent
    'scheduled-year1',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Keyword_Backlog!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });

  console.log(`\n✅ Added ${rows.length} high-intent keywords to Keyword_Backlog`);
  console.log('All marked Priority 1 / scheduled-year1 — will be picked up first by the populate script\n');
  console.log('Categories added:');
  console.log('  - Mainstream lender rejection / unmortgageable properties');
  console.log('  - Auction finance (28-day completion)');
  console.log('  - Speed / fast completion needs');
  console.log('  - Chain break scenarios');
  console.log('  - Bridge-to-mortgage strategy');
  console.log('  - Development exit');
  console.log('  - Adverse credit');
  console.log('  - Property types banks avoid (HMO, mixed-use, listed, conversion)');
  console.log('  - Planning gain scenarios');
  console.log('  - Specific life events (probate, divorce, IHT)');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
