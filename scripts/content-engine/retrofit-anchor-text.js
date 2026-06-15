/**
 * Retrofits keyword-rich anchor text into existing blog post content HTML.
 *
 * Fixes three patterns left by the old prompt:
 *  1. "speak to a commercial finance specialist" CTA anchor — replaced with
 *     product-specific keyword anchors (e.g. "compare bridging loan rates")
 *  2. "get expert X advice" closing CTA anchor — same treatment
 *  3. <a href='.../#about'>Boxx Commercial Finance</a> — brand-name anchor
 *     removed (link unwrapped to plain text; /#about adds no SEO value)
 *
 * Idempotent — safe to re-run; replacements are unique enough that
 * a second pass won't double-replace.
 *
 * Run: node retrofit-anchor-text.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const FILE    = path.resolve(__dirname, '../../src/data/blogPosts.json');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Service inference for older posts without a service field ────────────────
const SLUG_TO_SERVICE = {
  'property-development-finance-uk':    'Development Finance',
  'what-is-invoice-finance':            'Invoice Finance',
  'what-is-asset-finance':              'Asset Finance',
  'what-is-bridging-finance':           'Bridging Finance',
  'bridging-loan-rates-uk':             'Bridging Finance',
  'what-is-working-capital-finance':    'Working Capital',
  'what-is-trade-finance':              'Trade Finance',
  'what-is-asset-refinance':            'Asset Finance',
  'what-is-a-merchant-cash-advance':    'Merchant Cash Advance',
  'what-is-structured-finance':         'Structured Finance',
  'vat-funding-uk':                     'Business Loans',
};

// ─── CTA anchor text options per service ─────────────────────────────────────
// Two options per service — alternated across posts so the same service
// doesn't always produce identical anchor text.
const CTA_ANCHORS = {
  'Bridging Finance':      ['compare bridging loan rates', 'arrange a bridging loan', 'get a bridging loan quote', 'find a bridging finance broker'],
  'Development Finance':   ['compare development finance rates', 'arrange development finance', 'get development finance today'],
  'Commercial Mortgages':  ['compare commercial mortgage rates', 'find a commercial mortgage', 'get a commercial mortgage quote'],
  'Commercial Mortgage':   ['compare commercial mortgage rates', 'find a commercial mortgage', 'get a commercial mortgage quote'],
  'Invoice Finance':       ['compare invoice finance deals', 'arrange invoice finance', 'get invoice finance today'],
  'Asset Finance':         ['compare asset finance rates', 'arrange asset finance', 'get asset finance today'],
  'Working Capital':       ['compare working capital loans', 'get a working capital loan', 'arrange working capital finance'],
  'Trade Finance':         ['compare trade finance options', 'arrange trade finance', 'get trade finance today'],
  'Business Loans':        ['compare business loan rates', 'find a business loan UK', 'get a business loan today'],
  'Merchant Cash Advance': ['compare merchant cash advance deals', 'get a merchant cash advance'],
  'Structured Finance':    ['compare structured finance options', 'arrange structured finance'],
  'Property Finance':      ['compare property finance rates', 'arrange property finance'],
};
const DEFAULT_CTA_ANCHORS = ['compare commercial finance options', 'arrange business finance', 'find a commercial finance broker'];

// ─── Patterns to replace ─────────────────────────────────────────────────────
// Match the anchor text inside any <a ...>ANCHOR</a> — href preserved
function replaceAnchorText(html, oldAnchor, newAnchor) {
  // oldAnchor is a regex-safe literal string (escaped below)
  const escaped = oldAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<a [^>]+>)${escaped}(<\\/a>)`, 'gi');
  return html.replace(re, `$1${newAnchor}$2`);
}

function removeAboutLink(html) {
  // Unwrap <a href='.../#about'>Boxx Commercial Finance</a> → plain text
  return html.replace(/<a [^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/#about['"][^>]*>([^<]+)<\/a>/gi, '$1');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const posts = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  // Track how many times each service's CTA anchors have been used
  const svcIdx = {};

  let changed = 0;
  for (const post of posts) {
    if (post.status !== 'published' || !post.content) continue;

    const service = post.service || SLUG_TO_SERVICE[post.slug] || '';
    const anchors = CTA_ANCHORS[service] || DEFAULT_CTA_ANCHORS;
    svcIdx[service] = svcIdx[service] || 0;

    let html = post.content;
    let dirty = false;

    // 1. Replace "speak to a commercial finance specialist"
    if (/speak to a commercial finance specialist/i.test(html)) {
      const anchor = anchors[svcIdx[service]++ % anchors.length];
      html = replaceAnchorText(html, 'speak to a commercial finance specialist', anchor);
      // Handle capitalised version
      html = replaceAnchorText(html, 'Speak to a commercial finance specialist', anchor.charAt(0).toUpperCase() + anchor.slice(1));
      dirty = true;
    }

    // 2. Replace "get expert X advice" (closing CTA variant)
    const expertRe = /get expert [^<"]{5,60} advice/gi;
    if (expertRe.test(html)) {
      html = html.replace(expertRe, () => {
        const anchor = anchors[svcIdx[service]++ % anchors.length];
        return anchor;
      });
      dirty = true;
    }

    // 3. Remove /#about brand link
    if (/\/#about/.test(html)) {
      const before = html;
      html = removeAboutLink(html);
      if (html !== before) dirty = true;
    }

    if (dirty) {
      console.log(`FIX  ${post.slug} (${service || 'no service'})`);
      if (!DRY_RUN) post.content = html;
      changed++;
    }
  }

  if (!DRY_RUN && changed > 0) {
    fs.writeFileSync(FILE, JSON.stringify(posts, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${FILE}`);
  }
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Posts updated: ${changed}`);
}

main();
