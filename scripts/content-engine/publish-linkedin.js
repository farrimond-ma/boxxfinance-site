require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Column mapping for LinkedIn_Queue (0-indexed) ───────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author, I=8 liStatus, J=9 liPostText
// K=10 liFirstComment, L=11 notes

// ─── Service → author mapping ─────────────────────────────────────────────────
// Mark covers property/property-backed finance; Andrew covers cashflow/asset finance
const SERVICE_AUTHORS = {
  'bridging-finance':    'Mark Higgins',
  'development-finance': 'Mark Higgins',
  'commercial-mortgage': 'Mark Higgins',
  'commercial-mortgages':'Mark Higgins',
  'property-finance':    'Mark Higgins',
  'structured-finance':  'Mark Higgins',
  'mezzanine-finance':   'Mark Higgins',
  'invoice-finance':     'Andrew Farrimond',
  'asset-finance':       'Andrew Farrimond',
  'working-capital':     'Andrew Farrimond',
  'trade-finance':       'Andrew Farrimond',
  'cashflow-finance':    'Andrew Farrimond',
  'business-loans':      'Andrew Farrimond',
};

function resolveAuthor(sheetAuthor, service) {
  const key = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return SERVICE_AUTHORS[key] || sheetAuthor || 'Mark Higgins';
}

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      // Try base64 decode first (GitHub Actions)
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
      // Fall back to raw JSON (local .env)
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Get today's pending LinkedIn row ────────────────────────────────────────

async function getPendingRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A2:L',
  });
  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const publishDate = (row[1] || '').trim();
    const liStatus = (row[8] || '').toLowerCase().trim();

    if (publishDate <= today && liStatus === 'pending') {
      return {
        rowIndex: i + 2,
        id: row[0] || '',
        publishDate,
        service: row[2] || '',
        keyword: row[3] || '',
        title: row[4] || '',
        slug: row[5] || '',
        url: row[6] || '',
        author: resolveAuthor(row[7], row[2]),
        liStatus,
      };
    }
  }
  return null;
}

// ─── Read article content from checked-out blogPosts.json ────────────────────

function getArticleContent(slug) {
  try {
    const filePath = path.resolve(__dirname, '../../src/data/blogPosts.json');
    const posts    = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const post     = posts.find(p => p.slug === slug);
    if (!post) return null;

    // Strip HTML tags to give Claude clean prose to work from
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

    return { title: post.title, text: text.substring(0, 4000) };
  } catch (err) {
    console.warn(`  Could not read article content for "${slug}": ${err.message}`);
    return null;
  }
}

// ─── Generate LinkedIn post via Claude ───────────────────────────────────────

async function generateLinkedInPost(row) {
  const article = getArticleContent(row.slug);

  let prompt;

  if (article) {
    console.log(`  Read article content (${article.text.length} chars) — generating post from real insights`);
    prompt = `You are writing a LinkedIn post for ${row.author} at Boxx Commercial Finance.

This post must be a genuine distillation of the published article below — not an independently written piece about the same topic. Pull specific insights, observations or practical points directly from the article. A reader who has read the article should recognise what you're referencing.

ARTICLE TITLE: ${article.title}
ARTICLE URL: ${row.url}
AUTHOR: ${row.author}, ${row.service} specialist at Boxx Commercial Finance

ARTICLE CONTENT:
${article.text}

---

Write a LinkedIn post that:
- Opens with a strong hook drawn from a specific insight, fact or observation in the article — not a generic statement about the topic (no "I" as the first word)
- Is 150–200 words
- Shares 2–3 concrete points that come directly from the article — written as if ${row.author} is passing on something genuinely useful from experience
- Reads like a senior commercial finance professional, not a content marketer — direct, confident, no fluff, no hype
- No emojis
- Ends with a subtle, natural call to action followed by 3–5 relevant hashtags on the last line

IMPORTANT: Hashtags must appear at the end of the POST section only, not in the FIRST_COMMENT.

Then write "FIRST_COMMENT:" followed by ONE sentence:
- Invite the reader to read the full article and include this URL: ${row.url}
- No hashtags in the first comment

Format exactly:
POST:
[post text, ending with hashtags on final line]

FIRST_COMMENT:
[one sentence with URL — no hashtags]`;
  } else {
    console.log(`  Article content not found for "${row.slug}" — using topic-based fallback`);
    prompt = `You are writing a LinkedIn post for ${row.author} at Boxx Commercial Finance.

Topic: "${row.title}"
Service: ${row.service}
Blog URL: ${row.url}

Write a LinkedIn post that:
- Opens with a strong hook (no "I" as the first word)
- Is 150–200 words
- Shares a genuine insight or practical observation about ${row.keyword} from the perspective of someone who brokers these deals every day
- Direct, confident, no fluff. No emojis.
- Ends with a subtle call to action followed by 3–5 relevant hashtags on the last line

IMPORTANT: Hashtags at the end of POST only, not in FIRST_COMMENT.

Then write "FIRST_COMMENT:" — one sentence inviting readers to read the full article at ${row.url}. No hashtags.

Format exactly:
POST:
[post text, ending with hashtags]

FIRST_COMMENT:
[one sentence with URL]`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const postMatch = text.match(/POST:\n([\s\S]*?)(?=FIRST_COMMENT:|$)/);
  const commentMatch = text.match(/FIRST_COMMENT:\n([\s\S]*?)$/);

  return {
    postText: postMatch ? postMatch[1].trim() : text.trim(),
    firstComment: commentMatch ? commentMatch[1].trim() : `Read the full article here: ${row.url}`,
  };
}

// ─── Post to LinkedIn ─────────────────────────────────────────────────────────

async function postToLinkedIn(row, postText, firstComment) {
  // Select the correct token based on author
  const isAndrew = row.author.toLowerCase().includes('andrew');
  const accessToken = isAndrew
    ? process.env.LINKEDIN_ACCESS_TOKEN_ANDREW
    : process.env.LINKEDIN_ACCESS_TOKEN_MARK;

  if (!accessToken) {
    throw new Error(`Missing LinkedIn token for ${row.author}. Set LINKEDIN_ACCESS_TOKEN_${isAndrew ? 'ANDREW' : 'MARK'}`);
  }

  // Get the author's LinkedIn person URN
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    const err = await profileRes.text();
    throw new Error(`Failed to get LinkedIn profile for ${row.author}: ${err}`);
  }
  const profile = await profileRes.json();
  const personUrn = `urn:li:person:${profile.sub}`;

  // Create the post
  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`Failed to create LinkedIn post: ${err}`);
  }

  const postData = await postRes.json();
  const postId = postData.id;
  console.log(`  Post created: ${postId}`);

  // Add first comment with the blog URL
  if (firstComment && postId) {
    // Extract numeric ID from URN for comment endpoint
    const urnEncoded = encodeURIComponent(postId);
    const commentRes = await fetch(`https://api.linkedin.com/v2/socialActions/${urnEncoded}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        actor: personUrn,
        message: { text: firstComment },
      }),
    });
    if (!commentRes.ok) {
      console.warn(`  Warning: post created but first comment failed: ${await commentRes.text()}`);
    } else {
      console.log(`  First comment added`);
    }
  }

  // Reshare to company page (non-fatal — warns if it fails)
  await reshareToCompanyPage(postId, accessToken);

  return postId;
}

// ─── Reshare to company page ──────────────────────────────────────────────────

async function reshareToCompanyPage(postId, fallbackToken) {
  const orgId = process.env.LINKEDIN_ORG_ID;
  if (!orgId) {
    console.log('  ℹ  Skipping company page reshare: LINKEDIN_ORG_ID not set');
    return;
  }

  // Use a dedicated org token if provided, otherwise fall back to the
  // author's personal token (works when the author is a page admin)
  const orgToken = process.env.LINKEDIN_ORG_ACCESS_TOKEN || fallbackToken;
  const orgUrn = `urn:li:organization:${orgId}`;

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orgToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: '' },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      resharedShare: postId,
    }),
  });

  if (!res.ok) {
    console.warn(`  ⚠  Company page reshare failed: ${await res.text()}`);
  } else {
    const data = await res.json();
    console.log(`  Company page reshare: ${data.id}`);
  }
}

// ─── Update sheet row ─────────────────────────────────────────────────────────

async function updateRow(sheets, rowIndex, postText, firstComment, postId, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `LinkedIn_Queue!I${rowIndex}:L${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status, postText, firstComment, postId || '']],
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — LinkedIn Publisher      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // LinkedIn posts weekdays only (Mon–Fri). Skip gracefully on weekends
  // unless FORCE_RUN=true is set (useful for manual testing).
  const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 6=Sat
  if ((dayOfWeek === 0 || dayOfWeek === 6) && process.env.FORCE_RUN !== 'true') {
    console.log('  Today is a weekend — LinkedIn publishing is weekdays only. Done.\n');
    return;
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending LinkedIn row...');
  const row = await getPendingRow(sheets);

  if (!row) {
    console.log('  No pending LinkedIn posts for today. Done.\n');
    return;
  }

  console.log(`  Found: "${row.title}" by ${row.author} (${row.publishDate})`)

  // Generate post content
  console.log('\nGenerating LinkedIn post via Claude...');
  const { postText, firstComment } = await generateLinkedInPost(row);
  console.log(`  Post: ${postText.slice(0, 80)}...`);
  console.log(`  Comment: ${firstComment.slice(0, 80)}...`);

  // Post to LinkedIn
  console.log(`\nPosting to LinkedIn as ${row.author}...`);
  let postId = '';
  let status = 'posted';

  try {
    postId = await postToLinkedIn(row, postText, firstComment);
    console.log(`  ✅ Posted successfully`);
  } catch (err) {
    console.error(`  ❌ Failed to post: ${err.message}`);
    status = 'failed';
  }

  // Update sheet
  console.log('\nUpdating LinkedIn_Queue sheet...');
  await updateRow(sheets, row.rowIndex, postText, firstComment, postId, status);
  console.log(`  Row ${row.rowIndex} updated — status: ${status}`);

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
