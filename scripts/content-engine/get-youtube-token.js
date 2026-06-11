/**
 * Boxx Finance — One-time YouTube OAuth setup
 *
 * Gets the refresh token the Reels publisher needs to upload YouTube Shorts.
 * Run this ONCE on your own machine, signed in as the Google account that
 * owns the Boxx YouTube channel.
 *
 * Prerequisites (Google Cloud Console — console.cloud.google.com):
 *   1. Create/select a project → APIs & Services → enable "YouTube Data API v3"
 *   2. OAuth consent screen → External → add yourself as a test user
 *   3. Credentials → Create credentials → OAuth client ID → type "Web application"
 *      → add authorised redirect URI: http://127.0.0.1:8765
 *   4. Copy the Client ID and Client Secret
 *
 * Run:
 *   node get-youtube-token.js <CLIENT_ID> <CLIENT_SECRET>
 *
 * Then add three GitHub Secrets (repo → Settings → Secrets → Actions):
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 */

const http = require('http');

const CLIENT_ID     = process.argv[2] || process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.argv[3] || process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://127.0.0.1:8765';
const SCOPE         = 'https://www.googleapis.com/auth/youtube.upload';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Usage: node get-youtube-token.js <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  '&response_type=code' +
  `&scope=${encodeURIComponent(SCOPE)}` +
  '&access_type=offline' +
  '&prompt=consent';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('No code in callback.');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();

    if (data.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>Done — you can close this tab.</h2><p>The refresh token is in your terminal.</p>');
      console.log('\n✅ SUCCESS — add these three GitHub Secrets:\n');
      console.log('YOUTUBE_CLIENT_ID     =', CLIENT_ID);
      console.log('YOUTUBE_CLIENT_SECRET =', CLIENT_SECRET);
      console.log('YOUTUBE_REFRESH_TOKEN =', data.refresh_token);
      console.log('\n(The refresh token does not expire while the app stays authorised.)');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Token exchange failed — see terminal.');
      console.error('\n❌ No refresh_token in response:', JSON.stringify(data, null, 2));
      console.error('If you authorised this app before, revoke access at myaccount.google.com/permissions and run again (prompt=consent needs a fresh grant to issue a refresh token).');
    }
  } catch (err) {
    console.error('Token exchange error:', err.message);
  } finally {
    server.close();
  }
});

server.listen(8765, '127.0.0.1', () => {
  console.log('\n1. Open this URL in your browser (sign in as the Boxx YouTube channel owner):\n');
  console.log(authUrl);
  console.log('\n2. Approve access — the refresh token will print here.\n');
});
