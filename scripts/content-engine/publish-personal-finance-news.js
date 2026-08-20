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
 * Run: node publish-personal-finance-news.js [--dry-run]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');
const { createOpenAICompatClient } = require('./lib/anthropic-openai-shim');
const { parseModelJson, logJsonFailure } = require('./lib/parse-model-json');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE     = 'src/data/blogPosts.json';
const TRACKING_FILE = 'src/data/personalFinanceNewsTracking.json';
const FEEDS_FILE    = path.resolve(__dirname, '../../src/data/personalFinanceNewsFeeds.json');
const MAX_AGE_DAYS  = 2; // genuinely reactive — Discover rewards freshness, not a week-old story
const PILLAR_NAME   = 'Property News and Market Updates';

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

const RELEVANT_KEYWORDS = [
  'house price', 'property market', 'mortgage rate', 'mortgage', 'stamp duty',
  'bank of england', 'interest rate', 'rental market', 'landlord', 'renter',
  'remortgage', 'first-time buyer', 'first time buyer', 'buy-to-let', 'buy to let',
  'homeowner', 'housing market', 'rent prices', 'property price', 'inflation',
  'cost of living', 'capital gains tax', 'inheritance tax', 'conveyancing',
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
    let link = get('link');
    if (!link) {
      const m2 = block.match(/<link\s*\/?>\s*([^\s<]+)/i);
      link = m2 ? m2[1].trim() : '';
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

// ── Article generation ────────────────────────────────────────────────────────
const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'URL slug, lowercase words separated by hyphens, describing the story angle (not dated).' },
    title: { type: 'string', description: 'Article H1 — a clear, specific headline about what happened and what it means, not generic.' },
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
      'final paragraph pointing to Boxx Finance funding solutions, using a natural, non-pushy anchor (this is ' +
      'a news piece, not a sales page — the CTA should feel like a helpful next step, not an advert). MUST ' +
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

async function generateArticle(story) {
  const response = await openai.chat.completions.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    response_format: { json_schema: { schema: ARTICLE_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: `You are a UK property/personal-finance journalist writing for Boxx Finance's news section. Natural, human, UK tone — direct and clear, not corporate. Never use em dashes. No markdown, no backticks, no code fences. Return only a raw JSON object.`,
      },
      {
        role: 'user',
        content: `A UK property/personal-finance news story has just been published. Write a reactive news-analysis article about it for a general UK consumer audience (homeowners, buyers, landlords — not property professionals).

Source headline: ${story.title}
Source summary: ${story.description}
Source outlet: ${story.source}
Source URL (cite and link this): ${story.link}

Do not simply summarise the source — explain what it actually means for an ordinary UK homeowner, buyer or landlord reading this today. Only state facts and figures that are actually in the source summary above; if you need more detail than is given, describe it in general hedged terms rather than inventing specifics.

Funnel link to include near the end: https://boxxfinance.co.uk/funding-solutions (Boxx Finance's funding solutions hub) — anchor text should read naturally, e.g. "explore short-term property finance options".`,
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
function deriveImageQuery(story) {
  const text = (story.title + ' ' + story.description).toLowerCase();
  if (/rent|renter|landlord|tenant/.test(text)) return 'UK rental apartment building';
  if (/interest rate|bank of england|inflation/.test(text)) return 'UK finance city bank';
  if (/mortgage|remortgage|first-time buyer|first time buyer/.test(text)) return 'UK home mortgage keys';
  if (/tax|stamp duty|capital gains|inheritance/.test(text)) return 'UK property paperwork documents';
  return 'UK residential property street';
}

async function fetchPexelsImage(query) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) { console.log('  No PEXELS_API_KEY set — skipping hero image'); return null; }
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos || data.photos.length === 0) return null;
  const filtered = data.photos.filter(p => !((p.alt || '') + ' ' + (p.photographer || '')).toLowerCase().match(/\$|dollar|euro|€|usd|eur/i));
  const photo = filtered[0] || data.photos[0];
  const imgRes = await fetch(photo.src.large2x || photo.src.large);
  if (!imgRes.ok) return null;
  return Buffer.from(await imgRes.arrayBuffer());
}

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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const checkFeedsOnly = process.argv.includes('--check-feeds');
  console.log('\n[Personal Finance News Publisher — Discover pilot, non-evergreen]\n');
  if (isDryRun) console.log('⚠ DRY RUN — no changes written\n');

  console.log('Fetching feeds...');
  const articles = await fetchAllArticles();
  console.log(`Total fetched: ${articles.length}`);

  if (checkFeedsOnly) {
    const candidates = articles.filter(a => isRelevant(a) && isRecent(a)).sort((a, b) => b.pubDate - a.pubDate);
    console.log(`\nRelevant + recent (no dedupe check): ${candidates.length}`);
    candidates.slice(0, 10).forEach(c => console.log(` - ${c.pubDate.toISOString().split('T')[0]} | ${c.source} | ${c.title}`));
    return;
  }

  const { covered, sha: trackingSha } = await getTrackingFile();
  const coveredUrls = new Set(covered.map(c => c.url));

  const candidates = articles
    .filter(a => isRelevant(a) && isRecent(a) && !coveredUrls.has(a.link))
    .sort((a, b) => b.pubDate - a.pubDate);

  console.log(`Relevant + recent + not-yet-covered candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No new relevant story found this run. Nothing to publish — this is expected most runs.');
    return;
  }

  const story = candidates[0];
  console.log(`\nSelected: "${story.title}"`);
  console.log(`Source: ${story.source} (${story.pubDate.toISOString().split('T')[0]})`);

  console.log('\nGenerating article...');
  const article = await generateArticle(story);
  const words = article.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  console.log(`Generated: "${article.title}" (${words} words)`);

  console.log('\nSourcing image...');
  const imageQuery = deriveImageQuery(story);
  let heroImage = '/hero-desktop.webp'; // fallback matches the site's existing default
  if (!isDryRun) {
    const imageBuffer = await fetchPexelsImage(imageQuery);
    if (imageBuffer) heroImage = await uploadHeroImage(article.slug, imageBuffer);
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] Would publish:');
    console.log(JSON.stringify({ ...article, source: story.link, imageQuery }, null, 2).slice(0, 1500));
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

  covered.unshift({ url: story.link, title: story.title, slug: article.slug, publishedAt: new Date().toISOString() });
  await saveTrackingFile(covered, trackingSha);
  console.log('Tracking file updated.\nDone.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
