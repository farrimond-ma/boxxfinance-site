require('dotenv').config();
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';
const SITE_URL     = 'https://boxxfinance.co.uk';
const LOOKBACK_DAYS = 3;
const octokit = new (require('@octokit/rest').Octokit)({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  return { sha: data.sha, posts: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
}
async function pushBlogPostsFile(posts, message) {
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message, sha: latest.sha, branch: 'main',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
  });
}
const SERVICE_FILTER = process.env.SERVICE_FILTER || '';
function getUnpostedBlog(posts, flag) {
  const today = new Date().toISOString().split('T')[0];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  return posts.filter(p =>
    p.status === 'published' && !p[flag] &&
    p.date >= cutoffDate && p.date <= today &&
    (!SERVICE_FILTER || p.service === SERVICE_FILTER)
  ).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
function getArticleText(post, maxLen) {
  if (!post.content) return '';
  return post.content.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().substring(0, maxLen || 2000);
}
function getImageUrl(post) {
  if (post.heroImage) return post.heroImage.startsWith('http') ? post.heroImage : `${SITE_URL}${post.heroImage}`;
  const serviceKey = (post.service || '').toLowerCase().replace(/\s+/g,'-');
  const pillar = { 'bridging-finance':'/images/blog/bridging-finance-1.webp','development-finance':'/images/blog/development-finance-1.webp',
    'commercial-mortgage':'/images/blog/commercial-mortgage-1.webp','commercial-mortgages':'/images/blog/commercial-mortgage-1.webp',
    'invoice-finance':'/images/blog/invoice-finance-1.webp','asset-finance':'/images/blog/asset-finance-1.webp',
    'working-capital':'/images/blog/working-capital-1.webp','trade-finance':'/images/blog/trade-finance-1.webp',
    'business-loans':'/images/blog/business-loans-1.webp','cashflow-finance':'/images/blog/cashflow-finance-1.webp',
    'mezzanine-finance':'/images/blog/mezzanine-finance-1.webp','structured-finance':'/images/blog/structured-finance-1.webp' };
  return `${SITE_URL}${pillar[serviceKey] || '/header_bg.png'}`;
}
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_TOKEN   = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_API_VER = 'v21.0';

async function generateFacebookPost(post) {
  const text = getArticleText(post, 2000);
  const url  = post.url.startsWith('http') ? post.url : SITE_URL + post.url;
  const prompt = text
    ? 'Write a Facebook post for Boxx Commercial Finance based on this article.\nTitle: ' + post.title + '\nURL: ' + url + '\nContent: ' + text + '\n\nPost requirements:\n- 80-120 words, punchy and mobile-friendly\n- Opens with question or bold statement from the article\n- 2-3 relevant emojis\n- Ends with CTA to read more\n- Include URL on own line then 3 hashtags\n\nFormat:\nPOST:\n[text]\n\n' + url + '\n#tag1 #tag2 #tag3'
    : 'Write a Facebook post for Boxx Commercial Finance about "' + post.title + '".\n80-120 words, 2-3 emojis, CTA.\nURL: ' + url + '\n\nPOST:\n[text]\n\n' + url + '\n#tag1 #tag2 #tag3';
  const r = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:500, messages:[{role:'user',content:prompt}] });
  const t = r.content[0].type === 'text' ? r.content[0].text : '';
  return (t.match(/POST:\n([\s\S]*)/) || ['',t])[1].trim();
}

// Exchange system user token for Page Access Token.
// System user tokens are User tokens — posting to a Page requires a Page token.
async function getPageToken() {
  const res = await fetch(
    'https://graph.facebook.com/' + FB_API_VER + '/' + FB_PAGE_ID +
    '?fields=access_token&access_token=' + FB_TOKEN
  );
  const data = await res.json();
  if (data.access_token) {
    console.log('  Page Access Token obtained via /page?fields=access_token');
    return data.access_token;
  }
  // Fallback: try /me/accounts
  const acctRes = await fetch(
    'https://graph.facebook.com/' + FB_API_VER + '/me/accounts?access_token=' + FB_TOKEN
  );
  const acctData = await acctRes.json();
  const page = (acctData.data || []).find(p => p.id === FB_PAGE_ID);
  if (page?.access_token) {
    console.log('  Page Access Token obtained via /me/accounts');
    return page.access_token;
  }
  console.log('  Could not get Page Access Token — using stored token as fallback');
  return FB_TOKEN;
}

async function postToFacebook(postText, articleUrl) {
  if (!FB_PAGE_ID || !FB_TOKEN) throw new Error('FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN required');

  const pageToken = await getPageToken();

  // Facebook auto-scrapes the OG image from the link URL — no need to pass picture param
  // (passing picture requires domain ownership verification which is unreliable)
  const body = { message: postText };
  if (articleUrl) body.link = articleUrl;

  const res = await fetch('https://graph.facebook.com/' + FB_API_VER + '/' + FB_PAGE_ID + '/feed', {
    method:'POST', headers:{ Authorization:'Bearer ' + pageToken, 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Facebook API: ' + await res.text());
  const data = await res.json();
  if (data.error) throw new Error('Facebook API error: ' + JSON.stringify(data.error));
  return data.id || '';
}

async function main() {
  console.log('[Facebook Publisher]');
  const { posts } = await getBlogPostsFile();

  const post = getUnpostedBlog(posts, 'fbPosted');
  if (!post) { console.log('No unposted blogs in the last 3 days.'); return; }
  console.log('Found: "' + post.title + '" (' + post.date + ')');
  const postText   = await generateFacebookPost(post);
  const articleUrl = post.url.startsWith('http') ? post.url : SITE_URL + post.url;
  let fbSuccess = false;
  try {
    const id = await postToFacebook(postText, articleUrl);
    post.fbPosted = true;
    fbSuccess = true;
    console.log('Facebook posted: ' + id);
  } catch (err) {
    console.error('Facebook failed: ' + err.message);
    console.error('Post NOT marked as fbPosted — will retry next run.');
  }
  if (fbSuccess) {
    await pushBlogPostsFile(posts, 'social: facebook posted for ' + post.slug);
  } else {
    console.log('Skipping git commit — nothing was successfully posted.');
  }
  console.log('Done.');
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });