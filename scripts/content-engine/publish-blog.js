require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const { google } = require('googleapis');

// ─── Clients ────────────────────────────────────────────────────────────────
const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BLOG_FILE = 'src/data/blogPosts.json';

// seo-audit.js WARNs below 1200 words. We demand a buffer above that from
// generation so the humanizer pass (which may trim up to 10%) still lands
// the final article over the audit target.
const TARGET_WORDS = 1200;
const GENERATION_MIN_WORDS = 1250;

// Word count matching seo-audit.js exactly (strip tags, collapse whitespace)
function wordCount(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0).length;
}

// ─── Column mapping (0-indexed) ──────────────────────────────────────────────
// A=0 id, B=1 type, C=2 status, D=3 publishDate, E=4 publishSlot
// F=5 service, G=6 city, H=7 keyword, I=8 topic, J=9 title
// K=10 slug, L=11 url, M=12 metaTitle, N=13 metaDescription, O=14 category
// P=15 contentBrief, Q=16 internalLinkService, R=17 internalLinkCity1
// S=18 internalLinkCity2, T=19 internalLinkCity3
// U=20 relatedBlog1, V=21 relatedBlog2, W=22 relatedBlog3
// X=23 faqRequired, Y=24 linkedInRequired, Z=25 author
// AA=26 jsonStatus, AB=27 publishedAt, AC=28 notes

// ─── Pillar images ───────────────────────────────────────────────────────────
const pillarImages = {
  'bridging-finance': ['/images/blog/bridging-finance-1.webp', '/images/blog/bridging-finance-2.webp'],
  'development-finance': ['/images/blog/development-finance-1.webp', '/images/blog/development-finance-2.webp'],
  'commercial-mortgage': ['/images/blog/commercial-mortgage-1.webp', '/images/blog/commercial-mortgage-2.webp'],
  'invoice-finance': ['/images/blog/invoice-finance-1.webp', '/images/blog/invoice-finance-2.webp'],
  'asset-finance': ['/images/blog/asset-finance-1.webp', '/images/blog/asset-finance-2.webp'],
  'working-capital': ['/images/blog/working-capital-1.webp', '/images/blog/working-capital-2.webp'],
  'trade-finance': ['/images/blog/trade-finance-1.webp', '/images/blog/trade-finance-2.webp'],
  'property-finance': ['/images/blog/property-finance-1.webp', '/images/blog/property-finance-2.webp'],
  'business-loans': ['/images/blog/business-loans-1.webp', '/images/blog/business-loans-2.webp'],
  'cashflow-finance': ['/images/blog/cashflow-finance-1.webp', '/images/blog/cashflow-finance-2.webp'],
  'mezzanine-finance': ['/images/blog/mezzanine-finance-1.webp', '/images/blog/mezzanine-finance-2.webp'],
  'structured-finance': ['/images/blog/structured-finance-1.webp', '/images/blog/structured-finance-2.webp'],
};

function getPillarImage(service) {
  const key = service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const images = pillarImages[key] || pillarImages['bridging-finance'];
  return images[Math.floor(Math.random() * images.length)];
}

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
async function getSheetsClient() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials;
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: 'google-credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return google.sheets({ version: 'v4', auth });
}

// ─── Get one scheduled blog row ──────────────────────────────────────────────
// PUBLISH_SLOT controls which slot this run handles: 'AM' (regular content)
// or 'PM' (visibility-gap content added by the weekly visibility sync).
// Defaults to 'AM' so existing behaviour is unchanged when not set.
//
// SERVICE_FILTER (optional): if set, only publish rows for that service.
// e.g. SERVICE_FILTER=Bridging Finance restricts to bridging finance content
// during the strategic pivot period.
async function getScheduledRow(sheets) {
  const slot          = (process.env.PUBLISH_SLOT || 'AM').toUpperCase();
  const serviceFilter = (process.env.SERVICE_FILTER || '').trim().toLowerCase();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });

  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  if (serviceFilter) {
    console.log(`  SERVICE_FILTER active: only publishing "${process.env.SERVICE_FILTER}" content`);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type        = (row[1] || '').toLowerCase().trim();
    const status      = (row[2] || '').toLowerCase().trim();
    const publishDate = (row[3] || '').trim();
    const publishSlot = (row[4] || 'AM').toUpperCase().trim();
    const service     = (row[5] || '').trim();

    // Skip rows that don't match the service filter
    if (serviceFilter && service.toLowerCase() !== serviceFilter) continue;

    if (type === 'blog' && status === 'scheduled' && publishDate <= today && publishSlot === slot) {
      return {
        rowIndex: i + 2,
        id: row[0] || '',
        publishDate,
        publishSlot: row[4] || 'AM',
        service: row[5] || '',
        city: row[6] || '',
        keyword: row[7] || '',
        topic: row[8] || '',
        title: row[9] || '',
        slug: row[10] || '',
        url: row[11] || '',
        metaTitle: row[12] || '',
        metaDescription: row[13] || '',
        category: row[14] || '',
        contentBrief: row[15] || '',
        faqRequired: row[23] || 'yes',
        linkedInRequired: row[24] || 'no',
        author: row[25] || 'Mark Higgins',
        internalLinkService: row[16] || '',
      };
    }
  }
  return null;
}

// ─── Get published location pages for internal linking ───────────────────────
// Reads from locationPages.json in the checked-out repo — these pages are
// guaranteed to be live because the file is only updated after a successful
// deploy. This prevents linking to pages that are published in the sheet but
// not yet deployed to the live site.
async function getPublishedLocations(_sheets, service) {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../../src/data/locationPages.json');
    const pages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const serviceSlug = service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');

    return pages
      .filter(p => p.status === 'published' && p.service === serviceSlug)
      .slice(0, 4)
      .map(p => `/locations/${p.slug}`);
  } catch (err) {
    console.warn(`  Could not read locationPages.json: ${err.message}`);
    return [];
  }
}

// ─── Get published blogs for related article linking ─────────────────────────
async function getPublishedBlogs(sheets, service) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:L',
  });

  const rows = res.data.values || [];
  const blogs = [];

  for (const row of rows) {
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const rowService = (row[5] || '').toLowerCase().trim();
    const url = row[11] || '';
    const title = row[9] || '';

    if (type === 'blog' && status === 'published' && rowService === service.toLowerCase() && url) {
      blogs.push({ url: url.startsWith('http') ? url : `https://boxxfinance.co.uk${url}`, title });
    }
  }

  return blogs.slice(0, 3);
}

// ─── Generate article with OpenAI ────────────────────────────────────────────
async function generateArticle(row, locationLinks, relatedBlogs) {
  console.log(`Generating article for: ${row.keyword || row.title}`);

  const serviceUrl = row.internalLinkService
    ? `https://boxxfinance.co.uk${row.internalLinkService}`
    : `https://boxxfinance.co.uk/funding-solutions/${row.service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`;

  const serviceCtaSlug = row.service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const chatUrl = `https://boxxfinance.co.uk/chat-about-funding/${serviceCtaSlug}`;

  const locationLinksText = locationLinks.length > 0
    ? `\nInternal location links to include as contextual links within the article body:\n${locationLinks.map(l => `https://boxxfinance.co.uk${l}`).join('\n')}`
    : '';

  const relatedBlogsText = relatedBlogs.length > 0
    ? `\nRelated blog posts to link to naturally within the article body (use the title as anchor text):\n${relatedBlogs.map(b => `${b.url} — "${b.title}"`).join('\n')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000, // headroom for 1400-word article + HTML + faqSchema + JSON wrapping
    messages: [
      {
        role: 'system',
        content: `You are an experienced UK commercial finance broker writing a blog article for Boxx Commercial Finance. Write in a natural, human, UK tone — as a trusted adviser speaking directly to a UK SME owner. Never use em dashes. Never use generic AI phrases ("in today's fast-paced world", "navigating the landscape", "it's worth noting", etc.). Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`,
      },
      {
        role: 'user',
        content: `Write a blog article and return it as a single JSON object with exactly these keys:

slug, title, excerpt, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, category, faqSchema, contentHtml

OUTPUT RULES:
- contentHtml must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page' NOT href="/path/to/page"
- No markdown, no backticks, no code fences, no curly quotes — return raw JSON only
- slug should be the keyword in lowercase with hyphens
- metaTitle must be 20-60 characters and must NOT include "| Boxx Commercial Finance" or any brand suffix — the site template appends the brand automatically
- secondaryKeywords must be a JSON array of strings
- Do NOT include an <h1> tag in contentHtml — the title is rendered separately on the page

TONE AND STYLE:
- Natural, human, UK tone throughout
- Short paragraphs — no paragraph longer than 4 sentences
- Practical, real-world advice that a broker would actually give a client
- Include at least one realistic business scenario showing the product in use
- Include mild, well-reasoned opinion where appropriate (e.g. "In our experience..." or "The honest answer is...")
- No generic AI phrases, no corporate waffle

ARTICLE STRUCTURE (adapt headings to fit the specific topic, but follow this pattern):
- Open with a single <p> of 50-70 words that directly and definitively answers the core question. Use declarative language ("X is...", "Businesses use X when...") — NOT hedging. This is what Google AI Overviews and ChatGPT extract as a featured answer. Within this opening paragraph, link the product name to the service page (${serviceUrl}) using keyword-rich anchor text (e.g. "${row.keyword}") — this counts toward the 3+ service-page links required below.
- <h2> What this means in practice</h2>
- <h2> How it works</h2>
- <h2> Typical scenarios</h2>  ← include a realistic named-business example here
- <h2> Common mistakes</h2>
- <h2> Alternatives or comparisons</h2>
- <h2> How to get the best outcome</h2>
- <h2> Summary</h2>
- <h2> Frequently Asked Questions</h2>  ← 4-6 Q&As using <dl><dt><dd> tags

Each <h2> section must open with 1-2 sentences that directly answer the section question before expanding — this lets AI models extract accurate summaries.

WORD COUNT — this is a hard requirement, not a guideline:
- The full article must be at least 1200 words of visible text — aim for 1300-1500
- Every <h2> section except Summary and the FAQ must be at least 150 words
- Each FAQ answer must be 40-70 words
- Articles under 1200 words fail the site's SEO audit and are rejected, so expand thin sections with practical detail, realistic UK figures and broker insight before returning

AI SEARCH (AEO) — additional rules for Google AI Overviews and Perplexity:
- Include specific UK data points, FCA context, or regulatory facts where relevant
- Mention "Boxx Commercial Finance" naturally 3-4 times so AI models associate the brand with the topic
- faqSchema must be a valid FAQ schema object with @type: FAQPage matching the FAQ in contentHtml exactly

CALLS TO ACTION (both required):
- Mid-article CTA: within the body text, include a paragraph encouraging the reader to get advice, linking to ${chatUrl} using anchor text like "speak to a commercial finance specialist" or "get expert ${row.keyword} advice" — NEVER "click here" or "contact us"
- Closing CTA: end the article (before the FAQ) with a short paragraph encouraging an enquiry, linking to ${chatUrl}

INTERNAL LINKS — anchor text rules are MANDATORY. Follow 2026 SEO/AEO best practices: descriptive 2-5 word anchors, never generic single words. Never use "here", "this page", "click here", "read more", "learn more", "find out more", "our services", or "our page".
- Service page (${serviceUrl}): include at least 3 contextual links. Use keyword-rich 2-5 word anchor text that names the product and its benefit or audience, e.g. "${row.keyword} for UK businesses", "${row.keyword} options", "specialist ${row.keyword} advice", "UK ${row.keyword} solutions" — vary the phrasing across the 3+ links so they are not identical
- Funding solutions hub https://boxxfinance.co.uk/funding-solutions: include once near the end of the article using descriptive anchor text like "UK commercial funding solutions", "business funding options", or "commercial finance solutions for UK SMEs" (2-6 words, specific) — NEVER the full sentence "full range of UK business funding solutions"
- About us section https://boxxfinance.co.uk/#about: link the brand name — use "Boxx Commercial Finance" as anchor text the first time the brand name appears naturally in the text — do NOT link to /about-us (that page does not exist)
- Related blog posts: embed naturally in a sentence using keyword-rich anchor text describing what the post covers, NOT the raw post title. E.g. if linking to a post about bridging loan rates, write "current UK bridging loan rates" as the anchor — NEVER "Read Article" or just the page URL
- Location links: use "[service] in [city]" as anchor text (e.g. "asset finance in Manchester", "bridging loans in Birmingham") — NEVER "here", "this page", or the raw URL — only use the URLs explicitly provided below, never invent location URLs
- Only use links explicitly provided — do not invent any URLs
${locationLinksText}
${relatedBlogsText}

Keyword: ${row.keyword}
Service: ${row.service}
Category: ${row.category}
Content brief: ${row.contentBrief || 'Write a comprehensive UK SME-focused advisory article'}

${row.service === 'Bridging Finance' ? `BRIDGING FINANCE TERMINOLOGY (mandatory for all bridging articles):
- Use both "bridging loans" and "bridging finance" naturally throughout — do not rely on just one term. Alternate between them as a real broker would in conversation.
- Include "developer finance" where the scenario involves property development, refurbishment, conversion or planning gain. Many bridging clients are developers — address them directly.
- Target TWO audiences in every article: (1) residential property buyers, investors and homeowners (the larger market) and (2) property developers and commercial investors. Both use bridging. The residential scenario might be a chain break or auction purchase; the developer scenario might be a refurbishment or development exit. Include at least one example from each where the topic allows.
- UK English throughout: "bridging loan" not "bridge loan", "property" not "real estate", "solicitor" not "attorney".
- Phrases to use naturally: "short-term property finance", "fast property finance", "specialist property finance" — these widen search reach without keyword stuffing.` : ''}`,
      },
    ],
  });

  let content = response.choices[0].message.content;
  content = content.replace(/```json/g, '').replace(/```/g, '').replace(/\u201c/g, '"').replace(/\u201d/g, '"').trim();

  let article;
  try {
    article = JSON.parse(content);
  } catch (err) {
    console.error('OpenAI returned invalid JSON. Raw output:');
    console.error(content.substring(0, 500));
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  // GPT-4o reliably under-delivers on "minimum 1200 words" in a single shot
  // (every post to date came back at 330-960 words), so verify and expand.
  let words = wordCount(article.contentHtml);
  console.log(`  Draft word count: ${words}`);
  for (let attempt = 1; attempt <= 2 && words < GENERATION_MIN_WORDS; attempt++) {
    console.log(`  Below ${GENERATION_MIN_WORDS}-word minimum — expansion pass ${attempt}...`);
    article.contentHtml = await expandArticleHtml(article.contentHtml, row.keyword, words);
    words = wordCount(article.contentHtml);
    console.log(`  Word count after expansion: ${words}`);
  }
  if (words < GENERATION_MIN_WORDS) {
    console.warn(`  Still ${words} words after expansion passes — publishing anyway, seo-audit will flag if under ${TARGET_WORDS}`);
  }

  return article;
}

// ─── Expand an article that came back under the word-count minimum ───────────
async function expandArticleHtml(html, keyword, currentWords) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000,
    messages: [
      {
        role: 'system',
        content: `You are an experienced UK commercial finance broker writing for Boxx Commercial Finance. Write in a natural, human, UK tone. Never use em dashes. Never use generic AI phrases. Never use markdown, backticks, or code fences.`,
      },
      {
        role: 'user',
        content: `The article below is ${currentWords} words. The minimum is 1200 words. Expand it to at least 1400 words by deepening the existing sections: add practical detail, realistic UK figures, concrete steps, and broker insight on "${keyword}".

RULES:
- Keep every existing HTML tag, link, href and attribute exactly as it is — do not remove or rewrite any <a> link
- Do not add new <h2> sections and do not change any heading text
- Do not change the Frequently Asked Questions section at all
- Do not add an <h1> tag
- Use only single quotes inside HTML attributes
- Short paragraphs — no paragraph longer than 4 sentences
- Return ONLY the full expanded HTML — no JSON, no markdown, no commentary

ARTICLE HTML:
${html}`,
      },
    ],
  });

  let expanded = (response.choices[0].message.content || '').trim();
  expanded = expanded.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!expanded || !expanded.includes('<')) {
    console.warn('  Expansion returned non-HTML — keeping current version');
    return html;
  }
  if (wordCount(expanded) <= currentWords) {
    console.warn('  Expansion did not grow the article — keeping current version');
    return html;
  }
  return expanded;
}

// ─── YouTube: find a relevant educational video ───────────────────────────────
async function findYouTubeVideo(keyword) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('  No YOUTUBE_API_KEY set — skipping video embed');
    return null;
  }

  const EXCLUDED_TERMS = ['boxx', 'rival', 'competitor']; // extend as needed

  const query = encodeURIComponent(`${keyword} UK explained`);
  const url = [
    'https://www.googleapis.com/youtube/v3/search',
    `?part=snippet&q=${query}&type=video`,
    '&relevanceLanguage=en&regionCode=GB',
    '&videoDuration=medium&videoEmbeddable=true',
    '&maxResults=8',
    `&key=${apiKey}`,
  ].join('');

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  YouTube API error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const video = data.items.find((item) => {
    const channel = (item.snippet.channelTitle || '').toLowerCase();
    return !EXCLUDED_TERMS.some((t) => channel.includes(t));
  });

  return video ? video.id.videoId : null;
}

// ─── Pexels: fetch a relevant hero image ─────────────────────────────────────
async function fetchPexelsImage(keyword, service) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log('  No PEXELS_API_KEY set — skipping hero image');
    return null;
  }

  console.log(`  Searching Pexels for: ${keyword}`);

  const trySearch = async (query) => {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return null;
    // Filter out photos that likely show non-UK currency (avoid generic money shots)
    const filtered = data.photos.filter(p => {
      const desc = ((p.alt || '') + ' ' + (p.photographer || '')).toLowerCase();
      return !desc.match(/\$|dollar|euro|€|usd|eur/i);
    });
    return filtered[0] || data.photos[0];
  };

  // Service → curated image query mapping.
  // Deliberately avoids generic "money/cash/coins" searches that return
  // US dollars and euros. Uses professional UK business context instead.
  const serviceKey = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const SERVICE_QUERIES = {
    'bridging-finance':    'UK property development construction',
    'development-finance': 'UK property construction architect',
    'commercial-mortgages':'UK commercial property building office',
    'commercial-mortgage': 'UK commercial property building office',
    'invoice-finance':     'UK business paperwork accounts desk',
    'asset-finance':       'UK industrial machinery factory equipment',
    'working-capital':     'UK business team meeting growth',
    'trade-finance':       'UK port shipping logistics supply chain',
    'cashflow-finance':    'UK business professional office meeting',
    'mezzanine-finance':   'UK city financial district skyline',
    'structured-finance':  'UK city London financial district',
    'business-loans':      'UK small business entrepreneur office',
  };
  const primaryQuery = SERVICE_QUERIES[serviceKey] || 'UK business professionals meeting office';

  const photo = (await trySearch(primaryQuery))
             || (await trySearch('UK business professionals office'))
             || (await trySearch('British business meeting'));

  if (!photo) {
    console.log('  No Pexels image found — will use pillar image fallback');
    return null;
  }

  console.log(`  Pexels image found: ${photo.url}`);
  const imgRes = await fetch(photo.src.large2x || photo.src.large);
  if (!imgRes.ok) throw new Error(`Failed to download Pexels image: ${imgRes.status}`);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`  Image downloaded (${Math.round(buffer.length / 1024)} KB)`);
  return buffer;
}

async function uploadHeroImage(slug, imageBuffer) {
  // Convert to WebP for better performance (typically 25-35% smaller than JPEG)
  const webpBuffer = await sharp(imageBuffer)
    .webp({ quality: 85 })
    .toBuffer();

  const imagePath = `public/images/blog/${slug}.webp`;
  let existingSha;

  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    });
    existingSha = data.sha;
  } catch {
    // File doesn't exist yet — that's expected
  }

  await octokit.repos.createOrUpdateFileContents({
    owner:   GITHUB_OWNER,
    repo:    GITHUB_REPO,
    path:    imagePath,
    message: `Add hero image: ${slug}`,
    content: webpBuffer.toString('base64'),
    branch:  'main',
    ...(existingSha && { sha: existingSha }),
  });

  console.log(`  Hero image uploaded: ${imagePath} (WebP, ${Math.round(webpBuffer.length / 1024)}KB)`);
  return `/images/blog/${slug}.webp`;
}

// ─── Get current blogPosts.json from GitHub ───────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, posts: JSON.parse(content) };
}

// ─── Push updated blogPosts.json to GitHub ────────────────────────────────────
async function pushBlogPostsFile(posts, sha, slug) {
  const content = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
    message: `Publish blog: ${slug}`,
    content,
    sha,
    branch: 'main',
  });

  console.log(`Successfully pushed ${BLOG_FILE} to GitHub`);
}

// ─── Auto-queue social posts in LinkedIn_Queue ────────────────────────────────
async function addToLinkedInQueue(sheets, row, articleTitle, finalSlug, fullUrl) {
  const today = new Date().toISOString().split('T')[0];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A:R',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        Date.now(),                      // A  id
        today,                           // B  publishDate
        row.service,                     // C  service
        row.keyword,                     // D  keyword
        row.title || articleTitle,       // E  title
        finalSlug,                       // F  slug
        fullUrl,                         // G  url
        row.author || 'Mark Higgins',    // H  author
        'pending',                       // I  liStatus
        '',                              // J  liPostText
        '',                              // K  liFirstComment
        '',                              // L  notes
        'pending',                       // M  fbStatus
        '',                              // N  fbPostText
        '',                              // O  fbPostId
        'pending',                       // P  igStatus
        '',                              // Q  igPostText
        '',                              // R  igPostId
        'pending',                       // S  pinterestStatus
        '',                              // T  pinterestDescription
        '',                              // U  pinterestPinId
        'pending',                       // V  reelStatus
        '',                              // W  reelId
        'pending',                       // X  tiktokStatus
        '',                              // Y  tiktokVideoId
      ]],
    },
  });

  console.log(`LinkedIn_Queue row added — liStatus, fbStatus, igStatus, pinterestStatus, reelStatus, tiktokStatus = pending`);
}

// ─── Update the Google Sheet row ──────────────────────────────────────────────
async function updateSheetRow(sheets, rowIndex, slug, liveUrl, publishedAt) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      valueInputOption: 'RAW',
      data: [
        { range: `ContentEngine!C${rowIndex}`, values: [['published']] },
        { range: `ContentEngine!K${rowIndex}`, values: [[slug]] },
        { range: `ContentEngine!L${rowIndex}`, values: [[liveUrl]] },
        { range: `ContentEngine!AA${rowIndex}`, values: [['published']] },
        { range: `ContentEngine!AB${rowIndex}`, values: [[publishedAt]] },
      ],
    },
  });

  console.log(`Updated sheet row ${rowIndex} to published`);
}

// ─── Humanizer: remove AI writing patterns via Claude ─────────────────────────
// Applies the 30 patterns from github.com/blader/humanizer to make GPT-4o
// output read as genuinely written rather than AI-generated.
async function humanizeContent(html, keyword, author) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  No ANTHROPIC_API_KEY — skipping humanizer');
    return html;
  }

  // Never truncate the article going into the rewrite — a substring cap here
  // used to silently drop the tail of anything over 12,000 chars. A 1200+
  // word article is ~10-14k chars of HTML, so skip rather than clip.
  if (html.length > 24000) {
    console.warn(`  Article HTML is ${html.length} chars — too long to humanize safely, skipping`);
    return html;
  }

  const originalWords = wordCount(html);

  const htmlPrompt = `You are editing HTML content for a UK commercial finance article written by ${author}.

Rewrite ONLY the visible text within the HTML tags below. Do NOT change any HTML tags, attributes, href values, class names, or structure. Preserve all <a>, <h2>, <h3>, <p>, <ul>, <li>, <dl>, <dt>, <dd> tags exactly.

Apply these changes to the visible text only:
- Replace overused AI words: tapestry, landscape, pivotal, underscore, delve, comprehensive, robust, leverage, utilise, multifaceted, nuanced, "in today's fast-paced"
- Remove em dashes (—) — rewrite the sentence instead
- Rewrite excessive hedging phrases as direct statements
- Rewrite passive voice as active voice where possible
- Replace filler phrases with direct wording: "in order to", "due to the fact that", "it should be noted", "it is worth noting"
- Rewrite forced rule-of-three structures
- Keep all facts, links, and HTML structure identical
- Do NOT shorten the article: rewrite weak phrasing in place rather than deleting sentences — the output must stay within 10% of the input's word count
- UK spelling throughout
- Do NOT wrap the output in markdown code fences or backticks (no \`\`\`html, no \`\`\`) — return raw HTML only
- Return ONLY the modified HTML, nothing else

HTML TO REWRITE:
${html}`;

  try {
    const htmlResponse = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 12000,
      messages:   [{ role: 'user', content: htmlPrompt }],
    });

    let humanizedHtml = htmlResponse.content[0].type === 'text' ? htmlResponse.content[0].text.trim() : '';
    // Defensive cleanup: strip markdown code fences the model sometimes adds
    // despite being told not to (this is what produced the literal "```html"
    // visible at the top of published articles like bridging-loan-calculator-uk).
    humanizedHtml = humanizedHtml.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();

    if (!humanizedHtml || !humanizedHtml.includes('<')) {
      console.warn('  Humanizer returned non-HTML — using original');
      return html;
    }

    // The humanizer trims filler, but with no floor it was compressing
    // articles by ~150 words on average. Allow light trimming only.
    const humanizedWords = wordCount(humanizedHtml);
    if (humanizedWords < originalWords * 0.9) {
      console.warn(`  Humanizer shrank the article ${originalWords} → ${humanizedWords} words — using original`);
      return html;
    }

    console.log(`  ✅ Content humanized (${originalWords} → ${humanizedWords} words)`);
    return humanizedHtml;

  } catch (err) {
    console.warn(`  Humanizer failed (non-fatal): ${err.message}`);
    return html;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Boxx Content Engine: Blog Publisher ===');
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  const row = await getScheduledRow(sheets);
  if (!row) {
    console.log('No scheduled blog rows found for today. Exiting.');
    return;
  }
  console.log(`Found scheduled row ${row.rowIndex}: ${row.keyword || row.title}`);

  const locationLinks = await getPublishedLocations(sheets, row.service);
  console.log(`Found ${locationLinks.length} published location pages for ${row.service}`);

  const relatedBlogs = await getPublishedBlogs(sheets, row.service);
  console.log(`Found ${relatedBlogs.length} related published blogs for ${row.service}`);

  console.log('Fetching current blogPosts.json from GitHub...');
  const { sha, posts } = await getBlogPostsFile();
  console.log(`Current file has ${posts.length} posts, SHA: ${sha}`);

  const slug = row.slug;
  const existingPost = posts.find(p => p.slug === slug);
  if (existingPost) {
    console.log(`Slug "${slug}" already exists — marking sheet row as published and skipping generation.`);
    await updateSheetRow(sheets, row.rowIndex, slug, `https://boxxfinance.co.uk/insights/${slug}`, existingPost.publishedAt || new Date().toISOString());
    return;
  }

  const article = await generateArticle(row, locationLinks, relatedBlogs);
  console.log(`Article generated: ${article.title}`);

  // ── Humanize: strip AI writing patterns via Claude ────────────────────────
  console.log('Humanizing content...');
  article.contentHtml = await humanizeContent(
    article.contentHtml,
    row.keyword,
    row.author || 'Mark Higgins'
  );

  // Final word-count gate: if humanizing left the article under the audit
  // target, run one more expansion pass on the final HTML before publishing.
  let finalWords = wordCount(article.contentHtml);
  if (finalWords < TARGET_WORDS) {
    console.log(`Final article is ${finalWords} words — running post-humanize expansion...`);
    article.contentHtml = await expandArticleHtml(article.contentHtml, row.keyword, finalWords);
    finalWords = wordCount(article.contentHtml);
  }
  console.log(`Final word count: ${finalWords}${finalWords < TARGET_WORDS ? ` (still below ${TARGET_WORDS} — seo-audit will WARN)` : ' ✅'}`);

  // Ensure question-style titles end with ?
  const rawTitle = row.title || article.title;
  const questionRe = /^(what|how|why|when|where|who|which|can|should|do|does|is|are|will|would|could)\s/i;
  const finalTitle = questionRe.test(rawTitle) && !rawTitle.trim().endsWith('?')
    ? rawTitle.trim() + '?'
    : rawTitle;
  if (finalTitle !== rawTitle) console.log(`  Title updated: "${rawTitle}" → "${finalTitle}"`);

  const finalSlug = slug || article.slug;
  const url = `/insights/${finalSlug}`;
  const publishedAt = new Date().toISOString();
  const fullUrl = `https://boxxfinance.co.uk${url}`;

  // ── YouTube embed — stored as videoId field, rendered by React (avoids WAF) ──
  console.log('Searching YouTube for a relevant embed...');
  const contentHtml = article.contentHtml;
  let videoId = null;
  try {
    videoId = await findYouTubeVideo(row.keyword);
    if (videoId) {
      console.log(`  Found video: https://youtu.be/${videoId} — storing as videoId (React renders the iframe)`);
    } else {
      console.log('  No suitable video found — skipping embed');
    }
  } catch (err) {
    console.warn(`  YouTube search failed (non-fatal): ${err.message}`);
  }

  // ── Pexels hero image ─────────────────────────────────────────────────────
  console.log('Fetching hero image from Pexels...');
  let heroImagePath = null;
  try {
    const imageBuffer = await fetchPexelsImage(row.keyword, row.service);
    if (imageBuffer) {
      heroImagePath = await uploadHeroImage(finalSlug, imageBuffer);
    }
  } catch (err) {
    console.warn(`  Hero image fetch failed (non-fatal): ${err.message}`);
  }

  const authorEmails = {
    'Mark Higgins': 'mark@boxxfinance.co.uk',
    'Andrew Farrimond': 'andrew@boxxfinance.co.uk',
  };

  const newPost = {
    id: Date.now(),
    status: 'published',
    slug: finalSlug,
    url: url,
    title: finalTitle,
    excerpt: article.excerpt,
    // Strip any brand suffix the model adds anyway — SEO.jsx appends the brand,
    // so a baked-in suffix renders a doubled "| Boxx ... | Boxx ..." title tag
    metaTitle: (row.metaTitle || article.metaTitle || '')
      .replace(/(\s*\|\s*Boxx Commercial Finance)+\s*$/i, '').trim(),
    metaDescription: row.metaDescription || article.metaDescription,
    keywords: Array.isArray(article.secondaryKeywords)
      ? article.secondaryKeywords.join(', ')
      : (article.secondaryKeywords || row.keyword),
    date: row.publishDate,
    author: row.author || 'Mark Higgins',
    authorEmail: authorEmails[row.author] || 'mark@boxxfinance.co.uk',
    service: row.service || '',
    heroImage: heroImagePath || getPillarImage(row.service),
    videoId: videoId || null,
    schema: article.faqSchema || null,
    relatedLocationUrls: locationLinks.map(l => l.startsWith('http') ? l : `https://boxxfinance.co.uk${l}`),
    relatedBlogUrls: relatedBlogs.map(b => b.url),
    content: contentHtml,
    // Social publishing flags — each platform flips its flag to true after posting
    liPosted:        false,
    fbPosted:        false,
    igPosted:        false,
    pinterestPosted: false,
    reelPosted:      false,
  };

  posts.push(newPost);
  await pushBlogPostsFile(posts, sha, finalSlug);
  await updateSheetRow(sheets, row.rowIndex, finalSlug, fullUrl, publishedAt);
  // Social publishers now read directly from blogPosts.json — no queue needed

  console.log('=== Done! ===');
  console.log(`Published: ${fullUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
