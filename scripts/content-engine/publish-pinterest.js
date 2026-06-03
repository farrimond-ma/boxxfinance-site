require('dotenv').config();
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID      = process.env.SPREADSHEET_ID;
const PINTEREST_TOKEN     = process.env.PINTEREST_ACCESS_TOKEN;
const PINTEREST_API       = 'https://api.pinterest.com/v5';
const SITE_URL            = 'https://boxxfinance.co.uk';

// ─── Column mapping for LinkedIn_Queue (0-indexed) ────────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author
// I=8 liStatus, J=9 liPostText, K=10 liFirstComment, L=11 notes
// M=12 fbStatus, N=13 fbPostText, O=14 fbPostId
// P=15 igStatus, Q=16 igPostText, R=17 igPostId
// S=18 pinterestStatus, T=19 pinterestDescription, U=20 pinterestPinId

// ─── Service → Pinterest board ID ────────────────────────────────────────────
// Set PINTEREST_BOARD_ID_<SERVICE_SLUG> secrets for per-service boards,
// or fall back to PINTEREST_BOARD_ID for a single general board.
function getBoardId(service) {
  const key = service.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and');
  return process.env[`PINTEREST_BOARD_ID_${key.toUpperCase()}`]
      || process.env.PINTEREST_BOARD_ID;
}

// ─── Service → pillar image (fallback if blog image not available) ────────────
const PILLAR_IMAGES = {
  'bridging-finance':    '/images/blog/bridging-finance-1.webp',
  'development-finance': '/images/blog/development-finance-1.webp',
  'commercial-mortgage': '/images/blog/commercial-mortgage-1.webp',
  'invoice-finance':     '/images/blog/invoice-finance-1.webp',
  'asset-finance':       '/images/blog/asset-finance-1.webp',
  'working-capital':     '/images/blog/working-capital-1.webp',
  'trade-finance':       '/images/blog/trade-finance-1.webp',
  'cashflow-finance':    '/images/blog/cashflow-finance-1.webp',
  'business-loans':      '/images/blog/business-loans-1.webp',
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
  console.warn('  Could not load blogPosts.json');
}

function getImageUrl(slug, service) {
  const post = blogPosts.find(p => p.slug === slug);
  if (post?.heroImage) return `${SITE_URL}${post.heroImage}`;
  if (post?.image)     return `${SITE_URL}${post.image}`;
  // DALL-E / Pexels image uploaded to repo
  if (post) return `${SITE_URL}/images/blog/${slug}.jpg`;
  const serviceKey = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return `${SITE_URL}${PILLAR_IMAGES[serviceKey] || '/header_bg.png'}`;
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
    range: 'LinkedIn_Queue!A2:U',
  });

  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row             = rows[i];
    const publishDate     = (row[1] || '').trim();
    const pinterestStatus = (row[18] || '').toLowerCase().trim();

    if (publishDate <= today && pinterestStatus === 'pending') {
      return {
        rowIndex:  i + 2,
        publishDate,
        service:   row[2] || '',
        keyword:   row[3] || '',
        title:     row[4] || '',
        slug:      row[5] || '',
        url:       row[6] || '',
        author:    row[7] || 'Mark Higgins',
      };
    }
  }
  return null;
}

// ─── Generate Pinterest description ──────────────────────────────────────────
function getArticleContent(slug) {
  const post = blogPosts.find(p => p.slug === slug);
  if (!post) return null;
  const text = (post.content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title: post.title, text: text.substring(0, 2000) };
}

async function generatePinterestDescription(row) {
  const article = getArticleContent(row.slug);

  const prompt = article
    ? `Write a Pinterest pin description for a Boxx Commercial Finance article.

ARTICLE TITLE: ${article.title}
ARTICLE URL: ${row.url}
ARTICLE CONTENT:
${article.text}

Write a Pinterest description that:
- Is 150–300 characters (Pinterest sweet spot)
- Opens with a strong hook drawn from a real insight in the article
- Feels useful and informative, not salesy
- Ends with 3–5 relevant hashtags (e.g. #BridgingFinance #UKBusiness)
- Naturally encourages saving and clicking

Return ONLY the description text with hashtags. Nothing else.`
    : `Write a Pinterest pin description for a Boxx Commercial Finance article about "${row.keyword}".
- 150–300 characters
- Useful, informative hook
- Ends with 3–5 relevant hashtags
- Encourages saving and clicking
Return ONLY the description text. Nothing else.`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages:   [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : row.title;
}

// ─── Post pin to Pinterest ────────────────────────────────────────────────────
async function postToPinterest(row, description, imageUrl, boardId) {
  if (!PINTEREST_TOKEN) throw new Error('PINTEREST_ACCESS_TOKEN not set');
  if (!boardId)        throw new Error('No Pinterest board ID found — set PINTEREST_BOARD_ID secret');

  const body = {
    board_id:     boardId,
    title:        row.title.slice(0, 100),
    description,
    link:         row.url,
    media_source: {
      source_type: 'image_url',
      url:         imageUrl,
    },
  };

  const res = await fetch(`${PINTEREST_API}/pins`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${PINTEREST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinterest API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.id || '';
}

// ─── Update sheet row ─────────────────────────────────────────────────────────
async function updateRow(sheets, rowIndex, description, pinId, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range:         `LinkedIn_Queue!S${rowIndex}:U${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status, description, pinId || '']] },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Pinterest Publisher     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Weekdays only unless FORCE_RUN=true
  const dayOfWeek = new Date().getUTCDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && process.env.FORCE_RUN !== 'true') {
    console.log('  Today is a weekend — Pinterest publishing is weekdays only. Done.\n');
    return;
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending Pinterest row...');
  const row = await getPendingRow(sheets);

  if (!row) {
    console.log('  No pending Pinterest posts for today. Done.\n');
    return;
  }

  console.log(`  Found: "${row.title}" (${row.publishDate})`);

  const imageUrl = getImageUrl(row.slug, row.service);
  console.log(`  Image: ${imageUrl}`);

  const boardId = getBoardId(row.service);
  console.log(`  Board: ${boardId || '(not set)'}`);

  console.log('\nGenerating Pinterest description via Claude...');
  const description = await generatePinterestDescription(row);
  console.log(`  Description: ${description.slice(0, 80)}...`);

  console.log('\nPosting pin to Pinterest...');
  let pinId  = '';
  let status = 'posted';

  try {
    pinId = await postToPinterest(row, description, imageUrl, boardId);
    console.log(`  ✅ Pin created — ID: ${pinId}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    status = 'failed';
  }

  console.log('\nUpdating LinkedIn_Queue sheet...');
  await updateRow(sheets, row.rowIndex, description, pinId, status);
  console.log(`  Row ${row.rowIndex} updated — status: ${status}`);

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
