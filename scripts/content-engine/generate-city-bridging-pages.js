// One-off batch: generate Bridging Loans location pages for the major UK
// regional cities that were missing from the London-weighted bridging queue.
// Mirrors publish-location.js generation exactly (same gpt-4o prompt), but
// takes a fixed city list instead of the Google Sheet, forces the
// "bridging-loans-*" naming (consumer term), and pushes all pages in one
// commit via the GitHub API (GH_PAT) so a deploy triggers automatically.
require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO = process.env.GITHUB_REPO || 'boxxfinance-site';
const LOCATION_FILE = 'src/data/locationPages.json';
const BLOG_FILE = 'src/data/blogPosts.json';
const SERVICE = 'Bridging Finance'; // internal identity; slug/title use "Bridging Loans"

// Major regional cities missing a bridging page (option 1 from the coverage audit).
const CITIES = [
  'Manchester', 'Leeds', 'Liverpool', 'Sheffield', 'Newcastle', 'Nottingham',
  'Leicester', 'Coventry', 'Bradford', 'Cardiff', 'Belfast', 'Glasgow',
  'Edinburgh', 'Stoke-on-Trent', 'Wolverhampton', 'Southampton', 'Derby',
  'Portsmouth', 'Hull', 'Swansea', 'Sunderland', 'York',
];

const citySlug = (c) => c.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

async function readJsonViaApi(path) {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, json: JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) };
}

function bridgingBlogLinks(posts) {
  return posts
    .filter((p) => p && p.status === 'published' && (p.service || '').toLowerCase().includes('bridging'))
    .slice(0, 4)
    .map((p) => ({ url: p.url && p.url.startsWith('http') ? p.url : `https://boxxfinance.co.uk${p.url || '/insights/' + p.slug}`, title: p.title }));
}

async function generate(city, relatedBlogs) {
  const serviceSlug = 'bridging-finance';
  const serviceUrl = `https://boxxfinance.co.uk/funding-solutions/${serviceSlug}`;
  const chatUrl = `https://boxxfinance.co.uk/chat-about-funding/${serviceSlug}`;
  const blogLinksText = relatedBlogs.length
    ? `\nRelated blog posts to link naturally in the body — the title is for reference only, write a 3-5 word keyword-rich anchor (never use the raw title as anchor text):\n${relatedBlogs.map((b) => `${b.url} — title: "${b.title}"`).join('\n')}`
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
        content: `Write a location landing page for ${SERVICE} in ${city}. Return as a single JSON object with exactly these keys:

slug, title, metaTitle, metaDescription, faqSchema, content

OUTPUT FORMAT RULES:
- content must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page'
- Do NOT include an <h1> tag — the title is rendered separately on the page
- No markdown, backticks, code fences, or curly quotes — raw JSON only
- slug format: bridging-loans-${citySlug(city)}
- title format: "Bridging Loans ${city}"
- metaTitle format: "Bridging Loans in ${city}" — do NOT append "| Boxx Commercial Finance" or any brand suffix (the site template adds the brand automatically)

CONTENT STRUCTURE — follow this exact order:

1. OPENING PARAGRAPH (2–3 sentences, 60–80 words)
Start with clear intent matching: "Looking for bridging loans in ${city}?" or similar. Directly answer why a ${city} property owner or investor would come to this page. Mention Boxx Commercial Finance and link it to ${serviceUrl} using anchor text like "bridging loans for ${city} property".

2. <h2>What We Can Fund in ${city}</h2>
Specific property and business scenarios common in ${city} — think about the actual property market of this city (residential chains, auctions, refurbishments, developments, commercial conversions). What would a local owner or investor typically need a bridging loan for? Be specific and local — not generic. 3–4 short paragraphs or a practical list.

3. <h2>Bridging Loans in ${city}: What You Need to Know</h2>
THIS IS THE MOST IMPORTANT SECTION. Genuine local market insight:
- The ${city} property and business landscape (growth areas, housing stock, regeneration, key industries)
- Common deal types and funding structures seen in this area
- Lender appetite and how it applies to ${city} borrowers
- Any regional factors relevant to bridging finance in this city
This must feel written by someone who actually brokers deals in ${city} — not a generic paragraph with the city name swapped in. 2–3 substantive paragraphs.

4. <h2>Our Bridging Loan Solutions for ${city} Borrowers</h2>
What Boxx actually offers — amounts, terms, lender types, timescales, exit strategies. Link ${serviceUrl} at least once more using keyword-rich anchor text (e.g. "specialist bridging loan solutions"). Practical and specific — no waffle. 1–2 paragraphs.

5. <h2>A Recent ${city} Success Story</h2>
An anonymised but realistic case study. "Recently, we helped a ${city}-based [property investor / homeowner / developer]..." — include a realistic funding amount, the challenge (chain break, auction deadline, refurb, development exit), what was arranged, and the outcome. 1 solid paragraph.

6. <h2>How the Process Works</h2>
Four clear steps: initial enquiry → lender matching → offer received → completion. Brief and reassuring. Use a numbered list or 4 short sentences.

7. <h2>Frequently Asked Questions</h2>
4–6 Q&As using <dl><dt><dd> tags. Questions should be exactly what a ${city} borrower would type into Google or ask an AI model, e.g.:
- "Can I get a bridging loan in ${city}?"
- "How quickly can bridging finance be arranged in ${city}?"
- "What are the requirements for a bridging loan in ${city}?"
- "Does Boxx Commercial Finance arrange bridging loans in ${city}?"
Keep answers direct and specific to ${city} where possible.

8. Closing CTA paragraph — this is a plain <p> with NO heading. Do NOT output a heading for this section; the paragraph follows the FAQ directly.
Short and direct — 2–3 sentences. Link to ${chatUrl} using a keyword-rich anchor — for example: "compare bridging loan deals", "arrange a bridging loan today", "get a bridging loan quote", or "find a bridging loan broker in ${city}". NEVER use "speak to a specialist", "get in touch", "click here", or any generic call-to-action phrase as the anchor text. End with a brief confidence statement.

WORD COUNT: Minimum 1000 words in the content field.

TONE AND QUALITY:
- Every section must feel genuinely written for ${city} — not a template with city name swapped
- Short paragraphs throughout
- Include natural keyword variations: "bridging loans ${city}", "bridging loan broker ${city}", "bridging finance ${city}", "property finance ${city}"
- Mention "Boxx Commercial Finance" 2–3 times — as plain text, NOT as a hyperlink
- Do NOT add a link to https://boxxfinance.co.uk/#about or https://boxxfinance.co.uk/about-us

BRIDGING TERMINOLOGY (mandatory):
- Use both "bridging loans" and "bridging finance" in roughly equal measure throughout — homeowners search "bridging loans ${city}" more than "bridging finance ${city}", so the page must rank for both. Alternate naturally as a real broker would in conversation.
- At least one <h2> must contain the phrase "Bridging Loans in ${city}"
- At least one FAQ question must use "bridging loan" phrasing
- metaDescription must include the phrase "bridging loans"
- Address BOTH audiences: homeowners and residential buyers (chain breaks, auction purchases) AND property developers and investors (refurbishment, development exits). Both use bridging — include local scenarios for each.
- UK English: "bridging loan" not "bridge loan", "property" not "real estate", "solicitor" not "attorney"

INTERNAL LINKS — mandatory, keyword-rich anchor text only:
- ${serviceUrl}: at least 2 links, anchor text like "bridging loans for ${city} property" or "specialist bridging loan solutions"
- ${chatUrl}: in closing CTA — keyword-rich anchor only (see CTA rules above)
- NEVER invent URLs — only use URLs explicitly provided
- NEVER link brand names ("Boxx Commercial Finance", "Boxx") — use keyword anchors only
${blogLinksText}

faqSchema: valid @type: FAQPage object, exactly matching the FAQ section in content`,
      },
    ],
  });

  let raw = response.choices[0].message.content
    .replace(/```json/g, '').replace(/```/g, '')
    .replace(/“/g, '"').replace(/”/g, '"')
    .trim();
  const page = JSON.parse(raw);

  // Force canonical bridging-loans naming regardless of model output
  const slug = `bridging-loans-${citySlug(city)}`;
  return {
    id: Date.now() + Math.floor(Math.random() * 100000),
    status: 'published',
    slug,
    title: `Bridging Loans ${city}`,
    metaTitle: `Bridging Loans in ${city}`,
    metaDescription: (page.metaDescription || `Looking for bridging loans in ${city}? Boxx Commercial Finance arranges fast, flexible bridging finance for property owners, investors and developers across ${city}.`).replace(/Bridging Finance/g, 'Bridging Loans'),
    location: city,
    service: SERVICE,
    publishDate: new Date().toISOString().split('T')[0],
    publishedAt: new Date().toISOString(),
    faqSchema: page.faqSchema || null,
    content: page.content,
  };
}

async function main() {
  console.log(`[City Bridging Pages] generating ${CITIES.length} pages`);
  const { pages } = await readJsonViaApi(LOCATION_FILE);
  const { json: posts } = await readJsonViaApi(BLOG_FILE);
  const relatedBlogs = bridgingBlogLinks(posts);

  const existing = new Set(pages.map((p) => p.slug));
  let added = 0;

  for (const city of CITIES) {
    const slug = `bridging-loans-${citySlug(city)}`;
    if (existing.has(slug)) { console.log(`  skip (exists): ${slug}`); continue; }
    try {
      const page = await generate(city, relatedBlogs);
      pages.push(page);
      existing.add(page.slug);
      added++;
      console.log(`  generated: ${page.slug} (${(page.content || '').length} chars)`);
    } catch (err) {
      console.error(`  FAILED ${city}: ${err.message}`);
    }
  }

  if (added === 0) { console.log('Nothing new to add.'); return; }

  // Single commit via the API (GH_PAT) so the deploy triggers automatically
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: LOCATION_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
    message: `Publish ${added} major-city bridging loan pages`,
    content: Buffer.from(JSON.stringify(pages, null, 2)).toString('base64'),
    sha: latest.sha,
    branch: 'main',
  });
  console.log(`\nDone — added ${added} pages, pushed to main.`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
