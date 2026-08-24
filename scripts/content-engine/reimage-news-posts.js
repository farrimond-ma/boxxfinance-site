/**
 * reimage-news-posts.js
 *
 * One-off backfill for the "Latest News" posts published 2026-08-21 to
 * 2026-08-24, before the image sourcing was fixed.
 *
 * Those ten posts share only five images (one used four times) and several
 * are visibly American, because the old code asked Pexels for 8 results and
 * always took the first — one fixed query per category meant the same query
 * returned the same photo every time. See docs/personal-finance-discover-pilot.md.
 *
 * This re-sources every one of them through lib/news-images.js, the same
 * module publish-personal-finance-news.js now uses, accumulating photo ids as
 * it goes so no two posts can end up with the same picture. The chosen ids are
 * written back to the tracking file so future posts avoid them too.
 *
 * Safe to re-run: it overwrites the image at the post's existing heroImage
 * path, so nothing in blogPosts.json needs to change.
 *
 * Run: node reimage-news-posts.js [--dry-run]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');
const { deriveImageQueries, fetchPexelsImage } = require('./lib/news-images');

const GITHUB_OWNER  = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO   = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE     = 'src/data/blogPosts.json';
const TRACKING_FILE = 'src/data/personalFinanceNewsTracking.json';
const PILLAR_NAME   = 'Latest News';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

async function getJsonFile(path) {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
  const raw = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, json: JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) };
}

// Unlike the publisher's uploadHeroImage, this replaces a file that already
// exists — the GitHub contents API rejects an update without the current blob
// sha, so fetch it first.
async function replaceImage(imagePath, buffer) {
  const webp = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  let sha = null;
  try {
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath });
    sha = data.sha;
  } catch (err) {
    if (err.status !== 404) throw err; // 404 is fine, we simply create it
  }
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: imagePath,
    message: `Re-source hero image: ${imagePath.split('/').pop().replace('.webp', '')}`,
    content: webp.toString('base64'), branch: 'main', ...(sha && { sha }),
  });
  return Math.round(webp.length / 1024);
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n[Re-image Latest News posts]\n');
  if (isDryRun) console.log('DRY RUN — no changes written\n');

  const { json: posts } = await getJsonFile(BLOG_FILE);
  const { json: covered, sha: trackingSha } = await getJsonFile(TRACKING_FILE);

  // --only <slug>[,<slug>] re-images just those posts. Most of the backfill
  // produced good images; without this, fixing one bad pick would re-roll the
  // good ones too and could easily make things worse.
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg !== -1 && process.argv[onlyArg + 1]
    ? new Set(process.argv[onlyArg + 1].split(',').map(s => s.trim()).filter(Boolean))
    : null;

  let news = posts.filter(p => p.service === PILLAR_NAME && p.status === 'published');
  if (only) {
    const missing = [...only].filter(s => !news.some(p => p.slug === s));
    if (missing.length) {
      console.error(`\n❌ No published "${PILLAR_NAME}" post for: ${missing.join(', ')}\n`);
      process.exit(1);
    }
    news = news.filter(p => only.has(p.slug));
  }
  console.log(`Found ${news.length} published "${PILLAR_NAME}" post(s)${only ? ' (--only filter applied)' : ''}.\n`);
  if (news.length === 0) return;

  // Seeded with anything already recorded, so a re-run does not hand out a
  // photo an earlier run already used.
  const usedPhotoIds = new Set(covered.map(c => c.photoId).filter(Boolean));
  const chosen = {};
  let updated = 0, failed = 0;

  for (const post of news) {
    console.log(`${post.slug}`);
    const queries = deriveImageQueries({ title: post.title, description: post.excerpt || '' });

    const image = await fetchPexelsImage(queries, usedPhotoIds);
    if (!image) {
      console.log('  no usable image found — leaving existing image in place\n');
      failed++;
      continue;
    }
    usedPhotoIds.add(image.photoId);
    chosen[post.slug] = image.photoId;

    if (isDryRun) {
      console.log(`  would replace ${post.heroImage} with photo ${image.photoId}\n`);
      updated++;
      continue;
    }

    const imagePath = `public${post.heroImage}`;
    const kb = await replaceImage(imagePath, image.buffer);
    console.log(`  replaced ${post.heroImage} (${kb}KB)\n`);
    updated++;
  }

  // Record the ids so publish-personal-finance-news.js will not reuse them.
  const stillMissing = [];
  for (const entry of covered) {
    if (chosen[entry.slug]) entry.photoId = chosen[entry.slug];
    else if (!entry.photoId) stillMissing.push(entry.slug);
  }

  if (!isDryRun && Object.keys(chosen).length > 0) {
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: TRACKING_FILE,
      message: 'chore: record hero photo ids after re-imaging news posts',
      content: Buffer.from(JSON.stringify(covered.slice(0, 200), null, 2)).toString('base64'),
      branch: 'main', sha: trackingSha,
    });
    console.log('Tracking file updated with photo ids.');
  }

  console.log(`\n${updated} re-imaged, ${failed} left unchanged, ${new Set(Object.values(chosen)).size} distinct photos used.`);
  if (stillMissing.length) console.log(`Tracking entries with no photoId (no matching post): ${stillMissing.join(', ')}`);
  if (failed > 0) process.exit(1); // surface partial failures to the watchdog
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
