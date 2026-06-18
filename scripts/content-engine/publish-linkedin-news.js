require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const NEWS_FILE    = 'src/data/linkedinNews.json';
const MAX_AGE_DAYS = 7;

const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── RSS feed sources ──────────────────────────────────────────────────────────
const RSS_FEEDS = [
  { url: 'https://www.bridgingandcommercial.co.uk/feed/',       name: 'Bridging & Commercial' },
  { url: 'https://propertywire.com/feed/',                      name: 'Property Wire' },
  { url: 'https://www.mortgagestrategy.co.uk/feed/',            name: 'Mortgage Strategy' },
  { url: 'https://theintermediary.co.uk/feed/',                 name: 'The Intermediary' },
  { url: 'https://specialistfinanceintroducer.com/feed/',       name: 'Specialist Finance Introducer' },
];

// ── Keyword filter ────────────────────────────────────────────────────────────
const RELEVANT_KEYWORDS = [
  'bridging', 'development finance', 'commercial mortgage', 'property',
  'lending', 'lender', 'broker', 'commercial finance', 'funding',
  'invoice finance', 'asset finance', 'business loan', 'sme',
  'interest rate', 'buy-to-let', 'btl', 'refurbishment', 'auction',
  'mezzanine', 'working capital', 'trade finance', 'structured finance',
];

// ── Commentary style variations ───────────────────────────────────────────────
const COMMENTARY_STYLES = [
  `Start with "Worth reading." then 2-3 sentences giving your professional view on the implications for UK businesses or property investors. End with a short question to drive comments.`,
  `Open with a direct one-sentence observation about what this means for the market. Expand with 2 sentences on the practical implications. Close with what borrowers or investors should be thinking about right now.`,
  `Start with a strong opinionated take on the news (1 sentence). Support it with 2 sentences of context or evidence from a broker's perspective. End with what businesses should do in response.`,
  `Start with "This matters." and explain why in 2-3 sentences from a commercial finance broker's viewpoint. End with a question or observation that invites a response.`,
];

// ── RSS parser (no external dependency) ──────────────────────────────────────
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    // <link> is self-closing in some feeds; try both forms
    let link = get('link');
    if (!link) {
      const m2 = block.match(/<link\s*\/?>\s*([^\s<]+)/i);
      link = m2 ? m2[1].trim() : '';
    }

    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const description = get('description')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 400);

    if (get('title') && link) {
      items.push({
        title: get('title'),
        link,
        description,
        pubDate: pubDate ? new Date(pubDate) : new Date(),
      });
    }
  }

  return items;
}

function isRelevant(item) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  return RELEVANT_KEYWORDS.some(kw => text.includes(kw));
}

function isRecent(item) {
  const ageDays = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= MAX_AGE_DAYS;
}

function pickAuthor(item) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  if (/bridging|development finance|commercial mortgage|property|mezzanine|auction|structured/.test(text)) {
    return 'Mark Higgins';
  }
  return 'Andrew Farrimond';
}

// ── RSS fetch ─────────────────────────────────────────────────────────────────
async function fetchAllArticles() {
  const all = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Boxx-Content-Engine/1.0 (+https://boxxfinance.co.uk)' },
      });
      if (!res.ok) { console.warn(`  ${feed.name}: HTTP ${res.status}`); continue; }
      const xml  = await res.text();
      const items = parseRSS(xml);
      console.log(`  ${feed.name}: ${items.length} items`);
      all.push(...items.map(i => ({ ...i, source: feed.name })));
    } catch (err) {
      console.warn(`  ${feed.name}: ${err.message}`);
    }
  }

  return all;
}

// ── GitHub tracking file ──────────────────────────────────────────────────────
async function getNewsFile() {
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: NEWS_FILE });
    return { sha: data.sha, shared: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
  } catch (err) {
    if (err.status === 404) return { sha: null, shared: [] };
    throw err;
  }
}

async function saveNewsFile(shared, sha, message) {
  const content = Buffer.from(JSON.stringify(shared, null, 2) + '\n').toString('base64');
  const base = { owner: GITHUB_OWNER, repo: GITHUB_REPO, path: NEWS_FILE, message, branch: 'main', content };
  await octokit.repos.createOrUpdateFileContents(sha ? { ...base, sha } : base);
}

// ── AI commentary ─────────────────────────────────────────────────────────────
async function generateCommentary(article, author) {
  const style = COMMENTARY_STYLES[Math.floor(Math.random() * COMMENTARY_STYLES.length)];

  const prompt = `You are ${author} at Boxx Commercial Finance, a UK commercial finance broker.

A news story has just been published:
Title: "${article.title}"
Source: ${article.source}
Summary: ${article.description}

Write a LinkedIn commentary (80-120 words total):
- ${style}
- Professional, direct tone — written by a senior commercial finance professional
- No emojis
- End with 3-4 relevant hashtags on the last line (e.g. #BridgingFinance #CommercialFinance #PropertyFinance)
- Do NOT include the article URL — it is added automatically

Output the commentary text only. No labels, no preamble.`;

  const r = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return r.content[0].type === 'text' ? r.content[0].text.trim() : '';
}

// ── LinkedIn API ──────────────────────────────────────────────────────────────
async function postLinkShare(article, author, commentary) {
  const isAndrew = author.toLowerCase().includes('andrew');
  const token    = isAndrew ? process.env.LINKEDIN_ACCESS_TOKEN_ANDREW : process.env.LINKEDIN_ACCESS_TOKEN_MARK;
  if (!token) throw new Error(`Missing LinkedIn token for ${author}`);

  const pr = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!pr.ok) throw new Error(`Profile lookup failed: ${await pr.text()}`);
  const personUrn = `urn:li:person:${(await pr.json()).sub}`;

  const body = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: commentary },
        shareMediaCategory: 'ARTICLE',
        media: [{
          status: 'READY',
          originalUrl: article.link,
          title: { text: article.title.substring(0, 200) },
          description: { text: article.description.substring(0, 200) },
        }],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const pp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(body),
  });
  if (!pp.ok) throw new Error(`Post failed: ${await pp.text()}`);
  const postId = (await pp.json()).id;

  // Reshare to org page
  const orgId = process.env.LINKEDIN_ORG_ID;
  if (orgId) {
    const orgToken = process.env.LINKEDIN_ORG_ACCESS_TOKEN || token;
    const rr = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify({
        author: `urn:li:organization:${orgId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': { shareCommentary: { text: '' }, shareMediaCategory: 'NONE' },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        resharedShare: postId,
      }),
    });
    if (rr.ok) console.log(`  Org reshare: ${(await rr.json()).id}`);
    else console.warn('  Org reshare failed (non-fatal)');
  }

  return postId;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n[LinkedIn News Publisher]\n');

  // Skip ~40% of runs so posting days vary unpredictably (averages ~3-4x/week)
  // Manual triggers (workflow_dispatch) always run
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' && Math.random() < 0.4) {
    console.log('Random skip today — no post. Exiting.');
    return;
  }

  console.log('Fetching RSS feeds...');
  const articles = await fetchAllArticles();
  console.log(`Total fetched: ${articles.length}\n`);

  const { sha, shared } = await getNewsFile();
  const sharedUrls = new Set(shared.map(s => s.url));
  console.log(`Previously shared: ${sharedUrls.size}`);

  const candidates = articles
    .filter(a => isRelevant(a) && isRecent(a) && !sharedUrls.has(a.link))
    .sort((a, b) => b.pubDate - a.pubDate);

  console.log(`Candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No new relevant articles found. Exiting.');
    return;
  }

  const article = candidates[0];
  console.log(`\nSelected: "${article.title}"`);
  console.log(`Source:   ${article.source}`);
  console.log(`Date:     ${article.pubDate.toISOString().split('T')[0]}`);

  const author = pickAuthor(article);
  console.log(`Author:   ${author}`);

  console.log('\nGenerating commentary...');
  const commentary = await generateCommentary(article, author);
  console.log('\nCommentary:\n---\n', commentary, '\n---\n');

  const postId = await postLinkShare(article, author, commentary);
  console.log(`LinkedIn posted: ${postId}`);

  shared.unshift({
    url: article.link,
    title: article.title,
    source: article.source,
    sharedAt: new Date().toISOString().split('T')[0],
    author,
  });

  await saveNewsFile(shared.slice(0, 300), sha, `social: linkedin news "${article.title.substring(0, 60)}"`);
  console.log('Tracking file updated.\nDone.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
