/**
 * discover-personal-finance-feeds.js
 *
 * Periodically re-validates every feed in src/data/personalFinanceNewsFeeds.json
 * — both the "active" ones (in case one breaks) and the "candidate" ones (in
 * case a previously-broken/blocked feed comes back online) — and updates the
 * registry accordingly. publish-personal-finance-news.js reads only the
 * "active" list from that file, so this keeps the live feed set self-healing
 * without needing a code change every time something breaks or a new
 * candidate is found worth trying.
 *
 * IMPORTANT — what this script actually is, and isn't: it does NOT search
 * the web for brand-new outlets nobody's heard of — there's no search API
 * wired in here, and a plain scheduled script has no way to do that
 * reliably on its own. What it DOES do is keep re-testing a maintained
 * candidate pool (currently 21 entries that failed validation as of
 * 2026-08-21 — blocked, 404, empty, etc.) plus every currently-active feed,
 * so the list stays accurate over time instead of quietly going stale.
 * Genuinely new candidates get added to the pool by hand (via Claude Code,
 * on request) — this script's job is upkeep, not discovery from scratch.
 *
 * Two statuses are never touched by this script:
 *   - "excluded" — confirmed permanent duplicates (e.g. Daily Mail vs
 *     This Is Money, same publisher, identical content)
 *   - "rejected" — feeds that pass a pure connectivity/item-count test but
 *     were excluded on editorial grounds (wrong audience, mislabelled
 *     content, etc.). This distinction matters: a naive "does it return
 *     valid RSS with enough items" check would happily re-promote a
 *     broker-trade-press feed or a mislabelled politics feed back into the
 *     consumer-facing list, because it passes on connectivity alone. Only
 *     a human reviewing the actual content can catch that — see the
 *     "note" field on any "rejected" entry for why it was excluded.
 *
 * Run: node discover-personal-finance-feeds.js [--dry-run]
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'boxxfinance-site';
const FEEDS_FILE   = 'src/data/personalFinanceNewsFeeds.json';
const MIN_ITEMS    = 3; // a feed with fewer than this is treated as effectively empty

const octokit = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });

async function getFeedsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: FEEDS_FILE });
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, registry: JSON.parse(content) };
}

async function pushFeedsFile(registry, sha, summary) {
  const content = Buffer.from(JSON.stringify(registry, null, 2) + '\n').toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: FEEDS_FILE,
    message: `chore: personal-finance feed check — ${summary}`,
    content, sha, branch: 'main',
  });
}

async function testFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BoxxFinanceBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, note: `HTTP ${res.status}` };
    const xml = await res.text();
    const itemCount = (xml.match(/<item>/gi) || []).length;
    if (itemCount < MIN_ITEMS) return { ok: false, note: `${itemCount} items (too few)` };
    return { ok: true, note: `${itemCount} items` };
  } catch (err) {
    return { ok: false, note: err.name === 'TimeoutError' ? 'timed out' : err.message };
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n[Personal Finance Feed Discovery / Health Check]\n');
  if (isDryRun) console.log('⚠ DRY RUN — no changes written\n');

  const { registry, sha } = await getFeedsFile();
  const today = new Date().toISOString().split('T')[0];

  let promoted = 0, demoted = 0, unchanged = 0;

  for (const feed of registry.feeds) {
    if (feed.status === 'excluded' || feed.status === 'rejected') continue; // never auto-touch permanent/editorial exclusions

    const result = await testFeed(feed.url);
    const wasActive = feed.status === 'active';

    if (result.ok && !wasActive) {
      console.log(`✅ PROMOTED: ${feed.name} — ${result.note} (was: ${feed.status})`);
      feed.status = 'active';
      feed.note = `promoted ${today} — ${result.note}`;
      promoted++;
    } else if (!result.ok && wasActive) {
      console.log(`⚠️  DEMOTED: ${feed.name} — ${result.note} (was: active)`);
      feed.status = 'candidate';
      feed.note = `demoted ${today} — ${result.note}`;
      demoted++;
    } else {
      unchanged++;
    }
  }

  registry.lastChecked = new Date().toISOString();

  console.log(`\nPromoted: ${promoted} | Demoted: ${demoted} | Unchanged: ${unchanged}`);
  console.log(`Active feeds now: ${registry.feeds.filter(f => f.status === 'active').length}`);

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes written.\n');
    return;
  }

  if (promoted === 0 && demoted === 0) {
    console.log('\nNo status changes — skipping commit (lastChecked timestamp not worth a commit on its own).\n');
    return;
  }

  await pushFeedsFile(registry, sha, `${promoted} promoted, ${demoted} demoted`);
  console.log('\n✅ Registry updated.\n');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
