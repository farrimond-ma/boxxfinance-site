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
const LOCATION_FILE = 'src/data/locationPages.json';

// ─── Column mapping (0-indexed) ──────────────────────────────────────────────
// A=0 id, B=1 type, C=2 status, D=3 publishDate, E=4 publishSlot
// F=5 service, G=6 city, H=7 keyword, I=8 topic, J=9 title
// K=10 slug, L=11 url, M=12 metaTitle, N=13 metaDescription, O=14 category
// P=15 contentBrief, Q=16 internalLinkService, R=17 internalLinkCity1
// S=18 internalLinkCity2, T=19 internalLinkCity3
// AA=26 jsonStatus, AB=27 publishedAt

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

// ─── Get one scheduled location row ──────────────────────────────────────────
async function getScheduledRow(sheets, slot) {
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
    const publishSlot = (row[4] || '').toUpperCase().trim();

    if (
      type === 'location' &&
      status === 'scheduled' &&
      publishDate <= today &&
      publishSlot === slot
    ) {
      return {
        rowIndex: i + 2,
        id: row[0] || '',
        publishDate,
        publishSlot,
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
      };
    }
  }
  return null;
}

// ─── Get published blogs for internal linking ─────────────────────────────────
async function getPublishedBlogs(sheets, service) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:L',
  });

  const rows = res.data.values || [];
  const blogs = [];

  for (const row of rows) {
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const rowService = (row[5] || '').toLowerCase().trim();
    const url = row[11] || '';

    if (type === 'blog' && status === 'published' && rowService === service.toLowerCase() && url) {
      blogs.push(url);
    }
  }

  return blogs.slice(0, 3);
}

// ─── Generate location page with OpenAI ──────────────────────────────────────
async function generateLocationPage(row, relatedBlogUrls) {
  console.log(`Generating location page for: ${row.service} in ${row.city}`);

  const blogLinksText = relatedBlogUrls.length > 0
    ? `\nRelated blog links to include as contextual links within the content:\n${relatedBlogUrls.map(u => `https://boxxfinance.co.uk${u}`).join('\n')}`
    : '\nNo related blog posts published yet - do not include blog links.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a UK commercial finance content writer for Boxx Commercial Finance. You write location landing pages for UK SMEs. Write in a clear, practical, advisory tone. Never use em dashes. Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`,
      },
      {
        role: 'user',
        content: `Write a location landing page for the following service and city. Return it as a single JSON object with exactly these keys:

slug, title, metaTitle, metaDescription, faqSchema, content

Rules:
- content must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page' NOT href="/path/to/page"
- content must be 800-1200 words
- Include practical local business context relevant to this city
- Include an FAQ section at the bottom using <h2> and <dl><dt><dd> tags
- faqSchema must be a valid FAQ schema object with @type: FAQPage matching the FAQ in content
- slug format: {service}-{city-lowercase-hyphenated} e.g. business-loans-leeds
- title format: "{Service Name} {City}" e.g. "Business Loans Leeds"
- metaTitle format: "{Service Name} {City} | Boxx Commercial Finance"
- Only use blog links explicitly provided below - do not invent any
- No markdown, no backticks, no code fences, no curly quotes - return raw JSON only
${blogLinksText}

Service: ${row.service}
City: ${row.city}
Category: ${row.category}
Content brief: ${row.contentBrief || 'Write a comprehensive UK SME-focused location landing page'}`,
      },
    ],
  });

  let content = response.choices[0].message.content;
  content = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .trim();

  let page;
  try {
    page = JSON.parse(content);
  } catch (err) {
    console.error('OpenAI returned invalid JSON. Raw output:');
    console.error(content.substring(0, 500));
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  return page;
}

// ─── Get current locationPages.json from GitHub ───────────────────────────────
async function getLocationPagesFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, pages: JSON.parse(content) };
}

// ─── Push updated locationPages.json to GitHub ────────────────────────────────
async function pushLocationPagesFile(pages, sha, slug) {
  const content = Buffer.from(JSON.stringify(pages, null, 2)).toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
    message: `Publish location: ${slug}`,
    content,
    sha,
    branch: 'main',
  });

  console.log(`Successfully pushed ${LOCATION_FILE} to GitHub`);
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
  // Determine slot from argument or default to AM
  const slot = (process.argv[2] || 'AM').toUpperCase();

  console.log(`=== Boxx Content Engine: Location Publisher (${slot} slot) ===`);
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  const row = await getScheduledRow(sheets, slot);
  if (!row) {
    console.log(`No scheduled location rows found for today (${slot} slot). Exiting.`);
    return;
  }
  console.log(`Found scheduled row ${row.rowIndex}: ${row.service} in ${row.city}`);

  const relatedBlogUrls = await getPublishedBlogs(sheets, row.service);
  console.log(`Found ${relatedBlogUrls.length} published blogs for ${row.service}`);

  const page = await generateLocationPage(row, relatedBlogUrls);
  console.log(`Location page generated: ${page.title}`);

  const slug = row.slug || page.slug;
  const url = `/locations/${slug}`;
  const publishedAt = new Date().toISOString();
  const fullUrl = `https://boxxfinance.co.uk${url}`;

  const newPage = {
    id: Date.now(),
    status: 'published',
    slug,
    title: row.title || page.title,
    metaTitle: row.metaTitle || page.metaTitle,
    metaDescription: row.metaDescription || page.metaDescription,
    location: row.city,
    service: row.service,
    publishDate: row.publishDate,
    publishedAt,
    faqSchema: page.faqSchema || null,
    content: page.content,
  };

  console.log('Fetching current locationPages.json from GitHub...');
  const { sha, pages } = await getLocationPagesFile();
  console.log(`Current file has ${pages.length} pages, SHA: ${sha}`);

  pages.push(newPage);
  await pushLocationPagesFile(pages, sha, slug);
  await updateSheetRow(sheets, row.rowIndex, slug, fullUrl, publishedAt);

  console.log('=== Done! ===');
  console.log(`Published: ${fullUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
