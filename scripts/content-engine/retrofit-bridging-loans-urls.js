// One-off migration (2026-07-06): retarget location pages from "bridging finance"
// to the higher-volume consumer term "bridging loans".
//   - slugs:  bridging-finance-<town>  ->  bridging-loans-<town>
//   - titles/metaTitles/metaDescriptions: "Bridging Finance" -> "Bridging Loans"
//   - all internal links to the old URLs (location + blog content, relatedLocationUrls)
// Old URLs are 301-redirected via public/.htaccess. Operates on the local
// checkout — run once, review the diff, commit.
const fs = require('fs');
const path = require('path');

const LOC_FILE  = path.join(__dirname, '../../src/data/locationPages.json');
const BLOG_FILE = path.join(__dirname, '../../src/data/blogPosts.json');

const swapTerm = (s) => (s || '')
  .replace(/Bridging Finance/g, 'Bridging Loans')
  .replace(/bridging finance/g, 'bridging loans')
  .replace(/BRIDGING FINANCE/g, 'BRIDGING LOANS');

const swapLinks = (s) => (s || '').replace(/\/locations\/bridging-finance-/g, '/locations/bridging-loans-');

// ── Location pages ────────────────────────────────────────────────────────────
const pages = JSON.parse(fs.readFileSync(LOC_FILE, 'utf8'));
let renamed = 0, locLinkEdits = 0;

for (const p of pages) {
  if ((p.slug || '').startsWith('bridging-finance-')) {
    p.slug = p.slug.replace(/^bridging-finance-/, 'bridging-loans-');
    p.title = swapTerm(p.title);
    p.metaTitle = swapTerm(p.metaTitle);
    p.metaDescription = swapTerm(p.metaDescription);
    // service field stays "Bridging Finance" — it's the internal identity used
    // by SERVICE_FILTER and related-content grouping, not a rendered string.
    if (p.faqSchema) p.faqSchema = JSON.parse(swapTerm(JSON.stringify(p.faqSchema)));
    renamed++;
  }
  if (p.content && p.content.includes('/locations/bridging-finance-')) {
    p.content = swapLinks(p.content);
    locLinkEdits++;
  }
}

fs.writeFileSync(LOC_FILE, JSON.stringify(pages, null, 2));
console.log(`locationPages.json: ${renamed} pages renamed to bridging-loans-*, ${locLinkEdits} pages had in-content links rewritten`);

// ── Blog posts: links only (content already uses "bridging loan" naturally) ───
const posts = JSON.parse(fs.readFileSync(BLOG_FILE, 'utf8'));
let blogContentEdits = 0, blogRelatedEdits = 0;

for (const post of posts) {
  if (post.content && post.content.includes('/locations/bridging-finance-')) {
    post.content = swapLinks(post.content);
    blogContentEdits++;
  }
  if (Array.isArray(post.relatedLocationUrls)) {
    const before = JSON.stringify(post.relatedLocationUrls);
    post.relatedLocationUrls = post.relatedLocationUrls.map(swapLinks);
    if (JSON.stringify(post.relatedLocationUrls) !== before) blogRelatedEdits++;
  }
}

fs.writeFileSync(BLOG_FILE, JSON.stringify(posts, null, 2));
console.log(`blogPosts.json: ${blogContentEdits} posts had in-content links rewritten, ${blogRelatedEdits} had relatedLocationUrls updated`);
