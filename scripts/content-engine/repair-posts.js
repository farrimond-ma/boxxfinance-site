/**
 * Repair published posts that fail the structural audit.
 *
 * Why this exists: the structured-outputs migration shipped ARTICLE_SCHEMA with
 * no field descriptions. Under structured outputs the schema constrains
 * decoding and competes with the prose prompt, so the model satisfied the
 * schema and quietly dropped whatever the schema did not demand — links first,
 * then four H2 sections and the entire FAQ block. Two posts published in that
 * window:
 *
 *   bridging-loan-maximum-term              1 link,  4 H2, 0 FAQ Q&As
 *   bridging-finance-for-permitted-development  11 links, 4 H2, 0 FAQ Q&As
 *
 * The prose in both is fine (~1615 words). What is missing is structural, so
 * this repairs rather than rewrites: it keeps the existing body copy and asks
 * the model to add the missing sections, the FAQ block, and any missing links.
 * That preserves indexed content and costs one call per post instead of a full
 * regeneration.
 *
 * Run: node repair-posts.js [--dry-run] [--slug=a,b]
 *      With no --slug it repairs every published post that fails the audit.
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createOpenAICompatClient } = require('./lib/anthropic-openai-shim');
const { parseModelJson, logJsonFailure } = require('./lib/parse-model-json');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';
const SITE_URL     = 'https://boxxfinance.co.uk';

const MIN_TOTAL_LINKS = 4;
const MIN_H2_SECTIONS = 6;
const MIN_FAQ_QAS     = 5;

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const openai  = createOpenAICompatClient({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same shape as ARTICLE_SCHEMA's repaired fields, with the descriptions that
// were missing the first time — they are the actual fix, not documentation.
const REPAIR_SCHEMA = {
  type: 'object',
  properties: {
    contentHtml: { type: 'string', description:
      'The COMPLETE repaired article body as valid HTML. Preserve the existing prose verbatim wherever it already meets the requirements — ' +
      'this is a repair, not a rewrite. Add only what is missing. ' +
      'MUST end with a "Frequently Asked Questions" H2 section containing the same 5-7 Q&As as faqSchema. ' +
      'MUST have at least 6 H2 sections covering: what it means in practice, how it works, typical scenarios, ' +
      'what lenders look for, common mistakes, alternatives or comparisons, and a summary. ' +
      'MUST contain at least 4 internal links: 1+ to the service page (one of them in the opening paragraph), ' +
      'one to /funding-solutions near the end, and mid-article plus closing CTAs to /chat-about-funding. ' +
      'Anchor text is keyword-rich 2-5 words — NEVER "click here", "read more", "learn more", "contact us", "get in touch", or "speak to a specialist". ' +
      'Use single quotes for HTML attribute values. Use "bridging loans", never "bridging finance", in body copy.' },
    faqSchema: {
      type: 'object',
      description: 'FAQPage structured data with 5-7 Q&A pairs — never empty. This is what AI answer engines quote.',
      properties: {
        '@type': { type: 'string', description: 'Always the literal string "FAQPage".' },
        mainEntity: {
          type: 'array',
          description: '5-7 items matching the FAQ section in contentHtml.',
          items: {
            type: 'object',
            properties: {
              '@type': { type: 'string', description: 'Always the literal string "Question".' },
              name:    { type: 'string', description: 'The question as a UK borrower would search it.' },
              acceptedAnswer: {
                type: 'object',
                properties: {
                  '@type': { type: 'string', description: 'Always the literal string "Answer".' },
                  text:    { type: 'string', description: 'A direct 40-70 word answer. No hedging.' },
                },
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
  required: ['contentHtml', 'faqSchema'],
  additionalProperties: false,
};

// Mirrors auditContentHtml in publish-blog.js. Kept deliberately narrow: this
// script only repairs STRUCTURAL gaps, so it does not re-litigate anchor
// wording in older posts that are otherwise healthy.
function auditPost(post) {
  const html = post.content || '';
  const issues = [];
  const hrefs = [...html.matchAll(/href=['"]([^'"]+)['"]/g)].map(m => m[1]);
  const h2 = (html.match(/<h2[^>]*>/gi) || []).length;
  const faqQas = post.schema?.mainEntity?.length || 0;

  if (hrefs.length < MIN_TOTAL_LINKS)
    issues.push(`only ${hrefs.length} internal link(s), needs ${MIN_TOTAL_LINKS}+`);
  if (!hrefs.some(h => /\/funding-solutions\/?$/i.test(h)))
    issues.push('no link to the /funding-solutions hub');
  if (!hrefs.some(h => /\/chat-about-funding/i.test(h)))
    issues.push('no CTA link to /chat-about-funding');
  if (!/Frequently Asked Questions/i.test(html))
    issues.push('no "Frequently Asked Questions" section in the body');
  if (h2 < MIN_H2_SECTIONS)
    issues.push(`only ${h2} H2 section(s), needs ${MIN_H2_SECTIONS}+`);
  if (faqQas < MIN_FAQ_QAS)
    issues.push(`only ${faqQas} FAQ schema Q&A(s), needs ${MIN_FAQ_QAS}+`);

  // Terminology in prose. terminology-sweep.js handles titles and keyword
  // lists mechanically, but body copy cannot be fixed by substitution:
  // "bridging finance" is a mass noun, "bridging loans" is plural, so the
  // sentences need rewriting rather than a token swap. That is this path's job.
  const prose = html.replace(/<[^>]+>/g, ' ');
  const termHits = (prose.match(/bridging finance/gi) || []).length;
  if (termHits)
    issues.push(`uses "bridging finance" ${termHits} time(s) in body prose — rewrite the sentences to use "bridging loans" with correct plural agreement (not a find-and-replace: "bridging loans is" and "bridging loans are a short-term loan" are both wrong)`);

  const faqProse = (post.schema?.mainEntity || [])
    .map(qa => `${qa.name || ''} ${qa.acceptedAnswer?.text || ''}`).join(' ');
  if (/bridging finance/i.test(faqProse))
    issues.push('FAQ schema uses "bridging finance" — rewrite those questions and answers with correct plural agreement');

  return issues;
}

async function repairPost(post, issues) {
  const serviceSlug = /bridging/i.test(post.service || post.slug) ? 'bridging-loans' : 'business-loans';
  const serviceUrl = `${SITE_URL}/funding-solutions/${serviceSlug}`;
  const chatUrl = `${SITE_URL}/chat-about-funding/${serviceSlug}`;
  const related = [...(post.relatedBlogUrls || []), ...(post.relatedLocationUrls || [])];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 16000,
    response_format: { json_schema: { schema: REPAIR_SCHEMA } },
    messages: [
      {
        role: 'system',
        content: 'You are a UK commercial finance copywriter repairing a published article. ' +
          'Preserve the existing prose wherever it already meets the requirements — add what is missing, do not rewrite what works.',
      },
      {
        role: 'user',
        content:
          `Repair this published article. It has these specific problems:\n${issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}\n\n` +
          `Title: ${post.title}\n` +
          `Primary keyword: ${post.keywords || post.title}\n` +
          `Service page: ${serviceUrl}\n` +
          `Chat/CTA page: ${chatUrl}\n` +
          `Funding hub: ${SITE_URL}/funding-solutions\n` +
          (related.length ? `Related pages to link naturally in the body:\n${related.map(u => `  ${u}`).join('\n')}\n` : '') +
          `\nExisting article HTML:\n${post.content}\n\n` +
          `Return the complete repaired contentHtml and a full faqSchema. Keep every paragraph that is already good.`,
      },
    ],
  });

  const raw = response.choices[0].message.content;
  return parseModelJson(raw, { label: `repair for ${post.slug}` });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const slugArg = (process.argv.find(a => a.startsWith('--slug=')) || '').replace('--slug=', '');
  const wanted = slugArg ? slugArg.split(',').map(s => s.trim()).filter(Boolean) : null;
  // Batch limit. ~73 posts fail the audit; running them all in one go is a long
  // job and a large single commit. Default to 10 so runs stay reviewable.
  const limitArg = (process.argv.find(a => a.startsWith('--limit=')) || '').replace('--limit=', '');
  const limit = limitArg ? Number(limitArg) : (wanted ? wanted.length : 10);

  console.log(`Repair posts${isDryRun ? ' [DRY RUN]' : ''}${wanted ? ` — targeting: ${wanted.join(', ')}` : ' — all failing posts'}\n`);

  const { data: file } = await octokit.repos.getContent({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
  });

  // blogPosts.json is ~1.33MB. The contents API silently returns an EMPTY
  // `content` field for anything over 1MB — it still gives you the sha and a
  // 200, so the only symptom is JSON.parse("") throwing "Unexpected end of
  // JSON input". Fall back to the blob API, which has no such limit.
  // (publish-blog.js has handled this since it was written; this script
  // originally did not, and failed on its first run for exactly this reason.)
  const raw = file.content && file.encoding !== 'none'
    ? file.content
    : (await octokit.git.getBlob({
        owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: file.sha,
      })).data.content;

  const json = Buffer.from(raw, 'base64').toString('utf8');
  if (!json.trim()) {
    throw new Error(`${BLOG_FILE} came back empty from GitHub (sha ${file.sha}) — refusing to continue.`);
  }
  const posts = JSON.parse(json);
  console.log(`Loaded ${posts.length} posts from ${BLOG_FILE}\n`);

  const allFailing = posts
    .map((p, i) => ({ post: p, i, issues: auditPost(p) }))
    .filter(({ post, issues }) => {
      if (post.status && post.status !== 'published') return false;
      if (wanted) return wanted.includes(post.slug);
      return issues.length > 0;
    });

  // Worst first, so a limited batch fixes the most damaged posts.
  allFailing.sort((a, b) => b.issues.length - a.issues.length);
  const candidates = allFailing.slice(0, limit);
  if (allFailing.length > candidates.length) {
    console.log(`${allFailing.length} post(s) failing; repairing the ${candidates.length} worst this run (--limit to change).
`);
  }

  if (!candidates.length) {
    console.log('Nothing to repair — every targeted post passes the structural audit.');
    return;
  }

  console.log(`${candidates.length} post(s) to repair:\n`);
  for (const { post, issues } of candidates) {
    console.log(`  ${post.slug}`);
    issues.forEach(i => console.log(`     - ${i}`));
  }
  console.log('');

  if (isDryRun) {
    console.log('[DRY RUN] No changes written.');
    return;
  }

  let repaired = 0;
  for (const { post, i, issues } of candidates) {
    if (!issues.length) { console.log(`  ${post.slug}: already clean, skipping`); continue; }
    console.log(`Repairing ${post.slug}...`);
    try {
      const fixed = await repairPost(post, issues);
      posts[i].content = fixed.contentHtml;
      posts[i].schema = fixed.faqSchema;

      const after = auditPost(posts[i]);
      if (after.length) {
        console.warn(`  Still failing after repair — NOT saving this one:`);
        after.forEach(x => console.warn(`     - ${x}`));
        // Roll back so a partial repair never overwrites the live post.
        posts[i].content = post.content;
        posts[i].schema = post.schema;
        continue;
      }
      const links = [...fixed.contentHtml.matchAll(/href=['"]/g)].length;
      const h2 = (fixed.contentHtml.match(/<h2/gi) || []).length;
      console.log(`  repaired — ${links} links, ${h2} H2 sections, ${fixed.faqSchema.mainEntity.length} FAQ Q&As`);
      repaired++;
    } catch (err) {
      if (err.diagnostics) logJsonFailure(err); else console.error(`  ${post.slug} failed: ${err.message}`);
    }
  }

  if (!repaired) {
    console.log('\nNo posts were successfully repaired — nothing committed.');
    process.exit(1);
  }

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message: `content: repair ${repaired} post(s) — restore FAQ, sections and internal links`,
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
    sha: file.sha,
    branch: 'main',
  });
  console.log(`\nCommitted ${repaired} repaired post(s).`);
}

main().catch(err => { console.error('Repair run failed:', err); process.exit(1); });
