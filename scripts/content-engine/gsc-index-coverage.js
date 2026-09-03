/**
 * Boxx Finance — Index Coverage Watchdog
 *
 * The check that was missing when the site sat at position ~40 for months: a
 * fault that suppressed rankings (mass "Page with redirect" + duplicate-canonical
 * errors) went undetected because nothing watched whether Google was actually
 * INDEXING the pages. This closes that hole.
 *
 * Weekly it samples the sitemap URLs (plus every key money page) and asks the
 * Search Console URL Inspection API for each one's real coverage state, then:
 *
 *   - Writes a summary + the problem URLs to an 'Index_Coverage' sheet tab.
 *   - Distinguishes ACTIONABLE errors (redirect / canonical / noindex / blocked)
 *     from benign PENDING states (new pages Google simply hasn't crawled yet),
 *     so a young site with fresh pages doesn't trigger false alarms.
 *   - EXITS NON-ZERO if a key page is in an error state, or if the error rate
 *     across the sample crosses the threshold — which makes the Failure Watchdog
 *     file a GitHub issue and email immediately (same alerting as the rest of
 *     the engine).
 *
 * Run: node gsc-index-coverage.js [--dry-run]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SITE_URL       = 'sc-domain:boxxfinance.co.uk'; // domain property (inspection siteUrl)
const SITE_ORIGIN    = 'https://boxxfinance.co.uk';
const SITEMAP_PATH   = path.resolve(__dirname, '../../public/sitemap.xml');
const OUTPUT_TAB     = 'Index_Coverage';

const MAX_SAMPLE       = 35;    // URL Inspection API quota is 2000/day — sample, don't scan all
const INSPECT_DELAY_MS = 250;   // stay well under the 600/min rate limit
const ERROR_RATIO_ALERT = 0.15; // alert if >15% of sampled pages are in an ERROR state

// Money pages that must ALWAYS be indexed — every one is inspected, never
// sampled out. Updated 2026-09 to the six focus services: commercial mortgages
// was listed here and is now de-listed, so an alert on it would have been a
// false alarm about a page the site no longer promotes.
const KEY_PATHS = [
  '/',
  '/funding-solutions',
  '/funding-solutions/bridging-loans',
  '/funding-solutions/development-finance',
  '/funding-solutions/buy-to-let-refinance',
  '/funding-solutions/bad-credit-mortgages',
  '/funding-solutions/second-charge-mortgages',
  '/funding-solutions/secured-loans',
  '/bridging-loan-calculator',
  '/insights',
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Sitemap + sampling ───────────────────────────────────────────────────────

function readSitemapUrls() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].trim());
  return [...new Set(urls)];
}

// Every key page + a random sample of the rest, capped at MAX_SAMPLE.
function buildSample(allUrls) {
  const keySet = new Set(KEY_PATHS.map(p => SITE_ORIGIN + (p === '/' ? '' : p)));
  const keys = allUrls.filter(u => keySet.has(u.replace(/\/$/, '')) || keySet.has(u));
  // Guarantee key paths are present even if the sitemap omits a trailing form.
  for (const p of KEY_PATHS) {
    const full = SITE_ORIGIN + (p === '/' ? '/' : p);
    if (!keys.some(k => k.replace(/\/$/, '') === full.replace(/\/$/, ''))) keys.push(full);
  }
  const rest = allUrls.filter(u => !keys.includes(u));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const sampled = rest.slice(0, Math.max(0, MAX_SAMPLE - keys.length));
  return { inspect: [...new Set([...keys, ...sampled])], keySet: new Set(keys.map(k => k.replace(/\/$/, ''))) };
}

// ─── Classify a coverage state ────────────────────────────────────────────────

function classify(verdict, coverageState) {
  if (verdict === 'PASS') return 'indexed';
  const s = (coverageState || '').toLowerCase();
  // Actionable faults — the class of problem that suppressed rankings for months.
  if (/redirect|canonical|noindex|blocked|not found|forbidden|error|soft 404|excluded by/.test(s)) return 'error';
  // Benign — Google just hasn't finished with these yet (normal for new pages).
  if (/discovered|crawled|unknown to google|pending/.test(s)) return 'pending';
  return 'error'; // unknown non-PASS states are treated as actionable
}

// ─── Inspect one URL ──────────────────────────────────────────────────────────

async function inspectUrl(inspector, url) {
  try {
    const res = await inspector.urlInspection.index.inspect({
      requestBody: { inspectionUrl: url, siteUrl: SITE_URL },
    });
    const r = res.data.inspectionResult?.indexStatusResult || {};
    return { url, verdict: r.verdict || 'UNKNOWN', coverageState: r.coverageState || 'unknown', state: classify(r.verdict, r.coverageState) };
  } catch (err) {
    if (err.code === 403) {
      console.error('\n❌ URL Inspection API denied (403). Enable "Google Search Console API" in the');
      console.error('   Cloud project and ensure the service account is a full/owner user of the property.\n');
      throw err;
    }
    // NOT 'error'. A failed API call means the watchdog could not measure this
    // URL — it says nothing about whether Google has indexed it. Counting these
    // as coverage errors let quota exhaustion, transient 500s and permission
    // problems masquerade as "your pages are falling out of the index", which
    // is the exact confusion this watchdog exists to prevent.
    return { url, verdict: 'API_ERROR', coverageState: err.message.slice(0, 60), state: 'apiError' };
  }
}

// ─── Sheet output ─────────────────────────────────────────────────────────────

async function writeTab(sheets, results, summary) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  if (!meta.data.sheets?.some(s => s.properties?.title === OUTPUT_TAB)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: OUTPUT_TAB } } }] } });
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${OUTPUT_TAB}!A:D` });
  const runDate = new Date().toISOString().split('T')[0];
  // apiError rows are listed too — when the run fails because it could not
  // measure, the operator needs the actual API message, not an empty table.
  const problems = results.filter(r => r.state === 'error' || r.state === 'apiError');
  const rows = [
    [`Index Coverage — ${runDate}`],
    [`Inspected ${summary.total} URLs · indexed ${summary.indexed} · errors ${summary.errors} · pending ${summary.pending} · unmeasurable ${summary.apiErrors} · error rate ${(summary.errorRatio * 100).toFixed(0)}%`],
    [summary.cannotMeasure
      ? `❌ COULD NOT MEASURE — ${summary.apiErrors}/${summary.total} URLs failed inspection. A fault in the check, not an indexing problem.`
      : summary.coverageAlert
        ? '⚠ ALERT — indexing problems detected (see below)'
        : '✅ Healthy — no actionable indexing errors'],
    [],
    ['URL', 'STATE', 'VERDICT', 'COVERAGE STATE'],
    ...problems.map(r => [r.url, r.state, r.verdict, r.coverageState]),
    ...(problems.length === 0 ? [['— no error-state pages —']] : []),
    [],
    ['ALL INSPECTED'],
    ['URL', 'STATE', 'VERDICT', 'COVERAGE STATE'],
    ...results.map(r => [r.url, r.state, r.verdict, r.coverageState]),
  ];
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${OUTPUT_TAB}!A1`, valueInputOption: 'RAW', requestBody: { values: rows } });
}

function writeStepSummary(results, summary) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  // apiError rows are listed too — when the run fails because it could not
  // measure, the operator needs the actual API message, not an empty table.
  const problems = results.filter(r => r.state === 'error' || r.state === 'apiError');
  const l = [];
  l.push('## 🔎 Index Coverage Watchdog');
  if (summary.cannotMeasure) {
    l.push(`**❌ COULD NOT MEASURE — ${summary.apiErrors}/${summary.total} URLs failed inspection**`);
    l.push('');
    l.push('This is a fault in the check itself, **not** evidence of an indexing problem. Usual causes: the Search Console API is not enabled in the Cloud project, the service account is not a full/owner user of the `sc-domain` property, or the daily quota is exhausted.');
    const first = results.find(r => r.state === 'apiError');
    if (first) l.push(`\nFirst error: \`${first.coverageState}\``);
  } else if (summary.coverageAlert) {
    l.push('**⚠ ALERT — indexing problems detected**');
  } else {
    l.push('**✅ Healthy**');
  }
  l.push('');
  l.push(`Inspected **${summary.total}** URLs · indexed **${summary.indexed}** · errors **${summary.errors}** · pending **${summary.pending}** · unmeasurable **${summary.apiErrors}** · error rate **${(summary.errorRatio * 100).toFixed(0)}%**`);
  if (problems.length) {
    l.push('');
    l.push('| URL | Verdict | Coverage state |');
    l.push('|---|---|---|');
    problems.slice(0, 20).forEach(r => l.push(`| ${r.url.replace(SITE_ORIGIN, '')} | ${r.verdict} | ${r.coverageState} |`));
  }
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, l.join('\n') + '\n'); } catch { /* non-fatal */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Boxx — Index Coverage Watchdog            ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const allUrls = readSitemapUrls();
  console.log(`Sitemap URLs: ${allUrls.length}`);
  const { inspect, keySet } = buildSample(allUrls);
  console.log(`Inspecting ${inspect.length} (all ${KEY_PATHS.length} key pages + sample)\n`);

  if (isDryRun) { console.log('⚠  DRY RUN — no API calls.'); inspect.forEach(u => console.log('  would inspect: ' + u)); return; }

  const auth = await getAuth();
  const inspector = google.searchconsole({ version: 'v1', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const results = [];
  for (const url of inspect) {
    const r = await inspectUrl(inspector, url);
    results.push(r);
    console.log(`  ${r.state.padEnd(7)} ${r.verdict.padEnd(8)} ${r.url.replace(SITE_ORIGIN, '') || '/'}  (${r.coverageState})`);
    await new Promise(res => setTimeout(res, INSPECT_DELAY_MS));
  }

  const indexed   = results.filter(r => r.state === 'indexed').length;
  const errors    = results.filter(r => r.state === 'error').length;
  const pending   = results.filter(r => r.state === 'pending').length;
  const apiErrors = results.filter(r => r.state === 'apiError').length;

  // Error rate is measured against URLs we could actually inspect. Including
  // unmeasurable ones in the denominator would understate a real problem;
  // counting them as errors would invent one.
  const measurable = results.length - apiErrors;
  const errorRatio = measurable ? errors / measurable : 0;

  // Two distinct alerts, deliberately separated. A watchdog that cannot tell
  // "the site has an indexing problem" from "I could not measure the site" is
  // not doing its job — it just fails weekly and trains everyone to ignore it.
  const keyInError = results.filter(r => r.state === 'error' && keySet.has(r.url.replace(/\/$/, '')));
  const coverageAlert = keyInError.length > 0 || errorRatio >= ERROR_RATIO_ALERT;
  const cannotMeasure = apiErrors > results.length * 0.25;
  const alert = coverageAlert || cannotMeasure;

  const summary = { total: results.length, indexed, errors, pending, apiErrors, errorRatio, alert, coverageAlert, cannotMeasure };
  console.log(`\n  Indexed ${indexed} · errors ${errors} · pending ${pending} · unmeasurable ${apiErrors} · error rate ${(errorRatio * 100).toFixed(0)}% of ${measurable} measured`);
  if (keyInError.length) console.log(`  ⚠ KEY pages in error: ${keyInError.map(r => r.url.replace(SITE_ORIGIN, '')).join(', ')}`);
  if (cannotMeasure) {
    console.log(`  ⚠ ${apiErrors}/${results.length} URLs could not be inspected — this is a WATCHDOG fault, not an indexing one.`);
    console.log(`     First error: ${results.find(r => r.state === 'apiError')?.coverageState}`);
  }

  console.log('\nWriting to Google Sheet...');
  await writeTab(sheets, results, summary);
  writeStepSummary(results, summary);

  if (alert) {
    if (summary.cannotMeasure) {
      console.error(`\n❌ Index coverage watchdog COULD NOT MEASURE ${apiErrors}/${results.length} URLs.`);
      console.error('   This is a fault in the check, not evidence of an indexing problem.');
      console.error('   Usual causes: the Search Console API is not enabled in the Cloud project, or the');
      console.error('   service account is not a full/owner user of the sc-domain property, or daily quota.');
    }
    if (summary.coverageAlert) {
      console.error('\n❌ Index coverage ALERT — see Index_Coverage tab. Failing the run so it surfaces via email.');
    }
    process.exit(1);
  }
  console.log('\n✅ Index coverage healthy.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## ❌ Index Coverage Watchdog failed\n\n\`${err.message}\`\n`); } catch { /* ignore */ }
  }
  process.exit(1);
});
