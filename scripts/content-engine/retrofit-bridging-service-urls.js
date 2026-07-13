// One-off migration (2026-07): the bridging-finance service page was renamed
// to bridging-loans (public-facing slug/title only — the internal service
// identity "Bridging Finance" is unchanged, used by SERVICE_FILTER etc).
// Rewrites every in-content link to the old funding-solutions/chat-about-funding
// URLs across blogPosts.json and locationPages.json. Old URLs still work via
// a 301 in public/.htaccess; this keeps new content from linking to a redirect.
const fs = require('fs');
const path = require('path');

const BLOG_FILE = path.join(__dirname, '../../src/data/blogPosts.json');
const LOC_FILE = path.join(__dirname, '../../src/data/locationPages.json');

const swapLinks = (s) => (s || '')
  .replace(/\/funding-solutions\/bridging-finance/g, '/funding-solutions/bridging-loans')
  .replace(/\/chat-about-funding\/bridging-finance/g, '/chat-about-funding/bridging-loans');

function fix(file, label) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  let edits = 0;
  for (const item of items) {
    if (item && item.content && (item.content.includes('/funding-solutions/bridging-finance') || item.content.includes('/chat-about-funding/bridging-finance'))) {
      item.content = swapLinks(item.content);
      edits++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
  console.log(`${label}: ${edits} item(s) had links rewritten`);
}

fix(BLOG_FILE, 'blogPosts.json');
fix(LOC_FILE, 'locationPages.json');
