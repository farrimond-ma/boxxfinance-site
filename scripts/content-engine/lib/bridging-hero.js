/**
 * Shared bridging hero-image helper for the content generators.
 *
 * Bridging blog + location pages render their hero from the curated pool
 * (src/components/resource/heroPool.js → pickHero/heroForPost), IGNORING any
 * per-slug image. So fetching a Pexels image per bridging post was pure waste:
 * it created a near-duplicate /images/blog/<slug>.webp that is never displayed,
 * and it was the root cause of dozens of cards showing the same 4 stock photos.
 *
 * Instead, bridging posts get a pool image assigned directly here — no fetch,
 * no duplicate file — and the field stays consistent with what the site renders
 * (also used for OG / social-share images). Non-bridging posts keep their own
 * fetched image, so only bridging changes.
 *
 * The pool is read from heroPool.js at runtime so the publisher can never drift
 * from the images the site actually has.
 */

const fs = require('fs');
const path = require('path');

const POOL_FILE = path.resolve(__dirname, '../../../src/components/resource/heroPool.js');
const FALLBACK_INDICES = [1, 3, 4, 5, 6, 7, 9, 10, 11];

function poolIndices() {
  try {
    const src = fs.readFileSync(POOL_FILE, 'utf8');
    const m = src.match(/const HERO_POOL = \[([^\]]*)\]/);
    if (m) {
      const idx = m[1].split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
      if (idx.length) return idx;
    }
  } catch { /* fall through to fallback */ }
  return FALLBACK_INDICES;
}

function isBridgingService(service) {
  return /bridging/i.test(service || '');
}

// Mirrors pickHero() in heroPool.js exactly (sum of char codes % pool length),
// so the stored heroImage matches the image the page will render.
function pickBridgingHero(slug) {
  const idx = poolIndices();
  const sum = [...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/images/hero/bridging-${idx[sum % idx.length]}.webp`;
}

module.exports = { isBridgingService, pickBridgingHero };
