/**
 * reimage-focus-service-posts.js
 *
 * One-off backfill for posts published under Bad Credit Mortgages, Secured
 * Loans, Buy To Let Refinance and Second Charge Mortgages before the image
 * sourcing was fixed properly.
 *
 * Two bugs, found in sequence:
 *
 *   1. (2026-09-07) Those four services had no entry in publish-blog.js's
 *      image-query map, so every post fell through to a generic
 *      'UK business professionals meeting office' fallback — an office/cafe
 *      photo on an article about a mortgage or a home.
 *   2. (2026-09-08) Adding an entry wasn't enough on its own — a single
 *      "UK <subject>" string barely constrains Pexels, which is US-heavy. A
 *      buy-to-let-refinance post got an American apartment block through the
 *      fixed-but-still-single-string query the very next night. The actual
 *      fix is lib/news-images.js's fetchPexelsImage, built for exactly this
 *      failure on the news pipeline: several query variants tried in order,
 *      filtered against explicit non-UK markers (US cities, $, etc.) and
 *      preferring explicitly UK-tagged results.
 *
 * Now shares BOTH the query list (lib/service-image-queries.js) and the
 * fetching/filtering logic (lib/news-images.js) with publish-blog.js, so the
 * two paths cannot drift apart again the way the single-string duplicate did.
 *
 * Bumps heroVersion so the change actually shows: heroPool.js's
 * heroForPost() appends it as a cache-busting query string for every
 * non-bridging post, and images are served with a 7-day max-age — overwrite
 * the file at the same path without bumping the version and a browser that
 * already cached the wrong photo keeps showing it.
 *
 * Safe to re-run: only touches posts still using a fallback-era image (or
 * everything, if --force is passed), so a repeat run without --force changes
 * nothing once every post has been re-imaged once.
 *
 * Run: node reimage-focus-service-posts.js [--dry-run] [--only <slug,slug>] [--force]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');
const { fetchPexelsImage } = require('./lib/news-images');
const { serviceImageQueries } = require('./lib/service-image-queries');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

// The four services this backfill covers. serviceImageQueries() falls back to
// a generic query for anything not in its map, which would silently "fix"
// unrelated services with the wrong photo — restricting the target list here
// keeps this script doing only what it says on the tin.
const COVERED_SERVICES = new Set(['bad-credit-mortgages', 'secured-loans', 'buy-to-let-refinance', 'second-charge-mortgages']);

function serviceKey(service) {
  return (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

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
    if (!COVERED_SERVICES.has(serviceKey(p.service))) return false;
    // Without --force, only touch posts that never got a properly-filtered
    // image — i.e. no heroVersion recorded. Every post published before
    // 2026-09-08 looks like this (fetchPexelsImage never set one for these
    // services, even after the 09-07 query-map fix). A post re-imaged once
    // has a heroVersion and is left alone on a repeat run.
    if (!force && p.heroVersion) return false;
    return true;
  });

  console.log(`${targets.length} post(s) to re-image` + (only ? ` (filtered to ${only.size} requested slug(s))` : ''));
  if (targets.length === 0) { console.log('\nNothing to do.'); return; }

  const usedPhotoIds = new Set();
  let changed = false;

  for (const post of targets) {
    const queries = serviceImageQueries(post.service);
    console.log(`\n${post.slug}  [${post.service}]  queries: ${queries.map(q => `"${q}"`).join(', ')}`);

    const result = await fetchPexelsImage(queries, usedPhotoIds);
    if (!result) { console.log('  no usable result — leaving existing image in place'); continue; }
    usedPhotoIds.add(result.photoId);

    if (isDryRun) { console.log(`  would use photo ${result.photoId}`); continue; }

    const imagePath = post.heroImage.replace(/^\//, '');
    await replaceImage(imagePath, result.buffer);
    post.heroVersion = result.photoId;
    changed = true;
    console.log(`  replaced ${imagePath}, heroVersion → ${result.photoId}`);

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
