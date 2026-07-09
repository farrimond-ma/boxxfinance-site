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
const HERO_POOL = [1, 3, 4, 5, 6, 7, 9, 10, 11].map((i) => `/images/hero/bridging-${i}.webp`);

export const pickHero = (slug) => {
    const sum = [...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return HERO_POOL[sum % HERO_POOL.length];
};

export default HERO_POOL;
