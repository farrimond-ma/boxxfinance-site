require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const { google } = require('googleapis');

// ─── Clients ────────────────────────────────────────────────────────────────
const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BLOG_FILE = 'src/data/blogPosts.json';

// ─── Column mapping (0-indexed) ──────────────────────────────────────────────
// A=0 id, B=1 type, C=2 status, D=3 publishDate, E=4 publishSlot
// F=5 service, G=6 city, H=7 keyword, I=8 topic, J=9 title
// K=10 slug, L=11 url, M=12 metaTitle, N=13 metaDescription, O=14 category
// P=15 contentBrief, Q=16 internalLinkService, R=17 internalLinkCity1
// S=18 internalLinkCity2, T=19 internalLinkCity3
// U=20 relatedBlog1, V=21 relatedBlog2, W=22 relatedBlog3
// X=23 faqRequired, Y=24 linkedInRequired, Z=25 author
// AA=26 jsonStatus, AB=27 publishedAt, AC=28 notes

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
async function getSheetsClient() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: 'google-credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return google.sheets({ version: 'v4', auth });
}

// ─── Get one scheduled blog row ──────────────────────────────────────────────
async function getScheduledRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });

  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const publishDate = (row[3] || '').trim();

    if (type === 'blog' && status === 'scheduled' && publishDate <= today) {
      return {
        rowIndex: i + 2,
        id: row[0] || '',
        publishDate,
        publishSlot: row[4] || 'AM',
        service: row[5] || '',
        city: row[6] || '',
        keyword: row[7] || '',
        topic: row[8] || '',
        title: row[9] || '',
        slug: row[10] || '',
        url: row[11] || '',
        metaTitle: row[12] || '',
        metaDescription: row[13] || '',
        category: row[14] || '',
        contentBrief: row[15] || '',
        faqRequired: row[23] || 'yes',
        linkedInRequired: row[24] || 'no',
      };
    }
  }
  return null;
}

// ─── Get published location pages for internal linking ───────────────────────
async function getPublishedLocations(sheets, service) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:L',
  });

  const rows = res.data.values || [];
  const locations = [];

  for (const row of rows) {
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const rowService = (row[5] || '').toLowerCase().trim();
    const url = row[11] || '';

    if (type === 'location' && status === 'published' && rowService === service.toLowerCase() && url) {
      locations.push(url);
    }
  }

  return locations.slice(0, 4);
}

// ─── Generate article with OpenAI ────────────────────────────────────────────
async function generateArticle(row, locationLinks) {
  console.log(`Generating article for: ${row.keyword || row.title}`);

  const locationLinksText = locationLinks.length > 0
    ? `\nInternal location links to include as contextual links within the article body:\n${locationLinks.map(l => `https://boxxfinance.co.uk${l}`).join('\n')}`
    : '\nNo location pages published yet for this service - do not include location links.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a UK commercial finance content writer for Boxx Commercial Finance. Write for UK SMEs in a clear, advisory, trustworthy tone. Never use em dashes. Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`,
      },
      {
        role: 'user',
        content: `Write a blog article and return it as a single JSON object with exactly these keys:

slug, title, excerpt, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, category, faqSchema, contentHtml

Rules:
- contentHtml must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page' NOT href="/path/to/page"
- contentHtml must be 1200+ words
- Include an FAQ section at the bottom using <h2> and <dl><dt><dd> tags
- faqSchema must be a valid FAQ schema object with @type: FAQPage matching the FAQ in contentHtml
- secondaryKeywords must be a JSON array of strings
- Only use location links explicitly provided below - do not invent any
- No markdown, no backticks, no code fences, no curly quotes - return raw JSON only
- slug should be the keyword in lowercase with hyphens
${locationLinksText}

Keyword: ${row.keyword}
Service: ${row.service}
Category: ${row.category}
Content brief: ${row.contentBrief || 'Write a comprehensive UK SME-focused advisory article'}`,
      },
    ],
  });

  let content = response.choices[0].message.content;
  content = content.replace(/```json/g, '').replace(/```/g, '').replace(/\u201c/g, '"').replace(/\u201d/g, '"').trim();

  let article;
  try {
    article = JSON.parse(content);
  } catch (err) {
    console.error('OpenAI returned invalid JSON. Raw output:');
    console.error(content.substring(0, 500));
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  return article;
}

// ─── Get current blogPosts.json from GitHub ───────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, posts: JSON.parse(content) };
}

// ─── Push updated blogPosts.json to GitHub ────────────────────────────────────
async function pushBlogPostsFile(posts, sha, slug) {
  const content = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
    message: `Publish blog: ${slug}`,
    content,
    sha,
    branch: 'main',
  });

  console.log(`Successfully pushed ${BLOG_FILE} to GitHub`);
}

// ─── Update the Google Sheet row ──────────────────────────────────────────────
async function updateSheetRow(sheets, rowIndex, slug, liveUrl, publishedAt) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      valueInputOption: 'RAW',
      data: [
        { range: `ContentEngine!C${rowIndex}`, values: [['published']] },
        { range: `ContentEngine!K${rowIndex}`, values: [[slug]] },
        { range: `ContentEngine!L${rowIndex}`, values: [[liveUrl]] },
        { range: `ContentEngine!AA${rowIndex}`, values: [['published']] },
        { range: `ContentEngine!AB${rowIndex}`, values: [[publishedAt]] },
      ],
    },
  });

  console.log(`Updated sheet row ${rowIndex} to published`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Boxx Content Engine: Blog Publisher ===');
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  const row = await getScheduledRow(sheets);
  if (!row) {
    console.log('No scheduled blog rows found for today. Exiting.');
    return;
  }
  console.log(`Found scheduled row ${row.rowIndex}: ${row.keyword || row.title}`);

  const locationLinks = await getPublishedLocations(sheets, row.service);
  console.log(`Found ${locationLinks.length} published location pages for ${row.service}`);

  const article = await generateArticle(row, locationLinks);
  console.log(`Article generated: ${article.title}`);

  const slug = row.slug || article.slug;
  const url = `/insights/${slug}`;
  const publishedAt = new Date().toISOString();
  const fullUrl = `https://boxxfinance.co.uk${url}`;

  const newPost = {
    id: Date.now(),
    type: 'blog',
    status: 'published',
    slug,
    url,
    title: row.title || article.title,
    excerpt: article.excerpt,
    metaTitle: row.metaTitle || article.metaTitle,
    metaDescription: row.metaDescription || article.metaDescription,
    primaryKeyword: row.keyword || article.primaryKeyword,
    keywords: article.secondaryKeywords || [],
    secondaryKeywords: article.secondaryKeywords || [],
    category: row.category || article.category,
    publishDate: row.publishDate,
    date: publishedAt,
    publishedAt,
    author: 'Andrew Farrimond',
    relatedLocationUrls: locationLinks.map(l => l.startsWith('http') ? l : `https://boxxfinance.co.uk${l}`),
    relatedBlogUrls: [],
    schema: article.faqSchema || null,
    faqSchema: article.faqSchema || null,
    content: article.contentHtml,
    contentHtml: article.contentHtml,
  };

  console.log('Fetching current blogPosts.json from GitHub...');
  const { sha, posts } = await getBlogPostsFile();
  console.log(`Current file has ${posts.length} posts, SHA: ${sha}`);

  posts.push(newPost);
  await pushBlogPostsFile(posts, sha, slug);
  await updateSheetRow(sheets, row.rowIndex, slug, fullUrl, publishedAt);

  console.log('=== Done! ===');
  console.log(`Published: ${fullUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
