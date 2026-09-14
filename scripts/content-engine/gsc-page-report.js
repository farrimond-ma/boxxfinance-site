/**
 * Boxx Finance — per-URL Search Console report (READ ONLY)
 *
 * For deciding which article in a group of overlapping posts to keep before
 * merging the rest into it with 301s. Redirecting the page Google already
 * prefers throws away its ranking, so pick winners from data, not titles.
 *
 * Input: GROUPS env var — groups separated by ";", slugs within a group by ",".
 * For each /insights/<slug>, over the last 90 days: clicks, impressions,
 * average position, plus its top queries. Writes nothing.
 *
 * Run: GROUPS="a,b;c,d" node gsc-page-report.js
 */

require('dotenv').config();
const { google } = require('googleapis');

const SITE_URL = 'sc-domain:boxxfinance.co.uk';
const BASE = 'https://boxxfinance.co.uk/insights/';
const SC_LAG_DAYS = 3;
const WINDOW_DAYS = 90;
const TOP_QUERIES = 5;

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  let credentials;
  try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
  catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  return new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
}

const iso = (d) => d.toISOString().split('T')[0];

async function main() {
  const groups = String(process.env.GROUPS || '').split(';')
    .map(g => g.split(',').map(s => s.trim()).filter(Boolean)).filter(g => g.length);
  if (!groups.length) throw new Error('GROUPS is empty');

  const end = new Date(); end.setDate(end.getDate() - SC_LAG_DAYS);
  const start = new Date(end); start.setDate(start.getDate() - (WINDOW_DAYS - 1));
  const window = { startDate: iso(start), endDate: iso(end) };

  const wm = google.webmasters({ version: 'v3', auth: await getAuth() });
  const run = async (dimensions) => (await wm.searchanalytics.query({
    siteUrl: SITE_URL, requestBody: { ...window, dimensions, rowLimit: 25000, type: 'web' },
  })).data.rows || [];

  // Two site-wide pulls, then filtered locally — far fewer API calls than one per URL.
  const [pageRows, pageQueryRows] = await Promise.all([run(['page']), run(['page', 'query'])]);
  const norm = (u) => u.replace(/\/$/, '');
  const byPage = new Map(pageRows.map(r => [norm(r.keys[0]), r]));

  console.log(`Per-URL Search Console report — ${window.startDate} → ${window.endDate} (${WINDOW_DAYS} days, web)\n`);
  groups.forEach((slugs, gi) => {
    console.log(`── Group ${gi + 1} ──`);
    const rows = slugs.map(slug => {
      const r = byPage.get(norm(BASE + slug));
      return { slug, clicks: r ? r.clicks : 0, impressions: r ? r.impressions : 0, position: r ? r.position : null };
    }).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

    for (const r of rows) {
      const pos = r.position == null ? '   —' : r.position.toFixed(1).padStart(5);
      console.log(`  ${String(r.clicks).padStart(4)} clicks ${String(r.impressions).padStart(6)} impr  pos ${pos}  ${r.slug}`);
      const qs = pageQueryRows.filter(q => norm(q.keys[0]) === norm(BASE + r.slug))
        .sort((a, b) => b.impressions - a.impressions).slice(0, TOP_QUERIES);
      for (const q of qs) console.log(`        ${String(q.impressions).padStart(5)} impr  pos ${q.position.toFixed(1).padStart(5)}  "${q.keys[1]}"`);
    }
    console.log('');
  });
  console.log('✅ Done (nothing written).');
}

main().catch(err => { console.error('\n❌ Fatal error:', err.message); process.exit(1); });
