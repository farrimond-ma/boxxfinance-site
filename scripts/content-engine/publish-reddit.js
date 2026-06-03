require('dotenv').config();
const { google } = require('googleapis');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID       = process.env.SPREADSHEET_ID;
const REDDIT_CLIENT_ID     = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME      = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD      = process.env.REDDIT_PASSWORD;
const REDDIT_USER_AGENT    = `script:boxx-finance-publisher:v1.0 (by /u/${REDDIT_USERNAME})`;

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

// Read pending drafts from Reddit_Drafts sheet
// Columns: A=date, B=subreddit, C=title, D=postUrl, E=keyword, F=draftResponse, G=status
async function getPendingDraft(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reddit_Drafts!A2:G',
  });

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const status = (row[6] || '').toLowerCase().trim();

    if (status === 'pending') {
      return {
        rowIndex:  i + 2,
        date:      row[0] || '',
        subreddit: row[1] || '',
        title:     row[2] || '',
        postUrl:   row[3] || '',
        keyword:   row[4] || '',
        draft:     row[5] || '',
      };
    }
  }
  return null;
}

async function updateDraftStatus(sheets, rowIndex, status, commentUrl) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Reddit_Drafts!G${rowIndex}:H${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status, commentUrl || '']] },
  });
}

// ─── Reddit OAuth ─────────────────────────────────────────────────────────────
async function getRedditToken() {
  const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'User-Agent':   REDDIT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=password&username=${encodeURIComponent(REDDIT_USERNAME)}&password=${encodeURIComponent(REDDIT_PASSWORD)}`,
  });

  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in Reddit response: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Extract Reddit post ID from a permalink URL
// e.g. https://www.reddit.com/r/UKPersonalFinance/comments/abc123/title/ → t3_abc123
function getPostFullname(postUrl) {
  const match = postUrl.match(/\/comments\/([a-z0-9]+)\//i);
  if (!match) throw new Error(`Cannot extract post ID from URL: ${postUrl}`);
  return `t3_${match[1]}`;
}

// Post a comment on a Reddit thread
async function postComment(token, parentFullname, text) {
  const res = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      Authorization:  `bearer ${token}`,
      'User-Agent':   REDDIT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      api_type: 'json',
      parent:   parentFullname,
      text,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Reddit comment failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  // Reddit returns errors in the JSON body even on 200
  const errors = data?.json?.errors;
  if (errors && errors.length > 0) {
    throw new Error(`Reddit API error: ${JSON.stringify(errors)}`);
  }

  // Extract the posted comment's permalink
  const commentData = data?.json?.data?.things?.[0]?.data;
  const commentId   = commentData?.id;
  const permalink   = commentData?.permalink;
  return permalink ? `https://www.reddit.com${permalink}` : commentId || '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Reddit Publisher        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    console.error('Missing Reddit credentials. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD.');
    process.exit(1);
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending Reddit draft...');
  const draft = await getPendingDraft(sheets);

  if (!draft) {
    console.log('  No pending drafts. Done.\n');
    return;
  }

  console.log(`  Found: "${draft.title.slice(0, 70)}"`);
  console.log(`  Subreddit: ${draft.subreddit}`);
  console.log(`  Post URL: ${draft.postUrl}`);
  console.log(`  Draft: ${draft.draft.slice(0, 100)}...`);

  console.log('\nAuthenticating with Reddit...');
  const token = await getRedditToken();
  console.log('  ✅ Authenticated');

  let status     = 'posted';
  let commentUrl = '';

  try {
    const parentFullname = getPostFullname(draft.postUrl);
    console.log(`\nPosting comment to ${parentFullname}...`);
    commentUrl = await postComment(token, parentFullname, draft.draft);
    console.log(`  ✅ Comment posted: ${commentUrl}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    status = 'failed';
  }

  console.log('\nUpdating Reddit_Drafts sheet...');
  await updateDraftStatus(sheets, draft.rowIndex, status, commentUrl);
  console.log(`  Row ${draft.rowIndex} updated — status: ${status}`);

  console.log('\n✅ Done.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
