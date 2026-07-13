require('dotenv').config();
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const REDDIT_CLIENT_ID     = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME      = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD      = process.env.REDDIT_PASSWORD;
const REDDIT_USER_AGENT    = `script:boxx-finance-monitor:v1.0 (by /u/${REDDIT_USERNAME})`;
const SITE_URL             = 'https://boxxfinance.co.uk';

// Subreddits to monitor (UK business / finance focused)
const SUBREDDITS = [
  'UKPersonalFinance',
  'ukbusiness',
  'smallbusiness',
  'entrepreneur',
  'PropertyInvestmentUK',
  'AskUK',
];

// Service keywords + which Boxx page is most relevant
const KEYWORD_MAP = [
  { keyword: 'bridging finance',       url: `${SITE_URL}/funding-solutions/bridging-loans`,    author: 'Mark Higgins' },
  { keyword: 'bridging loan',          url: `${SITE_URL}/funding-solutions/bridging-loans`,    author: 'Mark Higgins' },
  { keyword: 'commercial mortgage',    url: `${SITE_URL}/funding-solutions/commercial-mortgages`, author: 'Mark Higgins' },
  { keyword: 'development finance',    url: `${SITE_URL}/funding-solutions/development-finance`, author: 'Mark Higgins' },
  { keyword: 'invoice finance',        url: `${SITE_URL}/funding-solutions/invoice-finance`,     author: 'Andrew Farrimond' },
  { keyword: 'invoice factoring',      url: `${SITE_URL}/funding-solutions/invoice-finance`,     author: 'Andrew Farrimond' },
  { keyword: 'asset finance',          url: `${SITE_URL}/funding-solutions/asset-finance`,       author: 'Andrew Farrimond' },
  { keyword: 'working capital',        url: `${SITE_URL}/funding-solutions/working-capital`,     author: 'Andrew Farrimond' },
  { keyword: 'business loan uk',       url: `${SITE_URL}/funding-solutions`,                     author: 'Mark Higgins' },
  { keyword: 'commercial property loan', url: `${SITE_URL}/funding-solutions/commercial-mortgages`, author: 'Mark Higgins' },
  { keyword: 'property development loan', url: `${SITE_URL}/funding-solutions/development-finance`, author: 'Mark Higgins' },
];

// ─── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Reddit OAuth ─────────────────────────────────────────────────────────────
async function getRedditToken() {
  const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'User-Agent':  REDDIT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=password&username=${encodeURIComponent(REDDIT_USERNAME)}&password=${encodeURIComponent(REDDIT_PASSWORD)}`,
  });

  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ─── Search Reddit ────────────────────────────────────────────────────────────
async function searchReddit(token, subreddit, keyword) {
  const q   = encodeURIComponent(keyword);
  const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${q}&sort=new&t=week&limit=10&restrict_sr=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `bearer ${token}`,
      'User-Agent':  REDDIT_USER_AGENT,
    },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.children || []).map((c) => c.data);
}

// ─── Score relevance ─────────────────────────────────────────────────────────
function isRelevant(post, keyword) {
  const title = (post.title || '').toLowerCase();
  const body  = (post.selftext || '').toLowerCase();
  const kw    = keyword.toLowerCase();

  // Must mention the keyword
  if (!title.includes(kw) && !body.includes(kw)) return false;

  // Should look like a question or request for advice
  const questionSignals = ['?', 'how', 'what', 'should', 'can i', 'help', 'advice', 'recommend', 'looking for', 'anyone', 'need'];
  const isQuestion = questionSignals.some((s) => title.includes(s) || (post.selftext || '').toLowerCase().includes(s));
  if (!isQuestion) return false;

  // Skip removed / deleted posts
  if (post.removed_by_category || post.selftext === '[deleted]' || post.selftext === '[removed]') return false;

  // Skip very low engagement (likely spam) or very high (too old / already answered)
  if (post.score < 0) return false;

  return true;
}

// ─── Generate draft response ──────────────────────────────────────────────────
async function generateDraftResponse(post, matchedKeyword) {
  const { keyword, url, author } = matchedKeyword;
  const authorFirstName = author.split(' ')[0];

  const prompt = `You are ${author} at Boxx Commercial Finance, a UK commercial finance broker.

Someone on Reddit (r/${post.subreddit_name_prefixed || 'Reddit'}) posted this:

Title: "${post.title}"
Body: "${(post.selftext || '').slice(0, 600)}"

Write a genuinely helpful Reddit reply that:
- Directly answers their question or addresses their situation
- Is 80–150 words — conversational, not corporate
- Shares real practical knowledge about ${keyword} in a UK context
- Does NOT sound like an advert
- Mentions Boxx Commercial Finance naturally at most once, only if it's genuinely relevant to their question
- If you do mention Boxx, include this URL naturally: ${url}
- Signs off as ${authorFirstName}
- Follows Reddit etiquette — add value first, any mention of your firm is secondary

Return ONLY the reply text, no preamble.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
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

// Get already-seen post IDs to avoid duplicates
async function getSeenIds(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reddit_Drafts!D2:D',
    });
    return new Set((res.data.values || []).map((r) => r[0]).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function writeToSheet(sheets, rows) {
  if (rows.length === 0) return;

  // Ensure header row exists
  try {
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reddit_Drafts!A1:G1',
    });
    if (!check.data.values || check.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reddit_Drafts!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Date Found', 'Subreddit', 'Post Title', 'Post URL', 'Keyword', 'Draft Response', 'Status']],
        },
      });
    }
  } catch {
    // Sheet may not exist yet — user needs to create it
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reddit_Drafts!A:G',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Reddit Monitor          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    console.error('Missing Reddit credentials. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD.');
    process.exit(1);
  }

  console.log('Authenticating with Reddit...');
  const token = await getRedditToken();
  console.log('  ✅ Authenticated');

  const sheets = await getSheetsClient();
  const seenIds = await getSeenIds(sheets);
  console.log(`  ${seenIds.size} previously seen posts in sheet`);

  const newRows = [];
  const today = new Date().toISOString().split('T')[0];

  for (const subreddit of SUBREDDITS) {
    for (const kwEntry of KEYWORD_MAP) {
      console.log(`\nSearching r/${subreddit} for "${kwEntry.keyword}"...`);

      let posts;
      try {
        posts = await searchReddit(token, subreddit, kwEntry.keyword);
        // Rate limit — be a good API citizen
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.warn(`  Search failed: ${err.message}`);
        continue;
      }

      const relevant = posts.filter(
        (p) => isRelevant(p, kwEntry.keyword) && !seenIds.has(p.id)
      );

      console.log(`  Found ${posts.length} posts, ${relevant.length} relevant and new`);

      for (const post of relevant.slice(0, 2)) {
        // Generate draft response
        console.log(`  Drafting response for: "${post.title.slice(0, 60)}..."`);
        try {
          const draft = await generateDraftResponse(post, kwEntry);
          const postUrl = `https://www.reddit.com${post.permalink}`;

          newRows.push([
            today,
            `r/${post.subreddit}`,
            post.title.slice(0, 200),
            postUrl,
            kwEntry.keyword,
            draft,
            'pending',
          ]);
          seenIds.add(post.id);
          await new Promise((r) => setTimeout(r, 800)); // Claude rate limit
        } catch (err) {
          console.warn(`  Draft generation failed: ${err.message}`);
        }
      }
    }
  }

  if (newRows.length > 0) {
    console.log(`\nWriting ${newRows.length} drafts to Reddit_Drafts sheet...`);
    await writeToSheet(sheets, newRows);
    console.log('  ✅ Done');
  } else {
    console.log('\nNo new relevant posts found this run.');
  }

  console.log(`\n✅ Monitor complete. ${newRows.length} new opportunities queued.\n`);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
