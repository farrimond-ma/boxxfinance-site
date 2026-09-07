/**
 * reimage-focus-service-posts.js
 *
 * One-off backfill for posts published under Bad Credit Mortgages, Secured
 * Loans, Buy To Let Refinance and Second Charge Mortgages before 2026-09-07.
 *
 * Those four services had no entry in publish-blog.js's SERVICE_QUERIES map,
 * so every post fell through to the generic 'UK business professionals
 * meeting office' fallback — an office/cafe photo on an article about a
 * mortgage or a home. Mark flagged this from the /insights cards (the Bad
 * Credit Mortgages post showed people at what looks like a bar). The map is
 * fixed; this re-sources the images that were already fetched under it.
 *
 * Re-fetches through the SAME query strings now in SERVICE_QUERIES (kept in
 * step manually — small map, rarely changes, and importing a local function
 * out of publish-blog.js isn't worth the refactor for a one-off script; see
 * reimage-news-posts.js for the same tradeoff made the same way).
 *
 * Bumps heroVersion so the change actually shows: heroPool.js's
 * heroForPost() appends it as a cache-busting query string for every
 * non-bridging post, and images are served with a 7-day max-age — overwrite
 * the file at the same path without bumping the version and a browser that
 * already cached the wrong photo keeps showing it.
 *
 * Safe to re-run: only touches posts still using the fallback-era image (or
 * everything, if --force is passed), so a repeat run without --force changes
 * nothing once every post has been re-imaged once.
 *
 * Run: node reimage-focus-service-posts.js [--dry-run] [--only <slug,slug>] [--force]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

// Kept identical to SERVICE_QUERIES in publish-blog.js for these four keys.
const SERVICE_QUERIES = {
  'bad-credit-mortgages':    'UK suburban semi detached houses',
  'secured-loans':           'UK detached house driveway exterior',
  'buy-to-let-refinance':    'UK rental apartment building exterior',
  'second-charge-mortgages': 'UK terraced houses residential street',
};

async function getJsonFile(path) {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, json: JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) };
}

async function replaceImage(imagePath, buffer) {
  const webp = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  let sha = null;
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath });
    sha = data.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    message: `Re-source hero image: ${imagePath.split('/').pop().replace('.webp', '')}`,
    content: webp.toString('base64'), branch: 'main', ...(sha && { sha }),
  });
}

async function fetchPexelsPhoto(query, usedIds) {
  const apiKey = process.env.PEXELS_API_KEY;
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&size=large`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const candidates = (data.photos || []).filter(p => {
    const desc = ((p.alt || '') + ' ' + (p.photographer || '')).toLowerCase();
    return !desc.match(/\$|dollar|euro|€|usd|eur/i) && !usedIds.has(p.id);
  });
  return candidates[0] || null;
}

function serviceKey(service) {
  return (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const force    = process.argv.includes('--force');
  const onlyArg  = process.argv.indexOf('--only');
  const only     = onlyArg !== -1 && process.argv[onlyArg + 1]
    ? new Set(process.argv[onlyArg + 1].split(',').map(s => s.trim()))
    : null;

  console.log('\n[Re-image focus-service posts]\n');
  if (isDryRun) console.log('DRY RUN — nothing will be written\n');
  if (!process.env.PEXELS_API_KEY) { console.error('PEXELS_API_KEY not set.'); process.exit(1); }

  const { sha: blogSha, json: posts } = await getJsonFile(BLOG_FILE);

  const targets = posts.filter(p => {
    if (only && !only.has(p.slug)) return false;
    const key = serviceKey(p.service);
    if (!SERVICE_QUERIES[key]) return false;
    // Without --force, only touch posts that never got a proper query-driven
    // image — i.e. ones with no heroVersion recorded, which is what every
    // post published before this fix looks like (fetchPexelsImage never set
    // one for these services). A post re-imaged once has a heroVersion and
    // is left alone on a repeat run.
    if (!force && p.heroVersion) return false;
    return true;
  });

  console.log(`${targets.length} post(s) to re-image` + (only ? ` (filtered to ${only.size} requested slug(s))` : ''));
  if (targets.length === 0) { console.log('\nNothing to do.'); return; }

  const usedIds = new Set();
  let changed = false;

  for (const post of targets) {
    const key = serviceKey(post.service);
    const query = SERVICE_QUERIES[key];
    console.log(`\n${post.slug}  [${post.service}]  query: "${query}"`);

    const photo = await fetchPexelsPhoto(query, usedIds);
    if (!photo) { console.log('  no result — leaving existing image in place'); continue; }
    usedIds.add(photo.id);
    console.log(`  found: ${photo.url}`);

    if (isDryRun) continue;

    const imgRes = await fetch(photo.src.large2x || photo.src.large);
    if (!imgRes.ok) { console.log(`  download failed (${imgRes.status}) — skipping`); continue; }
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const imagePath = post.heroImage.replace(/^\//, '');
    await replaceImage(imagePath, buffer);
    post.heroVersion = photo.id;
    changed = true;
    console.log(`  replaced ${imagePath}, heroVersion → ${photo.id}`);

    await new Promise(r => setTimeout(r, 400)); // stay well under Pexels' rate limit
  }

  if (isDryRun || !changed) {
    console.log(isDryRun ? '\n[DRY RUN] No files written.' : '\nNo images were actually replaced.');
    return;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message: 'Re-image focus-service posts (bad credit / secured loans / BTL refinance / second charge)',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
    branch: 'main', sha: blogSha,
  });
  console.log(`\n✅ Updated ${BLOG_FILE} with new heroVersion values.`);
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
