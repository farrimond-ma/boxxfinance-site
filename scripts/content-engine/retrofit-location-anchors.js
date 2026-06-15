/**
 * Retrofits location page content HTML with keyword-rich CTAs.
 *
 * Fixes three patterns:
 *  1. Wrong CTA URL on 4 old bridging finance pages:
 *     /chat-about-funding → /chat-about-funding/bridging-finance
 *  2. Brand-name links (/#about, /about-us) — unwrapped to plain text
 *  3. Weak CTA anchor text:
 *     "speak to a ... specialist" / "discuss your funding needs with our team"
 *     → keyword-rich alternatives (e.g. "compare bridging loan rates")
 *
 * Idempotent — safe to re-run.
 * Run: node retrofit-location-anchors.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const FILE    = path.resolve(__dirname, '../../src/data/locationPages.json');
const DRY_RUN = process.argv.includes('--dry-run');

function toSlug(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

// ─── CTA anchor text options per service (cycled across pages) ─────────────
const CTA_ANCHORS = {
  'business-loans':        ['compare business loan rates', 'find a business loan UK', 'get a business loan today', 'arrange a business loan'],
  'bridging-finance':      ['compare bridging loan rates', 'arrange a bridging loan', 'get a bridging loan quote', 'find a bridging finance broker'],
  'development-finance':   ['compare development finance rates', 'arrange development finance', 'get a development finance quote', 'find a development finance lender'],
  'invoice-finance':       ['compare invoice finance deals', 'arrange invoice finance', 'get invoice finance today', 'find an invoice finance provider'],
  'asset-finance':         ['compare asset finance rates', 'arrange asset finance', 'get asset finance today', 'find an asset finance broker'],
  'commercial-mortgages':  ['compare commercial mortgage rates', 'find a commercial mortgage', 'get a commercial mortgage quote', 'arrange a commercial mortgage'],
  'working-capital':       ['compare working capital loans', 'get a working capital loan', 'arrange working capital finance', 'find working capital funding'],
  'trade-finance':         ['compare trade finance options', 'arrange trade finance', 'get trade finance today', 'find a trade finance provider'],
  'asset-refinance':       ['compare asset refinance options', 'arrange asset refinance', 'get an asset refinance quote'],
  'merchant-cash-advance': ['compare merchant cash advance deals', 'get a merchant cash advance', 'arrange a merchant cash advance'],
  'structured-finance':    ['compare structured finance options', 'arrange structured finance', 'get a structured finance quote'],
  'tax-and-vat-funding':   ['compare tax funding options', 'arrange tax & VAT funding', 'get a VAT loan today'],
};
const DEFAULT_CTA_ANCHORS = ['compare commercial finance options', 'arrange business finance', 'find a commercial finance broker'];

// ─── Fix wrong CTA URL (all services) ─────────────────────────────────────
// Old pages used bare /chat-about-funding — replace with /chat-about-funding/{serviceSlug}
function fixCtaUrl(html, serviceSlug) {
  return html.replace(
    /href='https?:\/\/boxxfinance\.co\.uk\/chat-about-funding'/g,
    `href='https://boxxfinance.co.uk/chat-about-funding/${serviceSlug}'`
  );
}

// ─── Remove about-us / #about brand links ─────────────────────────────────
function removeAboutLinks(html) {
  return html.replace(
    /<a [^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/(#about|about-us)[^'"]*['"][^>]*>([^<]+)<\/a>/gi,
    '$2'
  );
}

// ─── Replace weak CTA anchor text (keep href, replace anchor text) ─────────
function replaceWeakAnchors(html, anchors, startIdx) {
  let anchorIdx = startIdx;

  // Pattern: "speak to a/an ... specialist" or "discuss your funding needs..."
  const weakPatterns = [
    /speak to (?:a|an) [^<]{3,60} specialist/gi,
    /discuss your funding needs with our team/gi,
  ];

  for (const pattern of weakPatterns) {
    html = html.replace(
      new RegExp(`(<a [^>]+>)(${pattern.source})(<\\/a>)`, 'gi'),
      (match, open, anchor, close) => {
        const newAnchor = anchors[anchorIdx++ % anchors.length];
        // Preserve capitalisation if original was capitalised
        const formatted = /^[A-Z]/.test(anchor)
          ? newAnchor.charAt(0).toUpperCase() + newAnchor.slice(1)
          : newAnchor;
        return `${open}${formatted}${close}`;
      }
    );
  }

  return { html, count: anchorIdx - startIdx };
}

// ─── Main ─────────────────────────────────────────────────────────────────
function main() {
  const pages = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const svcIdx = {};
  let changed = 0;

  for (const page of pages) {
    if (!page.content) continue;

    const svcSlug = toSlug(page.service || '');
    const anchors = CTA_ANCHORS[svcSlug] || DEFAULT_CTA_ANCHORS;
    svcIdx[svcSlug] = svcIdx[svcSlug] || 0;

    let html = page.content;
    const fixes = [];

    // 1. Fix bare CTA URL → service-specific URL
    const fixed = fixCtaUrl(html, svcSlug);
    if (fixed !== html) {
      html = fixed;
      fixes.push('CTA URL');
    }

    // 2. Remove brand-name about links
    const afterAbout = removeAboutLinks(html);
    if (afterAbout !== html) {
      html = afterAbout;
      fixes.push('about link');
    }

    // 3. Replace weak CTA anchors
    const { html: afterAnchors, count } = replaceWeakAnchors(html, anchors, svcIdx[svcSlug]);
    if (count > 0) {
      html = afterAnchors;
      svcIdx[svcSlug] += count;
      fixes.push(`${count} anchor(s)`);
    }

    if (fixes.length > 0) {
      console.log(`FIX  ${page.slug} [${fixes.join(', ')}]`);
      if (!DRY_RUN) page.content = html;
      changed++;
    }
  }

  if (!DRY_RUN && changed > 0) {
    fs.writeFileSync(FILE, JSON.stringify(pages, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${FILE}`);
  }
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Pages updated: ${changed}`);
}

main();
