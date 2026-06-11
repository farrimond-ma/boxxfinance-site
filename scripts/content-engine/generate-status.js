/**
 * Boxx Finance — System Status Generator
 *
 * Builds a complete daily activity log of every action the content engine
 * takes, with the time each one SUCCESSFULLY completed and — where the
 * platform API allows — live verification that the post is actually
 * visible on the account.
 *
 * Evidence sources, strongest first:
 *   1. On-platform check  — Facebook Graph API page posts / Instagram media
 *   2. Success commit     — each publisher commits a distinct message ONLY
 *                           after the platform API confirms the post
 *   3. Workflow run       — GitHub Actions run conclusion + completion time
 *
 * Output: status-out/system-status.json — uploaded to the site root by
 * .github/workflows/system-status.yml so the /dashboard page can read it.
 *
 * Run: node generate-status.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const FB_PAGE_ID   = process.env.FACEBOOK_PAGE_ID;
const FB_TOKEN     = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const IG_USER_ID   = process.env.INSTAGRAM_USER_ID;
const FB_API_VER   = 'v21.0';
const OUT_DIR      = path.resolve(__dirname, 'status-out');

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

// ─── The daily action catalogue ───────────────────────────────────────────────
// Every action the system takes on a normal day. commitPattern matches the
// success commit each publisher writes only after the platform API succeeds.
const DAILY_ACTIONS = [
  { id: 'blog-am',    label: 'Blog article published (AM)',  workflow: 'publish-blog.yml',
    commitPattern: /^Publish blog: (.+)$/,  slot: 'am',  days: 'all' },
  { id: 'blog-pm',    label: 'Blog article published (PM)',  workflow: 'publish-blog-pm.yml',
    commitPattern: /^Publish blog: (.+)$/,  slot: 'pm',  days: 'all' },
  { id: 'locations',  label: 'Location pages published',     workflow: 'publish-location.yml',
    commitPattern: /^Publish location: (.+)$/, multiple: true, days: 'weekdays' },
  { id: 'facebook',   label: 'Facebook post',                workflow: 'publish-facebook.yml',
    commitPattern: /^social: facebook posted for (.+)$/, multiple: true, platformCheck: 'facebook', days: 'all' },
  { id: 'linkedin',   label: 'LinkedIn post',                workflow: 'publish-linkedin.yml',
    commitPattern: /^social: linkedin posted for (.+)$/, multiple: true, days: 'weekdays',
    evidenceNote: 'LinkedIn API confirmed the post at publish time (read-back not permitted by LinkedIn scopes)' },
  { id: 'instagram',  label: 'Instagram Reel',               workflow: 'publish-facebook-reels.yml',
    commitPattern: /^social: instagram posted for (.+)$/, multiple: true, platformCheck: 'instagram', days: 'weekdays' },
  { id: 'reel',       label: 'Facebook Reel video',          workflow: 'publish-facebook-reels.yml',
    commitPattern: /^social: reel posted for (.+)$/, multiple: true, platformCheck: 'reels', days: 'weekdays' },
  { id: 'pinterest',  label: 'Pinterest pin',                workflow: 'publish-pinterest.yml',
    commitPattern: /^social: pinterest posted for (.+)$/, multiple: true, days: 'weekdays' },
  { id: 'sitemap',    label: 'Sitemap regenerated',          workflow: 'regenerate-sitemap.yml',
    commitPattern: /^chore: regenerate sitemap/, days: 'all' },
  { id: 'links',      label: 'Internal links updated',       workflow: 'update-internal-links.yml', days: 'weekdays' },
  { id: 'deploy',     label: 'Site deployed',                workflow: 'deploy.yml', multiple: true, days: 'all' },
  { id: 'health',     label: 'Nightly health check',         workflow: 'health-check.yml', days: 'all' },
];

const WEEKLY_ACTIONS = [
  { id: 'visibility', label: 'AI visibility check (ChatGPT/Claude/Perplexity/Gemini)', workflow: 'visibility-check.yml',  day: 'Monday' },
  { id: 'gaps',       label: 'Visibility-gap content scheduled',                       workflow: 'sync-content-engine.yml', day: 'Monday' },
  { id: 'sc',         label: 'Search Console insights pulled',                         workflow: 'search-console-insights.yml', day: 'Weekly' },
  { id: 'seoaudit',   label: 'SEO audit of all posts',                                 workflow: 'seo-audit.yml', day: 'After blogs + Mondays' },
  { id: 'backlinks',  label: 'Backlink outreach prospecting',                          workflow: 'backlink-outreach.yml', day: 'Monday' },
  { id: 'reddit-mon', label: 'Reddit thread monitor',                                  workflow: 'reddit-monitor.yml', day: 'Mon & Thu' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayLondon() {
  // YYYY-MM-DD for the current day in Europe/London
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

function isWeekday() {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(new Date());
  return !['Sat', 'Sun'].includes(day);
}

function isSameLondonDay(iso, dateStr) {
  if (!iso) return false;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso)) === dateStr;
}

// ─── GitHub: today's commits on main ─────────────────────────────────────────
async function getTodayCommits(dateStr) {
  const since = `${dateStr}T00:00:00Z`;
  const { data } = await octokit.repos.listCommits({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, sha: 'main', since, per_page: 100,
  });
  return data
    .map(c => ({ message: c.commit.message.split('\n')[0], date: c.commit.committer.date, url: c.html_url }))
    .filter(c => isSameLondonDay(c.date, dateStr));
}

// ─── GitHub: today's runs for one workflow ───────────────────────────────────
async function getTodayRuns(workflowFile, dateStr) {
  try {
    const { data } = await octokit.actions.listWorkflowRuns({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, workflow_id: workflowFile, per_page: 20,
    });
    return data.workflow_runs.filter(r => isSameLondonDay(r.created_at, dateStr));
  } catch {
    return [];
  }
}

async function getLastSuccessfulRun(workflowFile) {
  try {
    const { data } = await octokit.actions.listWorkflowRuns({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, workflow_id: workflowFile,
      status: 'success', per_page: 1,
    });
    return data.workflow_runs[0] || null;
  } catch {
    return null;
  }
}

// ─── Facebook: exchange for Page token (same pattern as publishers) ──────────
async function getPageToken() {
  const res = await fetch(
    `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}?fields=access_token&access_token=${FB_TOKEN}`
  );
  const data = await res.json();
  return data.access_token || FB_TOKEN;
}

// ─── On-platform checks ───────────────────────────────────────────────────────
async function checkFacebookPosts(dateStr) {
  if (!FB_PAGE_ID || !FB_TOKEN) return null;
  try {
    const token = await getPageToken();
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}/posts?fields=created_time,message,permalink_url&limit=10&access_token=${token}`
    );
    if (!res.ok) throw new Error(`FB posts ${res.status}`);
    const data = await res.json();
    return (data.data || [])
      .filter(p => isSameLondonDay(p.created_time, dateStr))
      .map(p => ({ time: p.created_time, url: p.permalink_url, snippet: (p.message || '').slice(0, 80) }));
  } catch (err) {
    console.warn(`  Facebook platform check failed: ${err.message}`);
    return null; // null = couldn't check (distinct from [] = checked, none found)
  }
}

async function checkInstagramPosts(dateStr) {
  if (!IG_USER_ID || !FB_TOKEN) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VER}/${IG_USER_ID}/media?fields=timestamp,permalink,caption&limit=10&access_token=${FB_TOKEN}`
    );
    if (!res.ok) throw new Error(`IG media ${res.status}`);
    const data = await res.json();
    return (data.data || [])
      .filter(m => isSameLondonDay(m.timestamp, dateStr))
      .map(m => ({ time: m.timestamp, url: m.permalink, snippet: (m.caption || '').slice(0, 80) }));
  } catch (err) {
    console.warn(`  Instagram platform check failed: ${err.message}`);
    return null;
  }
}

async function checkFacebookReels(dateStr) {
  if (!FB_PAGE_ID || !FB_TOKEN) return null;
  try {
    const token = await getPageToken();
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}/videos?fields=created_time,permalink_url,title&limit=10&access_token=${token}`
    );
    if (!res.ok) throw new Error(`FB videos ${res.status}`);
    const data = await res.json();
    return (data.data || [])
      .filter(v => isSameLondonDay(v.created_time, dateStr))
      .map(v => ({ time: v.created_time, url: v.permalink_url ? `https://facebook.com${v.permalink_url}` : '', snippet: v.title || 'Reel video' }));
  } catch (err) {
    console.warn(`  Facebook Reels platform check failed: ${err.message}`);
    return null;
  }
}

// ─── Build one daily action entry ─────────────────────────────────────────────
function buildEntry(action, { commits, runs, platformPosts, dateStr }) {
  const entry = {
    id: action.id,
    label: action.label,
    status: 'pending',
    completedAt: null,
    evidence: '',
    items: [],
    links: [],
  };

  if (action.days === 'weekdays' && !isWeekday()) {
    entry.status = 'not-due';
    entry.evidence = 'Weekend — not scheduled today';
    return entry;
  }

  // Success commits matching this action's pattern
  let matched = [];
  if (action.commitPattern) {
    matched = commits.filter(c => action.commitPattern.test(c.message));
    // AM/PM blog slots share the same commit message — split by London hour
    if (action.slot) {
      matched = matched.filter(c => {
        const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date(c.date)), 10);
        return action.slot === 'am' ? hour < 14 : hour >= 14;
      });
    }
    if (!action.multiple) matched = matched.slice(0, 1);
  }

  const successRuns = runs.filter(r => r.conclusion === 'success');
  const failedRuns  = runs.filter(r => r.conclusion === 'failure');
  const runningNow  = runs.some(r => r.status === 'in_progress' || r.status === 'queued');

  // On-platform verification (Facebook / Instagram / Reels)
  if (action.platformCheck && Array.isArray(platformPosts) && platformPosts.length > 0) {
    entry.status = 'success';
    entry.completedAt = platformPosts[0].time;
    entry.evidence = `Verified live on ${action.platformCheck === 'instagram' ? 'Instagram' : 'Facebook'} — ${platformPosts.length} post${platformPosts.length > 1 ? 's' : ''} visible on the account today`;
    entry.items = platformPosts.map(p => ({ time: p.time, detail: p.snippet, url: p.url }));
    entry.links = platformPosts.filter(p => p.url).map(p => ({ label: 'View post', url: p.url }));
    return entry;
  }

  // Success commit evidence
  if (matched.length > 0) {
    entry.status = 'success';
    entry.completedAt = matched[0].date;
    const what = matched.map(c => {
      const m = c.message.match(action.commitPattern);
      return m && m[1] ? m[1] : c.message;
    });
    entry.evidence = action.evidenceNote
      || `Confirmed by success record (written only after the platform/API accepted the post)`;
    entry.items = matched.map((c, i) => ({ time: c.date, detail: what[i], url: c.url }));
    return entry;
  }

  // Workflow-only actions (deploy, health check, internal links)
  if (!action.commitPattern && successRuns.length > 0) {
    const latest = successRuns[0];
    entry.status = 'success';
    entry.completedAt = latest.updated_at;
    entry.evidence = action.multiple
      ? `${successRuns.length} successful run${successRuns.length > 1 ? 's' : ''} today`
      : 'Workflow completed successfully';
    entry.items = successRuns.map(r => ({ time: r.updated_at, detail: r.display_title || r.name, url: r.html_url }));
    return entry;
  }

  if (runningNow) {
    entry.status = 'running';
    entry.evidence = 'Currently running';
    return entry;
  }

  if (failedRuns.length > 0 && successRuns.length === 0) {
    entry.status = 'failed';
    entry.completedAt = failedRuns[0].updated_at;
    entry.evidence = 'Workflow ran but failed — see run log';
    entry.links = [{ label: 'View failed run', url: failedRuns[0].html_url }];
    return entry;
  }

  // Ran fine but produced nothing (e.g. "no unposted blogs in lookback window")
  if (successRuns.length > 0) {
    entry.status = 'ran-no-output';
    entry.completedAt = successRuns[0].updated_at;
    entry.evidence = 'Ran successfully but published nothing (no eligible content in window)';
    entry.links = [{ label: 'View run', url: successRuns[0].html_url }];
    return entry;
  }

  entry.status = 'pending';
  entry.evidence = 'Not run yet today';
  return entry;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const dateStr = todayLondon();
  console.log(`[System Status] ${dateStr}`);

  console.log('  Fetching today\'s commits...');
  const commits = await getTodayCommits(dateStr);
  console.log(`  ${commits.length} commits today`);

  console.log('  Checking platforms...');
  const [fbPosts, igPosts, reels] = await Promise.all([
    checkFacebookPosts(dateStr),
    checkInstagramPosts(dateStr),
    checkFacebookReels(dateStr),
  ]);
  console.log(`  Facebook: ${fbPosts === null ? 'check unavailable' : fbPosts.length + ' post(s) today'}`);
  console.log(`  Instagram: ${igPosts === null ? 'check unavailable' : igPosts.length + ' post(s) today'}`);
  console.log(`  Reels: ${reels === null ? 'check unavailable' : reels.length + ' video(s) today'}`);

  const daily = [];
  for (const action of DAILY_ACTIONS) {
    const runs = await getTodayRuns(action.workflow, dateStr);
    const platformPosts =
      action.platformCheck === 'facebook'  ? fbPosts :
      action.platformCheck === 'instagram' ? igPosts :
      action.platformCheck === 'reels'     ? reels : undefined;
    const entry = buildEntry(action, { commits, runs, platformPosts, dateStr });
    console.log(`  ${entry.status.padEnd(14)} ${entry.label}`);
    daily.push(entry);
  }

  const weekly = [];
  for (const action of WEEKLY_ACTIONS) {
    const last = await getLastSuccessfulRun(action.workflow);
    weekly.push({
      id: action.id,
      label: action.label,
      cadence: action.day,
      lastSuccess: last ? last.updated_at : null,
      link: last ? last.html_url : null,
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    date: dateStr,
    daily,
    weekly,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'system-status.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nWrote ${path.join(OUT_DIR, 'system-status.json')}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
