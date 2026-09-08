/**
 * service-image-queries.js
 *
 * Pexels query variants for blog-post hero images, keyed by service. Shared
 * by publish-blog.js (new posts) and reimage-focus-service-posts.js
 * (backfill) so the two cannot drift apart — which is exactly what caused
 * this file to exist: publish-blog.js had its own single-string query per
 * service, reimage-focus-service-posts.js duplicated it, and a
 * buy-to-let-refinance post got an American apartment block through both
 * (2026-09-07/08). Pair with lib/news-images.js's fetchPexelsImage, which
 * does the actual UK-vs-US filtering on the results these queries return —
 * a single "UK <subject>" string barely constrains Pexels on its own.
 *
 * Property-related services lead with real British building types
 * (terraced, semi-detached), which are reliably tagged as such on Pexels;
 * pure business-abstract services lead with a UK landmark or explicit
 * "British" framing for the same reason.
 */

function serviceImageQueries(service) {
  const key = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const MAP = {
    'bridging-finance':    ['UK residential property house exterior', 'British terraced houses street', 'English suburban houses'],
    'development-finance': ['UK property construction architect', 'British building site scaffolding', 'UK new build houses construction'],
    'commercial-mortgages':['UK commercial property building office', 'British high street shopfront', 'London office building exterior'],
    'commercial-mortgage': ['UK commercial property building office', 'British high street shopfront', 'London office building exterior'],
    'invoice-finance':     ['UK business paperwork accounts desk', 'British office desk invoice', 'UK small business owner desk'],
    'asset-finance':       ['UK industrial machinery factory equipment', 'British factory warehouse equipment', 'UK haulage lorry depot'],
    'working-capital':     ['UK business team meeting growth', 'British office team meeting', 'UK small business owner shop'],
    'trade-finance':       ['UK port shipping logistics supply chain', 'British shipping container port', 'UK warehouse logistics'],
    'cashflow-finance':    ['UK business professional office meeting', 'British office desk paperwork', 'UK small business owner'],
    'mezzanine-finance':   ['UK city financial district skyline', 'City of London skyline', 'London Canary Wharf skyline'],
    'structured-finance':  ['UK city London financial district', 'City of London skyline', 'London Threadneedle Street'],
    'business-loans':      ['UK small business entrepreneur office', 'British shop owner storefront', 'UK small business owner desk'],
    // Added 2026-09-07, hardened 2026-09-08 after a US apartment block got
    // through the single-string version.
    'bad-credit-mortgages':    ['UK suburban semi detached houses', 'British terraced houses street', 'English suburban street houses'],
    'secured-loans':           ['UK detached house driveway exterior', 'British semi detached house', 'English suburban houses'],
    'buy-to-let-refinance':    ['British terraced houses street', 'Victorian terraced houses London', 'UK semi detached houses'],
    'second-charge-mortgages': ['UK terraced houses residential street', 'British semi detached houses street', 'English brick townhouses'],
  };
  return MAP[key] || ['UK business professionals meeting office', 'British office team meeting', 'UK small business owner'];
}

module.exports = { serviceImageQueries };
