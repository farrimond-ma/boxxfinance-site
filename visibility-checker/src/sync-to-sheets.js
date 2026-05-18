/**
 * Boxx Finance — ContentEngine Sheet Sync
 * Regenerates the full 12-month schedule and writes it to Google Sheets
 * 
 * Run: node sync-to-sheets.js
 * Or via GitHub Actions: triggered after visibility check or on demand
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg';
const SHEET_TAB = 'ContentEngine';

// ── Pillars ───────────────────────────────────────────────────────────────────

const PILLARS = [
  { name: 'Bridging Finance',      slug: 'bridging-finance',      url: '/funding-solutions/bridging-finance',      priority: 1 },
  { name: 'Business Loans',        slug: 'business-loans',        url: '/funding-solutions/business-loans',        priority: 2 },
  { name: 'Development Finance',   slug: 'development-finance',   url: '/funding-solutions/development-finance',   priority: 3 },
  { name: 'Invoice Finance',       slug: 'invoice-finance',       url: '/funding-solutions/invoice-finance',       priority: 4 },
  { name: 'Asset Finance',         slug: 'asset-finance',         url: '/funding-solutions/asset-finance',         priority: 5 },
  { name: 'Commercial Mortgages',  slug: 'commercial-mortgages',  url: '/funding-solutions/commercial-mortgages',  priority: 6 },
  { name: 'Working Capital',       slug: 'working-capital',       url: '/funding-solutions/working-capital',       priority: 7 },
  { name: 'Trade Finance',         slug: 'trade-finance',         url: '/funding-solutions/trade-finance',         priority: 8 },
  { name: 'Asset Refinance',       slug: 'asset-refinance',       url: '/funding-solutions/asset-refinance',       priority: 9 },
  { name: 'Merchant Cash Advance', slug: 'merchant-cash-advance', url: '/funding-solutions/merchant-cash-advance', priority: 10 },
  { name: 'Structured Finance',    slug: 'structured-finance',    url: '/funding-solutions/structured-finance',    priority: 11 },
  { name: 'Tax & VAT Funding',     slug: 'tax-vat-funding',       url: '/funding-solutions/tax-vat-funding',       priority: 12 },
];

const TOP_50_CITIES = [
  'London','Birmingham','Manchester','Leeds','Liverpool','Sheffield','Bristol','Glasgow',
  'Edinburgh','Leicester','Coventry','Bradford','Nottingham','Cardiff','Newcastle',
  'Belfast','Sunderland','Brighton','Derby','Plymouth','Stoke-on-Trent','Wolverhampton',
  'Southampton','Portsmouth','Norwich','Reading','Swansea','Milton Keynes','Luton',
  'Aberdeen','Cambridge','Oxford','Exeter','York','Peterborough','Ipswich','Middlesbrough',
  'Stockport','Huddersfield','Bolton','Blackpool','Preston','Bournemouth','Cheltenham',
  'Northampton','Wakefield','Blackburn','Hull','Swindon','Gloucester',
];

const BLOG_KEYWORDS = {
  'Bridging Finance':      ['what is bridging finance','bridging loan rates uk','best bridging loan lenders uk','how to get a bridging loan','bridging finance for property developers','fast bridging loans uk','bridging loan vs mortgage','open vs closed bridging loans','bridging finance explained','bridging loan calculator uk'],
  'Business Loans':        ['business loans for small businesses','business loans for startups','business loans for bad credit','unsecured business loans uk','business loan rates uk','how to get a business loan','business loan eligibility','business loans same day','business loans vs overdraft','best business loan lenders uk'],
  'Development Finance':   ['property development finance uk','development finance lenders uk','ground up development finance','development finance rates','how does development finance work','development finance for small developers','mezzanine finance property','development exit finance','development finance drawdown','best development finance lenders'],
  'Invoice Finance':       ['what is invoice finance','invoice finance for small businesses','invoice factoring vs discounting','invoice finance rates uk','best invoice finance providers','invoice finance eligibility','how invoice finance works','invoice finance for startups','selective invoice finance','invoice finance vs business loan'],
  'Asset Finance':         ['what is asset finance','asset finance for small businesses','hire purchase vs finance lease','asset finance rates uk','best asset finance lenders','how to finance equipment','asset finance for vehicles','asset finance explained','asset finance eligibility','asset finance vs bank loan'],
  'Commercial Mortgages':  ['commercial mortgage rates uk','best commercial mortgage lenders','how to get a commercial mortgage','commercial mortgage eligibility','semi-commercial mortgage uk','commercial property finance','commercial mortgage vs buy to let','commercial mortgage explained','commercial mortgage calculator','commercial mortgage for limited company'],
  'Working Capital':       ['what is working capital finance','working capital loans uk','how to improve working capital','working capital for seasonal businesses','working capital finance options','revolving credit facility uk','working capital vs cash flow','best working capital lenders','working capital explained','working capital for growth'],
  'Trade Finance':         ['what is trade finance','trade finance for importers','letters of credit uk','trade finance for small businesses','how does trade finance work','trade finance vs invoice finance','best trade finance lenders uk','trade finance rates','trade finance eligibility','supply chain finance uk'],
  'Asset Refinance':       ['what is asset refinance','asset refinance to release cash','sale and leaseback uk','asset refinance rates','how does asset refinance work','asset refinance for businesses','asset refinance eligibility','best asset refinance lenders','asset refinance vs remortgage','asset refinance explained'],
  'Merchant Cash Advance': ['what is a merchant cash advance','merchant cash advance for restaurants','merchant cash advance rates uk','how does merchant cash advance work','merchant cash advance eligibility','merchant cash advance vs business loan','best merchant cash advance providers','merchant cash advance for retail','fast merchant cash advance uk','merchant cash advance explained'],
  'Structured Finance':    ['what is structured finance','structured finance for property','mezzanine finance uk','structured finance solutions','how structured finance works','structured finance lenders uk','structured finance vs traditional lending','structured finance for developers','structured finance rates','structured finance explained'],
  'Tax & VAT Funding':     ['vat funding uk','tax loan for businesses','how to fund a vat bill','vat finance explained','tax payment plan for businesses','vat bridging loan','best vat funding providers','tax and vat funding rates','hmrc time to pay alternative','vat funding for small businesses'],
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekday(d) {
  return d.getDay() !== 0 && d.getDay() !== 6;
}

function getWeekdays(start, end) {
  const days = [];
  let d = new Date(start);
  while (d <= end) {
    if (isWeekday(d)) days.push(new Date(d));
    d = addDays(d, 1);
  }
  return days;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

// ── Schedule builder ──────────────────────────────────────────────────────────

function buildSchedule() {
  const start = new Date('2026-05-19');
  const end   = new Date('2027-05-19');
  const weekdays = getWeekdays(start, end);

  const phase1 = weekdays.slice(0, 10);   // 2 weeks: 2 locations/day
  const phase2 = weekdays.slice(10);      // rest:    5 locations/day

  const rows = [];
  let id = 8;
  let pillarIdx = 0;
  let cityIdx = 0;
  const kwIdx = Object.fromEntries(PILLARS.map(p => [p.name, 0]));

  function nextPillar() {
    return PILLARS[pillarIdx++ % PILLARS.length];
  }

  function nextKeyword(pillarName) {
    const kws = BLOG_KEYWORDS[pillarName];
    return kws[kwIdx[pillarName]++ % kws.length];
  }

  function blogRow(d, pillar, keyword) {
    const title = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const slug  = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[&']/g, '');
    return [
      id++, 'blog', 'scheduled', fmt(d), 'AM',
      pillar.name, '',
      keyword, title, title,
      slug,
      `https://boxxfinance.co.uk/insights/${slug}`,
      `${title} | Boxx Commercial Finance`,
      `Expert guide on ${keyword} for UK businesses. Fast, flexible funding from Boxx Commercial Finance.`,
      pillar.name,
      `Comprehensive guide targeting '${keyword}'. Cover what it is, how it works, eligibility, rates, and why Boxx. Include FAQ. Target 1500+ words.`,
      pillar.url, '', '', '',
      '', '', '',
      'yes', 'yes',
      'Mark Higgins', 'pending', '',
      `Priority ${pillar.priority} pillar`,
    ];
  }

  function locationRow(d, pillar, city, slot) {
    const title = `${pillar.name} ${city}`;
    const slug  = `${pillar.slug}-${city.toLowerCase().replace(/\s+/g, '-')}`;
    return [
      id++, 'location', 'scheduled', fmt(d), slot,
      pillar.name, city,
      '', '', title,
      slug,
      `https://boxxfinance.co.uk/locations/${slug}`,
      `${title} | Boxx Commercial Finance`,
      `${pillar.name} in ${city} for UK businesses. Fast, flexible funding from Boxx Commercial Finance.`,
      pillar.name,
      `Location page for ${pillar.name} in ${city}. Cover local market context, typical use cases, eligibility, and Boxx advantages. 600-800 words.`,
      pillar.url, '', '', '',
      '', '', '',
      'no', 'no',
      'Mark Higgins', 'pending', '',
      '',
    ];
  }

  // Phase 1 — 2 locations/day
  for (const d of phase1) {
    const pillar = nextPillar();
    const kw = nextKeyword(pillar.name);
    rows.push(blogRow(d, pillar, kw));
    rows.push(locationRow(d, pillar, TOP_50_CITIES[cityIdx++ % 50], 'PM'));
    rows.push(locationRow(d, pillar, TOP_50_CITIES[cityIdx++ % 50], 'PM2'));
  }

  // Phase 2 — 5 locations/day
  for (const d of phase2) {
    const pillar = nextPillar();
    const kw = nextKeyword(pillar.name);
    rows.push(blogRow(d, pillar, kw));
    for (const slot of ['PM','PM2','PM3','PM4','PM5']) {
      rows.push(locationRow(d, pillar, TOP_50_CITIES[cityIdx++ % 50], slot));
    }
  }

  return rows;
}

// ── Sheets writer ─────────────────────────────────────────────────────────────

async function getSheets() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(sheets, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(s => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    console.log(`  Created tab: ${tabName}`);
  }
  return meta.data.sheets?.find(s => s.properties?.title === tabName)?.properties?.sheetId;
}

async function writeToSheet(sheets, sheetId, tabName, header, rows) {
  // Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:AH`,
  });

  // Write header + data in batches of 500 to avoid payload limits
  const allRows = [header, ...rows];
  const BATCH = 500;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A${i + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: batch },
    });
    process.stdout.write(`\r  Written ${Math.min(i + BATCH, allRows.length).toLocaleString()} / ${allRows.length.toLocaleString()} rows...`);
  }
  console.log('');

  // Format header row — bold + freeze
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.13, green: 0.18, blue: 0.35 },
                foregroundColor: { red: 1, green: 1, blue: 1 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor,foregroundColor)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 29 },
          },
        },
      ],
    },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx — ContentEngine Sheet Sync        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('Building schedule...');
  const rows = buildSchedule();
  const blogs = rows.filter(r => r[1] === 'blog').length;
  const locs  = rows.filter(r => r[1] === 'location').length;
  console.log(`  ${rows.length.toLocaleString()} rows — ${blogs} blogs + ${locs} location pages`);
  console.log(`  Phase 1 (2 locations/day): 19 May – 1 Jun 2026`);
  console.log(`  Phase 2 (5 locations/day): 2 Jun 2026 – 19 May 2027\n`);

  console.log('Connecting to Google Sheets...');
  const sheets = await getSheets();

  console.log(`Ensuring tab "${SHEET_TAB}" exists...`);
  const sheetId = await ensureTab(sheets, SHEET_TAB);

  const header = [
    'id','type','status','publishDate','publishSlot',
    'service','city','keyword','topic','title',
    'slug','url','metaTitle','metaDescription','category',
    'contentBrief','internalLinkService',
    'internalLinkCity1','internalLinkCity2','internalLinkCity3',
    'relatedBlog1','relatedBlog2','relatedBlog3',
    'faqRequired','linkedInRequired','author',
    'jsonStatus','publishedAt','notes',
  ];

  console.log('Writing to sheet...');
  await writeToSheet(sheets, sheetId, SHEET_TAB, header, rows);

  console.log(`\n✅ Done. Sheet updated:`);
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
