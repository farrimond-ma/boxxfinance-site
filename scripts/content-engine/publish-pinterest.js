require('dotenv').config();
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';
const SITE_URL     = 'https://boxxfinance.co.uk';
const LOOKBACK_DAYS = 3;
const octokit = new (require('@octokit/rest').Octokit)({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
  const content = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, posts: JSON.parse(Buffer.from(content, 'base64').toString('utf8')) };
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
    // Use the real publish timestamp, not the (possibly long-past) scheduled
    // date — a backlogged post that finally goes live days late must still
    // get its 3-day window from *today*, not from its stale scheduled date.
    // Posts published before this field existed have no publishedAt and are
    // deliberately excluded rather than flooding social all at once.
    p.publishedAt && p.publishedAt.slice(0, 10) >= cutoffDate && p.publishedAt.slice(0, 10) <= today &&
    (!SERVICE_FILTER || p.service === SERVICE_FILTER)
  ).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0] || null;
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
const PINTEREST_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;

function getBoardId(service) {
  const key = (service || '').toLowerCase().replace(/\s+/g,'_').toUpperCase();
  return process.env['PINTEREST_BOARD_ID_' + key] || process.env.PINTEREST_BOARD_ID;
}

async function generatePinDescription(post) {
  const text = getArticleText(post, 1500);
  const prompt = 'Write a Pinterest pin description for Boxx Commercial Finance.\nTitle: ' + post.title + (text ? '\nContent: ' + text : '') + '\n\n150-300 chars, useful insight, ends with 3-5 hashtags. Return ONLY the description.';
  const r = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:200, messages:[{role:'user',content:prompt}] });
  return r.content[0].type === 'text' ? r.content[0].text.trim() : post.title;
}

async function createPin(post, description, imageUrl, boardId) {
  if (!PINTEREST_TOKEN) throw new Error('PINTEREST_ACCESS_TOKEN required');
  if (!boardId) throw new Error('PINTEREST_BOARD_ID required');
  const url = post.url.startsWith('http') ? post.url : SITE_URL + post.url;
  const res = await fetch('https://api.pinterest.com/v5/pins', {
    method:'POST', headers:{ Authorization:'Bearer ' + PINTEREST_TOKEN, 'Content-Type':'application/json' },
    body: JSON.stringify({ board_id:boardId, title:post.title.slice(0,100), description, link:url, media_source:{ source_type:'image_url', url:imageUrl } }),
  });
  if (!res.ok) throw new Error('Pinterest: ' + await res.text());
  return (await res.json()).id || '';
}

async function main() {
  console.log('[Pinterest Publisher]');
  const { posts } = await getBlogPostsFile();
  const post = getUnpostedBlog(posts, 'pinterestPosted');
  if (!post) { console.log('No unposted blogs in the last 3 days.'); return; }
  console.log('Found: "' + post.title + '"');
  const description = await generatePinDescription(post);
  const imageUrl    = getImageUrl(post);
  const boardId     = getBoardId(post.service);
  try {
    const id = await createPin(post, description, imageUrl, boardId);
    post.pinterestPosted = true;
    console.log('Pinterest pin created: ' + id);
  } catch (err) { console.error('Pinterest failed: ' + err.message); }
  await pushBlogPostsFile(posts, 'social: pinterest posted for ' + post.slug);
  console.log('Done.');
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });