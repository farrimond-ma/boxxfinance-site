/**
 * seed-content-engine.js
 *
 * Seeds the ContentEngine Google Sheet with 90 days of Bridging Finance content:
 *   - 2 blog rows per day  (AM = Mark Higgins, PM = Andrew Farrimond)
 *   - 5 location rows per day (UK cities, cycling through the full list)
 *
 * Reads existing rows first — never duplicates a (date, slot) or (date, city) combination.
 * Appends only what is missing.
 *
 * Run: node seed-content-engine.js [--dry-run]
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE        = 'Bridging Finance';
const SERVICE_SLUG   = 'bridging-finance';
const SERVICE_URL    = '/funding-solutions/bridging-finance';
const DAYS_AHEAD     = 90;

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
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

// ─── Date helpers ─────────────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}
function today() { return new Date().toISOString().split('T')[0]; }

// ─── Blog topics ─────────────────────────────────────────────────────────────
// AM = Mark Higgins (property/transaction focused)
// PM = Andrew Farrimond (finance/rates/strategy focused)

const AM_BLOGS = [
  { keyword: 'how do bridging loans work uk',              slug: 'how-do-bridging-loans-work-uk',              title: 'How Do Bridging Loans Work in the UK?' },
  { keyword: 'closed vs open bridging loan',               slug: 'closed-vs-open-bridging-loan',               title: 'Closed vs Open Bridging Loans: Key Differences' },
  { keyword: 'regulated bridging loan uk',                 slug: 'regulated-bridging-loan-uk',                 title: 'Regulated Bridging Loans: What You Need to Know' },
  { keyword: 'unregulated bridging loan uk',               slug: 'unregulated-bridging-loan-uk',               title: 'Unregulated Bridging Loans for Property Investors' },
  { keyword: 'first charge bridging loan',                 slug: 'first-charge-bridging-loan',                 title: 'First Charge Bridging Loans Explained' },
  { keyword: 'second charge bridging loan',                slug: 'second-charge-bridging-loan',                title: 'Second Charge Bridging Loans: How They Work' },
  { keyword: 'auction finance uk',                         slug: 'auction-finance-uk',                         title: 'Auction Finance: How to Buy Property at Auction' },
  { keyword: 'bridging loan to break property chain',      slug: 'bridging-loan-break-property-chain',         title: 'Using a Bridging Loan to Break a Property Chain' },
  { keyword: 'bridging loan for property refurbishment',   slug: 'bridging-loan-property-refurbishment',       title: 'Bridging Loans for Property Refurbishment' },
  { keyword: 'light refurbishment bridging loan',          slug: 'light-refurbishment-bridging-loan',          title: 'Light Refurbishment Bridging Finance Explained' },
  { keyword: 'heavy refurbishment bridging loan',          slug: 'heavy-refurbishment-bridging-loan',          title: 'Heavy Refurbishment Bridging Finance Explained' },
  { keyword: 'bridging loan uninhabitable property',       slug: 'bridging-loan-uninhabitable-property',       title: 'Bridging Loans for Uninhabitable Properties' },
  { keyword: 'bridging loan listed building',              slug: 'bridging-loan-listed-building',              title: 'Bridging Finance for Listed Buildings' },
  { keyword: 'bridging loan land purchase uk',             slug: 'bridging-loan-land-purchase-uk',             title: 'Bridging Loans for Land Purchase in the UK' },
  { keyword: 'bridging loan commercial property',          slug: 'bridging-loan-commercial-property',          title: 'Bridging Finance for Commercial Property' },
  { keyword: 'semi commercial bridging loan',              slug: 'semi-commercial-bridging-loan',              title: 'Semi-Commercial Bridging Loans UK' },
  { keyword: 'bridging loan hmo property',                 slug: 'bridging-loan-hmo-property',                 title: 'Bridging Loans for HMO Properties' },
  { keyword: 'bridging loan mixed use property',           slug: 'bridging-loan-mixed-use-property',           title: 'Bridging Finance for Mixed-Use Properties' },
  { keyword: 'bridging loan new build property',           slug: 'bridging-loan-new-build-property',           title: 'Bridging Loans for New Build Properties' },
  { keyword: 'property conversion bridging finance',       slug: 'property-conversion-bridging-finance',       title: 'Property Conversion Bridging Finance' },
  { keyword: 'bridging loan change of use',                slug: 'bridging-loan-change-of-use',                title: 'Change of Use Bridging Loans Explained' },
  { keyword: 'bridging loan short lease property',         slug: 'bridging-loan-short-lease-property',         title: 'Bridging Loans for Short Lease Properties' },
  { keyword: 'bridging loan buy to let',                   slug: 'bridging-loan-buy-to-let',                   title: 'Bridging Finance for Buy to Let Investors' },
  { keyword: 'bridging loan stop repossession',            slug: 'bridging-loan-stop-repossession',            title: 'Using a Bridging Loan to Stop Repossession' },
  { keyword: 'bridging loan probate property',             slug: 'bridging-loan-probate-property',             title: 'Bridging Loans for Probate Properties' },
  { keyword: 'bridging loan business premises',            slug: 'bridging-loan-business-premises',            title: 'Bridging Finance for Business Premises' },
  { keyword: 'bridging loan hotel purchase',               slug: 'bridging-loan-hotel-purchase',               title: 'Bridging Loans for Hotel and Hospitality Purchase' },
  { keyword: 'bridging loan student accommodation',        slug: 'bridging-loan-student-accommodation',        title: 'Bridging Finance for Student Accommodation' },
  { keyword: 'bridging loan exit strategy',                slug: 'bridging-loan-exit-strategy',                title: 'Bridging Loan Exit Strategies: What Lenders Look For' },
  { keyword: 'bridging loan permitted development',        slug: 'bridging-loan-permitted-development',        title: 'Bridging Finance for Permitted Development Projects' },
  { keyword: 'bridging loan spv company',                  slug: 'bridging-loan-spv-company',                  title: 'Bridging Loans for SPV Companies' },
  { keyword: 'bridging loan property portfolio',           slug: 'bridging-loan-property-portfolio',           title: 'Bridging Finance for Property Portfolios' },
  { keyword: 'bridging loan overseas investors',           slug: 'bridging-loan-overseas-investors',           title: 'Bridging Loans for Overseas Property Investors' },
  { keyword: 'bridging loan foreign nationals uk',         slug: 'bridging-loan-foreign-nationals-uk',         title: 'Bridging Finance for Foreign Nationals in the UK' },
  { keyword: 'large bridging loan uk over 1 million',      slug: 'large-bridging-loan-uk',                     title: 'Large Bridging Loans: Financing Over £1 Million' },
  { keyword: 'bridging loan divorce property settlement',  slug: 'bridging-loan-divorce-settlement',           title: 'Bridging Finance During Divorce Proceedings' },
  { keyword: 'bridging loan property developers',          slug: 'bridging-loan-property-developers',          title: 'Bridging Loans for Property Developers' },
  { keyword: 'bridging loan expats uk property',           slug: 'bridging-loan-expats-uk',                    title: 'Bridging Finance for UK Expats Buying Property' },
  { keyword: 'bridging loan office purchase',              slug: 'bridging-loan-office-purchase',              title: 'Bridging Loans for Office Property Purchase' },
  { keyword: 'bridging loan warehouse industrial',         slug: 'bridging-loan-warehouse-industrial',         title: 'Bridging Finance for Warehouse and Industrial Units' },
  { keyword: 'bridging loan care home acquisition',        slug: 'bridging-loan-care-home',                    title: 'Bridging Loans for Care Home Acquisition' },
  { keyword: 'bridging loan pension fund property',        slug: 'bridging-loan-pension-fund-property',        title: 'Bridging Loans for Pension Fund Property Purchases' },
  { keyword: 'ssas bridging loan pension',                 slug: 'ssas-bridging-loan',                         title: 'SSAS Bridging Loans: Pension-Backed Property Finance' },
  { keyword: 'bridging loan leasehold property',           slug: 'bridging-loan-leasehold-property',           title: 'Bridging Loans for Leasehold Properties' },
  { keyword: '100 percent bridging loan uk',               slug: '100-percent-bridging-loan-uk',               title: '100% Bridging Finance: Is It Possible?' },
  { keyword: 'bridging loan landlords uk',                 slug: 'bridging-loan-landlords-uk',                 title: 'Bridging Loans for Landlords in the UK' },
  { keyword: 'bridging loan limited company uk',           slug: 'bridging-loan-limited-company-uk',           title: 'Bridging Finance Through a Limited Company' },
  { keyword: 'bridging loan property investor',            slug: 'bridging-loan-property-investor',            title: 'Bridging Loans for Property Investors Explained' },
  { keyword: 'bridging loan self employed uk',             slug: 'bridging-loan-self-employed-uk',             title: 'Bridging Loans for Self-Employed Borrowers' },
  { keyword: 'bridging loan retail property uk',           slug: 'bridging-loan-retail-property-uk',           title: 'Bridging Finance for Retail Property' },
  { keyword: 'bridging vs development finance difference', slug: 'bridging-vs-development-finance',            title: 'Bridging Loan vs Development Finance: Key Differences' },
  { keyword: 'bridging loan interest only explained',      slug: 'bridging-loan-interest-only-explained',      title: 'Interest Only Bridging Loans Explained' },
  { keyword: 'cross charge bridging loan',                 slug: 'cross-charge-bridging-loan',                 title: 'Cross-Charge Bridging Loans: Multiple Property Security' },
  { keyword: 'bridging loan proof of funds',               slug: 'bridging-loan-proof-of-funds',               title: 'Bridging Loans and Proof of Funds Requirements' },
  { keyword: 'bridging loan solicitor requirements',       slug: 'bridging-loan-solicitor-requirements',       title: 'Solicitor Requirements for UK Bridging Loans' },
  { keyword: 'bridging loan minimum maximum amount',       slug: 'bridging-loan-minimum-maximum-amount',       title: 'Minimum and Maximum Bridging Loan Amounts in the UK' },
  { keyword: 'bridging loan for business cashflow',        slug: 'bridging-loan-business-cashflow',            title: 'Bridging Finance to Fund Business Cash Flow' },
  { keyword: 'bridging loan auction bidding strategy',     slug: 'bridging-loan-auction-bidding-strategy',     title: 'Auction Bidding Strategy with Bridging Finance' },
  { keyword: 'bridging loan buy below market value',       slug: 'bridging-loan-buy-below-market-value',       title: 'Using Bridging Finance to Buy Below Market Value' },
  { keyword: 'bridging loan property development finance', slug: 'bridging-loan-property-development',         title: 'Bridging Loans in Property Development: A Practical Guide' },
  { keyword: 'bridging loan first time buyer',             slug: 'bridging-loan-first-time-buyer',             title: 'Bridging Finance for First Time Buyers: Is It Possible?' },
];

const PM_BLOGS = [
  { keyword: 'bridging loan rates uk 2025 2026',           slug: 'bridging-loan-rates-uk-2026',                title: 'UK Bridging Loan Rates in 2025/2026' },
  { keyword: 'bridging loan costs breakdown',              slug: 'bridging-loan-costs-breakdown',              title: 'Bridging Loan Costs: A Full Breakdown' },
  { keyword: 'bridging loan application process uk',       slug: 'bridging-loan-application-process',          title: 'The Bridging Loan Application Process Step by Step' },
  { keyword: 'how fast can you get bridging loan',         slug: 'how-fast-can-you-get-bridging-loan',         title: 'How Fast Can You Get a Bridging Loan in the UK?' },
  { keyword: 'bridging loan bad credit uk',                slug: 'bridging-loan-bad-credit-uk',                title: 'Bridging Loans With Bad Credit: What\'s Possible' },
  { keyword: 'bridging loan with ccj uk',                  slug: 'bridging-loan-with-ccj-uk',                  title: 'Getting a Bridging Loan With a CCJ' },
  { keyword: 'how bridging loan interest is calculated',   slug: 'how-bridging-loan-interest-is-calculated',   title: 'How Bridging Loan Interest is Calculated' },
  { keyword: 'monthly vs rolled up interest bridging',     slug: 'monthly-vs-rolled-up-interest-bridging',     title: 'Monthly vs Rolled-Up Interest on Bridging Loans' },
  { keyword: 'retained interest bridging loan',            slug: 'retained-interest-bridging-loan',            title: 'Retained Interest Bridging Loans Explained' },
  { keyword: 'bridging loan lenders uk 2026',              slug: 'bridging-loan-lenders-uk',                   title: 'UK Bridging Loan Lenders: Who to Consider' },
  { keyword: 'bridging loan broker vs direct lender',      slug: 'bridging-loan-broker-vs-direct-lender',      title: 'Bridging Loan Broker vs Direct Lender: Which Is Better?' },
  { keyword: 'bridging loan valuation process',            slug: 'bridging-loan-valuation-process',            title: 'Bridging Loan Valuations: What You Need to Know' },
  { keyword: 'bridging loan without full valuation',       slug: 'bridging-loan-without-full-valuation',       title: 'Bridging Loans Without a Full Valuation' },
  { keyword: 'desktop valuation bridging loan',            slug: 'desktop-valuation-bridging-loan',            title: 'Desktop Valuations for Bridging Loans' },
  { keyword: 'bridging loan ltv how much can i borrow',    slug: 'bridging-loan-ltv-explained',                title: 'Bridging Loan LTV: How Much Can You Borrow?' },
  { keyword: 'high ltv bridging loan uk',                  slug: 'high-ltv-bridging-loan-uk',                  title: 'High LTV Bridging Loans: 75% and Above' },
  { keyword: 'bridging loan legal fees uk',                slug: 'bridging-loan-legal-fees-uk',                title: 'Bridging Loan Legal Fees: What to Budget' },
  { keyword: 'bridging loan eligibility criteria',         slug: 'bridging-loan-eligibility-criteria',         title: 'Bridging Loan Eligibility: Key Criteria Explained' },
  { keyword: 'do bridging loans require income proof',     slug: 'bridging-loan-income-requirements',          title: 'Do Bridging Loans Require Proof of Income?' },
  { keyword: 'how to compare bridging loan rates',         slug: 'how-to-compare-bridging-loan-rates',         title: 'How to Compare Bridging Loan Rates in the UK' },
  { keyword: 'same day bridging loan uk',                  slug: 'same-day-bridging-loan-uk',                  title: 'Same Day and Fast Bridging Loans: What\'s Realistic' },
  { keyword: 'bridging loan term length uk',               slug: 'bridging-loan-term-length',                  title: 'Bridging Loan Terms: How Long Can You Borrow?' },
  { keyword: 'early repayment bridging loan',              slug: 'early-repayment-bridging-loan',              title: 'Early Repayment of a Bridging Loan' },
  { keyword: 'extending a bridging loan uk',               slug: 'extending-a-bridging-loan',                  title: 'Extending a Bridging Loan: Costs and Options' },
  { keyword: 'refinancing a bridging loan',                slug: 'refinancing-a-bridging-loan',                title: 'Refinancing a Bridging Loan: Your Options' },
  { keyword: 'bridging loan security types uk',            slug: 'bridging-loan-security-types',               title: 'What Security Can You Use for a Bridging Loan?' },
  { keyword: 'bridging loan additional security',          slug: 'bridging-loan-additional-security',          title: 'Using Additional Security to Boost Your Bridging LTV' },
  { keyword: 'bridging loan without exit strategy',        slug: 'bridging-loan-without-exit-strategy',        title: 'Bridging Loans Without a Clear Exit Strategy' },
  { keyword: 'bridging loan offshore company',             slug: 'bridging-loan-offshore-company',             title: 'Bridging Loans for Offshore Companies' },
  { keyword: 'bridging loan trust structure',              slug: 'bridging-loan-trust-structure',              title: 'Bridging Finance for Trust Structures' },
  { keyword: 'bridging loan business partnership',         slug: 'bridging-loan-business-partnership',         title: 'Bridging Loans for Business Partnerships' },
  { keyword: 'bridging loan borrowers over 70',            slug: 'bridging-loan-borrowers-over-70',            title: 'Bridging Loans for Borrowers Over 70' },
  { keyword: 'bridging loan tax implications uk',          slug: 'bridging-loan-tax-implications',             title: 'Tax Implications of Bridging Finance' },
  { keyword: 'stamp duty bridging loan uk',                slug: 'stamp-duty-bridging-loan',                   title: 'Using a Bridging Loan to Cover Stamp Duty' },
  { keyword: 'bridging loan company director uk',          slug: 'bridging-loan-company-director',             title: 'Bridging Loans for Company Directors' },
  { keyword: 'why use whole of market bridging broker',    slug: 'why-use-whole-of-market-bridging-broker',    title: 'Why Use a Whole-of-Market Bridging Broker' },
  { keyword: 'common bridging loan mistakes',              slug: 'common-bridging-loan-mistakes',              title: 'Common Bridging Loan Mistakes and How to Avoid Them' },
  { keyword: 'bridging loan risks what borrowers need',    slug: 'bridging-loan-risks',                        title: 'Bridging Loan Risks: What Borrowers Should Know' },
  { keyword: 'what happens if you default on bridging',    slug: 'bridging-loan-default-consequences',         title: 'What Happens If You Default on a Bridging Loan?' },
  { keyword: 'bridging loan vs secured business loan',     slug: 'bridging-loan-vs-secured-loan',              title: 'Bridging Loan vs Secured Business Loan' },
  { keyword: 'fca regulated bridging loans consumer',      slug: 'fca-regulated-bridging-loans',               title: 'FCA-Regulated Bridging Loans: Consumer Protections' },
  { keyword: 'bridging finance uk property market 2026',   slug: 'bridging-finance-property-market-2026',      title: 'Bridging Finance and the UK Property Market in 2026' },
  { keyword: 'bridging loan no personal guarantee',        slug: 'bridging-loan-no-personal-guarantee',        title: 'Bridging Loans Without a Personal Guarantee' },
  { keyword: 'best company structure for bridging loan',   slug: 'company-structure-bridging-loan',            title: 'Best Company Structure for a Bridging Loan' },
  { keyword: 'bridging loans scotland legal differences',  slug: 'bridging-loans-scotland',                    title: 'Bridging Loans in Scotland: Legal Differences Explained' },
  { keyword: 'bridging finance northern ireland',          slug: 'bridging-finance-northern-ireland',          title: 'Bridging Finance in Northern Ireland' },
  { keyword: 'bridging loans wales explained',             slug: 'bridging-loans-wales',                       title: 'Bridging Loans in Wales: What Borrowers Need to Know' },
  { keyword: 'bridging loan investment strategy uk',       slug: 'bridging-loan-investment-strategy',          title: 'Using Bridging Finance as an Investment Strategy' },
  { keyword: 'how to compare bridging loan deals uk',      slug: 'compare-bridging-loan-deals-uk',             title: 'How to Compare Bridging Loan Deals in the UK' },
  { keyword: 'bridging loan credit check uk',              slug: 'bridging-loan-credit-check',                 title: 'Bridging Loans and Credit Checks: What to Expect' },
  { keyword: 'bridging finance frequently asked questions',slug: 'bridging-finance-faq',                      title: 'Bridging Finance FAQs: Everything You Need to Know' },
  { keyword: 'bridging loan process timeline uk',          slug: 'bridging-loan-process-timeline',             title: 'Bridging Loan Timeline: From Application to Completion' },
  { keyword: 'bridging loan vs remortgage uk',             slug: 'bridging-loan-vs-remortgage',                title: 'Bridging Finance vs Remortgage: Which Is Right for You?' },
  { keyword: 'bridging loan for business investment',      slug: 'bridging-loan-business-investment',          title: 'Bridging Loans for Business Investment Opportunities' },
  { keyword: 'bridging loan rolled up interest explained', slug: 'bridging-loan-rolled-up-interest',           title: 'Rolled-Up Interest on Bridging Loans: A Full Guide' },
  { keyword: 'bridging loan for working capital',          slug: 'bridging-loan-working-capital',              title: 'Using a Bridging Loan for Working Capital' },
  { keyword: 'bridging loan second charge ltd company',    slug: 'second-charge-bridging-ltd-company',         title: 'Second Charge Bridging Loans for Ltd Companies' },
  { keyword: 'bridging loan property below market value',  slug: 'bridging-loan-below-market-value-property',  title: 'Bridging Finance: Buying Property Below Market Value' },
  { keyword: 'bridging loan whole of market search',       slug: 'bridging-loan-whole-market-search',          title: 'Whole of Market Bridging Loan Search: Why It Matters' },
  { keyword: 'bridging loan for sole trader uk',           slug: 'bridging-loan-sole-trader-uk',               title: 'Bridging Loans for Sole Traders in the UK' },
  { keyword: 'commercial bridging loan uk explained',      slug: 'commercial-bridging-loan-uk',                title: 'Commercial Bridging Loans Explained' },
];

// ─── UK Location list (300 cities/towns) ─────────────────────────────────────
const UK_LOCATIONS = [
  // London areas
  'London', 'City of London', 'Canary Wharf', 'Mayfair', 'Chelsea', 'Kensington',
  'Fulham', 'Hammersmith', 'Wimbledon', 'Croydon', 'Bromley', 'Lewisham',
  'Greenwich', 'Woolwich', 'Stratford', 'Ilford', 'Romford', 'Barking',
  'Walthamstow', 'Tottenham', 'Islington', 'Hackney', 'Bethnal Green',
  // South East England
  'Birmingham', 'Brighton', 'Guildford', 'Woking', 'Farnham', 'Aldershot',
  'Basingstoke', 'Winchester', 'Eastleigh', 'Fareham', 'Gosport', 'Chichester',
  'Worthing', 'Crawley', 'Horsham', 'Tunbridge Wells', 'Maidstone', 'Canterbury',
  'Dover', 'Folkestone', 'Margate', 'Ramsgate', 'Hastings', 'Eastbourne',
  'Hove', 'Slough', 'Windsor', 'Maidenhead', 'High Wycombe', 'Aylesbury',
  'Reading', 'Oxford', 'Milton Keynes', 'Luton', 'St Albans', 'Watford',
  'Hemel Hempstead', 'Stevenage', 'Harlow', 'Chelmsford', 'Colchester',
  'Ipswich', 'Norwich', 'Peterborough', 'Cambridge', 'Ely', 'Huntingdon',
  'Northampton', 'Bedford', 'Welwyn Garden City', 'Letchworth',
  // South West England
  'Bristol', 'Bath', 'Cheltenham', 'Gloucester', 'Swindon', 'Salisbury',
  'Bournemouth', 'Poole', 'Weymouth', 'Dorchester', 'Taunton', 'Yeovil',
  'Weston-super-Mare', 'Exeter', 'Torquay', 'Plymouth', 'Truro', 'Newquay',
  'Penzance', 'Falmouth', 'Barnstaple', 'Hereford', 'Worcester', 'Shrewsbury',
  'Telford', 'Redditch',
  // East Midlands
  'Nottingham', 'Leicester', 'Derby', 'Lincoln', 'Northampton', 'Loughborough',
  'Grantham', 'Newark', 'Mansfield', 'Chesterfield', 'Corby', 'Kettering',
  'Wellingborough', 'Hinckley',
  // West Midlands
  'Coventry', 'Wolverhampton', 'Solihull', 'Dudley', 'Walsall', 'West Bromwich',
  'Stoke-on-Trent', 'Crewe', 'Macclesfield', 'Chester',
  // North West England
  'Manchester', 'Liverpool', 'Preston', 'Blackpool', 'Blackburn', 'Burnley',
  'Bolton', 'Bury', 'Wigan', 'Salford', 'Oldham', 'Rochdale', 'Stockport',
  'Warrington', 'Lancaster', 'Morecambe', 'Barrow-in-Furness', 'Carlisle',
  'Kendal',
  // Yorkshire & Humber
  'Leeds', 'Sheffield', 'Bradford', 'Hull', 'York', 'Harrogate', 'Halifax',
  'Huddersfield', 'Wakefield', 'Doncaster', 'Rotherham', 'Barnsley', 'Grimsby',
  'Scunthorpe', 'Scarborough', 'Whitby',
  // North East England
  'Newcastle upon Tyne', 'Sunderland', 'Middlesbrough', 'Gateshead',
  'South Shields', 'Hartlepool', 'Darlington', 'Durham',
  // Scotland
  'Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling',
  'Perth', 'St Andrews', 'Kirkcaldy', 'Falkirk', 'Greenock', 'Paisley',
  'East Kilbride', 'Livingston', 'Hamilton', 'Ayr', 'Kilmarnock',
  'Dunfermline', 'Motherwell', 'Coatbridge', 'Cumbernauld', 'Dumfries',
  'Fort William', 'Oban', 'Elgin',
  // Wales
  'Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry', 'Bridgend',
  'Merthyr Tydfil', 'Cwmbran', 'Caerphilly', 'Neath', 'Port Talbot',
  'Carmarthen', 'Aberystwyth', 'Bangor', 'Llandudno', 'Rhyl', 'Colwyn Bay',
  // Northern Ireland
  'Belfast', 'Derry', 'Lisburn', 'Newry', 'Newtownabbey', 'Armagh',
  'Ballymena', 'Antrim', 'Omagh', 'Enniskillen',
  // More English towns
  'Basingstoke', 'Andover', 'Newbury', 'Wokingham', 'Bracknell',
  'Staines', 'Twickenham', 'Kingston upon Thames', 'Sutton', 'Epsom',
  'Reigate', 'Redhill', 'Dorking', 'Bognor Regis', 'Worthing', 'Littlehampton',
  'Lowestoft', 'Bury St Edmunds', 'Haverhill', 'Sudbury', 'Braintree',
  'Brentwood', 'Basildon', 'Southend-on-Sea', 'Clacton-on-Sea', 'Harwich',
  'Wisbech', 'March', 'St Ives', 'Huntingdon',
  'Leighton Buzzard', 'Dunstable', 'Hertford', 'Hitchin',
  'Widnes', 'Runcorn', 'Ellesmere Port', 'Birkenhead', 'Bootle', 'Southport',
  'Accrington', 'Nelson', 'Clitheroe', 'Skelmersdale', 'St Helens',
  'Wakefield', 'Pontefract', 'Castleford', 'Dewsbury', 'Batley', 'Morley',
  'Keighley', 'Shipley', 'Bingley', 'Skipton',
  'Beverley', 'Bridlington', 'Driffield', 'Goole', 'Selby',
  'Ripon', 'Thirsk', 'Northallerton', 'Stockton-on-Tees', 'Billingham',
  'Consett', 'Stanley', 'Chester-le-Street', 'Newton Aycliffe', 'Spennymoor',
  'Peterlee', 'Seaham', 'Houghton-le-Spring', 'Washington',
];

// De-duplicate just in case
const LOCATIONS = [...new Set(UK_LOCATIONS)];

// ─── Slug helper ──────────────────────────────────────────────────────────────
function toLocationSlug(city) {
  return `${SERVICE_SLUG}-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
function toLocationKeyword(city) {
  return `bridging finance ${city.toLowerCase()}`;
}
function toLocationTitle(city) {
  return `Bridging Finance ${city} | Commercial Finance Broker`;
}
function toLocationMetaTitle(city) {
  return `Bridging Finance in ${city} | Boxx Commercial Finance`;
}
function toLocationMetaDesc(city) {
  return `Independent bridging finance broker in ${city}. Whole-of-market access, fast decisions. Speak to our team today.`;
}

// ─── Build a blog row array ───────────────────────────────────────────────────
// Column order: A-Z = 0-25 (then AA=26, AB=27, AC=28)
// A id, B type, C status, D publishDate, E publishSlot,
// F service, G city, H keyword, I topic, J title,
// K slug, L url, M metaTitle, N metaDescription, O category,
// P contentBrief, Q internalLinkService, R-T internalLinkCity1-3,
// U-W relatedBlog1-3, X faqRequired, Y linkedInRequired, Z author

let nextId = 1;

function buildBlogRow(id, date, slot, topic) {
  const author = slot === 'AM' ? 'Mark Higgins' : 'Andrew Farrimond';
  return [
    id,
    'blog',
    'scheduled',
    date,
    slot,
    SERVICE,
    '',          // city
    topic.keyword,
    topic.keyword,
    topic.title,
    topic.slug,
    '',          // url (filled after publish)
    topic.title + ' | Boxx Commercial Finance',
    `${topic.title}. Expert advice from Boxx Commercial Finance, a whole-of-market UK bridging finance broker.`,
    SERVICE,
    '',          // contentBrief
    SERVICE_URL, // internalLinkService
    '',          // internalLinkCity1
    '',          // internalLinkCity2
    '',          // internalLinkCity3
    '',          // relatedBlog1
    '',          // relatedBlog2
    '',          // relatedBlog3
    'yes',       // faqRequired
    'yes',       // linkedInRequired
    author,
  ];
}

function buildLocationRow(id, date, city) {
  return [
    id,
    'location',
    'scheduled',
    date,
    '',          // publishSlot
    SERVICE,
    city,
    toLocationKeyword(city),
    `Bridging finance for businesses in ${city}`,
    toLocationTitle(city),
    toLocationSlug(city),
    '',          // url
    toLocationMetaTitle(city),
    toLocationMetaDesc(city),
    SERVICE,
    '',          // contentBrief
    SERVICE_URL, // internalLinkService
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Content Engine Seeder                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  if (isDryRun) console.log('⚠  DRY RUN — no changes written\n');

  const sheets = await getSheetsClient();

  // ── Read existing rows ──────────────────────────────────────────────────────
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  const rows = res.data.values || [];
  console.log(`Read ${rows.length} existing rows from ContentEngine\n`);

  // Build sets of what already exists (to avoid duplicates)
  const existingBlogSlugSet  = new Set();
  const existingBlogSlots    = new Set(); // key: `${date}:${slot}`
  const existingLocDates     = new Map(); // date → Set of city slugs
  let maxNumericId = 0;

  for (const row of rows) {
    const type   = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const date   = (row[3] || '').trim();
    const slot   = (row[4] || '').toUpperCase().trim();
    const svc    = (row[5] || '').trim();
    const city   = (row[6] || '').trim();
    const slug   = (row[10] || '').trim();

    // Track max numeric ID
    const idStr = String(row[0] || '');
    const numPart = parseInt(idStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numPart) && numPart > maxNumericId) maxNumericId = numPart;

    if (svc !== SERVICE) continue;
    if (status === 'paused') continue; // skip paused rows

    if (type === 'blog') {
      if (slug) existingBlogSlugSet.add(slug);
      if (date && slot) existingBlogSlots.add(`${date}:${slot}`);
    }
    if (type === 'location') {
      if (!existingLocDates.has(date)) existingLocDates.set(date, new Set());
      if (city) existingLocDates.get(date).add(city.toLowerCase());
      if (slug) existingLocDates.get(date).add(slug); // also track by slug
    }
  }

  nextId = maxNumericId + 1;

  console.log(`Existing BF blog slugs: ${existingBlogSlugSet.size}`);
  console.log(`Existing BF blog (date:slot) pairs: ${existingBlogSlots.size}`);
  console.log(`Existing BF location dates: ${existingLocDates.size}`);
  console.log(`Next ID will start at: ${nextId}\n`);

  // ── Plan new rows ───────────────────────────────────────────────────────────
  const startDate = today();
  const endDate   = addDays(startDate, DAYS_AHEAD - 1);

  // Get topic queues — filter out already-scheduled slugs
  const amTopics = AM_BLOGS.filter(t => !existingBlogSlugSet.has(t.slug));
  const pmTopics = PM_BLOGS.filter(t => !existingBlogSlugSet.has(t.slug));

  let amIdx  = 0;
  let pmIdx  = 0;
  let locIdx = 0; // cycles through LOCATIONS

  const newBlogRows     = [];
  const newLocationRows = [];

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date = addDays(startDate, day);

    // ── Blog rows ──────────────────────────────────────────────────────────
    const needsAM = !existingBlogSlots.has(`${date}:AM`);
    const needsPM = !existingBlogSlots.has(`${date}:PM`);

    if (needsAM && amIdx < amTopics.length) {
      const id = `BF${String(nextId++).padStart(4, '0')}`;
      newBlogRows.push(buildBlogRow(id, date, 'AM', amTopics[amIdx++]));
    }
    if (needsPM && pmIdx < pmTopics.length) {
      const id = `BF${String(nextId++).padStart(4, '0')}`;
      newBlogRows.push(buildBlogRow(id, date, 'PM', pmTopics[pmIdx++]));
    }

    // ── Location rows ──────────────────────────────────────────────────────
    const existingCitiesThisDate = existingLocDates.get(date) || new Set();
    let locAdded = existingCitiesThisDate.size;

    while (locAdded < 5 && locIdx < LOCATIONS.length * 2) { // *2 allows a second pass through locations list
      const city = LOCATIONS[locIdx % LOCATIONS.length];
      locIdx++;
      const citySlug = toLocationSlug(city);
      const cityLower = city.toLowerCase();
      if (existingCitiesThisDate.has(cityLower) || existingCitiesThisDate.has(citySlug)) continue;
      const id = `BF${String(nextId++).padStart(4, '0')}`;
      newLocationRows.push(buildLocationRow(id, date, city));
      existingCitiesThisDate.add(cityLower);
      locAdded++;
    }
  }

  console.log(`New blog rows to add:     ${newBlogRows.length}`);
  console.log(`New location rows to add: ${newLocationRows.length}`);
  console.log(`Total new rows:           ${newBlogRows.length + newLocationRows.length}\n`);

  if (newBlogRows.length === 0 && newLocationRows.length === 0) {
    console.log('✅ Nothing to add — schedule is already fully populated.\n');
    return;
  }

  // Preview first 5 of each
  console.log('── Blog rows (first 5 preview) ───────────────────────────────');
  newBlogRows.slice(0, 5).forEach(r => console.log(`  ${r[3]} ${r[4]}  ${r[25]}  "${r[9]}"`));
  console.log('');
  console.log('── Location rows (first 5 preview) ──────────────────────────');
  newLocationRows.slice(0, 5).forEach(r => console.log(`  ${r[3]}  ${r[6]}  "${r[9]}"`));
  console.log('');

  if (isDryRun) {
    console.log('[DRY RUN] No changes written. Re-run without --dry-run to apply.\n');
    return;
  }

  // ── Append all new rows (blog first, then location) ────────────────────────
  const allNewRows = [...newBlogRows, ...newLocationRows];

  // Google Sheets append — adds rows after the last populated row in the range
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A:Z',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: allNewRows },
  });

  console.log(`✅ Appended ${allNewRows.length} rows to ContentEngine tab.\n`);
  console.log(`Blog coverage:     ${newBlogRows.length} posts (${Math.round(newBlogRows.length / 2)} days × 2/day)`);
  console.log(`Location coverage: ${newLocationRows.length} pages (${Math.round(newLocationRows.length / 5)} days × 5/day)`);
  console.log(`\nFrom ${startDate} to ${endDate}\n`);
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
