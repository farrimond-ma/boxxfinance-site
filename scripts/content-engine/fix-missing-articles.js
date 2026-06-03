// One-off script to add three urgent blog rows that fix broken LinkedIn links.
// These slugs were posted on LinkedIn on Jun 1-3 but the blog posts were never
// published. Running this schedules them for today so the blog publisher
// picks them up on the next run.
require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

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
  const sheets = await getSheetsClient();
  const today  = new Date().toISOString().split('T')[0];

  // Check if these slugs are already in ContentEngine
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!K2:K',
  });
  const existingSlugs = new Set((res.data.values || []).map(r => r[0]).filter(Boolean));

  const missing = [
    {
      id: '2162', service: 'Business Loans', author: 'Andrew Farrimond',
      keyword: 'business loans for startups uk',
      title: 'Business Loans for Startups: Options When You Have No Trading History',
      slug: 'business-loans-for-startups',
      serviceUrl: '/funding-solutions/business-loans',
      brief: 'Cover challenges startups face (no accounts, no track record), lender categories for pre-revenue businesses, Start Up Loans scheme, asset-backed options; scenario: food business 8 months old needing £30k.',
      note: 'Urgent — fixes broken LinkedIn link from 2026-06-01',
    },
    {
      id: '2163', service: 'Development Finance', author: 'Mark Higgins',
      keyword: 'development finance lenders uk',
      title: 'Development Finance Lenders in the UK: Who Are They?',
      slug: 'development-finance-lenders-uk',
      serviceUrl: '/funding-solutions/development-finance',
      brief: 'Cover main lender types: challenger banks, specialist dev finance lenders, family offices, P2P. Appetite by scheme size and risk. Track record requirements. How a broker accesses the whole market.',
      note: 'Urgent — fixes broken LinkedIn link from 2026-06-02',
    },
    {
      id: '2164', service: 'Invoice Finance', author: 'Andrew Farrimond',
      keyword: 'invoice finance for small businesses',
      title: 'Invoice Finance for Small Businesses: Is It Right for You?',
      slug: 'invoice-finance-for-small-businesses',
      serviceUrl: '/funding-solutions/invoice-finance',
      brief: 'Six signs invoice finance suits a small business (B2B, 30+ day terms, growing faster than cash allows). Minimum turnover, spot vs whole-ledger, cost. Honest about when it is not suitable.',
      note: 'Urgent — fixes broken LinkedIn link from 2026-06-03',
    },
  ].filter(p => !existingSlugs.has(p.slug));

  if (missing.length === 0) {
    console.log('All three slugs already exist in ContentEngine. Nothing to do.');
    return;
  }

  const rows = missing.map(p => [
    p.id, 'blog', 'scheduled', today, 'AM',
    p.service, '', p.keyword, '', p.title,
    p.slug,
    `https://boxxfinance.co.uk/insights/${p.slug}`,
    `${p.title} | Boxx Commercial Finance`, '',
    p.service, p.brief, p.serviceUrl,
    '', '', '', '', '', '',
    'yes', 'yes', p.author, '', '', p.note,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A:AC',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });

  console.log(`✅ Added ${rows.length} urgent blog rows to ContentEngine (publishDate: ${today})`);
  rows.forEach(r => console.log(`   ${r[10]}`));
  console.log('\nThese will be published by the next blog publisher run.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
