require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { google } = require('googleapis');

// ─── Clients ────────────────────────────────────────────────────────────────
const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_PAT });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BLOG_FILE = 'src/data/blogPosts.json';
const LOCATION_FILE = 'src/data/locationPages.json';

const MAX_LOCATION_LINKS_PER_BLOG = 4;

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
async function getSheetsClient() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
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

// ─── Get recently published location pages not yet linked ────────────────────
async function getUnlinkedLocations(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'ContentEngine!A2:AC',
  });

  const rows = res.data.values || [];
  const unlinked = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = (row[1] || '').toLowerCase().trim();
    const status = (row[2] || '').toLowerCase().trim();
    const jsonStatus = (row[26] || '').toLowerCase().trim();
    const url = row[11] || '';
    const service = row[5] || '';

    // Find location pages that are published but not yet linked
    if (type === 'location' && status === 'published' && jsonStatus !== 'linked' && url) {
      unlinked.push({
        rowIndex: i + 2,
        service,
        url: url.startsWith('http') ? url : `https://boxxfinance.co.uk${url}`,
        slug: row[10] || '',
        title: row[9] || '',
      });
    }
  }

  return unlinked;
}

// ─── Get blogPosts.json from GitHub ──────────────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, posts: JSON.parse(content) };
}

// ─── Push updated blogPosts.json to GitHub ────────────────────────────────────
async function pushBlogPostsFile(posts, sha, message) {
  const content = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: BLOG_FILE,
    message,
    content,
    sha,
    branch: 'main',
  });

  console.log(`Successfully pushed ${BLOG_FILE} to GitHub`);
}

// ─── Mark location as linked in Google Sheet ─────────────────────────────────
async function markLocationAsLinked(sheets, rowIndex) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `ContentEngine!AA${rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [['linked']] },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Boxx Content Engine: Internal Linking Updater ===');
  console.log(`Running at: ${new Date().toISOString()}`);

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  // 1. Find location pages that haven't been linked yet
  const unlinkedLocations = await getUnlinkedLocations(sheets);

  if (unlinkedLocations.length === 0) {
    console.log('No unlinked location pages found. Exiting.');
    return;
  }

  console.log(`Found ${unlinkedLocations.length} unlinked location page(s)`);

  // 2. Get current blogPosts.json
  console.log('Fetching blogPosts.json from GitHub...');
  let { sha, posts } = await getBlogPostsFile();
  console.log(`Current file has ${posts.length} blog posts`);

  let totalUpdates = 0;
  const processedLocations = [];

  // 3. Process each unlinked location
  for (const location of unlinkedLocations) {
    console.log(`\nProcessing: ${location.title} (${location.url})`);

    // Find blogs in the same service category
    const serviceSlug = location.service.toLowerCase().replace(/\s+/g, '-');

    const matchingBlogs = posts.filter(post => {
      const postService = (post.primaryKeyword || post.category || '').toLowerCase();
      const postCategory = (post.category || '').toLowerCase();
      const locationService = location.service.toLowerCase();

      return (
        post.status === 'published' &&
        (postService.includes(serviceSlug) ||
         postCategory.includes(locationService) ||
         locationService.includes(postCategory.replace(/\s+/g, '-')))
      );
    });

    console.log(`Found ${matchingBlogs.length} matching blog(s) for service: ${location.service}`);

    let updatesForThisLocation = 0;

    // Add location URL to matching blogs (up to MAX_LOCATION_LINKS_PER_BLOG)
    for (const post of matchingBlogs) {
      const existing = post.relatedLocationUrls || [];

      // Skip if already linked or at max capacity
      if (existing.includes(location.url)) {
        console.log(`  - ${post.slug}: already linked, skipping`);
        continue;
      }

      if (existing.length >= MAX_LOCATION_LINKS_PER_BLOG) {
        console.log(`  - ${post.slug}: at max ${MAX_LOCATION_LINKS_PER_BLOG} location links, skipping`);
        continue;
      }

      // Add the new location URL
      post.relatedLocationUrls = [...existing, location.url];
      updatesForThisLocation++;
      totalUpdates++;
      console.log(`  - ${post.slug}: added link (now has ${post.relatedLocationUrls.length} location links)`);
    }

    if (updatesForThisLocation > 0) {
      processedLocations.push(location);
    } else {
      console.log(`  No blogs updated for this location — marking as linked anyway`);
      processedLocations.push(location);
    }
  }

  // 4. Push updated blogPosts.json if anything changed
  if (totalUpdates > 0) {
    const locationSlugs = processedLocations.map(l => l.slug).join(', ');
    await pushBlogPostsFile(
      posts,
      sha,
      `Internal linking update for: ${locationSlugs}`
    );
    console.log(`\nPushed ${totalUpdates} link update(s) to GitHub`);
  } else {
    console.log('\nNo blog posts needed updating');
  }

  // 5. Mark all processed locations as linked in the sheet
  for (const location of processedLocations) {
    await markLocationAsLinked(sheets, location.rowIndex);
    console.log(`Marked row ${location.rowIndex} as linked: ${location.slug}`);
  }

  console.log('\n=== Done! ===');
  console.log(`Processed ${processedLocations.length} location(s), made ${totalUpdates} link update(s)`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
