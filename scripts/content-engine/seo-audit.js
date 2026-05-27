require('dotenv').config();
const { Octokit } = require('@octokit/rest');

// ─── Config ───────────────────────────────────────────────────────────────────
const SITE_URL        = 'https://boxxfinance.co.uk';
const GITHUB_OWNER    = process.env.GITHUB_OWNER;
const GITHUB_REPO     = process.env.GITHUB_REPO;
const GH_TOKEN        = process.env.GH_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
const CRAWL_LIVE      = process.env.SEO_CRAWL_LIVE !== 'false'; // set to 'false' to skip HTTP checks

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wordCount(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0).length;
}

function issue(type, field, msg) {
  return { type, field, msg };
}

// ─── 1. Fetch blogPosts.json from GitHub ─────────────────────────────────────
async function getBlogPosts() {
  const octokit = new Octokit({ auth: GH_TOKEN });
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo:  GITHUB_REPO,
    path:  'src/data/blogPosts.json',
  });
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

// ─── 2. Data-layer audit (blogPosts.json) ────────────────────────────────────
function auditPostData(posts) {
  const published = posts.filter((p) => p && p.status === 'published');
  const findings  = [];

  for (const post of published) {
    const pf = [];

    // ── metaTitle
    if (!post.metaTitle)
      pf.push(issue('ERROR', 'metaTitle', 'Missing'));
    else if (post.metaTitle.length > 60)
      pf.push(issue('WARN', 'metaTitle', `Too long — ${post.metaTitle.length} chars (max 60)`));
    else if (post.metaTitle.length < 20)
      pf.push(issue('WARN', 'metaTitle', `Too short — ${post.metaTitle.length} chars (min 20)`));

    // ── metaDescription
    if (!post.metaDescription)
      pf.push(issue('ERROR', 'metaDescription', 'Missing'));
    else if (post.metaDescription.length > 160)
      pf.push(issue('WARN', 'metaDescription', `Too long — ${post.metaDescription.length} chars (max 160)`));
    else if (post.metaDescription.length < 100)
      pf.push(issue('WARN', 'metaDescription', `Too short — ${post.metaDescription.length} chars (min 100)`));

    // ── FAQ schema (critical for rich results + AEO)
    if (!post.schema)
      pf.push(issue('ERROR', 'schema', 'Missing FAQ schema — no rich results or LLM citation signal'));

    // ── Keywords
    if (!post.keywords)
      pf.push(issue('WARN', 'keywords', 'Missing keywords field'));

    // ── Excerpt
    if (!post.excerpt)
      pf.push(issue('WARN', 'excerpt', 'Missing excerpt'));

    // ── Content length
    const wc = wordCount(post.content);
    if (wc < 800)
      pf.push(issue('ERROR', 'content', `Too short — ${wc} words (min 800)`));
    else if (wc < 1200)
      pf.push(issue('WARN', 'content', `Thin content — ${wc} words (target 1200+)`));

    // ── AEO: direct-answer lede (first <p> should be a definitive answer, ≤80 words)
    const firstPara = (post.content || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstPara) {
      const firstParaText = firstPara[1].replace(/<[^>]+>/g, '').trim();
      const firstParaWords = firstParaText.split(/\s+/).length;
      if (firstParaWords > 80)
        pf.push(issue('WARN', 'aeo', `Opening paragraph is ${firstParaWords} words — AI models prefer a concise ≤80-word direct answer at the top`));
    }

    // ── AEO: FAQ section present in HTML
    if (!/<dl[\s>]/i.test(post.content || ''))
      pf.push(issue('WARN', 'aeo', 'No <dl> FAQ block found in content — FAQ schema requires a matching HTML section'));

    // ── Hero image
    if (!post.heroImage && !post.image)
      pf.push(issue('INFO', 'heroImage', 'No hero image — social sharing will use fallback'));

    // ── Slug sanity
    if (post.slug && /[A-Z\s]/.test(post.slug))
      pf.push(issue('ERROR', 'slug', `Slug contains uppercase or spaces: "${post.slug}"`));

    // ── Date
    if (!post.date || isNaN(new Date(post.date).getTime()))
      pf.push(issue('WARN', 'date', 'Missing or invalid date'));

    if (pf.length > 0) findings.push({ slug: post.slug, title: post.title, issues: pf });
  }

  return { total: published.length, findings };
}

// ─── 3. Live page crawl ───────────────────────────────────────────────────────
async function auditLivePage(url) {
  const pf = [];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BoxxFinance-SEOAudit/1.0' },
      signal:  AbortSignal.timeout(12000),
    });

    if (res.status !== 200) {
      pf.push(issue('ERROR', 'http', `HTTP ${res.status}`));
      return pf;
    }

    const html = await res.text();

    if (!/<title[^>]*>[^<]{5,}<\/title>/i.test(html))
      pf.push(issue('ERROR', 'title_tag', 'Missing or empty <title> tag'));

    if (!/<meta\s[^>]*name=['"]description['"]/i.test(html))
      pf.push(issue('ERROR', 'meta_desc', 'Missing <meta name="description">'));

    if (!/<link\s[^>]*rel=['"]canonical['"]/i.test(html))
      pf.push(issue('WARN', 'canonical', 'Missing <link rel="canonical">'));

    if (!/<script\s[^>]*type=['"]application\/ld\+json['"]/i.test(html))
      pf.push(issue('WARN', 'schema', 'No <script type="application/ld+json"> found'));

    if (!/<meta\s[^>]*property=['"]og:title['"]/i.test(html))
      pf.push(issue('WARN', 'og_title', 'Missing og:title'));

    if (!/<meta\s[^>]*property=['"]og:description['"]/i.test(html))
      pf.push(issue('WARN', 'og_desc', 'Missing og:description'));

    if (!/<meta\s[^>]*property=['"]og:image['"]/i.test(html))
      pf.push(issue('INFO', 'og_image', 'Missing og:image — social previews will be text-only'));

    if (!/<meta\s[^>]*property=['"]og:url['"]/i.test(html))
      pf.push(issue('WARN', 'og_url', 'Missing og:url'));

  } catch (err) {
    pf.push(issue('ERROR', 'fetch', `Fetch failed: ${err.message}`));
  }
  return pf;
}

// ─── 4. Sitemap audit ─────────────────────────────────────────────────────────
async function auditSitemap(publishedSlugs) {
  const pf = [];
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`, {
      headers: { 'User-Agent': 'BoxxFinance-SEOAudit/1.0' },
      signal:  AbortSignal.timeout(10000),
    });

    if (res.status !== 200) {
      pf.push(issue('ERROR', 'sitemap', `Sitemap returned HTTP ${res.status}`));
      return pf;
    }

    const xml = await res.text();
    if (!xml.includes('<urlset')) {
      pf.push(issue('ERROR', 'sitemap', 'Invalid sitemap — <urlset> not found'));
      return pf;
    }

    const missing = publishedSlugs.filter((s) => !xml.includes(`/insights/${s}`));
    if (missing.length > 0)
      missing.forEach((s) => pf.push(issue('WARN', 'sitemap', `Not in sitemap: /insights/${s}`)));
    else
      pf.push(issue('OK', 'sitemap', `All ${publishedSlugs.length} published posts present in sitemap`));

  } catch (err) {
    pf.push(issue('ERROR', 'sitemap', `Sitemap fetch failed: ${err.message}`));
  }
  return pf;
}

// ─── 5. Robots.txt audit ─────────────────────────────────────────────────────
async function auditRobots() {
  const pf = [];
  try {
    const res = await fetch(`${SITE_URL}/robots.txt`, { signal: AbortSignal.timeout(8000) });
    if (res.status !== 200) {
      pf.push(issue('ERROR', 'robots', `robots.txt returned HTTP ${res.status}`));
      return pf;
    }
    const txt = await res.text();
    if (!txt.toLowerCase().includes('sitemap:'))
      pf.push(issue('WARN', 'robots', 'robots.txt does not declare a Sitemap: directive'));
    if (txt.toLowerCase().includes('disallow: /insights'))
      pf.push(issue('ERROR', 'robots', 'robots.txt is blocking /insights — blog posts will not be indexed'));

  } catch (err) {
    pf.push(issue('WARN', 'robots', `robots.txt fetch failed: ${err.message}`));
  }
  return pf;
}

// ─── 6. SEO component audit (static checks against SEO.jsx) ──────────────────
function auditSEOComponent() {
  // These are known gaps in the current SEO.jsx — flagged for manual fix
  return [
    { type: 'WARN', field: 'og:url',   msg: 'SEO.jsx does not emit og:url — add <meta property="og:url" content={canonicalUrl} />' },
    { type: 'WARN', field: 'og:image', msg: 'SEO.jsx does not emit og:image — social shares will have no image preview' },
    { type: 'WARN', field: 'canonical', msg: 'SEO.jsx does not emit <link rel="canonical"> — duplicate content risk across query strings' },
  ];
}

// ─── Report formatting ────────────────────────────────────────────────────────
function icon(type) {
  return { ERROR: '🔴', WARN: '🟡', INFO: '🔵', OK: '✅' }[type] || '⚪';
}

function buildReport(dataAudit, liveFindings, sitemapIssues, robotsIssues, componentIssues) {
  const lines = [];
  const ts = new Date().toUTCString();

  const totalErrors = [
    ...dataAudit.findings.flatMap((f) => f.issues),
    ...liveFindings.flatMap((f) => f.issues),
    ...sitemapIssues,
    ...robotsIssues,
    ...componentIssues,
  ].filter((i) => i.type === 'ERROR').length;

  const totalWarns = [
    ...dataAudit.findings.flatMap((f) => f.issues),
    ...liveFindings.flatMap((f) => f.issues),
    ...sitemapIssues,
    ...robotsIssues,
    ...componentIssues,
  ].filter((i) => i.type === 'WARN').length;

  lines.push(`# Boxx Finance — SEO Audit Report`);
  lines.push(`**Run:** ${ts}`);
  lines.push(`**Posts audited:** ${dataAudit.total} published`);
  lines.push(`**Summary:** ${icon('ERROR')} ${totalErrors} errors · ${icon('WARN')} ${totalWarns} warnings\n`);

  // ── Data layer
  lines.push(`## 1. Content Data (blogPosts.json)\n`);
  if (dataAudit.findings.length === 0) {
    lines.push(`${icon('OK')} No data-layer issues found.\n`);
  } else {
    for (const { slug, title, issues } of dataAudit.findings) {
      lines.push(`### \`${slug}\``);
      lines.push(`_${title}_`);
      for (const i of issues) lines.push(`- ${icon(i.type)} **${i.field}**: ${i.msg}`);
      lines.push('');
    }
  }

  // ── Live pages
  if (liveFindings.length > 0) {
    lines.push(`## 2. Live Page Crawl\n`);
    for (const { slug, issues } of liveFindings) {
      if (issues.length === 0) continue;
      lines.push(`### \`/insights/${slug}\``);
      for (const i of issues) lines.push(`- ${icon(i.type)} **${i.field}**: ${i.msg}`);
      lines.push('');
    }
  }

  // ── SEO component
  lines.push(`## 3. SEO Component (src/components/SEO.jsx)\n`);
  for (const i of componentIssues) lines.push(`- ${icon(i.type)} **${i.field}**: ${i.msg}`);
  lines.push('');

  // ── Sitemap
  lines.push(`## 4. Sitemap\n`);
  for (const i of sitemapIssues) lines.push(`- ${icon(i.type)} **${i.field}**: ${i.msg}`);
  lines.push('');

  // ── Robots
  lines.push(`## 5. robots.txt\n`);
  for (const i of robotsIssues) lines.push(`- ${icon(i.type)} **${i.field}**: ${i.msg}`);
  lines.push('');

  // ── AEO summary
  const aeoIssues = dataAudit.findings.flatMap((f) => f.issues.filter((i) => i.field === 'aeo'));
  if (aeoIssues.length > 0) {
    lines.push(`## 6. AI / LLM Visibility (AEO)\n`);
    lines.push(`${aeoIssues.length} posts have structural issues that reduce citation likelihood in ChatGPT, Perplexity, and Google AI Overviews:\n`);
    const byMsg = {};
    for (const f of dataAudit.findings) {
      for (const i of f.issues.filter((x) => x.field === 'aeo')) {
        byMsg[i.msg] = byMsg[i.msg] || [];
        byMsg[i.msg].push(f.slug);
      }
    }
    for (const [msg, slugs] of Object.entries(byMsg)) {
      lines.push(`- ${icon('WARN')} ${msg}`);
      lines.push(`  Affected: ${slugs.map((s) => `\`${s}\``).join(', ')}\n`);
    }
  }

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — SEO Audit               ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. Fetch data
  console.log('Fetching blogPosts.json from GitHub...');
  const posts = await getBlogPosts();
  console.log(`  Loaded ${posts.length} posts`);

  // 2. Data audit
  console.log('Running data-layer audit...');
  const dataAudit = auditPostData(posts);
  console.log(`  ${dataAudit.findings.length} posts with issues`);

  // 3. SEO component static check
  const componentIssues = auditSEOComponent();

  // 4. Sitemap + robots (always check live)
  console.log('Auditing sitemap.xml...');
  const publishedSlugs = posts.filter((p) => p && p.status === 'published').map((p) => p.slug);
  const sitemapIssues  = await auditSitemap(publishedSlugs);

  console.log('Auditing robots.txt...');
  const robotsIssues = await auditRobots();

  // 5. Live crawl (optional — can be slow for many posts)
  const liveFindings = [];
  if (CRAWL_LIVE) {
    const sample = publishedSlugs.slice(0, 10); // audit first 10 posts to stay under 10-min timeout
    console.log(`Crawling ${sample.length} live pages...`);
    for (const slug of sample) {
      const url    = `${SITE_URL}/insights/${slug}`;
      const issues = await auditLivePage(url);
      if (issues.length > 0) {
        liveFindings.push({ slug, issues });
        console.log(`  ${slug}: ${issues.length} issue(s)`);
      } else {
        console.log(`  ${slug}: ✅ clean`);
      }
    }
  }

  // 6. Build report
  const report = buildReport(dataAudit, liveFindings, sitemapIssues, robotsIssues, componentIssues);

  // Output to stdout (captured by GitHub Actions step summary)
  console.log('\n' + report);

  // Write to GITHUB_STEP_SUMMARY if running in Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    console.log('\nReport written to GitHub step summary.');
  }

  // Exit with error if any ERRORs found (makes the Actions job fail visibly)
  const hasErrors = [
    ...dataAudit.findings.flatMap((f) => f.issues),
    ...liveFindings.flatMap((f) => f.issues),
    ...sitemapIssues,
    ...robotsIssues,
  ].some((i) => i.type === 'ERROR');

  if (hasErrors) {
    console.error('\n❌ Audit completed with errors — see report above.');
    process.exit(1);
  } else {
    console.log('\n✅ Audit passed.');
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
