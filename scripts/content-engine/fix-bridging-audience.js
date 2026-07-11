// One-off batch: regenerates every published bridging-loans-* location page
// that was written with business/SME framing ("${city} Business Finance",
// "for ${city} Businesses", "business owner") instead of the correct audience
// — homeowners, landlords, property developers and investors. Root cause:
// publish-location.js used one generic business-audience prompt for every
// service, bridging included (fixed separately — see bridgingLocationPrompt
// in publish-location.js). This script fixes the pages already published
// under the old prompt.
require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO = process.env.GITHUB_REPO || 'boxxfinance-site';
const LOCATION_FILE = 'src/data/locationPages.json';
const BLOG_FILE = 'src/data/blogPosts.json';

// Detects the old business-framed template output.
const BUSINESS_FRAMING = /Business Finance:|for [A-Za-z\s]+ Businesses<\/h2>|\bbusiness owner\b|\bSME funding\b/i;

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

// Same prompt as bridgingLocationPrompt() in publish-location.js — kept as a
// standalone copy here since publish-location.js executes on require (no
// exports) and this is a one-off script, not a shared module.
function bridgingPrompt(city, serviceUrl, chatUrl, blogLinksText) {
  return `Write a location landing page for bridging loans in ${city}. Return as a single JSON object with exactly these keys:

slug, title, metaTitle, metaDescription, faqSchema, content

OUTPUT FORMAT RULES:
- content must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page'
- Do NOT include an <h1> tag — the title is rendered separately on the page
- No markdown, backticks, code fences, or curly quotes — raw JSON only
- slug format: bridging-loans-${city.toLowerCase().replace(/\s+/g, '-')}
- title format: "Bridging Loans ${city}"
- metaTitle format: "Bridging Loans in ${city}" — do NOT append "| Boxx Commercial Finance" or any brand suffix (the site template adds the brand automatically)

AUDIENCE — this page is NOT for "businesses" or "SMEs". Bridging loans are secured
against property and used by:
- Homeowners and residential buyers: chain breaks, auction purchases, downsizing before a sale completes
- Landlords: portfolio purchases, refinancing, releasing equity
- Property developers and investors: refurbishment, conversion, development exit finance, buy-to-let
Never use "business owner", "SME", "your business", or "business finance" anywhere on this page.
The correct terms are "homeowner", "landlord", "property investor", "property developer", "borrower".

CONTENT STRUCTURE — follow this exact order:

1. OPENING PARAGRAPH (2–3 sentences, 60–80 words)
Start with clear intent matching: "Looking for a bridging loan in ${city}?" or similar. Directly answer why a ${city} homeowner, landlord, or property investor would come to this page. Mention Boxx Commercial Finance and link it to ${serviceUrl} using anchor text like "bridging loans for ${city} property".

2. <h2>What We Can Fund in ${city}</h2>
Specific property scenarios common in ${city} — residential chain breaks, auction purchases, buy-to-let refinancing, refurbishment projects, development exits, commercial-to-residential conversions. What would a local homeowner, landlord or investor typically need a bridging loan for? Be specific and local — not generic. 3–4 short paragraphs or a practical list.

3. <h2>Bridging Loans in ${city}: What You Need to Know</h2>
THIS IS THE MOST IMPORTANT SECTION. Genuine local market insight:
- The ${city} property market (housing stock, price trends, regeneration areas, popular investment areas)
- Common bridging deal types and structures seen in this area
- Lender appetite for ${city} property and how loan-to-value works locally
- Any regional factors relevant to bridging finance in this city
This must feel written by someone who actually arranges bridging loans in ${city} — not a generic paragraph with the city name swapped in. 2–3 substantive paragraphs.

4. <h2>Our Bridging Loan Solutions for ${city} Borrowers</h2>
What Boxx actually offers — loan amounts, terms, lender types, timescales, exit strategies (sale, remortgage, development completion). Link ${serviceUrl} at least once more using keyword-rich anchor text (e.g. "specialist bridging loan solutions"). Practical and specific — no waffle. 1–2 paragraphs.

5. <h2>A Recent ${city} Success Story</h2>
An anonymised but realistic case study about a homeowner, landlord, or property investor — NOT a business. "Recently, we helped a ${city}-based [homeowner / landlord / property investor]..." — include a realistic loan amount, the challenge they faced (chain break, auction deadline, refurbishment), what was arranged, and the outcome. 1 solid paragraph.

6. <h2>How the Process Works</h2>
Four clear steps: initial enquiry → lender matching → offer received → completion. Brief and reassuring — show it's straightforward. Use a numbered list or 4 short sentences.

7. <h2>Frequently Asked Questions</h2>
4–6 Q&As using <dl><dt><dd> tags. Questions should be exactly what a ${city} homeowner, landlord, or property investor would type into Google or ask an AI model, e.g.:
- "Can I get a bridging loan in ${city}?"
- "How quickly can a bridging loan be arranged in ${city}?"
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
- Address BOTH audiences explicitly: homeowners/residential buyers (chain breaks, auction purchases) AND landlords/property developers/investors (refurbishment, development exits, portfolio purchases). Include local scenarios for each — do not default to one audience only.
- UK English: "bridging loan" not "bridge loan", "property" not "real estate", "solicitor" not "attorney"

INTERNAL LINKS — mandatory, keyword-rich anchor text only:
- ${serviceUrl}: at least 2 links, anchor text like "bridging loans for ${city} property" or "specialist bridging loan solutions"
- ${chatUrl}: in closing CTA — keyword-rich anchor only (see CTA rules above)
- NEVER invent URLs — only use URLs explicitly provided
- NEVER link brand names ("Boxx Commercial Finance", "Boxx") — use keyword anchors only
${blogLinksText}

faqSchema: valid @type: FAQPage object, exactly matching the FAQ section in content`;
}

async function regenerate(city, relatedBlogs) {
  const serviceUrl = 'https://boxxfinance.co.uk/funding-solutions/bridging-finance';
  const chatUrl = 'https://boxxfinance.co.uk/chat-about-funding/bridging-finance';
  const blogLinksText = relatedBlogs.length
    ? `\nRelated blog posts to link naturally in the body — the title is for reference only, write a 3-5 word keyword-rich anchor (never use the raw title as anchor text):\n${relatedBlogs.map((b) => `${b.url} — title: "${b.title}"`).join('\n')}`
    : '';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: `You are an experienced UK commercial finance broker at Boxx Commercial Finance writing a location-specific landing page. Write as a trusted local expert. Natural, human, advisory tone. Never use em dashes. Never use generic AI phrases. No markdown, no backticks, no code fences. Return only a raw JSON object with no wrapper, no explanation.`,
    messages: [{ role: 'user', content: bridgingPrompt(city, serviceUrl, chatUrl, blogLinksText) }],
  });

  const rawText = response.content && response.content[0] && response.content[0].type === 'text'
    ? response.content[0].text : '';
  const raw = rawText.replace(/```json/g, '').replace(/```/g, '').replace(/“/g, '"').replace(/”/g, '"').trim();
  return JSON.parse(raw);
}

const PUSH_EVERY = 10; // commit progress periodically — a 116-page run takes a while

async function pushPages(pages, sha, message) {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: LOCATION_FILE,
    message,
    content: Buffer.from(JSON.stringify(pages, null, 2)).toString('base64'),
    sha,
    branch: 'main',
  });
  return data.content.sha;
}

async function main() {
  let { json: pages, sha } = await readJsonViaApi(LOCATION_FILE);
  const { json: posts } = await readJsonViaApi(BLOG_FILE);
  const relatedBlogs = bridgingBlogLinks(posts);

  const targetSlugs = pages
    .filter((p) => p && p.status === 'published' && (p.slug || '').startsWith('bridging-loans-') && BUSINESS_FRAMING.test(p.content || ''))
    .map((p) => p.slug);

  console.log(`[Fix Bridging Audience] ${targetSlugs.length} page(s) need regeneration`);

  let fixed = 0;
  let sinceLastPush = 0;

  for (const slug of targetSlugs) {
    const target = pages.find((p) => p.slug === slug);
    if (!target) continue;
    try {
      const fresh = await regenerate(target.location, relatedBlogs);
      target.metaDescription = (fresh.metaDescription || target.metaDescription).replace(/Bridging Finance/g, 'Bridging Loans');
      target.faqSchema = fresh.faqSchema || target.faqSchema;
      target.content = fresh.content;
      fixed++;
      sinceLastPush++;
      console.log(`  fixed: ${slug} (${(fresh.content || '').length} chars) [${fixed}/${targetSlugs.length}]`);
    } catch (err) {
      console.error(`  FAILED ${slug}: ${err.message}`);
      continue;
    }

    if (sinceLastPush >= PUSH_EVERY) {
      sha = await pushPages(pages, sha, `Fix audience framing on bridging loan pages (progress: ${fixed}/${targetSlugs.length})`);
      console.log(`  -- pushed progress (${fixed} fixed so far) --`);
      sinceLastPush = 0;
    }
  }

  if (sinceLastPush > 0) {
    await pushPages(pages, sha, `Fix audience framing on ${fixed} bridging loan location pages`);
  }

  console.log(`\nDone — fixed ${fixed}/${targetSlugs.length} pages.`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
