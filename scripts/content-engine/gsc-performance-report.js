/**
 * Boxx Finance — Google Search Console 90-Day Performance Report ("Report B")
 *
 * The companion to search-console-insights.js. Where insights.js extracts
 * point-in-time keyword OPPORTUNITIES from a 28-day window, this script answers
 * the strategic question: "is the site actually improving?" — and feeds
 * TRENDING (rising) search phrases into the same content-gap loop the rest of
 * the system already consumes.
 *
 * It does three things every run:
 *
 *   1. PERFORMANCE TREND — pulls the last 90 days AND the prior 90 days, then
 *      compares clicks / impressions / avg position / CTR. Produces a plain-
 *      English verdict (growing / flat / declining) written to a GSC_Report tab
 *      and echoed to the GitHub Actions run summary.
 *
 *   2. LIVING HISTORY — appends one row per run to a GSC_History tab so the
 *      trend accumulates over time. This is what makes the report "kept updated"
 *      rather than a one-off snapshot.
 *
 *   3. TRENDING CONTENT GAPS — finds queries whose impressions are RISING fast
 *      (this 90d vs prior 90d) but that rank below page 1 and have no dedicated
 *      page, and appends them to the Search_Console tab tagged as content gaps.
 *      search-console-actions.js (Action 2) then schedules them as blog posts —
 *      so content gets generated for trending phrases, SEO + GEO, automatically.
 *
 * It also folds in a GEO (AI visibility) health line from the AI_Visibility tab
 * so a single scorecard covers both search engines and AI answer engines.
 *
 * Run: node gsc-performance-report.js [--dry-run]
 *
 * Runs weekly in search-console-insights.yml, AFTER insights.js (which rewrites
 * the Search_Console tab) and BEFORE search-console-actions.js (which schedules
 * the gaps this script appends).
 */

require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'sc-domain:boxxfinance.co.uk'; // domain property format
const REPORT_TAB     = 'GSC_Report';
const HISTORY_TAB    = 'GSC_History';
const OPP_TAB        = 'Search_Console';   // shared with insights.js / actions.js
const WINDOW_DAYS    = 90;
const SC_LAG_DAYS    = 3;                  // Search Console data lags ~3 days
const MAX_TRENDING_GAPS = 15;

// ─── Auth (matches search-console-insights.js) ───────────────────────────────

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  let credentials;
  try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
  catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
  });
}

// ─── Date windows: current 90d and the prior 90d ─────────────────────────────

function isoDate(d) { return d.toISOString().split('T')[0]; }

function getWindows() {
  const end = new Date(); end.setDate(end.getDate() - SC_LAG_DAYS);
  const currentStart = new Date(end); currentStart.setDate(currentStart.getDate() - (WINDOW_DAYS - 1));
  const priorEnd = new Date(currentStart); priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - (WINDOW_DAYS - 1));
  return {
    current: { startDate: isoDate(currentStart), endDate: isoDate(end) },
    prior:   { startDate: isoDate(priorStart),   endDate: isoDate(priorEnd) },
  };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function queryGSC(wm, window, dimensions, rowLimit = 5000) {
  try {
    const res = await wm.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate: window.startDate, endDate: window.endDate, dimensions, rowLimit },
    });
    return (res.data.rows || []).map(r => ({
      keys: r.keys || [],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));
  } catch (err) {
    if (err.code === 403) {
      console.error('\n❌ Search Console API permission denied (403).');
      console.error('   Add the service account (client_email in GOOGLE_CREDENTIALS)');
      console.error('   as a user in Search Console → Settings → Users and permissions.\n');
    }
    throw err;
  }
}

// Aggregate a set of rows into a single totals object. Position is
// impression-weighted, matching how Search Console reports average position.
function aggregate(rows) {
  let clicks = 0, impressions = 0, weightedPos = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weightedPos += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPos / impressions : 0,
  };
}

// ─── Trend maths ──────────────────────────────────────────────────────────────

function pctChange(current, prior) {
  if (!prior) return current ? Infinity : 0;
  return ((current - prior) / prior) * 100;
}

function fmtPct(v) {
  if (v === Infinity) return 'new';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(0)}%`;
}

// Turn the deltas into a plain-English verdict. Position is inverted — a LOWER
// number is better, so a negative position delta is an improvement.
function buildVerdict(cur, pri) {
  const imprChange = pctChange(cur.impressions, pri.impressions);
  const clickChange = pctChange(cur.clicks, pri.clicks);
  const posDelta = pri.position ? (cur.position - pri.position) : 0; // negative = improved

  const lines = [];
  let health = 'flat';

  if (pri.impressions === 0 && pri.clicks === 0) {
    health = 'baseline';
    lines.push('This is the first 90-day window with meaningful data — it sets the baseline. Future runs will measure momentum against it.');
    return { health, lines, imprChange, clickChange, posDelta };
  }

  // Impressions are the leading indicator for a young site.
  if (imprChange >= 20) {
    health = 'growing';
    lines.push(`Impressions are up ${fmtPct(imprChange)} vs the prior 90 days — Google is serving your pages far more often. This is the single most important early signal and it is pointing the right way.`);
  } else if (imprChange <= -20) {
    health = 'declining';
    lines.push(`Impressions are down ${fmtPct(imprChange)} vs the prior 90 days. A sustained fall while pages stay indexed is the one pattern worth investigating (technical regression, lost pages, or a Google update).`);
  } else {
    lines.push(`Impressions are broadly flat (${fmtPct(imprChange)}) vs the prior 90 days.`);
  }

  // Average position (lower is better).
  if (posDelta <= -1) {
    lines.push(`Average position improved by ${Math.abs(posDelta).toFixed(1)} places (now ${cur.position.toFixed(1)}). You are climbing the rankings — this is where clicks come from next.`);
    if (health !== 'declining') health = 'growing';
  } else if (posDelta >= 1) {
    lines.push(`Average position slipped by ${posDelta.toFixed(1)} places (now ${cur.position.toFixed(1)}). Expected some weeks as new low-ranking pages get indexed and drag the average down — watch it over the next month.`);
  } else {
    lines.push(`Average position is stable at ${cur.position.toFixed(1)}.`);
  }

  // Clicks (lagging indicator).
  if (clickChange >= 20) {
    lines.push(`Clicks are up ${fmtPct(clickChange)} — the impressions are starting to convert into visits.`);
  } else if (cur.position > 15) {
    lines.push(`Clicks remain low, which is normal at an average position of ${cur.position.toFixed(1)} (roughly page ${Math.ceil(cur.position / 10)}). Clicks follow once position crosses into the top 10.`);
  }

  return { health, lines, imprChange, clickChange, posDelta };
}

// ─── Trending (rising) content gaps ──────────────────────────────────────────
// Queries whose impressions are rising fast but that rank below page 1 and have
// no dedicated page — the best candidates for new content. Fed into the same
// Search_Console tab that search-console-actions.js already consumes.

function findTrendingGaps(currentByQuery, priorByQuery, pageRows) {
  const priorMap = new Map(priorByQuery.map(r => [r.keys[0], r]));

  const dedicatedPages = new Set(
    pageRows
      .filter(r => /\/insights\/|\/locations\//.test(r.keys[0]))
      .map(r => r.keys[0].toLowerCase())
  );

  const rising = [];
  for (const r of currentByQuery) {
    const query = r.keys[0];
    if (!query) continue;
    const prior = priorMap.get(query);
    const priorImpr = prior ? prior.impressions : 0;

    // Momentum: at least doubled, or brand-new with real volume this window.
    const isRising = r.impressions >= 15 &&
      (priorImpr === 0 ? r.impressions >= 20 : r.impressions >= priorImpr * 2);
    if (!isRising) continue;

    // Room to grow — already-winning queries aren't content gaps.
    if (r.position < 8) continue;

    // Skip if a dedicated page already targets the head term of this query.
    const head = query.toLowerCase().split(' ').slice(0, 2).join(' ');
    if ([...dedicatedPages].some(p => p.includes(head.replace(/\s+/g, '-')))) continue;

    const growth = priorImpr === 0 ? Infinity : (r.impressions / priorImpr);
    rising.push({
      query,
      position: Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      priorImpressions: priorImpr,
      clicks: r.clicks,
      ctr: (r.ctr * 100).toFixed(1) + '%',
      growth,
    });
  }

  // Rank by absolute impression volume × how fast it's climbing.
  return rising
    .sort((a, b) => (b.impressions * (b.growth === Infinity ? 3 : b.growth)) -
                    (a.impressions * (a.growth === Infinity ? 3 : a.growth)))
    .slice(0, MAX_TRENDING_GAPS);
}

// ─── GEO / AI visibility summary (optional, from AI_Visibility tab) ──────────

async function readAIVisibilitySummary(sheets) {
  let res;
  try {
    res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'AI_Visibility!A:M' });
  } catch { return null; }
  const rows = res.data.values || [];
  if (rows.length < 2) return null;

  let total = 0, boxxMentioned = 0, competitorTotal = 0;
  for (const r of rows.slice(1)) {
    if (!r[2] || (r[12] || '')) continue; // needs prompt, no error
    total++;
    if ((r[6] || '').toUpperCase() === 'YES') boxxMentioned++;
    competitorTotal += parseInt(r[9]) || 0;
  }
  if (total === 0) return null;
  return {
    checks: total,
    boxxMentionRate: Math.round((boxxMentioned / total) * 100),
    avgCompetitors: (competitorTotal / total).toFixed(1),
  };
}

// ─── Sheet writers ────────────────────────────────────────────────────────────

async function ensureTab(sheets, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(s => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    console.log(`  Created tab: ${title}`);
  }
}

async function writeReportTab(sheets, cur, pri, verdict, windows, geo, trending) {
  await ensureTab(sheets, REPORT_TAB);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${REPORT_TAB}!A:F` });

  const runDate = isoDate(new Date());
  const rows = [
    [`90-Day Performance Report — ${runDate}`],
    [`Current window: ${windows.current.startDate} → ${windows.current.endDate}  ·  Prior window: ${windows.prior.startDate} → ${windows.prior.endDate}`],
    [`VERDICT: ${verdict.health.toUpperCase()}`],
    [],
    ['METRIC', 'LAST 90 DAYS', 'PRIOR 90 DAYS', 'CHANGE', '', ''],
    ['Clicks',          cur.clicks,               pri.clicks,               fmtPct(verdict.clickChange), '', ''],
    ['Impressions',     cur.impressions,          pri.impressions,          fmtPct(verdict.imprChange),  '', ''],
    ['Avg position',    cur.position.toFixed(1),  pri.position.toFixed(1),  (verdict.posDelta <= 0 ? '' : '+') + verdict.posDelta.toFixed(1) + ' places', '', ''],
    ['CTR',             (cur.ctr * 100).toFixed(2) + '%', (pri.ctr * 100).toFixed(2) + '%', fmtPct(pctChange(cur.ctr, pri.ctr)), '', ''],
    [],
    ['WHAT THIS MEANS'],
    ...verdict.lines.map(l => [l]),
    [],
  ];

  if (geo) {
    rows.push(['GEO / AI ANSWER ENGINES']);
    rows.push([`Boxx is named in ${geo.boxxMentionRate}% of ${geo.checks} AI-model checks (avg ${geo.avgCompetitors} competitors cited per answer).`]);
    rows.push([geo.boxxMentionRate >= 50
      ? 'Healthy AI presence — Boxx is cited in the majority of answer-engine responses.'
      : 'AI presence is below half of checks — Action 0 in the engine schedules authority articles to close these GEO gaps.']);
    rows.push([]);
  }

  rows.push(['TRENDING QUERIES FEEDING THE CONTENT ENGINE (rising impressions, no dedicated page)']);
  rows.push(['QUERY', 'POSITION', 'IMPRESSIONS (90d)', 'PRIOR 90d', 'GROWTH', 'CLICKS']);
  if (trending.length === 0) {
    rows.push(['— none this run —']);
  } else {
    trending.forEach(t => rows.push([
      t.query, t.position, t.impressions, t.priorImpressions,
      t.growth === Infinity ? 'new' : `${t.growth.toFixed(1)}×`, t.clicks,
    ]));
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${REPORT_TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  console.log(`  Wrote ${REPORT_TAB} scorecard`);
}

async function appendHistory(sheets, cur, verdict) {
  await ensureTab(sheets, HISTORY_TAB);
  // Seed a header row once.
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${HISTORY_TAB}!A1:H1` });
  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HISTORY_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['Run date', 'Clicks (90d)', 'Impressions (90d)', 'Avg position', 'CTR', 'Impr change', 'Verdict', 'Window end']] },
    });
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HISTORY_TAB}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[
      isoDate(new Date()),
      cur.clicks,
      cur.impressions,
      cur.position.toFixed(1),
      (cur.ctr * 100).toFixed(2) + '%',
      fmtPct(verdict.imprChange),
      verdict.health,
      getWindows().current.endDate,
    ]] },
  });
  console.log(`  Appended run to ${HISTORY_TAB}`);
}

// Append trending gaps into the Search_Console tab in the SAME row shape
// insights.js uses, so search-console-actions.js (Action 2) schedules them.
// Row: [query, TYPE, position, impressions, clicks, ctr, detail, '']
async function appendTrendingGaps(sheets, trending) {
  if (trending.length === 0) return 0;
  const rows = trending.map(t => [
    t.query,
    'Content gap',
    t.position,
    t.impressions,
    t.clicks,
    t.ctr,
    `Trending — impressions ${t.growth === Infinity ? 'new this window' : `${t.growth.toFixed(1)}× vs prior 90d`}, no dedicated page`,
    '',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${OPP_TAB}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  console.log(`  Appended ${rows.length} trending content gap(s) to ${OPP_TAB} for the content engine`);
  return rows.length;
}

// ─── GitHub Actions run summary ──────────────────────────────────────────────

function writeStepSummary(cur, pri, verdict, geo, trending, windows) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const l = [];
  l.push('## 📊 90-Day Search Console Performance Report');
  l.push(`**Verdict: ${verdict.health.toUpperCase()}**  ·  ${windows.current.startDate} → ${windows.current.endDate}`);
  l.push('');
  l.push('| Metric | Last 90d | Prior 90d | Change |');
  l.push('|---|---|---|---|');
  l.push(`| Clicks | ${cur.clicks} | ${pri.clicks} | ${fmtPct(verdict.clickChange)} |`);
  l.push(`| Impressions | ${cur.impressions} | ${pri.impressions} | ${fmtPct(verdict.imprChange)} |`);
  l.push(`| Avg position | ${cur.position.toFixed(1)} | ${pri.position.toFixed(1)} | ${verdict.posDelta <= 0 ? '' : '+'}${verdict.posDelta.toFixed(1)} |`);
  l.push(`| CTR | ${(cur.ctr * 100).toFixed(2)}% | ${(pri.ctr * 100).toFixed(2)}% | ${fmtPct(pctChange(cur.ctr, pri.ctr))} |`);
  l.push('');
  verdict.lines.forEach(line => l.push('- ' + line));
  if (geo) { l.push(''); l.push(`**GEO:** Boxx named in ${geo.boxxMentionRate}% of ${geo.checks} AI checks (avg ${geo.avgCompetitors} competitors).`); }
  l.push('');
  l.push(`**Trending queries feeding the content engine:** ${trending.length}`);
  trending.slice(0, 8).forEach(t => l.push(`- \`${t.query}\` — ${t.impressions} impr @ pos ${t.position} (${t.growth === Infinity ? 'new' : t.growth.toFixed(1) + '×'})`));
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, l.join('\n') + '\n'); } catch { /* non-fatal */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Boxx — 90-Day GSC Performance Report (B)   ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const windows = getWindows();
  console.log(`Current: ${windows.current.startDate} → ${windows.current.endDate}`);
  console.log(`Prior:   ${windows.prior.startDate} → ${windows.prior.endDate}\n`);

  if (isDryRun) { console.log('⚠  DRY RUN — no API calls, no writes.'); return; }

  const auth = await getAuth();
  const wm = google.webmasters({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Fetching current + prior 90-day windows...');
  const [curByDate, priByDate, curByQuery, priByQuery, pageRows] = await Promise.all([
    queryGSC(wm, windows.current, ['date']),
    queryGSC(wm, windows.prior,   ['date']),
    queryGSC(wm, windows.current, ['query']),
    queryGSC(wm, windows.prior,   ['query']),
    queryGSC(wm, windows.current, ['page'], 1000),
  ]);

  const cur = aggregate(curByDate);
  const pri = aggregate(priByDate);
  console.log(`  Current: ${cur.clicks} clicks, ${cur.impressions} impr, pos ${cur.position.toFixed(1)}`);
  console.log(`  Prior:   ${pri.clicks} clicks, ${pri.impressions} impr, pos ${pri.position.toFixed(1)}`);

  const verdict = buildVerdict(cur, pri);
  console.log(`\n  Verdict: ${verdict.health.toUpperCase()}`);
  verdict.lines.forEach(l => console.log('   • ' + l));

  const trending = findTrendingGaps(curByQuery, priByQuery, pageRows);
  console.log(`\n  Trending content gaps: ${trending.length}`);
  trending.slice(0, 8).forEach(t => console.log(`   • "${t.query}" — ${t.impressions} impr @ pos ${t.position} (${t.growth === Infinity ? 'new' : t.growth.toFixed(1) + '×'})`));

  const geo = await readAIVisibilitySummary(sheets);
  if (geo) console.log(`\n  GEO: Boxx in ${geo.boxxMentionRate}% of ${geo.checks} AI checks`);

  console.log('\nWriting to Google Sheet...');
  await writeReportTab(sheets, cur, pri, verdict, windows, geo, trending);
  await appendHistory(sheets, cur, verdict);
  await appendTrendingGaps(sheets, trending);

  writeStepSummary(cur, pri, verdict, geo, trending, windows);

  console.log('\n✅ Done. View report at:');
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## ❌ GSC Performance Report failed\n\n\`${err.message}\`\n`); } catch { /* ignore */ }
  }
  process.exit(1);
});
