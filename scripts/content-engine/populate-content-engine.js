require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── How far ahead to schedule each run ──────────────────────────────────────
// Run this script quarterly (Jan/Apr/Jul/Oct). Each run schedules the next
// 90 days of content starting from the day after the last scheduled date.
const MAX_SCHEDULE_DAYS = 90;

// ─── Column mapping (0-indexed, matches ContentEngine sheet) ─────────────────
// A=0 id, B=1 type, C=2 status, D=3 publishDate, E=4 publishSlot
// F=5 service, G=6 city, H=7 keyword, I=8 topic, J=9 title
// K=10 slug, L=11 url, M=12 metaTitle, N=13 metaDescription, O=14 category
// P=15 contentBrief, Q=16 internalLinkService, R=17 internalLinkCity1
// S=18 internalLinkCity2, T=19 internalLinkCity3
// U=20 relatedBlog1, V=21 relatedBlog2, W=22 relatedBlog3
// X=23 faqRequired, Y=24 linkedInRequired, Z=25 author
// AA=26 jsonStatus, AB=27 publishedAt, AC=28 notes

// ─── Service metadata ─────────────────────────────────────────────────────────

const SERVICE_META = {
  'Business Loans': {
    slug: 'business-loans',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/business-loans',
    category: 'Business Loans',
  },
  'Asset Finance': {
    slug: 'asset-finance',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/asset-finance',
    category: 'Asset Finance',
  },
  'Invoice Finance': {
    slug: 'invoice-finance',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/invoice-finance',
    category: 'Invoice Finance',
  },
  'Bridging Finance': {
    slug: 'bridging-finance',
    author: 'Mark Higgins',
    serviceUrl: '/funding-solutions/bridging-loans',
    category: 'Bridging Finance',
  },
  'Commercial Mortgage': {
    slug: 'commercial-mortgages',
    author: 'Mark Higgins',
    serviceUrl: '/funding-solutions/commercial-mortgages',
    category: 'Commercial Mortgage',
  },
  'Development Finance': {
    slug: 'development-finance',
    author: 'Mark Higgins',
    serviceUrl: '/funding-solutions/development-finance',
    category: 'Development Finance',
  },
  'Working Capital': {
    slug: 'working-capital',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/working-capital',
    category: 'Working Capital',
  },
  'Trade Finance': {
    slug: 'trade-finance',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/trade-finance',
    category: 'Trade Finance',
  },
  'Cashflow Finance': {
    slug: 'cashflow-finance',
    author: 'Andrew Farrimond',
    serviceUrl: '/funding-solutions/cashflow-finance',
    category: 'Cashflow Finance',
  },
  'Mezzanine Finance': {
    slug: 'mezzanine-finance',
    author: 'Mark Higgins',
    serviceUrl: '/funding-solutions/mezzanine-finance',
    category: 'Mezzanine Finance',
  },
  'Structured Finance': {
    slug: 'structured-finance',
    author: 'Mark Higgins',
    serviceUrl: '/funding-solutions/structured-finance',
    category: 'Structured Finance',
  },
};

// ─── Blog topics (365 total — 1 per day × 365 days) ──────────────────────────
// Each run schedules the next MAX_SCHEDULE_DAYS topics that aren't yet in the sheet.
// Briefs guide GPT-4o; the rest of the prompt handles structure, tone, and linking.

const BLOG_TOPICS = [

  // ── Business Loans (34) ──────────────────────────────────────────────────────
  { service: 'Business Loans', keyword: 'business loans for limited companies',
    title: 'Business Loans for Limited Companies: How to Apply and What to Expect',
    slug: 'business-loans-for-limited-companies',
    brief: 'Eligibility, director guarantees, secured vs unsecured; scenario: 3yr-old ltd co seeking £150k expansion.' },
  { service: 'Business Loans', keyword: 'unsecured business loans uk',
    title: 'Unsecured Business Loans: Rates, Limits and What Lenders Actually Check',
    slug: 'unsecured-business-loans-uk',
    brief: 'What unsecured really means (PG still required), APR ranges, limits up to £500k, when unsecured beats secured.' },
  { service: 'Business Loans', keyword: 'startup business loans uk',
    title: 'Business Loans for Startups: Options When You Have No Trading History',
    slug: 'startup-business-loans-uk',
    brief: 'Pre-revenue challenges, Start Up Loans scheme, asset-backed options; scenario: food business 8 months old needing £30k.' },
  { service: 'Business Loans', keyword: 'business loan rates uk',
    title: 'Business Loan Rates in the UK: What You\'ll Actually Pay',
    slug: 'business-loan-rates-uk',
    brief: 'Factors driving pricing, realistic rate ranges by loan type, arrangement fees, why headline rates mislead.' },
  { service: 'Business Loans', keyword: 'business loan vs overdraft',
    title: 'Business Loan vs. Overdraft: Which Is Better for Your Business?',
    slug: 'business-loan-vs-overdraft',
    brief: 'Cost, flexibility, availability, how each sits on the balance sheet; wrong-product scenario and consequences.' },
  { service: 'Business Loans', keyword: 'short term business loans uk',
    title: 'Short-Term Business Loans: When They Make Sense (and When They Don\'t)',
    slug: 'short-term-business-loans-uk',
    brief: 'Use cases (VAT bill, large order, seasonal stock), honest cost vs long-term, MCA and invoice finance alternatives.' },
  { service: 'Business Loans', keyword: 'business loan application uk',
    title: 'Business Loan Application: What Lenders Actually Look For',
    slug: 'business-loan-application-uk',
    brief: 'Accounts, bank statements, credit profile, business plan requirements; documents checklist; typical timelines; broker advantage.' },
  { service: 'Business Loans', keyword: 'business loans with bad credit',
    title: 'Business Loans with Bad Credit: What Are Your Options in the UK?',
    slug: 'business-loans-with-bad-credit',
    brief: 'CCJs, defaults, missed payments; specialist lenders, realistic borrowing costs, secured options, how to improve position.' },
  { service: 'Business Loans', keyword: 'government backed business loans uk',
    title: 'Government-Backed Business Loans: What\'s Available in the UK',
    slug: 'government-backed-business-loans-uk',
    brief: 'British Business Bank, Start Up Loans, Recovery Loan Scheme successors; accredited lenders; advantages and limitations.' },
  { service: 'Business Loans', keyword: 'how much can i borrow for a business loan',
    title: 'How Much Can You Borrow? Business Loan Amounts Explained',
    slug: 'how-much-can-i-borrow-business-loan',
    brief: 'Turnover multiples (10-25%), profitability, existing debt; why right-sizing matters; examples across different business sizes.' },
  { service: 'Business Loans', keyword: 'business loan personal guarantee',
    title: 'Personal Guarantees on Business Loans: What You\'re Agreeing To',
    slug: 'business-loan-personal-guarantee',
    brief: 'Legal meaning, limited vs unlimited PG, charge on property vs PG; how to limit exposure; what happens on default.' },
  { service: 'Business Loans', keyword: 'business loans for sole traders',
    title: 'Business Loans for Sole Traders: What You Need to Know',
    slug: 'business-loans-for-sole-traders',
    brief: 'How sole traders are assessed vs limited companies; personal credit importance; typical limits; lender expectations.' },
  { service: 'Business Loans', keyword: 'business loan for expansion',
    title: 'Business Loans for Growth and Expansion: How to Fund Your Next Step',
    slug: 'business-loan-for-expansion',
    brief: 'Growth vs cashflow lending; what a strong growth plan looks like; asset-backed vs unsecured for expansion projects.' },
  { service: 'Business Loans', keyword: 'business loan for franchise',
    title: 'Business Loans for Franchise Purchases: How the Finance Works',
    slug: 'business-loan-for-franchise',
    brief: 'Franchise-specific lenders, accredited lender programmes, what makes a franchise application strong vs an independent business.' },
  { service: 'Business Loans', keyword: 'bounce back loan and new business borrowing',
    title: 'Got a Bounce Back Loan? How It Affects Your New Borrowing',
    slug: 'bounce-back-loan-and-new-borrowing',
    brief: 'How outstanding BBLS affects new applications; lender attitudes; top-up routes; honest assessment of options available.' },
  { service: 'Business Loans', keyword: 'business loans for transport companies',
    title: 'Business Loans for Transport and Haulage Companies',
    slug: 'business-loans-for-transport-companies',
    brief: 'Vehicles as security, operator licence requirements, insurance; scenario: haulier needing £200k for fleet expansion.' },
  { service: 'Business Loans', keyword: 'business loans for hospitality businesses',
    title: 'Business Loans for Hospitality Businesses: What Lenders Look For',
    slug: 'business-loans-for-hospitality-businesses',
    brief: 'Licensed premises challenges, trading accounts, seasonal adjustment; scenario: restaurant group opening second site.' },
  { service: 'Business Loans', keyword: 'secured business loan uk',
    title: 'Secured Business Loans: How They Work and When to Use One',
    slug: 'secured-business-loan-uk',
    brief: 'Property and asset security, LTV ratios, cost advantage vs unsecured, personal liability implications, who offers secured loans.' },
  { service: 'Business Loans', keyword: 'business loan vs equity investment',
    title: 'Business Loan vs. Equity Investment: Debt or Dilution?',
    slug: 'business-loan-vs-equity-investment',
    brief: 'Control vs cost, real cost of dilution, when debt is right, when equity makes more sense; hybrid options.' },
  { service: 'Business Loans', keyword: 'fast business loans uk',
    title: 'Fast Business Loans in the UK: How Quickly Can You Actually Borrow?',
    slug: 'fast-business-loans-uk',
    brief: 'Same-day and 24-hour options, speed vs cost trade-off, what you need ready, fintech lenders vs traditional banks.' },
  { service: 'Business Loans', keyword: 'business loans for retailers',
    title: 'Business Loans for Retailers: Managing Seasonal Cash and Stock Costs',
    slug: 'business-loans-for-retailers',
    brief: 'Stock finance vs term loan, MCA for card-based retailers, seasonal planning; scenario: independent retailer pre-Christmas.' },
  { service: 'Business Loans', keyword: 'business loans for healthcare businesses',
    title: 'Business Loans for Healthcare Businesses: Funding Clinics and Practices',
    slug: 'business-loans-for-healthcare-businesses',
    brief: 'CQC context, NHS contract finance, practice acquisition lending, specialist lenders for healthcare sector.' },
  { service: 'Business Loans', keyword: 'business loans for construction companies',
    title: 'Business Loans for Construction Companies: Cashflow and Project Finance',
    slug: 'business-loans-for-construction-companies',
    brief: 'CIS tax, retentions, seasonal cashflow gaps, project finance vs working capital loan, lender appetite for construction.' },
  { service: 'Business Loans', keyword: 'business loans for ecommerce',
    title: 'Business Loans for Ecommerce Businesses: Funding Without Physical Assets',
    slug: 'business-loans-for-ecommerce',
    brief: 'No physical security challenge, revenue-based finance, inventory lending, MCA on card revenue; fintech lenders.' },
  { service: 'Business Loans', keyword: 'business loan early repayment charges',
    title: 'Early Repayment Charges on Business Loans: What You Need to Know',
    slug: 'business-loan-early-repayment-charges',
    brief: 'How ERC is calculated, when paying early makes financial sense, how to negotiate ERC out of a term sheet.' },
  { service: 'Business Loans', keyword: 'how long does a business loan take',
    title: 'How Long Does a Business Loan Take? Timelines for Every Lender Type',
    slug: 'how-long-does-a-business-loan-take',
    brief: 'High street (weeks) vs alternative (days) vs fintech (hours); what slows applications; how a broker speeds things up.' },
  { service: 'Business Loans', keyword: 'business loan vs credit card',
    title: 'Business Loan vs. Business Credit Card: Which Works Out Cheaper?',
    slug: 'business-loan-vs-credit-card',
    brief: 'True cost comparison, working capital uses, revolving vs fixed repayment, when each makes sense for UK SMEs.' },
  { service: 'Business Loans', keyword: 'business loans for care home providers',
    title: 'Business Loans for Care Home Providers: What Lenders Assess',
    slug: 'business-loans-for-care-home-providers',
    brief: 'CQC registration, EBITDA per bed, occupancy rates, staffing costs; specialist lenders; acquisition vs expansion scenarios.' },
  { service: 'Business Loans', keyword: 'business loans for charities',
    title: 'Business Loans for Charities and Social Enterprises',
    slug: 'business-loans-for-charities',
    brief: 'Trading arm requirements, charitable status complications, lenders specialising in third sector, social impact lending.' },
  { service: 'Business Loans', keyword: 'business loans for professional services firms',
    title: 'Business Loans for Professional Services: Accountants, Solicitors and Consultants',
    slug: 'business-loans-for-professional-services',
    brief: 'Partnership structures, PI insurance as context, turnover-based lending, retainer income stability as a positive.' },
  { service: 'Business Loans', keyword: 'business loan to buy a business',
    title: 'Using a Business Loan to Buy a Business: Acquisition Finance Explained',
    slug: 'business-loan-to-buy-a-business',
    brief: 'Goodwill lending, vendor deferred consideration, MBO finance, lender appetite for acquisition vs organic growth.' },
  { service: 'Business Loans', keyword: 'business loan deposit requirements',
    title: 'Do You Need a Deposit for a Business Loan?',
    slug: 'business-loan-deposit-requirements',
    brief: 'When deposits are required vs not, 0% deposit options, true cost of no-deposit deals, lender risk pricing.' },
  { service: 'Business Loans', keyword: 'business loan for professional services firms',
    title: 'How Much Working Capital Do Professional Services Firms Need?',
    slug: 'working-capital-loan-for-professional-services',
    brief: 'Quarterly fee cycles, large disbursements, project-based income; revolving credit vs term loan for professional firms.' },
  { service: 'Business Loans', keyword: 'business loan calculator explained',
    title: 'Business Loan Calculator: What It Shows (and What It Misses)',
    slug: 'business-loan-calculator-explained',
    brief: 'How online calculators work, what they omit (fees, ERC, PG risk), why speaking to a broker gives the real picture.' },

  // ── Asset Finance (34) ───────────────────────────────────────────────────────
  { service: 'Asset Finance', keyword: 'asset finance for vehicles uk',
    title: 'Asset Finance for Vehicles: Cars, Vans and HGVs Explained',
    slug: 'asset-finance-for-vehicles-uk',
    brief: 'HP vs finance lease vs operating lease for commercial vehicles; VAT treatment differences; fleet finance; balloon payments.' },
  { service: 'Asset Finance', keyword: 'hire purchase vs finance lease',
    title: 'Hire Purchase vs. Finance Lease: What\'s the Difference?',
    slug: 'hire-purchase-vs-finance-lease',
    brief: 'Ownership, balance sheet treatment, VAT timing, IFRS 16 impact; when HP wins vs lease; practical machinery example.' },
  { service: 'Asset Finance', keyword: 'asset finance for machinery',
    title: 'Asset Finance for Machinery: How It Works and What It Costs',
    slug: 'asset-finance-for-machinery',
    brief: 'Hard assets, residual values, LTV (70-85%), second-hand machinery; monitoring; CNC machine scenario.' },
  { service: 'Asset Finance', keyword: 'sale and leaseback uk',
    title: 'Sale and Leaseback: Release Cash from Assets You Already Own',
    slug: 'sale-and-leaseback-uk',
    brief: 'Structure, use cases, which assets work (under 5 years old), tax implications; release capital without giving up equity.' },
  { service: 'Asset Finance', keyword: 'asset finance for it equipment',
    title: 'Asset Finance for IT Equipment: A Practical Guide for UK Businesses',
    slug: 'asset-finance-for-it-equipment',
    brief: 'Soft assets, fast depreciation, operating lease advantages, vendor finance; scenario: professional services firm £80k servers.' },
  { service: 'Asset Finance', keyword: 'operating lease vs finance lease',
    title: 'Operating Lease vs. Finance Lease: Which Is Right for Your Business?',
    slug: 'operating-lease-vs-finance-lease',
    brief: 'Residual risk, maintenance, balance sheet, tax allowances; IFRS 16 treatment; when operating lease wins.' },
  { service: 'Asset Finance', keyword: 'asset finance and vat uk',
    title: 'Asset Finance and VAT: What UK Businesses Need to Know',
    slug: 'asset-finance-vat-uk',
    brief: 'VAT on HP (upfront), finance lease (each rental), operating lease (rentals); cash flow impact; HMRC guidance.' },
  { service: 'Asset Finance', keyword: 'asset finance for construction equipment',
    title: 'Asset Finance for Construction Equipment: What UK Contractors Need to Know',
    slug: 'asset-finance-for-construction-equipment',
    brief: 'Excavators, cranes, plant; CITB levy, seasonal fluctuations; scenario: groundworks contractor £120k excavator.' },
  { service: 'Asset Finance', keyword: 'soft assets vs hard assets asset finance',
    title: 'Soft Assets vs. Hard Assets: How Lenders Treat Them Differently',
    slug: 'soft-assets-vs-hard-assets-asset-finance',
    brief: 'LTV, terms and lender appetite by asset type; what makes an asset fundable; when asset finance isn\'t the right fit.' },
  { service: 'Asset Finance', keyword: 'asset finance vs business loan',
    title: 'Asset Finance vs. Business Loan: Which Should You Choose?',
    slug: 'asset-finance-vs-business-loan',
    brief: 'Asset as security, lower rates, matching principle; wrong-choice scenario; when a loan beats asset finance.' },
  { service: 'Asset Finance', keyword: 'end of lease options asset finance',
    title: 'End of Lease Options: What Happens When Your Agreement Finishes?',
    slug: 'end-of-lease-options-asset-finance',
    brief: 'HP end (ownership), finance lease options (purchase/extend/return), operating lease (return/upgrade), secondary rental.' },
  { service: 'Asset Finance', keyword: 'asset finance for agricultural equipment',
    title: 'Asset Finance for Agricultural Equipment: Tractors, Combines and More',
    slug: 'asset-finance-for-agricultural-equipment',
    brief: 'Seasonal income patterns, Farm Business Tenancy, BPS payment context, specialist ag lenders, combine harvester scenario.' },
  { service: 'Asset Finance', keyword: 'asset finance for catering equipment',
    title: 'Asset Finance for Catering Equipment: Funding Your Kitchen',
    slug: 'asset-finance-for-catering-equipment',
    brief: 'Soft vs hard asset classification for kitchen kit; HP vs lease; scenario: restaurant refit £60k.' },
  { service: 'Asset Finance', keyword: 'asset finance for healthcare equipment',
    title: 'Asset Finance for Healthcare Equipment: Dental, Medical and Diagnostic',
    slug: 'asset-finance-for-healthcare-equipment',
    brief: 'Medical devices, dental chairs, diagnostic imaging; CQC context; specialist lenders; maintenance agreements.' },
  { service: 'Asset Finance', keyword: 'asset finance for solar panels and renewables',
    title: 'Asset Finance for Solar Panels and Renewable Energy Equipment',
    slug: 'asset-finance-for-solar-panels',
    brief: 'Grid connection, revenue from export tariff, payback period finance; green asset lenders; combined grant + finance.' },
  { service: 'Asset Finance', keyword: 'asset finance for dental practices',
    title: 'Asset Finance for Dental Practices: Equipment and Fit-Out Funding',
    slug: 'asset-finance-for-dental-practices',
    brief: 'Chair finance, CBCT scanners, practice refurb; NHS vs private income mix; specialist dental finance lenders.' },
  { service: 'Asset Finance', keyword: 'asset finance for gym equipment',
    title: 'Asset Finance for Gym and Leisure Equipment',
    slug: 'asset-finance-for-gym-equipment',
    brief: 'Membership revenue as serviceability proof, HP vs lease for cardio/strength kit, equipment lifespan and upgrade cycles.' },
  { service: 'Asset Finance', keyword: 'asset finance for haulage companies',
    title: 'Asset Finance for Haulage Companies: Funding Your Fleet',
    slug: 'asset-finance-for-haulage-companies',
    brief: 'HGVs, trailers, DVSA compliance, fleet age limits, operator licence context; refinancing existing fleet.' },
  { service: 'Asset Finance', keyword: 'asset finance for startups',
    title: 'Asset Finance for Startups: Can You Get It Without a Track Record?',
    slug: 'asset-finance-for-startups',
    brief: 'What startups can fund, director guarantee requirements, deposit expectations, lenders willing to back new businesses.' },
  { service: 'Asset Finance', keyword: 'contract hire explained uk',
    title: 'Contract Hire Explained: The Operating Lease with Extras',
    slug: 'contract-hire-explained-uk',
    brief: 'Maintenance included, road tax, mileage limits, end-of-contract condition, VAT on rentals; when contract hire beats HP.' },
  { service: 'Asset Finance', keyword: 'asset refinancing uk',
    title: 'Asset Refinancing: How to Release Capital from Assets You Own',
    slug: 'asset-refinancing-uk',
    brief: 'Sale and leaseback vs refinance, LTV on owned assets, age limits, tax treatment, use cases for releasing capital.' },
  { service: 'Asset Finance', keyword: 'balloon payment asset finance',
    title: 'Balloon Payments in Asset Finance: What They Are and How They Work',
    slug: 'balloon-payment-asset-finance',
    brief: 'How balloon reduces monthly payments, end-of-term risk, refinance options, when balloon structure makes commercial sense.' },
  { service: 'Asset Finance', keyword: 'asset finance for packaging equipment',
    title: 'Asset Finance for Packaging and Processing Equipment',
    slug: 'asset-finance-for-packaging-equipment',
    brief: 'Food and manufacturing sector; automated lines; soft vs hard asset classification; bespoke machinery funding.' },
  { service: 'Asset Finance', keyword: 'asset finance for hotel and leisure',
    title: 'Asset Finance for Hotels and Leisure Businesses: FF&E and Fit-Out',
    slug: 'asset-finance-for-hotel-and-leisure',
    brief: 'Furniture, fixtures and equipment; operating lease for soft furnishings; renovation cycle finance; seasonal cash management.' },
  { service: 'Asset Finance', keyword: 'asset finance broker uk',
    title: 'Asset Finance Broker: Why Going Direct Isn\'t Always Best',
    slug: 'asset-finance-broker-uk',
    brief: 'Whole-market access, lender relationships for complex assets, time saving, rate negotiation; when to use a broker vs direct.' },
  { service: 'Asset Finance', keyword: 'asset finance for breweries',
    title: 'Asset Finance for Breweries and Distilleries',
    slug: 'asset-finance-for-breweries',
    brief: 'Fermenters, conditioning tanks, bottling lines; specialist lenders; aged stock as asset; scenario: craft brewery expansion.' },
  { service: 'Asset Finance', keyword: 'asset finance early settlement',
    title: 'Settling Your Asset Finance Early: Costs, Savings and Options',
    slug: 'asset-finance-early-settlement',
    brief: 'How settlement figures are calculated, ERC on HP vs lease, when early settlement makes financial sense.' },
  { service: 'Asset Finance', keyword: 'asset finance for clean technology',
    title: 'Asset Finance for Clean Technology: EV Chargers, Heat Pumps and More',
    slug: 'asset-finance-for-clean-technology',
    brief: 'Green asset lenders, government grant stacking, EV charging infrastructure, battery storage; payback and finance interaction.' },
  { service: 'Asset Finance', keyword: 'asset finance for printing industry',
    title: 'Asset Finance for the Printing Industry: Wide Format, Litho and Digital',
    slug: 'asset-finance-for-printing-industry',
    brief: 'Fast depreciation on print kit, operating lease advantage for upgrade cycles; wide format vs litho lender appetite.' },
  { service: 'Asset Finance', keyword: 'asset finance for food manufacturing',
    title: 'Asset Finance for Food Manufacturing Equipment',
    slug: 'asset-finance-for-food-manufacturing',
    brief: 'Processing equipment, cold storage, conveyors; BRC accreditation context; scenario: food producer funding £200k production line.' },
  { service: 'Asset Finance', keyword: 'asset finance for telecoms equipment',
    title: 'Asset Finance for Telecoms Equipment: CAPEX to OPEX',
    slug: 'asset-finance-for-telecoms-equipment',
    brief: 'Network infrastructure, CAPEX vs OPEX shift; leasing for tech refresh; vendor finance programmes in telecoms.' },
  { service: 'Asset Finance', keyword: 'asset finance with poor credit',
    title: 'Can You Get Asset Finance with Poor Credit?',
    slug: 'asset-finance-with-poor-credit',
    brief: 'Asset-led lending reduces credit dependency; deposit requirements; specialist lenders; what helps vs hurts the case.' },
  { service: 'Asset Finance', keyword: 'asset finance for pharmaceutical equipment',
    title: 'Asset Finance for Pharmaceutical and Lab Equipment',
    slug: 'asset-finance-for-pharmaceutical-equipment',
    brief: 'Lab equipment, cleanroom fit-out, MHRA context; specialist lenders; HP vs lease for fast-depreciating scientific kit.' },
  { service: 'Asset Finance', keyword: 'asset finance for laundry equipment',
    title: 'Asset Finance for Commercial Laundry Equipment',
    slug: 'asset-finance-for-laundry-equipment',
    brief: 'Commercial laundry, care home and hospitality sector; HP vs contract; scenario: care home chain £40k equipment refit.' },

  // ── Invoice Finance (33) ─────────────────────────────────────────────────────
  { service: 'Invoice Finance', keyword: 'invoice factoring vs invoice discounting',
    title: 'Invoice Factoring vs. Invoice Discounting: A Side-by-Side Comparison',
    slug: 'invoice-factoring-vs-invoice-discounting',
    brief: 'Factoring (lender collects, customers know) vs discounting (confidential); cost, suitability by size, customer relationships.' },
  { service: 'Invoice Finance', keyword: 'selective invoice finance uk',
    title: 'Selective Invoice Finance: Fund Individual Invoices Without a Full Facility',
    slug: 'selective-invoice-finance-uk',
    brief: 'Spot/selective mechanics, higher cost vs whole-ledger, when it makes sense, same-day release, suitable platforms.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for recruitment agencies',
    title: 'Invoice Finance for Recruitment Agencies: Bridging the Payroll Gap',
    slug: 'invoice-finance-for-recruitment-agencies',
    brief: 'Weekly payroll vs 30-60 day client terms; specialist recruitment finance; concentration risk; HMRC payroll liabilities.' },
  { service: 'Invoice Finance', keyword: 'invoice finance rates uk',
    title: 'Invoice Finance Rates: What You\'ll Actually Pay in the UK',
    slug: 'invoice-finance-rates-uk',
    brief: 'Service fee vs discount charge breakdown; typical ranges; minimum usage fees; how to compare facilities properly.' },
  { service: 'Invoice Finance', keyword: 'is invoice finance right for my business',
    title: 'Is Invoice Finance Right for Your Business? Six Signs to Look For',
    slug: 'is-invoice-finance-right-for-my-business',
    brief: 'Six indicators (B2B, 30+ day terms, growth, overdraft maxed); when it\'s not suitable (construction, B2C, disputes).' },
  { service: 'Invoice Finance', keyword: 'invoice finance for construction uk',
    title: 'Invoice Finance for Construction: The Unique Challenges Explained',
    slug: 'invoice-finance-for-construction-uk',
    brief: 'Retentions, applications for payment, CIS tax, contra accounts; specialist construction lenders; retention bonds alternative.' },
  { service: 'Invoice Finance', keyword: 'switching invoice finance provider',
    title: 'How to Switch Invoice Finance Provider Without Disrupting Cash Flow',
    slug: 'switching-invoice-finance-provider',
    brief: '3-month notice periods, run-off process, debtor notification, transition funding; signs it\'s time to switch; broker management.' },
  { service: 'Invoice Finance', keyword: 'bad debt protection invoice finance',
    title: 'Bad Debt Protection: Is It Worth Adding to Your Invoice Finance?',
    slug: 'bad-debt-protection-invoice-finance',
    brief: 'Covers insolvency (90% of value), cost (0.2-0.5%), exclusions; when it\'s worth it; vs standalone credit insurance.' },
  { service: 'Invoice Finance', keyword: 'how invoice finance improves cash flow',
    title: 'How Invoice Finance Improves Cash Flow Without Taking On Debt',
    slug: 'how-invoice-finance-improves-cash-flow',
    brief: 'Why it\'s not a loan, cash conversion cycle, worked example: £500k turnover 45-day terms 80% prepayment.' },
  { service: 'Invoice Finance', keyword: 'invoice finance concentration risk',
    title: 'Invoice Finance and Concentration Risk: One Big Customer Can Be a Problem',
    slug: 'invoice-finance-concentration-risk',
    brief: 'Triggered at 25-30% of ledger; lender responses; selective finance for large customer; practical structuring advice.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for transport companies',
    title: 'Invoice Finance for Transport and Haulage: Managing the Cashflow Gap',
    slug: 'invoice-finance-for-transport-companies',
    brief: 'Fuel costs vs 30-day client payment terms; whole-ledger vs spot; lender appetite for transport debtors.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for engineering firms',
    title: 'Invoice Finance for Engineering and Manufacturing Firms',
    slug: 'invoice-finance-for-engineering-firms',
    brief: 'Long production cycles vs 60-day payment terms; combined invoice and trade finance; lender appetite for B2B engineering.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for staffing agencies',
    title: 'Invoice Finance for Staffing Agencies: Weekly Pay, Monthly Billing',
    slug: 'invoice-finance-for-staffing-agencies',
    brief: 'Payroll funding gap, compliance requirements, HMRC liabilities; specialist staffing finance lenders vs generalist facilities.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for subcontractors',
    title: 'Invoice Finance for Subcontractors: Getting Paid Faster on Site',
    slug: 'invoice-finance-for-subcontractors',
    brief: 'CIS deductions, applications for payment vs invoices, retention challenges; specialist subcontractor finance options.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for marketing agencies',
    title: 'Invoice Finance for Marketing and Creative Agencies',
    slug: 'invoice-finance-for-marketing-agencies',
    brief: 'Project-based billing, retainer clients, large client concentration; confidential discounting suits agency model.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for wholesalers',
    title: 'Invoice Finance for Wholesale and Distribution Businesses',
    slug: 'invoice-finance-for-wholesalers',
    brief: 'Stock purchase to invoice to 45-day payment; combined stock and invoice finance; whole-ledger facility sizing.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for IT companies',
    title: 'Invoice Finance for IT and Technology Companies',
    slug: 'invoice-finance-for-it-companies',
    brief: 'SaaS vs services distinction; milestone billing; large enterprise clients; confidential discounting for B2B tech.' },
  { service: 'Invoice Finance', keyword: 'does invoice finance affect credit rating',
    title: 'Does Invoice Finance Affect Your Business Credit Rating?',
    slug: 'does-invoice-finance-affect-credit-rating',
    brief: 'How invoice finance appears on credit files; confidential vs disclosed; impact on other credit applications.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for food and drink businesses',
    title: 'Invoice Finance for Food and Drink Businesses',
    slug: 'invoice-finance-for-food-and-drink',
    brief: 'Perishable stock pressures, supermarket payment terms (60-90 days), BRC/SALSA compliance context, suitable facilities.' },
  { service: 'Invoice Finance', keyword: 'whole ledger vs spot factoring',
    title: 'Whole Ledger vs. Spot Factoring: Which Suits Your Business?',
    slug: 'whole-ledger-vs-spot-factoring',
    brief: 'Cost comparison, flexibility vs commitment, when spot makes sense (occasional large invoices) vs whole-ledger.' },
  { service: 'Invoice Finance', keyword: 'invoice finance exit process',
    title: 'Exiting an Invoice Finance Facility: How to End the Agreement Cleanly',
    slug: 'invoice-finance-exit-process',
    brief: 'Notice periods (typically 3 months), run-off, debtor notification, blocked debtors risk; clean vs messy exits.' },
  { service: 'Invoice Finance', keyword: 'reverse factoring explained uk',
    title: 'Reverse Factoring Explained: Supply Chain Finance for UK Businesses',
    slug: 'reverse-factoring-explained-uk',
    brief: 'Buyer\'s lender pays supplier early, buyer repays later; SCF vs traditional factoring; fintech platforms available.' },
  { service: 'Invoice Finance', keyword: 'invoice finance minimum turnover uk',
    title: 'Invoice Finance Minimum Turnover: What You Need to Qualify',
    slug: 'invoice-finance-minimum-turnover-uk',
    brief: 'Typical minimums by facility type (£100k+ for whole-ledger, less for spot); what to do if below threshold.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for manufacturing businesses',
    title: 'Invoice Finance for Manufacturers: Bridging Production and Payment',
    slug: 'invoice-finance-for-manufacturing',
    brief: 'Long cash conversion cycle, B2B sales with 45-60 day terms; combined stock and invoice finance for manufacturers.' },
  { service: 'Invoice Finance', keyword: 'invoice finance approval and setup',
    title: 'How to Get an Invoice Finance Facility Set Up: The Process Explained',
    slug: 'invoice-finance-approval-and-setup',
    brief: 'Due diligence process, ledger audit, debtor approval, facility limits, typical timeline from application to first draw.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for professional services',
    title: 'Invoice Finance for Professional Services: Accountants, Solicitors and Consultants',
    slug: 'invoice-finance-for-professional-services',
    brief: 'SRA accounts rules for solicitors, retainer vs project billing, partnership structures; confidential discounting suits.' },
  { service: 'Invoice Finance', keyword: 'debt factoring explained',
    title: 'Debt Factoring Explained Simply: What It Is and How UK Businesses Use It',
    slug: 'debt-factoring-explained',
    brief: 'Plain-English explainer; factoring = selling your invoices; cost, speed, suitability; who it works best for.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for charities and social enterprises',
    title: 'Invoice Finance for Charities and Social Enterprises',
    slug: 'invoice-finance-for-charities',
    brief: 'Trading arm invoicing, grant timing vs delivery costs, lenders that work with third sector; practical eligibility.' },
  { service: 'Invoice Finance', keyword: 'invoice finance for media companies',
    title: 'Invoice Finance for Media and Publishing Companies',
    slug: 'invoice-finance-for-media-companies',
    brief: 'Project and campaign billing, large agency clients, 60-90 day payment terms; confidential discounting for media.' },

  // ── Bridging Finance (33) ────────────────────────────────────────────────────
  { service: 'Bridging Finance', keyword: 'bridging loan rates uk',
    title: 'Bridging Loan Rates in the UK: What to Expect',
    slug: 'bridging-loan-rates-uk',
    brief: 'Monthly rate ranges (0.55-1.5%), what drives pricing, arrangement fees, worked cost example over 9 months; total cost warning.' },
  { service: 'Bridging Finance', keyword: 'regulated vs unregulated bridging finance',
    title: 'Regulated vs. Unregulated Bridging Finance: What\'s the Difference?',
    slug: 'regulated-vs-unregulated-bridging-finance',
    brief: 'FCA test (residential occupation = regulated); practical implications; complaint routes; when you need a regulated broker.' },
  { service: 'Bridging Finance', keyword: 'bridging finance for property chains',
    title: 'Bridging Finance to Break a Property Chain: How It Works',
    slug: 'bridging-finance-for-property-chains',
    brief: 'Chain-break use case, LTV (70-75%), exit via sale proceeds; realistic scenario with timeline and costs.' },
  { service: 'Bridging Finance', keyword: 'how to get a bridging loan',
    title: 'How to Get a Bridging Loan: A Step-by-Step Guide',
    slug: 'how-to-get-a-bridging-loan',
    brief: 'Enquiry to drawdown: assessment, lender presentation, terms, valuation, legal, drawdown; 3-4 week typical timeline.' },
  { service: 'Bridging Finance', keyword: 'bridging loans for auction purchases',
    title: 'Bridging Loans for Auction Purchases: Meeting the 28-Day Deadline',
    slug: 'bridging-loans-for-auction-purchases',
    brief: '28-day completion requirement, why mortgages fail at auction, DIP before bidding, what happens if completion missed.' },
  { service: 'Bridging Finance', keyword: 'first charge vs second charge bridging loan',
    title: 'First Charge vs. Second Charge Bridging Loans: What\'s the Difference?',
    slug: 'first-charge-vs-second-charge-bridging',
    brief: 'Security hierarchy, why second charge exists, higher rates, first charge lender consent, combined LTV limits.' },
  { service: 'Bridging Finance', keyword: 'bridging finance exit strategy',
    title: 'Bridging Finance Exit Strategies: Planning Your Repayment from Day One',
    slug: 'bridging-finance-exit-strategy',
    brief: 'Exit is the most important factor; main exits (sale, refinance, income); what happens if exit delays; extension fees.' },
  { service: 'Bridging Finance', keyword: 'bridging loan with bad credit',
    title: 'Can You Get a Bridging Loan with Bad Credit?',
    slug: 'bridging-loan-bad-credit',
    brief: 'Asset-led over credit-led; what lenders overlook (CCJs, defaults, IVA); impact on rate and LTV; specialist brokers.' },
  { service: 'Bridging Finance', keyword: 'bridging finance for commercial property',
    title: 'Bridging Finance for Commercial Property: What Lenders Want to See',
    slug: 'bridging-finance-for-commercial-property',
    brief: 'Tenancy, WAULT, covenant strength; untenanted harder; LTV 60-65%; scenario: untenanted unit for refurb and let.' },
  { service: 'Bridging Finance', keyword: 'how quickly can you get a bridging loan',
    title: 'How Quickly Can You Get a Bridging Loan?',
    slug: 'how-quickly-can-you-get-a-bridging-loan',
    brief: 'Standard 3-4 weeks, fast-track 5-10 days, emergency 24-72 hours; what determines speed; cost of urgency.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for refurbishment',
    title: 'Bridging Loans for Refurbishment: Light, Medium and Heavy Works',
    slug: 'bridging-loan-for-refurbishment',
    brief: 'Light vs heavy refurb distinction, retained vs rolled interest, monitoring for larger works, exit to mortgage on completion.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for planning gain',
    title: 'Bridging Finance for Planning Gain: Buying Before Permission Is Granted',
    slug: 'bridging-loan-for-planning-gain',
    brief: 'Lower LTV for pre-planning, increased value on permission, exit to development finance; risk management.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for uninhabitable property',
    title: 'Bridging Loans for Uninhabitable Properties: What Lenders Accept',
    slug: 'bridging-loan-for-uninhabitable-property',
    brief: 'Why mainstream mortgages decline, which bridging lenders accept no kitchen/bathroom, exit to mortgage post-refurb.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for land purchase',
    title: 'Bridging Loans for Land Purchase: Funding Without Buildings',
    slug: 'bridging-loan-for-land-purchase',
    brief: 'Land-only bridging, lower LTV (50-60%), planning status impact, exit to development finance or sale; specialist lenders.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for divorce settlement',
    title: 'Bridging Finance for Divorce: Buying Out a Partner\'s Share',
    slug: 'bridging-loan-for-divorce-settlement',
    brief: 'Buying out a partner before a sale completes; regulated bridge on jointly owned property; sensitivity required.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for inheritance',
    title: 'Bridging Finance for Inherited Property: Funding Before Probate Completes',
    slug: 'bridging-loan-for-inheritance',
    brief: 'Probate timeline, IHT payment before probate, borrowing against inherited property, exit via sale after probate.' },
  { service: 'Bridging Finance', keyword: 'open vs closed bridging loan',
    title: 'Open vs. Closed Bridging Loans: Which Do You Need?',
    slug: 'open-vs-closed-bridging-loan',
    brief: 'Closed (fixed exit date, lower rate), open (flexible, higher rate); when each applies; lender preferences.' },
  { service: 'Bridging Finance', keyword: 'bridging loans for hmo conversion',
    title: 'Bridging Loans for HMO Conversions: Funding the Works',
    slug: 'bridging-loans-for-hmo-conversion',
    brief: 'HMO licence requirements, Article 4 impact, works financing, exit to HMO mortgage; yield uplift justification.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for semi commercial property',
    title: 'Bridging Loans for Semi-Commercial Properties',
    slug: 'bridging-loan-for-semi-commercial',
    brief: 'Mixed use challenges (residential above, commercial below); which lenders are comfortable; combined LTV calculation.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for foreign nationals uk',
    title: 'Bridging Loans for Foreign Nationals Buying UK Property',
    slug: 'bridging-loan-for-foreign-nationals',
    brief: 'Residency and visa status impact; which lenders accept non-UK residents; higher deposits; AML requirements.' },
  { service: 'Bridging Finance', keyword: 'bridging loan maximum term uk',
    title: 'Bridging Loan Terms: How Long Can You Borrow For?',
    slug: 'bridging-loan-maximum-term',
    brief: 'Typical terms (1-24 months); lender appetite by term length; extension options and cost; why longer isn\'t always better.' },
  { service: 'Bridging Finance', keyword: 'bridging finance for permitted development',
    title: 'Bridging Finance for Permitted Development Conversions',
    slug: 'bridging-finance-for-permitted-development',
    brief: 'PD rights (office to residential), pre-app certificate, lender comfort with PD vs full planning, GDV and exit.' },
  { service: 'Bridging Finance', keyword: 'bridging loan interest options',
    title: 'Bridging Loan Interest: Retained, Rolled or Monthly Payments?',
    slug: 'bridging-loan-interest-options',
    brief: 'Three structures compared; cash flow impact of each; when each suits; true cost calculation for each method.' },
  { service: 'Bridging Finance', keyword: 'bridging loan valuation uk',
    title: 'Bridging Loan Valuations: What to Expect and How to Speed Things Up',
    slug: 'bridging-loan-valuation-uk',
    brief: 'AVM vs desktop vs physical valuation; cost; who can value; what slows it; lender panels; when AVM applies.' },
  { service: 'Bridging Finance', keyword: 'bridging finance for care home acquisition',
    title: 'Bridging Finance for Care Home Acquisitions',
    slug: 'bridging-finance-for-care-home-acquisition',
    brief: 'CQC context, trading vs non-trading care home, exit to commercial mortgage; lender appetite for regulated care sector.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for ground up development',
    title: 'Bridging Loans for Ground-Up Development: When to Use One',
    slug: 'bridging-loan-for-ground-up-development',
    brief: 'When bridging precedes development finance (pre-planning, site acquisition); cost vs going straight to development finance.' },
  { service: 'Bridging Finance', keyword: 'second charge bridging loan',
    title: 'Second Charge Bridging Loans: Releasing Equity Without Remortgaging',
    slug: 'second-charge-bridging-loan',
    brief: 'How second charge works behind an existing mortgage; consent requirements; LTV limits; cost vs first charge.' },
  { service: 'Bridging Finance', keyword: 'bridging finance scotland',
    title: 'Bridging Finance in Scotland: What\'s Different North of the Border',
    slug: 'bridging-finance-scotland',
    brief: 'Scottish property law differences (missives, settlement), which lenders operate in Scotland, typical terms.' },
  { service: 'Bridging Finance', keyword: 'bridging loan solicitor requirements',
    title: 'Bridging Loan Solicitors: Why You Need Independent Legal Advice',
    slug: 'bridging-loan-solicitor-requirements',
    brief: 'Independent solicitors requirement, lender panel vs own solicitor, legal timeline; what causes legal delays.' },
  { service: 'Bridging Finance', keyword: 'bridging finance for buy to let',
    title: 'Bridging Finance for Buy-to-Let: Buying Fast and Refinancing Smart',
    slug: 'bridging-finance-for-buy-to-let',
    brief: 'Acquiring unmortgageable BTL, refurbing to mortgageable standard, exit to BTL mortgage; cost vs potential rental yield.' },
  { service: 'Bridging Finance', keyword: 'bridging loan vs development finance',
    title: 'Bridging Loan vs. Development Finance: Which Do You Need?',
    slug: 'bridging-loan-vs-development-finance',
    brief: 'Key distinction: lump sum vs staged drawdown; light refurb (bridging) vs significant works (development finance).' },
  { service: 'Bridging Finance', keyword: 'bridging finance calculator',
    title: 'Bridging Finance Calculator: Understanding What You\'ll Pay',
    slug: 'bridging-finance-calculator',
    brief: 'How to calculate true cost (rate + arrangement fee + exit fee + valuation + legal); worked examples; broker advice value.' },
  { service: 'Bridging Finance', keyword: 'bridging loan for change of use',
    title: 'Bridging Finance for Change of Use Properties',
    slug: 'bridging-loan-for-change-of-use',
    brief: 'Funding property before change of use permission granted; lender appetite; exit once use class confirmed.' },

  // ── Development Finance (33) ─────────────────────────────────────────────────
  { service: 'Development Finance', keyword: 'development finance rates uk',
    title: 'Development Finance Rates: What Developers Pay in the UK',
    slug: 'development-finance-rates-uk',
    brief: 'Rate components: rolled vs retained; typical 6-12% pa; arrangement and exit fees; worked example £500k scheme 12 months.' },
  { service: 'Development Finance', keyword: 'gross development value explained',
    title: 'Gross Development Value: How Lenders Use GDV in Their Calculations',
    slug: 'gross-development-value-explained',
    brief: 'GDV definition, LTGDV as primary metric (60-70%), lender stress-testing, day-one LTV secondary check.' },
  { service: 'Development Finance', keyword: 'development finance for first time developers',
    title: 'Development Finance for First-Time Developers: What to Expect',
    slug: 'development-finance-for-first-time-developers',
    brief: 'Higher scrutiny, professional team as proxy for track record, equity requirements, JV structures, mentored loan programmes.' },
  { service: 'Development Finance', keyword: 'mezzanine finance for property development',
    title: 'Mezzanine Finance in Property Development: Bridging the Equity Gap',
    slug: 'mezzanine-finance-property-development',
    brief: 'Senior + mezz to 80% LTGDV; intercreditor deeds; cost premium vs equity partner; combined LTGDV limits.' },
  { service: 'Development Finance', keyword: 'development finance vs bridging finance',
    title: 'Development Finance vs. Bridging Finance: Which Do You Need?',
    slug: 'development-finance-vs-bridging-finance',
    brief: 'Staged drawdowns (dev finance) vs lump sum (bridging); light refurb vs structural works; monitoring surveyor role.' },
  { service: 'Development Finance', keyword: 'planning permission and development finance',
    title: 'Planning Permission and Development Finance: What Lenders Require',
    slug: 'planning-permission-development-finance',
    brief: 'Full planning before commitment; pre-planning lower LTV options; PD rights treatment; S106 obligations; reserved matters.' },
  { service: 'Development Finance', keyword: 'development finance drawdown process',
    title: 'How Development Finance is Drawn Down During a Build',
    slug: 'development-finance-drawdown-process',
    brief: 'Initial drawdown (site purchase), staged drawdowns vs certified costs, monitoring surveyor role, frequency, interest roll-up.' },
  { service: 'Development Finance', keyword: 'exit finance for property developers',
    title: 'Exit Finance for Property Developers: Options When the Build Is Done',
    slug: 'exit-finance-for-property-developers',
    brief: 'Development exit loans (lower rate than dev finance), bridging, BTL/commercial refinance; cost of exiting early vs waiting.' },
  { service: 'Development Finance', keyword: 'joint venture development finance',
    title: 'Joint Venture Development Finance: How It Works',
    slug: 'joint-venture-development-finance',
    brief: 'Equity JV vs funded JV; profit share structures; SPV; intercreditor considerations; when JV beats pure debt.' },
  { service: 'Development Finance', keyword: 'development finance for conversions',
    title: 'Development Finance for Conversions: Offices, Pubs and Commercial Buildings',
    slug: 'development-finance-for-conversions',
    brief: 'Office to residential PD rights, conversion risk vs new build, heritage constraints; lender appetite differences.' },
  { service: 'Development Finance', keyword: 'development finance for residential development',
    title: 'Development Finance for Residential Schemes: What Lenders Assess',
    slug: 'development-finance-for-residential',
    brief: 'Market comparables for GDV, planning certainty, exit sales strategy, pre-sales and reservations as comfort.' },
  { service: 'Development Finance', keyword: 'development finance for student accommodation',
    title: 'Development Finance for Student Accommodation',
    slug: 'development-finance-for-student-accommodation',
    brief: 'PBSA planning context, university proximity, HMO vs PBSA licensing, yield-based GDV, forward-funding alternatives.' },
  { service: 'Development Finance', keyword: 'development finance for commercial development',
    title: 'Development Finance for Commercial Development Projects',
    slug: 'development-finance-for-commercial',
    brief: 'Pre-lets as comfort, WAULT on forward-funded schemes, industrial vs office vs retail lender appetite; lower LTGDV.' },
  { service: 'Development Finance', keyword: 'self build development finance uk',
    title: 'Self-Build Finance: Funding Your Own Home from Ground Up',
    slug: 'self-build-development-finance',
    brief: 'Self-build mortgages vs development finance; staged drawdowns; Buildstore and specialist lenders; planning and warranty.' },
  { service: 'Development Finance', keyword: 'development finance monitoring surveyor',
    title: 'The Monitoring Surveyor in Development Finance: What They Do',
    slug: 'development-finance-monitoring-surveyor',
    brief: 'Role: certify build stages, approve drawdowns, report to lender; cost; who appoints them; impact on timeline.' },
  { service: 'Development Finance', keyword: 'development finance for listed buildings',
    title: 'Development Finance for Listed Buildings: Extra Considerations',
    slug: 'development-finance-for-listed-buildings',
    brief: 'Listed building consent, heritage restrictions, specialist contractors, insurance requirements; lender appetite and LTV.' },
  { service: 'Development Finance', keyword: 'development finance for brownfield sites',
    title: 'Development Finance for Brownfield Sites: Contamination and Risk',
    slug: 'development-finance-for-brownfield-sites',
    brief: 'Contamination assessment, Phase 1/2 reports, remediation costs, government brownfield grants; lender due diligence.' },
  { service: 'Development Finance', keyword: 'development appraisal for lenders',
    title: 'Development Appraisals: How to Prepare One That Lenders Trust',
    slug: 'development-appraisal-for-lenders',
    brief: 'Cost breakdown, GDV, profit margin (minimum 15-20%), contingency, finance costs; common mistakes in developer appraisals.' },
  { service: 'Development Finance', keyword: 'development finance for build to rent',
    title: 'Development Finance for Build-to-Rent Schemes',
    slug: 'development-finance-for-build-to-rent',
    brief: 'BTR planning context, yield-based exit (vs for-sale), forward-funding from institutional investors, lender appetite 2026.' },
  { service: 'Development Finance', keyword: 'development finance cash equity requirements',
    title: 'How Much Equity Do You Need for Development Finance?',
    slug: 'development-finance-equity-requirements',
    brief: 'Typically 30-40% of total costs; what counts as equity (land, cash, existing security); mezzanine to reduce cash requirement.' },
  { service: 'Development Finance', keyword: 'development finance for modular construction',
    title: 'Development Finance for Modular and Offsite Construction',
    slug: 'development-finance-for-modular-construction',
    brief: 'Offsite manufacture drawdown challenges, factory vs site risk, lender comfort with modular; speed advantage; warranty.' },
  { service: 'Development Finance', keyword: 'development finance for mixed use schemes',
    title: 'Development Finance for Mixed-Use Schemes',
    slug: 'development-finance-for-mixed-use',
    brief: 'Residential and commercial in one scheme; blended GDV calculation; lender complexity; S106 residential obligations.' },
  { service: 'Development Finance', keyword: 'development finance for hotel projects',
    title: 'Development Finance for Hotel Development Projects',
    slug: 'development-finance-for-hotel-development',
    brief: 'Planning for change of use (C1), operator agreement, brand standards cost, RevPAR-based GDV; specialist lenders.' },
  { service: 'Development Finance', keyword: 'development finance cost overruns',
    title: 'Managing Cost Overruns in Development Finance',
    slug: 'development-finance-cost-overruns',
    brief: 'Contingency requirements (typically 10-15%), lender attitude to variations, additional drawdown requests, stress-test importance.' },
  { service: 'Development Finance', keyword: 'development finance track record',
    title: 'Building Your Development Finance Track Record',
    slug: 'development-finance-track-record',
    brief: 'Why track record matters, how to build it (start small), what lenders look for, how to use professional team as proxy.' },
  { service: 'Development Finance', keyword: 'development finance lender types uk',
    title: 'Types of Development Finance Lender in the UK: Who\'s Out There?',
    slug: 'development-finance-lender-types',
    brief: 'Challenger banks, specialist dev finance lenders, family offices, peer-to-peer; appetite by scheme size and risk.' },
  { service: 'Development Finance', keyword: 'development finance for multiple plots',
    title: 'Development Finance for Multiple-Plot Schemes',
    slug: 'development-finance-for-multiple-plots',
    brief: 'Per-plot release, bulk drawdown vs staged, sales proceeds reducing facility; lender flexibility on release prices.' },
  { service: 'Development Finance', keyword: 'development finance retained vs rolled interest',
    title: 'Retained vs. Rolled Interest in Development Finance',
    slug: 'development-finance-interest-retained-vs-rolled',
    brief: 'Retained (deducted day one, lower loan), rolled (added to facility, larger loan); true cost comparison; cash flow impact.' },
  { service: 'Development Finance', keyword: 'development finance broker uk',
    title: 'Using a Development Finance Broker: What to Expect',
    slug: 'development-finance-broker',
    brief: 'Whole-market access, lender relationships, appraisal presentation, fee structure; when a broker adds most value.' },
  { service: 'Development Finance', keyword: 'development finance for social housing',
    title: 'Development Finance for Affordable and Social Housing',
    slug: 'development-finance-for-social-housing',
    brief: 'Registered Provider context, Homes England grants, planning obligations for affordable units; lender appetite for RP-backed schemes.' },
  { service: 'Development Finance', keyword: 'development finance later living',
    title: 'Development Finance for Later Living and Retirement Housing',
    slug: 'development-finance-for-later-living',
    brief: 'Retirement villages, assisted living, care homes; GDV methodology; planning context; specialist operators and lenders.' },

  // ── Commercial Mortgage (33) ──────────────────────────────────────────────────
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage rates uk',
    title: 'Commercial Mortgage Rates: What Are You Actually Paying?',
    slug: 'commercial-mortgage-rates-uk',
    brief: 'Fixed vs variable vs tracker; typical ranges; what drives pricing (LTV, lease, covenant); worked example £600k over 20 years.' },
  { service: 'Commercial Mortgage', keyword: 'owner occupier vs investment commercial mortgage',
    title: 'Owner-Occupier vs. Investment Commercial Mortgage: Key Differences',
    slug: 'owner-occupier-vs-investment-commercial-mortgage',
    brief: 'Business strength (owner) vs tenant covenant (investment); LTV differences; stress testing; who lends on each.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for pub or restaurant',
    title: 'Commercial Mortgage for a Pub or Restaurant: What Lenders Look For',
    slug: 'commercial-mortgage-for-pub-restaurant',
    brief: 'Licensed premises as specialist; EBITDA, wet/dry rent, F&B mix, trading accounts; freehold pub vs leasehold.' },
  { service: 'Commercial Mortgage', keyword: 'how to remortgage a commercial property',
    title: 'How to Remortgage a Commercial Property: Timing and Process',
    slug: 'how-to-remortgage-commercial-property',
    brief: 'When to remortgage, ERC on current lender, porting vs remortgage; broker whole-market access to improve terms.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for mixed use property',
    title: 'Commercial Mortgages for Mixed-Use Properties: How Lenders Assess Them',
    slug: 'commercial-mortgage-mixed-use-property',
    brief: 'Residential vs commercial split (40%+ residential triggers regulation), split assessment, finding comfortable lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage ltv uk',
    title: 'LTV on Commercial Mortgages: How Much Can You Borrow?',
    slug: 'commercial-mortgage-ltv-uk',
    brief: 'Typically 65-75% investment, 70-80% owner-occupier; property type impact; how to increase LTV; interest-only vs repayment.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage application documents',
    title: 'Commercial Mortgage Application: Documents You\'ll Need',
    slug: 'commercial-mortgage-application-documents',
    brief: 'Complete checklist: 3yr accounts, bank statements, property info, leases; what slows applications; how to prepare.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage vs bridging finance',
    title: 'Commercial Mortgage vs. Bridging Finance: Which and When?',
    slug: 'commercial-mortgage-vs-bridging-finance',
    brief: 'Bridge as stepping stone to mortgage (unmortgageable property); cost vs timeline; bridge-to-mortgage strategy case study.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for care home or hmo',
    title: 'Commercial Mortgages for Care Homes and HMOs: A Specialist Guide',
    slug: 'commercial-mortgage-care-home-hmo',
    brief: 'CQC for care homes (EBITDA per bed, occupancy); HMO licences, Article 4, room count; specialist lenders for each.' },
  { service: 'Commercial Mortgage', keyword: 'semi commercial property mortgage',
    title: 'Semi-Commercial Property Mortgages: How Lenders Handle Them',
    slug: 'semi-commercial-property-mortgage',
    brief: 'Definitional challenge, mainstream lenders decline, specialist commercial lenders, blended rental income assessment.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for retail units',
    title: 'Commercial Mortgages for Retail Units and Shops',
    slug: 'commercial-mortgage-for-retail-units',
    brief: 'Retail sector lender appetite (cautious post-pandemic), tenant covenant, lease length, void risk; owner-occupier vs investment.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for industrial units',
    title: 'Commercial Mortgages for Industrial and Warehouse Units',
    slug: 'commercial-mortgage-for-industrial-units',
    brief: 'Strong lender appetite for industrial; typical LTV, lease terms, EPC requirements; investor vs owner-occupier.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for offices',
    title: 'Commercial Mortgages for Office Buildings: What Lenders Think Now',
    slug: 'commercial-mortgage-for-offices',
    brief: 'Post-pandemic office demand, hybrid working impact, EPC minimum E requirement, grade A vs secondary; lender appetite 2026.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for a hotel',
    title: 'Commercial Mortgages for Hotels: How Lenders Assess Hospitality',
    slug: 'commercial-mortgage-for-hotels',
    brief: 'RevPAR, ADR, occupancy rate as key metrics; branded vs independent; trading accounts (3 years); specialist lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for student accommodation',
    title: 'Commercial Mortgages for Student Accommodation and HMOs',
    slug: 'commercial-mortgage-for-student-accommodation',
    brief: 'PBSA vs HMO licensing, Article 4 zones, yield calculation, university proximity premium; specialist lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for petrol station',
    title: 'Commercial Mortgages for Petrol Stations and Forecourts',
    slug: 'commercial-mortgage-for-petrol-station',
    brief: 'Environmental risk (tanks), fuel volumes and margins, convenience store contribution, specialist lenders only.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for multi let commercial',
    title: 'Commercial Mortgages for Multi-Let Commercial Properties',
    slug: 'commercial-mortgage-for-multi-let',
    brief: 'Void risk across multiple tenants, WAULT calculation, service charge management, stronger than single-let for some lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage interest only',
    title: 'Interest-Only Commercial Mortgages: Are They Still Available?',
    slug: 'commercial-mortgage-interest-only',
    brief: 'Availability (more common than residential IO), repayment vehicle requirements, impact on LTV, typical terms.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for overseas investors',
    title: 'UK Commercial Mortgages for Overseas Investors',
    slug: 'commercial-mortgage-for-overseas-investors',
    brief: 'Non-resident lending, UK entity structure, higher deposits, AML requirements, lenders who work with overseas buyers.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage deposit requirements',
    title: 'Commercial Mortgage Deposits: How Much Do You Need?',
    slug: 'commercial-mortgage-deposit-requirements',
    brief: 'Typically 25-40% deposit (varies by type); how to reduce with additional security; equity in existing property.' },
  { service: 'Commercial Mortgage', keyword: 'leasehold vs freehold commercial mortgage',
    title: 'Leasehold vs. Freehold Commercial Mortgages: What\'s the Difference?',
    slug: 'leasehold-vs-freehold-commercial-mortgage',
    brief: 'Freehold preferred by lenders; leasehold lease length requirements (typically 70+ years remaining); ground rent impact.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for vacant property',
    title: 'Commercial Mortgages for Vacant Properties: Can You Finance Empty Buildings?',
    slug: 'commercial-mortgage-for-vacant-property',
    brief: 'Vacant property is harder to fund; lower LTV; business plan for occupation; bridging as alternative; specialist lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage early repayment charges',
    title: 'Commercial Mortgage Early Repayment Charges: What to Watch For',
    slug: 'commercial-mortgage-early-repayment-charges',
    brief: 'Fixed vs variable ERC structures, break cost on swaps, when ERC is worth paying; how to negotiate at outset.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage stress test',
    title: 'Commercial Mortgage Stress Tests: How Lenders Assess Affordability',
    slug: 'commercial-mortgage-stress-test',
    brief: 'Interest cover ratio (ICR) requirements (typically 125-150%), stress rate above contract rate; what triggers decline.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage lease length requirements',
    title: 'Lease Length and Commercial Mortgages: What Lenders Require',
    slug: 'commercial-mortgage-lease-length',
    brief: 'Minimum unexpired lease term requirements (varies by lender), short lease impact on LTV and rate, lease renewal risk.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for new businesses',
    title: 'Can a New Business Get a Commercial Mortgage?',
    slug: 'commercial-mortgage-for-new-businesses',
    brief: 'Trading history requirements, projections in lieu of accounts, personal track record, higher deposits; realistic options.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for agricultural land',
    title: 'Commercial Mortgages for Agricultural Land and Farm Buildings',
    slug: 'commercial-mortgage-for-agricultural-land',
    brief: 'Agricultural lenders (Nat West, Handelsbanken, specialist), BPS income, planning for change of use, Rural Payments Agency.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for a care home',
    title: 'Commercial Mortgages for Care Homes: Funding the Acquisition',
    slug: 'commercial-mortgage-for-care-home-acquisition',
    brief: 'CQC registration, EBITDA per bed, occupancy rate, staffing costs; trading vs non-trading care home; specialist lenders.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage for builders merchants',
    title: 'Commercial Mortgages for Builders\' Merchants and Trade Suppliers',
    slug: 'commercial-mortgage-for-builders-merchants',
    brief: 'Industrial/warehouse classification, owner-occupier finance, yard and covered storage considerations; standard commercial.' },
  { service: 'Commercial Mortgage', keyword: 'commercial mortgage tenanted property',
    title: 'Commercial Mortgages for Tenanted Properties: Investment Lending',
    slug: 'commercial-mortgage-tenanted-property',
    brief: 'Tenant covenant assessment, unexpired lease term, rent review frequency, WAULT as primary metric; ICR calculation.' },
  { service: 'Commercial Mortgage', keyword: 'how to buy commercial property uk',
    title: 'How to Buy Commercial Property in the UK: A Step-by-Step Guide',
    slug: 'how-to-buy-commercial-property',
    brief: 'From search to completion: finance in principle, solicitors, searches, surveys, SDLT; using a broker from the start.' },
  { service: 'Commercial Mortgage', keyword: 'commercial property investment finance',
    title: 'Commercial Property Investment Finance: Building a Portfolio',
    slug: 'commercial-property-investment-finance',
    brief: 'Portfolio lending, cross-collateralisation, SPV structures, commercial mortgage vs bridging for acquisitions; yield targets.' },

  // ── Working Capital (33) ──────────────────────────────────────────────────────
  { service: 'Working Capital', keyword: 'working capital finance options uk',
    title: 'Working Capital Finance: The Most Common Options for UK Businesses',
    slug: 'working-capital-finance-options-uk',
    brief: 'Overview: overdraft, revolving credit, invoice finance, MCA, trade finance, stock finance; decision framework by use case.' },
  { service: 'Working Capital', keyword: 'revolving credit facility uk',
    title: 'Revolving Credit Facilities: How They Work and When to Use Them',
    slug: 'revolving-credit-facility-uk',
    brief: 'Mechanics, how it differs from overdraft and term loan, typical rates, use cases; how to get one.' },
  { service: 'Working Capital', keyword: 'merchant cash advance uk',
    title: 'Merchant Cash Advance: Is It Worth It for UK Businesses?',
    slug: 'merchant-cash-advance-uk',
    brief: 'Factor rate model, true cost calculation, when it makes sense vs alternatives; sectors where MCA is common.' },
  { service: 'Working Capital', keyword: 'working capital finance for retailers',
    title: 'Working Capital Finance for Retailers: Managing Seasonal Cash Flow',
    slug: 'working-capital-finance-for-retailers',
    brief: 'Pre-Christmas stock build, post-Christmas cash shortfall, stock finance, MCA; planning finance before seasonal need.' },
  { service: 'Working Capital', keyword: 'how much working capital does my business need',
    title: 'How Much Working Capital Does Your Business Need?',
    slug: 'how-much-working-capital-does-my-business-need',
    brief: 'Current assets minus current liabilities; working capital cycle; days of cover by sector; warning signs; facility sizing.' },
  { service: 'Working Capital', keyword: 'working capital finance vs business loan',
    title: 'Working Capital Finance vs. Business Loan: The Key Differences',
    slug: 'working-capital-finance-vs-business-loan',
    brief: 'Revolving vs fixed repayment; cyclical vs structural need; wrong-product cost consequences.' },
  { service: 'Working Capital', keyword: 'stock finance uk',
    title: 'Stock Finance: Fund Inventory Without Using Your Own Cash',
    slug: 'stock-finance-uk',
    brief: 'How it works, LTV on stock (50-70%), suitable sectors; integration with invoice finance; scenario: food distributor £200k.' },
  { service: 'Working Capital', keyword: 'working capital finance for manufacturers',
    title: 'Working Capital Finance for Manufacturers: Funding the Production Cycle',
    slug: 'working-capital-finance-for-manufacturers',
    brief: 'Raw materials to finished goods funding gap; combining contract, trade, stock and invoice finance; scenario: precision engineer.' },
  { service: 'Working Capital', keyword: 'bank vs alternative lender working capital',
    title: 'Bank vs. Alternative Lender for Working Capital: An Honest Comparison',
    slug: 'bank-vs-alternative-lender-working-capital',
    brief: 'Bank (lower rates, rigid, slow) vs alternative (faster, flexible, more expensive); challenger banks in middle; broker value.' },
  { service: 'Working Capital', keyword: 'signs your business needs working capital finance',
    title: 'Signs Your Business Needs Working Capital Finance (And What to Do)',
    slug: 'signs-business-needs-working-capital-finance',
    brief: 'Early vs advanced warning signs; 8-10 practical indicators; what to do at each stage; case study: waiting too long.' },
  { service: 'Working Capital', keyword: 'working capital for seasonal hospitality',
    title: 'Working Capital Finance for Seasonal Hospitality Businesses',
    slug: 'working-capital-for-seasonal-hospitality',
    brief: 'Peak season income, 12-month costs, pre-season stock and staffing; revolving credit for hospitality; scenario: UK tourism business.' },
  { service: 'Working Capital', keyword: 'working capital cycle explained',
    title: 'The Working Capital Cycle: How to Understand and Manage It',
    slug: 'working-capital-cycle-explained',
    brief: 'Cash-to-cash cycle, debtor days, creditor days, stock days; how to shorten the cycle; finance as a bridge.' },
  { service: 'Working Capital', keyword: 'working capital for export businesses',
    title: 'Working Capital Finance for UK Exporters',
    slug: 'working-capital-for-export-businesses',
    brief: 'Longer cash conversion cycle for exports, UKEF guarantees, export invoice finance, currency considerations.' },
  { service: 'Working Capital', keyword: 'working capital finance for care homes',
    title: 'Working Capital Finance for Care Homes',
    slug: 'working-capital-finance-for-care-homes',
    brief: 'Local authority payment timing, staffing costs, CQC compliance costs; revolving credit and invoice finance for care.' },
  { service: 'Working Capital', keyword: 'working capital finance for construction supply chain',
    title: 'Working Capital Finance for the Construction Supply Chain',
    slug: 'working-capital-for-construction-supply-chain',
    brief: 'Material costs upfront, CIS deductions, retention; combined invoice and trade finance for construction supply.' },
  { service: 'Working Capital', keyword: 'working capital for distribution companies',
    title: 'Working Capital Finance for Distribution Businesses',
    slug: 'working-capital-for-distribution-companies',
    brief: 'Stock purchase, delivery cost timing, customer payment terms; stock finance combined with invoice finance for distributors.' },
  { service: 'Working Capital', keyword: 'working capital for ecommerce businesses',
    title: 'Working Capital Finance for Ecommerce Businesses',
    slug: 'working-capital-for-ecommerce',
    brief: 'Inventory pre-purchase, marketplace payment delays, returns provision; revenue-based finance, stock finance, MCA options.' },
  { service: 'Working Capital', keyword: 'overdraft alternative for small businesses',
    title: 'Bank Overdraft Alternatives for Small Businesses',
    slug: 'overdraft-alternative-for-small-businesses',
    brief: 'Why banks pull overdrafts on review; revolving credit, invoice finance, MCA as alternatives; access without bank relationship.' },
  { service: 'Working Capital', keyword: 'working capital during business acquisition',
    title: 'Working Capital Finance During a Business Acquisition',
    slug: 'working-capital-during-business-acquisition',
    brief: 'Post-acquisition working capital needs, vendor agreement for transition, revolving credit alongside acquisition finance.' },
  { service: 'Working Capital', keyword: 'working capital ratio explained',
    title: 'Working Capital Ratio Explained: What It Tells Lenders About Your Business',
    slug: 'working-capital-ratio-explained',
    brief: 'Current ratio (current assets/current liabilities), healthy ranges by sector, what triggers lender concern.' },
  { service: 'Working Capital', keyword: 'working capital for pharmaceutical businesses',
    title: 'Working Capital Finance for Pharmaceutical and Life Sciences Businesses',
    slug: 'working-capital-for-pharmaceutical',
    brief: 'Long R&D cycles, clinical trial costs, regulatory approval gaps; grant funding alongside working capital.' },
  { service: 'Working Capital', keyword: 'improving debtor days to reduce working capital need',
    title: 'How to Reduce Your Working Capital Needs by Managing Debtor Days',
    slug: 'improving-debtor-days',
    brief: 'Practical steps to cut debtor days (credit checks, payment terms, chasing), impact on facility size required.' },
  { service: 'Working Capital', keyword: 'working capital for agricultural businesses',
    title: 'Working Capital Finance for Agricultural Businesses',
    slug: 'working-capital-for-agricultural-businesses',
    brief: 'Seasonal income, harvest finance, commodity price exposure, AgriFinance products; scenario: arable farm spring input costs.' },
  { service: 'Working Capital', keyword: 'working capital for transport businesses',
    title: 'Working Capital Finance for Transport and Logistics Businesses',
    slug: 'working-capital-for-transport-businesses',
    brief: 'Fuel costs, 45-day client terms, driver payroll; invoice finance and revolving credit for transport operators.' },
  { service: 'Working Capital', keyword: 'working capital for charities and social enterprises',
    title: 'Working Capital Finance for Charities and Social Enterprises',
    slug: 'working-capital-for-charities',
    brief: 'Grant timing vs delivery cost, public sector payment terms; specialist social lenders (Social Investment Business, CAF).' },
  { service: 'Working Capital', keyword: 'negative working capital business',
    title: 'Negative Working Capital: Is It Always a Problem?',
    slug: 'negative-working-capital-business',
    brief: 'When negative working capital is fine (supermarkets, subscription), when it\'s a danger sign; lender views.' },
  { service: 'Working Capital', keyword: 'supply chain disruption working capital',
    title: 'Managing Working Capital During Supply Chain Disruption',
    slug: 'supply-chain-disruption-working-capital',
    brief: 'Stock buffering cost, alternative supplier cash outlay; revolving credit and trade finance for supply chain resilience.' },
  { service: 'Working Capital', keyword: 'working capital finance for printing companies',
    title: 'Working Capital Finance for Printing and Packaging Companies',
    slug: 'working-capital-for-printing-companies',
    brief: 'Paper and consumable costs upfront, 45-60 day payment terms; invoice finance and stock finance for print.' },
  { service: 'Working Capital', keyword: 'working capital facility drawdown explained',
    title: 'How Working Capital Facility Drawdowns Work in Practice',
    slug: 'working-capital-facility-drawdown',
    brief: 'Drawing down, repaying, re-drawing; minimum drawdown amounts; notice periods; impact on available headroom.' },
  { service: 'Working Capital', keyword: 'working capital loan covenants',
    title: 'Working Capital Loan Covenants: What You\'re Agreeing to Keep',
    slug: 'working-capital-loan-covenants',
    brief: 'Financial covenants (DSCR, leverage ratio), information covenants, breach consequences; negotiating covenant headroom.' },

  // ── Trade Finance (33) ───────────────────────────────────────────────────────
  { service: 'Trade Finance', keyword: 'letters of credit explained uk',
    title: 'Letters of Credit Explained: When and Why UK Businesses Use Them',
    slug: 'letters-of-credit-explained-uk',
    brief: 'How LCs work, issuing/confirming banks, documentary requirements; standby LCs vs documentary LCs vs bank guarantees.' },
  { service: 'Trade Finance', keyword: 'trade finance for importers uk',
    title: 'Trade Finance for Importers: Funding the Gap Between Order and Sale',
    slug: 'trade-finance-for-importers-uk',
    brief: 'Importer cashflow problem, import finance, PO finance, stock finance; scenario: UK fashion importer.' },
  { service: 'Trade Finance', keyword: 'supply chain finance uk',
    title: 'Supply Chain Finance: How It Works and Who It\'s For',
    slug: 'supply-chain-finance-uk',
    brief: 'Reverse factoring mechanics, buyer/supplier benefits, SCF fintech platforms, dynamic discounting alternative.' },
  { service: 'Trade Finance', keyword: 'trade finance for exporters uk',
    title: 'Trade Finance for UK Exporters: Getting Paid When Selling Overseas',
    slug: 'trade-finance-for-exporters-uk',
    brief: 'Currency risk, overseas buyer credit risk, UKEF guarantees, export invoice finance, pre-shipment finance.' },
  { service: 'Trade Finance', keyword: 'invoice finance vs trade finance',
    title: 'Invoice Finance vs. Trade Finance: Which Do You Need?',
    slug: 'invoice-finance-vs-trade-finance',
    brief: 'Post-sale (invoice finance) vs pre-sale (trade finance); many businesses need both; combined facility options.' },
  { service: 'Trade Finance', keyword: 'pre shipment finance uk',
    title: 'Pre-Shipment Finance: Funding Production Before the Order Ships',
    slug: 'pre-shipment-finance-uk',
    brief: 'Against firm PO or LC; lender requirements; advance rates (60-80%); combination with post-shipment invoice finance.' },
  { service: 'Trade Finance', keyword: 'trade finance for manufacturers uk',
    title: 'Trade Finance for UK Manufacturers: Funding Raw Materials and Production',
    slug: 'trade-finance-for-manufacturers-uk',
    brief: 'Raw material import cycle, trade finance alongside invoice finance; scenario: small UK components manufacturer.' },
  { service: 'Trade Finance', keyword: 'how to apply for trade finance uk',
    title: 'How to Apply for Trade Finance in the UK',
    slug: 'how-to-apply-for-trade-finance-uk',
    brief: 'Assess the funding gap, identify product type, prepare documents, approach via specialist broker; typical timescales.' },
  { service: 'Trade Finance', keyword: 'trade finance costs uk',
    title: 'Trade Finance Costs: What to Budget For',
    slug: 'trade-finance-costs-uk',
    brief: 'LC fees, import finance margins, export invoice finance costs, UKEF premium; total landed cost including finance.' },
  { service: 'Trade Finance', keyword: 'bonds and guarantees trade finance',
    title: 'Bonds and Guarantees in Trade Finance: A Practical Guide',
    slug: 'bonds-and-guarantees-trade-finance',
    brief: 'Performance bond, advance payment guarantee, bid bond, retention bond; issuers; cost; when each is required.' },
  { service: 'Trade Finance', keyword: 'trade finance for retailers importing goods',
    title: 'Trade Finance for Retailers Importing Goods: Managing the Cash Gap',
    slug: 'trade-finance-for-retailers-importing',
    brief: 'Pay supplier 60-90 days before retail sale; import finance bridging the gap; scenario: UK retailer importing from Asia.' },
  { service: 'Trade Finance', keyword: 'trade finance for food importers',
    title: 'Trade Finance for Food and Beverage Importers',
    slug: 'trade-finance-for-food-importers',
    brief: 'Perishable goods challenges, short shelf life LTV impact, country of origin risk, combined trade and invoice finance.' },
  { service: 'Trade Finance', keyword: 'trade finance for fashion importers',
    title: 'Trade Finance for Fashion and Clothing Importers',
    slug: 'trade-finance-for-fashion-importers',
    brief: 'Seasonal stock builds, long lead times, LC requirements from new overseas suppliers; scenario: UK fashion importer.' },
  { service: 'Trade Finance', keyword: 'trade finance and currency risk',
    title: 'Trade Finance and Currency Risk: Protecting Your Margins',
    slug: 'trade-finance-and-currency-risk',
    brief: 'FX risk on overseas payments, forward contracts alongside trade finance, natural hedging; working with FX specialists.' },
  { service: 'Trade Finance', keyword: 'open account vs letter of credit',
    title: 'Open Account vs. Letter of Credit: Which Is Right for Your Trade?',
    slug: 'open-account-vs-letter-of-credit',
    brief: 'Risk comparison for buyer and seller; when to insist on LC; open account with credit insurance as alternative.' },
  { service: 'Trade Finance', keyword: 'incoterms explained for trade finance',
    title: 'Incoterms Explained: How They Affect Your Trade Finance',
    slug: 'incoterms-explained-trade-finance',
    brief: 'CIF, FOB, DDP and key incoterms; who bears risk and cost at each stage; how incoterms affect finance structures.' },
  { service: 'Trade Finance', keyword: 'trade finance for small businesses uk',
    title: 'Trade Finance for Small Businesses: Is It Accessible to SMEs?',
    slug: 'trade-finance-for-small-businesses',
    brief: 'Historical bank bias towards large corporates; fintech platforms opening up access; minimum transaction sizes.' },
  { service: 'Trade Finance', keyword: 'uk export finance ukef explained',
    title: 'UK Export Finance (UKEF) Explained: What UK Exporters Can Access',
    slug: 'uk-export-finance-ukef-explained',
    brief: 'UKEF products: export working capital, buyer credit, bond support; eligibility; how to access through commercial banks.' },
  { service: 'Trade Finance', keyword: 'digital trade finance platforms uk',
    title: 'Digital Trade Finance Platforms: How Technology Is Changing Trade Lending',
    slug: 'digital-trade-finance-platforms',
    brief: 'Fintech platforms (Stenn, Drip Capital, etc.), speed advantage, SME access, document digitisation, blockchain in trade.' },
  { service: 'Trade Finance', keyword: 'trade finance post brexit imports',
    title: 'Trade Finance for Post-Brexit Imports: What\'s Changed',
    slug: 'trade-finance-post-brexit',
    brief: 'New customs declarations, rules of origin, additional documentary requirements; how trade finance has adapted post-2021.' },
  { service: 'Trade Finance', keyword: 'trade finance credit insurance',
    title: 'Trade Credit Insurance: Protecting Against Buyer Default',
    slug: 'trade-finance-credit-insurance',
    brief: 'How credit insurance works alongside trade finance, COFACE/Euler Hermes/Atradius, coverage, cost, exclusions.' },
  { service: 'Trade Finance', keyword: 'trade finance for pharmaceutical companies',
    title: 'Trade Finance for Pharmaceutical and Medical Supply Companies',
    slug: 'trade-finance-for-pharmaceutical',
    brief: 'Regulatory compliance in transit, cold chain requirements, country-of-origin documentation; specialist lender appetite.' },
  { service: 'Trade Finance', keyword: 'trade finance documentary requirements',
    title: 'Trade Finance Documents: What You Need to Get a Facility',
    slug: 'trade-finance-documentary-requirements',
    brief: 'Commercial invoice, bill of lading, packing list, certificate of origin; what lenders review; common documentation errors.' },
  { service: 'Trade Finance', keyword: 'trade finance for automotive parts',
    title: 'Trade Finance for Automotive Parts and Components',
    slug: 'trade-finance-for-automotive',
    brief: 'JIT supply chain finance, tier 1/2 supplier relationships, OEM payment terms; combined trade and invoice finance.' },
  { service: 'Trade Finance', keyword: 'trade finance red flags and fraud prevention',
    title: 'Trade Finance Fraud: Red Flags and How to Protect Your Business',
    slug: 'trade-finance-fraud-prevention',
    brief: 'Document fraud, phantom shipments, double financing; lender and broker due diligence; what genuine transactions look like.' },
  { service: 'Trade Finance', keyword: 'trade finance for building materials',
    title: 'Trade Finance for Building Materials Importers',
    slug: 'trade-finance-for-building-materials',
    brief: 'Timber, steel, concrete imports; port delays and storage costs; import finance for construction material traders.' },
  { service: 'Trade Finance', keyword: 'how to choose a trade finance broker',
    title: 'How to Choose a Trade Finance Broker: What to Look For',
    slug: 'how-to-choose-trade-finance-broker',
    brief: 'Specialist vs generalist, lender panel depth, transaction experience, fee structure; questions to ask before engaging.' },
  { service: 'Trade Finance', keyword: 'trade finance for technology importers',
    title: 'Trade Finance for Technology and Electronics Importers',
    slug: 'trade-finance-for-technology-importers',
    brief: 'Fast depreciation on tech goods, warranty and return risk, customs duty; import finance for electronics traders.' },
  { service: 'Trade Finance', keyword: 'trade finance for Asian imports',
    title: 'Trade Finance for Importing from Asia: China, India and Beyond',
    slug: 'trade-finance-for-asian-imports',
    brief: 'Country risk, LC requirements for new suppliers, shipping timelines, customs and duties; structuring Asia import finance.' },

  // ── Cashflow Finance (33) ─────────────────────────────────────────────────────
  { service: 'Cashflow Finance', keyword: 'business overdraft vs cashflow finance',
    title: 'Business Overdraft vs. Cashflow Finance: The Honest Comparison',
    slug: 'business-overdraft-vs-cashflow-finance',
    brief: 'Bank overdraft (relationship risk, annual review) vs cashflow finance (higher limits, more stable); cost and availability.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for professional services',
    title: 'Cashflow Finance for Professional Services Firms',
    slug: 'cashflow-finance-for-professional-services',
    brief: 'Quarterly income patterns, retainer clients, SRA accounts rules for solicitors; confidential invoice discounting suits.' },
  { service: 'Cashflow Finance', keyword: 'revenue based finance uk',
    title: 'Revenue-Based Finance: How It Works for Growing UK Businesses',
    slug: 'revenue-based-finance-uk',
    brief: 'Advance against future revenue, repaid as % of monthly receipts, no fixed term; suits SaaS/subscription/ecommerce.' },
  { service: 'Cashflow Finance', keyword: 'cash flow forecast for business finance',
    title: 'How a Cash Flow Forecast Helps You Get Better Finance',
    slug: 'cash-flow-forecast-business-finance',
    brief: 'How lenders use forecasts, how to build a 12-month forecast, common mistakes, link to right facility size.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for seasonal businesses',
    title: 'Cashflow Finance for Seasonal Businesses: Smoothing the Peaks',
    slug: 'cashflow-finance-for-seasonal-businesses',
    brief: 'Annual income in 3-4 months, 12-month costs; revolving credit, stock finance; scenario: UK tourism business.' },
  { service: 'Cashflow Finance', keyword: 'emergency cashflow finance uk',
    title: 'Emergency Cashflow Finance: Options When You Need Funds Fast',
    slug: 'emergency-cashflow-finance-uk',
    brief: 'Options by speed: same-day (MCA, instant invoice), 24-48hrs (revolving credit), 3-5 days (mainstream invoice finance).' },
  { service: 'Cashflow Finance', keyword: 'what is cashflow finance',
    title: 'What Is Cashflow Finance? A Plain-English Guide for UK Businesses',
    slug: 'what-is-cashflow-finance',
    brief: 'Umbrella term for products that smooth cashflow timing gaps; how it differs from growth or capital investment finance.' },
  { service: 'Cashflow Finance', keyword: 'cashflow problems in small businesses uk',
    title: 'Cashflow Problems in Small Businesses: Causes and Solutions',
    slug: 'cashflow-problems-small-businesses',
    brief: 'Common causes (late payments, rapid growth, seasonal demand), early warning signs, appropriate solutions for each.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for tradespeople',
    title: 'Cashflow Finance for Tradespeople: Managing the Payment Gap',
    slug: 'cashflow-finance-for-tradespeople',
    brief: 'Materials upfront, 30-day payment terms; invoice finance for B2B trades; MCA for mixed B2B/B2C; scenario: plumber.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for dental practices',
    title: 'Cashflow Finance for Dental Practices',
    slug: 'cashflow-finance-for-dental-practices',
    brief: 'NHS payment lag vs private treatment; equipment finance alongside cashflow; scenario: mixed practice funding gap.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for construction companies',
    title: 'Cashflow Finance for Construction Companies',
    slug: 'cashflow-finance-for-construction',
    brief: 'CIS deductions, retentions, application for payment timing; invoice finance, overdraft, and revolving credit for construction.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for transport and logistics',
    title: 'Cashflow Finance for Transport and Logistics Businesses',
    slug: 'cashflow-finance-for-transport',
    brief: 'Fuel costs, driver wages, 30-45 day client terms; invoice finance and revolving credit for transport operators.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for NHS suppliers',
    title: 'Cashflow Finance for NHS and Public Sector Suppliers',
    slug: 'cashflow-finance-for-nhs-suppliers',
    brief: 'NHS payment terms (often 30-60 days), approved supplier status, invoice discounting against NHS debtors.' },
  { service: 'Cashflow Finance', keyword: 'how to improve business cashflow',
    title: 'How to Improve Business Cashflow: Practical Steps That Actually Work',
    slug: 'how-to-improve-business-cashflow',
    brief: 'Debtor days reduction, creditor terms renegotiation, stock management; finance as last resort after operational fixes.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for social enterprises',
    title: 'Cashflow Finance for Social Enterprises and Community Organisations',
    slug: 'cashflow-finance-for-social-enterprises',
    brief: 'Grant delay vs service delivery, public sector contracts; Social Investment Business, CAF, specialist impact lenders.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for technology companies',
    title: 'Cashflow Finance for Technology Companies and SaaS Businesses',
    slug: 'cashflow-finance-for-technology-companies',
    brief: 'Annual subscription revenue, monthly cost base; revenue-based finance vs invoice discounting for ARR-based SaaS.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for property businesses',
    title: 'Cashflow Finance for Property Businesses and Letting Agents',
    slug: 'cashflow-finance-for-property-businesses',
    brief: 'Letting agent float, maintenance spend vs rent collection; revolving credit for property management businesses.' },
  { service: 'Cashflow Finance', keyword: 'hmrc time to pay arrangement',
    title: 'HMRC Time to Pay: How It Works and When to Use It',
    slug: 'hmrc-time-to-pay-arrangement',
    brief: 'Eligibility, how to apply, interest and penalties, interaction with other borrowing; when to use vs cashflow finance.' },
  { service: 'Cashflow Finance', keyword: 'managing vat cashflow uk',
    title: 'Managing VAT Cashflow: How UK Businesses Fund Their Quarterly Bill',
    slug: 'managing-vat-cashflow',
    brief: 'VAT loan (bridging the quarter), Annual Accounting Scheme, Cash Accounting Scheme; options for businesses with VAT cashflow pressure.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for media businesses',
    title: 'Cashflow Finance for Media and Creative Businesses',
    slug: 'cashflow-finance-for-media-businesses',
    brief: 'Project billing gaps, production cost front-loading, 60-day client payment terms; confidential invoice discounting.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for legal practices',
    title: 'Cashflow Finance for Legal Practices: Managing Disbursements and Billing',
    slug: 'cashflow-finance-for-legal-practices',
    brief: 'Disbursement finance, billing lag on litigation matters, SRA accounts rules compliance; specialist legal cashflow lenders.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for estate agencies',
    title: 'Cashflow Finance for Estate Agents and Letting Agents',
    slug: 'cashflow-finance-for-estate-agencies',
    brief: 'Commission on completion timing vs monthly costs; client money rules; revolving credit and MCA for agency businesses.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for recruitment businesses',
    title: 'Cashflow Finance for Recruitment Businesses: Weekly Pay, Monthly Billing',
    slug: 'cashflow-finance-for-recruitment',
    brief: 'Weekly contractor payroll vs 30-day client billing; specialist recruitment invoice finance; HMRC compliance costs.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for engineering firms',
    title: 'Cashflow Finance for Engineering Firms: Project Billing and Costs',
    slug: 'cashflow-finance-for-engineering-firms',
    brief: 'Long project cycles, milestone billing, materials upfront; invoice finance and revolving credit for engineering businesses.' },
  { service: 'Cashflow Finance', keyword: 'cash flow projection for finance applications',
    title: 'How to Build a Cash Flow Projection That Lenders Trust',
    slug: 'cash-flow-projection-finance-applications',
    brief: 'Monthly format, actuals + forward assumptions, sensitivity analysis; how a strong forecast gets better terms.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for hospitality recovery',
    title: 'Cashflow Finance for Hospitality Businesses: Recovery and Growth',
    slug: 'cashflow-finance-for-hospitality-recovery',
    brief: 'Post-pandemic trading history, lender appetite recovery, energy cost context; revolving credit, MCA for hospitality.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for start up businesses',
    title: 'Cashflow Finance for Startups: What\'s Actually Available?',
    slug: 'cashflow-finance-for-startups',
    brief: 'Limited trading history options, Start Up Loans, MCA if card revenue exists, invoice finance for B2B startups.' },
  { service: 'Cashflow Finance', keyword: 'cashflow warning signs for business owners',
    title: 'Cashflow Warning Signs Every Business Owner Should Know',
    slug: 'cashflow-warning-signs',
    brief: 'Eight warning signs from early (stretching creditors) to critical (bounced payments); recommended action at each stage.' },
  { service: 'Cashflow Finance', keyword: 'cashflow finance for freelancers and contractors',
    title: 'Cashflow Finance for Freelancers and Contractors',
    slug: 'cashflow-finance-for-freelancers',
    brief: 'Variable income, late client payments, tax savings timing; invoice finance for limited company contractors; IR35 context.' },

  // ── Mezzanine Finance (33) ────────────────────────────────────────────────────
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance explained uk',
    title: 'Mezzanine Finance Explained: When Senior Debt Isn\'t Enough',
    slug: 'mezzanine-finance-explained-uk',
    brief: 'Capital stack position, two main forms (debt mezz vs preferred equity), typical uses (acquisition, development, MBO).' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine vs equity finance',
    title: 'Mezzanine vs. Equity: What\'s the Real Cost of Each?',
    slug: 'mezzanine-vs-equity-finance',
    brief: 'Cost (15-20% for mezz) vs dilution; break-even analysis; MBO case study where mezz preserves management equity.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance in property transactions',
    title: 'Mezzanine Finance in Property: Using It to Increase Leverage',
    slug: 'mezzanine-finance-property-transactions',
    brief: 'Senior 65% + mezz to 80% LTGDV; intercreditor deed; combined cost vs JV; track record requirements.' },
  { service: 'Mezzanine Finance', keyword: 'how mezzanine finance is priced',
    title: 'How Mezzanine Finance Is Priced: Interest, Fees and Warrants',
    slug: 'how-mezzanine-finance-is-priced',
    brief: 'PIK vs cash-pay interest, arrangement fee (2-4%), exit fee (1-3%), warrants; total cost modelling over 3-year hold.' },
  { service: 'Mezzanine Finance', keyword: 'when to consider mezzanine finance',
    title: 'When to Consider Mezzanine Finance: Five Scenarios Where It Makes Sense',
    slug: 'when-to-consider-mezzanine-finance',
    brief: 'Acquisition, property development, MBO equity gap, growth without dilution, bridge between debt pay-down and exit.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for mbo transactions',
    title: 'Mezzanine Finance for Management Buyouts: Filling the Equity Gap',
    slug: 'mezzanine-finance-for-mbo',
    brief: 'Management team equity constraint, mezz behind senior acquisition debt, retained earnings as equity; typical MBO structure.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for acquisitions',
    title: 'Mezzanine Finance for Acquisitions: How It Fits the Capital Structure',
    slug: 'mezzanine-finance-for-acquisitions',
    brief: 'Senior debt + mezz + equity in acquisition; when EBITDA supports senior debt; mezz fills remaining gap; cost of capital.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance vs second charge loan',
    title: 'Mezzanine Finance vs. Second Charge: What\'s the Difference?',
    slug: 'mezzanine-finance-vs-second-charge',
    brief: 'Second charge is asset security; mezz is typically unsecured or deeply subordinated; use cases and cost comparison.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for hotel acquisitions',
    title: 'Mezzanine Finance for Hotel Acquisitions',
    slug: 'mezzanine-finance-for-hotel-acquisitions',
    brief: 'RevPAR-based senior debt limit; mezz to increase leverage; operator agreement context; cost vs equity partner.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for retail property',
    title: 'Mezzanine Finance for Retail Property Investment',
    slug: 'mezzanine-finance-for-retail-property',
    brief: 'Cautious senior LTV for retail (55-60%); mezz bridges to 75-80%; covenant strength; scenario: regional shopping centre.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for student accommodation',
    title: 'Mezzanine Finance for Student Accommodation Development',
    slug: 'mezzanine-finance-for-student-accommodation',
    brief: 'PBSA development capital stack; forward-funding reduces mezz need; when mezz is appropriate vs JV equity.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for care homes',
    title: 'Mezzanine Finance for Care Home Acquisition and Development',
    slug: 'mezzanine-finance-for-care-homes',
    brief: 'CQC, EBITDA per bed, senior LTV limits; mezz fills gap to 80%; operator track record requirements.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine lenders uk',
    title: 'Mezzanine Finance Lenders in the UK: Who Are They?',
    slug: 'mezzanine-lenders-uk',
    brief: 'Debt funds, family offices, specialist mezz providers; who operates at what deal size; how a broker finds the right one.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance interest rates uk',
    title: 'Mezzanine Finance Interest Rates: What to Expect in the UK',
    slug: 'mezzanine-finance-interest-rates',
    brief: 'Current rate environment, typical all-in cost (15-25%), how risk profile affects pricing; PIK vs cash element mix.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance risks for developers',
    title: 'Mezzanine Finance: Understanding the Risks for Property Developers',
    slug: 'mezzanine-finance-risks-developers',
    brief: 'Enforcement position behind senior lender, additional reporting obligations, equity kicker dilution risk; mitigation.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance intercreditor deed',
    title: 'The Intercreditor Deed in Mezzanine Finance: What It Means for You',
    slug: 'mezzanine-finance-intercreditor-deed',
    brief: 'Relationship between senior and mezz lender, standstill provisions, enforcement rights, cure rights; legal cost context.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance equity kicker',
    title: 'Equity Kickers and Warrants in Mezzanine Finance',
    slug: 'mezzanine-finance-equity-kicker',
    brief: 'How warrants work (small % equity for lower coupon), value at exit, how to negotiate kicker size; PIK alternative.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance exit strategy',
    title: 'Mezzanine Finance Exit: How Lenders Get Their Money Back',
    slug: 'mezzanine-finance-exit-strategy',
    brief: 'Sale, refinance, recapitalisation; typical hold period (2-5 years); what happens if primary exit is delayed.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance vs bridging finance',
    title: 'Mezzanine Finance vs. Bridging Finance: Which Do You Need?',
    slug: 'mezzanine-finance-vs-bridging-finance',
    brief: 'Bridging = short-term asset-led; mezz = subordinated debt in structured capital stack; use cases and cost comparison.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for commercial property',
    title: 'Mezzanine Finance for Commercial Property Investment',
    slug: 'mezzanine-finance-for-commercial-property',
    brief: 'Senior LTV limits on commercial, mezz fills to 80%; tenant covenant and lease quality still matter; lender appetite.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for ground up development',
    title: 'Mezzanine Finance for Ground-Up Property Development',
    slug: 'mezzanine-finance-for-ground-up-development',
    brief: 'Senior 65% LTGDV + mezz to 80-85%; lender quality requirements; intercreditor; combined cost vs equity route.' },
  { service: 'Mezzanine Finance', keyword: 'debt mezzanine vs preferred equity',
    title: 'Debt Mezzanine vs. Preferred Equity: Two Flavours of the Same Solution',
    slug: 'debt-mezzanine-vs-preferred-equity',
    brief: 'Debt mezz (loan with warrants) vs pref equity (quasi-equity structure); accounting treatment; investor preferences.' },
  { service: 'Mezzanine Finance', keyword: 'unitranche finance vs mezzanine',
    title: 'Unitranche Finance vs. Mezzanine: When One Lender Is Simpler',
    slug: 'unitranche-vs-mezzanine',
    brief: 'Unitranche = single lender replaces senior + mezz; simpler, faster; slightly higher blended rate; deal size context.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance minimum deal size',
    title: 'Mezzanine Finance: Is Your Deal Big Enough?',
    slug: 'mezzanine-finance-minimum-deal-size',
    brief: 'Typical minimums (£1m+ for most mezz lenders); who works at smaller ticket sizes; broker access to wider market.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance due diligence',
    title: 'What Does Mezzanine Finance Due Diligence Look Like?',
    slug: 'mezzanine-finance-due-diligence',
    brief: 'Financial models, legal structure, exit analysis, reporting requirements post-close; timeline and cost expectations.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for mixed use development',
    title: 'Mezzanine Finance for Mixed-Use Development Schemes',
    slug: 'mezzanine-finance-for-mixed-use-development',
    brief: 'Blended GDV calculation, residential and commercial tranches, intercreditor with senior lender; mezz sizing.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for self storage',
    title: 'Mezzanine Finance for Self Storage Development and Acquisition',
    slug: 'mezzanine-finance-for-self-storage',
    brief: 'Self storage NOI-based valuation, senior LTV limits, mezz fills equity gap; lender appetite for operational vs development.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for co-living',
    title: 'Mezzanine Finance for Co-Living Developments',
    slug: 'mezzanine-finance-for-co-living',
    brief: 'Co-living planning context, GDV methodology (yield vs comparable), senior + mezz stack; forward-funding alternative.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance covenants',
    title: 'Mezzanine Finance Covenants: What You\'re Agreeing to Keep',
    slug: 'mezzanine-finance-covenants',
    brief: 'Loan-to-value tests, ICR covenants, reporting requirements, restricted payments; breach consequences and cure rights.' },
  { service: 'Mezzanine Finance', keyword: 'mezzanine finance for residential development',
    title: 'Mezzanine Finance for Residential Property Development',
    slug: 'mezzanine-finance-for-residential-development',
    brief: 'Combined senior + mezz to 85% LTGDV; lender track record requirements; intercreditor; total cost model.' },

  // ── Structured Finance (33) ───────────────────────────────────────────────────
  { service: 'Structured Finance', keyword: 'structured finance vs traditional lending',
    title: 'Structured Finance vs. Traditional Lending: When You Need a Bespoke Solution',
    slug: 'structured-finance-vs-traditional-lending',
    brief: 'Multiple tranches, bespoke security, SPVs; when it adds genuine value vs unnecessary complexity; who arranges it.' },
  { service: 'Structured Finance', keyword: 'special purpose vehicles property finance',
    title: 'Special Purpose Vehicles in Property Finance: What They Are and Why They\'re Used',
    slug: 'special-purpose-vehicles-property-finance',
    brief: 'SPV structure, ring-fencing, SDLT efficiency, lender and investor preference; common property uses; regulatory context.' },
  { service: 'Structured Finance', keyword: 'whole loan finance property',
    title: 'Whole Loan Finance: An Alternative to Traditional Development Lending',
    slug: 'whole-loan-finance-property',
    brief: 'Single lender replaces senior + mezz; simpler, faster, no intercreditor; cost vs layered structure; lender appetite.' },
  { service: 'Structured Finance', keyword: 'stretched senior finance property',
    title: 'Stretched Senior Finance: Getting More LTV from a Single Lender',
    slug: 'stretched-senior-finance-property',
    brief: 'Fills gap between standard senior (65%) and whole loan (80-85%); priced between senior and mezz; who offers it.' },
  { service: 'Structured Finance', keyword: 'structured finance for complex property transactions',
    title: 'How Structured Finance Works for Complex Property Transactions',
    slug: 'structured-finance-complex-property-transactions',
    brief: 'Walk through mixed-use development with JV equity, senior + mezz debt, forward sale; broker role; timeline; who it suits.' },
  { service: 'Structured Finance', keyword: 'debt capital stack explained',
    title: 'The Debt Capital Stack Explained: Senior, Mezzanine and Equity',
    slug: 'debt-capital-stack-explained',
    brief: 'Each tranche: risk, return, priority on default; how to optimise the stack for cost; investor and lender perspectives.' },
  { service: 'Structured Finance', keyword: 'senior debt vs subordinated debt',
    title: 'Senior Debt vs. Subordinated Debt: What\'s the Difference?',
    slug: 'senior-debt-vs-subordinated-debt',
    brief: 'Priority of repayment, security rights, typical rates for each; where mezz, junior debt and equity sit below senior.' },
  { service: 'Structured Finance', keyword: 'structured finance for acquisitions uk',
    title: 'Structured Finance for Acquisitions: When a Simple Loan Isn\'t Enough',
    slug: 'structured-finance-for-acquisitions',
    brief: 'Layered debt for complex acquisitions; senior acquisition finance + mezz + vendor loan note; LBO context.' },
  { service: 'Structured Finance', keyword: 'structured finance for infrastructure projects',
    title: 'Structured Finance for Infrastructure Projects in the UK',
    slug: 'structured-finance-for-infrastructure',
    brief: 'Project finance ring-fencing, DSCR-based lending, government-backed projects, concession agreements; UK infrastructure context.' },
  { service: 'Structured Finance', keyword: 'structured finance for renewable energy uk',
    title: 'Structured Finance for Renewable Energy Projects',
    slug: 'structured-finance-for-renewable-energy',
    brief: 'Project finance for solar/wind/battery; revenue visibility (PPA, CfD, ROC), senior + mezz + equity stack; UK green finance.' },
  { service: 'Structured Finance', keyword: 'structured finance for portfolio acquisitions',
    title: 'Structured Finance for Property Portfolio Acquisitions',
    slug: 'structured-finance-for-portfolio-acquisitions',
    brief: 'Bulk discount pricing, per-asset security, portfolio reporting covenants; structured debt for large property portfolios.' },
  { service: 'Structured Finance', keyword: 'structured finance for large mbos',
    title: 'Structured Finance for Large Management Buyouts',
    slug: 'structured-finance-for-large-mbos',
    brief: 'Leveraged buyout structure: senior + mezz + equity; EBITDA multiples; management equity programme; debt service.' },
  { service: 'Structured Finance', keyword: 'structured finance for cross border transactions',
    title: 'Structured Finance for Cross-Border Transactions',
    slug: 'structured-finance-cross-border',
    brief: 'Multi-jurisdiction security, legal complexity, currency risk, governing law; UK-based structured finance for overseas assets.' },
  { service: 'Structured Finance', keyword: 'securitisation explained uk',
    title: 'Securitisation Explained: How It Works for UK Businesses',
    slug: 'securitisation-explained-uk',
    brief: 'Pooling assets (mortgages, loans, leases) into ABS; SPV structure; investor tranches; when securitisation is relevant to SMEs.' },
  { service: 'Structured Finance', keyword: 'loan syndication how it works',
    title: 'Loan Syndication: How Multiple Lenders Fund a Single Transaction',
    slug: 'loan-syndication-how-it-works',
    brief: 'Arranger, agent bank, syndicate members; why lenders syndicate (risk diversification); borrower perspective on club deals.' },
  { service: 'Structured Finance', keyword: 'club deal finance explained',
    title: 'Club Deal Finance: When a Group of Lenders Fund Together',
    slug: 'club-deal-finance-explained',
    brief: 'Small syndication (2-5 lenders), equal participation, no lead bank; typical deal sizes; speed vs formal syndication.' },
  { service: 'Structured Finance', keyword: 'structured finance for care home portfolios',
    title: 'Structured Finance for Care Home Portfolios',
    slug: 'structured-finance-for-care-home-portfolios',
    brief: 'Portfolio-level CQC risk, per-home EBITDA, cross-collateralisation; structured debt for multi-site care operators.' },
  { service: 'Structured Finance', keyword: 'structured finance for hotel portfolios',
    title: 'Structured Finance for Hotel Portfolio Investments',
    slug: 'structured-finance-for-hotel-portfolios',
    brief: 'Portfolio RevPAR, brand mix, management agreements; club deal or syndication for large hotel acquisitions.' },
  { service: 'Structured Finance', keyword: 'unitranche finance explained',
    title: 'Unitranche Finance Explained: One Loan, One Lender, One Agreement',
    slug: 'unitranche-finance-explained',
    brief: 'How unitranche blends senior and junior pricing, agreement among lenders (AAL), borrower simplicity; deal size context.' },
  { service: 'Structured Finance', keyword: 'pik interest in structured finance',
    title: 'PIK Interest in Structured Finance: What It Means and When It\'s Used',
    slug: 'pik-interest-structured-finance',
    brief: 'PIK = accrues, not paid in cash; adds to loan balance; used in mezz and HY bonds; true cost at exit; why borrowers accept it.' },
  { service: 'Structured Finance', keyword: 'structured finance for build to rent portfolios',
    title: 'Structured Finance for Build-to-Rent Portfolio Development',
    slug: 'structured-finance-for-build-to-rent',
    brief: 'Forward-funded BTR, institutional investor capital stacks; senior + mezz for developer-controlled BTR; yield on completion.' },
  { service: 'Structured Finance', keyword: 'structured finance for logistics and warehousing',
    title: 'Structured Finance for Logistics and Warehousing Assets',
    slug: 'structured-finance-for-logistics',
    brief: 'Strong lender appetite for logistics (long leases, strong covenants); sale and leaseback, club deal, REIT-level structuring.' },
  { service: 'Structured Finance', keyword: 'structured finance for overseas investors in uk',
    title: 'Structured Finance for Overseas Investors in UK Property',
    slug: 'structured-finance-for-overseas-investors',
    brief: 'Non-UK entity structures, withholding tax, UK lender comfort with overseas holding vehicles; due diligence requirements.' },
  { service: 'Structured Finance', keyword: 'structured finance term sheet negotiation',
    title: 'Structured Finance Term Sheets: What to Push Back On',
    slug: 'structured-finance-term-sheet-negotiation',
    brief: 'Key terms to negotiate: ERC, margin ratchet, reporting covenants, cure rights, equity kicker size; broker role in negotiation.' },
  { service: 'Structured Finance', keyword: 'structured finance legal documentation',
    title: 'Structured Finance Legal Documentation: What You\'ll Sign',
    slug: 'structured-finance-legal-documentation',
    brief: 'Facility agreement, security documents, intercreditor deed, information undertakings; legal cost expectations for structured deals.' },
  { service: 'Structured Finance', keyword: 'structured finance for student accommodation portfolios',
    title: 'Structured Finance for Student Accommodation Portfolios',
    slug: 'structured-finance-for-student-accommodation-portfolios',
    brief: 'PBSA portfolio valuation, university partnership agreements, forward-funding from institutional investors; senior + mezz stack.' },
  { service: 'Structured Finance', keyword: 'structured finance for co investment',
    title: 'Structured Finance for Co-Investment Structures',
    slug: 'structured-finance-for-co-investment',
    brief: 'Club equity + structured debt; investor alignment, preferred return waterfall, co-invest agreements; typical structures.' },
  { service: 'Structured Finance', keyword: 'structured finance working with advisors',
    title: 'Working with Advisors on Structured Finance Transactions',
    slug: 'structured-finance-working-with-advisors',
    brief: 'Finance broker, solicitor, accountant and valuer roles; who does what and when; cost budgeting for complex transactions.' },
  { service: 'Structured Finance', keyword: 'bilateral vs syndicated loan',
    title: 'Bilateral vs. Syndicated Loans: What\'s the Difference?',
    slug: 'bilateral-vs-syndicated-loan',
    brief: 'One lender (bilateral) vs multiple lenders (syndicated); relationship, pricing, flexibility differences; when to go each route.' },
  { service: 'Structured Finance', keyword: 'structured finance for mixed portfolio',
    title: 'Structured Finance for Mixed Asset Portfolios',
    slug: 'structured-finance-for-mixed-portfolio',
    brief: 'Blended security package across commercial, residential, development assets; cross-default provisions; portfolio lender appetite.' },
];

// ─── UK Cities (166 total) ────────────────────────────────────────────────────

const CITIES_TIER1 = [
  'London', 'Birmingham', 'Manchester', 'Leeds', 'Sheffield',
  'Bristol', 'Liverpool', 'Edinburgh', 'Glasgow', 'Cardiff',
];

const CITIES_TIER2 = [
  'Newcastle upon Tyne', 'Nottingham', 'Leicester', 'Coventry', 'Bradford',
  'Belfast', 'Southampton', 'Portsmouth', 'Brighton', 'Hull',
  'Reading', 'Milton Keynes', 'Stoke-on-Trent', 'Wolverhampton', 'Derby',
  'Plymouth', 'Sunderland', 'Middlesbrough', 'Exeter', 'Norwich',
];

const CITIES_TIER3 = [
  'Cambridge', 'Oxford', 'Swansea', 'Aberdeen', 'Dundee',
  'Bath', 'Gloucester', 'Cheltenham', 'Peterborough', 'Luton',
  'Northampton', 'Wigan', 'Bolton', 'Stockport', 'Wakefield',
  'Huddersfield', 'York', 'Doncaster', 'Rotherham', 'Preston',
  'Blackpool', 'Blackburn', 'Lancaster', 'Carlisle', 'Chester',
  'Warrington', 'Shrewsbury', 'Worcester', 'Telford', 'Ipswich',
];

const CITIES_TIER4 = [
  'Bournemouth', 'Poole', 'Swindon', 'Salisbury', 'Basingstoke',
  'Guildford', 'Woking', 'Crawley', 'Maidstone', 'Canterbury',
  'Hastings', 'Eastbourne', 'Worthing', 'Chichester', 'Tunbridge Wells',
  'Folkestone', 'Dover', 'Colchester', 'Chelmsford', 'Basildon',
  'Southend-on-Sea', 'Bury St Edmunds', 'Lowestoft', 'Great Yarmouth', 'Taunton',
  'Yeovil', 'Weston-super-Mare', 'Torquay', 'Truro', 'Newport',
  'Wrexham', 'Inverness', 'Perth', 'Stirling', 'Livingston',
  'Falkirk', 'Paisley', 'Kilmarnock', 'Ayr', 'Motherwell',
  'Dumfries', 'Gateshead', 'Hartlepool', 'Darlington', 'Durham',
  'Stockton-on-Tees', 'Barrow-in-Furness', 'Southport', 'Runcorn', 'Macclesfield',
  'Crewe', 'Hereford', 'Stroud', 'Redditch', 'Kidderminster',
  'Solihull', 'Leamington Spa', 'Stratford-upon-Avon', 'Kettering', 'Wellingborough',
  'Corby', 'Loughborough', 'Mansfield', 'Newark-on-Trent', 'Grantham',
  'Scunthorpe', 'Beverley', 'Scarborough', 'Whitby', 'Harrogate',
  'Skipton', 'Keighley', 'Burnley', 'Oldham', 'Rochdale',
  'Halifax', 'Dewsbury', 'Barnsley', 'Chesterfield', 'Burton upon Trent',
  'Tamworth', 'Lichfield', 'Stafford', 'Nuneaton', 'Rugby',
  'Bury', 'St Helens', 'Widnes', 'Ellesmere Port', 'Llandudno',
  'Bangor', 'Harlow', 'Watford', 'Stevenage', 'Bedford',
  'St Albans', 'Hemel Hempstead', 'Slough', 'Windsor', 'Bracknell',
  'Aldershot', 'Farnborough', 'Horsham', 'Redhill', 'Bognor Regis',
  'Littlehampton',
];

const ALL_CITIES = [...CITIES_TIER1, ...CITIES_TIER2, ...CITIES_TIER3, ...CITIES_TIER4];

// All 11 services for location pages (11 × 166 = 1,826 pages)
const LOCATION_SERVICES = [
  'Business Loans',
  'Asset Finance',
  'Invoice Finance',
  'Bridging Finance',
  'Commercial Mortgage',
  'Development Finance',
  'Working Capital',
  'Trade Finance',
  'Cashflow Finance',
  'Mezzanine Finance',
  'Structured Finance',
];

// ─── Services covered by the Keyword_Backlog ─────────────────────────────────
// For these 6 services we read topics from the Keyword_Backlog tab.
// The remaining 5 services use the hardcoded BLOG_TOPICS above.
const BACKLOG_SERVICES = new Set([
  'Business Loans', 'Asset Finance', 'Invoice Finance',
  'Bridging Finance', 'Commercial Mortgages', 'Working Capital',
]);

// Map sheet service names → our SERVICE_META keys
const SERVICE_NAME_MAP = {
  'Business Loans':      'Business Loans',
  'Asset Finance':       'Asset Finance',
  'Invoice Finance':     'Invoice Finance',
  'Bridging Finance':    'Bridging Finance',
  'Commercial Mortgages':'Commercial Mortgage',
  'Working Capital':     'Working Capital',
};

// ─── Load blog topics from Keyword_Backlog tab ────────────────────────────────
async function loadKeywordBacklog(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Keyword_Backlog!A2:H',
  });
  const rows = res.data.values || [];
  console.log(`  Keyword_Backlog: ${rows.length} keywords loaded from sheet`);

  // Sort: scheduled-year1 before backlog, priority 1 before 2 before 3
  const PRIORITY_ORDER = { '1': 0, '2': 1, '3': 2 };
  const STATUS_ORDER   = { 'scheduled-year1': 0, 'backlog': 1 };

  return rows
    .filter(r => r[1] && r[2]) // must have service and keyword
    .map(r => ({
      sheetService: r[1],
      service:      SERVICE_NAME_MAP[r[1]] || r[1],
      keyword:      (r[2] || '').toLowerCase().trim(),
      cluster:      r[3] || '',
      priority:     r[4] || '3',
      status:       r[5] || 'backlog',
    }))
    .sort((a, b) => {
      const sDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (sDiff !== 0) return sDiff;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    })
    .map(r => {
      const titleWords = r.keyword.split(' ');
      const title = titleWords.map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
      const slug  = r.keyword.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '-').replace(/-{2,}/g, '-');
      return {
        service: r.service,
        keyword: r.keyword,
        title,
        slug,
        brief: `Comprehensive UK guide on "${r.keyword}" for UK business owners seeking ${r.service.toLowerCase()} solutions. Cover what it is, how it works, eligibility, rates, and why Boxx Commercial Finance is the right broker. Target 1,200+ words with FAQ schema.`,
      };
    });
}

// ─── Load cities from UK_Places tab ──────────────────────────────────────────
async function loadUKPlaces(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'UK_Places!A2:E',
  });
  const rows = res.data.values || [];
  console.log(`  UK_Places: ${rows.length} cities loaded from sheet`);
  // Columns: Rank, Place, Country/Area, Priority, SlugHint
  return rows
    .filter(r => r[1]) // must have a place name
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0])) // sort by rank
    .map(r => r[1]); // return city names
}

// ─── Google Sheets auth ───────────────────────────────────────────────────────

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Read existing rows ───────────────────────────────────────────────────────

async function readExistingRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  return res.data.values || [];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── Build a blog row (29 columns A–AC) ──────────────────────────────────────

function buildBlogRow(id, date, topic) {
  const meta = SERVICE_META[topic.service] || {};
  const metaTitle = `${topic.title} | Boxx Commercial Finance`;
  return [
    String(id),                       // A: id
    'blog',                           // B: type
    'scheduled',                      // C: status
    date,                             // D: publishDate
    'AM',                             // E: publishSlot
    topic.service,                    // F: service
    '',                               // G: city (not applicable for blogs)
    topic.keyword,                    // H: keyword
    '',                               // I: topic
    topic.title,                      // J: title
    topic.slug,                       // K: slug
    '',                               // L: url (filled after publish)
    metaTitle,                        // M: metaTitle
    '',                               // N: metaDescription (generated by GPT)
    meta.category || topic.service,   // O: category
    topic.brief || '',                // P: contentBrief
    meta.serviceUrl || '',            // Q: internalLinkService
    '', '', '',                       // R, S, T: internalLinkCity1-3
    '', '', '',                       // U, V, W: relatedBlog1-3
    'yes',                            // X: faqRequired
    'yes',                            // Y: linkedInRequired
    meta.author || 'Mark Higgins',    // Z: author
    '',                               // AA: jsonStatus
    '',                               // AB: publishedAt
    '',                               // AC: notes
  ];
}

// ─── Build a location row (29 columns A–AC) ───────────────────────────────────

function buildLocationRow(id, date, service, city) {
  const meta = SERVICE_META[service] || {};
  const serviceSlug = meta.slug || service.toLowerCase().replace(/\s+/g, '-');
  const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
  const slug = `${serviceSlug}-${citySlug}`;
  const title = `${service} ${city}`;
  const keyword = `${service.toLowerCase()} ${city.toLowerCase()}`;
  const url = `/locations/${slug}`;
  const metaTitle = `${title} | Boxx Commercial Finance`;
  return [
    String(id),                       // A: id
    'location',                       // B: type
    'scheduled',                      // C: status
    date,                             // D: publishDate
    'PM',                             // E: publishSlot
    service,                          // F: service
    city,                             // G: city
    keyword,                          // H: keyword
    '',                               // I: topic
    title,                            // J: title
    slug,                             // K: slug
    url,                              // L: url
    metaTitle,                        // M: metaTitle
    '',                               // N: metaDescription (generated by GPT)
    'Location',                       // O: category
    '',                               // P: contentBrief
    meta.serviceUrl || '',            // Q: internalLinkService
    '', '', '',                       // R, S, T: internalLinkCity1-3
    '', '', '',                       // U, V, W: relatedBlog1-3
    'yes',                            // X: faqRequired
    'no',                             // Y: linkedInRequired
    meta.author || 'Mark Higgins',    // Z: author
    '',                               // AA: jsonStatus
    '',                               // AB: publishedAt
    '',                               // AC: notes
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — ContentEngine Populator ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  // ── Read existing data ──────────────────────────────────────────────────────
  const existing = await readExistingRows(sheets);
  console.log(`Existing rows: ${existing.length}`);

  const existingSlugs = new Set();
  let lastDate = new Date().toISOString().split('T')[0]; // today as floor
  let maxId = 0;

  for (const row of existing) {
    const d = (row[3] || '').trim();
    if (d && d > lastDate) lastDate = d;
    const slug = (row[10] || '').trim();
    if (slug) existingSlugs.add(slug);
    const idNum = parseInt(row[0], 10);
    if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
  }

  console.log(`Last scheduled date in sheet: ${lastDate}`);
  console.log(`Highest existing ID: ${maxId}`);
  console.log(`Existing slugs: ${existingSlugs.size}`);

  // Start generating from the day after the last scheduled date
  const cursor = addDays(lastDate, 1);
  const cutoffDate = addDays(cursor, MAX_SCHEDULE_DAYS - 1);
  let nextId = maxId + 1;

  console.log(`\nScheduling window: ${cursor} → ${cutoffDate} (${MAX_SCHEDULE_DAYS} days)`);

  // ── Load topics from Keyword_Backlog + remaining hardcoded topics ──────────
  console.log('\nLoading blog topics from Keyword_Backlog tab...');
  const backlogTopics = await loadKeywordBacklog(sheets);

  // Combine: backlog topics (for 6 sheet services) + hardcoded (for 5 extended services)
  const hardcodedExtended = BLOG_TOPICS.filter(t => !BACKLOG_SERVICES.has(t.service) && !BACKLOG_SERVICES.has(
    // handle 'Commercial Mortgage' singular vs 'Commercial Mortgages' plural
    t.service === 'Commercial Mortgage' ? 'Commercial Mortgages' : t.service
  ));
  const allTopics = [...backlogTopics, ...hardcodedExtended];

  const blogQueue = allTopics.filter(t => !existingSlugs.has(t.slug));
  console.log(`Blog topics: ${backlogTopics.length} from sheet + ${hardcodedExtended.length} hardcoded = ${allTopics.length} total, ${blogQueue.length} not yet scheduled`);

  // ── Load cities from UK_Places tab ─────────────────────────────────────────
  console.log('\nLoading cities from UK_Places tab...');
  const sheetCities = await loadUKPlaces(sheets);
  const citiesToUse = sheetCities.length > 0 ? sheetCities : ALL_CITIES;
  console.log(`Cities: ${citiesToUse.length} loaded (${sheetCities.length > 0 ? 'from UK_Places tab' : 'hardcoded fallback'})`);

  const locationQueue = [];
  for (const service of LOCATION_SERVICES) {
    const meta = SERVICE_META[service];
    const serviceSlug = meta ? meta.slug : service.toLowerCase().replace(/\s+/g, '-');
    for (const city of citiesToUse) {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
      const slug = `${serviceSlug}-${citySlug}`;
      if (!existingSlugs.has(slug)) {
        locationQueue.push({ service, city });
      }
    }
  }
  console.log(`Location pages remaining: ${locationQueue.length} of ${LOCATION_SERVICES.length * ALL_CITIES.length}`);

  // ── Assign dates (capped at cutoffDate) ────────────────────────────────────
  // Blog cadence  : 1 per day
  // Location cadence: 5 per day (same date for every group of 5)

  const newRows = [];

  for (let i = 0; i < blogQueue.length; i++) {
    const date = addDays(cursor, i);
    if (date > cutoffDate) break;
    newRows.push({ date, row: buildBlogRow(nextId++, date, blogQueue[i]) });
  }

  for (let i = 0; i < locationQueue.length; i++) {
    const date = addDays(cursor, Math.floor(i / 5));
    if (date > cutoffDate) break;
    const { service, city } = locationQueue[i];
    newRows.push({ date, row: buildLocationRow(nextId++, date, service, city) });
  }

  // Sort by date, then blogs before locations on the same day
  newRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const ta = a.row[1], tb = b.row[1];
    if (ta === tb) return 0;
    return ta === 'blog' ? -1 : 1;
  });

  console.log(`\nTotal new rows to append: ${newRows.length}`);
  if (newRows.length === 0) {
    console.log('Nothing to do — sheet is already populated through the cutoff date.');
    return;
  }

  const lastNewDate = newRows[newRows.length - 1].date;
  const blogCount = newRows.filter(r => r.row[1] === 'blog').length;
  const locCount  = newRows.filter(r => r.row[1] === 'location').length;
  console.log(`  Blog rows : ${blogCount}`);
  console.log(`  Location rows: ${locCount}`);
  console.log(`  Date range: ${newRows[0].date} → ${lastNewDate}`);

  // ── Dry run ─────────────────────────────────────────────────────────────────
  const isDryRun = (process.env.DRY_RUN || '').toLowerCase() === 'true';
  if (isDryRun) {
    console.log('\n⚠  DRY RUN — no rows written. First 10 rows that would be appended:\n');
    newRows.slice(0, 10).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.row[3]} | ${r.row[1]} | ${r.row[5]} | ${r.row[9] || r.row[6]} (${r.row[10]})`);
    });
    console.log(`\n  ...and ${Math.max(0, newRows.length - 10)} more rows.`);
    console.log(`  Would schedule content through: ${lastNewDate}\n`);
    return;
  }

  // ── Append in batches of 500 ────────────────────────────────────────────────
  const BATCH = 500;
  const values = newRows.map(r => r.row);

  for (let start = 0; start < values.length; start += BATCH) {
    const chunk = values.slice(start, start + BATCH);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ContentEngine!A:AC',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: chunk },
    });
    console.log(`  Appended rows ${start + 1}–${Math.min(start + BATCH, values.length)}`);
  }

  console.log(`\n✅ Done! Appended ${values.length} rows.`);
  console.log(`   Content now scheduled through: ${lastNewDate}`);
  console.log(`   Run again in ~3 months to schedule the next window.\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
