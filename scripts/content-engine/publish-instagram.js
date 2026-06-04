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
function getUnpostedBlog(posts, flag) {
  const today = new Date().toISOString().split('T')[0];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  return posts.filter(p => p.status === 'published' && !p[flag] && p.date >= cutoffDate && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
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
const IG_USER_ID = process.env.INSTAGRAM_USER_ID;
const FB_TOKEN   = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_API_VER = 'v21.0';

async function generateCaption(post) {
  const text = getArticleText(post, 2000);
  const url  = post.url.startsWith('http') ? post.url : SITE_URL + post.url;
  const prompt = 'Write an Instagram caption for Boxx Commercial Finance.\nTitle: ' + post.title + (text ? '\nContent: ' + text : '') + '\n\nCaption requirements:\n- Hook line (max 15 words) that shows above "more"\n- 3-4 punchy lines from the article\n- 4-5 natural emojis\n- CTA: "Link in bio" or similar\n- Blank line then 20-25 hashtags on one line\n\nFormat:\nCAPTION:\n[hook]\n\n[body]\n\n[cta]\n\nHASHTAGS:\n#tag1 #tag2 ...';
  const r = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:600, messages:[{role:'user',content:prompt}] });
  const t = r.content[0].type === 'text' ? r.content[0].text : '';
  const cap = (t.match(/CAPTION:\n([\s\S]*?)(?=HASHTAGS:|$)/) || ['',''])[1].trim();
  const tags = (t.match(/HASHTAGS:\n([\s\S]*)$/) || ['',''])[1].trim();
  return tags ? cap + '\n\n' + tags : cap;
}

async function postToInstagram(imageUrl, caption) {
  if (!IG_USER_ID || !FB_TOKEN) throw new Error('INSTAGRAM_USER_ID and FACEBOOK_PAGE_ACCESS_TOKEN required');
  const base = 'https://graph.facebook.com/' + FB_API_VER + '/' + IG_USER_ID;
  const cr = await fetch(base + '/media', {
    method:'POST', headers:{ Authorization:'Bearer ' + FB_TOKEN, 'Content-Type':'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption }),
  });
  if (!cr.ok) throw new Error('Container: ' + await cr.text());
  const containerId = (await cr.json()).id;
  const pr = await fetch(base + '/media_publish', {
    method:'POST', headers:{ Authorization:'Bearer ' + FB_TOKEN, 'Content-Type':'application/json' },
    body: JSON.stringify({ creation_id: containerId }),
  });
  if (!pr.ok) throw new Error('Publish: ' + await pr.text());
  return (await pr.json()).id || '';
}

async function main() {
  console.log('[Instagram Publisher]');
  const dow = new Date().getUTCDay();
  if ((dow === 0 || dow === 6) && process.env.FORCE_RUN !== 'true') { console.log('Weekend - skipping.'); return; }
  const { posts } = await getBlogPostsFile();
  const post = getUnpostedBlog(posts, 'igPosted');
  if (!post) { console.log('No unposted blogs in the last 3 days.'); return; }
  console.log('Found: "' + post.title + '"');
  const caption  = await generateCaption(post);
  const imageUrl = getImageUrl(post);
  try {
    const id = await postToInstagram(imageUrl, caption);
    post.igPosted = true;
    console.log('Instagram posted: ' + id);
  } catch (err) { console.error('Instagram failed: ' + err.message); }
  await pushBlogPostsFile(posts, 'social: instagram posted for ' + post.slug);
  console.log('Done.');
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });