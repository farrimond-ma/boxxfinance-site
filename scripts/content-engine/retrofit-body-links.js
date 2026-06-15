/**
 * Retrofits internal body links into existing blog posts.
 *
 * Two injections, both placed immediately before <h2>Frequently Asked Questions</h2>:
 *
 * 1. Related Guides block — for posts whose relatedBlogUrls are not yet
 *    linked in the body HTML. Uses keyword-rich anchor text derived from
 *    each post's title. Skipped if all blog URLs are already present.
 *
 * 2. Location paragraph — for ALL published posts: a single paragraph
 *    linking to the relatedLocationUrls with "[service] in [city]" anchors.
 *    Skipped individually if the post has no relatedLocationUrls, or if
 *    any location slug is already in the body.
 *
 * Idempotent — re-running is safe.
 * Run: node retrofit-body-links.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const BLOG_FILE     = path.resolve(__dirname, '../../src/data/blogPosts.json');
const LOCATION_FILE = path.resolve(__dirname, '../../src/data/locationPages.json');
const DRY_RUN       = process.argv.includes('--dry-run');
const SITE_URL      = 'https://boxxfinance.co.uk';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugFromUrl(url) {
  return url.split('/').pop().replace(/\/$/, '');
}

function toSlug(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

// Derive a keyword-rich anchor from a post title.
// We shorten and improve on the raw title so the anchor reads naturally
// in a sentence rather than looking like a navigation label.
function blogAnchor(title) {
  if (!title) return null;
  // Strip leading "The", "A", "An", "How to", "What is", "Why"
  let anchor = title
    .replace(/^(The|A|An|How to|What is|What are|Why|Ultimate Guide to|Ultimate Guide:|Guide to)\s+/i, '')
    .replace(/\s+in the UK\s*$/i, ' UK')
    .replace(/[:–—].*$/, '') // strip subtitle after colon/dash
    .trim();
  // Normalise "Uk" → "UK" (generation artefact in some older titles)
  anchor = anchor.replace(/\bUk\b/g, 'UK');
  // Cap at 60 chars
  if (anchor.length > 60) anchor = anchor.substring(0, anchor.lastIndexOf(' ', 57)) + '...';
  return anchor || title;
}

// Build anchor text for a location page.
// Bridging finance alternates between "bridging loans" and "bridging finance".
function locationAnchor(serviceLabel, city, idx) {
  const svc = toSlug(serviceLabel);
  if (svc === 'bridging-finance') {
    return idx % 2 === 0 ? `bridging loans in ${city}` : `bridging finance in ${city}`;
  }
  return `${serviceLabel.toLowerCase()} in ${city}`;
}

// Build the Related Guides HTML block
function buildRelatedGuidesBlock(post, allPosts, serviceUrl) {
  const blogUrls = post.relatedBlogUrls || [];
  if (blogUrls.length === 0) return null;

  // Only include URLs not already linked in the body
  const missing = blogUrls.filter(u => !post.content.includes(slugFromUrl(u)));
  if (missing.length === 0) return null;

  // Build link list with keyword-rich anchors
  const postBySlug = Object.fromEntries(allPosts.map(p => [p.slug, p]));
  const linkParts = missing.map(u => {
    const slug   = slugFromUrl(u);
    const ref    = postBySlug[slug];
    const anchor = ref ? blogAnchor(ref.title) : slug.replace(/-/g, ' ');
    return `<a href='${u}'>${anchor}</a>`;
  });

  // Build sentence
  let sentence;
  if (linkParts.length === 1) {
    sentence = `Read our guide to ${linkParts[0]} for more detail on this topic.`;
  } else if (linkParts.length === 2) {
    sentence = `Read our guides to ${linkParts[0]} and ${linkParts[1]} for more detail on this topic.`;
  } else {
    const last = linkParts.pop();
    sentence = `Read our guides to ${linkParts.join(', ')} and ${last} for more detail on this topic.`;
  }

  // Add a service page link to the block as well (second link in the block)
  const keyword = (post.keywords || '').split(',')[0].trim() || (post.service || '').toLowerCase();
  const serviceSentence = serviceUrl
    ? `<p>For specialist advice, explore our <a href='${serviceUrl}'>${keyword} solutions</a> or <a href='${SITE_URL}/chat-about-funding/${toSlug(post.service || 'commercial-finance')}'>compare ${keyword} deals</a>.</p>`
    : '';

  return `<h3>Related Guides</h3>\n<p>${sentence}</p>\n${serviceSentence}`.trim();
}

// Build the location paragraph HTML
function buildLocationParagraph(post, locBySlug) {
  const locUrls = post.relatedLocationUrls || [];
  if (locUrls.length === 0) return null;

  // Skip if any location slug is already in the body (already retrofitted)
  if (locUrls.some(u => post.content.includes(slugFromUrl(u)))) return null;

  const service = post.service || 'Commercial Finance';
  const linkParts = locUrls.map((u, idx) => {
    const slug = slugFromUrl(u);
    const loc  = locBySlug[slug];
    const city = loc ? loc.location : slug.replace(/^[^-]+-[^-]+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const anchor = locationAnchor(service, city, idx);
    return `<a href='${u}'>${anchor}</a>`;
  });

  let locationList;
  if (linkParts.length === 1) {
    locationList = linkParts[0];
  } else {
    const last = linkParts.pop();
    locationList = linkParts.join(', ') + ' and ' + last;
  }

  return `<p>Boxx Commercial Finance arranges ${service.toLowerCase()} across the UK, with advisers covering ${locationList}.</p>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const posts     = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));
  const locations = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
  const locBySlug = Object.fromEntries(locations.map(l => [l.slug, l]));

  let changed = 0;

  for (const post of posts) {
    if (post.status !== 'published' || !post.content) continue;

    const serviceUrl = post.service
      ? `${SITE_URL}/funding-solutions/${toSlug(post.service)}`
      : null;

    const FAQ_MARKER = '<h2>Frequently Asked Questions</h2>';
    // Some posts use slightly different FAQ heading — try a fallback
    const faqIdx = post.content.indexOf(FAQ_MARKER);
    if (faqIdx === -1) {
      console.log(`SKIP ${post.slug} — no FAQ heading found`);
      continue;
    }

    let injection = '';

    // 1. Related Guides block
    const guidesBlock = buildRelatedGuidesBlock(post, posts, serviceUrl);
    if (guidesBlock) injection += '\n\n' + guidesBlock;

    // 2. Location paragraph
    const locPara = buildLocationParagraph(post, locBySlug);
    if (locPara) injection += '\n\n' + locPara;

    if (!injection) continue;

    console.log(`FIX  ${post.slug}${guidesBlock ? ' [+guides]' : ''}${locPara ? ' [+locations]' : ''}`);

    if (!DRY_RUN) {
      post.content = post.content.slice(0, faqIdx) + injection.trim() + '\n\n' + post.content.slice(faqIdx);
    }
    changed++;
  }

  if (!DRY_RUN && changed > 0) {
    fs.writeFileSync(BLOG_FILE, JSON.stringify(posts, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${BLOG_FILE}`);
  }
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Posts updated: ${changed}`);
}

main();
