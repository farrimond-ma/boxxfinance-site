/**
 * Boxx Finance — Google Search Console day-level diagnostic (READ ONLY)
 *
 * The existing GSC scripts report on 28- and 90-day windows, which is right for
 * strategy but useless for "impressions dropped this week" — a 90-day aggregate
 * averages a recent dip into invisibility. This script answers that question
 * specifically: what changed in the last 7 days, and which pages/queries caused it.
 *
 * Writes nothing. No sheet updates, no scheduling, no AI calls. Pure stdout, so
 * it is safe to run at any time without side effects on the content pipeline.
 *
 * Reports:
 *   1. Daily impressions/clicks/position for the last 30 days
 *   2. Last 7 days vs prior 7 days, totals
 *   3. Biggest movers by page (both directions)
 *   4. Biggest movers by query (both directions)
 *   5. Discover as a separate surface — spiky by nature, and a decaying Discover
 *      spike is a common cause of an apparent site-wide impressions drop
 *
 * Run: node gsc-daily-diagnostic.js
 */

require('dotenv').config();
const { google } = require('googleapis');

const SITE_URL = 'sc-domain:boxxfinance.co.uk';
const SC_LAG_DAYS = 3; // Search Console data lags ~3 days
const TREND_DAYS = 30;
const MOVERS = 15;

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  let credentials;
  try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
  catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

const isoDate = (d) => d.toISOString().split('T')[0];

function windows() {
  const end = new Date(); end.setDate(end.getDate() - SC_LAG_DAYS);
  const trendStart = new Date(end); trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));
  const recentStart = new Date(end); recentStart.setDate(recentStart.getDate() - 6);
  const priorEnd = new Date(recentStart); priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - 6);
  return {
    trend:  { startDate: isoDate(trendStart),  endDate: isoDate(end) },
    recent: { startDate: isoDate(recentStart), endDate: isoDate(end) },
    prior:  { startDate: isoDate(priorStart),  endDate: isoDate(priorEnd) },
  };
}

async function query(wm, window, dimensions, rowLimit = 5000, type = 'web') {
  const res = await wm.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: { startDate: window.startDate, endDate: window.endDate, dimensions, rowLimit, type },
  });
  return (res.data.rows || []).map(r => ({
    key: (r.keys || []).join(' | '),
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    position: r.position || 0,
  }));
}

function total(rows) {
  let clicks = 0, impressions = 0, wpos = 0;
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; wpos += r.position * r.impressions; }
  return { clicks, impressions, position: impressions ? wpos / impressions : 0 };
}

const pct = (now, before) => before === 0 ? (now > 0 ? '+new' : '0%')
  : `${now >= before ? '+' : ''}${(((now - before) / before) * 100).toFixed(1)}%`;

// Compare two row sets keyed by dimension, returning biggest impression movers.
function movers(recentRows, priorRows) {
  const map = new Map();
  for (const r of priorRows) map.set(r.key, { key: r.key, before: r.impressions, now: 0, pos: r.position });
  for (const r of recentRows) {
    const e = map.get(r.key) || { key: r.key, before: 0, now: 0, pos: r.position };
    e.now = r.impressions; e.pos = r.position;
    map.set(r.key, e);
  }
  const all = [...map.values()].map(e => ({ ...e, delta: e.now - e.before }));
  return {
    down: all.filter(e => e.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, MOVERS),
    up:   all.filter(e => e.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, MOVERS),
  };
}

function printMovers(label, m) {
  console.log(`\n  ${label} — biggest DROPS (impressions):`);
  if (!m.down.length) console.log('    (none)');
  m.down.forEach(e => console.log(`    ${String(e.delta).padStart(7)}  ${e.before} → ${e.now}  pos ${e.pos.toFixed(1)}  ${e.key.slice(0, 80)}`));
  console.log(`\n  ${label} — biggest GAINS (impressions):`);
  if (!m.up.length) console.log('    (none)');
  m.up.forEach(e => console.log(`    ${String('+' + e.delta).padStart(7)}  ${e.before} → ${e.now}  pos ${e.pos.toFixed(1)}  ${e.key.slice(0, 80)}`));
}

async function main() {
  const w = windows();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Boxx — GSC Day-Level Diagnostic (read only) ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`Recent 7d: ${w.recent.startDate} → ${w.recent.endDate}`);
  console.log(`Prior  7d: ${w.prior.startDate} → ${w.prior.endDate}`);
  console.log(`Trend:     ${w.trend.startDate} → ${w.trend.endDate}\n`);

  const auth = await getAuth();
  const wm = google.webmasters({ version: 'v3', auth });

  // 1. Daily trend
  const daily = await query(wm, w.trend, ['date']);
  daily.sort((a, b) => a.key.localeCompare(b.key));
  console.log('── Daily totals (last 30 days) ──');
  console.log('  date          impr   clicks   pos');
  const maxImpr = Math.max(...daily.map(d => d.impressions), 1);
  for (const d of daily) {
    const bar = '█'.repeat(Math.round((d.impressions / maxImpr) * 30));
    console.log(`  ${d.key}  ${String(d.impressions).padStart(6)}  ${String(d.clicks).padStart(6)}  ${d.position.toFixed(1).padStart(5)}  ${bar}`);
  }

  // 2. 7d vs prior 7d
  const [recentRows, priorRows] = await Promise.all([
    query(wm, w.recent, ['page']),
    query(wm, w.prior, ['page']),
  ]);
  const rt = total(recentRows), pt = total(priorRows);
  console.log('\n── Last 7 days vs prior 7 days ──');
  console.log(`  Impressions: ${pt.impressions} → ${rt.impressions}  (${pct(rt.impressions, pt.impressions)})`);
  console.log(`  Clicks:      ${pt.clicks} → ${rt.clicks}  (${pct(rt.clicks, pt.clicks)})`);
  console.log(`  Avg position:${pt.position.toFixed(1)} → ${rt.position.toFixed(1)}`);
  console.log(`  Pages with impressions: ${priorRows.length} → ${recentRows.length}`);

  printMovers('PAGES', movers(recentRows, priorRows));

  // 3. Query movers
  const [recentQ, priorQ] = await Promise.all([
    query(wm, w.recent, ['query']),
    query(wm, w.prior, ['query']),
  ]);
  printMovers('QUERIES', movers(recentQ, priorQ));

  // 4. Discover — separate surface, spiky, and a decaying spike here reads as a
  //    site-wide drop if you only look at the combined number.
  console.log('\n── Discover (separate surface) ──');
  try {
    const [dRecent, dPrior] = await Promise.all([
      query(wm, w.recent, ['date'], 100, 'discover'),
      query(wm, w.prior, ['date'], 100, 'discover'),
    ]);
    const dr = total(dRecent), dp = total(dPrior);
    console.log(`  Impressions: ${dp.impressions} → ${dr.impressions}  (${pct(dr.impressions, dp.impressions)})`);
    console.log(`  Clicks:      ${dp.clicks} → ${dr.clicks}  (${pct(dr.clicks, dp.clicks)})`);
  } catch {
    console.log('  (no Discover data available)');
  }

  console.log('\n✅ Done (nothing written).');
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
