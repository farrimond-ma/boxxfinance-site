// Curated bridging-property hero images (fetched via scripts/fetch-bridging-heroes.js
// plus user-supplied shots). Wide establishing images only — tight close-ups are
// excluded because, cropped to the right of the hero behind the navy gradient,
// they show only texture rather than obvious property.
//
// Used by both location pages and bridging blog posts so no bridging page ever
// shows an off-theme (e.g. office) image. Deterministic per slug.
// 1,3-7 = Pexels property shots; 9-11 = user-supplied refurbishment/extension
// photos. (2 and 8 are close-ups, excluded — they show only texture cropped
// behind the hero gradient.)
const HERO_POOL = [1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].map((i) => `/images/hero/bridging-${i}.webp`);

export const pickHero = (slug) => {
    const sum = [...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return HERO_POOL[sum % HERO_POOL.length];
};

// Slugs with a genuinely bespoke, hand-made topical hero that should override
// the curated pool. Everything else bridging uses the pool: the content engine
// saved the SAME 4 stock photos under dozens of per-slug filenames, so a
// post's own /images/blog/<slug>.webp is NOT a reliable source of variety.
const BESPOKE_HERO_SLUGS = new Set([
    'bridging-loans-for-hmo-conversion',
]);

// The hero image for a post, used identically by the /insights cards and the
// article hero so a card always matches the page it links to.
//   - Bridging posts → the curated 9-image property pool (visual variety),
//     unless the post is on the bespoke allowlist above.
//   - Other services → the post's own image (caller supplies any fallback).
export const heroForPost = (post) => {
    if (!post) return null;
    const own = post.heroImage || post.image || null;
    const isBridging = /bridging/i.test(post.service || '');
    if (isBridging) {
        if (own && BESPOKE_HERO_SLUGS.has(post.slug)) return own;
        return pickHero(post.slug);
    }
    return own;
};

export default HERO_POOL;
