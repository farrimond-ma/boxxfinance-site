/**
 * news-images.js
 *
 * Hero image sourcing for the personal-finance news posts. Shared by
 * publish-personal-finance-news.js (new posts) and reimage-news-posts.js
 * (backfill), so the two cannot drift apart on what counts as a usable,
 * British-looking photo.
 */

// Each category returns SEVERAL query variants, tried in order. Two reasons:
//
// 1. Variety. This used to return one fixed string per category and then take
//    the first Pexels result, which is deterministic — the same query returned
//    the same photo every time. Ten news posts ended up sharing five images,
//    one of them used four times.
// 2. Britishness. "UK residential property" barely constrains Pexels, which is
//    US-heavy, so the landlord posts kept getting American apartment blocks.
//    Naming British building types instead (terraced, semi-detached, Victorian,
//    Georgian) actually matches how UK photos get tagged.
function deriveImageQueries(story) {
  const text = (story.title + ' ' + story.description).toLowerCase();
  // Lead every category with a BUILDING, never an abstract object. A query
  // like "British house keys paperwork" names no building, so the UK_MARKERS
  // preference below just attaches "British" to whatever object happens to be
  // tagged that way — the capital gains post ended up with a photo of an
  // antique typewriter, captioned "Made in Leicester, England". Correctly
  // British, useless as a property hero. Building-type queries (terraced,
  // Georgian, Cotswold) reliably return real UK housing stock.
  if (/capital gains tax|inheritance tax/.test(text)) return ['Victorian terraced houses London', 'British semi detached houses street', 'English brick townhouses'];
  if (/stamp duty|\bsdlt\b|\blbtt\b|\bltt\b/.test(text)) return ['British estate agent sign house', 'UK house sold sign street', 'English suburban houses'];
  // Before the landlord branch: most EPC stories mention landlords too, and
  // the specific subject is the energy upgrade, not the landlord.
  if (/epc|energy efficiency|insulation|energy performance/.test(text)) return ['UK home insulation loft', 'British house energy meter', 'terraced houses roofs UK'];
  if (/buy-to-let|buy to let|landlord/.test(text)) return ['British terraced houses street', 'Victorian terraced houses London', 'UK semi detached houses', 'English brick townhouses'];
  if (/renter|tenant|rental market|rent prices/.test(text)) return ['British flat to let sign', 'London terraced street houses', 'UK apartment building brick'];
  if (/bank of england|interest rate/.test(text)) return ['Bank of England London', 'City of London financial district', 'London Threadneedle Street'];
  if (/remortgage/.test(text)) return ['British house keys door', 'UK mortgage paperwork signing', 'English semi detached house'];
  if (/first-time buyer|first time buyer/.test(text)) return ['British couple new home keys', 'UK first home moving boxes', 'English starter home exterior'];
  if (/mortgage/.test(text)) return ['British house keys door', 'UK estate agent window', 'English suburban street houses'];
  if (/conveyancing/.test(text)) return ['British terraced houses street', 'English suburban houses', 'UK house sold sign street'];
  return ['British terraced houses street', 'English suburban houses', 'UK residential street houses'];
}

// Pexels alt text is the only signal available about where a photo was taken.
// Reject the obviously-not-Britain ones, prefer the explicitly-British ones.
const NON_UK_MARKERS = /\$|dollar|usd|eur|euro|€|\b(usa|u\.s\.|america|american|new york|california|florida|miami|texas|chicago|los angeles|canada|canadian|australia|australian|dubai|singapore|tokyo|paris|berlin|madrid|amsterdam)\b/i;
const UK_MARKERS     = /\b(uk|u\.k\.|britain|british|england|english|london|scotland|scottish|wales|welsh|manchester|birmingham|liverpool|edinburgh|glasgow|bristol|leeds|terraced|terrace|semi-detached|victorian|georgian|cotswold|mews)\b/i;

async function fetchPexelsImage(queries, usedPhotoIds = new Set()) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) { console.log('  No PEXELS_API_KEY set — skipping hero image'); return null; }

  const seen = [];
  for (const query of queries) {
    const res = await fetch(
      // per_page=80 (the API max) rather than 8: a bigger pool means the
      // used-photo exclusion below has somewhere to go.
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=80&orientation=landscape&size=large`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) continue;

    const usable = data.photos.filter(p => {
      const text = `${p.alt || ''} ${p.photographer || ''}`;
      return !NON_UK_MARKERS.test(text) && !usedPhotoIds.has(p.id);
    });
    seen.push(...usable);

    // Explicitly British first; otherwise anything not obviously foreign.
    const british = usable.filter(p => UK_MARKERS.test(`${p.alt || ''} ${p.photographer || ''}`));
    const pick = british[0] || (queries.indexOf(query) === queries.length - 1 ? usable[0] : null);
    if (!pick) continue;

    const imgRes = await fetch(pick.src.large2x || pick.src.large);
    if (!imgRes.ok) continue;
    console.log(`  Image: "${query}" -> photo ${pick.id}${british[0] ? ' (UK-tagged)' : ''} — ${pick.alt || 'no alt'}`);
    return { buffer: Buffer.from(await imgRes.arrayBuffer()), photoId: pick.id };
  }

  // Nothing British-tagged anywhere: take any unused non-foreign result rather
  // than falling back to the site-wide default image on every post.
  const fallback = seen[0];
  if (!fallback) return null;
  const imgRes = await fetch(fallback.src.large2x || fallback.src.large);
  if (!imgRes.ok) return null;
  console.log(`  Image: fallback -> photo ${fallback.id} — ${fallback.alt || 'no alt'}`);
  return { buffer: Buffer.from(await imgRes.arrayBuffer()), photoId: fallback.id };
}

module.exports = { deriveImageQueries, fetchPexelsImage, NON_UK_MARKERS, UK_MARKERS };
