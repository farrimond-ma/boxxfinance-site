/**
 * One-time migration: convert existing JPEG hero images to WebP.
 * Downloads each .jpg from GitHub, converts to WebP via sharp,
 * uploads the .webp, and updates blogPosts.json.
 * Run once via GitHub Actions then delete this script.
 */
require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const sharp = require('sharp');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE    = 'src/data/blogPosts.json';

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
  const content = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return { sha: data.sha, posts: JSON.parse(Buffer.from(content, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, message) {
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message, sha: latest.sha, branch: 'main',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n[Convert JPEG images to WebP]\n');
  if (isDryRun) console.log('DRY RUN\n');

  const { posts } = await getBlogPostsFile();

  const toConvert = posts.filter(p => p.heroImage && p.heroImage.endsWith('.jpg'));
  console.log(`Found ${toConvert.length} posts with JPEG hero images`);

  let converted = 0;
  for (const post of toConvert) {
    const jpgPath  = `public${post.heroImage}`;
    const webpPath = jpgPath.replace(/\.jpg$/, '.webp');

    console.log(`\nConverting: ${post.slug}`);
    console.log(`  ${jpgPath} → ${webpPath}`);

    if (isDryRun) { converted++; continue; }

    // Download JPEG from GitHub
    let jpgBuffer;
    try {
      const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: jpgPath });
      jpgBuffer = Buffer.from(data.content, 'base64');
      console.log(`  Downloaded: ${Math.round(jpgBuffer.length / 1024)}KB`);
    } catch (err) {
      console.warn(`  JPEG not found in repo, skipping: ${err.message}`);
      continue;
    }

    // Convert to WebP
    const webpBuffer = await sharp(jpgBuffer).webp({ quality: 85 }).toBuffer();
    console.log(`  Converted: ${Math.round(webpBuffer.length / 1024)}KB WebP (was ${Math.round(jpgBuffer.length / 1024)}KB JPEG)`);

    // Upload WebP
    let existingSha;
    try {
      const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: webpPath });
      existingSha = data.sha;
    } catch {}

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: webpPath,
      message: `Convert hero image to WebP: ${post.slug}`,
      content: webpBuffer.toString('base64'),
      branch:  'main',
      ...(existingSha && { sha: existingSha }),
    });

    // Update post to reference .webp
    post.heroImage = post.heroImage.replace(/\.jpg$/, '.webp');
    console.log(`  ✅ Uploaded WebP, updated heroImage reference`);
    converted++;

    await new Promise(r => setTimeout(r, 500)); // avoid rate limiting
  }

  if (converted > 0 && !isDryRun) {
    console.log('\nUpdating blogPosts.json...');
    await pushBlogPostsFile(posts, `chore: convert ${converted} hero images from JPEG to WebP`);
    console.log('✅ Done\n');
  } else if (isDryRun) {
    console.log(`\nDry run complete — would convert ${converted} images\n`);
  } else {
    console.log('\nNothing to convert\n');
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
