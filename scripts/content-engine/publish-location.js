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
    let credentials;
    try {
      // Try base64 decode first (GitHub Actions)
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
      // Fall back to raw JSON (local .env)
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
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

function buildLocationRow(i, row) {
  return {
    rowIndex:     i + 2,
    id:           row[0] || '',
    publishDate:  row[3] || '',
    publishSlot:  (row[4] || '').toUpperCase().trim(),
    service:      row[5] || '',
    city:         row[6] || '',
    keyword:      row[7] || '',
    topic:        row[8] || '',
    title:        row[9] || '',
    slug:         row[10] || '',
    url:          row[11] || '',
    metaTitle:    row[12] || '',
    metaDescription: row[13] || '',
    category:     row[14] || '',
    contentBrief: row[15] || '',
  };
}

// ─── Get ALL scheduled location rows due today or earlier ────────────────────
async function getScheduledRows(sheets) {
  const today = new Date().toISOString().split('T')[0];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  const rows = res.data.values || [];

  const eligible = [];

  for (let i = 0; i < rows.length; i++) {
    const row         = rows[i];
    const type        = (row[1] || '').toLowerCase().trim();
    const status      = (row[2] || '').toLowerCase().trim();
    const publishDate = (row[3] || '').trim();

    if (type === 'location' && status === 'scheduled' && publishDate <= today) {
      eligible.push(buildLocationRow(i, row));
    }
  }

  // Sort oldest-first so we always catch up in order
  eligible.sort((a, b) => {
    if (a.publishDate !== b.publishDate) return a.publishDate.localeCompare(b.publishDate);
    return a.publishSlot.localeCompare(b.publishSlot);
  });

  return eligible;
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

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
    message: `Publish location: ${slug}`,
    content,
    sha,
    branch: 'main',
  });

  console.log(`  Pushed ${LOCATION_FILE} to GitHub`);
  // Return the new SHA so the next push in the loop doesn't conflict
  return { sha: data.content.sha };
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
  console.log(`=== Boxx Content Engine: Location Publisher ===`);
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  const dueRows = await getScheduledRows(sheets);
  if (dueRows.length === 0) {
    console.log('No scheduled location rows due today or earlier. Exiting.');
    return;
  }
  console.log(`Found ${dueRows.length} location page(s) to publish`);

  // Fetch the location pages file once — we'll keep adding to it
  let { sha, pages } = await getLocationPagesFile();
  console.log(`Current locationPages.json has ${pages.length} pages`);

  let published = 0;

  for (const row of dueRows) {
    console.log(`\n── Processing: ${row.service} in ${row.city} (${row.publishDate} ${row.publishSlot}) ──`);

    // Skip if slug already exists
    if (pages.find(p => p.slug === row.slug)) {
      console.log(`  Slug "${row.slug}" already exists — marking as published and skipping generation`);
      await updateSheetRow(sheets, row.rowIndex, row.slug, `https://boxxfinance.co.uk/locations/${row.slug}`, new Date().toISOString());
      continue;
    }

    const relatedBlogUrls = await getPublishedBlogs(sheets, row.service);
    console.log(`  Found ${relatedBlogUrls.length} published blogs for ${row.service}`);

    const page = await generateLocationPage(row, relatedBlogUrls);
    console.log(`  Generated: ${page.title}`);

    const slug = row.slug || page.slug;
    const url = `/locations/${slug}`;
    const publishedAt = new Date().toISOString();
    const fullUrl = `https://boxxfinance.co.uk${url}`;

    const newPage = {
      id: Date.now() + published,  // ensure unique ids when publishing multiple
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

    pages.push(newPage);

    // Push updated file and get new SHA for the next iteration
    ({ sha } = await pushLocationPagesFile(pages, sha, slug));
    await updateSheetRow(sheets, row.rowIndex, slug, fullUrl, publishedAt);

    console.log(`  Published: ${fullUrl}`);
    published++;
  }

  console.log(`\n=== Done! Published ${published} location page(s) ===`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
