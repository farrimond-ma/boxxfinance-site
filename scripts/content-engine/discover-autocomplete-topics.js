/**
 * discover-autocomplete-topics.js
 *
 * Finds questions people actually type into Google about bridging finance,
 * and reports the ones the site does not already answer.
 *
 * WHY THIS EXISTS
 * Every other research input is backward-looking. Search Console only shows
 * queries the site already gets impressions for, so it cannot reveal demand
 * for topics that have never ranked at all. The AI visibility checker asks a
 * fixed prompt list. The competitor gap analysis shows what rivals publish.
 * None of them surface a question nobody has covered yet.
 *
 * Google's autocomplete endpoint does. This is the same data Answer The
 * Public sells a subscription for — that product's value is the visualisation
 * and saved history, not the underlying suggestions, which are public.
 *
 * HONEST LIMIT: autocomplete gives no search volume. It tells you a phrase is
 * typed often enough for Google to suggest it, nothing more. Treat the output
 * as candidate topics needing judgement, not a ranked opportunity list.
 *
 * Report-only by default. --queue appends the top findings to ContentEngine
 * as scheduled rows; the duplicate-coverage guard in publish-blog.js still
 * applies at publish time as a second check.
 *
 * Run: node discover-autocomplete-topics.js [--queue N] [--dry-run]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB         = 'ContentEngine';
const SERVICE        = 'Bridging Finance';  // must match publish-blog.yml SERVICE_FILTER
const SERVICE_URL    = '/funding-solutions/bridging-loans';
const BLOG_FILE      = path.resolve(__dirname, '../../src/data/blogPosts.json');
const REQUEST_DELAY  = 400;  // be a considerate client of a free public endpoint

// Seed terms — the vocabulary the site competes on. Edit these rather than
// the modifiers; breadth comes from the combinations below.
const SEEDS = [
  'bridging loan',
  'bridging finance',
  'bridge loan uk',
  'auction finance',
  'development finance',
  'second charge bridging',
  'refurbishment finance',
  'short term property finance',
];

// Question words surface intent; prepositions surface use cases. Both matter:
// "can i get a bridging loan with no income" and "bridging loan for probate"
// are different kinds of gap.
const MODIFIERS = [
  '', 'can i', 'can you', 'how to', 'how much', 'how long', 'what is', 'what happens',
  'why', 'when', 'do i need', 'does', 'is a', 'for', 'without', 'with bad', 'vs',
];

// Autocomplete is global; these are the reliable tells that a suggestion is
// for another market. Provinces and states matter as much as country names —
// "how much is bridge financing in ontario" got through a country-only list.
const NON_UK = /\bhdb\b|singapore|malaysia|philippines|\bindia\b|nigeria|canada|ontario|toronto|alberta|quebec|vancouver|australia|sydney|melbourne|\busa\b|\bus\b|america|texas|florida|california|ireland|dubai|hong kong|\bnz\b|new zealand|south africa|netherlands|\bwinz\b|\bnca\b|spain|portugal/i;

// US mortgage vocabulary. These surface constantly because the American market
// dominates English-language search for "bridge loan", and none of them exist
// as UK products — a page answering them would draw the wrong traffic.
const US_JARGON = /\bheloc\b|recast|hard money|conventional loan|contingency|escrow|\bhud\b|\bfha\b|\bva loan\b|closing costs/i;

// Navigational or transactional rather than a question an article answers.
// "meaning" and "what are they" are excluded as thin definitional queries the
// site's existing explainer pages already serve.
const JUNK = /login|sign in|\.com|\.co\.uk|reddit|money ?saving ?expert|martin lewis|nationwide|barclays|halifax|natwest|lloyds|santander|jobs?\b|salary|vacanc|\binc\b|\bltd\b|\bnews\b|meaning$|what are they$/i;

// Must match a COMPOUND term, not a fragment. The original used bare `bridg`
// and `develop`, which let through "bridging speakers" (audio equipment) and
// "how to develop financial literacy". Autocomplete is broad enough that
// loose matching produces more noise than signal.
const RELEVANT = new RegExp([
  'bridging (loan|finance|mortgage)',
  'bridge (loan|financing)',
  'auction (finance|property|purchase)',
  'development finance',
  'refurbishment (loan|finance|cost|project)',
  'second charge',
  'short.term (property )?(loan|finance|lending)',
  'probate (property|loan|finance|sale)',
  'chain break',
  'unmortgageable',
  '(hmo|buy.to.let|btl) (finance|loan|mortgage|conversion)',
  'renovation (loan|finance|mortgage)',
  'property (development|conversion) (finance|loan)',
].join('|'), 'i');

// Tokens every candidate shares because they came from the seed vocabulary.
// Similarity must ignore these: "bridging loan for probate" and "bridging loan
// rates" overlap almost entirely on them while being different articles.
// Without this, short phrases matched everything and the filter kept only
// suggestions that were off-topic enough to share no vocabulary at all.
const SEED_TOKENS = new Set(['bridging','bridge','loan','loans','finance','financing','property','uk','short','term','mortgage']);

const STOPWORDS = new Set(['a','an','the','and','or','for','to','of','in','on','is','are','can','do','does','you','your','uk','with','what','how','my','i','it','be','at','as','from','that','this','by','not','but','we','our']);
function topicTokens(str) {
  return new Set(String(str || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)));
}
function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function suggest(query) {
  const url = 'https://suggestqueries.google.com/complete/search'
    + `?client=firefox&hl=en&gl=uk&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = JSON.parse(await res.text());
  return Array.isArray(body[1]) ? body[1] : [];
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bUk\b/g, 'UK').replace(/\bHmo\b/g, 'HMO');
}
function toSlug(s) {
  return String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function getSheets() {
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
  } catch {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// Same 29-column A..AC contract as add-gap-topics.js and add-visibility-content.js.
function buildRow(id, date, phrase, author) {
  const title = titleCase(phrase);
  const slug  = toSlug(phrase);
  return [
    String(id), 'blog', 'scheduled', date, 'PM',
    SERVICE, '',
    phrase.toLowerCase(), '', title, slug,
    `https://boxxfinance.co.uk/insights/${slug}`,
    `${title} | Boxx Finance`, '',
    SERVICE,
    `Google autocomplete gap: people search this phrase and the site has no page answering it. `
      + `Answer the question directly and completely in the opening paragraph, then expand. `
      + `No search volume data exists for this — write it as a genuinely useful answer, not a keyword target.`,
    SERVICE_URL,
    '', '', '',
    '', '', '',
    'yes', 'yes', author,
    '', '',
    'Google autocomplete discovery',
  ];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const qi = process.argv.indexOf('--queue');
  const queueCount = qi !== -1 ? parseInt(process.argv[qi + 1], 10) || 0 : 0;

  console.log('\n[Google autocomplete topic discovery]\n');

  // 1. Harvest
  const seen = new Set();
  let queries = 0, failures = 0;
  for (const seed of SEEDS) {
    for (const mod of MODIFIERS) {
      const q = mod ? (['for', 'without', 'with bad', 'vs'].includes(mod) ? `${seed} ${mod}` : `${mod} ${seed}`) : seed;
      try {
        for (const s of await suggest(q)) seen.add(s.toLowerCase().trim());
        queries++;
      } catch (err) {
        failures++;
      }
      await sleep(REQUEST_DELAY);
    }
    process.stdout.write(`  ${seed}: ${seen.size} unique so far\n`);
  }
  console.log(`\n${queries} queries ran, ${failures} failed, ${seen.size} unique suggestions.`);

  // 2. Filter
  const candidates = [...seen].filter(s =>
    s.length > 14 && RELEVANT.test(s) && !NON_UK.test(s) && !US_JARGON.test(s) && !JUNK.test(s)
  );
  console.log(`${candidates.length} bridging-relevant after removing non-UK and navigational noise.`);

  // 3. Drop anything already covered
  const posts = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8')).filter(p => p.status === 'published');
  const corpus = posts.map(p => topicTokens(`${p.slug} ${p.title} ${p.keywords}`));
  // Compare on DISTINGUISHING tokens only — what the phrase is about beyond
  // the shared bridging vocabulary. "bridging loan for probate" reduces to
  // {probate}, which is the part that decides whether it is already covered.
  const distinguishing = (s) => {
    const t = topicTokens(s);
    for (const g of SEED_TOKENS) t.delete(g);
    return t;
  };
  const corpusDistinct = corpus.map(b => {
    const t = new Set(b);
    for (const g of SEED_TOKENS) t.delete(g);
    return t;
  });

  const gaps = [];
  for (const c of candidates) {
    const t = distinguishing(c);
    if (t.size < 1) continue;   // nothing beyond the seed vocabulary — not a distinct topic
    const best = corpusDistinct.reduce((m, b) => Math.max(m, overlapScore(t, b)), 0);
    if (best < 0.5) gaps.push({ phrase: c, closest: best, distinct: [...t].join(' ') });
  }
  gaps.sort((a, b) => a.closest - b.closest);

  console.log(`\n${gaps.length} with no close existing coverage:\n`);
  gaps.slice(0, 40).forEach(g => console.log(`  ${g.closest.toFixed(2)}  ${g.phrase}   [${g.distinct}]`));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ['## Google autocomplete topic discovery', '',
      `${seen.size} suggestions harvested · ${candidates.length} relevant · **${gaps.length} not already covered**`, '',
      '_Autocomplete carries no volume data — these are candidate topics, not ranked opportunities._', '',
      '| Closest existing | Phrase |', '|---|---|',
      ...gaps.slice(0, 30).map(g => `| ${g.closest.toFixed(2)} | ${g.phrase} |`)];
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n'); } catch { /* non-fatal */ }
  }

  if (queueCount <= 0) {
    console.log('\nReport only. Pass --queue N to add the top N to ContentEngine.');
    return;
  }

  // 4. Optionally queue
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${CE_TAB}!A2:AC` });
  const rows = res.data.values || [];
  const existing = new Set(rows.map(r => (r[10] || '').trim()).filter(Boolean));
  let id = rows.reduce((m, r) => Math.max(m, parseInt(r[0], 10) || 0), 0) + 1;

  const authors = ['Mark Higgins', 'Tara Jameson'];
  const start = new Date(); start.setDate(start.getDate() + 1);
  const newRows = [];
  for (const g of gaps) {
    if (newRows.length >= queueCount) break;
    const slug = toSlug(g.phrase);
    if (existing.has(slug)) continue;
    const d = new Date(start); d.setDate(d.getDate() + newRows.length);
    newRows.push(buildRow(id++, d.toISOString().split('T')[0], g.phrase, authors[newRows.length % 2]));
    existing.add(slug);
  }

  if (newRows.length === 0) { console.log('\nNothing new to queue.'); return; }
  if (isDryRun) {
    console.log(`\n[DRY RUN] Would queue ${newRows.length} row(s):`);
    newRows.forEach(r => console.log(`   ${r[3]}  ${r[10]}`));
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID, range: `${CE_TAB}!A:AC`,
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newRows },
  });
  console.log(`\n✅ Queued ${newRows.length} row(s) to ${CE_TAB}.`);
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
