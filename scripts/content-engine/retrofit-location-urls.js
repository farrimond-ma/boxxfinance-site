/**
 * Retrofits relatedLocationUrls for blog posts that have an empty array
 * due to the service-field case mismatch bug in getPublishedLocations().
 *
 * The bug: locationPages.json stores service as "Bridging Finance" (title case)
 * but getPublishedLocations() compared against "bridging-finance" (slug form).
 * The fix is in publish-blog.js; this script back-fills the 6 affected posts.
 *
 * Run: node retrofit-location-urls.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const BLOG_FILE     = path.resolve(__dirname, '../../src/data/blogPosts.json');
const LOCATION_FILE = path.resolve(__dirname, '../../src/data/locationPages.json');
const DRY_RUN       = process.argv.includes('--dry-run');
const SITE_URL      = 'https://boxxfinance.co.uk';

function toSlug(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

function main() {
  const posts     = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));
  const locations = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));

  // Find posts with empty relatedLocationUrls
  const affected = posts.filter(p =>
    p.status === 'published' &&
    (!p.relatedLocationUrls || p.relatedLocationUrls.length === 0)
  );

  if (affected.length === 0) {
    console.log('No posts with empty relatedLocationUrls found.');
    return;
  }

  console.log(`Found ${affected.length} posts with empty relatedLocationUrls:\n`);

  // Build a map of which location URLs are already in use across all posts
  const usedUrls = new Set(
    posts.flatMap(p => p.relatedLocationUrls || [])
  );

  // For each affected post, find 4 published location pages matching the service
  // Prefer pages not already used by other posts; fall back to any matching page
  let changed = 0;
  for (const post of affected) {
    const serviceSlug = toSlug(post.service || '');

    const matching = locations.filter(l =>
      l.status === 'published' && toSlug(l.service) === serviceSlug
    );

    if (matching.length === 0) {
      console.log(`SKIP  ${post.slug} — no published ${post.service} location pages`);
      continue;
    }

    // Prefer pages not yet used by any post
    const fresh   = matching.filter(l => !usedUrls.has(`${SITE_URL}/locations/${l.slug}`));
    const pool    = fresh.length >= 4 ? fresh : matching;
    const picked  = pool.slice(0, 4);
    const urls    = picked.map(l => `${SITE_URL}/locations/${l.slug}`);

    console.log(`FIX   ${post.slug} (${post.service}):`);
    urls.forEach(u => console.log(`        ${u}`));

    if (!DRY_RUN) {
      post.relatedLocationUrls = urls;
      urls.forEach(u => usedUrls.add(u));
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
