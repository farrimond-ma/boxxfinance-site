require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');

const GITHUB_OWNER  = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO   = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE     = 'src/data/blogPosts.json';
const SITE_URL      = 'https://boxxfinance.co.uk';
const LOOKBACK_DAYS = 3;

const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SERVICE_AUTHORS = {
  'bridging-finance':'Mark Higgins','development-finance':'Mark Higgins',
  'commercial-mortgages':'Mark Higgins','commercial-mortgage':'Mark Higgins',
  'property-finance':'Mark Higgins','structured-finance':'Mark Higgins','mezzanine-finance':'Mark Higgins',
  'invoice-finance':'Andrew Farrimond','asset-finance':'Andrew Farrimond',
  'working-capital':'Andrew Farrimond','trade-finance':'Andrew Farrimond',
  'cashflow-finance':'Andrew Farrimond','business-loans':'Andrew Farrimond',
};

function resolveAuthor(postAuthor, service) {
  if (postAuthor && (postAuthor.includes('Mark') || postAuthor.includes('Andrew'))) return postAuthor;
  const key = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return SERVICE_AUTHORS[key] || 'Mark Higgins';
}

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

// SERVICE_FILTER env var restricts posts to a specific service (e.g. 'Bridging Finance')
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

function getArticleText(post) {
  if (!post.content) return null;
  return post.content.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().substring(0, 4000);
}

// Six distinct post formats — cycled randomly to avoid algorithmic suppression
const POST_FORMATS = [
  {
    name: 'insight',
    emojis: false,
    wordRange: '150-200',
    instructions: `Strong hook from a specific insight in the article (no "I" as first word). Professional, authoritative tone. Ends with a CTA sentence then 3-5 hashtags on the last line.`,
  },
  {
    name: 'punchy',
    emojis: false,
    wordRange: '60-90',
    instructions: `Ultra-short and punchy. One bold opening statement, 2-3 sentences expanding on it, then one direct question to the reader. 3 hashtags on the last line. No CTA sentence — the question IS the CTA.`,
  },
  {
    name: 'story',
    emojis: false,
    wordRange: '180-230',
    instructions: `Opens with a real-feeling scenario or case ("A business owner came to us needing X..." — no real names). Describe the challenge, the approach, the outcome. Close with a one-sentence lesson and a CTA. 3-4 hashtags on the last line.`,
  },
  {
    name: 'take',
    emojis: true,
    wordRange: '100-140',
    instructions: `Bold contrarian opener — challenge a common assumption in commercial finance (e.g. "Most businesses think X. They're wrong."). 2-3 paragraphs of explanation. End with a question to drive comments. 3-4 hashtags on the last line.`,
  },
  {
    name: 'list',
    emojis: true,
    wordRange: '150-200',
    instructions: `Hook sentence, then 3-4 numbered points (each 1-2 sentences). Close with a CTA sentence and 3-4 hashtags on the last line.`,
  },
  {
    name: 'stat',
    emojis: false,
    wordRange: '120-160',
    instructions: `Open with a striking statistic or fact drawn from the article content. Explain what it means for UK business owners. One practical takeaway. CTA sentence then 3-4 hashtags on the last line.`,
  },
];

async function generateLinkedInPost(post, author) {
  const text = getArticleText(post);
  const url  = post.url.startsWith('http') ? post.url : `${SITE_URL}${post.url}`;
  const fmt  = POST_FORMATS[Math.floor(Math.random() * POST_FORMATS.length)];
  const emojiLine = fmt.emojis
    ? `- Use 2-3 relevant emojis naturally placed in the text (not at every line)`
    : `- No emojis`;
  // NOTE: the model must NOT write the URL — it hallucinates wrong domains.
  // It writes the teaser sentence only; we append the real URL in code below.
  const base = `You are writing a LinkedIn post for ${author} at Boxx Commercial Finance.\n\nPost format: ${fmt.name}\nWord count: ${fmt.wordRange} words\n${emojiLine}\n\nInstructions:\n${fmt.instructions}\n\nHashtags in POST only. FIRST_COMMENT has no hashtags and NO URL or link — just one teaser sentence (we add the link separately).\n\nFormat:\nPOST:\n[text + hashtags]\n\nFIRST_COMMENT:\n[one teaser sentence, no URL, no hashtags]`;
  const src  = text ? `Article: "${post.title}"\nContent: ${text}\n\n${base}` : `Topic: "${post.title}"\n\n${base}`;

  const r = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:700, messages:[{role:'user',content:src}] });
  const t = r.content[0].type === 'text' ? r.content[0].text : '';

  // Strip any URL the model included despite instructions, then append the real one.
  let commentText = (t.match(/FIRST_COMMENT:\n([\s\S]*?)$/) || ['',''])[1].trim();
  commentText = commentText.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (!commentText) commentText = 'Read the full article here:';
  // Ensure it ends cleanly before the URL
  if (!/[:.!?]$/.test(commentText)) commentText += ':';

  return {
    postText: (t.match(/POST:\n([\s\S]*?)(?=FIRST_COMMENT:|$)/) || ['',''])[1].trim() || t.trim(),
    firstComment: `${commentText} ${url}`,
  };
}

async function postToLinkedIn(post, author, postText, firstComment) {
  const isAndrew = author.toLowerCase().includes('andrew');
  const token = isAndrew ? process.env.LINKEDIN_ACCESS_TOKEN_ANDREW : process.env.LINKEDIN_ACCESS_TOKEN_MARK;
  if (!token) throw new Error(`Missing LinkedIn token for ${author}`);
  const pr = await fetch('https://api.linkedin.com/v2/userinfo', { headers:{ Authorization:`Bearer ${token}` } });
  if (!pr.ok) throw new Error(`Profile: ${await pr.text()}`);
  const personUrn = `urn:li:person:${(await pr.json()).sub}`;
  const pp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', 'X-Restli-Protocol-Version':'2.0.0' },
    body: JSON.stringify({ author:personUrn, lifecycleState:'PUBLISHED',
      specificContent:{'com.linkedin.ugc.ShareContent':{shareCommentary:{text:postText},shareMediaCategory:'NONE'}},
      visibility:{'com.linkedin.ugc.MemberNetworkVisibility':'PUBLIC'} }),
  });
  if (!pp.ok) throw new Error(`Post: ${await pp.text()}`);
  const postId = (await pp.json()).id;
  if (firstComment) {
    const cr = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postId)}/comments`, {
      method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', 'X-Restli-Protocol-Version':'2.0.0' },
      body: JSON.stringify({ actor:personUrn, message:{text:firstComment} }),
    });
    if (cr.ok) console.log('  Comment added'); else console.warn(`  Comment failed`);
  }
  const orgId = process.env.LINKEDIN_ORG_ID;
  if (orgId) {
    const orgToken = process.env.LINKEDIN_ORG_ACCESS_TOKEN || token;
    const rr = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method:'POST', headers:{ Authorization:`Bearer ${orgToken}`, 'Content-Type':'application/json', 'X-Restli-Protocol-Version':'2.0.0' },
      body: JSON.stringify({ author:`urn:li:organization:${orgId}`, lifecycleState:'PUBLISHED',
        specificContent:{'com.linkedin.ugc.ShareContent':{shareCommentary:{text:''},shareMediaCategory:'NONE'}},
        visibility:{'com.linkedin.ugc.MemberNetworkVisibility':'PUBLIC'}, resharedShare:postId }),
    });
    if (rr.ok) console.log(`  Reshare: ${(await rr.json()).id}`); else console.warn(`  Reshare failed`);
  }
  return postId;
}

async function main() {
  console.log('\n[LinkedIn Publisher]\n');
  const { posts } = await getBlogPostsFile();
  const post = getUnpostedBlog(posts, 'liPosted');
  if (!post) { console.log('No unposted blogs in the last 3 days.'); return; }
  console.log(`Found: "${post.title}" (${post.date})`);
  const author = resolveAuthor(post.author, post.service);
  const { postText, firstComment } = await generateLinkedInPost(post, author);
  try {
    const id = await postToLinkedIn(post, author, postText, firstComment);
    post.liPosted = true;
    console.log(`LinkedIn posted: ${id}`);
  } catch (err) { console.error(`LinkedIn failed: ${err.message}`); }
  await pushBlogPostsFile(posts, `social: linkedin posted for ${post.slug}`);
  console.log('Done.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });