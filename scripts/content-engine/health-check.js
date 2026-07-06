require('dotenv').config();
const { google } = require('googleapis');

const GITHUB_OWNER  = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO   = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE     = 'src/data/blogPosts.json';
const LOCATION_FILE = 'src/data/locationPages.json';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// During the strategic pivot, every publisher is restricted to this service via
// SERVICE_FILTER. Keep this in sync with the workflows — when the pivot ends and
// SERVICE_FILTER is removed/changed, update this constant (or set HC_SERVICE_FILTER).
const SERVICE_FILTER = (process.env.HC_SERVICE_FILTER !== undefined)
  ? process.env.HC_SERVICE_FILTER.trim()
  : 'Bridging Finance';

const LOOKBACK_DAYS = 3;

const octokit = new (require('@octokit/rest').Octokit)({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

// ─── GitHub content helpers ──────────────────────────────────────────────────
async function getJsonFile(path) {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
  // Files >1MB: contents API returns empty content but still gives the sha — fetch via blob API
  const content = data.content && data.encoding !== 'none'
    ? data.content
    : (await octokit.git.getBlob({ owner: GITHUB_OWNER, repo: GITHUB_REPO, file_sha: data.sha })).data.content;
  return JSON.parse(Buffer.from(content, 'base64').toString('utf8'));
}

async function getRunsToday(workflowFile) {
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const { data } = await octokit.actions.listWorkflowRuns({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, workflow_id: workflowFile, per_page: 15,
    });
    return data.workflow_runs.filter(r => r.created_at.startsWith(todayStr));
  } catch (err) {
    console.warn(`  Could not list runs for ${workflowFile}: ${err.message}`);
    return null; // null = "couldn't check", distinct from [] = "checked, found none"
  }
}

// ─── Google Sheets (ContentEngine queue) ─────────────────────────────────────
async function getSheetsClient() {
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials;
    try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
    catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
    auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  } else {
    auth = new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  }
  return google.sheets({ version: 'v4', auth });
}

async function getContentEngineRows() {
  if (!SPREADSHEET_ID) return [];
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'ContentEngine!A2:Z' });
    const rows = res.data.values || [];
    return rows.map((row, i) => ({
      rowIndex: i + 2,
      id: row[0] || '',
      type: (row[1] || '').toLowerCase().trim(),
      status: (row[2] || '').toLowerCase().trim(),
      publishDate: (row[3] || '').trim(),
      publishSlot: (row[4] || 'AM').toUpperCase().trim(),
      service: (row[5] || '').trim(),
      city: row[6] || '',
      keyword: row[7] || '',
      title: row[9] || '',
    }));
  } catch (err) {
    console.warn(`  Could not read ContentEngine sheet: ${err.message}`);
    return null; // null = "couldn't check"
  }
}

// ─── Verdict helpers ─────────────────────────────────────────────────────────
// status: 'ok' (did its job) | 'info' (correct no-op) | 'warn' (looks off) | 'fail' (should have acted but didn't / run failed)
const ok   = (note) => ({ status: 'ok',   note });
const info = (note) => ({ status: 'info', note });
const warn = (note) => ({ status: 'warn', note });
const fail = (note) => ({ status: 'fail', note });

function matchesFilter(service) {
  return !SERVICE_FILTER || (service || '').trim().toLowerCase() === SERVICE_FILTER.toLowerCase();
}

// Did the queue actually drain? (used for blog AM/PM and location publishers,
// which both work by flipping a ContentEngine row from "scheduled" to "published")
function verifyQueueDrain({ sheetRows, today }, { type, slot, label }) {
  if (sheetRows === null) return warn(`Could not read the ContentEngine sheet to verify — check GOOGLE_CREDENTIALS/SPREADSHEET_ID secrets.`);
  const due = sheetRows.filter(r =>
    r.type === type &&
    r.publishDate && r.publishDate <= today &&
    (!slot || r.publishSlot === slot) &&
    matchesFilter(r.service)
  );
  const stillScheduled = due.filter(r => r.status === 'scheduled');
  if (stillScheduled.length > 0) {
    const r = stillScheduled[0];
    return fail(`${stillScheduled.length} due "${SERVICE_FILTER || 'any-service'}" ${label} row(s) are still marked "scheduled" — e.g. row ${r.rowIndex} ("${r.title || r.keyword}", due ${r.publishDate}). The publisher ran but didn't drain the queue — investigate.`);
  }
  if (due.length > 0) {
    return ok(`All ${due.length} due "${SERVICE_FILTER || 'any-service'}" ${label} row(s) are marked published.`);
  }
  return info(`No "${SERVICE_FILTER || 'any-service'}" ${label} rows are due today in the ContentEngine sheet — correct no-op. If this persists, the queue likely needs refilling (pivot-to-bridging / populate-content-engine).`);
}

// Did a social publisher actually post the thing it was supposed to post?
// Mirrors each publisher's own getUnpostedBlog() filter so "found nothing eligible"
// (correct no-op) is distinguished from "found something eligible but didn't post it" (bug).
function verifySocialFlag({ posts, today }, flagName, label) {
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  const eligible = posts.filter(p =>
    p.status === 'published' && !p[flagName] &&
    p.date >= cutoffDate && p.date <= today &&
    matchesFilter(p.service)
  ).sort((a, b) => a.date.localeCompare(b.date));

  if (eligible.length > 0) {
    const p = eligible[0];
    return fail(`${eligible.length} eligible "${SERVICE_FILTER || 'any-service'}" post(s) are still waiting for ${label} — oldest: "${p.title}" (${p.date}, ${flagName} = false). The publisher ran but didn't post it — investigate.`);
  }

  const recentlyPosted = posts.filter(p => p[flagName] && p.date >= cutoffDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (recentlyPosted.length > 0) {
    const p = recentlyPosted[0];
    return ok(`${label} is up to date — most recent post flagged ${flagName}: "${p.title}" (${p.date}).`);
  }
  return info(`Nothing eligible for ${label} in the last ${LOOKBACK_DAYS} days (no unposted "${SERVICE_FILTER || 'any-service'}" articles published recently) — correct no-op. If this persists, the content queue likely needs refilling.`);
}

function verifyRunOnly(ctx, { runs, label }) {
  if (runs === null) return warn(`Could not check run history for ${label} — GitHub API call failed.`);
  if (runs.length === 0) return fail(`Expected to run today on its schedule, but no run was recorded.`);
  const succeeded = runs.filter(r => r.conclusion === 'success');
  const failed    = runs.filter(r => r.conclusion === 'failure');
  if (succeeded.length > 0) {
    return failed.length > 0
      ? ok(`Ran ${runs.length}× today — at least one succeeded (${failed.length} failed). Latest: ${runs[0].html_url}`)
      : ok(`Ran successfully. ${runs[0].html_url}`);
  }
  return fail(`Ran ${runs.length}× today and ALL failed. Latest: ${runs[0].html_url}`);
}

// ─── Workflow registry ───────────────────────────────────────────────────────
const dow = new Date().getUTCDay(); // 0=Sun .. 6=Sat
const isWeekday = dow >= 1 && dow <= 5;

const REGISTRY = [
  { key: 'publish-blog',          file: 'publish-blog.yml',          label: 'Blog Publisher (AM)',
    when: () => true,        verify: (ctx) => verifyQueueDrain(ctx, { type: 'blog', slot: 'AM', label: 'blog' }) },
  { key: 'publish-blog-pm',       file: 'publish-blog-pm.yml',       label: 'Blog Publisher (PM / visibility-gap)',
    when: () => true,        verify: (ctx) => verifyQueueDrain(ctx, { type: 'blog', slot: 'PM', label: 'blog' }) },
  { key: 'publish-location',      file: 'publish-location.yml',      label: 'Location Page Publisher',
    when: () => true,        verify: (ctx) => verifyQueueDrain(ctx, { type: 'location', slot: null, label: 'location page' }) },
  { key: 'publish-facebook',      file: 'publish-facebook.yml',      label: 'Facebook Publisher',
    when: () => true,        verify: (ctx) => verifySocialFlag(ctx, 'fbPosted', 'Facebook') },
  { key: 'publish-facebook-reels',file: 'publish-facebook-reels.yml',label: 'Facebook/Instagram Reels Publisher',
    when: () => true,        verify: (ctx) => verifySocialFlag(ctx, 'reelPosted', 'Facebook/Instagram Reels') },
  { key: 'publish-pinterest',     file: 'publish-pinterest.yml',     label: 'Pinterest Publisher',
    when: () => true,        verify: (ctx) => verifySocialFlag(ctx, 'pinterestPosted', 'Pinterest') },
  { key: 'publish-linkedin',      file: 'publish-linkedin.yml',      label: 'LinkedIn Publisher',
    when: () => true,        verify: (ctx) => verifySocialFlag(ctx, 'liPosted', 'LinkedIn') },
  { key: 'regenerate-thin-posts', file: 'regenerate-thin-posts.yml', label: 'Regenerate Thin Posts',
    when: () => true,        verify: null },
  { key: 'update-internal-links', file: 'update-internal-links.yml', label: 'Update Internal Links',
    when: () => isWeekday,   verify: null },
  { key: 'reddit-monitor',        file: 'reddit-monitor.yml',        label: 'Reddit Monitor',
    when: () => dow === 1 || dow === 4, verify: null },
  { key: 'backlink-outreach',     file: 'backlink-outreach.yml',     label: 'Backlink Outreach Monitor',
    when: () => dow === 5,   verify: null },
  { key: 'search-console-insights', file: 'search-console-insights.yml', label: 'Search Console Insights',
    when: () => dow === 1,   verify: null },
  { key: 'seo-audit',             file: 'seo-audit.yml',             label: 'SEO Audit',
    when: () => dow === 1,   verify: null },
  { key: 'visibility-check',      file: 'visibility-check.yml',      label: 'AI Visibility Check',
    when: () => dow === 1,   verify: null },
];

// regenerate-sitemap is push-triggered (not cron) — handled separately below.

async function checkSitemap() {
  const runs = await getRunsToday('regenerate-sitemap.yml');
  if (runs === null) return { label: 'Regenerate Sitemap', ...warn('Could not check run history — GitHub API call failed.') };
  if (runs.length === 0) return { label: 'Regenerate Sitemap', ...info('No data-file changes today, so no regeneration was triggered — expected.') };
  const succeeded = runs.filter(r => r.conclusion === 'success');
  const failed    = runs.filter(r => r.conclusion === 'failure');
  if (succeeded.length > 0) {
    return { label: 'Regenerate Sitemap', ...ok(
      failed.length > 0
        ? `${runs.length} run(s) today (multiple publishes triggered concurrent regenerations) — ${succeeded.length} succeeded, ${failed.length} lost a benign push race and self-healed via retry.`
        : `${runs.length} run(s) today, all succeeded.`
    ) };
  }
  return { label: 'Regenerate Sitemap', ...fail(`${runs.length} run(s) today and ALL failed — sitemap.xml may be stale. Latest: ${runs[0].html_url}`) };
}

// ─── Report + alerting ───────────────────────────────────────────────────────
const ICONS = { fail: '❌', warn: '⚠️', info: 'ℹ️', ok: '✅' };

function buildReport(results, today) {
  const groups = { fail: [], warn: [], info: [], ok: [] };
  for (const r of results) groups[r.status].push(r);

  const lines = [`# Content Engine Health Report — ${today}`, ''];
  lines.push(`SERVICE_FILTER in effect: **${SERVICE_FILTER || '(none)'}**`, '');

  const section = (key, heading) => {
    if (!groups[key].length) return;
    lines.push(`## ${ICONS[key]} ${heading} (${groups[key].length})`);
    for (const r of groups[key]) lines.push(`- **${r.label}**: ${r.note}`);
    lines.push('');
  };
  section('fail', 'Needs investigation now');
  section('warn', 'Worth a look');
  section('info', 'Informational / correct no-ops');
  section('ok',   'Working correctly');

  return lines.join('\n');
}

async function postAlertIssue(report, problemCount) {
  const title = '🩺 Content Engine Health Alert';
  const body = `${report}\n\n---\n_Auto-generated by \`health-check.js\` (runs daily). This issue tracks ongoing problems — close it once everything's fixed; a fresh one (or a comment here, if still open) will appear if issues persist or recur._`;

  let existing = null;
  try {
    const { data: issues } = await octokit.issues.listForRepo({ owner: GITHUB_OWNER, repo: GITHUB_REPO, state: 'open', per_page: 30 });
    existing = issues.find(i => i.title === title);
  } catch (err) { console.warn(`  Could not list issues: ${err.message}`); }

  try {
    if (existing) {
      await octokit.issues.createComment({ owner: GITHUB_OWNER, repo: GITHUB_REPO, issue_number: existing.number, body });
      console.log(`Added findings as a comment on existing alert issue #${existing.number}: ${existing.html_url}`);
    } else {
      const { data: created } = await octokit.issues.create({ owner: GITHUB_OWNER, repo: GITHUB_REPO, title, body });
      console.log(`Opened new alert issue #${created.number}: ${created.html_url}`);
    }
  } catch (err) {
    console.error(`  Could not create/update alert issue: ${err.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Boxx Content Engine: Daily Health Check ===');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`SERVICE_FILTER: "${SERVICE_FILTER}"`);

  const today = new Date().toISOString().split('T')[0];

  const [posts, locations, sheetRows] = await Promise.all([
    getJsonFile(BLOG_FILE).catch(err => { console.warn(`  Could not read ${BLOG_FILE}: ${err.message}`); return null; }),
    getJsonFile(LOCATION_FILE).catch(err => { console.warn(`  Could not read ${LOCATION_FILE}: ${err.message}`); return null; }),
    getContentEngineRows(),
  ]);

  const ctx = { posts: posts || [], locations: locations || [], sheetRows, today };
  const results = [];

  for (const wf of REGISTRY) {
    let due;
    try { due = wf.when(); } catch { due = true; }
    if (!due) continue; // not on schedule today — skip silently

    console.log(`\nChecking: ${wf.label} (${wf.file})`);
    const runs = await getRunsToday(wf.file);

    if (runs === null) {
      results.push({ label: wf.label, ...warn('Could not check run history — GitHub API call failed.') });
      continue;
    }
    if (runs.length === 0) {
      results.push({ label: wf.label, ...fail('Expected to run today on its schedule, but no run was recorded — check if the workflow is disabled or the cron is misconfigured.') });
      continue;
    }
    const succeeded = runs.filter(r => r.conclusion === 'success');
    const failedRuns = runs.filter(r => r.conclusion === 'failure');

    if (succeeded.length === 0) {
      results.push({ label: wf.label, ...fail(`Ran ${runs.length}× today and ALL failed. Latest: ${runs[0].html_url}`) });
      continue;
    }

    // Ran (and succeeded at least once) — now verify it actually did its job, if we have a check for that
    if (wf.verify) {
      const v = wf.verify(ctx);
      const note = failedRuns.length > 0 ? `${v.note} (note: ${failedRuns.length} run(s) today also failed — ${runs[0].html_url})` : v.note;
      results.push({ label: wf.label, status: v.status, note });
    } else {
      results.push({ label: wf.label, ...ok(
        failedRuns.length > 0
          ? `Ran ${runs.length}× today — at least one succeeded (${failedRuns.length} failed; worth a glance: ${runs[0].html_url}).`
          : `Ran successfully. ${runs[0].html_url}`
      ) });
    }
  }

  // Sitemap is push-triggered, not scheduled — check separately, always
  console.log(`\nChecking: Regenerate Sitemap (regenerate-sitemap.yml)`);
  results.push(await checkSitemap());

  const report = buildReport(results, today);
  console.log('\n' + report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  }

  const failures = results.filter(r => r.status === 'fail');
  const warnings = results.filter(r => r.status === 'warn');
  const problems = [...failures, ...warnings];

  if (problems.length > 0) {
    console.log(`\n${problems.length} item(s) need attention — opening/updating alert issue...`);
    await postAlertIssue(report, problems.length);
  } else {
    console.log('\n✅ All checks passed — no alert issue needed.');
  }

  console.log('\nDone.');

  // Exit with code 1 if there are any hard failures — this turns the GitHub Actions
  // workflow red, which triggers GitHub's built-in email notifications to watchers.
  // Warnings alone keep the run green (informational, not actionable right now).
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} failure(s) detected — exiting with code 1 to trigger GitHub notification email.`);
    process.exit(1);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
