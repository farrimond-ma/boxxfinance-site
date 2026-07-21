/**
 * Rewrite "bridging finance" → "bridging loans" across published posts.
 *
 * Strategic terminology decision: all bridging content targets "bridging loans"
 * (higher UK search volume, and the term borrowers actually use). The generator
 * prompt has enforced this for new posts since 2026-07; 68 of 102 published
 * posts predate that and still use the old phrasing in prose.
 *
 * This is a mechanical text pass — no model calls, so it costs nothing and is
 * fully reviewable as a diff.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH:
 *
 *   1. SLUGS. Changing a published slug breaks its live URL and discards the
 *      indexing it has accumulated. Slug correction belongs at generation time
 *      (publish-blog.js does that); retrofitting it here would need 301s and is
 *      a separate, deliberate migration.
 *   2. URLs / href values. Left alone here because URL changes are a separate,
 *      deliberate decision — not a side effect of a text sweep. Note the
 *      canonical service page is /funding-solutions/bridging-loans; the older
 *      /funding-solutions/bridging-finance still appears in 32 body links and
 *      301-redirects (public/.htaccess:120), so those resolve but cost an extra
 *      hop. Updating them to the canonical URL is a worthwhile follow-up.
 *   3. post.service. "Bridging Finance" is the internal taxonomy identity used
 *      by SERVICE_FILTER and the sheet; Blog.jsx already maps it to "Bridging
 *      Loans" for display.
 *
 * Run: node terminology-sweep.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const BLOG_FILE = path.resolve(__dirname, '../../src/data/blogPosts.json');
const PHRASE = /bridging finance/gi;

// Fields safe to rewrite: prose the reader sees. Note the absence of `slug`,
// `url`, and `service` — see the header.
// SCOPE: short, structured fields only.
//
// A first version of this swept body prose too. It produced 120 grammatical
// breakages, because "bridging finance" is a mass noun and "bridging loans" is
// plural — the surrounding sentences were written for the singular:
//
//   "Bridging loans serves as an effective tool"          (singular verb)
//   "Bridging loans are a short-term loan"                (plural verb, singular noun)
//   "...longer-term financing. It can help businesses"    (singular pronoun)
//
// A verb-agreement table cannot fix that. It shifts the error rather than
// removing it, and my own check missed most of it because the check enumerated
// only nine verbs while the corpus used dozens.
//
// So: fields listed here are noun phrases and keyword lists with no verb to
// disagree with, which makes the substitution provably safe and reviewable.
// Body copy, excerpts and FAQ answers are prose and go through the model repair
// path instead, where sentences can actually be rewritten.
const TEXT_FIELDS = ['title', 'metaTitle', 'keywords', 'primaryKeyword'];

// Deliberately empty — see above. Body HTML is not swept mechanically.
const HTML_FIELDS = [];

// Preserve the casing pattern of what was matched. Three distinct cases —
// treating sentence-initial "Bridging finance" as title case was wrong and
// produced "Bridging Loans can be..." mid-sentence.
function swap(match) {
  if (match === match.toUpperCase()) return 'BRIDGING LOANS';          // BRIDGING FINANCE
  const [w1, w2] = match.split(/\s+/);
  const titleCase = w2 && w2[0] === w2[0].toUpperCase();
  if (w1[0] === w1[0].toUpperCase()) return titleCase ? 'Bridging Loans' : 'Bridging loans';
  return 'bridging loans';
}

/**
 * "bridging finance" is a mass noun taking singular agreement; "bridging loans"
 * is plural. A blind swap yields "bridging loans is a useful tool" — 73 such
 * occurrences in the corpus. These run BEFORE the phrase swap, matching the
 * old phrase plus its verb so agreement is corrected in the same step.
 */
const AGREEMENT = [
  // Verb follows the phrase.
  [/\bbridging finance\s+is\b/gi,        'bridging loans are'],
  [/\bbridging finance\s+was\b/gi,       'bridging loans were'],
  [/\bbridging finance\s+has\b/gi,       'bridging loans have'],
  [/\bbridging finance\s+does\b/gi,      'bridging loans do'],
  [/\bbridging finance\s+isn't\b/gi,     "bridging loans aren't"],
  [/\bbridging finance\s+provides\b/gi,  'bridging loans provide'],
  [/\bbridging finance\s+offers\b/gi,    'bridging loans offer'],
  [/\bbridging finance\s+allows\b/gi,    'bridging loans allow'],
  [/\bbridging finance\s+remains\b/gi,   'bridging loans remain'],
  [/\bbridging finance\s+becomes\b/gi,   'bridging loans become'],
  [/\bbridging finance\s+works\b/gi,     'bridging loans work'],
  [/\bbridging finance\s+comes\b/gi,     'bridging loans come'],
  [/\bbridging finance\s+requires\b/gi,  'bridging loans require'],
  [/\bbridging finance\s+involves\b/gi,  'bridging loans involve'],
  [/\bbridging finance\s+carries\b/gi,   'bridging loans carry'],
  // Verb precedes the phrase ("What Is Bridging Finance" → "What Are Bridging Loans").
  [/\bis\s+bridging finance\b/gi,        'are bridging loans'],
  [/\bwas\s+bridging finance\b/gi,       'were bridging loans'],
  // Singular determiners: "a bridging finance facility" reads wrong pluralised.
  [/\ba\s+bridging finance\b/gi,         'a bridging loan'],
  [/\ban\s+bridging finance\b/gi,        'a bridging loan'],
];

// Apply agreement fixes, preserving BOTH the leading capital and the casing of
// the noun phrase itself. Without the second part, the title "What Is Bridging
// Finance" became "What Are bridging loans" — correct grammar, broken casing.
function fixAgreement(text) {
  let out = text;
  for (const [re, replacement] of AGREEMENT) {
    out = out.replace(re, (m) => {
      let result = replacement;
      // Was the original noun phrase title-cased ("Bridging Finance")?
      const nounTitleCased = /Bridging\s+Finance/.test(m);
      if (nounTitleCased) {
        result = result.replace(/bridging loans?/i, (n) =>
          n.toLowerCase() === 'bridging loan' ? 'Bridging Loan' : 'Bridging Loans');
      }
      // Restore a leading capital if the match started a sentence.
      if (/^[A-Z]/.test(m)) result = result[0].toUpperCase() + result.slice(1);
      return result;
    });
  }
  return out;
}

/**
 * Rewrite prose inside HTML while leaving tag internals alone, so href, class,
 * alt and title attributes are never touched. Splits on tags and only rewrites
 * the text nodes between them.
 */
function rewriteHtmlProse(html) {
  return html.split(/(<[^>]*>)/g)
    .map(part => part.startsWith('<') ? part : rewriteText(part))
    .join('');
}

// Agreement first (it matches the OLD phrase plus its verb), then any remaining
// standalone occurrences.
function rewriteText(text) {
  return fixAgreement(text).replace(PHRASE, swap);
}

function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const posts = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));

  let changedPosts = 0, totalReplacements = 0;
  const samples = [];

  for (const post of posts) {
    let postChanged = 0;

    for (const field of TEXT_FIELDS) {
      if (typeof post[field] !== 'string') continue;
      const hits = (post[field].match(PHRASE) || []).length;
      if (!hits) continue;
      const before = post[field];
      post[field] = rewriteText(post[field]);
      postChanged += hits;
      if (samples.length < 8) samples.push(`  ${field}: "${before.slice(0, 62)}" → "${post[field].slice(0, 62)}"`);
    }

    for (const field of HTML_FIELDS) {
      if (typeof post[field] !== 'string') continue;
      const proseHits = post[field].split(/(<[^>]*>)/g)
        .filter(p => !p.startsWith('<'))
        .reduce((n, p) => n + (p.match(PHRASE) || []).length, 0);
      if (proseHits) {
        post[field] = rewriteHtmlProse(post[field]);
        postChanged += proseHits;
      }
    }

    // FAQ schema is NOT swept here. Answer text is prose, and sweeping it
    // produced exactly the breakage this script is scoped to avoid:
    //   "Bridging loans are a short-term loan designed to... It can help"
    // Three answers broke that way on the first attempt. FAQ content is
    // rewritten properly by the model repair path instead.

    if (postChanged) { changedPosts++; totalReplacements += postChanged; }
  }

  console.log(`Terminology sweep${isDryRun ? ' [DRY RUN]' : ''}`);
  console.log(`  posts changed:       ${changedPosts} / ${posts.length}`);
  console.log(`  total replacements:  ${totalReplacements}`);
  if (samples.length) {
    console.log('\n  sample field rewrites:');
    samples.forEach(s => console.log(s));
  }

  // Safety assertions. The earlier version of this check was written badly and
  // reported 54 "damaged" URLs that were never touched — verify the invariant
  // directly instead: hrefs and slugs must be byte-identical to the originals.
  const origPosts = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));
  const hrefsOf = (p) => [...(p.content || '').matchAll(/href=['"]([^'"]+)['"]/g)].map(m => m[1]).join('|');
  let urlDrift = 0, slugDrift = 0;
  posts.forEach((p, i) => {
    if (hrefsOf(p) !== hrefsOf(origPosts[i])) urlDrift++;
    if (p.slug !== origPosts[i].slug) slugDrift++;
  });
  console.log(`
  hrefs unchanged:  ${urlDrift === 0 ? 'yes' : 'NO — ' + urlDrift + ' post(s) drifted'}`);
  console.log(`  slugs unchanged:  ${slugDrift === 0 ? 'yes' : 'NO — ' + slugDrift + ' post(s) drifted'}`);

  const residual = posts.reduce((n, p) =>
    n + ((JSON.stringify(p).match(/bridging finance/gi) || []).length), 0);
  console.log(`  residual "bridging finance" in prose fields: ${residual}`);

  const badGrammar = posts.reduce((n, p) => n + (((p.content || '')
    .replace(/<[^>]+>/g, ' ')
    .match(/bridging loans\s+(is|was|has|does|provides|offers|allows|remains|becomes)/gi) || []).length), 0);
  console.log(`  plural/singular mismatches introduced:       ${badGrammar}`);

  if (urlDrift || slugDrift || badGrammar) {
    console.error('\n  ABORT — sweep would damage content. Nothing written.');
    process.exit(1);
  }

  if (isDryRun) { console.log('\n[DRY RUN] Nothing written.'); return; }
  fs.writeFileSync(BLOG_FILE, JSON.stringify(posts, null, 2));
  console.log(`\nWrote ${BLOG_FILE}`);
}

main();
