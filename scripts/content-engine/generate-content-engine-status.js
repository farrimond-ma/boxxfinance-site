/**
 * Generates a read-only snapshot of the ContentEngine sheet for the
 * dashboard at /dashboard — the "what's actually in the queue" view that
 * complements system-status.json's "did today's jobs run" view.
 *
 * The site is a static SPA with no server, so the sheet cannot be read live
 * from the browser without exposing the service account credentials to
 * every visitor. Instead this runs server-side (same auth as every other
 * script here), reads ContentEngine!A2:AD once, and writes a small summary
 * JSON that the dashboard fetches like any other static asset. Same pattern
 * as generate-status.js / system-status.json — deliberately not merged with
 * it, since that script has nothing to do with sheet state.
 *
 * Run: node generate-content-engine-status.js
 * Output: status-out/content-engine-status.json (uploaded to the site root
 * by the System Status Generator workflow, alongside system-status.json)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB          = 'ContentEngine';
const OUT_DIR          = path.resolve(__dirname, 'status-out');
const OUT_FILE         = path.join(OUT_DIR, 'content-engine-status.json');

// The six services the business promotes. Everything else buckets into
// "de-listed" so the per-service table doesn't sprawl to sixteen rows of
// which ten are legacy noise. See src/data/serviceFocus.js — duplicated
// here rather than imported because this runs in plain Node against the
// sheet, not the built site, and the list rarely changes.
const FOCUS_SERVICES = [
  'Bridging Finance',
  'Development Finance',
  'Buy To Let Refinance',
  'Bad Credit Mortgages',
  'Second Charge Mortgages',
  'Secured Loans',
];

async function getSheets() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS is not set');
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is not set');
  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
  } catch {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Column contract A..AD, matching buildRow in publish-blog.js — keep in step.
function parseRow(row, i) {
  return {
    rowIndex: i + 2,
    id: row[0] || '',
    type: (row[1] || '').trim().toLowerCase(),
    status: (row[2] || '').trim().toLowerCase(),
    publishDate: (row[3] || '').trim(),
    publishSlot: (row[4] || 'AM').trim().toUpperCase(),
    service: (row[5] || '').trim(),
    city: (row[6] || '').trim(),
    keyword: row[7] || '',
    title: row[9] || '',
    slug: row[10] || '',
    url: row[11] || '',
    category: row[14] || '',
    publishedAt: row[27] || '',
    notes: row[28] || '',
  };
}

function serviceLabel(service) {
  if (!service) return '(none)';
  return FOCUS_SERVICES.includes(service) ? service : 'De-listed / other';
}

async function main() {
  console.log('[Content Engine Status] reading ContentEngine sheet...');
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A2:AD`,
  });
  const rows = (res.data.values || []).map(parseRow);
  console.log(`  ${rows.length} row(s) read`);

  const today = new Date().toISOString().split('T')[0];

  // ── Overview counts ──────────────────────────────────────────────────────
  const byStatus = {};
  const byType = {};
  for (const r of rows) {
    byStatus[r.status || '(blank)'] = (byStatus[r.status || '(blank)'] || 0) + 1;
    byType[r.type || '(blank)'] = (byType[r.type || '(blank)'] || 0) + 1;
  }

  // ── Per-service breakdown (blog rows only — location rows are bridging-
  //    only right now, so a service split there is one row wide) ──────────
  const blogRows = rows.filter(r => r.type === 'blog');
  const serviceBreakdown = {};
  for (const r of blogRows) {
    const label = serviceLabel(r.service);
    serviceBreakdown[label] = serviceBreakdown[label] || { scheduled: 0, published: 0, duplicate: 0, other: 0 };
    if (r.status === 'scheduled') serviceBreakdown[label].scheduled++;
    else if (r.status === 'published') serviceBreakdown[label].published++;
    else if (r.status === 'duplicate') serviceBreakdown[label].duplicate++;
    else serviceBreakdown[label].other++;
  }

  // ── Upcoming queue — next 15 scheduled rows, soonest first ──────────────
  const upcoming = rows
    .filter(r => r.status === 'scheduled' && r.publishDate)
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate) || a.publishSlot.localeCompare(b.publishSlot))
    .slice(0, 15)
    .map(r => ({
      date: r.publishDate,
      slot: r.publishSlot,
      type: r.type,
      service: r.service,
      title: r.title,
      city: r.city,
      overdue: r.publishDate < today,
    }));

  // ── Recently published — last 15, most recent first ─────────────────────
  const recentlyPublished = rows
    .filter(r => r.status === 'published' && r.publishedAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 15)
    .map(r => ({
      publishedAt: r.publishedAt,
      type: r.type,
      service: r.service,
      title: r.title,
      url: r.url,
    }));

  // ── Skipped as duplicate — the coverage guard's decisions, most recent
  //    id first, so it's visible without opening the sheet ────────────────
  const skippedDuplicates = rows
    .filter(r => r.status === 'duplicate')
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 15)
    .map(r => ({ type: r.type, service: r.service, title: r.title, notes: r.notes }));

  // ── Location queue health ────────────────────────────────────────────────
  // publish-location.yml's own SERVICE_FILTER, duplicated here (small and
  // rarely changes) so "days remaining" reflects rows that can actually
  // publish, not rows sitting inert because they're for a service the
  // filter blocks. Found 2026-09: populate-content-engine.js was queuing
  // location rows for 11 services against a filter that only ever admitted
  // one, so ~450 rows were scheduled but permanently unreachable — remaining
  // silently large forever rather than draining. See LOCATION_SERVICES in
  // that script for the fix and the full story.
  const LOCATION_SERVICE_FILTER = new Set(['Bridging Finance']);

  const locationRows = rows.filter(r => r.type === 'location');
  const scheduledLocationRows = locationRows.filter(r => r.status === 'scheduled');
  const locationRemaining = scheduledLocationRows.length;
  const locationByService = {};
  for (const r of scheduledLocationRows) {
    locationByService[r.service || '(none)'] = (locationByService[r.service || '(none)'] || 0) + 1;
  }
  const locationReachable = scheduledLocationRows.filter(r => LOCATION_SERVICE_FILTER.has(r.service)).length;
  const locationOrphaned = locationRemaining - locationReachable;

  // publish-location.js processes up to 2/day (LOCATIONS_PER_DAY in the seeder).
  const LOCATIONS_PER_DAY = 2;
  const locationDaysRemaining = Math.ceil(locationReachable / LOCATIONS_PER_DAY);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    byStatus,
    byType,
    serviceBreakdown,
    upcoming,
    recentlyPublished,
    skippedDuplicates,
    locationQueue: {
      remaining: locationRemaining,
      reachable: locationReachable,
      orphaned: locationOrphaned,
      estimatedDaysRemaining: locationDaysRemaining,
      byService: locationByService,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));
  console.log(`  Wrote ${OUT_FILE}`);
  console.log(`  Status: ${JSON.stringify(byStatus)}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
