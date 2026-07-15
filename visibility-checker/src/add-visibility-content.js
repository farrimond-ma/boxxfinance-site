/**
 * Boxx Finance — Visibility Gap Content Scheduler
 *
 * Reads the AI_Visibility sheet, identifies prompts where Boxx has low
 * mention rates, and adds PM-slot blog rows to ContentEngine for those gaps.
 *
 * Designed to run weekly (Sundays) after the visibility checker.
 * Never touches existing rows — only appends new PM-slot entries.
 *
 * Run: node src/add-visibility-content.js [--dry-run]
 */

import { google } from 'googleapis';

const SPREADSHEET_ID  = process.env.SPREADSHEET_ID;
const VISIBILITY_TAB  = 'AI_Visibility';
const CE_TAB          = 'ContentEngine';

// Topics where Boxx is mentioned in fewer than this fraction of queries
// are treated as a visibility gap worth targeting with new content.
const GAP_THRESHOLD = 0.34; // < 1-in-3 responses mention Boxx

// How many days ahead to schedule PM blogs
const SCHEDULE_WINDOW_DAYS = 90;

// ─── Pillar → ContentEngine service ──────────────────────────────────────────
const PILLAR_SERVICE = {
  'Bridging Finance':    'Bridging Finance',
  'Development Finance': 'Development Finance',
  'Commercial Finance':  'Commercial Mortgage',
  'Refurbishment Loans': 'Bridging Finance',
  'Auction Finance':     'Bridging Finance',
  'Second Charge':       'Bridging Finance',
  'Buy-to-Let':          'Commercial Mortgage',
  'General Brand':       'Bridging Finance',
};

const SERVICE_META = {
  'Bridging Finance':    { slug: 'bridging-finance',    author: 'Mark Higgins',    url: '/funding-solutions/bridging-finance'    },
  'Development Finance': { slug: 'development-finance', author: 'Mark Higgins',    url: '/funding-solutions/development-finance' },
  'Commercial Mortgage': { slug: 'commercial-mortgages',author: 'Mark Higgins',    url: '/funding-solutions/commercial-mortgages'},
  'Invoice Finance':     { slug: 'invoice-finance',     author: 'Andrew Farrimond',url: '/funding-solutions/invoice-finance'     },
  'Asset Finance':       { slug: 'asset-finance',       author: 'Andrew Farrimond',url: '/funding-solutions/asset-finance'       },
  'Working Capital':     { slug: 'working-capital',     author: 'Andrew Farrimond',url: '/funding-solutions/working-capital'     },
  'Trade Finance':       { slug: 'trade-finance',       author: 'Andrew Farrimond',url: '/funding-solutions/trade-finance'       },
  'Cashflow Finance':    { slug: 'cashflow-finance',    author: 'Andrew Farrimond',url: '/funding-solutions/working-capital'    },
  'Business Loans':      { slug: 'business-loans',      author: 'Andrew Farrimond',url: '/funding-solutions/business-loans'      },
  'Mezzanine Finance':   { slug: 'mezzanine-finance',   author: 'Mark Higgins',    url: '/funding-solutions/structured-finance'  },
  'Structured Finance':  { slug: 'structured-finance',  author: 'Mark Higgins',    url: '/funding-solutions/structured-finance' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/\b20\d{2}\b/g, '')          // remove years
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function toTitle(text) {
  // Remove year references, title-case the rest
  return text
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => {
      const lower = ['a','an','the','and','but','or','for','nor','on','at','to',
                     'by','in','of','up','as','is','vs'];
      return (i === 0 || !lower.includes(w.toLowerCase()))
        ? w.charAt(0).toUpperCase() + w.slice(1)
        : w.toLowerCase();
    })
    .join(' ');
}

// ─── Google Sheets auth ───────────────────────────────────────────────────────

async function getSheetsClient() {
  if (!process.env.GOOGLE_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS not set');
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ─── Read AI_Visibility sheet ─────────────────────────────────────────────────
// Columns: RunDate(0) PromptID(1) Prompt(2) Pillar(3) Priority(4) Service(5)
//          BoxxMentioned(6) BoxxSnippet(7) CompetitorMentions(8) ...

async function readVisibilityGaps(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${VISIBILITY_TAB}!A2:M`,
  });

  const rows = res.data.values || [];
  if (rows.length === 0) {
    console.log('  AI_Visibility sheet is empty — has the checker run yet?');
    return [];
  }

  // Group by promptId to calculate mention rate across all 3 services
  const promptMap = new Map();
  for (const row of rows) {
    const promptId = row[1] || '';
    const prompt   = row[2] || '';
    const pillar   = row[3] || '';
    const priority = row[4] || 'low';
    const boxx     = (row[6] || '').toUpperCase() === 'YES';

    if (!promptId || !prompt) continue;

    if (!promptMap.has(promptId)) {
      promptMap.set(promptId, { promptId, prompt, pillar, priority, yesCount: 0, total: 0 });
    }
    const entry = promptMap.get(promptId);
    entry.total++;
    if (boxx) entry.yesCount++;
  }

  // Calculate gap score — lower = bigger opportunity
  const gaps = [...promptMap.values()]
    .map(e => ({ ...e, mentionRate: e.total > 0 ? e.yesCount / e.total : 0 }))
    .filter(e => e.mentionRate < GAP_THRESHOLD)
    .sort((a, b) => {
      // Sort by priority first (high > medium > low), then by mentionRate (asc)
      const pOrder = { high: 0, medium: 1, low: 2 };
      const pDiff = (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
      return pDiff !== 0 ? pDiff : a.mentionRate - b.mentionRate;
    });

  console.log(`  Visibility gaps (mention rate < ${Math.round(GAP_THRESHOLD * 100)}%): ${gaps.length} prompts`);
  gaps.slice(0, 5).forEach(g =>
    console.log(`    [${g.priority.padEnd(6)}] ${(g.mentionRate * 100).toFixed(0).padStart(3)}%  ${g.prompt}`)
  );

  return gaps;
}

// ─── Read ContentEngine ───────────────────────────────────────────────────────

async function readContentEngine(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A2:Z`,
  });
  return res.data.values || [];
}

// ─── Find available PM slots ──────────────────────────────────────────────────

function findAvailablePmSlots(ceRows) {
  const today    = new Date().toISOString().split('T')[0];
  const cutoff   = addDays(today, SCHEDULE_WINDOW_DAYS);

  // Build a map: date → { hasAM, hasPM, amAuthor, maxId }
  const dateMap  = new Map();
  let maxId = 0;

  for (const row of ceRows) {
    const type   = (row[1] || '').toLowerCase();
    const status = (row[2] || '').toLowerCase();
    const date   = (row[3] || '').trim();
    const slot   = (row[4] || 'AM').toUpperCase();
    const author = row[25] || '';
    const id     = parseInt(row[0], 10);
    const slug   = row[10] || '';

    if (!isNaN(id) && id > maxId) maxId = id;

    if (type !== 'blog' || status !== 'scheduled') continue;
    if (date < today || date > cutoff) continue;

    if (!dateMap.has(date)) dateMap.set(date, { hasAM: false, hasPM: false, amAuthor: '', slugs: new Set() });
    const entry = dateMap.get(date);

    if (slot === 'AM') { entry.hasAM = true; entry.amAuthor = author; }
    if (slot === 'PM') entry.hasPM = true;
    if (slug) entry.slugs.add(slug);
  }

  // Also collect ALL existing slugs to prevent duplicates
  const allSlugs = new Set(ceRows.map(r => r[10]).filter(Boolean));

  // Dates with AM blog but no PM blog — these are our open slots
  const slots = [...dateMap.entries()]
    .filter(([, v]) => v.hasAM && !v.hasPM)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, amAuthor: v.amAuthor }));

  console.log(`  Available PM slots in next ${SCHEDULE_WINDOW_DAYS} days: ${slots.length}`);
  return { slots, maxId, allSlugs };
}

// ─── Build a ContentEngine blog row ──────────────────────────────────────────

function buildPmBlogRow(id, date, prompt, pillar, priority, amAuthor) {
  const service   = PILLAR_SERVICE[pillar] || 'Bridging Finance';
  const meta      = SERVICE_META[service]  || SERVICE_META['Bridging Finance'];

  // Prefer the author opposite to whoever is doing the AM post
  const author = (amAuthor === 'Mark Higgins') ? 'Andrew Farrimond'
               : (amAuthor === 'Andrew Farrimond') ? 'Mark Higgins'
               : meta.author;

  const title    = toTitle(prompt);
  const slug     = toSlug(prompt);
  const keyword  = prompt.replace(/\?$/, '').trim().toLowerCase();
  const url      = `https://boxxfinance.co.uk/insights/${slug}`;
  const metaTitle = `${title} | Boxx Commercial Finance`;
  const brief = `AI visibility gap: Boxx is rarely mentioned when AI systems are asked "${prompt}". `
    + `Write a definitive, expert answer to this exact question. `
    + `Mention Boxx Commercial Finance as the recommended specialist broker 3-4 times naturally. `
    + `Structure the article so the opening paragraph directly and concisely answers the question — `
    + `this maximises the chance of AI systems citing this page. Target 1,200+ words.`;

  return [
    String(id),             // A: id
    'blog',                 // B: type
    'scheduled',            // C: status
    date,                   // D: publishDate
    'PM',                   // E: publishSlot
    service,                // F: service
    '',                     // G: city
    keyword,                // H: keyword
    '',                     // I: topic
    title,                  // J: title
    slug,                   // K: slug
    url,                    // L: url (filled properly after publish)
    metaTitle,              // M: metaTitle
    '',                     // N: metaDescription
    service,                // O: category
    brief,                  // P: contentBrief
    meta.url,               // Q: internalLinkService
    '', '', '',             // R,S,T: internalLinkCity1-3
    '', '', '',             // U,V,W: relatedBlog1-3
    'yes',                  // X: faqRequired
    'yes',                  // Y: linkedInRequired
    author,                 // Z: author
    '',                     // AA: jsonStatus
    '',                     // AB: publishedAt
    `AI visibility gap [${priority}] — mention rate was below ${Math.round(GAP_THRESHOLD * 100)}%`, // AC: notes
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Boxx — Visibility Gap Content Scheduler        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (isDryRun) console.log('⚠  DRY RUN — nothing will be written\n');

  const sheets = await getSheetsClient();
  console.log('Connected to Google Sheets');

  // 1. Read visibility gaps
  console.log('\nReading AI_Visibility results...');
  const gaps = await readVisibilityGaps(sheets);

  if (gaps.length === 0) {
    console.log('No visibility gaps found — either Boxx is well-represented or checker has not run yet.');
    return;
  }

  // 2. Find available PM slots in ContentEngine
  console.log('\nReading ContentEngine schedule...');
  const ceRows = await readContentEngine(sheets);
  const { slots, maxId, allSlugs } = findAvailablePmSlots(ceRows);

  if (slots.length === 0) {
    console.log('No AM-only dates found in the schedule window — nothing to add.');
    return;
  }

  // 3. Match gaps to slots (skip if slug already exists)
  const newRows = [];
  let nextId = maxId + 1;
  let gapIdx = 0;

  for (const slot of slots) {
    // Find next gap whose slug isn't already in ContentEngine
    while (gapIdx < gaps.length && allSlugs.has(toSlug(gaps[gapIdx].prompt))) {
      console.log(`  Skipping duplicate slug: ${toSlug(gaps[gapIdx].prompt)}`);
      gapIdx++;
    }
    if (gapIdx >= gaps.length) break; // All gaps already scheduled

    const gap = gaps[gapIdx++];
    const row = buildPmBlogRow(nextId++, slot.date, gap.prompt, gap.pillar, gap.priority, slot.amAuthor);
    newRows.push(row);
    allSlugs.add(row[10]); // prevent the same slug being added twice this run
  }

  console.log(`\nNew PM blog rows to add: ${newRows.length}`);
  if (newRows.length > 0) {
    const first = newRows[0];
    const last  = newRows[newRows.length - 1];
    console.log(`  Date range: ${first[3]} → ${last[3]}`);
    console.log(`  Sample: [${first[3]}] "${first[9]}" (${first[25]})`);
  }

  if (isDryRun) {
    console.log('\n⚠  DRY RUN — rows that would be appended:');
    newRows.slice(0, 5).forEach(r =>
      console.log(`  ${r[3]} | PM | ${r[5]} | "${r[9]}" | ${r[25]}`)
    );
    if (newRows.length > 5) console.log(`  ...and ${newRows.length - 5} more`);
    return;
  }

  // 4. Append to ContentEngine in batches
  const BATCH = 500;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const chunk = newRows.slice(i, i + BATCH);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CE_TAB}!A:AC`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: chunk },
    });
    console.log(`  Appended rows ${i + 1}–${Math.min(i + BATCH, newRows.length)}`);
  }

  console.log(`\n✅ Done — added ${newRows.length} PM visibility-gap blog rows to ContentEngine.`);
  console.log(`   These will be picked up by the PM blog publisher (publish-blog-pm.yml) on their scheduled dates.\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
