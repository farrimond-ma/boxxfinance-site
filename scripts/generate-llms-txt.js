import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Boxx Finance — llms.txt generator
 *
 * Writes /llms.txt: a plain-text index of the site for large language models,
 * per the llmstxt.org convention. It lets an LLM understand what Boxx does and
 * which pages matter without crawling 313 URLs.
 *
 * Why this exists:
 *   1. Lighthouse's "Agentic Browsing" category checks for llms.txt at the
 *      domain root. Boxx scored 2/3 because it was missing.
 *   2. /llms.txt previously returned HTTP 200 with Content-Type: text/html —
 *      the SPA catch-all serving index.html for an unknown path. A soft 404
 *      wearing a 200, which is worse than a clean miss.
 *   3. It directly serves the AI-citation strategy: a compact, accurate index is
 *      exactly what answer engines consume.
 *
 * Generated from the same real data as the sitemap — never hand-maintained, so
 * it cannot drift out of date. Run via `npm run llms` in the build.
 */

const BASE_URL = 'https://boxxfinance.co.uk';
const OUTPUT_PUBLIC = path.join(__dirname, '../public/llms.txt');
const MAX_GUIDES = 30;

const readFile = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

// Services live in a JSX module; extract slug + title without parsing JSX
// (same approach generate-sitemap.js uses, kept deliberately consistent).
function getServices() {
    const src = readFile('../src/data/services.jsx');
    const services = [];
    const re = /^\s{4}'([a-z0-9-]+)':\s*\{/gm;
    // Single-quoted JS strings may contain escaped quotes (e.g. 'the asset\'s
    // life'). A naive [^']+ stops at the backslash and leaves a trailing "\",
    // so match escape sequences explicitly and unescape after.
    const jsString = (key) => new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`);
    const unescape = (s) => (s || '').replace(/\\(['"\\])/g, '$1');

    let m;
    while ((m = re.exec(src)) !== null) {
        const slug = m[1];
        const rest = src.slice(m.index, m.index + 1600);
        const title = unescape((rest.match(jsString('title')) || [])[1]) || slug;
        const desc = unescape((rest.match(jsString('metaDescription')) || [])[1]) || '';
        services.push({ slug, title, desc });
    }
    return services;
}

function getPublishedPosts() {
    const posts = JSON.parse(readFile('../src/data/blogPosts.json'));
    return posts
        .filter((p) => p.status === 'published' && p.slug && p.title)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function getPublishedLocations() {
    const locs = JSON.parse(readFile('../src/data/locationPages.json'));
    return locs.filter((l) => l.status === 'published' && l.slug);
}

// Keep descriptions to one clean sentence — llms.txt is an index, not a corpus.
function oneLine(text, max = 160) {
    if (!text) return '';
    const clean = String(text).replace(/\s+/g, ' ').replace(/<[^>]+>/g, '').trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max).replace(/[\s,;:.-]+\S*$/, '') + '…';
}

function build() {
    const services = getServices();
    const posts = getPublishedPosts();
    const locations = getPublishedLocations();

    // Real figure from the SME index, so llms.txt never states a number the site
    // does not actually publish.
    let smeLine = '';
    try {
        const sme = JSON.parse(readFile('../src/data/smeFundingData.json'));
        const h = sme.series.find((s) => s.headline);
        if (h) {
            smeLine = `Effective interest rate on new loans to UK SMEs: ${h.latest.value}% as of ${sme.dataAsOfLabel}, sourced directly from the Bank of England (series ${h.code}). Updated automatically; every figure is traceable to a Bank of England series code.`;
        }
    } catch { /* index optional — omit rather than invent */ }

    const L = [];

    L.push('# Boxx Commercial Finance');
    L.push('');
    L.push('> A whole-of-market UK commercial finance broker. Boxx arranges bridging loans, commercial mortgages, development finance, asset finance, invoice finance and working capital for UK businesses, homeowners, landlords, property investors and developers.');
    L.push('');
    L.push('Boxx Commercial Finance is a **broker, not a lender**. We compare lenders across the whole of the UK market and arrange the funding, rather than lending our own money. Nothing on the site is a quote or an offer of finance; actual terms depend on the borrower, the security and the lender.');
    L.push('');
    L.push('Bridging loans are our primary specialism. They are used by homeowners (chain breaks, auction purchases, buying before selling) as well as by landlords, investors and developers (refurbishment, conversion, development exit, capital raising) — not only by businesses.');
    L.push('');
    L.push('- Website: ' + BASE_URL);
    L.push('- Phone: 0330 043 1612');
    L.push('- Email: hello@boxxfinance.co.uk');
    L.push('- Enquiries: ' + BASE_URL + '/chat-about-funding');
    L.push('');

    L.push('## Funding solutions');
    L.push('');
    for (const s of services) {
        const d = oneLine(s.desc);
        L.push(`- [${s.title}](${BASE_URL}/funding-solutions/${s.slug})${d ? ': ' + d : ''}`);
    }
    L.push('');

    if (smeLine) {
        L.push('## Data');
        L.push('');
        L.push(`- [UK SME Funding Index](${BASE_URL}/uk-sme-funding-index): ${smeLine}`);
        L.push('');
    }

    L.push('## Guides');
    L.push('');
    L.push(`Boxx publishes ${posts.length} guides on UK commercial and property finance. The most recent:`);
    L.push('');
    for (const p of posts.slice(0, MAX_GUIDES)) {
        const d = oneLine(p.metaDescription || p.excerpt, 140);
        L.push(`- [${p.title}](${BASE_URL}/insights/${p.slug})${d ? ': ' + d : ''}`);
    }
    L.push('');
    L.push(`- [All guides](${BASE_URL}/insights): Full index of every guide.`);
    L.push('');

    // Counts are derived, never asserted: locationPages.json is a mix of
    // bridging and other-service guides, so a blanket "bridging loan guides for
    // N locations" line would be untrue.
    const bridgingLocs = locations.filter((l) => /^bridging-loans-/.test(l.slug));
    const otherLocs = locations.length - bridgingLocs.length;

    L.push('## Locations');
    L.push('');
    L.push(`Boxx publishes ${locations.length} location guides covering local UK finance markets — lender appetite, typical deal types and regional factors. ${bridgingLocs.length} of these cover bridging loans, following the pattern ${BASE_URL}/locations/bridging-loans-{town}. The remaining ${otherLocs} cover other funding types (for example business loans, development finance, invoice finance and commercial mortgages).`);
    L.push('');
    for (const l of bridgingLocs.slice(0, 8)) {
        L.push(`- [${l.title || l.slug}](${BASE_URL}/locations/${l.slug})`);
    }
    L.push('');

    L.push('## Optional');
    L.push('');
    L.push(`- [Privacy policy](${BASE_URL}/privacy-policy)`);
    L.push(`- [Terms and conditions](${BASE_URL}/terms-and-conditions)`);
    L.push(`- [Legal disclaimer](${BASE_URL}/legal-disclaimer)`);
    L.push(`- [Sitemap](${BASE_URL}/sitemap.xml): Every published URL.`);
    L.push('');

    return L.join('\n');
}

function main() {
    const txt = build();
    fs.writeFileSync(OUTPUT_PUBLIC, txt, 'utf8');
    // vite copies public/ into dist/ at build time, but the build order runs this
    // after `vite build`, so write dist/ directly too (same as generate-sitemap).
    const dist = path.resolve(__dirname, '../dist');
    if (fs.existsSync(dist)) {
        fs.writeFileSync(path.join(dist, 'llms.txt'), txt, 'utf8');
    }
    const lines = txt.split('\n').length;
    console.log(`✅ llms.txt generated (${lines} lines, ${(txt.length / 1024).toFixed(1)}KB) at:`);
    console.log(`   ${OUTPUT_PUBLIC}`);
    if (fs.existsSync(dist)) console.log(`   ${path.join(dist, 'llms.txt')}`);
}

main();
