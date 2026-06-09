/**
 * Boxx Finance — Thin Post Regenerator
 *
 * Finds the thinnest published blog post (under MIN_WORDS words),
 * regenerates it with full GPT-4o content (1200+ words), adds a fresh
 * Pexels hero image, humanizes with Claude, and pushes back to GitHub.
 *
 * Run once or twice daily until all thin posts are fixed.
 * Processes ONE post per run to stay within API rate limits.
 *
 * Run: node regenerate-thin-posts.js [--dry-run]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI    = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const sharp     = require('sharp');
const path      = require('path');
const fs        = require('fs');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';
const SITE_URL     = 'https://boxxfinance.co.uk';
const MIN_WORDS    = 1200; // posts below this get regenerated

const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Infer service from slug / title ─────────────────────────────────────────

const SLUG_SERVICE_MAP = [
  [/bridging|chain.break|auction.purchas/,          'Bridging Finance'],
  [/development.finance|property.development/,       'Development Finance'],
  [/commercial.mortgage|semi.commercial|leasehold/,  'Commercial Mortgage'],
  [/invoice.finance|factoring|invoice.discounting/,  'Invoice Finance'],
  [/asset.finance|hire.purchase|leasing|machinery/,  'Asset Finance'],
  [/working.capital|revolving.credit|stock.finance/, 'Working Capital'],
  [/trade.finance|letter.of.credit|import|export/,   'Trade Finance'],
  [/cashflow|merchant.cash|revenue.based/,           'Cashflow Finance'],
  [/mezzanine/,                                       'Mezzanine Finance'],
  [/structured.finance|spv|whole.loan/,              'Structured Finance'],
  [/business.loan|unsecured|startup.loan|sme/,       'Business Loans'],
];

const SERVICE_META = {
  'Bridging Finance':    { slug:'bridging-finance',    author:'Mark Higgins',    url:'/funding-solutions/bridging-finance'    },
  'Development Finance': { slug:'development-finance', author:'Mark Higgins',    url:'/funding-solutions/development-finance' },
  'Commercial Mortgage': { slug:'commercial-mortgages',author:'Mark Higgins',    url:'/funding-solutions/commercial-mortgages'},
  'Invoice Finance':     { slug:'invoice-finance',     author:'Andrew Farrimond',url:'/funding-solutions/invoice-finance'     },
  'Asset Finance':       { slug:'asset-finance',       author:'Andrew Farrimond',url:'/funding-solutions/asset-finance'       },
  'Working Capital':     { slug:'working-capital',     author:'Andrew Farrimond',url:'/funding-solutions/working-capital'     },
  'Trade Finance':       { slug:'trade-finance',       author:'Andrew Farrimond',url:'/funding-solutions/trade-finance'       },
  'Cashflow Finance':    { slug:'cashflow-finance',    author:'Andrew Farrimond',url:'/funding-solutions/cashflow-finance'    },
  'Mezzanine Finance':   { slug:'mezzanine-finance',   author:'Mark Higgins',    url:'/funding-solutions/mezzanine-finance'  },
  'Structured Finance':  { slug:'structured-finance',  author:'Mark Higgins',    url:'/funding-solutions/structured-finance' },
  'Business Loans':      { slug:'business-loans',      author:'Andrew Farrimond',url:'/funding-solutions/business-loans'     },
};

const PEXELS_SERVICE_QUERIES = {
  'Bridging Finance':    'UK property development construction site',
  'Development Finance': 'UK property construction architect plans',
  'Commercial Mortgage': 'UK commercial property building office',
  'Invoice Finance':     'UK business paperwork accounts desk',
  'Asset Finance':       'UK industrial machinery factory equipment',
  'Working Capital':     'UK business team meeting professionals',
  'Trade Finance':       'UK port shipping logistics containers',
  'Cashflow Finance':    'UK business professionals office',
  'Mezzanine Finance':   'UK city financial district skyline',
  'Structured Finance':  'UK city London financial district',
  'Business Loans':      'UK small business entrepreneur office',
};

function inferService(post) {
  if (post.service) return post.service;
  if (post.category && SERVICE_META[post.category]) return post.category;
  const text = (post.slug + ' ' + post.title).toLowerCase();
  for (const [pattern, service] of SLUG_SERVICE_MAP) {
    if (pattern.test(text)) return service;
  }
  return 'Business Loans';
}

function wordCount(html) {
  return (html || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
    .split(' ').filter(w => w.length > 0).length;
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  return { sha: data.sha, posts: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, message) {
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message, sha: latest.sha, branch: 'main',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
  });
}

// ─── GPT-4o article generation ───────────────────────────────────────────────

async function generateArticle(post, service, meta) {
  const keyword   = post.keywords?.split(',')[0]?.trim() || post.title.toLowerCase();
  const serviceUrl = `${SITE_URL}${meta.url}`;
  const serviceCtaSlug = meta.slug || service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const chatUrl = `${SITE_URL}/chat-about-funding/${serviceCtaSlug}`;

  const systemPrompt = `You are an experienced UK commercial finance broker writing a blog article for Boxx Commercial Finance. Write in a natural, human, UK tone. Never use em dashes. Never use generic AI phrases. Return only a raw JSON object with no wrapper, no explanation, no markdown.`;

  const userPrompt = `Write a blog article and return it as a single JSON object with exactly these keys:
slug, title, excerpt, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, category, faqSchema, contentHtml

OUTPUT RULES:
- contentHtml must be valid HTML using only single quotes inside HTML attributes
- No markdown, no backticks, no code fences — return raw JSON only
- secondaryKeywords must be a JSON array of strings
- Do NOT include an <h1> tag in contentHtml

TONE AND STYLE:
- Natural, human, UK English throughout
- Short paragraphs, no paragraph longer than 4 sentences
- Practical, real-world advice a broker would give a client
- At least one realistic business scenario showing the product in use
- No generic AI phrases, no corporate waffle

ARTICLE STRUCTURE:
- Open with a single <p> of 50-70 words that directly answers the core question
- <h2>What this means in practice</h2>
- <h2>How it works</h2>
- <h2>Typical scenarios</h2> (include a realistic named-business example)
- <h2>Common mistakes</h2>
- <h2>Alternatives or comparisons</h2>
- <h2>How to get the best outcome</h2>
- <h2>Summary</h2>
- <h2>Frequently Asked Questions</h2> (4-6 Q&As using <dl><dt><dd> tags)

WORD COUNT: Minimum 1200 words.

CALLS TO ACTION:
- Mid-article: include a paragraph encouraging the reader to get advice, linking to ${chatUrl} — use anchor text like "speak to a commercial finance specialist" or "get expert advice on ${keyword}" — NEVER "click here" or "contact us"
- Closing: end the article (before the FAQ) with a short enquiry prompt, linking to ${chatUrl}

INTERNAL LINKS — follow 2026 SEO/AEO best practices. Anchor text must be descriptive 2-5 words, never generic ("here", "this page", "click here", "read more", "find out more"):
- Service page (${serviceUrl}): include at least 3 contextual links using keyword-rich anchor text that names the product and its benefit, e.g. "${keyword} solutions", "${keyword} for UK businesses", "specialist ${keyword} advice" — vary the phrasing
- Funding hub https://boxxfinance.co.uk/funding-solutions: include once using anchor text like "UK commercial funding solutions" or "business funding options" — NEVER the long phrase "full range of UK business funding solutions"
- About us section https://boxxfinance.co.uk/#about: use "Boxx Commercial Finance" as anchor text on the first natural mention of the brand — do NOT link to /about-us (that page does not exist)
- Never invent URLs — only link to pages explicitly provided in this prompt

faqSchema must be a valid FAQ schema object matching the FAQ in contentHtml exactly.

Keyword: ${keyword}
Title: ${post.title}
Service: ${service}
Category: ${service}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', max_tokens: 6000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  });

  let content = response.choices[0].message.content;
  content = content.replace(/```json/g,'').replace(/```/g,'').replace(/“/g,'"').replace(/”/g,'"').trim();
  return JSON.parse(content);
}

// ─── Pexels image ─────────────────────────────────────────────────────────────

async function fetchPexelsImage(service) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  const query = PEXELS_SERVICE_QUERIES[service] || 'UK business professionals';
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=large`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos?.length) return null;
  const photo = data.photos[0];
  const imgRes = await fetch(photo.src.large);
  if (!imgRes.ok) return null;
  return Buffer.from(await imgRes.arrayBuffer());
}

async function uploadImage(slug, buffer) {
  const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  const imagePath  = `public/images/blog/${slug}.webp`;
  let existingSha;
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath });
    existingSha = data.sha;
  } catch {}
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    message: `Update hero image: ${slug}`,
    content: webpBuffer.toString('base64'),
    branch: 'main',
    ...(existingSha && { sha: existingSha }),
  });
  return `/images/blog/${slug}.webp`;
}

// ─── Humanizer ────────────────────────────────────────────────────────────────

async function humanize(html, author) {
  if (!process.env.ANTHROPIC_API_KEY) return html;
  const prompt = `Edit this HTML article for ${author} at Boxx Commercial Finance. Remove AI writing patterns:
- Remove em dashes (—), overused words (tapestry, leverage, pivotal, underscore, nuanced, robust), hedging phrases (it's worth noting, in order to), passive voice where possible, generic conclusions.
- Preserve ALL HTML tags, links, and factual content exactly.
- UK spelling throughout.
- Do NOT wrap the output in markdown code fences or backticks (no \`\`\`html, no \`\`\`) — return raw HTML only.
- Return ONLY the modified HTML.

HTML:
${html.substring(0, 12000)}`;

  const r = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  let result = r.content[0].type === 'text' ? r.content[0].text.trim() : '';
  // Defensive cleanup: strip markdown code fences the model sometimes adds
  // despite being told not to (this is what left literal "```html" visible
  // at the top of several published articles).
  result = result.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return (result && result.includes('<')) ? result : html;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Thin Post Regenerator      ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  if (isDryRun) console.log('⚠  DRY RUN\n');

  const { posts } = await getBlogPostsFile();

  // Find thinnest published post
  const candidates = posts
    .filter(p => p.status === 'published')
    .map(p => ({ p, wc: wordCount(p.content) }))
    .filter(({ wc }) => wc < MIN_WORDS)
    .sort((a, b) => a.wc - b.wc);

  if (candidates.length === 0) {
    console.log(`✅ All published posts are ${MIN_WORDS}+ words. Nothing to regenerate.\n`);
    return;
  }

  const { p: post, wc } = candidates[0];
  const remaining = candidates.length;
  const service   = inferService(post);
  const meta      = SERVICE_META[service] || SERVICE_META['Business Loans'];

  console.log(`Found: "${post.title}"`);
  console.log(`  Current: ${wc} words  |  Service: ${service}  |  ${remaining} posts remaining\n`);

  if (isDryRun) {
    console.log('Dry run — would regenerate this post. Exiting.');
    return;
  }

  // 1. Regenerate content
  console.log('Generating article via GPT-4o...');
  const article = await generateArticle(post, service, meta);
  console.log(`  Generated: ~${wordCount(article.contentHtml)} words`);

  // 2. Humanize
  console.log('Humanizing content...');
  article.contentHtml = await humanize(article.contentHtml, meta.author);

  // 3. Fresh Pexels image
  console.log('Fetching Pexels image...');
  let heroImage = post.heroImage;
  try {
    const imgBuffer = await fetchPexelsImage(service);
    if (imgBuffer) {
      heroImage = await uploadImage(post.slug, imgBuffer);
      console.log(`  Image: ${heroImage}`);
    }
  } catch (err) {
    console.warn(`  Image failed (non-fatal): ${err.message}`);
  }

  // 4. Update the post in-place
  const idx = posts.findIndex(p => p.slug === post.slug);
  posts[idx] = {
    ...post,
    service,
    category:        service,
    excerpt:         article.excerpt         || post.excerpt,
    metaTitle:       article.metaTitle       || post.metaTitle,
    metaDescription: article.metaDescription || post.metaDescription,
    keywords:        Array.isArray(article.secondaryKeywords)
                       ? article.secondaryKeywords.join(', ')
                       : (article.secondaryKeywords || post.keywords),
    heroImage,
    schema:          article.faqSchema || post.schema,
    content:         article.contentHtml,
    author:          post.author || meta.author,
  };

  const newWc = wordCount(posts[idx].content);
  console.log(`\nWord count: ${wc} → ${newWc} words`);

  // 5. Push
  console.log('Pushing to GitHub...');
  await pushBlogPostsFile(posts, `regenerate: ${post.slug} (${wc} → ${newWc} words, ${remaining - 1} remaining)`);

  console.log(`\n✅ Done. ${remaining - 1} thin posts remaining.\n`);
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
