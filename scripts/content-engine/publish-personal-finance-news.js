/**
 * publish-personal-finance-news.js
 *
 * The reactive half of the personal-finance / Google Discover pilot (see
 * docs/personal-finance-discover-pilot.md). Everything else in that pilot —
 * the 8 evergreen pillars — is deliberately NOT switched on yet; Mark asked
 * to start with non-evergreen content specifically, to test whether Discover
 * is worth prioritising before scaling anything.
 *
 * Watches real UK consumer property/personal-finance news (not the trade
 * press publish-linkedin-news.js watches — that's broker-audience, this is
 * general-public) and, when something genuinely new and relevant has
 * happened, writes and publishes ONE reactive article about it. Deliberately
 * small-scale: at most one article per run, and only when real news exists —
 * this is not a scheduled queue with pre-written topics waiting for a date
 * (that was the original mistake: "Bank of England rate decision" can't be
 * written 90 days before the decision happens).
 *
 * Modelled on publish-linkedin-news.js's RSS-watching pattern (feed fetch →
 * relevance filter → dedupe tracking file) combined with publish-blog.js's
 * article generation, Pexels image sourcing and GitHub push pattern.
 *
 * Anti-fabrication guardrails are the same standard applied to the bridging
 * vertical this same week: no invented rate/tax figures, no fabricated
 * "in our experience" claims, UK-nation-aware tax language (SDLT/LBTT/LTT
 * are different taxes, not one UK-wide "stamp duty").
 *
 * Editorial scope (Mark, 2026-08-24): these run ALONGSIDE the daily bridging
 * posts and exist to earn Google Discover traffic, so the bar is property
 * market relevance rather than a bridging-loan use case — landlords, property,
 * auctions, mortgages and conveyancing all qualify. Party politics and general
 * cost-of-living content do not. Enforced by checkMarketRelevance().
 *
 * Run: node publish-personal-finance-news.js [--dry-run|--check-feeds|--test-gate]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');
const { createOpenAICompatClient } = require('./lib/anthropic-openai-shim');
const { parseModelJson, logJsonFailure } = require('./lib/parse-model-json');
const { deriveImageQueries, fetchPexelsImage } = require('./lib/news-images');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE     = 'src/data/blogPosts.json';
const TRACKING_FILE = 'src/data/personalFinanceNewsTracking.json';
const FEEDS_FILE    = path.resolve(__dirname, '../../src/data/personalFinanceNewsFeeds.json');
const MAX_AGE_DAYS  = 2; // genuinely reactive — Discover rewards freshness, not a week-old story
const PILLAR_NAME   = 'Latest News'; // shown as the Blog listing filter chip / category tag for these posts

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const openai  = createOpenAICompatClient({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Consumer-facing UK property/personal-finance RSS feeds ────────────────────
// Read from src/data/personalFinanceNewsFeeds.json (the "active" ones) rather
// than a hardcoded array — that file is a maintained registry, periodically
// re-validated by discover-personal-finance-feeds.js, so the list can grow
// (or self-heal if a feed goes down) without editing this script. Deliberately
// NOT the trade-press feeds publish-linkedin-news.js uses (those are written
// for brokers, not the general public). 20 feeds active as of 2026-08-21,
// chosen specifically to cover homeowners and landlords — see the registry
// file for the full list of what was tested and why candidates were excluded.
function loadActiveFeeds() {
  const registry = JSON.parse(fs.readFileSync(FEEDS_FILE, 'utf8'));
  return registry.feeds.filter(f => f.status === 'active').map(f => ({ url: f.url, name: f.name }));
}
const RSS_FEEDS = loadActiveFeeds();

// Cheap pre-filter only — it just cuts down how many stories get sent to the
// model. checkMarketRelevance() below is the actual editorial decision.
// 'inflation' and 'cost of living' were deliberately removed (2026-08-24):
// they were the route by which two general cost-of-living stories with no
// property angle reached publication. Genuine property stories that happen to
// mention inflation still match on their property terms instead.
const RELEVANT_KEYWORDS = [
  'house price', 'property market', 'mortgage rate', 'mortgage', 'stamp duty',
  'bank of england', 'interest rate', 'rental market', 'landlord', 'renter',
  'remortgage', 'first-time buyer', 'first time buyer', 'buy-to-let', 'buy to let',
  'homeowner', 'housing market', 'rent prices', 'property price',
  'capital gains tax', 'inheritance tax', 'conveyancing',
  'auction', 'probate', 'repossession', 'chain break', 'renovation',
  'refurbishment', 'planning permission', 'developer', 'development finance',
];

// ── RSS parser (no external dependency — same approach as publish-linkedin-news.js) ──
// Decodes the handful of HTML/XML entities that actually show up in RSS
// titles/descriptions (numeric entities like &#8230; for an ellipsis, plus
// the standard named ones) — without this, "&#8230;" was appearing literally
// in generated article titles, since the model just repeats what it's given.
function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    // Decoded like title/description: feed URLs with query strings arrive
    // HTML-escaped (BBC's look like "...?at_medium=RSS&amp;at_campaign=rss").
    // Left raw, that &amp; ends up in the published citation link, so the
    // credit link to the source is broken.
    let link = decodeEntities(get('link'));
    if (!link) {
      const m2 = block.match(/<link\s*\/?>\s*([^\s<]+)/i);
      link = m2 ? decodeEntities(m2[1].trim()) : '';
    }
    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const description = decodeEntities(get('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500));
    const title = decodeEntities(get('title'));
    if (title && link) {
      items.push({ title, link, description, pubDate: pubDate ? new Date(pubDate) : new Date() });
    }
  }
  return items;
}

function isRelevant(item) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  return RELEVANT_KEYWORDS.some(kw => text.includes(kw));
}

function isRecent(item) {
  const ageDays = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= MAX_AGE_DAYS;
}

async function fetchAllArticles() {
  const all = [];
  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BoxxFinanceBot/1.0)' } });
      if (!res.ok) { console.warn(`  ${feed.name}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseRSS(xml).map(i => ({ ...i, source: feed.name }));
      console.log(`  ${feed.name}: ${items.length} items`);
      all.push(...items);
    } catch (err) {
      console.warn(`  ${feed.name}: ${err.message}`);
    }
  }
  return all;
}

// ── Tracking file (dedupe — never write about the same story twice) ──────────
async function getTrackingFile() {
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: TRACKING_FILE });
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { sha: data.sha, covered: JSON.parse(content) };
  } catch (err) {
    if (err.status === 404) return { sha: null, covered: [] };
    throw err;
  }
}

async function saveTrackingFile(covered, sha) {
  const content = Buffer.from(JSON.stringify(covered.slice(0, 200), null, 2)).toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: TRACKING_FILE,
    message: 'chore: track covered personal-finance news story',
    content, branch: 'main', ...(sha && { sha }),
  });
}

// ── Property-market relevance gate ────────────────────────────────────────────
// The keyword pre-filter above is deliberately loose (it's just cutting down
// what gets sent to the model). This is the actual editorial decision.
//
// These posts exist to earn Google Discover traffic ALONGSIDE the daily
// bridging posts, so the bar is property-market relevance, not a bridging-loan
// use case — landlords, property, auctions, mortgages, conveyancing and
// housing tax are all wanted. What is NOT wanted is party politics and
// general cost-of-living/household-bills content, which brings the wrong
// audience regardless of how well it might perform.
//
// History: an earlier version of this gate demanded a concrete bridging-loan
// scenario, which was too strict — it would have rejected most of the genuinely
// on-topic landlord and property stories this is meant to publish. Two posts
// that slipped through before any gate existed ("Andy Burnham may need tax
// rises to fund cost of living support", "Pay-it-forward schemes exist to help
// with bills") are the exact failure mode the exclusions below target; they
// reached here via the 'inflation'/'cost of living' keywords, now removed.
const RELEVANCE_SCHEMA = {
  type: 'object',
  properties: {
    isMarketRelevant: {
      type: 'boolean',
      description: 'True only if the story is genuinely about the UK property market or property ownership. False for party politics and for general cost-of-living/household-bills stories with no substantive property angle.',
    },
    marketAngle: {
      type: 'string',
      description: 'If isMarketRelevant is true: one sentence on what this story actually means for UK homeowners, landlords, buyers or property investors. If false: leave empty.',
    },
  },
  required: ['isMarketRelevant', 'marketAngle'],
  additionalProperties: false,
};

async function checkMarketRelevance(story) {
  const response = await openai.chat.completions.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    response_format: { json_schema: { schema: RELEVANCE_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: `You are an editorial gatekeeper for Boxx Finance, a UK property finance broker. Decide whether a news story belongs in a UK property news section.

PUBLISH (property market and property ownership):
- Landlords and the private rented sector: tax, incorporation, regulation, EPC and licensing rules, tenant/landlord relations, rental yields
- Buying and selling: house prices, mortgage rates and lending criteria, first-time buyers, conveyancing, chain breaks, auctions, probate and inherited property
- Property investment and development: buy-to-let, refurbishment, planning, development sites, repossessions
- Taxes levied on property specifically: stamp duty/SDLT/LBTT/LTT, capital gains tax on property, mansion or council tax on homes, inheritance tax where the story is about property

DO NOT PUBLISH:
- Party politics: what a politician, party, mayor or minister said, wants, or might do; elections; political rows. A tax story only qualifies if it is about the actual property tax rules, not about the politics of who is proposing what.
- General cost-of-living and household bills with no substantive property angle: energy bills, food prices, benefits, debt advice, savings accounts, budgeting schemes, broad inflation coverage
- Business, markets or economy stories that merely mention housing in passing

The test is what the story is genuinely ABOUT, not what it briefly mentions. If the property angle is incidental or would have to be invented to make the piece work, say no. Return only a raw JSON object.`,
      },
      {
        role: 'user',
        content: `Story headline: ${story.title}\nStory summary: ${story.description}\n\nDoes this belong in a UK property news section?`,
      },
    ],
  });

  let result;
  try {
    result = parseModelJson(response.choices[0].message.content, { label: 'market-relevance gate' });
  } catch (err) {
    logJsonFailure(err);
    return { isMarketRelevant: false, marketAngle: '' };
  }
  return result;
}

// ── Article generation ────────────────────────────────────────────────────────
const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'URL slug, lowercase words separated by hyphens, describing the story angle (not dated).' },
    title: { type: 'string', description: 'Article H1 — a clear, specific headline about what happened and what it means, not generic. Must accurately represent the article body: no exaggeration, no misleading implication, no sensationalism or curiosity-bait phrasing (Google Discover demotes content whose preview overstates or misrepresents what the article actually says).' },
    excerpt: { type: 'string', description: 'Plain text, one or two sentences, 25-40 words, for the listing card. Natural prose only.' },
    metaTitle: { type: 'string', description: 'SEO title tag, under 60 characters.' },
    metaDescription: { type: 'string', description: 'SEO meta description, 140-158 characters.' },
    contentHtml: { type: 'string', description:
      'The full article as valid HTML, 700-1000 words — a news-analysis piece, NOT a long evergreen guide. ' +
      'Structure: opening paragraph stating plainly what happened and why it matters (this is what gets ' +
      'extracted for Discover previews — must stand alone). Then 2-4 short H2 sections explaining the ' +
      'practical implications for UK homeowners, buyers, landlords or investors as relevant to this specific ' +
      'story. End with a short "Frequently Asked Questions" H2 with 2-3 Q&As (questions as <h3>, matching ' +
      'faqSchema exactly) — genuinely useful follow-up questions a reader would have, not padding. Then one ' +
      'final paragraph pointing to Boxx Finance funding solutions with a natural, non-pushy anchor. This is ' +
      'a news piece, not a sales page: only make a funding connection where the story genuinely supports one, ' +
      'and keep it to a light closing signpost. Do NOT force a bridging-loan angle onto a story that does not ' +
      'have one, and do not inflate the reader\'s situation to manufacture a need. MUST ' +
      'include a clear attribution sentence citing the source (e.g. "as reported by [outlet]") with an ' +
      'outbound link to the source article URL supplied — a genuine citation, not SEO decoration. HARD RULES: ' +
      'never invent a statistic, rate, date or figure not present in the supplied source material — if the ' +
      'source does not give a number, describe it in hedged general terms instead. Never write "in our ' +
      'experience" or "our clients tell us" — this is news commentary, not client-based authority you have ' +
      'not earned on this specific story. If the story involves property tax, be UK-nation-aware: stamp duty ' +
      '(SDLT) applies in England/Northern Ireland only, Scotland has LBTT, Wales has LTT — do not default to ' +
      '"stamp duty" as if it is UK-wide unless the source story is specifically about England/NI.',
    },
    faqSchema: {
      type: 'object',
      description: 'FAQPage structured data, 2-3 question/answer pairs matching the FAQ section in contentHtml word-for-word.',
      properties: {
        '@type': { type: 'string', description: 'Always the literal string "FAQPage".' },
        mainEntity: {
          type: 'array',
          description: '2-3 items — genuinely useful follow-up questions a reader would have about this story.',
          items: {
            type: 'object',
            properties: {
              '@type': { type: 'string', description: 'Always the literal string "Question".' },
              name: { type: 'string', description: 'The question, phrased as a reader would ask it.' },
              acceptedAnswer: {
                type: 'object',
                properties: { '@type': { type: 'string' }, text: { type: 'string' } },
                required: ['@type', 'text'],
                additionalProperties: false,
              },
            },
            required: ['@type', 'name', 'acceptedAnswer'],
            additionalProperties: false,
          },
        },
      },
      required: ['@type', 'mainEntity'],
      additionalProperties: false,
    },
  },
  required: ['slug', 'title', 'excerpt', 'metaTitle', 'metaDescription', 'contentHtml', 'faqSchema'],
  additionalProperties: false,
};

// ── Output validation ─────────────────────────────────────────────────────────
// The prompt says the source citation and funding link are mandatory, but a
// prompt is not a guarantee: two posts published on 2026-08-23/24 came out
// without them (one had no links at all). Nothing checked, so they went live
// anyway. These are the checks that actually enforce it — an article that
// fails them is never published.
//
// The source link matters most. These pieces are written from another
// outlet's reporting, so publishing without crediting it is not a formatting
// miss, it is passing off someone else's work.
const MIN_ARTICLE_WORDS = 650; // schema asks for 700-1000; this is the hard floor

function validateArticle(article, story) {
  const html = article.contentHtml || '';
  const problems = [];

  if (!html.includes(story.link)) {
    problems.push(`missing source citation link to ${story.link}`);
  }
  if (!/href=["']https:\/\/boxxfinance\.co\.uk\/funding-solutions/i.test(html)) {
    problems.push('missing funding-solutions link');
  }
  // A themed story should carry its contextual link. Warn rather than reject:
  // the prompt tells the model to leave it out if the story gives no natural
  // opening, and forcing one in would produce exactly the shoehorned copy the
  // CTA rules elsewhere are written to prevent.
  const link = pickStoryLink(story, article);
  if (link && !html.includes(new URL(link.url).pathname)) {
    console.log(`  note: story matched "${link.theme}" but published without that link — no natural placement found.`);
  }
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < MIN_ARTICLE_WORDS) {
    problems.push(`only ${words} words (minimum ${MIN_ARTICLE_WORDS})`);
  }
  return problems;
}

// Generates, validates, and retries once with the specific problems fed back.
// If the second attempt still fails we publish nothing and exit non-zero, so
// the failure watchdog raises it rather than it passing as a quiet run.
async function generateValidatedArticle(story, marketAngle) {
  let article = await generateArticle(story, marketAngle);
  let problems = validateArticle(article, story);
  if (problems.length === 0) return article;

  console.log(`  ⚠ Generated article failed validation: ${problems.join('; ')}`);
  console.log('  Retrying once with corrections...');
  article = await generateArticle(story, marketAngle, problems);
  problems = validateArticle(article, story);
  if (problems.length === 0) {
    console.log('  ✓ Retry passed validation.');
    return article;
  }

  console.error(`\n❌ Article still invalid after retry: ${problems.join('; ')}`);
  console.error('   Publishing nothing rather than an article missing its source credit.\n');
  process.exit(1);
}

// Whether the story is about landlords / rental property, which decides
// whether the buy-to-let article gets linked. Deliberately a content test
// rather than "always link it": the generator is told elsewhere not to
// manufacture a funding need a story does not support, and a forced link on,
// say, a first-time-buyer story would read as exactly that.
// Which existing article to link, based on what the story is actually about.
//
// This started as a single buy-to-let constant, which was too blunt: a story
// about leaseholders whose freeholder went bankrupt and whose flats are now
// unmortgageable has an obviously relevant article on the site, and it is not
// the buy-to-let one. Linking BTL there would have been irrelevant at best.
//
// Ordered most-specific-first, so a landlord story about an auction purchase
// gets the auction article rather than the generic BTL one. Verified
// 2026-08-26; two targets updated 2026-09-06 — see the note on each below.
//
// The site narrowed to six focus services (2026-09), and this router still
// sent every story to bridging, including "landlords and buy-to-let" — the
// one theme that is now a plainly better fit for Buy To Let Refinance than
// for bridging. Most acute, urgent scenarios (auction, chain break, refurb/
// EPC/HMO, leasehold/unmortgageable, probate) are already intercepted by the
// more specific entries above it in this list, so by the time a story falls
// through to the landlord entry it is almost always a rate, tax or
// regulation story — a "protect my mortgage" story, not a "buy this fast"
// one. Retargeted rather than split in two: the existing ordering already
// does the discrimination.
//
// Added a mortgage-decline/credit-history theme for Bad Credit Mortgages,
// placed ahead of the landlord entry since a specific credit signal beats a
// generic landlord mention.
//
// Two targets below point at a service page rather than a specific article,
// because no Buy To Let Refinance or Bad Credit Mortgages article has
// published yet (both services are mid-rollout — see
// src/data/serviceContentTopics.json). Upgrade each to its natural article
// once one exists: "When to Start Your Buy To Let Remortgage" and "Getting a
// Mortgage With a Default on Your Credit File" are the obvious candidates.
const STORY_LINKS = [
  {
    theme: 'leasehold or unmortgageable property',
    match: /leasehold|freehold|short lease|unmortgageable|non.standard construction|cladding|EWS1|service charge/i,
    url: 'https://boxxfinance.co.uk/insights/short-lease-flat-mortgage-refused',
  },
  {
    theme: 'probate or inherited property',
    match: /probate|inherit|deceased|estate sale|executor/i,
    url: 'https://boxxfinance.co.uk/insights/bridging-loan-inheritance-property',
  },
  {
    theme: 'buying at auction',
    match: /auction/i,
    url: 'https://boxxfinance.co.uk/insights/how-to-finance-auction-property-uk',
  },
  {
    theme: 'a broken property chain',
    match: /chain break|broken chain|property chain|sale fell through|buyer pulled out/i,
    url: 'https://boxxfinance.co.uk/insights/bridging-finance-for-property-chains',
  },
  {
    theme: 'refurbishment or conversion',
    match: /\bhmo\b|refurbish|renovat|conversion|epc|retrofit|insulat/i,
    url: 'https://boxxfinance.co.uk/insights/bridging-loans-for-hmo-conversion',
  },
  {
    theme: 'mortgage decline or credit history',
    match: /mortgage (?:rejected|declined|refused|decline)|credit score|adverse credit|bad credit|\bccj\b|county court judgment|mortgage prisoner|affordability (?:rules|criteria|test)/i,
    url: 'https://boxxfinance.co.uk/funding-solutions/bad-credit-mortgages', // no dedicated article yet — see note above
  },
  {
    theme: 'landlords and buy-to-let',
    match: /landlord|buy.to.let|\bbtl\b|rental propert|rented sector|tenanc|tenant|letting|holiday let|serviced accommodation/i,
    url: 'https://boxxfinance.co.uk/funding-solutions/buy-to-let-refinance', // no dedicated article yet — see note above
  },
];

// First match wins. Returns null when the story fits none of them, in which
// case the article carries only its source citation and the closing
// funding-solutions signpost — better than forcing an irrelevant link.
function pickStoryLink(story, article) {
  const text = `${story.title} ${story.description} ${article ? article.title : ''}`;
  return STORY_LINKS.find(l => l.match.test(text)) || null;
}

async function generateArticle(story, marketAngle, problems = []) {
  const storyLink = pickStoryLink(story, null);
  const corrections = problems.length
    ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED for these reasons:\n${problems.map(p => `- ${p}`).join('\n')}\nFix every one of them. The source citation link and the funding-solutions link are both mandatory and must appear as real <a href="..."> anchors in contentHtml.`
    : '';

  const response = await openai.chat.completions.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    response_format: { json_schema: { schema: ARTICLE_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: `You are a UK property/personal-finance journalist writing for Boxx Finance's news section — a UK bridging loan broker. Natural, human, UK tone — direct and clear, not corporate. Never use em dashes. No markdown, no backticks, no code fences. Return only a raw JSON object.`,
      },
      {
        role: 'user',
        content: `A UK property/personal-finance news story has just been published. Write a reactive news-analysis article about it for a general UK consumer audience (homeowners, buyers, landlords — not property professionals).

Source headline: ${story.title}
Source summary: ${story.description}
Source outlet: ${story.source}
Source URL (cite and link this): ${story.link}

Why this story matters to our readers (the angle it was selected on): ${marketAngle}

Do not simply summarise the source — explain what it actually means for an ordinary UK homeowner, buyer or landlord reading this today. Only state facts and figures that are actually in the source summary above; if you need more detail than is given, describe it in general hedged terms rather than inventing specifics.

Funnel link to include near the end: https://boxxfinance.co.uk/funding-solutions (Boxx Finance's funding solutions hub) — anchor text should read naturally in context. Keep this to a light closing signpost; do not manufacture a funding need this story does not support.

Both of these must appear in contentHtml as real anchors, or the article will be rejected:
1. <a href="${story.link}">...</a> crediting ${story.source}
2. <a href="https://boxxfinance.co.uk/funding-solutions">...</a>

${storyLink ? `This story touches on ${storyLink.theme}, so ALSO include ONE contextual link, mid-article rather than in the closing paragraph, to:
<a href="${storyLink.url}">...</a>
Anchor text should describe what the reader would find there, not a bare command like "click here". Place it where a reader would genuinely want it. If the story gives no natural opening, leave it out rather than forcing one in — a link that does not fit the sentence around it is worse than no link.` : ''}${corrections}`,
      },
    ],
  });

  let article;
  try {
    article = parseModelJson(response.choices[0].message.content, { label: 'personal-finance-news generator' });
  } catch (err) {
    logJsonFailure(err);
    throw err;
  }
  return article;
}

// ── Image — reuses the same Pexels pipeline publish-blog.js uses, with a
// story-derived query instead of a fixed per-service one ─────────────────────
// Ordered most-specific-first so a story that touches several themes (e.g.
// "landlord capital gains tax") gets the more precise query rather than the
// first broad bucket it happens to match. Google's Discover guidance calls
// out generic/unrelated imagery specifically, so these are deliberately
// narrower than a handful of blanket categories.
async function uploadHeroImage(slug, imageBuffer) {
  const webpBuffer = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
  const imagePath = `public/images/blog/${slug}.webp`;
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    message: `Add hero image: ${slug}`,
    content: webpBuffer.toString('base64'), branch: 'main',
  });
  console.log(`  Hero image uploaded: ${imagePath} (${Math.round(webpBuffer.length / 1024)}KB)`);
  return `/images/blog/${slug}.webp`;
}

// ── Push to blogPosts.json ────────────────────────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, posts: JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, sha, slug) {
  const content = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message: `Publish personal-finance news: ${slug}`,
    content, sha, branch: 'main',
  });
}

// ── Gate regression fixtures ──────────────────────────────────────────────────
// The ten stories this script actually published between 2026-08-21 and
// 2026-08-24, before any relevance gate existed, with the verdict each one
// SHOULD get. Mark reviewed these against his criteria: property, landlords
// and auctions are wanted; party politics and general cost-of-living are not.
// Run with --test-gate to check the gate still agrees. Needs ANTHROPIC_API_KEY,
// so in practice this runs in CI rather than locally.
const GATE_FIXTURES = [
  { expect: true,  title: 'Landlords Who Incorporated Their Property Businesses Could Face Surprise Capital Gains Tax Bills', description: 'Landlords who moved their property portfolios into limited companies may face unexpected capital gains tax bills.' },
  { expect: false, title: 'Andy Burnham may need tax rises to fund cost of living support, economists warn', description: 'Economists warn the Greater Manchester mayor may need to raise taxes to fund cost of living support measures.' },
  { expect: true,  title: 'Landlord couple left unable to access their own capital after later professional advice, case study warns', description: 'A landlord couple found themselves unable to release capital tied up in their property portfolio.' },
  { expect: false, title: "Pay-it-forward schemes exist to help with bills, so why aren't more people using them", description: 'Pay-it-forward schemes can help households struggling with energy and other bills, but take-up remains low.' },
  { expect: true,  title: 'HMRC changes the rules for landlords incorporating their property businesses from 2026', description: 'HMRC has updated incorporation relief rules affecting landlords transferring property businesses to companies.' },
  { expect: true,  title: 'Royal Estates Face £10m EPC Bill, But Landlords Collectively Face Almost £10bn', description: 'EPC upgrade requirements will cost the royal estates millions and private landlords billions collectively.' },
  { expect: true,  title: "'Friday Afternoon Fraud': Why Homebuyers Are Losing Their Deposits to Fake Solicitor Emails", description: 'Homebuyers are losing deposits to fraudsters impersonating conveyancing solicitors by email.' },
  { expect: true,  title: 'HMRC to Send Inspectors Into Homes to Check Who Owes the New Mansion Tax', description: 'HMRC inspectors will carry out property valuations to determine liability for the new mansion tax on high value homes.' },
  { expect: true,  title: 'HMRC softens 20-hour rule guidance for landlords incorporating their property business', description: 'HMRC has relaxed guidance on the 20-hour week test landlords must meet for incorporation relief.' },
  { expect: true,  title: 'NRLA research points to growing hostility towards landlords, but what does it mean for the private rented sector?', description: 'New NRLA research suggests rising public hostility towards private landlords and questions the impact on the rented sector.' },
];

async function testGate() {
  console.log('Testing market-relevance gate against 10 known stories...\n');
  let passed = 0;
  for (const f of GATE_FIXTURES) {
    const result = await checkMarketRelevance(f);
    const ok = result.isMarketRelevant === f.expect;
    if (ok) passed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  got=${String(result.isMarketRelevant).padEnd(5)} want=${String(f.expect).padEnd(5)}  ${f.title.slice(0, 70)}`);
    if (!ok) console.log(`      angle: ${result.marketAngle || '(none)'}`);
  }
  console.log(`\n${passed}/${GATE_FIXTURES.length} correct.`);
  if (passed < GATE_FIXTURES.length) process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const checkFeedsOnly = process.argv.includes('--check-feeds');
  if (process.argv.includes('--test-gate')) return testGate();
  console.log('\n[Personal Finance News Publisher — Discover pilot, non-evergreen]\n');
  if (isDryRun) console.log('⚠ DRY RUN — no changes written\n');

  console.log('Fetching feeds...');
  const articles = await fetchAllArticles();
  console.log(`Total fetched: ${articles.length}`);

  if (checkFeedsOnly) {
    const candidates = articles.filter(a => isRelevant(a) && isRecent(a)).sort((a, b) => b.pubDate - a.pubDate);
    console.log(`\nRelevant + recent (keyword pre-filter only, no market-relevance gate, no dedupe check): ${candidates.length}`);
    candidates.slice(0, 10).forEach(c => console.log(` - ${c.pubDate.toISOString().split('T')[0]} | ${c.source} | ${c.title}`));
    return;
  }

  const { covered, sha: trackingSha } = await getTrackingFile();
  // Holds both forms: links tracked before parseRSS decoded entities are
  // stored with "&amp;", so match the decoded form too or those stories would
  // look uncovered and get republished.
  const coveredUrls = new Set(covered.flatMap(c => [c.url, decodeEntities(c.url || '')]));

  const candidates = articles
    .filter(a => isRelevant(a) && isRecent(a) && !coveredUrls.has(a.link))
    .sort((a, b) => b.pubDate - a.pubDate);

  console.log(`Relevant + recent + not-yet-covered candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No new relevant story found this run. Nothing to publish — this is expected most runs.');
    return;
  }

  // Keyword pre-filter is loose; the market-relevance gate is the real
  // editorial decision. Check candidates in recency order, cap at 8 per run to
  // bound API cost, and stop at the first genuinely property-market story.
  let story = null;
  let marketAngle = '';
  console.log('\nChecking candidates for property-market relevance...');
  for (const candidate of candidates.slice(0, 8)) {
    const result = await checkMarketRelevance(candidate);
    console.log(`  ${result.isMarketRelevant ? '✓' : '✗'} ${candidate.title}`);
    if (result.isMarketRelevant && result.marketAngle) {
      story = candidate;
      marketAngle = result.marketAngle;
      break;
    }
  }

  if (!story) {
    console.log('\nNo candidate was genuinely property-market relevant this run. Nothing to publish.');
    return;
  }

  console.log(`\nSelected: "${story.title}"`);
  console.log(`Source: ${story.source} (${story.pubDate.toISOString().split('T')[0]})`);
  console.log(`Market angle: ${marketAngle}`);

  console.log('\nGenerating article...');
  const article = await generateValidatedArticle(story, marketAngle);
  const words = article.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  console.log(`Generated: "${article.title}" (${words} words)`);

  console.log('\nSourcing image...');
  const imageQueries = deriveImageQueries(story);
  // Photo ids already used by earlier posts, so the same stock photo is not
  // reused across articles (ten posts previously shared five images).
  const usedPhotoIds = new Set(covered.map(c => c.photoId).filter(Boolean));
  let heroImage = '/hero-desktop.webp'; // fallback matches the site's existing default
  let photoId = null;
  if (!isDryRun) {
    const image = await fetchPexelsImage(imageQueries, usedPhotoIds);
    if (image) {
      heroImage = await uploadHeroImage(article.slug, image.buffer);
      photoId = image.photoId;
    }
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] Would publish:');
    console.log(JSON.stringify({ ...article, source: story.link, imageQueries }, null, 2).slice(0, 1500));
    return;
  }

  const { posts, sha } = await getBlogPostsFile();
  if (posts.some(p => p.slug === article.slug)) {
    console.log(`Slug "${article.slug}" already exists — skipping to avoid overwrite.`);
    return;
  }

  const newPost = {
    id: Date.now(),
    status: 'published',
    slug: article.slug,
    url: `/insights/${article.slug}`,
    title: article.title,
    excerpt: article.excerpt,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    keywords: RELEVANT_KEYWORDS.filter(kw => (article.title + article.contentHtml).toLowerCase().includes(kw)).slice(0, 6).join(', '),
    date: new Date().toISOString().split('T')[0],
    publishedAt: new Date().toISOString(),
    author: 'Mark Higgins',
    authorEmail: 'mark@boxxfinance.co.uk',
    heroImage,
    // Cache-buster appended to the image URL by heroForPost. Without it, a
    // later re-image replaces the file at the same path and browsers keep
    // serving the old picture for up to the 7-day image max-age.
    heroVersion: photoId || null,
    schema: article.faqSchema,
    relatedLocationUrls: [],
    relatedBlogUrls: [],
    content: article.contentHtml,
    liPosted: false, fbPosted: false, igPosted: false, pinterestPosted: false, reelPosted: false,
    service: PILLAR_NAME,
    category: PILLAR_NAME,
  };

  posts.push(newPost);
  await pushBlogPostsFile(posts, sha, article.slug);
  console.log(`\n✅ Published: ${article.slug}`);

  covered.unshift({ url: story.link, title: story.title, slug: article.slug, photoId, publishedAt: new Date().toISOString() });
  await saveTrackingFile(covered, trackingSha);
  console.log('Tracking file updated.\nDone.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
