/**
 * Boxx Finance — Google Search Console Insights
 *
 * Pulls keyword and page performance data from Google Search Console,
 * identifies three types of opportunity, and writes them to a
 * 'Search_Console' tab in the Google Sheet.
 *
 * Opportunity types:
 *   1. Page 2 keywords (positions 11–30) — close to page 1, improve content
 *   2. High impression / low CTR — Google serves us but users don't click
 *   3. Content gaps — queries with impressions but no matching published page
 *
 * Run: node search-console-insights.js [--dry-run]
 *
 * SETUP: The service account email in GOOGLE_CREDENTIALS must be added
 * as a user in Google Search Console:
 *   Search Console → Settings → Users and permissions → Add user
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'https://boxxfinance.co.uk/'; // must match SC property exactly
const SHEET_TAB      = 'Search_Console';
const LOOKBACK_DAYS  = 28;

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  let credentials;
  try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
  catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange() {
  const end   = new Date(); end.setDate(end.getDate() - 3); // SC lags ~3 days
  const start = new Date(end); start.setDate(start.getDate() - LOOKBACK_DAYS);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate:   end.toISOString().split('T')[0],
  };
}

// ─── Search Console query ─────────────────────────────────────────────────────

async function querySearchConsole(auth, dimensions, rowLimit = 1000) {
  const sc = google.searchconsole({ version: 'v1', auth });
  const { startDate, endDate } = getDateRange();

  const res = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      dataState: 'final',
    },
  });

  return res.data.rows || [];
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function findPage2Keywords(rows) {
  // Queries ranking positions 11–30 with meaningful impressions
  return rows
    .filter(r => r.position >= 11 && r.position <= 30 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map(r => ({
      query:       r.keys[0],
      position:    Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks:      r.clicks,
      ctr:         (r.ctr * 100).toFixed(1) + '%',
      opportunity: 'Page 2 — improve content to reach page 1',
    }));
}

function findLowCTR(rows) {
  // Queries with good impressions but below-average CTR (< 2%)
  return rows
    .filter(r => r.impressions >= 50 && r.ctr < 0.02 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map(r => ({
      query:       r.keys[0],
      position:    Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks:      r.clicks,
      ctr:         (r.ctr * 100).toFixed(1) + '%',
      opportunity: 'Low CTR — improve title and meta description',
    }));
}

function findContentGaps(queryRows, pageRows) {
  // Queries with impressions where the matched page is the homepage or doesn't
  // have a dedicated article (suggesting a content gap)
  const insightPages = new Set(
    pageRows
      .filter(r => r.keys[0].includes('/insights/') || r.keys[0].includes('/locations/'))
      .map(r => r.keys[0])
  );

  return queryRows
    .filter(r => r.impressions >= 20 && r.position >= 5)
    .filter(r => {
      // No dedicated page ranking for this query
      const query = r.keys[0].toLowerCase();
      return ![...insightPages].some(p => p.toLowerCase().includes(query.split(' ')[0]));
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30)
    .map(r => ({
      query:       r.keys[0],
      position:    Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks:      r.clicks,
      ctr:         (r.ctr * 100).toFixed(1) + '%',
      opportunity: 'Content gap — no dedicated article for this query',
    }));
}

function findTopPages(rows) {
  return rows
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)
    .map(r => ({
      page:        r.keys[0].replace('https://boxxfinance.co.uk', ''),
      clicks:      r.clicks,
      impressions: r.impressions,
      ctr:         (r.ctr * 100).toFixed(1) + '%',
      position:    Math.round(r.position * 10) / 10,
    }));
}

// ─── Write to Google Sheet ────────────────────────────────────────────────────

async function writeToSheet(auth, allOpportunities, topPages, dateRange) {
  const sheets = google.sheets({ version: 'v4', auth });
  const runDate = new Date().toISOString().split('T')[0];

  // Ensure tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === SHEET_TAB);
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
    });
    console.log(`  Created tab: ${SHEET_TAB}`);
  }

  // Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A:H`,
  });

  const rows = [
    [`Search Console Insights — ${runDate} (data: ${dateRange.startDate} to ${dateRange.endDate})`],
    [],
    ['QUERY / PAGE', 'TYPE', 'POSITION', 'IMPRESSIONS', 'CLICKS', 'CTR', 'OPPORTUNITY', ''],
    ...allOpportunities.map(r => [
      r.query || r.page,
      r.opportunity.split(' — ')[0],
      r.position,
      r.impressions,
      r.clicks,
      r.ctr,
      r.opportunity.split(' — ')[1] || '',
      '',
    ]),
    [],
    ['TOP PERFORMING PAGES (last 28 days)'],
    ['PAGE', 'CLICKS', 'IMPRESSIONS', 'CTR', 'AVG POSITION', '', '', ''],
    ...topPages.map(p => [p.page, p.clicks, p.impressions, p.ctr, p.position, '', '', '']),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  console.log(`  Written ${allOpportunities.length} opportunities + ${topPages.length} top pages to ${SHEET_TAB} tab`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Search Console Insights    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN — no API calls\n');

  const auth = await getAuth();
  const { startDate, endDate } = getDateRange();
  console.log(`Date range: ${startDate} to ${endDate}\n`);

  if (isDryRun) {
    console.log('Dry run — skipping API calls.');
    return;
  }

  // Query by keyword and by page
  console.log('Fetching keyword data from Search Console...');
  let queryRows, pageRows;
  try {
    queryRows = await querySearchConsole(auth, ['query']);
    pageRows  = await querySearchConsole(auth, ['page']);
    console.log(`  ${queryRows.length} keywords, ${pageRows.length} pages returned`);
  } catch (err) {
    if (err.message.includes('403') || err.message.includes('permission')) {
      console.error('\n❌ Permission denied. Add the service account email to Search Console:');
      console.error('   Search Console → Settings → Users and permissions → Add user');
      console.error('   Service account email is in your GOOGLE_CREDENTIALS JSON (client_email field)');
      process.exit(1);
    }
    throw err;
  }

  // Analyse
  console.log('Analysing opportunities...');
  const page2     = findPage2Keywords(queryRows);
  const lowCtr    = findLowCTR(queryRows);
  const gaps      = findContentGaps(queryRows, pageRows);
  const topPages  = findTopPages(pageRows);

  const allOpportunities = [
    ...page2,
    ...lowCtr.filter(r => !page2.find(p => p.query === r.query)),
    ...gaps.filter(r => !page2.find(p => p.query === r.query) && !lowCtr.find(p => p.query === r.query)),
  ];

  console.log(`  Page 2 keywords:     ${page2.length}`);
  console.log(`  Low CTR keywords:    ${lowCtr.length}`);
  console.log(`  Content gaps:        ${gaps.length}`);
  console.log(`  Total opportunities: ${allOpportunities.length}`);
  console.log(`  Top pages:           ${topPages.length}`);

  console.log('\nWriting to Google Sheet...');
  await writeToSheet(auth, allOpportunities, topPages, { startDate, endDate });

  console.log('\n✅ Done. View results at:');
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}#gid=Search_Console\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
