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
  return retargetBridgingRow({
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
  });
}

// The sheet's queued bridging rows were populated with "bridging finance"
// slugs/titles, but the pages target the higher-volume consumer term
// "bridging loans" (migration 2026-07-06). Normalise rows at publish time so
// the sheet doesn't need a manual rewrite. The service field is deliberately
// left as "Bridging Finance" — it's the internal identity used by
// SERVICE_FILTER and related-content grouping.
function retargetBridgingRow(row) {
  if ((row.service || '').trim().toLowerCase() !== 'bridging finance') return row;
  const swap = (s) => (s || '')
    .replace(/Bridging Finance/g, 'Bridging Loans')
    .replace(/bridging finance/g, 'bridging loans');
  row.slug = (row.slug || '').replace(/^bridging-finance-/, 'bridging-loans-');
  row.title = swap(row.title);
  row.metaTitle = swap(row.metaTitle);
  row.metaDescription = swap(row.metaDescription);
  row.keyword = swap(row.keyword);
  row.topic = swap(row.topic);
  row.contentBrief = swap(row.contentBrief);
  return row;
}

// ─── Get ALL scheduled location rows due today or earlier ────────────────────
// SERVICE_FILTER (optional env var): if set, only publish rows for that service.
// e.g. SERVICE_FILTER=Bridging Finance restricts to bridging finance locations
// during the strategic pivot period.
async function getScheduledRows(sheets) {
  const today         = new Date().toISOString().split('T')[0];
  const serviceFilter = (process.env.SERVICE_FILTER || '').trim().toLowerCase();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });
  const rows = res.data.values || [];

  if (serviceFilter) {
    console.log(`  SERVICE_FILTER active: only publishing "${process.env.SERVICE_FILTER}" location pages`);
  }

  const eligible = [];

  for (let i = 0; i < rows.length; i++) {
    const row         = rows[i];
    const type        = (row[1] || '').toLowerCase().trim();
    const status      = (row[2] || '').toLowerCase().trim();
    const publishDate = (row[3] || '').trim();
    const service     = (row[5] || '').trim();

    // Skip rows that don't match the service filter
    if (serviceFilter && service.toLowerCase() !== serviceFilter) continue;

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
    const type    = (row[1]  || '').toLowerCase().trim();
    const status  = (row[2]  || '').toLowerCase().trim();
    const rowSvc  = (row[5]  || '').toLowerCase().trim();
    const title   = row[9]   || '';
    const url     = row[11]  || '';

    if (type === 'blog' && status === 'published' && rowSvc === service.toLowerCase() && url) {
      blogs.push({
        url: url.startsWith('http') ? url : `https://boxxfinance.co.uk${url}`,
        title,
      });
    }
  }

  return blogs.slice(0, 4);
}

// ─── Generate location page with OpenAI ──────────────────────────────────────
async function generateLocationPage(row, relatedBlogs) {
  console.log(`Generating location page for: ${row.service} in ${row.city}`);

  const serviceSlug = row.service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const serviceUrl  = `https://boxxfinance.co.uk/funding-solutions/${serviceSlug}`;
  const chatUrl     = `https://boxxfinance.co.uk/chat-about-funding/${serviceSlug}`;

  const blogLinksText = relatedBlogs.length > 0
    ? `\nRelated blog posts to link naturally in the body — the title is for reference only, write a 3-5 word keyword-rich anchor (never use the raw title as anchor text):\n${relatedBlogs.map(b => `${b.url} — title: "${b.title}"`).join('\n')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 6000,
    messages: [
      {
        role: 'system',
        content: `You are an experienced UK commercial finance broker at Boxx Commercial Finance writing a location-specific landing page. Write as a trusted local expert who genuinely understands the business finance landscape in this city. Natural, human, advisory tone — as if speaking directly to a local business owner. Never use em dashes. Never use generic AI phrases ("in today's landscape", "navigating the challenges", etc.). No markdown, no backticks, no code fences. Return only a raw JSON object with no wrapper, no explanation.`,
      },
      {
        role: 'user',
        content: `Write a location landing page for ${row.service} in ${row.city}. Return as a single JSON object with exactly these keys:

slug, title, metaTitle, metaDescription, faqSchema, content

OUTPUT FORMAT RULES:
- content must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page'
- Do NOT include an <h1> tag — the title is rendered separately on the page
- No markdown, backticks, code fences, or curly quotes — raw JSON only
- slug format: ${serviceSlug}-${row.city.toLowerCase().replace(/\s+/g, '-')} (e.g. business-loans-leeds)
- title format: "${row.service} ${row.city}" (e.g. "Business Loans Leeds")
- metaTitle format: "${row.service} in ${row.city}" — do NOT append "| Boxx Commercial Finance" or any brand suffix (the site template adds the brand automatically)

CONTENT STRUCTURE — follow this exact order:

1. OPENING PARAGRAPH (2–3 sentences, 60–80 words)
Start with clear intent matching: "Looking for ${row.service} in ${row.city}?" or similar. Directly answer why a ${row.city} business owner would come to this page. Mention Boxx Commercial Finance and link it to ${serviceUrl} using anchor text like "${row.service.toLowerCase()} for ${row.city} businesses".

2. <h2>What We Can Fund in ${row.city}</h2>
Specific types of businesses and deals common in ${row.city} — think about the actual economy of this city (manufacturing, retail, hospitality, property, logistics, professional services, etc.). What would a local business owner typically need ${row.service.toLowerCase()} for? Be specific and local — not generic. 3–4 short paragraphs or a practical list.

3. <h2>${row.city} Business Finance: What You Need to Know</h2>
THIS IS THE MOST IMPORTANT SECTION. Genuine local market insight:
- The ${row.city} business and property landscape (growth sectors, key industries, economic context)
- Common deal types and funding structures seen in this area
- Lender appetite and how it applies to ${row.city} businesses
- Any regional factors relevant to ${row.service.toLowerCase()} in this city
This must feel written by someone who actually brokers deals in ${row.city} — not a generic paragraph with the city name swapped in. 2–3 substantive paragraphs.

4. <h2>Our ${row.service} Solutions for ${row.city} Businesses</h2>
What Boxx actually offers — amounts, terms, lender types, timescales. Link ${serviceUrl} at least once more using keyword-rich anchor text (e.g. "specialist ${row.service.toLowerCase()} solutions"). Practical and specific — no waffle. 1–2 paragraphs.

5. <h2>A Recent ${row.city} Success Story</h2>
An anonymised but realistic case study. "Recently, we helped a ${row.city}-based [specific type of business]..." — include a realistic funding amount, the challenge they faced, what product was arranged, and the outcome. This is highly persuasive for local visitors. 1 solid paragraph.

6. <h2>How the Process Works</h2>
Four clear steps: initial enquiry → lender matching → offer received → completion. Brief and reassuring — show it's straightforward. Use a numbered list or 4 short sentences.

7. <h2>Frequently Asked Questions</h2>
4–6 Q&As using <dl><dt><dd> tags. Questions should be exactly what a ${row.city} business owner would type into Google or ask an AI model, e.g.:
- "Can I get ${row.service.toLowerCase()} in ${row.city}?"
- "How quickly can ${row.service.toLowerCase()} be arranged in ${row.city}?"
- "What are the requirements for ${row.service.toLowerCase()} in ${row.city}?"
- "Does Boxx Commercial Finance work with businesses in ${row.city}?"
Keep answers direct and specific to ${row.city} where possible.

8. Closing CTA paragraph — this is a plain <p> with NO heading. Do NOT output "<h2>Closing CTA</h2>" or any heading for this section; the paragraph follows the FAQ directly.
Short and direct — 2–3 sentences. Encourage the reader to act now. Link to ${chatUrl} using a keyword-rich anchor — for example: "compare ${row.service.toLowerCase()} deals", "arrange ${row.service.toLowerCase()} today", "get a ${row.service.toLowerCase()} quote", or "find a ${row.service.toLowerCase()} broker in ${row.city}". NEVER use "speak to a specialist", "get in touch", "click here", or any other generic call-to-action phrase as the anchor text. End with a brief confidence statement.

WORD COUNT: Minimum 1000 words in the content field.

TONE AND QUALITY:
- Every section must feel genuinely written for ${row.city} — not a template with city name swapped
- Short paragraphs throughout
- Include natural keyword variations: "${row.service.toLowerCase()} ${row.city}", "${row.service.toLowerCase()} broker ${row.city}", "business finance ${row.city}", "SME funding ${row.city}"
- Mention "Boxx Commercial Finance" 2–3 times — as plain text, NOT as a hyperlink
- Do NOT add a link to https://boxxfinance.co.uk/#about or https://boxxfinance.co.uk/about-us
${row.service === 'Bridging Finance' ? `
BRIDGING TERMINOLOGY (mandatory for bridging pages):
- Use both "bridging loans" and "bridging finance" in roughly equal measure throughout — homeowners search "bridging loans ${row.city}" more than "bridging finance ${row.city}", so the page must rank for both. Alternate naturally as a real broker would in conversation.
- At least one <h2> must contain the phrase "Bridging Loans in ${row.city}"
- At least one FAQ question must use "bridging loan" phrasing (e.g. "Can I get a bridging loan in ${row.city}?")
- metaDescription must include the phrase "bridging loans"
- Address BOTH audiences: homeowners and residential buyers (chain breaks, auction purchases) AND property developers and investors (refurbishment, development exits). Both use bridging — include local scenarios for each.
- UK English: "bridging loan" not "bridge loan", "property" not "real estate", "solicitor" not "attorney"` : ''}

INTERNAL LINKS — mandatory, keyword-rich anchor text only:
- ${serviceUrl}: at least 2 links, anchor text like "${row.service.toLowerCase()} for ${row.city} businesses" or "specialist ${row.service.toLowerCase()} solutions"
- ${chatUrl}: in closing CTA — keyword-rich anchor only (see CTA rules above)
- NEVER invent URLs — only use URLs explicitly provided
- NEVER link brand names ("Boxx Commercial Finance", "Boxx") — use keyword anchors only
${blogLinksText}

faqSchema: valid @type: FAQPage object, exactly matching the FAQ section in content`,
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

  // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  const content = Buffer.from(raw, 'base64').toString('utf8');
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

  const allDueRows = await getScheduledRows(sheets);
  if (allDueRows.length === 0) {
    console.log('No scheduled location rows due today or earlier. Exiting.');
    return;
  }

  // Cap at 5 per run — prevents publishing a backlog all at once if dates go stale
  const MAX_PER_RUN = 5;
  const dueRows = allDueRows.slice(0, MAX_PER_RUN);
  console.log(`Found ${allDueRows.length} eligible location page(s); processing ${dueRows.length} this run (cap: ${MAX_PER_RUN})`);

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

    const relatedBlogs = await getPublishedBlogs(sheets, row.service);
    console.log(`  Found ${relatedBlogs.length} published blogs for ${row.service}`);

    const page = await generateLocationPage(row, relatedBlogs);
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
      // Strip any brand suffix — SEO.jsx appends the brand, so a baked-in
      // suffix renders a doubled "| Boxx ... | Boxx ..." title tag
      metaTitle: (row.metaTitle || page.metaTitle || '')
        .replace(/(\s*\|\s*Boxx Commercial Finance)+\s*$/i, '').trim(),
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
