/**
 * listing-source.js
 *
 * Reads news from sites that have no RSS feed, by scraping their news listing page.
 * Added 2026-09-19 for LandlordZONE and the NRLA, two of the most landlord-focused UK
 * publications, neither of which publishes a feed and whose sitemaps carry no dates.
 *
 * A "listing" entry in src/data/personalFinanceNewsFeeds.json looks like:
 *   { "type": "listing", "url": "<news listing page>", "articlePattern": "<regex on the
 *     URL path>", "name": "...", "status": "active" }
 *
 * fetchListingItems() returns items in the same shape parseRSS() does
 * ({ title, link, description, pubDate }), so the publisher treats them exactly like
 * feed items. Articles with no machine-readable publish date are DROPPED rather than
 * dated "now": an undated article would otherwise look brand new on every run.
 * Duplicates are handled downstream as for RSS (the 2-day recency window plus the
 * covered-stories tracking file).
 */

const UA = 'Mozilla/5.0 (compatible; BoxxFinanceBot/1.0; +https://boxxfinance.co.uk)';
const MAX_ARTICLES = 15; // newest links on the listing page; each costs one page fetch

function decode(str) {
  return String(str || '')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Article URLs from the listing page, in page order (newest first on both sites), deduped.
function extractArticleLinks(html, listingUrl, articlePattern) {
  const origin = new URL(listingUrl).origin;
  const pattern = new RegExp(articlePattern);
  const seen = new Set();
  const links = [];
  for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
    let u;
    try { u = new URL(m[1], origin); } catch { continue; }
    if (u.origin !== origin || !pattern.test(u.pathname)) continue;
    const href = origin + u.pathname;
    if (!seen.has(href)) { seen.add(href); links.push(href); }
  }
  return links;
}

function meta(html, prop) {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'));
  return decode((a && a[1]) || (b && b[1]) || '');
}

function publishedDate(html) {
  const candidates = [
    (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1],
    meta(html, 'article:published_time'),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d)) return d;
  }
  return null;
}

async function fetchListingItems(source) {
  const listingHtml = await get(source.url);
  const links = extractArticleLinks(listingHtml, source.url, source.articlePattern).slice(0, MAX_ARTICLES);
  const items = [];
  let undated = 0;
  for (const link of links) {
    try {
      const html = await get(link);
      const pubDate = publishedDate(html);
      const title = meta(html, 'og:title') || decode((html.match(/<title>([^<]*)<\/title>/i) || [])[1]);
      if (!pubDate) { undated++; continue; }
      if (!title) continue;
      const description = (meta(html, 'og:description') || meta(html, 'description')).substring(0, 500);
      items.push({ title, link, description, pubDate });
    } catch { /* one broken article shouldn't sink the source */ }
  }
  return { items, linksFound: links.length, undated };
}

module.exports = { fetchListingItems, extractArticleLinks, publishedDate };
