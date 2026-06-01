require('dotenv').config();
const path = require('path');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID        = process.env.SPREADSHEET_ID;
const IG_USER_ID            = process.env.INSTAGRAM_USER_ID;
const FB_PAGE_TOKEN         = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const SITE_URL              = 'https://boxxfinance.co.uk';
const FB_API_VER            = 'v21.0';

// ─── Column mapping for LinkedIn_Queue (0-indexed) ────────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author, I=8 liStatus, J=9 liPostText
// K=10 liFirstComment, L=11 notes, M=12 fbStatus, N=13 fbPostText, O=14 fbPostId
// P=15 igStatus, Q=16 igPostText, R=17 igPostId

// ─── Service → image map (same as publish-facebook.js) ───────────────────────
const PILLAR_IMAGES = {
  'bridging-finance':    '/images/blog/bridging-finance-1.webp',
  'development-finance': '/images/blog/development-finance-1.webp',
  'commercial-mortgage': '/images/blog/commercial-mortgage-1.webp',
  'invoice-finance':     '/images/blog/invoice-finance-1.webp',
  'asset-finance':       '/images/blog/asset-finance-1.webp',
  'working-capital':     '/images/blog/working-capital-1.webp',
  'trade-finance':       '/images/blog/trade-finance-1.webp',
  'property-finance':    '/images/blog/property-finance-1.webp',
  'business-loans':      '/images/blog/business-loans-1.webp',
  'cashflow-finance':    '/images/blog/cashflow-finance-1.webp',
  'mezzanine-finance':   '/images/blog/mezzanine-finance-1.webp',
  'structured-finance':  '/images/blog/structured-finance-1.webp',
};

// ─── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Blog post lookup ─────────────────────────────────────────────────────────
let blogPosts = [];
try {
  blogPosts = require('../../src/data/blogPosts.json');
} catch {
  console.warn('  Could not load blogPosts.json — will use topic-based fallback');
}

function getArticleContent(slug) {
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return null;
  const text = (post.content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return { title: post.title, text: text.substring(0, 3000) };
}

function getImageUrl(slug, service) {
  const post = blogPosts.find((p) => p.slug === slug);
  const heroPath = post?.heroImage || post?.image || null;
  if (heroPath) return `${SITE_URL}${heroPath}`;

  // DALL-E generated image (uploaded by publish-blog.js)
  const generatedPath = `/images/blog/${slug}.png`;
  if (post) return `${SITE_URL}${generatedPath}`;

  const serviceKey = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const pillarPath = PILLAR_IMAGES[serviceKey] || null;
  if (pillarPath) return `${SITE_URL}${pillarPath}`;

  return `${SITE_URL}/header_bg.png`;
}

// ─── Google Sheets ────────────────────────────────────────────────────────────
async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function getPendingRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A2:R',
  });
  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const publishDate = (row[1] || '').trim();
    const igStatus    = (row[15] || '').toLowerCase().trim();

    if (publishDate <= today && igStatus === 'pending') {
      return {
        rowIndex:    i + 2,
        id:          row[0] || '',
        publishDate,
        service:     row[2] || '',
        keyword:     row[3] || '',
        title:       row[4] || '',
        slug:        row[5] || '',
        url:         row[6] || '',
        author:      row[7] || 'Mark Higgins',
      };
    }
  }
  return null;
}

// ─── Generate Instagram caption via Claude ────────────────────────────────────
async function generateInstagramCaption(row) {
  const article = getArticleContent(row.slug);

  let prompt;

  if (article) {
    console.log(`  Read article content (${article.text.length} chars) — generating caption from real insights`);
    prompt = `You are writing an Instagram post for Boxx Commercial Finance's business page.

This caption must draw one clear, specific insight from the article below — not write independently about the same topic.

ARTICLE TITLE: ${article.title}
ARTICLE URL: ${row.url}

ARTICLE CONTENT:
${article.text}

---

Write an Instagram caption that:
- Opens with a strong single-line hook (max 15 words) drawn from a specific point in the article — this shows above the "more" fold
- Has 3–4 short punchy lines, each one a real takeaway from the article
- Feels authentic and human — no corporate speak
- Uses 4–5 emojis naturally placed
- Ends with a clear call to action: "Link in bio 👆" or similar
- Then a blank line separator
- Then 20–25 relevant hashtags on one line

Format exactly:
CAPTION:
[hook line]

[body lines]

[call to action]

HASHTAGS:
#hashtag1 #hashtag2 ... (all on one line)`;
  } else {
    console.log(`  Article not found for "${row.slug}" — using topic-based fallback`);
    prompt = `You are writing an Instagram post for Boxx Commercial Finance's business page.

Topic: "${row.title}"
Keyword: ${row.keyword}
Service area: ${row.service}
Blog URL: ${row.url}

Write an Instagram caption that:
- Opens with a strong single-line hook (bold statement or question, max 15 words) — shows above the "more" fold
- Has 3–4 short punchy lines (one idea each, easy to read on mobile)
- Mentions one specific benefit or insight about ${row.keyword} for UK business owners
- Feels authentic and human — no corporate speak
- Uses 4–5 emojis naturally placed
- Ends with a clear call to action: "Link in bio 👆" or similar
- Then a blank line separator
- Then 20–25 relevant hashtags on one line

Format exactly:
CAPTION:
[hook line]

[body lines]

[call to action]

HASHTAGS:
#hashtag1 #hashtag2 ... (all on one line)`;
  }

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const captionMatch = text.match(/CAPTION:\n([\s\S]*?)(?=HASHTAGS:|$)/);
  const hashtagMatch = text.match(/HASHTAGS:\n([\s\S]*?)$/);

  const captionBody = captionMatch ? captionMatch[1].trim() : text.trim();
  const hashtags    = hashtagMatch ? hashtagMatch[1].trim() : '';

  return hashtags ? `${captionBody}\n\n${hashtags}` : captionBody;
}

// ─── Post to Instagram via Graph API ─────────────────────────────────────────
async function postToInstagram(imageUrl, caption) {
  if (!IG_USER_ID || !FB_PAGE_TOKEN) {
    throw new Error('INSTAGRAM_USER_ID and FACEBOOK_PAGE_ACCESS_TOKEN must both be set');
  }

  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/${FB_API_VER}/${IG_USER_ID}/media`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${FB_PAGE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
      }),
    }
  );

  if (!containerRes.ok) {
    const err = await containerRes.text();
    throw new Error(`Instagram container creation failed: ${err}`);
  }

  const containerData = await containerRes.json();
  const containerId   = containerData.id;
  console.log(`  Container created: ${containerId}`);

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/${FB_API_VER}/${IG_USER_ID}/media_publish`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${FB_PAGE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Instagram publish failed: ${err}`);
  }

  const publishData = await publishRes.json();
  return publishData.id || '';
}

// ─── Update sheet row ─────────────────────────────────────────────────────────
async function updateRow(sheets, rowIndex, caption, postId, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range:         `LinkedIn_Queue!P${rowIndex}:R${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status, caption, postId || '']],
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Instagram Publisher     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Instagram posts weekdays only (Mon–Fri). Skip gracefully on weekends
  // unless FORCE_RUN=true is set.
  const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 6=Sat
  if ((dayOfWeek === 0 || dayOfWeek === 6) && process.env.FORCE_RUN !== 'true') {
    console.log('  Today is a weekend — Instagram publishing is weekdays only. Done.\n');
    return;
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending Instagram row...');
  const row = await getPendingRow(sheets);

  if (!row) {
    console.log('  No pending Instagram posts for today. Done.\n');
    return;
  }

  console.log(`  Found: "${row.title}" (${row.publishDate})`);

  const imageUrl = getImageUrl(row.slug, row.service);
  console.log(`  Image: ${imageUrl}`);

  console.log('\nGenerating Instagram caption via Claude...');
  const caption = await generateInstagramCaption(row);
  console.log(`  Caption: ${caption.slice(0, 80)}...`);

  console.log('\nPosting to Instagram...');
  let postId = '';
  let status = 'posted';

  try {
    postId = await postToInstagram(imageUrl, caption);
    console.log(`  ✅ Posted successfully — ID: ${postId}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    status = 'failed';
  }

  console.log('\nUpdating LinkedIn_Queue sheet...');
  await updateRow(sheets, row.rowIndex, caption, postId, status);
  console.log(`  Row ${row.rowIndex} updated — status: ${status}`);

  console.log('\n✅ Done.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
