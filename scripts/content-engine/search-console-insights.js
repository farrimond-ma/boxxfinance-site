/**
 * Boxx Finance — Google Search Console Insights
 *
 * Calls the Search Console API directly to pull keyword and page performance
 * data, identifies three types of opportunity, and writes them to a
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
 *   (use the client_email value from the service account JSON)
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'sc-domain:boxxfinance.co.uk'; // domain property format
const OUTPUT_TAB     = 'Search_Console';
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
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/webmasters.readonly',
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

// ─── Fetch from Search Console API ───────────────────────────────────────────

async function fetchSearchConsoleData(auth, dateRange) {
  const wm = google.webmasters({ version: 'v3', auth });

  console.log('  Querying Search Console API for keyword data...');
  let queryRows = [];
  try {
    const queryRes = await wm.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate:  dateRange.startDate,
        endDate:    dateRange.endDate,
        dimensions: ['query'],
        rowLimit:   5000,
      },
    });
    queryRows = (queryRes.data.rows || []).map(r => ({
      keys:        r.keys,
      clicks:      r.clicks      || 0,
      impressions: r.impressions || 0,
      ctr:         r.ctr         || 0,
      position:    r.position    || 0,
    }));
    console.log(`  ${queryRows.length} keyword rows fetched`);
  } catch (err) {
    if (err.code === 403) {
      console.error('\n❌ Search Console API permission denied (403).');
      console.error('   To fix: add the service account email to Search Console as a user.');
      console.error('   Search Console → Settings → Users and permissions → Add user');
      console.error('   Service account email is in the client_email field of GOOGLE_CREDENTIALS.\n');
      throw err;
    }
    throw err;
  }

  console.log('  Querying Search Console API for page data...');
  let pageRows = [];
  try {
    const pageRes = await wm.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate:  dateRange.startDate,
        endDate:    dateRange.endDate,
        dimensions: ['page'],
        rowLimit:   1000,
      },
    });
    pageRows = (pageRes.data.rows || []).map(r => ({
      keys:        r.keys,
      clicks:      r.clicks      || 0,
      impressions: r.impressions || 0,
      ctr:         r.ctr         || 0,
      position:    r.position    || 0,
    }));
    console.log(`  ${pageRows.length} page rows fetched`);
  } catch (err) {
    console.warn(`  Warning: could not fetch page data: ${err.message}`);
    pageRows = [];
  }

  return { queryRows, pageRows };
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

async function writeToSheet(sheets, allOpportunities, topPages, dateRange) {
  const runDate = new Date().toISOString().split('T')[0];

  // Ensure tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabExists = meta.data.sheets?.some(s => s.properties?.title === OUTPUT_TAB);
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: OUTPUT_TAB } } }] },
    });
    console.log(`  Created tab: ${OUTPUT_TAB}`);
  }

  // Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${OUTPUT_TAB}!A:H`,
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
    range: `${OUTPUT_TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  console.log(`  Written ${allOpportunities.length} opportunities + ${topPages.length} top pages to ${OUTPUT_TAB} tab`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Search Console Insights    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN — no API calls\n');

  const auth = await getAuth();
  const dateRange = getDateRange();
  console.log(`Date range: ${dateRange.startDate} to ${dateRange.endDate}\n`);

  if (isDryRun) {
    console.log('Dry run — skipping API calls.');
    return;
  }

  // Fetch from Search Console API
  console.log('Fetching data from Search Console API...');
  const { queryRows, pageRows } = await fetchSearchConsoleData(auth, dateRange);

  if (queryRows.length === 0) {
    console.log('  No keyword data returned from Search Console.');
    console.log('  This usually means the site has no impressions yet, or the service account');
    console.log('  has not been added to Search Console as a user.');
    return;
  }

  // Analyse
  console.log('\nAnalysing opportunities...');
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

  // Create sheets client and write
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('\nWriting to Google Sheet...');
  await writeToSheet(sheets, allOpportunities, topPages, dateRange);

  console.log('\n✅ Done. View results at:');
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
