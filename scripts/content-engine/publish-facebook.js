require('dotenv').config();
const path = require('path');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const SITE_URL = 'https://boxxfinance.co.uk';
const FB_API_VER = 'v21.0';

// ─── Column mapping for LinkedIn_Queue (0-indexed) ────────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author, I=8 liStatus, J=9 liPostText
// K=10 liFirstComment, L=11 notes, M=12 fbStatus, N=13 fbPostText, O=14 fbPostId

// ─── Service → pillar image map ───────────────────────────────────────────────
// Paths under /images/blog/ — add these files to public/images/blog/ when ready
const PILLAR_IMAGES = {
  'bridging-finance':   '/images/blog/bridging-finance-1.webp',
  'development-finance': '/images/blog/development-finance-1.webp',
  'commercial-mortgage': '/images/blog/commercial-mortgage-1.webp',
  'invoice-finance':    '/images/blog/invoice-finance-1.webp',
  'asset-finance':      '/images/blog/asset-finance-1.webp',
  'working-capital':    '/images/blog/working-capital-1.webp',
  'trade-finance':      '/images/blog/trade-finance-1.webp',
  'property-finance':   '/images/blog/property-finance-1.webp',
  'business-loans':     '/images/blog/business-loans-1.webp',
  'cashflow-finance':   '/images/blog/cashflow-finance-1.webp',
  'mezzanine-finance':  '/images/blog/mezzanine-finance-1.webp',
  'structured-finance': '/images/blog/structured-finance-1.webp',
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

function getImageUrl(slug, service) {
  // 1. Post's own hero image (highest priority)
  const post = blogPosts.find((p) => p.slug === slug);
  const heroPath = post?.heroImage || post?.image || null;
  if (heroPath) return `${SITE_URL}${heroPath}`;

  // 2. Service-based pillar image
  const serviceKey = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const pillarPath = PILLAR_IMAGES[serviceKey] || null;
  if (pillarPath) return `${SITE_URL}${pillarPath}`;

  // 3. Branded fallback — always exists
  return `${SITE_URL}/header_bg.png`;
}

// Extract plain text from a blog post's HTML content for use in prompts
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

// ─── Google Sheets ────────────────────────────────────────────────────────────
async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
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
    range: 'LinkedIn_Queue!A2:O',
  });
  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const publishDate = (row[1] || '').trim();
    const fbStatus = (row[12] || '').toLowerCase().trim();

    if (publishDate <= today && fbStatus === 'pending') {
      return {
        rowIndex: i + 2,
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

// ─── Generate Facebook post via Claude ───────────────────────────────────────
async function generateFacebookPost(row) {
  const article = getArticleContent(row.slug);

  let prompt;

  if (article) {
    console.log(`  Read article content (${article.text.length} chars) — generating post from real insights`);
    prompt = `You are writing a Facebook post for Boxx Commercial Finance's business page.

This post must draw specific points from the article below — not write independently about the same topic. Pick one clear, practical insight that will resonate with a UK business owner.

ARTICLE TITLE: ${article.title}
ARTICLE URL: ${row.url}

ARTICLE CONTENT:
${article.text}

---

Write a Facebook post that:
- Opens with a question or bold statement drawn from a real point in the article
- Is 80–120 words — punchy and easy to skim on mobile
- Makes one practical insight from the article feel useful to a UK business owner
- Feels warm and human — not corporate or salesy
- Includes 2–3 relevant emojis woven naturally into the text
- Ends with a call to action to read the full article

Then include the URL on its own line, followed by 3 relevant hashtags on the final line.

Format exactly:
POST:
[the post text]

${row.url}
#hashtag1 #hashtag2 #hashtag3`;
  } else {
    console.log(`  Article not found for "${row.slug}" — using topic-based fallback`);
    prompt = `You are writing a Facebook post for Boxx Commercial Finance's business page.

Topic: "${row.title}"
Keyword: ${row.keyword}
Service area: ${row.service}
Blog URL: ${row.url}

Write a Facebook post that:
- Opens with a question or bold statement that immediately grabs attention
- Is 80–120 words — punchy and easy to skim on mobile
- Explains the topic in plain English, avoiding financial jargon
- Feels warm, helpful, and approachable — not corporate or salesy
- Includes 2–3 relevant emojis woven naturally into the text
- Ends with a clear call to action to read the full article

Then include the URL on its own line, followed by 3 relevant hashtags on the final line.

Format exactly:
POST:
[the post text]

${row.url}
#hashtag1 #hashtag2 #hashtag3`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const postMatch = text.match(/POST:\n([\s\S]*?)$/);
  return postMatch ? postMatch[1].trim() : text.trim();
}

// ─── Post photo to Facebook page ──────────────────────────────────────────────
async function postToFacebook(imageUrl, postText) {
  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
    throw new Error('FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be set');
  }

  const endpoint = `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}/photos`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FB_PAGE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url:       imageUrl,
      message:   postText,
      published: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook API error: ${err}`);
  }

  const data = await res.json();
  // Response shape: { id: "photo_id", post_id: "page_post_id" }
  return data.post_id || data.id || '';
}

// ─── Update sheet row ─────────────────────────────────────────────────────────
async function updateRow(sheets, rowIndex, postText, postId, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `LinkedIn_Queue!M${rowIndex}:O${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status, postText, postId || '']],
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Facebook Publisher      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Facebook posts weekdays only (Mon–Fri). Skip gracefully on weekends
  // unless FORCE_RUN=true is set.
  const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 6=Sat
  if ((dayOfWeek === 0 || dayOfWeek === 6) && process.env.FORCE_RUN !== 'true') {
    console.log('  Today is a weekend — Facebook publishing is weekdays only. Done.\n');
    return;
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending Facebook row...');
  const row = await getPendingRow(sheets);

  if (!row) {
    console.log('  No pending Facebook posts for today. Done.\n');
    return;
  }

  console.log(`  Found: "${row.title}" (${row.publishDate})`);

  const imageUrl = getImageUrl(row.slug, row.service);
  console.log(`  Image: ${imageUrl}`);

  console.log('\nGenerating Facebook post via Claude...');
  const postText = await generateFacebookPost(row);
  console.log(`  Post: ${postText.slice(0, 100)}...`);

  console.log('\nPosting to Facebook page...');
  let postId = '';
  let status = 'posted';

  try {
    postId = await postToFacebook(imageUrl, postText);
    console.log(`  ✅ Posted successfully — ID: ${postId}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    status = 'failed';
  }

  console.log('\nUpdating LinkedIn_Queue sheet...');
  await updateRow(sheets, row.rowIndex, postText, postId, status);
  console.log(`  Row ${row.rowIndex} updated — status: ${status}`);

  console.log('\n✅ Done.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
