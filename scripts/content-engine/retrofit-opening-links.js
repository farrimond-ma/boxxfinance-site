/**
 * Boxx Finance — Retrofit Opening-Paragraph Service Links
 *
 * One-off script. For every published blog post whose opening paragraph
 * has no link, finds the product name in that paragraph and wraps it in
 * a link to the matching /funding-solutions/ service page — mirroring
 * the rule now enforced in the generation prompt for new articles.
 *
 * Run: node retrofit-opening-links.js [--dry-run]
 * Edits src/data/blogPosts.json in the local checkout. Review, commit, push.
 */

const fs = require('fs');
const path = require('path');

const BLOG_FILE = path.resolve(__dirname, '../../src/data/blogPosts.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Valid service page slugs (must exist in src/data/services.jsx)
// service field value → slug
const SERVICE_TO_SLUG = {
  'business loans':       'business-loans',
  'commercial mortgage':  'commercial-mortgages',
  'commercial mortgages': 'commercial-mortgages',
  'invoice finance':      'invoice-finance',
  'structured finance':   'structured-finance',
  'development finance':  'development-finance',
  'asset finance':        'asset-finance',
  'working capital':      'working-capital',
  'bridging finance':     'bridging-finance',
  'trade finance':        'trade-finance',
  'asset refinance':      'asset-refinance',
  'merchant cash advance':'merchant-cash-advance',
  'tax & vat funding':    'tax-vat-funding',
};

// Slug-substring inference for posts with no service field. Ordered —
// first match wins, so more specific patterns come before general ones.
const SLUG_INFERENCE = [
  [/asset-refinanc/,        'asset-refinance'],
  [/merchant-cash-advance/, 'merchant-cash-advance'],
  [/bridging/,              'bridging-finance'],
  [/development/,           'development-finance'],
  [/commercial-mortgage/,   'commercial-mortgages'],
  [/invoice/,               'invoice-finance'],
  [/asset/,                 'asset-finance'],
  [/working-capital/,       'working-capital'],
  [/trade/,                 'trade-finance'],
  [/structured/,            'structured-finance'],
  [/vat|tax-funding/,       'tax-vat-funding'],
  [/loan|sme|business-finance|funding/, 'business-loans'],
];

// Anchor-text candidates per service, longest/most specific first.
// The first one found in the opening paragraph gets linked.
const ANCHOR_CANDIDATES = {
  'bridging-finance':      ['regulated bridging loan', 'bridging finance', 'bridging loans', 'bridging loan'],
  'asset-finance':         ['asset finance'],
  'asset-refinance':       ['asset refinancing', 'asset refinance', 'refinancing existing assets'],
  'invoice-finance':       ['invoice financing', 'invoice finance'],
  'business-loans':        ['business loans', 'business loan', 'commercial loans', 'commercial loan', 'SME loans', 'business finance', 'business funding'],
  'commercial-mortgages':  ['commercial mortgages', 'commercial mortgage'],
  'development-finance':   ['property development finance', 'development finance'],
  'working-capital':       ['working capital finance', 'working capital'],
  'trade-finance':         ['trade finance'],
  'structured-finance':    ['structured finance'],
  'merchant-cash-advance': ['merchant cash advances', 'merchant cash advance'],
  'tax-vat-funding':       ['VAT funding', 'tax funding', 'VAT loan', 'VAT bill'],
};

function resolveServiceSlug(post) {
  const svc = (post.service || '').trim().toLowerCase();
  if (svc && SERVICE_TO_SLUG[svc]) return SERVICE_TO_SLUG[svc];
  for (const [pattern, slug] of SLUG_INFERENCE) {
    if (pattern.test(post.slug || '')) return slug;
  }
  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const posts = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));
  let linked = 0, alreadyLinked = 0, skipped = 0;

  for (const post of posts) {
    if (!post || post.status !== 'published' || !post.content) continue;

    const paraMatch = post.content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!paraMatch) { console.log(`SKIP (no <p>): ${post.slug}`); skipped++; continue; }

    const [fullPara, inner] = paraMatch;

    if (/<a\s/i.test(inner)) {
      console.log(`OK   (already linked): ${post.slug}`);
      alreadyLinked++;
      continue;
    }

    const serviceSlug = resolveServiceSlug(post);
    if (!serviceSlug) { console.log(`SKIP (no service match): ${post.slug}`); skipped++; continue; }

    // Build the list of (slug, candidates) to try:
    // 1. the post's service, 2. the slug-inferred service if different
    //    (catches mislabelled posts), 3. the funding-solutions hub as a
    //    last resort when the opener names the industry but no product.
    const slugInferred = (() => {
      for (const [pattern, slug] of SLUG_INFERENCE) {
        if (pattern.test(post.slug || '')) return slug;
      }
      return null;
    })();

    const attempts = [[serviceSlug, ANCHOR_CANDIDATES[serviceSlug] || []]];
    if (slugInferred && slugInferred !== serviceSlug) {
      attempts.push([slugInferred, ANCHOR_CANDIDATES[slugInferred] || []]);
    }
    attempts.push([null, ['commercial finance']]); // hub fallback

    let newInner = null, anchorUsed = null, targetUrl = null;
    for (const [slug, candidates] of attempts) {
      for (const candidate of candidates) {
        const re = new RegExp(`(${escapeRegex(candidate)})`, 'i');
        const m = inner.match(re);
        if (m) {
          anchorUsed = m[1]; // preserve original casing
          targetUrl = slug ? `/funding-solutions/${slug}` : '/funding-solutions';
          newInner = inner.replace(re, `<a href='${targetUrl}'>$1</a>`);
          break;
        }
      }
      if (newInner) break;
    }

    if (!newInner) {
      console.log(`SKIP (no anchor phrase in opening para): ${post.slug} [${serviceSlug}]`);
      console.log(`     para: ${inner.replace(/<[^>]+>/g, '').slice(0, 120)}...`);
      skipped++;
      continue;
    }

    const newPara = fullPara.replace(inner, newInner);
    console.log(`LINK ${post.slug}`);
    console.log(`     "${anchorUsed}" → ${targetUrl}`);

    if (!DRY_RUN) {
      post.content = post.content.replace(fullPara, newPara);
    }
    linked++;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(BLOG_FILE, JSON.stringify(posts, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${BLOG_FILE}`);
  }
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Linked: ${linked}, already linked: ${alreadyLinked}, skipped: ${skipped}`);
}

main();
