/**
 * Boxx Finance — UK SME Funding Index data fetcher
 *
 * Replaces the previous generateSmeData.js, which invented every figure with
 * Math.random() while the page claimed Bank of England provenance. That section
 * was deleted (2026-07-15). This script rebuilds the index on REAL data only.
 *
 * Source: Bank of England Statistical Interactive Database (IADB), free and
 * public, no key required. Each series below was verified against a figure the
 * Bank published in its own Money & Credit release before being used here:
 * CFMZ6LD returns 6.18 for Nov-2025, matching the Bank's published statement
 * that "the effective interest rate on new loans to SMEs fell back to 6.18% in
 * November 2025".
 *
 * DESIGN RULE — the reason this file exists:
 *   This script must be structurally incapable of inventing a number.
 *   - Every value is parsed from the Bank's CSV response. Nothing is computed,
 *     smoothed, extrapolated or defaulted.
 *   - If a series returns no rows, the script THROWS and writes nothing. A stale
 *     but real file is always better than a fresh fake one.
 *   - Every series carries its BoE series code, the source URL and the exact
 *     observation date, so every figure on the page can be traced back.
 *   - There is no random number generator in this file, and there must never be.
 *
 * Run: node scripts/fetch-sme-index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT = path.resolve(__dirname, '../src/data/smeFundingData.json');
const IADB = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp';
const IADB_HOME = 'https://www.bankofengland.co.uk/boeapps/database/';
const HISTORY_FROM = '01/Jan/2019';

// Every series here is published by the Bank of England. `label` is the Bank's
// own chart label; `note` is our plain-English gloss for site visitors.
const SERIES = [
  {
    key: 'bankRate',
    code: 'IUMABEDR',
    label: 'Official Bank Rate',
    note: 'The Bank of England base rate. Most SME floating-rate lending is priced as a margin over this.',
    unit: '%',
  },
  {
    key: 'smeNewLoanRate',
    code: 'CFMZ6LD',
    label: 'Effective interest rate — new loans to SMEs (all)',
    note: 'The average rate SMEs actually paid on new borrowing drawn in the month, across all reporting lenders.',
    unit: '%',
    headline: true,
  },
  {
    key: 'smeNewLoanFloating',
    code: 'CFMZJ3L',
    label: 'New loans to SMEs — of which floating-rate',
    note: 'Average rate on new SME lending priced on a floating basis.',
    unit: '%',
  },
  {
    key: 'smeNewLoanBankRateLinked',
    code: 'CFMZJ3M',
    label: 'New loans to SMEs — of which floating-rate, Bank Rate linked',
    note: 'Average rate on new SME lending explicitly linked to Bank Rate.',
    unit: '%',
  },
  {
    key: 'smeNewLoanFixed',
    code: 'CFMZJ3U',
    label: 'New loans to SMEs — of which fixed-rate',
    note: 'Average rate on new SME lending taken at a fixed rate.',
    unit: '%',
  },
];

function seriesUrl(code, from, to) {
  const qs = new URLSearchParams({
    'csv.x': 'yes',
    Datefrom: from,
    Dateto: to,
    SeriesCodes: code,
    CSVF: 'TN',
    UsingCodes: 'Y',
    VPD: 'Y',
    VFD: 'N',
  });
  return `${IADB}?${qs.toString()}`;
}

// Parse the Bank's CSV: "DATE,CODE\n31 Jan 2026,3.75\n..."
// Anything that is not a finite number is DISCARDED, never defaulted to 0.
function parseCsv(csv, code) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const [rawDate, rawValue] = line.split(',');
    if (!rawDate || rawValue === undefined) continue;
    const value = Number(String(rawValue).trim());
    if (!Number.isFinite(value)) continue;
    const d = new Date(`${rawDate.trim()} UTC`);
    if (Number.isNaN(d.getTime())) continue;
    out.push({ date: d.toISOString().split('T')[0], value });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function fetchSeries(s, from, to) {
  const url = seriesUrl(s.code, from, to);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BoxxFinance-SME-Index/1.0 (+https://boxxfinance.co.uk)' },
  });
  if (!res.ok) throw new Error(`${s.code}: HTTP ${res.status} from Bank of England IADB`);
  const csv = await res.text();
  const observations = parseCsv(csv, s.code);
  if (observations.length === 0) {
    // Never fall back to a placeholder — fail so the watchdog surfaces it.
    throw new Error(`${s.code} (${s.label}): Bank of England returned no usable observations. Refusing to write placeholder data.`);
  }
  const latest = observations[observations.length - 1];
  const previous = observations.length > 1 ? observations[observations.length - 2] : null;
  return {
    key: s.key,
    code: s.code,
    label: s.label,
    note: s.note,
    unit: s.unit,
    headline: !!s.headline,
    latest,
    // Change vs the previous observation — computed from two real values, or null.
    changeVsPrevious: previous ? Number((latest.value - previous.value).toFixed(2)) : null,
    previous,
    observations,
    sourceUrl: url,
  };
}

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function main() {
  const today = new Date();
  const to = `${String(today.getDate()).padStart(2, '0')}/${today.toLocaleString('en-GB', { month: 'short' })}/${today.getFullYear()}`;

  console.log('Fetching UK SME funding data from the Bank of England IADB...');
  console.log(`  Range: ${HISTORY_FROM} → ${to}\n`);

  const series = [];
  for (const s of SERIES) {
    const r = await fetchSeries(s, HISTORY_FROM, to);
    console.log(`  ${r.code.padEnd(9)} ${String(r.latest.value).padStart(6)}${r.unit}  as of ${r.latest.date}  (${r.observations.length} obs)  ${r.label}`);
    series.push(r);
  }

  const headline = series.find(s => s.headline);
  if (!headline) throw new Error('No headline series defined — refusing to write.');

  const payload = {
    // Provenance for every figure on the page.
    source: {
      name: 'Bank of England Statistical Interactive Database (IADB)',
      url: IADB_HOME,
      publisher: 'Bank of England',
      licence: 'Contains public sector information licensed under the Open Government Licence v3.0',
      licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    },
    // SMEs as the Bank defines them for the effective-rates return (Form ER).
    definition: 'The Bank of England defines SMEs for its effective interest rates return (Form ER) as private non-financial corporations with annual debit turnover of £25 million or less.',
    // The Bank publishes effective rates in arrears; the page must show this,
    // not imply the latest observation is the current month.
    dataAsOf: headline.latest.date,
    dataAsOfLabel: fmtDate(headline.latest.date),
    retrievedAt: new Date().toISOString(),
    series,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote ${OUTPUT}`);
  console.log(`   Headline: SME new-loan rate ${headline.latest.value}% as of ${payload.dataAsOfLabel}`);
  console.log(`   Every value traced to a Bank of England series code. No figure is generated.`);
}

main().catch(err => {
  console.error('\n❌ SME index fetch failed:', err.message);
  console.error('   Nothing was written — the existing data file is left untouched.');
  process.exit(1);
});
