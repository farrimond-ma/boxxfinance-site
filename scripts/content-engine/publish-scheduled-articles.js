/**
 * Promotes pre-written, staged blog articles from status "scheduled" to
 * "published" once their scheduled date has arrived.
 *
 * This is deliberately separate from publish-blog.js, which generates NEW
 * content from the ContentEngine sheet via OpenAI. This script does no
 * generation — it only flips status on rows that were already written in
 * full (content, schema, FAQs) and committed ahead of time with a future
 * `date`, so a manually-staged batch (e.g. the named-lender content plan
 * added 2026-09-10) can roll out gradually instead of publishing all at
 * once.
 *
 * A post is promoted when status === 'scheduled' and its `date` is today
 * or earlier (UK date). No cap on how many promote in one run — the
 * pacing is controlled by the `date` already set on each row, not by this
 * script, so if a run is ever missed the backlog just catches up.
 *
 * Run: node publish-scheduled-articles.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_FILE = path.resolve(__dirname, '../../src/data/blogPosts.json');

function todayUK() {
  // Server runners are UTC; render the date as it would appear in the UK
  // (close enough for a once-a-day cadence — a few hours either side of
  // midnight doesn't matter here).
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD
}

function main() {
  const raw = fs.readFileSync(BLOG_FILE, 'utf8');
  const posts = JSON.parse(raw);
  const today = todayUK();
  // Detect the file's actual line ending rather than assuming one — this
  // repo's stored content is LF, but a local Windows checkout normalises it
  // to CRLF on the way out (git's autocrlf), which previously led this
  // script to hardcode CRLF. That's fine when committed locally (Windows
  // git's clean filter converts it back to LF before it hits the object
  // database), but the GitHub Actions runner is Linux with no such
  // filter — writing CRLF there landed real CRLF bytes in the commit and
  // touched every line in the diff (see the 2026-09-11 "510 scheduled
  // article(s)" commit this comment is fixing). Detecting from the file
  // itself works correctly in both environments.
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';

  const promoted = [];
  for (const post of posts) {
    if (post.status !== 'scheduled') continue;
    if (!post.date || post.date > today) continue;
    post.status = 'published';
    promoted.push(post.slug);
  }

  if (promoted.length === 0) {
    console.log(`No scheduled articles due (today: ${today}). Nothing to do.`);
    return;
  }

  const out = (JSON.stringify(posts, null, 2) + '\n').replace(/\n/g, eol);
  fs.writeFileSync(BLOG_FILE, out);
  console.log(`Promoted ${promoted.length} article(s) to published (today: ${today}):`);
  promoted.forEach((slug) => console.log(`  - ${slug}`));

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(
      summaryPath,
      `### Published ${promoted.length} scheduled article(s)\n\n${promoted.map((s) => `- ${s}`).join('\n')}\n`
    );
  }

  // Report the real count via GITHUB_OUTPUT so the workflow's commit
  // message doesn't have to infer it by grepping the diff — that approach
  // previously miscounted as 510 instead of 2 when an unrelated line-ending
  // mismatch touched every line in the file.
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `count=${promoted.length}\n`);
  }
}

main();
