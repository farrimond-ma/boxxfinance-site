/**
 * Boxx Finance — Internal Link Auditor
 *
 * Parses every <a href> in every published blog post and location page,
 * classifies each link, and reports:
 *   - Broken internal links (href resolves to a 404 on this site)
 *   - Generic / weak anchor text (click here, read more, learn more, here, this page, find out more)
 *   - Links pointing to the bare /funding-solutions (now real) or other misrouted targets
 *   - Posts with no service-page internal link at all
 *   - Posts with no related-article internal link at all
 *
 * Output: JSON report saved to link-audit-report.json
 *
 * Run: node audit-internal-links.js
 */

const fs   = require('fs');
const path = require('path');

// ── Data files ──────────────────────────────────────────────────────────────
const ROOT         = path.resolve(__dirname, '../../');
const BLOG_FILE    = path.join(ROOT, 'src/data/blogPosts.json');
const LOC_FILE     = path.join(ROOT, 'src/data/locationPages.json');
const SERVICES_SRC = path.join(ROOT, 'src/data/services.jsx');

const blogPosts    = JSON.parse(fs.readFileSync(BLOG_FILE,  'utf8'));
const locationPages = JSON.parse(fs.readFileSync(LOC_FILE, 'utf8'));

// Extract service slugs from services.jsx source
const servicesSrc   = fs.readFileSync(SERVICES_SRC, 'utf8');
const serviceSlugsRe = /'([a-z0-9-]+)':\s*\{\s*title:/g;
let m;
const serviceSlugs = new Set();
while ((m = serviceSlugsRe.exec(servicesSrc))) serviceSlugs.add(m[1]);

// Known valid routes
const VALID_PATHS = new Set([
    '/',
    '/insights',
    '/funding-solutions',                // NOW a real page
    '/chat-about-funding',
    '/privacy-policy',
    '/legal-disclaimer',
    '/terms-and-conditions',
    '/uk-sme-funding-index',
    '/dashboard',
]);
// Add blog slugs
const blogSlugSet = new Set(blogPosts.filter(p => p.status === 'published').map(p => p.slug));
blogPosts.filter(p => p.status === 'published').forEach(p => VALID_PATHS.add(`/insights/${p.slug}`));
// Add location slugs
const locationSlugSet = new Set(locationPages.map(l => l.slug));
locationPages.forEach(l => VALID_PATHS.add(`/locations/${l.slug}`));
// Add service page slugs
serviceSlugs.forEach(s => VALID_PATHS.add(`/funding-solutions/${s}`));

const SITE_ORIGINS = ['https://boxxfinance.co.uk', 'http://boxxfinance.co.uk', ''];

// ── Helpers ──────────────────────────────────────────────────────────────────

const GENERIC_PATTERNS = [
    /^(click here|read more|learn more|find out more|here|this page|this article|see here|view here|more info|more information|get in touch|contact us|apply now|find out|visit|continue reading)\.?$/i,
    /^read article\.?$/i,
    /^read more\.?$/i,
    /^full range of uk business funding solutions\.?$/i,
];

function isGenericAnchor(text) {
    const t = text.replace(/\s*→\s*$/, '').trim();
    if (!t || t.length < 2) return true;
    return GENERIC_PATTERNS.some(re => re.test(t));
}

// anchor text strength: 'strong' | 'ok' | 'weak' | 'generic'
function anchorQuality(text) {
    const t = text.replace(/\s*→\s*$/, '').trim();
    if (!t || t.length < 2) return 'generic';
    if (isGenericAnchor(t)) return 'generic';
    const wordCount = t.split(/\s+/).length;
    if (wordCount < 2) return 'weak';       // single word — not enough context
    if (wordCount > 12) return 'weak';      // full sentence — too diluted
    return 'strong';
}

function normaliseHref(href = '', sourceSlug = '') {
    // Strip domain if present
    let path = href;
    for (const origin of SITE_ORIGINS) {
        if (origin && path.startsWith(origin)) {
            path = path.slice(origin.length);
            break;
        }
    }
    // Remove anchor fragment and query string
    path = path.replace(/#.*$/, '').replace(/\?.*$/, '').replace(/\/+$/, '');
    if (!path) path = '/';
    return path;
}

function isInternal(href = '') {
    if (!href) return false;
    if (href.startsWith('#')) return false;         // page anchor only
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (href.startsWith('http') && !href.includes('boxxfinance.co.uk')) return false;
    return true;
}

// Extract all <a href="...">text</a> from HTML
function extractLinks(html = '') {
    const re = /<a\s[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
    const links = [];
    let mm;
    while ((mm = re.exec(html))) {
        const href    = mm[1].trim();
        const rawText = mm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        links.push({ href, anchorText: rawText });
    }
    return links;
}

function classifyPath(normPath) {
    if (!normPath || normPath === '/') return 'homepage';
    if (VALID_PATHS.has(normPath)) {
        if (normPath.startsWith('/funding-solutions/')) return 'service-page';
        if (normPath === '/funding-solutions') return 'funding-hub';
        if (normPath.startsWith('/insights/')) return 'blog-post';
        if (normPath.startsWith('/locations/')) return 'location-page';
        return 'static-page';
    }
    return 'broken';
}

// ── Main audit ───────────────────────────────────────────────────────────────

const report = {
    generated: new Date().toISOString(),
    summary: {},
    posts: [],
};

let totalLinks       = 0;
let totalBroken      = 0;
let totalGeneric     = 0;
let totalWeak        = 0;
let totalStrong      = 0;
let postsNoService   = 0;
let postsNoRelated   = 0;

const publishedPosts = blogPosts.filter(p => p.status === 'published');

for (const post of publishedPosts) {
    const links = extractLinks(post.content || '');
    const internalLinks = links.filter(l => isInternal(l.href));

    const issues = [];
    let hasServiceLink   = false;
    let hasRelatedLink   = false;

    const linkDetails = internalLinks.map(l => {
        const normPath = normaliseHref(l.href, post.slug);
        const kind     = classifyPath(normPath);
        const quality  = anchorQuality(l.anchorText);

        if (kind === 'service-page' || kind === 'funding-hub') hasServiceLink = true;
        if (kind === 'blog-post' && normPath !== `/insights/${post.slug}`) hasRelatedLink = true;

        const linkIssues = [];
        if (kind === 'broken')   linkIssues.push('BROKEN_LINK');
        if (quality === 'generic') linkIssues.push('GENERIC_ANCHOR');
        if (quality === 'weak')  linkIssues.push('WEAK_ANCHOR');

        totalLinks++;
        if (kind === 'broken')     totalBroken++;
        if (quality === 'generic') totalGeneric++;
        if (quality === 'weak')    totalWeak++;
        if (quality === 'strong')  totalStrong++;

        if (linkIssues.length) issues.push({ href: l.href, anchorText: l.anchorText, kind, quality, problems: linkIssues });

        return { href: l.href, normPath, kind, anchorText: l.anchorText, quality };
    });

    if (!hasServiceLink)  postsNoService++;
    if (!hasRelatedLink)  postsNoRelated++;

    const postSummary = {
        slug: post.slug,
        title: post.title,
        service: post.service || '',
        internalLinkCount: internalLinks.length,
        hasServiceLink,
        hasRelatedLink,
        issues,
        allInternalLinks: linkDetails,
    };

    report.posts.push(postSummary);
}

report.summary = {
    publishedPosts: publishedPosts.length,
    totalInternalLinks: totalLinks,
    broken: totalBroken,
    genericAnchor: totalGeneric,
    weakAnchor: totalWeak,
    strongAnchor: totalStrong,
    postsWithNoServiceLink: postsNoService,
    postsWithNoRelatedArticleLink: postsNoRelated,
    postsWithAnyIssue: report.posts.filter(p => p.issues.length > 0).length,
};

const outFile = path.join(__dirname, 'link-audit-report.json');
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

// ── Console summary ──────────────────────────────────────────────────────────
console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║   Boxx Finance — Internal Link Audit              ║');
console.log('╚════════════════════════════════════════════════════╝\n');
console.log(`Posts audited       : ${report.summary.publishedPosts}`);
console.log(`Total internal links: ${report.summary.totalInternalLinks}`);
console.log(`  Broken links      : ${report.summary.broken}`);
console.log(`  Generic anchor    : ${report.summary.genericAnchor}`);
console.log(`  Weak anchor       : ${report.summary.weakAnchor}`);
console.log(`  Strong anchor     : ${report.summary.strongAnchor}`);
console.log(`Posts with no service-page link : ${report.summary.postsWithNoServiceLink}`);
console.log(`Posts with no related-post link : ${report.summary.postsWithNoRelatedArticleLink}`);
console.log(`Posts with any issue            : ${report.summary.postsWithAnyIssue}\n`);

console.log('── Issues by post ──────────────────────────────────');
for (const p of report.posts) {
    if (!p.issues.length && p.hasServiceLink && p.hasRelatedLink) continue;
    const flags = [];
    if (!p.hasServiceLink) flags.push('NO_SERVICE_LINK');
    if (!p.hasRelatedLink) flags.push('NO_RELATED_LINK');
    p.issues.forEach(i => flags.push(...i.problems.map(pb => `${pb}(${i.href.slice(0,50)})`)));
    console.log(`  ${p.slug}`);
    console.log(`    flags: ${[...new Set(flags)].join(', ')}`);
}

console.log(`\nFull report: ${outFile}\n`);
