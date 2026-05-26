require('dotenv').config();
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Column mapping for LinkedIn_Queue (0-indexed) ───────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author, I=8 liStatus, J=9 liPostText
// K=10 liFirstComment, L=11 notes

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
        author: row[7] || 'Mark Higgins',
        liStatus,
      };
    }
  }
  return null;
}

// ─── Generate LinkedIn post via Claude ───────────────────────────────────────

async function generateLinkedInPost(row) {
  const prompt = `You are writing a LinkedIn post for ${row.author} at Boxx Commercial Finance.

Topic: "${row.title}"
Keyword: ${row.keyword}
Pillar: ${row.service}
Blog URL: ${row.url}

Write a LinkedIn post that:
- Opens with a strong hook (no "I" as the first word)
- Is 150-200 words
- Shares a genuine insight or observation about ${row.keyword}
- Feels personal and professional, not salesy
- Ends with a subtle call to action followed by 3-5 relevant hashtags on the last line
- Uses 3-4 relevant emojis sparingly within the post body

IMPORTANT: The hashtags MUST appear at the end of the POST section, not in the FIRST_COMMENT.

Then write "FIRST_COMMENT:" followed by ONE sentence only:
- Invite readers to read the full article and include the blog URL: ${row.url}
- Do NOT include any hashtags in the first comment

Format exactly like this:
POST:
[the post text ending with hashtags on the last line]

FIRST_COMMENT:
[one sentence with the URL — no hashtags]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
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
