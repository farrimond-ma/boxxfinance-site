require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createOpenAICompatClient } = require('./lib/anthropic-openai-shim');
const { isBridgingService, pickBridgingHero } = require('./lib/bridging-hero');
const { parseModelJson, logJsonFailure } = require('./lib/parse-model-json');

// Schema for the generated article, passed as a structured output so the model
// CANNOT return unparseable JSON. Without it, the model occasionally emits an
// unescaped `"` mid-prose (…because it "felt safer.") inside contentHtml, which
// terminates the JSON string and fails the whole run. Structured outputs
// constrain decoding, so quotes inside values are escaped automatically.
// Note: every object needs additionalProperties:false and a `required` list.
const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    // Descriptions are load-bearing, not documentation. Under structured
    // outputs the schema constrains decoding and competes with the prose
    // prompt for the model's attention — a bare `{type: 'string'}` says
    // nothing about what the field must contain. The first article generated
    // with a description-less schema came back with 1 internal link instead of
    // the ~12 the prompt asks for; everything else about it was fine. Keep the
    // hard requirements restated here, in sync with the prompt below.
    slug:              { type: 'string', description: 'URL slug, lowercase words separated by hyphens. No dates, no stop words.' },
    title:             { type: 'string', description: 'Article H1. Names the product using "bridging loans" (never "bridging finance") where relevant.' },
    excerpt:           { type: 'string', description: 'Plain text only — NO markdown, NO HTML tags. One or two sentences, 25-40 words, shown on the insights listing card. Natural reader-facing prose ONLY — never an instruction to a generator or editor (e.g. never "link to the service page"), and never the raw target keyword phrase pasted in verbatim.' },
    metaTitle:         { type: 'string', description: 'SEO title tag, under 60 characters, front-loads the primary keyword.' },
    metaDescription:   { type: 'string', description: 'SEO meta description, 140-158 characters, includes the primary keyword and a reason to click. Natural reader-facing prose ONLY — never an instruction to a generator or editor, and never the raw target keyword phrase pasted in verbatim.' },
    primaryKeyword:    { type: 'string', description: 'The single target search phrase for this article.' },
    secondaryKeywords: { type: 'array', items: { type: 'string' }, description: '4-8 supporting search phrases actually used in the body copy.' },
    category:          { type: 'string', description: 'Service taxonomy value for this article.' },
    contentHtml:       { type: 'string', description:
      'The full article body as valid HTML, minimum 3200 words. ' +
      'MUST end with a "Frequently Asked Questions" H2 section containing the same 5-7 Q&As as faqSchema, ' +
      'each question as its own <h3> using the EXACT SAME WORDING as the matching faqSchema question — ' +
      'not <dl>/<dt>/<dd> — so AI crawlers that parse heading structure see the same question the schema declares. ' +
      'the first article generated without this instruction omitted the FAQ entirely and shipped with zero FAQ schema. ' +
      'MUST also include H2 sections covering: what it means in practice, how it works, typical scenarios, ' +
      'what lenders look for, common mistakes, alternatives or comparisons, and a summary. ' +
      'MUST contain at least 4 internal links total, and every one of the following: ' +
      '(1) 3 or more contextual links to the service page, each with DIFFERENT keyword-rich 2-5 word anchor text; ' +
      '(2) one link in the opening paragraph to the service page; ' +
      '(3) one link to the /funding-solutions hub near the end; ' +
      '(4) a mid-article CTA and a separate closing CTA, both linking to /chat-about-funding with keyword-rich anchors; ' +
      '(5) the supplied related-blog and location links, embedded naturally in sentences. ' +
      'Anchor text is NEVER "click here", "read more", "learn more", "contact us", "get in touch", or "speak to a specialist". ' +
      'Use single quotes for HTML attribute values.' },
    faqSchema: {
      type: 'object',
      description: 'FAQPage structured data. MUST contain 5-7 question/answer pairs — never an empty list. ' +
        'This is what AI answer engines quote directly, so it is not optional decoration. ' +
        'The same questions must also appear as a "Frequently Asked Questions" H2 section at the end of contentHtml, ' +
        'each one as its own <h3> matching this question text WORD-FOR-WORD — a schema question that does not appear ' +
        'verbatim as a visible heading is far less likely to be cited by AI answer engines. ' +
        'Each answer\'s first sentence must be a complete, self-contained statement that fully answers the question ' +
        'without needing the question for context — e.g. "Bad credit will generally not stop you getting a bridging ' +
        'loan because lenders weigh the property and exit strategy over your credit score", NOT "No, not usually, ' +
        'because...". This is the exact sentence Perplexity and Google AI Overviews lift and quote.',
      properties: {
        '@type': { type: 'string', description: 'Always the literal string "FAQPage".' },
        mainEntity: {
          type: 'array',
          description: '5-7 items. Real questions a UK borrower would type into Google, not restatements of the title.',
          items: {
            type: 'object',
            properties: {
              '@type': { type: 'string', description: 'Always the literal string "Question".' },
              name:    { type: 'string', description: 'The question, phrased as a searcher would ask it.' },
              acceptedAnswer: {
                type: 'object',
                properties: { '@type': { type: 'string' }, text: { type: 'string' } },
                required: ['@type', 'text'],
                additionalProperties: false,
              },
            },
            required: ['@type', 'name', 'acceptedAnswer'],
            additionalProperties: false,
          },
        },
      },
      required: ['@type', 'mainEntity'],
      additionalProperties: false,
    },
  },
  required: [
    'slug', 'title', 'excerpt', 'metaTitle', 'metaDescription',
    'primaryKeyword', 'secondaryKeywords', 'category', 'contentHtml', 'faqSchema',
  ],
  additionalProperties: false,
};
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const { google } = require('googleapis');

// ─── Clients ────────────────────────────────────────────────────────────────
const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });
// Migrated from OpenAI gpt-4o to Claude (2026-07-20) via a drop-in shim after an
// OpenAI-credit outage silently stopped all content for days. Same call sites.
const openai    = createOpenAICompatClient({ apiKey: process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BLOG_FILE = 'src/data/blogPosts.json';

// 2026-08-17: raised from 1200/1250 alongside the move to fewer, longer,
// weekday-only posts (see publish-blog.yml). seo-audit.js WARNs below
// TARGET_WORDS. We demand a buffer above that from generation so the
// humanizer pass (which may trim up to 10%) still lands the final article
// over the audit target.
// 2026-08-25: raised to 3000 when the cadence went back to 2 posts/day, 7
// days a week. Length is part of what keeps the higher volume from reading
// as thin, churned-out filler.
const TARGET_WORDS = 3000;
const GENERATION_MIN_WORDS = 3200;

// Minimum internal links per article. Both floors are measured against the
// published corpus, not aspiration — a gate set above what good articles
// actually do just fails every run and gets ignored.
//   Total: average is 6.6 across the 101 posts and 81 carry 4 or more, so 4 is
//   a floor a healthy article clears easily while still catching a collapse.
//   Service: the prompt asks for "3 or more" contextual service-page links, but
//   NO post in the corpus has ever had more than 1 — including the strongest
//   (bridging-loan-for-foreign-nationals, 10 links, 1 service link). So this is
//   a presence check, and the prompt's 3+ target is a content-quality gap worth
//   addressing separately rather than something to enforce retroactively.
const MIN_TOTAL_LINKS = 4;
const MIN_SERVICE_LINKS = 1;

// Section floor, also corpus-measured: healthy articles carry 8 H2s (7 content
// sections plus the FAQ). 6 catches the collapse — the broken post had 4 and no
// FAQ — without flagging older posts that run slightly leaner.
const MIN_H2_SECTIONS = 6;

// Word-by-word title case, matching search-console-actions.js and
// fix-queued-titles.js exactly — used to self-heal the raw-keyword title bug
// at publish time, see the self-healing guard below.
function toTitle(text) {
  const lower = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to',
    'by', 'in', 'of', 'up', 'as', 'is', 'vs'];
  return String(text || '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 || !lower.includes(w.toLowerCase()))
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.toLowerCase())
    .join(' ');
}

// Word count matching seo-audit.js exactly (strip tags, collapse whitespace)
function wordCount(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0).length;
}

// ─── Column mapping (0-indexed) ──────────────────────────────────────────────
// A=0 id, B=1 type, C=2 status, D=3 publishDate, E=4 publishSlot
// F=5 service, G=6 city, H=7 keyword, I=8 topic, J=9 title
// K=10 slug, L=11 url, M=12 metaTitle, N=13 metaDescription, O=14 category
// P=15 contentBrief, Q=16 internalLinkService, R=17 internalLinkCity1
// S=18 internalLinkCity2, T=19 internalLinkCity3
// U=20 relatedBlog1, V=21 relatedBlog2, W=22 relatedBlog3
// X=23 faqRequired, Y=24 linkedInRequired, Z=25 author
// AA=26 jsonStatus, AB=27 publishedAt, AC=28 notes

// ─── Pillar images ───────────────────────────────────────────────────────────
const pillarImages = {
  'bridging-finance': ['/images/blog/bridging-finance-1.webp', '/images/blog/bridging-finance-2.webp'],
  'development-finance': ['/images/blog/development-finance-1.webp', '/images/blog/development-finance-2.webp'],
  'commercial-mortgage': ['/images/blog/commercial-mortgage-1.webp', '/images/blog/commercial-mortgage-2.webp'],
  'invoice-finance': ['/images/blog/invoice-finance-1.webp', '/images/blog/invoice-finance-2.webp'],
  'asset-finance': ['/images/blog/asset-finance-1.webp', '/images/blog/asset-finance-2.webp'],
  'working-capital': ['/images/blog/working-capital-1.webp', '/images/blog/working-capital-2.webp'],
  'trade-finance': ['/images/blog/trade-finance-1.webp', '/images/blog/trade-finance-2.webp'],
  'property-finance': ['/images/blog/property-finance-1.webp', '/images/blog/property-finance-2.webp'],
  'business-loans': ['/images/blog/business-loans-1.webp', '/images/blog/business-loans-2.webp'],
  'cashflow-finance': ['/images/blog/cashflow-finance-1.webp', '/images/blog/cashflow-finance-2.webp'],
  'mezzanine-finance': ['/images/blog/mezzanine-finance-1.webp', '/images/blog/mezzanine-finance-2.webp'],
  'structured-finance': ['/images/blog/structured-finance-1.webp', '/images/blog/structured-finance-2.webp'],
};

function getPillarImage(service) {
  const key = service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const images = pillarImages[key] || pillarImages['bridging-finance'];
  return images[Math.floor(Math.random() * images.length)];
}

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
async function getSheetsClient() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials;
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
      );
    } catch {
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

// ─── Get one scheduled blog row ──────────────────────────────────────────────
// 2026-08-17: publishing consolidated to a single weekday slot (was 3 separate
// daily streams — AM, PM and trigger-event — publishing up to ~14-21 posts/week
// between them). One post per weekday now, longer and more detailed, to stop
// the topic-scheduling collisions that produced near-duplicate articles (see
// the SPEED/AUCTION/etc. cannibalisation cleanup in git history the same day).
//
// SLOT_PRIORITY defines what a single run looks for, in order: trigger-event
// content first (time-sensitive, and deliberately a slow/high-quality stream
// already — see publish-blog-trigger.yml), then whatever's due in the AM or
// PM queues (PM checked too so rows already tagged PM in the sheet from
// before this change don't get stranded).
//
// PUBLISH_SLOT can still override this to restrict a run to exactly one slot
// (e.g. for a manual workflow_dispatch test run) — unset, it uses the merged
// priority order above.
//
// SERVICE_FILTER (optional): if set, only publish rows for that service.
// e.g. SERVICE_FILTER=Bridging Finance restricts to bridging finance content
// during the strategic pivot period.
const SLOT_PRIORITY = ['TRIGGER', 'AM', 'PM'];

// ─── Duplicate-coverage guard ─────────────────────────────────────────────────
// 2026-08-25. Cadence went back to 2 posts/day, 7 days a week (~14/week), which
// is the volume that previously produced the cannibalisation mess — 21
// near-duplicate articles across 10 topic clusters, still redirected in
// public/.htaccess today. The only thing that had prevented a repeat was
// publishing less; nothing ever checked whether a queued keyword was already
// covered. At this cadence that is not survivable, so this is the check.
//
// Two stages, deliberately: a cheap token-overlap shortlist so the model only
// ever sees a handful of plausible clashes, then the model adjudicates. A pure
// keyword match is too blunt ("bridging loan rates" vs "cost of a bridging
// loan" are the same article with different words), and asking the model about
// all ~180 published posts every run is wasteful.
const STOPWORDS = new Set(['a','an','the','and','or','for','to','of','in','on','is','are','can','do','does','you','your','uk','with','what','how','my','i','it','be']);

function topicTokens(str) {
  return new Set(String(str || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size); // how much of the SHORTER topic is covered
}

// The published posts most likely to clash with what we are about to write.
function shortlistSimilar(row, posts, limit = 6) {
  const planned = topicTokens(`${row.keyword} ${row.title} ${row.topic}`);
  return posts
    .filter(p => p.status === 'published')
    .map(p => ({ post: p, score: overlapScore(planned, topicTokens(`${p.keywords} ${p.title} ${p.slug}`)) }))
    .filter(x => x.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const DUPLICATE_SCHEMA = {
  type: 'object',
  properties: {
    isDuplicate: { type: 'boolean', description: 'True if the planned article would substantially duplicate one of the existing articles — same core question, same reader intent — rather than covering a genuinely distinct angle.' },
    duplicateOf: { type: 'string', description: 'If isDuplicate: the slug of the existing article it duplicates. Otherwise empty.' },
    reason: { type: 'string', description: 'One sentence explaining the decision.' },
  },
  required: ['isDuplicate', 'duplicateOf', 'reason'],
  additionalProperties: false,
};

async function checkDuplicateCoverage(row, posts) {
  const similar = shortlistSimilar(row, posts);
  if (similar.length === 0) return { isDuplicate: false, duplicateOf: '', reason: 'no similar published article' };

  const list = similar.map(s => `- ${s.post.slug} :: "${s.post.title}"`).join('\n');
  try {
    const res = await openai.chat.completions.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      response_format: { json_schema: { schema: DUPLICATE_SCHEMA } },
      messages: [
        { role: 'system', content: `You stop a UK finance site publishing near-duplicate articles that compete with each other in search. Two articles duplicate when they answer the same core question for the same reader, even if worded differently ("bridging loan rates" and "what does a bridging loan cost" are the same article). They are NOT duplicates when the angle is genuinely different — a different borrower situation, a different stage of the process, or a different product. Return only a raw JSON object.` },
        { role: 'user', content: `Planned article:\n  keyword: ${row.keyword}\n  title: ${row.title}\n  topic: ${row.topic}\n\nAlready published:\n${list}\n\nWould publishing the planned article duplicate any of these?` },
      ],
    });
    return parseModelJson(res.choices[0].message.content, { label: 'duplicate-coverage guard' });
  } catch (err) {
    // Never block publishing on a failed check — but say so loudly, because a
    // silent pass here is how the cannibalisation happened the first time.
    console.warn(`  ⚠ Duplicate check failed (${err.message}) — publishing without it.`);
    return { isDuplicate: false, duplicateOf: '', reason: 'check failed' };
  }
}

// Park a row rather than deleting it: 'duplicate' keeps it out of the queue on
// every future run while leaving a visible record in the sheet of what was
// skipped and why.
async function markRowDuplicate(sheets, rowIndex, duplicateOf) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `ContentEngine!C${rowIndex}`, values: [['duplicate']] },
        { range: `ContentEngine!AC${rowIndex}`, values: [[`Skipped ${new Date().toISOString().split('T')[0]}: duplicates ${duplicateOf || 'existing coverage'}`]] },
      ],
    },
  });
}

// A run that publishes nothing is a failure for this workflow, not a quiet
// day — the queue is scheduled ahead, so empty means it needs refilling.
// Exits non-zero so the failure watchdog raises it, and writes the reason to
// the run summary so the cause is visible without opening the log.
function reportNothingPublished(headline, detail) {
  console.error(`\n❌ ${headline}`);
  console.error(`   ${detail}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      require('fs').appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## No blog post published\n\n**${headline}**\n\n${detail}\n`,
      );
    } catch { /* non-fatal */ }
  }
  process.exit(1);
}

async function getScheduledRow(sheets) {
  const slots = process.env.PUBLISH_SLOT
    ? [process.env.PUBLISH_SLOT.toUpperCase()]
    : SLOT_PRIORITY;
  const serviceFilter = (process.env.SERVICE_FILTER || '').trim().toLowerCase();

  // A2:AD, not A2:AC — column AD carries contentFramework (e.g. 'trigger-event'),
  // an unused trailing column reused rather than inserted, so every other
  // script's fixed-width A2:AC/A:AC reads and appends stay untouched.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AD',
  });

  const rows = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  if (serviceFilter) {
    console.log(`  SERVICE_FILTER active: only publishing "${process.env.SERVICE_FILTER}" content`);
  }

  const buildRow = (row, i) => ({
    rowIndex: i + 2,
    id: row[0] || '',
    publishDate: (row[3] || '').trim(),
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
    author: row[25] || 'Mark Higgins',
    internalLinkService: row[16] || '',
    notes: row[28] || '',
    contentFramework: (row[29] || '').trim().toLowerCase(),
  });

  // Every eligible row in priority order, not just the first — the duplicate
  // guard in main() needs somewhere to fall through to when it skips one.
  const candidates = [];
  for (const slot of slots) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const type        = (row[1] || '').toLowerCase().trim();
      const status      = (row[2] || '').toLowerCase().trim();
      const publishDate = (row[3] || '').trim();
      const publishSlot = (row[4] || 'AM').toUpperCase().trim();
      const service     = (row[5] || '').trim();

      if (serviceFilter && service.toLowerCase() !== serviceFilter) continue;
      if (type === 'blog' && status === 'scheduled' && publishDate <= today && publishSlot === slot) {
        candidates.push(buildRow(row, i));
      }
    }
  }
  return candidates;
}

// ─── Get published location pages for internal linking ───────────────────────
// Reads from locationPages.json in the checked-out repo — these pages are
// guaranteed to be live because the file is only updated after a successful
// deploy. This prevents linking to pages that are published in the sheet but
// not yet deployed to the live site.
async function getPublishedLocations(_sheets, service) {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../../src/data/locationPages.json');
    const pages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const serviceSlug = service.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    const toSlug = s => (s || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');

    // Anchor text is just the place name — natural to embed mid-sentence
    // ("whether you're in Norwich or Reading"). Previously used the full
    // keyword phrase ("bridging loans in Norwich"), which reads as broken
    // English once embedded in a sentence rather than standing alone — an
    // external review of a live article caught this on 2026-08-19.
    const matches = pages.filter(p => p.status === 'published' && toSlug(p.service) === serviceSlug);
    // Randomised per generation run, not the same first 4 every time — a
    // fixed slice(0, 4) meant every single article on the site linked to
    // the exact same 4 location pages (whichever published first), so the
    // other 300+ location pages never received any internal links from
    // blog content at all. Spotted independently by Mark noticing "all the
    // blogs seem to reference just 4 locations" the same day.
    const shuffled = [...matches].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4).map(p => ({ url: `/locations/${p.slug}`, anchor: p.location }));
  } catch (err) {
    console.warn(`  Could not read locationPages.json: ${err.message}`);
    return [];
  }
}

// ─── Get published blogs for related article linking ─────────────────────────
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
    const title = row[9] || '';

    if (type === 'blog' && status === 'published' && rowService === service.toLowerCase() && url) {
      blogs.push({ url: url.startsWith('http') ? url : `https://boxxfinance.co.uk${url}`, title });
    }
  }

  return blogs.slice(0, 3);
}

// "Bridging Finance" is the internal service identity (used for SERVICE_FILTER
// and matching against stored data); the public-facing funding-solutions/
// chat-about-funding slug is "bridging-loans" (2026-07 rename).
function toPublicServiceSlug(service) {
  const raw = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return raw === 'bridging-finance' ? 'bridging-loans' : raw;
}

// ─── Trigger-event framework (urgency-led bridging content) ─────────────────
// Runs ALONGSIDE the standard keyword-driven pipeline above — activated only
// for rows with contentFramework === 'trigger-event' (column AD), seeded by
// scripts/content-engine/seed-trigger-content.js from the Trigger Map. See
// docs/trigger-event-content-brief.md for the full source-of-truth brief.
// The thesis: bridging demand is event-triggered, not interest-triggered —
// the reader landed here because something just broke and a deadline is now
// running, not because they were idly researching finance products. Every
// structural/voice/compliance rule below exists to meet that reader where
// they actually are, rather than writing another generic explainer.
const TRIGGER_EVENT_STRUCTURE = `ARTICLE STRUCTURE — this is a trigger-event / urgency-led article. Do NOT use the generic "what is X" explainer shape. Follow this exact 10-part shape instead (adapt headings to the specific trigger, but keep the order and intent):

1. THE MIRROR (first 60 words, no heading, opens the article) — restate the reader's exact situation back to them in plain language. No preamble, no "In today's property market...". They must recognise themselves in sentence one. Second person, present tense ("You've just...").
2. <h2>The clock</h2> — name the actual real-world deadline for this trigger and count it out with SPECIFIC NUMBERS, e.g. "You exchanged on the 3rd. Completion is the 31st. That's 19 working days, and a lender typically needs 10-14 of them." Never vague ("soon", "quickly") — always a number.
3. <h2>What happens if you miss it</h2> — concrete, factual consequences (lost deposit, forfeited fees, seller's right to claim losses, chain collapse). Factual, not lurid. Do not manufacture drama beyond the genuine stakes.
4. <h2>Your options</h2> — MUST include a comparison <table> of every realistic route, NOT just bridging. Bridging is one option among several, presented with honest trade-offs. This is the single biggest trust signal in the piece — do not make it look like a bridging advert.
5. <h2>How a bridging loan works for this situation</h2> — timeline in days, what's needed from the reader, what the lender needs, where this specific trigger's applications typically stall.
6. <h2>What it actually costs</h2> — a fully worked example with REAL ARITHMETIC for this scenario: gross vs net loan, arrangement fee (~2% typical), monthly interest (quote monthly AND show the annualised equivalent so the true cost is never disguised), exit fee, legals, valuation. Never hand-wave cost. Explain the gross/net loan distinction explicitly — most competing articles skip it and most borrowers get caught by it.
7. <h2>Your exit strategy</h2> — non-negotiable section. Spell out what a lender will actually accept as an exit for THIS trigger (sale of the security property, sale of another asset, refinance onto a term product). Bridging without a credible exit is the single biggest reason applications fail.
8. <h2>Who this is wrong for</h2> — genuinely disqualify people for whom bridging is not the right answer here, and say what they should do instead. This raises lead quality and is the right thing to do — do not skip or soften it.
9. <h2>What to do in the next 24 hours</h2> — a numbered, concrete action list specific to this trigger.
10. <h2>Frequently Asked Questions</h2> — 5-7 Q&As taken from real search phrasing for this trigger, each question as its own <h3> matching the faqSchema wording exactly.

Word count for trigger-event pieces: 3200-4000 words (spokes) — longer than the standard 3000-word minimum, because steps 4 and 6 require real tables and worked arithmetic, not padding.`;

const TRIGGER_EVENT_VOICE = `URGENCY VOICE RULES (in addition to the tone rules above):
- Second person, present tense, throughout — not just the opening.
- Specific numbers everywhere. Vagueness reads as evasion to a reader who is mid-crisis and skimming.
- Short sentences in the opening 100 words — the reader is stressed and scanning, not settling in to read.
- Acknowledge the emotion once, briefly, in the opening section only, then move to mechanics. The reader wants competence, not sympathy.
- Do NOT manufacture false scarcity ("only 3 lenders left!"). The genuine deadline is already urgent enough — quantify it, do not dramatise it.
- Never write "bridging loans are a great solution" or similar unearned endorsement — show the arithmetic in section 6 and let the reader reach that conclusion themselves.
- Never open with "In the fast-paced world of property finance..." or any close variant.`;

const TRIGGER_EVENT_COMPLIANCE = `COMPLIANCE — UK FINANCIAL PROMOTIONS (hard constraints, this is FCA-adjacent content):
- State plainly whether the scenario described is generally FCA-regulated bridging (secured against a property the borrower or an immediate family member occupies) or generally unregulated (investment/BTL/commercial purpose) — readers routinely don't know this and it changes their protections. If genuinely ambiguous for this trigger, say so rather than guessing.
- Never guarantee an outcome. Do not write "guaranteed approval", "instant decision", "everyone accepted", "no credit checks", or anything that reads as a promise of approval, speed, or a specific rate.
- Any benefit stated must sit alongside the corresponding risk in the same section — bridging is expensive short-term debt secured on property.
- Where the loan may be secured on the reader's home, include clear risk wording that the property may be repossessed if they do not keep up repayments or repay the loan at term end.
- When quoting a monthly interest rate, always also show the annualised equivalent in the same sentence or table row — never present a monthly figure in a way that disguises the true annual cost.
- Do not state specific live rates or LTV caps as settled fact. Use ranges, label them "indicative", and note they should be confirmed at enquiry — do not imply the figures in this article are a live quote.
- NEVER invent a named rate, benchmark or authority as the source for a figure (e.g. "the Law Society's published rate") unless it was actually supplied to you — a real published article did this, citing a specific named rate that doesn't even apply to lender-charged bridging interest, and got both the source and the resulting figure wrong. If you need a number and don't have a real source for it, describe it in hedged general terms instead (e.g. "typically well above a standard mortgage rate, confirm the exact figure with your solicitor") rather than attaching a specific-sounding source you're not certain of.
- If the worked cost example needs to mention property purchase tax (stamp duty in England/NI, LBTT in Scotland, LTT in Wales — different rules and rates in each), do NOT default to "stamp duty" as if it's UK-wide. Either name the relevant one for the specific location this piece is for, or — if the piece isn't location-specific — describe it generically ("an additional property purchase tax or surcharge — the rules differ across England, Scotland and Wales") rather than picking one jurisdiction's term by default.
- This is educational content, not advice. Never write "you should take a bridging loan" or similar direct recommendation — direct the reader to speak to a broker for advice specific to their situation, and frame the CTA that way rather than as a foregone conclusion.`;

// ─── Generate article with OpenAI ────────────────────────────────────────────
async function generateArticle(row, locationLinks, relatedBlogs) {
  console.log(`Generating article for: ${row.keyword || row.title}`);
  const isTriggerEvent = row.contentFramework === 'trigger-event';
  if (isTriggerEvent) console.log(`  Trigger-event framework active${row.notes ? ` (${row.notes})` : ''}`);

  const serviceUrl = row.internalLinkService
    ? `https://boxxfinance.co.uk${row.internalLinkService}`
    : `https://boxxfinance.co.uk/funding-solutions/${toPublicServiceSlug(row.service)}`;

  const serviceCtaSlug = toPublicServiceSlug(row.service);
  const chatUrl = `https://boxxfinance.co.uk/chat-about-funding/${serviceCtaSlug}`;

  const locationLinksText = locationLinks.length > 0
    ? `\nInternal location links (embed each naturally in the article body using the anchor text shown — do not alter the anchor or the URL):\n${locationLinks.map(l => `  URL: https://boxxfinance.co.uk${l.url}  Anchor text: "${l.anchor}"`).join('\n')}`
    : '';

  const relatedBlogsText = relatedBlogs.length > 0
    ? `\nRelated blog posts to embed as contextual links in the article body. The title is for reference only — write a 3-5 word keyword-rich anchor text that describes what the article covers (NOT the raw title, NOT "read more", NOT "this article"):\n${relatedBlogs.map(b => `  URL: ${b.url}  Topic: "${b.title}"`).join('\n')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 16000, // headroom for a 3500-word article + HTML + faqSchema + JSON wrapping
    response_format: { json_schema: { schema: ARTICLE_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: isTriggerEvent
          ? `You are an experienced UK bridging finance broker writing for Boxx Finance. The reader has landed on this page because a specific deal or life event just went wrong and a deadline is now running — a chain collapsed, an auction deposit is at risk, a mortgage was declined days before exchange, a probate deadline is looming. You are the person who meets them at that exact moment: calm, precise, numbers-first. Write in a natural, human, UK tone. Never use em dashes. Never use generic AI phrases ("in today's fast-paced world", "navigating the landscape", "it's worth noting", "delve", "unlock the potential", etc.). Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`
          : `You are an experienced UK commercial finance broker writing a blog article for Boxx Finance. Write in a natural, human, UK tone — as a trusted adviser speaking directly to a UK SME owner. Never use em dashes. Never use generic AI phrases ("in today's fast-paced world", "navigating the landscape", "it's worth noting", etc.). Never use markdown formatting, backticks, or code fences. Return only a raw JSON object with no wrapper, no explanation, no markdown.`,
      },
      {
        role: 'user',
        content: `Write a blog article and return it as a single JSON object with exactly these keys:

slug, title, excerpt, metaTitle, metaDescription, primaryKeyword, secondaryKeywords, category, faqSchema, contentHtml

OUTPUT RULES:
- contentHtml must be valid HTML using only single quotes inside HTML attributes e.g. href='/path/to/page' NOT href="/path/to/page"
- No markdown, no backticks, no code fences, no curly quotes — return raw JSON only
- slug should be the keyword in lowercase with hyphens
- metaTitle must be 20-60 characters and must NOT include "| Boxx Finance" or any brand suffix — the site template appends the brand automatically
- excerpt and metaDescription must be PLAIN TEXT ONLY — absolutely no markdown links "[text](url)", no HTML tags, no URLs. They are rendered as raw text on listing cards, in Google results and in social posts, so any markup shows literally to the reader. Links belong in contentHtml only.
- excerpt and metaDescription must read as natural sentences a person would write, never as an instruction to yourself or a note about the page structure. A real example that reached the live site: excerpt ending "Link to the service page to explore bridging finance for commercial property and how it can work for you." — that is a leaked generator instruction, not copy, and must never happen. Similarly, never paste the raw target keyword phrase into the middle of a sentence unchanged (e.g. "Discover more about how do bridging loans require income proof can support your business ambitions" is broken English caused by inserting the keyword literally) — reword the keyword into a grammatical sentence instead.
- secondaryKeywords must be a JSON array of strings
- Do NOT include an <h1> tag in contentHtml — the title is rendered separately on the page

TONE AND STYLE:
- Natural, human, UK tone throughout
- Short paragraphs — no paragraph longer than 4 sentences
- Practical, real-world advice that a broker would actually give a client
- Include at least one realistic business scenario showing the product in use
- Include mild, well-reasoned opinion where appropriate (e.g. "The honest answer is..." or "The straightforward view is...")
- No generic AI phrases, no corporate waffle
- Write as a broker who arranges these deals every week, NOT as a neutral explainer. The reader must finish thinking "these people do this for a living", not "this is a well-written guide". Include at least TWO observations of the kind only an active broker would make — specific, operational, confidently stated — e.g. "The most common reason applications like this get declined is...", "Lenders rarely say this outright, but...", "Developers buying with planning potential usually...". Generic both-sides explanation is the single biggest weakness to avoid.
- IMPORTANT: do NOT phrase these as "in our experience", "we see", "our clients" or similar first-person claims of specific Boxx case history — that presents invented statistics as real, verified track record under Boxx's name, which is misleading if untrue (a real published article did exactly this and was flagged by an external review). State the same observation as general, confident industry knowledge instead — the voice stays authoritative, it just isn't claiming to be a specific real statistic you don't actually have.
- Guide the reader to a view. Where there is a sensible default choice, say so and say why, rather than only listing advantages and disadvantages.
${isTriggerEvent ? '\n' + TRIGGER_EVENT_VOICE + '\n' : ''}
${isTriggerEvent ? TRIGGER_EVENT_STRUCTURE : `ARTICLE STRUCTURE (adapt headings to fit the specific topic, but follow this pattern):
- Open with a single <p> of 50-70 words that directly and definitively answers the core question. Use declarative language ("X is...", "Businesses use X when...") — NOT hedging. This is what Google AI Overviews and ChatGPT extract as a featured answer. Within this opening paragraph, link the product name to the service page (${serviceUrl}) using keyword-rich anchor text (e.g. "${row.keyword}") — this counts toward the 3+ service-page links required below.
- <h2> What this means in practice</h2>
- <h2> How it works</h2>
- <h2> Typical scenarios</h2>  ← MUST include an anonymised deal with CONCRETE FIGURES: loan amount, loan-to-value, term, the exit, and how long it took to complete. e.g. "A landlord in Leeds needed £180,000 against a £320,000 property (56% LTV) over 9 months, exiting on a refinance once the tenancy was established — funds released in 12 working days." A scenario without numbers is not acceptable.
- <h2> What lenders look for</h2>  ← REQUIRED SECTION. Concrete underwriting detail: typical loan-to-value ranges, realistic timescales from enquiry to funds, what security is acceptable, what evidence of the exit lenders expect, and the most common reasons applications are declined. This is the section competitors copy least and readers value most — be specific, use real UK ranges, never generic.
- <h2> Common mistakes</h2>
- <h2> Alternatives or comparisons</h2>  ← MUST state plainly when this product is the WRONG choice and what to use instead. Naming the situations where the reader should NOT take this product — and what genuinely suits them better — is the strongest trust signal on the page. Do not hedge it or bury it.
- <h2> How to get the best outcome</h2>
- <h2> Summary</h2>
- <h2> Frequently Asked Questions</h2>  ← 4-6 Q&As, each question as its own <h3> using the EXACT SAME WORDING as the matching faqSchema question, immediately followed by a <p> answer. Not <dl>/<dt>/<dd> — AI crawlers parse heading structure, and a schema question that isn't also a visible heading is far less likely to get cited.`}

Each <h2> section must open with 1-2 sentences that directly answer the section question before expanding — this lets AI models extract accurate summaries.

If the article naturally involves comparing 2 or more numeric values side by side (e.g. typical LTV by property type, rates by term, fees by lender type${isTriggerEvent ? ', the options table required above' : ''}), include one simple <table> with a header row summarising them — AI engines preferentially extract and cite tabular data over prose.${isTriggerEvent ? '' : ' Do not force a table where nothing is genuinely comparable; most articles will not need one.'}

WORD COUNT — this is a hard requirement, not a guideline:
- The full article must be at least ${isTriggerEvent ? '3200 words of visible text — aim for 3500-4000, because the options table and worked cost example require real detail, not padding' : '3000 words of visible text — aim for 3200-3800'}
- Every <h2> section except Summary and the FAQ must be at least 220 words — this is a longer, more detailed article format than before, so depth must come from genuinely expanding every section, not padding a couple of them
- Each FAQ answer must be 40-70 words
- Articles under 2000 words fail the site's SEO audit and are rejected, so expand thin sections with practical detail, realistic UK figures and broker insight before returning

AI SEARCH (AEO) — additional rules for Google AI Overviews and Perplexity:
- Include specific UK data points, FCA context, or regulatory facts where relevant
- Mention "Boxx Finance" naturally 3-4 times so AI models associate the brand with the topic
- faqSchema must be a valid FAQ schema object with @type: FAQPage matching the FAQ in contentHtml exactly, including word-for-word question wording as the <h3> headings
- Each FAQ answer's first sentence must stand alone as a complete answer — see faqSchema description for the exact standard

CALLS TO ACTION (both required):
- Mid-article CTA: include one paragraph encouraging the reader to get advice, linking to ${chatUrl}. Use a 2-5 word anchor built around the PRODUCT NAME ("bridging loans"), e.g. "compare bridging loan rates", "arrange a bridging loan", "get a bridging loan quote", "find a bridging loan broker" — NEVER generic phrases like "click here", "contact us", "speak to a specialist", or "get in touch"
- CRITICAL — do NOT paste the target keyword into a CTA template. The keyword for this article is a DESCRIPTIVE PHRASE, not a product name, and slotting it in produces broken English. A real example that reached the live site: keyword "bridging loan borrowers over 70" became the anchor "get a bridging loan borrowers over 70 quote" and "find a bridging loan borrowers over 70 broker". Write anchors that read as natural English a person would say out loud. If an anchor would not survive being read aloud, rewrite it.
- Closing CTA: end the article (before the FAQ) with a short paragraph linking to ${chatUrl} using a different natural anchor from the mid-article CTA

INTERNAL LINKS — anchor text rules are MANDATORY. Follow 2026 SEO/AEO best practices: descriptive 2-5 word anchors, never generic single words. Never use "here", "this page", "click here", "read more", "learn more", "find out more", "our services", "our page", "speak to a specialist", or "get in touch".
- Service page (${serviceUrl}): include at least 3 contextual links. Use keyword-rich 2-5 word anchor text that names the product and its benefit or audience, e.g. "${row.keyword} for UK businesses", "${row.keyword} options", "UK ${row.keyword} solutions", "${row.keyword} rates UK" — vary the phrasing across the 3+ links so they are not identical
- Funding solutions hub https://boxxfinance.co.uk/funding-solutions: include once near the end of the article using descriptive anchor text like "UK commercial funding solutions" or "business funding options" (2-5 words, specific)
- UK SME Funding Index https://boxxfinance.co.uk/uk-sme-funding-index: link this ONLY IF the article genuinely discusses interest rates, the cost of borrowing, Bank of England rates, or UK lending-market conditions. It is a live index of Bank of England SME lending data, so it is relevant to rate/market articles and irrelevant to most others — do NOT force it in. When it fits, use descriptive anchor text such as "UK SME lending rates" or "current SME funding costs" (2-5 words). If the topic is unrelated, omit it entirely.
- Related blog posts: embed naturally in a sentence using keyword-rich anchor text describing what the post covers, NOT the raw post title and NOT generic phrases. E.g. for a post about bridging loan rates write "current UK bridging loan rates" — NEVER "Read Article", "this article", or just the page URL
- Location links: use the exact anchor text provided in the location links list below — do not alter it — only link to the URLs explicitly provided, never invent location URLs
- Do NOT add a link to https://boxxfinance.co.uk/#about — that anchor adds no SEO value
- Only use links explicitly provided — do not invent any URLs
${locationLinksText}
${relatedBlogsText}
${isTriggerEvent ? '\n' + TRIGGER_EVENT_COMPLIANCE + '\n' : ''}
Keyword: ${row.keyword}
Service: ${row.service}
Category: ${row.category}
Content brief: ${row.contentBrief || 'Write a comprehensive UK SME-focused advisory article'}

${row.service === 'Bridging Finance' ? `BRIDGING LOANS TERMINOLOGY (mandatory for all bridging articles):
- "Bridging loans" is the ONLY primary term. Use "bridging loan" / "bridging loans" throughout — in the title, H1, first paragraph, headings and body. This is a deliberate strategic focus: concentrate all ranking signal on "bridging loans".
- Do NOT use "bridging finance". Avoid it entirely. If a sentence would naturally reach for "bridging finance", rewrite it with "bridging loan(s)" or a neutral phrase like "short-term property finance" instead.
- Include "developer finance" where the scenario involves property development, refurbishment, conversion or planning gain. Many bridging clients are developers — address them directly.
- Target TWO audiences in every article: (1) residential property buyers, investors, landlords and homeowners (the larger market) and (2) property developers and commercial investors. Both use bridging loans. The residential scenario might be a chain break or auction purchase; the developer scenario might be a refurbishment or development exit. Include at least one example from each where the topic allows.
- UK English throughout: "bridging loan" not "bridge loan", "property" not "real estate", "solicitor" not "attorney".
- Phrases to use naturally alongside "bridging loans": "short-term property finance", "fast property finance", "specialist property finance" — these widen search reach without reintroducing "bridging finance".` : ''}`,
      },
    ],
  });

  // Parse AS WRITTEN \u2014 do not pre-normalise curly quotes. Claude writes
  // typographic quotes inside prose, and rewriting them to straight quotes
  // corrupts otherwise-valid JSON. See lib/parse-model-json.js.
  let article;
  try {
    article = parseModelJson(response.choices[0].message.content, { label: 'article generator' });
  } catch (err) {
    logJsonFailure(err);
    throw err;
  }

  // GPT-4o reliably under-delivers on the word-count minimum in a single shot
  // (early posts came back well short), so verify and expand.
  let words = wordCount(article.contentHtml);
  console.log(`  Draft word count: ${words}`);
  for (let attempt = 1; attempt <= 3 && words < GENERATION_MIN_WORDS; attempt++) {
    console.log(`  Below ${GENERATION_MIN_WORDS}-word minimum — expansion pass ${attempt}...`);
    article.contentHtml = await expandArticleHtml(article.contentHtml, row.keyword, words);
    words = wordCount(article.contentHtml);
    console.log(`  Word count after expansion: ${words}`);
  }
  if (words < GENERATION_MIN_WORDS) {
    console.warn(`  Still ${words} words after expansion passes — publishing anyway, seo-audit will flag if under ${TARGET_WORDS}`);
  }

  // ── Meta-copy validation (excerpt/metaDescription) — up to 1 fix pass each.
  // Catches leaked generator instructions and broken keyword insertions before
  // they publish. See auditMetaCopy for why this exists.
  for (const field of ['excerpt', 'metaDescription']) {
    let metaIssues = auditMetaCopy(article[field], row.keyword);
    if (metaIssues.length > 0) {
      console.log(`  ${field} audit: ${metaIssues.length} issue(s) found — fix pass...`);
      metaIssues.forEach(i => console.log(`    ⚠ ${i}`));
      article[field] = await fixMetaField(article[field], field, metaIssues, row.keyword);
      metaIssues = auditMetaCopy(article[field], row.keyword);
      if (metaIssues.length > 0) {
        console.warn(`  ${field} still has ${metaIssues.length} issue(s) after fix pass:`);
        metaIssues.forEach(i => console.warn(`    ⚠ ${i}`));
      } else {
        console.log(`  ${field} audit: clean after fix`);
      }
    }
  }

  // ── Link & anchor validation loop (up to 2 targeted fix passes)
  // Title and slug are corrected in place rather than sent through the fix
  // loop: they are short, the correction is mechanical, and leaving them to the
  // model risks another pass that changes them back. The sheet keyword is the
  // upstream source of "bridging finance" here, so this is the last line of
  // defence before it reaches a published URL.
  if (row.service === 'Bridging Finance') {
    if (/bridging finance/i.test(article.title)) {
      const before = article.title;
      article.title = article.title.replace(/bridging finance/gi, m => m[0] === 'B' ? 'Bridging Loans' : 'bridging loans');
      console.log(`  Title corrected: "${before}" → "${article.title}"`);
    }
    if (/bridging-finance/i.test(article.slug)) {
      const before = article.slug;
      article.slug = article.slug.replace(/bridging-finance/gi, 'bridging-loans');
      console.log(`  Slug corrected: "${before}" → "${article.slug}"`);
    }
    for (const field of ['metaTitle', 'metaDescription', 'excerpt']) {
      if (article[field] && /bridging finance/i.test(article[field])) {
        article[field] = article[field].replace(/bridging finance/gi, m => m[0] === 'B' ? 'Bridging loans' : 'bridging loans');
        console.log(`  ${field} corrected to "bridging loans"`);
      }
    }
  }

  let linkIssues = auditContentHtml(article.contentHtml, row.keyword);
  for (let attempt = 1; attempt <= 2 && linkIssues.length > 0; attempt++) {
    console.log(`  Link audit: ${linkIssues.length} issue(s) found — fix pass ${attempt}...`);
    linkIssues.forEach(i => console.log(`    ⚠ ${i}`));
    article.contentHtml = await fixContentIssues(article.contentHtml, linkIssues, {
      serviceUrl, chatUrl, keyword: row.keyword, locationLinksText, relatedBlogsText,
    });
    linkIssues = auditContentHtml(article.contentHtml, row.keyword);
    console.log(`  After fix pass ${attempt}: ${linkIssues.length} issue(s) remaining`);
  }
  if (linkIssues.length > 0) {
    console.warn(`  Content still has ${linkIssues.length} issue(s) after fix passes — seo-audit will flag:`);
    linkIssues.forEach(i => console.warn(`    ⚠ ${i}`));
  } else {
    console.log(`  Link audit: clean`);
  }

  return article;
}

// ─── Meta-copy audit — catches leaked generator instructions and broken
// keyword insertions in excerpt/metaDescription before they publish. Both
// fields are shown as raw, unescaped text on listing cards, in Google
// results and in social posts — unlike contentHtml there is no HTML tag to
// visually flag a mistake, so a leak here is invisible until a human reads
// it. Found live on boxxfinance.co.uk 2026-08-17 (see git history), hence
// this check.
function auditMetaCopy(text, keyword) {
  const issues = [];
  if (!text) return issues;

  if (/\bservice page\b/i.test(text))
    issues.push('References "the service page" directly — reads as a leaked generator instruction, not visitor-facing copy. Rewrite as natural prose with no meta-reference to page structure.');

  if (/\bthis (page|article)\b/i.test(text))
    issues.push('References "this page/article" — meta-language that should never appear in an excerpt or description. Rewrite as natural prose.');

  if (/\blink(?:ing)? to\b/i.test(text))
    issues.push('Contains "link to" — reads as an instruction to a generator rather than reader-facing copy. Rewrite as natural prose with no instruction-like phrasing.');

  if (/\babout how (do|does|can|should|would|is|are)\b/i.test(text))
    issues.push('Contains an ungrammatical "about how do/does/can..." construction — a broken keyword insertion. Rewrite as a natural, grammatical sentence.');

  if (keyword && keyword.split(/\s+/).length >= 4 && text.toLowerCase().includes(keyword.toLowerCase().trim()))
    issues.push(`Contains the raw target keyword phrase "${keyword}" pasted in verbatim — reword it into a natural sentence instead of inserting the keyword directly.`);

  return issues;
}

// Regenerates a single short meta field (excerpt or metaDescription) that
// failed auditMetaCopy, given the specific issues found. Kept separate from
// fixContentIssues below since this operates on a sentence, not an HTML body.
async function fixMetaField(text, fieldName, issues, keyword) {
  const issueList = issues.map((msg, i) => `${i + 1}. ${msg}`).join('\n');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: 'You are a UK SEO copy editor. Rewrite the given text to fix only the specific issues listed, keeping the same length and meaning as closely as possible. Return ONLY the corrected text, no quotes, no explanation, no markdown.',
      },
      {
        role: 'user',
        content: `Field: ${fieldName}\nTarget keyword: ${keyword}\n\nIssues to fix:\n${issueList}\n\nOriginal text:\n${text}`,
      },
    ],
  });
  return response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}

// ─── Inline content audit — same rules as seo-audit.js ──────────────────────
function auditContentHtml(html, keyword) {
  const issues = [];

  // Keyword-stuffed anchors. The CTA templates used to interpolate the target
  // keyword directly, which reads fine when the keyword is a product name and
  // breaks badly when it is a descriptive phrase. Live example:
  //   keyword "bridging loan borrowers over 70"
  //   → "get a bridging loan borrowers over 70 quote"
  //   → "find a bridging loan borrowers over 70 broker"
  // Detect the shape rather than the length: a LONG keyword wrapped in extra
  // words. Plain length is a bad proxy — "current bridging loan rates in the
  // UK" is seven words and perfectly readable.
  if (keyword && keyword.split(/\s+/).length >= 4) {
    const kw = keyword.toLowerCase().trim();
    for (const m of html.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)) {
      const anchor = m[1].trim();
      const a = anchor.toLowerCase();
      if (a !== kw && a.includes(kw)) {
        issues.push(`Anchor "${anchor}" wraps the full target keyword in filler — write a natural 2-5 word anchor around the product name instead (e.g. "get a bridging loan quote")`);
      }
    }
  }

  const FORBIDDEN_ANCHORS = [
    'speak to a commercial finance specialist',
    'speak to a specialist',
    'click here', 'read more', 'learn more', 'find out more',
    'contact us', 'get in touch', 'our services', 'our page',
    'this page', 'this article',
  ];
  for (const bad of FORBIDDEN_ANCHORS) {
    if (new RegExp(`>${bad}<`, 'i').test(html))
      issues.push(`Forbidden anchor text "${bad}" — replace with a keyword-rich alternative`);
  }

  if (/>[Gg]et expert [^<]{5,60} advice</.test(html))
    issues.push('Generic "get expert X advice" anchor found — use a keyword-rich product anchor instead');

  if (/href=['"]https?:\/\/boxxfinance\.co\.uk\/#about['"]/i.test(html))
    issues.push('Link to /#about found — remove this link entirely (brand-name anchor adds no SEO value)');

  const firstParaMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (firstParaMatch && !/href=/i.test(firstParaMatch[1]))
    issues.push('Opening paragraph contains no link — add a link to the service page using keyword-rich anchor text');

  // Link COUNT checks. Without these the audit only ever required a single
  // link in the opening paragraph, so an article with exactly one link passed
  // as "clean" while the prompt asked for a dozen. That is exactly what
  // happened to bridging-loan-maximum-term (1 link, audit clean) — the anchor
  // quality rules above were all satisfied because there was almost nothing to
  // judge. Quality rules cannot substitute for a presence check.
  const hrefs = [...html.matchAll(/href=['"]([^'"]+)['"]/g)].map(m => m[1]);

  if (hrefs.length < MIN_TOTAL_LINKS)
    issues.push(`Only ${hrefs.length} link(s) in the article — needs at least ${MIN_TOTAL_LINKS} (3+ service page, 1 funding-solutions hub, related blog and location links, plus mid-article and closing CTAs)`);

  const serviceLinks = hrefs.filter(h => /\/funding-solutions\/[a-z-]+/i.test(h)).length;
  if (serviceLinks < MIN_SERVICE_LINKS)
    issues.push(`Only ${serviceLinks} service-page link(s) — needs at least ${MIN_SERVICE_LINKS}, each with distinct keyword-rich anchor text`);

  if (!hrefs.some(h => /\/funding-solutions\/?$/i.test(h)))
    issues.push('No link to the /funding-solutions hub — add one near the end using descriptive 2-5 word anchor text');

  if (!hrefs.some(h => /\/chat-about-funding/i.test(h)))
    issues.push('No CTA link to /chat-about-funding — add mid-article and closing CTAs with keyword-rich anchors');

  // Terminology. The body rule in the prompt works, but it only ever covered
  // body copy — bridging-finance-for-permitted-development shipped with
  // "Bridging Finance" in its title AND slug because the sheet supplied the
  // keyword "PD rights bridging finance UK" and nothing checked the output.
  // Body-level compliance is not enough when the title is the thing people and
  // search engines see first.
  if (/bridging finance/i.test(html))
    issues.push('Body uses "bridging finance" — rewrite as "bridging loans" or "short-term property finance"');

  // Structure checks. The same description-less schema that cost the links also
  // dropped four H2 sections and the entire FAQ block — bridging-loan-maximum-term
  // shipped as the only post in 101 with zero FAQ schema. The FAQ is what AI
  // answer engines quote, so its absence is a bigger loss than the links were.
  if (!/Frequently Asked Questions/i.test(html))
    issues.push('No "Frequently Asked Questions" section — add an H2 FAQ block with 5-7 Q&As matching faqSchema');

  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  if (h2Count < MIN_H2_SECTIONS)
    issues.push(`Only ${h2Count} H2 section(s) — needs at least ${MIN_H2_SECTIONS} including the FAQ`);

  return issues;
}

// ─── Ask the model to fix specific link/anchor issues in the HTML ─────────────
async function fixContentIssues(html, issues, { serviceUrl, chatUrl, keyword, locationLinksText, relatedBlogsText }) {
  const issueList = issues.map((msg, i) => `${i + 1}. ${msg}`).join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000,
    messages: [
      {
        role: 'system',
        content: `You are a UK SEO content editor. Fix only the specific issues listed. Do not change any other text, links, or structure.`,
      },
      {
        role: 'user',
        content: `Fix ONLY these issues in the article HTML. Change nothing else.

ISSUES TO FIX:
${issueList}

RULES:
- Fix only what is listed — leave every other word, link, and tag exactly as it is
- Do not invent URLs — use only the URLs listed below
- CTA links go to: ${chatUrl} — use keyword-rich anchors like "compare ${keyword} rates", "arrange ${keyword} today", "get a ${keyword} quote", or "find a ${keyword} broker"
- Use single quotes inside HTML attributes
- Return ONLY the corrected HTML — no JSON, no markdown, no commentary

AVAILABLE URLS:
Service page: ${serviceUrl}
CTA page: ${chatUrl}
${locationLinksText}
${relatedBlogsText}

ARTICLE HTML:
${html}`,
      },
    ],
  });

  let fixed = (response.choices[0].message.content || '').trim()
    .replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return (fixed && fixed.includes('<')) ? fixed : html;
}

// ─── Expand an article that came back under the word-count minimum ───────────
async function expandArticleHtml(html, keyword, currentWords) {
  // A jump straight to GENERATION_MIN_WORDS can be a big ask in one pass at
  // the current 2000+ word target, so aim for meaningful, achievable
  // progress each call rather than the full gap every time.
  const passTarget = Math.max(GENERATION_MIN_WORDS, currentWords + 800);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 12000,
    messages: [
      {
        role: 'system',
        content: `You are an experienced UK commercial finance broker writing for Boxx Finance. Write in a natural, human, UK tone. Never use em dashes. Never use generic AI phrases. Never use markdown, backticks, or code fences.`,
      },
      {
        role: 'user',
        content: `The article below is ${currentWords} words. The minimum is ${GENERATION_MIN_WORDS} words. Expand it to at least ${passTarget} words by deepening the existing sections: add practical detail, realistic UK figures, concrete steps, and broker insight on "${keyword}".

RULES:
- Keep every existing HTML tag, link, href and attribute exactly as it is — do not remove or rewrite any <a> link
- Do not add new <h2> sections and do not change any heading text
- Do not change the Frequently Asked Questions section at all
- Do not add an <h1> tag
- Use only single quotes inside HTML attributes
- Short paragraphs — no paragraph longer than 4 sentences
- Return ONLY the full expanded HTML — no JSON, no markdown, no commentary

ARTICLE HTML:
${html}`,
      },
    ],
  });

  let expanded = (response.choices[0].message.content || '').trim();
  expanded = expanded.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!expanded || !expanded.includes('<')) {
    console.warn('  Expansion returned non-HTML — keeping current version');
    return html;
  }
  if (wordCount(expanded) <= currentWords) {
    console.warn('  Expansion did not grow the article — keeping current version');
    return html;
  }
  return expanded;
}

// ─── YouTube: find a relevant educational video ───────────────────────────────
async function findYouTubeVideo(keyword) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('  No YOUTUBE_API_KEY set — skipping video embed');
    return null;
  }

  const EXCLUDED_TERMS = ['boxx', 'rival', 'competitor']; // extend as needed

  const query = encodeURIComponent(`${keyword} UK explained`);
  const url = [
    'https://www.googleapis.com/youtube/v3/search',
    `?part=snippet&q=${query}&type=video`,
    '&relevanceLanguage=en&regionCode=GB',
    '&videoDuration=medium&videoEmbeddable=true',
    '&maxResults=8',
    `&key=${apiKey}`,
  ].join('');

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  YouTube API error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const video = data.items.find((item) => {
    const channel = (item.snippet.channelTitle || '').toLowerCase();
    return !EXCLUDED_TERMS.some((t) => channel.includes(t));
  });

  return video ? video.id.videoId : null;
}

// ─── Pexels: fetch a relevant hero image ─────────────────────────────────────
async function fetchPexelsImage(keyword, service) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log('  No PEXELS_API_KEY set — skipping hero image');
    return null;
  }

  console.log(`  Searching Pexels for: ${keyword}`);

  const trySearch = async (query) => {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return null;
    // Filter out photos that likely show non-UK currency (avoid generic money shots)
    const filtered = data.photos.filter(p => {
      const desc = ((p.alt || '') + ' ' + (p.photographer || '')).toLowerCase();
      return !desc.match(/\$|dollar|euro|€|usd|eur/i);
    });
    return filtered[0] || data.photos[0];
  };

  // Service → curated image query mapping.
  // Deliberately avoids generic "money/cash/coins" searches that return
  // US dollars and euros. Uses professional UK business context instead.
  const serviceKey = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  const SERVICE_QUERIES = {
    'bridging-finance':    'UK residential property house exterior',
    'development-finance': 'UK property construction architect',
    'commercial-mortgages':'UK commercial property building office',
    'commercial-mortgage': 'UK commercial property building office',
    'invoice-finance':     'UK business paperwork accounts desk',
    'asset-finance':       'UK industrial machinery factory equipment',
    'working-capital':     'UK business team meeting growth',
    'trade-finance':       'UK port shipping logistics supply chain',
    'cashflow-finance':    'UK business professional office meeting',
    'mezzanine-finance':   'UK city financial district skyline',
    'structured-finance':  'UK city London financial district',
    'business-loans':      'UK small business entrepreneur office',
  };
  const primaryQuery = SERVICE_QUERIES[serviceKey] || 'UK business professionals meeting office';

  const photo = (await trySearch(primaryQuery))
             || (await trySearch('UK business professionals office'))
             || (await trySearch('British business meeting'));

  if (!photo) {
    console.log('  No Pexels image found — will use pillar image fallback');
    return null;
  }

  console.log(`  Pexels image found: ${photo.url}`);
  const imgRes = await fetch(photo.src.large2x || photo.src.large);
  if (!imgRes.ok) throw new Error(`Failed to download Pexels image: ${imgRes.status}`);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`  Image downloaded (${Math.round(buffer.length / 1024)} KB)`);
  return buffer;
}

async function uploadHeroImage(slug, imageBuffer) {
  // Convert to WebP for better performance (typically 25-35% smaller than JPEG)
  const webpBuffer = await sharp(imageBuffer)
    .webp({ quality: 85 })
    .toBuffer();

  const imagePath = `public/images/blog/${slug}.webp`;
  let existingSha;

  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    });
    existingSha = data.sha;
  } catch {
    // File doesn't exist yet — that's expected
  }

  await octokit.repos.createOrUpdateFileContents({
    owner:   GITHUB_OWNER,
    repo:    GITHUB_REPO,
    path:    imagePath,
    message: `Add hero image: ${slug}`,
    content: webpBuffer.toString('base64'),
    branch:  'main',
    ...(existingSha && { sha: existingSha }),
  });

  console.log(`  Hero image uploaded: ${imagePath} (WebP, ${Math.round(webpBuffer.length / 1024)}KB)`);
  return `/images/blog/${slug}.webp`;
}

// ─── Get current blogPosts.json from GitHub ───────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
  });

  // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  const content = Buffer.from(raw, 'base64').toString('utf8');
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

// ─── Auto-queue social posts in LinkedIn_Queue ────────────────────────────────
async function addToLinkedInQueue(sheets, row, articleTitle, finalSlug, fullUrl) {
  const today = new Date().toISOString().split('T')[0];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A:R',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        Date.now(),                      // A  id
        today,                           // B  publishDate
        row.service,                     // C  service
        row.keyword,                     // D  keyword
        row.title || articleTitle,       // E  title
        finalSlug,                       // F  slug
        fullUrl,                         // G  url
        row.author || 'Mark Higgins',    // H  author
        'pending',                       // I  liStatus
        '',                              // J  liPostText
        '',                              // K  liFirstComment
        '',                              // L  notes
        'pending',                       // M  fbStatus
        '',                              // N  fbPostText
        '',                              // O  fbPostId
        'pending',                       // P  igStatus
        '',                              // Q  igPostText
        '',                              // R  igPostId
        'pending',                       // S  pinterestStatus
        '',                              // T  pinterestDescription
        '',                              // U  pinterestPinId
        'pending',                       // V  reelStatus
        '',                              // W  reelId
        'pending',                       // X  tiktokStatus
        '',                              // Y  tiktokVideoId
      ]],
    },
  });

  console.log(`LinkedIn_Queue row added — liStatus, fbStatus, igStatus, pinterestStatus, reelStatus, tiktokStatus = pending`);
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

// ─── Humanizer: remove AI writing patterns via Claude ─────────────────────────
// Applies the 30 patterns from github.com/blader/humanizer to make GPT-4o
// output read as genuinely written rather than AI-generated.
async function humanizeContent(html, keyword, author) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  No ANTHROPIC_API_KEY — skipping humanizer');
    return html;
  }

  // Never truncate the article going into the rewrite — a substring cap here
  // used to silently drop the tail of anything over 12,000 chars. A 1200+
  // word article is ~10-14k chars of HTML, so skip rather than clip.
  if (html.length > 24000) {
    console.warn(`  Article HTML is ${html.length} chars — too long to humanize safely, skipping`);
    return html;
  }

  const originalWords = wordCount(html);

  const htmlPrompt = `You are editing HTML content for a UK commercial finance article written by ${author}.

Rewrite ONLY the visible text within the HTML tags below. Do NOT change any HTML tags, attributes, href values, class names, or structure. Preserve all <a>, <h2>, <h3>, <p>, <ul>, <li>, <dl>, <dt>, <dd> tags exactly.

Apply these changes to the visible text only:
- Replace overused AI words: tapestry, landscape, pivotal, underscore, delve, comprehensive, robust, leverage, utilise, multifaceted, nuanced, "in today's fast-paced"
- Remove em dashes (—) — rewrite the sentence instead
- Rewrite excessive hedging phrases as direct statements
- Rewrite passive voice as active voice where possible
- Replace filler phrases with direct wording: "in order to", "due to the fact that", "it should be noted", "it is worth noting"
- Rewrite forced rule-of-three structures
- Keep all facts, links, and HTML structure identical
- Do NOT shorten the article: rewrite weak phrasing in place rather than deleting sentences — the output must stay within 10% of the input's word count
- UK spelling throughout
- Do NOT wrap the output in markdown code fences or backticks (no \`\`\`html, no \`\`\`) — return raw HTML only
- Return ONLY the modified HTML, nothing else

HTML TO REWRITE:
${html}`;

  try {
    const htmlResponse = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 12000,
      messages:   [{ role: 'user', content: htmlPrompt }],
    });

    let humanizedHtml = htmlResponse.content[0].type === 'text' ? htmlResponse.content[0].text.trim() : '';
    // Defensive cleanup: strip markdown code fences the model sometimes adds
    // despite being told not to (this is what produced the literal "```html"
    // visible at the top of published articles like bridging-loan-calculator-uk).
    humanizedHtml = humanizedHtml.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();

    if (!humanizedHtml || !humanizedHtml.includes('<')) {
      console.warn('  Humanizer returned non-HTML — using original');
      return html;
    }

    // The humanizer trims filler, but with no floor it was compressing
    // articles by ~150 words on average. Allow light trimming only.
    const humanizedWords = wordCount(humanizedHtml);
    if (humanizedWords < originalWords * 0.9) {
      console.warn(`  Humanizer shrank the article ${originalWords} → ${humanizedWords} words — using original`);
      return html;
    }

    console.log(`  ✅ Content humanized (${originalWords} → ${humanizedWords} words)`);
    return humanizedHtml;

  } catch (err) {
    console.warn(`  Humanizer failed (non-fatal): ${err.message}`);
    return html;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Boxx Content Engine: Blog Publisher ===');
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  const candidates = await getScheduledRow(sheets);
  if (candidates.length === 0) {
    // Unlike the reactive news publisher, where finding nothing is normal,
    // this queue is scheduled in advance. At 2 posts/day an empty queue means
    // it has been consumed and needs topping up — a real problem. Returning 0
    // here made the run green and indistinguishable from a healthy day, which
    // is how a whole morning passed with no post and no signal.
    reportNothingPublished(
      'No scheduled blog rows are eligible today.',
      'The ContentEngine queue has run dry, or every remaining row is dated in the future.',
    );
  }
  console.log(`${candidates.length} scheduled row(s) eligible today`);

  console.log('Fetching current blogPosts.json from GitHub...');
  const { sha, posts } = await getBlogPostsFile();
  console.log(`Current file has ${posts.length} posts, SHA: ${sha}`);

  // Skip anything that would duplicate what is already published. At 2
  // posts/day this is what keeps the queue from cannibalising itself.
  let row = null;
  for (const candidate of candidates.slice(0, 8)) {
    const dup = await checkDuplicateCoverage(candidate, posts);
    if (!dup.isDuplicate) { row = candidate; break; }
    console.log(`  ✗ Row ${candidate.rowIndex} "${candidate.keyword || candidate.title}" — duplicates ${dup.duplicateOf}: ${dup.reason}`);
    await markRowDuplicate(sheets, candidate.rowIndex, dup.duplicateOf);
  }

  if (!row) {
    reportNothingPublished(
      'Every eligible row duplicates existing coverage.',
      `${candidates.length} row(s) were checked and marked "duplicate" in the sheet. The queue needs genuinely new topics — see src/data/contentGapTopics.json and the Add Competitor-Gap Topics workflow.`,
    );
  }
  console.log(`Publishing row ${row.rowIndex}: ${row.keyword || row.title}`);

  const locationLinks = await getPublishedLocations(sheets, row.service);
  console.log(`Found ${locationLinks.length} published location pages for ${row.service}`);

  const relatedBlogs = await getPublishedBlogs(sheets, row.service);
  console.log(`Found ${relatedBlogs.length} related published blogs for ${row.service}`);

  // blogPosts.json was already fetched above for the duplicate check.
  const slug = row.slug;
  const existingPost = posts.find(p => p.slug === slug);
  if (existingPost) {
    console.log(`Slug "${slug}" already exists — marking sheet row as published and skipping generation.`);
    await updateSheetRow(sheets, row.rowIndex, slug, `https://boxxfinance.co.uk/insights/${slug}`, existingPost.publishedAt || new Date().toISOString());
    return;
  }

  const article = await generateArticle(row, locationLinks, relatedBlogs);
  console.log(`Article generated: ${article.title}`);

  // ── Humanize: strip AI writing patterns via Claude ────────────────────────
  console.log('Humanizing content...');
  article.contentHtml = await humanizeContent(
    article.contentHtml,
    row.keyword,
    row.author || 'Mark Higgins'
  );

  // Final word-count gate: if humanizing left the article under the audit
  // target, run one more expansion pass on the final HTML before publishing.
  let finalWords = wordCount(article.contentHtml);
  if (finalWords < TARGET_WORDS) {
    console.log(`Final article is ${finalWords} words — running post-humanize expansion...`);
    article.contentHtml = await expandArticleHtml(article.contentHtml, row.keyword, finalWords);
    finalWords = wordCount(article.contentHtml);
  }
  console.log(`Final word count: ${finalWords}${finalWords < TARGET_WORDS ? ` (still below ${TARGET_WORDS} — seo-audit will WARN)` : ' ✅'}`);

  // Self-healing guard against the raw-keyword title bug. First attempt
  // (this session, commit e1c675a) only checked row.title in isolation —
  // missed every case where the SHEET'S title cell was blank and rawTitle
  // fell through to article.title (the model's own generated title)
  // instead, which is exactly what happened with GSC-content-gap keywords
  // that are themselves ungrammatical query fragments ("no running water
  // uk", "derelict property uk") — the model sometimes just echoes the
  // fragment back rather than writing a real headline. Checking rawTitle
  // AFTER the row.title||article.title fallback catches the bug regardless
  // of which source produced it. Mechanical Title Case isn't a real fix for
  // an ungrammatical fragment either — "No Running Water Uk" capitalized is
  // still not English — so this now asks the model for a proper headline,
  // falling back to toTitle() only if that call fails.
  let rawTitle = row.title || article.title;
  if (row.keyword && rawTitle && rawTitle.trim().toLowerCase() === row.keyword.trim().toLowerCase()) {
    console.log(`  ⚠ Title is the raw keyword, not a headline ("${rawTitle}") — rewriting before publish.`);
    try {
      const fixResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Write a natural, grammatical UK blog headline (under 70 characters, no quotation marks) for an article targeting this search phrase: "${row.keyword}". The phrase itself is a raw search query fragment, not a sentence — do not just capitalize it, write an actual headline a person would title an article with. Name the product as "bridging loan" or "bridging loans" where relevant, never "bridging finance". Return ONLY the headline, nothing else.`,
        }],
      });
      const rewritten = fixResponse.content[0]?.type === 'text' ? fixResponse.content[0].text.trim().replace(/^["']|["']$/g, '') : '';
      rawTitle = rewritten || toTitle(row.keyword);
    } catch (err) {
      console.warn(`  Title rewrite call failed (${err.message}) — falling back to Title Case`);
      rawTitle = toTitle(row.keyword);
    }
    console.log(`  → "${rawTitle}"`);
    row.title = rawTitle;
  }

  // Ensure question-style titles end with ?
  const questionRe = /^(what|how|why|when|where|who|which|can|should|do|does|is|are|will|would|could)\s/i;
  const finalTitle = questionRe.test(rawTitle) && !rawTitle.trim().endsWith('?')
    ? rawTitle.trim() + '?'
    : rawTitle;
  if (finalTitle !== rawTitle) console.log(`  Title updated: "${rawTitle}" → "${finalTitle}"`);

  const finalSlug = slug || article.slug;
  const url = `/insights/${finalSlug}`;
  const publishedAt = new Date().toISOString();
  const fullUrl = `https://boxxfinance.co.uk${url}`;

  // ── YouTube embed disabled (2026-07) — third-party videos sent readers to
  // other creators' brands with no SEO credit (no VideoObject schema). Holding
  // for a small set of Boxx-owned bridging loan videos to reuse across posts
  // instead of a per-post third-party search.
  const contentHtml = article.contentHtml;
  let videoId = null;

  // ── Hero image ────────────────────────────────────────────────────────────
  // Bridging posts render from the curated pool (heroForPost/pickHero), so a
  // per-slug Pexels fetch would only create a near-duplicate file that is never
  // shown — the root cause of dozens of cards sharing the same stock photo.
  // Assign a pool image directly; only non-bridging posts fetch their own.
  let heroImagePath = null;
  if (isBridgingService(row.service)) {
    heroImagePath = pickBridgingHero(finalSlug);
    console.log(`  Bridging post — using curated pool image ${heroImagePath} (no Pexels fetch)`);
  } else {
    console.log('Fetching hero image from Pexels...');
    try {
      const imageBuffer = await fetchPexelsImage(row.keyword, row.service);
      if (imageBuffer) {
        heroImagePath = await uploadHeroImage(finalSlug, imageBuffer);
      }
    } catch (err) {
      console.warn(`  Hero image fetch failed (non-fatal): ${err.message}`);
    }
  }

  const authorEmails = {
    'Mark Higgins': 'mark@boxxfinance.co.uk',
    'Tara Jameson': 'tara@boxxfinance.co.uk',
  };

  const newPost = {
    id: Date.now(),
    status: 'published',
    slug: finalSlug,
    url: url,
    title: finalTitle,
    excerpt: article.excerpt,
    // Strip any brand suffix the model adds anyway — SEO.jsx appends the brand,
    // so a baked-in suffix renders a doubled "| Boxx ... | Boxx ..." title tag
    metaTitle: (row.metaTitle || article.metaTitle || '')
      .replace(/(\s*\|\s*Boxx Finance)+\s*$/i, '').trim(),
    metaDescription: row.metaDescription || article.metaDescription,
    keywords: Array.isArray(article.secondaryKeywords)
      ? article.secondaryKeywords.join(', ')
      : (article.secondaryKeywords || row.keyword),
    date: row.publishDate,
    publishedAt,
    author: row.author || 'Mark Higgins',
    authorEmail: authorEmails[row.author] || 'mark@boxxfinance.co.uk',
    service: row.service || '',
    heroImage: heroImagePath || getPillarImage(row.service),
    videoId: videoId || null,
    schema: article.faqSchema || null,
    relatedLocationUrls: locationLinks.map(l => {
      const path = typeof l === 'string' ? l : l.url;
      return path.startsWith('http') ? path : `https://boxxfinance.co.uk${path}`;
    }),
    relatedBlogUrls: relatedBlogs.map(b => b.url),
    content: contentHtml,
    // Social publishing flags — each platform flips its flag to true after posting
    liPosted:        false,
    fbPosted:        false,
    igPosted:        false,
    pinterestPosted: false,
    reelPosted:      false,
  };

  posts.push(newPost);
  await pushBlogPostsFile(posts, sha, finalSlug);
  await updateSheetRow(sheets, row.rowIndex, finalSlug, fullUrl, publishedAt);
  // Social publishers now read directly from blogPosts.json — no queue needed

  console.log('=== Done! ===');
  console.log(`Published: ${fullUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
