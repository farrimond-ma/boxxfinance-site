require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const { google } = require('googleapis');

// ─── Clients ────────────────────────────────────────────────────────────────
const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BLOG_FILE = 'src/data/blogPosts.json';

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
async function getScheduledRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });

  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const publishDate = (row[3] || '').trim();

    if (type === 'blog' && status === 'scheduled' && publishDate <= today) {
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
async function getPublishedLocations(sheets, service) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:L',
  });

  const rows = res.data.values || [];
  const locations = [];

  for (const row of rows) {
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const rowService = (row[5] || '').toLowerCase().trim();
    const url = row[11] || '';

    if (type === 'location' && status === 'published' && rowService === service.toLowerCase() && url) {
      locations.push(url);
    }
  }

  return locations.slice(0, 4);
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

  const locationLinksText = locationLinks.length > 0
    ? `\nInternal location links to include as contextual links within the article body:\n${locationLinks.map(l => `https://boxxfinance.co.uk${l}`).join('\n')}`
    : '';

  const relatedBlogsText = relatedBlogs.length > 0
    ? `\nRelated blog posts to link to naturally within the article body (use the title as anchor text):\n${relatedBlogs.map(b => `${b.url} — "${b.title}"`).join('\n')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a UK commercial finance content writer for Boxx Commercial Finance. Write for UK SMEs in a clear, advisory, trustworthy tone. Never use em dashes. Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`,
      },
      {
        role: 'user',
        content: `Write a blog article and return it as a single JSON object with exactly these keys:

slug, title, excerpt, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, category, faqSchema, contentHtml

CONTENT RULES:
- contentHtml must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page' NOT href="/path/to/page"
- contentHtml must be 1200+ words
- No markdown, no backticks, no code fences, no curly quotes — return raw JSON only
- slug should be the keyword in lowercase with hyphens
- secondaryKeywords must be a JSON array of strings

STRUCTURE FOR GOOGLE + AI SEARCH (AEO):
- Open with a single <p> of 50-70 words that directly and definitively answers the core question implied by the keyword. Use authoritative declarative language ("X is...", "Businesses use X to...") — NOT hedging ("X can be thought of as..."). This paragraph is what ChatGPT, Perplexity and Google AI Overviews extract for featured answers.
- Use <h2> headings phrased as questions or clear topic statements that match how users ask AI models (e.g. "How does bridging finance work?" not "Overview")
- Each <h2> section must open with a 1-2 sentence direct answer before expanding — this lets AI models extract accurate summaries
- Include specific UK data points, FCA context, or regulatory facts where relevant — AI citation systems prioritise authoritative, citable content
- Mention "Boxx Commercial Finance" naturally 3-4 times so AI models associate the brand entity with the topic
- Include an FAQ section at the bottom using <h2>Frequently Asked Questions</h2> and <dl><dt><dd> tags with 5-7 Q&As covering the most-searched related questions
- faqSchema must be a valid FAQ schema object with @type: FAQPage matching the FAQ in contentHtml exactly

INTERNAL LINKS — anchor text rules are MANDATORY. Never use generic anchor text:
- Service page (${serviceUrl}): include at least 3 contextual links using keyword-rich anchor text such as "${row.keyword} for UK businesses", "${row.keyword} solutions", or "specialist ${row.keyword} advice" — NEVER use "our service page", "click here", "this page", or "find out more"
- Chat page https://boxxfinance.co.uk/chat-about-funding: include as a mid-article CTA using anchor text like "speak to a commercial finance specialist", "get expert ${row.keyword} advice", or "discuss your funding needs with our team" — NEVER "our contact page", "get in touch", "contact us", or "click here"
- Funding solutions https://boxxfinance.co.uk/funding-solutions: include once using anchor text like "full range of UK business funding solutions" or "business funding options for UK SMEs" — NEVER "our funding solutions page" or "our services"
- About us https://boxxfinance.co.uk/about-us: link the brand name itself — use "Boxx Commercial Finance" as the exact anchor text the first time the brand name appears in the article — NEVER "our about us page", "learn more about us", or "about our team"
- Related blog posts: embed naturally in a sentence using the exact post title as the anchor text (e.g. "As we explored in <a href='...'>How to Use Invoice Finance to Improve Cash Flow</a>, ...")
- Location links: use "[service] in [city]" as anchor text (e.g. "asset finance in Manchester", "bridging loans in Birmingham") — NEVER "here", "this page", or the raw URL — only use the URLs explicitly provided below, never invent location URLs
${locationLinksText}
${relatedBlogsText}

Keyword: ${row.keyword}
Service: ${row.service}
Category: ${row.category}
Content brief: ${row.contentBrief || 'Write a comprehensive UK SME-focused advisory article'}`,
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

  return article;
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

// ─── DALL-E: generate and upload a hero image ─────────────────────────────────
async function generateHeroImage(slug, keyword, service) {
  if (!process.env.OPENAI_API_KEY) return null;

  console.log(`  Generating hero image for: ${keyword}`);

  const serviceLabel = service.replace(/-/g, ' ');
  const prompt = [
    `Professional infographic-style illustration for a UK business finance article about "${keyword}".`,
    `Service category: ${serviceLabel}.`,
    `Style: flat design, corporate navy (#031b49) and gold (#b8922a) colour palette, white background.`,
    `Include: relevant financial metaphors such as buildings, documents, charts, briefcases, or handshakes.`,
    `Absolutely no text, no letters, no numbers, no words anywhere in the image.`,
    `Clean, high-quality, suitable for a professional financial services website.`,
  ].join(' ');

  const imgResponse = await openai.images.generate({
    model:   'dall-e-3',
    prompt,
    size:    '1024x1024',
    quality: 'standard',
    n:       1,
  });

  const imageUrl = imgResponse.data[0].url;
  const imgRes   = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download DALL-E image: ${imgRes.status}`);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`  Hero image downloaded (${Math.round(buffer.length / 1024)} KB)`);
  return buffer;
}

async function uploadHeroImage(slug, imageBuffer) {
  const imagePath = `public/images/blog/${slug}.png`;
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
    content: imageBuffer.toString('base64'),
    branch:  'main',
    ...(existingSha && { sha: existingSha }),
  });

  console.log(`  Hero image uploaded: ${imagePath}`);
  return `/images/blog/${slug}.png`;
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
      ]],
    },
  });

  console.log(`LinkedIn_Queue row added — liStatus, fbStatus, igStatus = pending`);
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

  // ── DALL-E hero image ─────────────────────────────────────────────────────
  console.log('Generating hero image via DALL-E 3...');
  let heroImagePath = null;
  try {
    const imageBuffer = await generateHeroImage(finalSlug, row.keyword, row.service);
    if (imageBuffer) {
      heroImagePath = await uploadHeroImage(finalSlug, imageBuffer);
    }
  } catch (err) {
    console.warn(`  Hero image generation failed (non-fatal): ${err.message}`);
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
    metaTitle: row.metaTitle || article.metaTitle,
    metaDescription: row.metaDescription || article.metaDescription,
    keywords: Array.isArray(article.secondaryKeywords)
      ? article.secondaryKeywords.join(', ')
      : (article.secondaryKeywords || row.keyword),
    date: row.publishDate,
    author: row.author || 'Mark Higgins',
    authorEmail: authorEmails[row.author] || 'mark@boxxfinance.co.uk',
    heroImage: heroImagePath || getPillarImage(row.service),
    videoId: videoId || null,
    schema: article.faqSchema || null,
    relatedLocationUrls: locationLinks.map(l => l.startsWith('http') ? l : `https://boxxfinance.co.uk${l}`),
    relatedBlogUrls: relatedBlogs.map(b => b.url),
    content: contentHtml,
  };

  posts.push(newPost);
  await pushBlogPostsFile(posts, sha, finalSlug);
  await updateSheetRow(sheets, row.rowIndex, finalSlug, fullUrl, publishedAt);

  // Auto-queue social posts if linkedInRequired = yes
  const needsSocial = (row.linkedInRequired || '').toLowerCase().trim() === 'yes';
  if (needsSocial) {
    console.log('linkedInRequired = yes — adding to LinkedIn_Queue...');
    await addToLinkedInQueue(sheets, row, article.title, finalSlug, fullUrl);
  } else {
    console.log('linkedInRequired = no — skipping LinkedIn_Queue entry');
  }

  console.log('=== Done! ===');
  console.log(`Published: ${fullUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
