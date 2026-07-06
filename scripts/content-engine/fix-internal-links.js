/**
 * Boxx Finance — Internal Link Repair
 *
 * Applies a comprehensive set of internal linking fixes to blogPosts.json:
 *
 *   1. Fixes broken /about-us links → /#about
 *   2. Fixes generic "here" anchor texts on chat-about-funding and service-page links
 *   3. Fixes "full range of UK business funding solutions" anchors to use
 *      service-specific keyword-rich text where possible
 *   4. Adds in-body "Related Guides" section to posts that have no contextual
 *      cross-article links within the article body (38 of 41 posts)
 *   5. Adds a service-page link inside the Related Guides block for posts that
 *      currently have no link to any /funding-solutions/:slug page
 *
 * Based on 2026 SEO / GEO / AEO internal-linking best practice:
 *   - Anchor text: descriptive, 2-5 words, keyword-rich
 *   - Surrounding context: the 15-25 words around a link carry topical weight
 *   - Pillar-cluster structure: each article links to its parent service page
 *   - Cross-article links: in-body contextual links signal topical depth to
 *     both traditional search engines and AI answer/generative engines
 *
 * Run: node fix-internal-links.js [--dry-run]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const fs   = require('fs');
const path = require('path');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';
const SITE_URL     = 'https://boxxfinance.co.uk';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

// ── Service inference ─────────────────────────────────────────────────────────

const SLUG_SERVICE_MAP = [
    [/bridging|chain.break|auction.purchas/,            'bridging-finance'],
    [/development.finance|property.development/,         'development-finance'],
    [/commercial.mortgage|semi.commercial|leasehold/,    'commercial-mortgages'],
    [/invoice.finance|factoring|invoice.discounting/,    'invoice-finance'],
    [/asset.refin/,                                       'asset-refinance'],
    [/asset.finance|hire.purchase|leasing|machinery/,    'asset-finance'],
    [/working.capital|revolving.credit|stock.finance/,   'working-capital'],
    [/trade.finance|letter.of.credit|supply.chain/,      'trade-finance'],
    [/cashflow|merchant.cash|revenue.based/,             'merchant-cash-advance'],
    [/structured.finance|mezzanine|spv|whole.loan/,      'structured-finance'],
    [/\btax\b|vat.fund/,                                  'tax-vat-funding'],
    [/business.loan|unsecured|startup.loan|sme|smes/,    'business-loans'],
];

// Readable display title per service slug
const SERVICE_TITLE = {
    'bridging-finance':      'Bridging Finance',
    'development-finance':   'Development Finance',
    'commercial-mortgages':  'Commercial Mortgages',
    'invoice-finance':       'Invoice Finance',
    'asset-finance':         'Asset Finance',
    'asset-refinance':       'Asset Refinance',
    'working-capital':       'Working Capital',
    'trade-finance':         'Trade Finance',
    'merchant-cash-advance': 'Merchant Cash Advance',
    'structured-finance':    'Structured Finance',
    'tax-vat-funding':       'Tax and VAT Funding',
    'business-loans':        'Business Loans',
};

// Map Boxx service field (from content engine) → service slug
const SERVICE_FIELD_MAP = {
    'Bridging Finance':    'bridging-finance',
    'Development Finance': 'development-finance',
    'Commercial Mortgage': 'commercial-mortgages',
    'Invoice Finance':     'invoice-finance',
    'Asset Finance':       'asset-finance',
    'Working Capital':     'working-capital',
    'Trade Finance':       'trade-finance',
    'Structured Finance':  'structured-finance',
    'Business Loans':      'business-loans',
    'Merchant Cash Advance': 'merchant-cash-advance',
    'Tax & VAT Funding':   'tax-vat-funding',
    'Asset Refinance':     'asset-refinance',
};

function inferServiceSlug(post) {
    // 1. Use post.service field if set
    if (post.service && SERVICE_FIELD_MAP[post.service]) return SERVICE_FIELD_MAP[post.service];
    // 2. Use category field
    if (post.category && SERVICE_FIELD_MAP[post.category]) return SERVICE_FIELD_MAP[post.category];
    // 3. Pattern-match against slug + title
    const text = ((post.slug || '') + ' ' + (post.title || '')).toLowerCase();
    for (const [re, svc] of SLUG_SERVICE_MAP) {
        if (re.test(text)) return svc;
    }
    // 4. Pattern-match against first 400 chars of content
    const snippet = (post.content || '').replace(/<[^>]+>/g, ' ').slice(0, 400).toLowerCase();
    for (const [re, svc] of SLUG_SERVICE_MAP) {
        if (re.test(snippet)) return svc;
    }
    return null;
}

// ── Anchor text generation ─────────────────────────────────────────────────────

function blogAnchorText(post) {
    const keywordList = Array.isArray(post.keywords)
        ? post.keywords
        : (post.keywords || '').split(',');
    const kw = (keywordList[0] || '').trim();
    if (kw && kw.length > 3) {
        return kw.replace(/\b\w/g, c => c.toUpperCase());
    }
    return post.title;
}

// Varied preamble templates to avoid duplicate-content penalty across articles
const PREAMBLES = [
    (a1, u1, a2, u2) =>
        `For more on this topic, explore our guide to <a href='${u1}'>${a1}</a> and read our article on <a href='${u2}'>${a2}</a>.`,
    (a1, u1, a2, u2) =>
        `You may also find these guides useful: our overview of <a href='${u1}'>${a1}</a> and our practical guide to <a href='${u2}'>${a2}</a>.`,
    (a1, u1, a2, u2) =>
        `If you found this article useful, read our guide to <a href='${u1}'>${a1}</a> and our overview of <a href='${u2}'>${a2}</a>.`,
    (a1, u1, a2, u2) =>
        `Explore our guide to <a href='${u1}'>${a1}</a> and our article on <a href='${u2}'>${a2}</a> for further detail on this topic.`,
];

let preambleIdx = 0;
function nextPreamble(a1, u1, a2, u2) {
    const fn = PREAMBLES[preambleIdx % PREAMBLES.length];
    preambleIdx++;
    return fn(a1, u1, a2, u2);
}

// ── HTML helpers ────────────────────────────────────────────────────────────────

// Insert HTML snippet before the first <h2>Frequently Asked|FAQ</h2> heading
// or, failing that, append at the very end.
function insertBeforeFaq(content, snippet) {
    // Guard: don't insert if already present
    if (content.includes('Related Guides</h3>')) return content;

    const faqRe = /<h2[^>]*>\s*(Frequently Asked Questions?|FAQ)\s*<\/h2>/i;
    const match = faqRe.exec(content);
    if (match) {
        return content.slice(0, match.index) + snippet + '\n' + content.slice(match.index);
    }
    return content + '\n' + snippet;
}

// Build the Related Guides HTML block for a post
function buildRelatedGuidesBlock(relatedPosts, serviceSlug) {
    const postLinks = relatedPosts.slice(0, 2).map(rp => ({
        url: `${SITE_URL}/insights/${rp.slug}`,
        anchor: blogAnchorText(rp),
    }));

    let para;
    if (postLinks.length >= 2) {
        para = nextPreamble(
            postLinks[0].anchor, postLinks[0].url,
            postLinks[1].anchor, postLinks[1].url
        );
    } else if (postLinks.length === 1) {
        para = `You may also find our guide to <a href='${postLinks[0].url}'>${postLinks[0].anchor}</a> useful.`;
    } else {
        para = '';
    }

    // Service link (only include if this is for a post that needs one)
    const svcLine = serviceSlug
        ? `<p>For specialist advice, visit our <a href='${SITE_URL}/funding-solutions/${serviceSlug}'>${SERVICE_TITLE[serviceSlug] || serviceSlug} solutions</a> page or <a href='${SITE_URL}/chat-about-funding'>speak to a commercial finance specialist</a>.</p>`
        : '';

    return `<h3>Related Guides</h3>\n<p>${para}</p>\n${svcLine}`.trim();
}

// ── Fix: broken /about-us links ────────────────────────────────────────────────

function fixAboutUsLinks(content) {
    // Replace href='https://boxxfinance.co.uk/about-us' and href="..." variants
    return content
        .replace(/href=['"]https?:\/\/boxxfinance\.co\.uk\/about-us['"]/gi,
                 `href='${SITE_URL}/#about'`)
        .replace(/href=['"]\/about-us['"]/gi,
                 `href='/#about'`);
}

// ── Fix: generic "here" anchors ────────────────────────────────────────────────

// Replace >here< anchor on chat-about-funding links
function fixHereAnchors(content, post) {
    // "here" as the entire anchor text on /chat-about-funding links
    content = content.replace(
        /<a\s+([^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/chat-about-funding['"][^>]*)>here<\/a>/gi,
        (_m, attrs) => `<a ${attrs}>speak to a commercial finance specialist</a>`
    );
    // "here" as anchor on /funding-solutions/:slug links
    content = content.replace(
        /<a\s+([^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/funding-solutions\/([a-z0-9-]+)['"][^>]*)>here<\/a>/gi,
        (_m, attrs, svcSlug) => {
            const title = SERVICE_TITLE[svcSlug] || svcSlug;
            return `<a ${attrs}>${title} solutions</a>`;
        }
    );
    // "here" as anchor on relative /funding-solutions/:slug links
    content = content.replace(
        /<a\s+([^>]*href=['"]\/funding-solutions\/([a-z0-9-]+)['"][^>]*)>here<\/a>/gi,
        (_m, attrs, svcSlug) => {
            const title = SERVICE_TITLE[svcSlug] || svcSlug;
            return `<a ${attrs}>${title} solutions</a>`;
        }
    );
    return content;
}

// ── Fix: overly-generic "full range of UK business funding solutions" anchor ──

function fixFundingHubAnchors(content) {
    // On links to specific /funding-solutions/:slug pages, replace with service-specific anchor
    content = content.replace(
        /<a\s+([^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/funding-solutions\/([a-z0-9-]+)['"][^>]*)>full range of UK business funding solutions<\/a>/gi,
        (_m, attrs, svcSlug) => {
            const title = SERVICE_TITLE[svcSlug] || svcSlug;
            return `<a ${attrs}>${title} solutions</a>`;
        }
    );
    // On links to the hub page itself, use "UK commercial funding solutions" which is more specific
    content = content.replace(
        /<a\s+([^>]*href=['"]https?:\/\/boxxfinance\.co\.uk\/funding-solutions['"][^>]*)>full range of UK business funding solutions<\/a>/gi,
        (_m, attrs) => `<a ${attrs}>UK commercial funding solutions</a>`
    );
    return content;
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────

async function getBlogPostsFile() {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
    // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
    const content = data.content && data.encoding !== 'none'
      ? data.content
      : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
    return { sha: data.sha, posts: JSON.parse(Buffer.from(content, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, message) {
    const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
    await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
        message, sha: latest.sha, branch: 'main',
        content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
    });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   Boxx Finance — Internal Link Repair                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    if (isDryRun) console.log('⚠  DRY RUN — no changes pushed\n');

    const { posts } = await getBlogPostsFile();
    const publishedPosts = posts.filter(p => p.status === 'published');

    // Build service groups — service slug → array of published post objects (excluding self later)
    const serviceGroups = {};
    publishedPosts.forEach(p => {
        const svc = inferServiceSlug(p);
        if (svc) {
            if (!serviceGroups[svc]) serviceGroups[svc] = [];
            serviceGroups[svc].push(p);
        }
    });

    // Slugs with in-body related-post links already (from audit)
    const ALREADY_HAS_RELATED = new Set([
        'bridging-loan-calculator-uk',     // RelatedArticles sidebar, but also now in body? let's not double up
    ]);
    // Actually the audit showed bridging-loan-calculator-uk has NO_RELATED_LINK too — so include it.
    // The 3 posts that DO have related links (none in NO_RELATED_LINK list from audit):
    //   The audit had only 3 posts NOT in the NO_RELATED_LINK list.
    // Let's recompute from posts themselves after we build the audit inline.

    // Posts with NO in-body related-article link — determined by extracting <a> from content
    function hasInBodyRelatedLink(post) {
        const re = /<a\s[^>]*href=['"](?:https?:\/\/boxxfinance\.co\.uk)?\/insights\/([^'"]+)['"]/gi;
        let m;
        while ((m = re.exec(post.content || ''))) {
            const slug = m[1];
            if (slug !== post.slug) return true;
        }
        return false;
    }

    function hasServiceLink(post) {
        return /<a\s[^>]*href=['"](?:https?:\/\/boxxfinance\.co\.uk)?\/funding-solutions(?:\/[^'"]+)?['"]/i.test(post.content || '');
    }

    let fixCount = 0;
    const changeLog = [];

    for (const post of publishedPosts) {
        if (!post.content) continue;
        let content = post.content;
        const before = content;
        const fixes = [];

        // 1. Fix broken /about-us links
        const fixed1 = fixAboutUsLinks(content);
        if (fixed1 !== content) {
            fixes.push('fixed-about-us-link');
            content = fixed1;
        }

        // 2. Fix generic "here" anchors
        const fixed2 = fixHereAnchors(content, post);
        if (fixed2 !== content) {
            fixes.push('fixed-here-anchor');
            content = fixed2;
        }

        // 3. Fix "full range of UK business funding solutions" anchors
        const fixed3 = fixFundingHubAnchors(content);
        if (fixed3 !== content) {
            fixes.push('fixed-funding-hub-anchor');
            content = fixed3;
        }

        // 4 & 5. Add Related Guides section if post has no in-body related-post links
        const missingRelated  = !hasInBodyRelatedLink(content);
        const missingService  = !hasServiceLink(content);

        if (missingRelated) {
            // Find related posts from same service group (excluding self)
            const svc = inferServiceSlug(post);
            const group = (svc && serviceGroups[svc]) ? serviceGroups[svc].filter(p => p.slug !== post.slug) : [];

            // For posts with relatedBlogUrls, prefer those (they're topically curated)
            let relatedPool;
            if (post.relatedBlogUrls && post.relatedBlogUrls.length > 0) {
                const slugs = post.relatedBlogUrls.map(u => u.replace(/\/+$/, '').split('/').pop());
                relatedPool = slugs
                    .map(s => publishedPosts.find(p => p.slug === s && p.slug !== post.slug))
                    .filter(Boolean);
            } else {
                relatedPool = group;
            }

            // Fallback: if still < 2, supplement from most-recent other posts
            if (relatedPool.length < 2) {
                const others = publishedPosts
                    .filter(p => p.slug !== post.slug && !relatedPool.includes(p))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                while (relatedPool.length < 2 && others.length > 0) {
                    relatedPool.push(others.shift());
                }
            }

            // Only include service link in Related Guides if post is also missing a service link
            const svcForBlock = missingService ? svc : null;

            const block = buildRelatedGuidesBlock(relatedPool, svcForBlock);
            if (block) {
                content = insertBeforeFaq(content, block);
                fixes.push(`added-related-guides${svcForBlock ? '+service-link' : ''}`);
            }
        } else if (missingService) {
            // Has related links, but no service link — add a standalone service link sentence
            const svc = inferServiceSlug(post);
            if (svc && SERVICE_TITLE[svc]) {
                const svcSentence = `\n<p>For specialist advice on <a href='${SITE_URL}/funding-solutions/${svc}'>${SERVICE_TITLE[svc]} solutions</a>, speak to the Boxx team via our <a href='${SITE_URL}/chat-about-funding'>commercial finance enquiry form</a>.</p>`;
                content = insertBeforeFaq(content, svcSentence);
                fixes.push('added-service-link');
            }
        }

        if (content !== before) {
            const idx = posts.findIndex(p => p.slug === post.slug);
            posts[idx] = { ...post, content };
            fixCount++;
            changeLog.push({ slug: post.slug, fixes });
            console.log(`✓ ${post.slug}`);
            fixes.forEach(f => console.log(`    ${f}`));
        }
    }

    console.log(`\n── Summary ───────────────────────────────────────────`);
    console.log(`Posts modified: ${fixCount} / ${publishedPosts.length}`);

    if (isDryRun) {
        console.log('\n[DRY RUN] No changes pushed.\n');
        return;
    }

    if (fixCount === 0) {
        console.log('\nNothing to change. Exiting.\n');
        return;
    }

    console.log('\nPushing updated blogPosts.json to GitHub...');
    await pushBlogPostsFile(posts, `fix: sitewide internal link repair — ${fixCount} posts (broken links, generic anchors, related guides, service links)`);
    console.log(`✅ Done. ${fixCount} posts updated and pushed.\n`);
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
