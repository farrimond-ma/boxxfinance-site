/**
 * Boxx Finance — Retrofit "bridging loans" terminology into existing
 * bridging location pages.
 *
 * Homeowners search "bridging loans {town}" more than "bridging finance
 * {town}", but the existing pages use "bridging finance" almost
 * exclusively. New pages are fixed via the generation prompt; this script
 * rebalances the pages already published.
 *
 * Grammar-safe, deterministic changes only:
 *   1. Noun-phrase swaps that can't break verb agreement
 *      ("bridging finance solutions" → "bridging loan solutions" etc.)
 *   2. Alternate occurrences of "bridging finance in {City}" →
 *      "bridging loans in {City}" (skipped when followed by a singular verb)
 *   3. One homeowner-phrased FAQ appended to the <dl> AND faqSchema
 *   4. metaDescription mentions "bridging loans"
 *
 * Idempotent — skips pages that already carry the added FAQ.
 * Run: node retrofit-bridging-loan-terms.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../../src/data/locationPages.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Noun-phrase swaps — same plurality, no verb attached, safe everywhere
const PHRASE_SWAPS = [
  [/bridging finance (solutions|options|facilities|products)/gi, 'bridging loan $1'],
  [/bridging finance (broker|specialist|lender|facility|application|deal|enquiry|needs|requirements)/gi, 'bridging loan $1'],
];

function termCounts(html) {
  const text = html.replace(/<[^>]+>/g, ' ');
  return {
    finance: (text.match(/bridging finance/gi) || []).length,
    loan: (text.match(/bridging loan/gi) || []).length,
  };
}

function main() {
  const pages = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let changed = 0;

  for (const p of pages) {
    if (!p || p.status !== 'published' || !p.slug.startsWith('bridging-finance-') || !p.content) continue;

    const city = p.location;
    const faqQuestion = `Can I get a bridging loan in ${city}?`;
    if (p.content.includes(faqQuestion)) {
      console.log(`OK   (already retrofitted): ${p.slug}`);
      continue;
    }

    const before = termCounts(p.content);
    let content = p.content;

    // 1. Safe noun-phrase swaps
    for (const [re, replacement] of PHRASE_SWAPS) {
      content = content.replace(re, (m, g1) => {
        // preserve leading capital
        const swapped = replacement.replace('$1', g1);
        return m[0] === 'B' ? swapped.charAt(0).toUpperCase() + swapped.slice(1) : swapped;
      });
    }

    // 2. Alternate "bridging finance in {City}" → "bridging loans in {City}",
    //    skipping occurrences followed by a singular verb
    let occurrence = 0;
    const cityRe = new RegExp(`bridging finance in ${city.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?!\\s+(?:is|was|has|offers|provides|works|remains)\\b)`, 'gi');
    content = content.replace(cityRe, (m) => {
      occurrence++;
      if (occurrence % 2 === 0) return m; // keep every other one as "finance"
      const swapped = `bridging loans in ${city}`;
      return m[0] === 'B' ? 'B' + swapped.slice(1) : swapped;
    });

    // 3. Append homeowner FAQ to the last </dl> and the schema
    const faqAnswer = `Yes. Boxx Commercial Finance arranges bridging loans in ${city} for homeowners and property investors alike, whether you are breaking a chain, buying at auction or funding a refurbishment. We compare bridging loan rates from lenders across the market and can typically agree terms within days.`;
    const lastDl = content.lastIndexOf('</dl>');
    if (lastDl !== -1) {
      content = content.slice(0, lastDl)
        + `<dt>${faqQuestion}</dt><dd>${faqAnswer}</dd>`
        + content.slice(lastDl);
      if (p.faqSchema && Array.isArray(p.faqSchema.mainEntity)) {
        p.faqSchema.mainEntity.push({
          '@type': 'Question',
          name: faqQuestion,
          acceptedAnswer: { '@type': 'Answer', text: faqAnswer },
        });
      }
    }

    // 4. metaDescription — mention "bridging loans" (loans is shorter than finance, stays ≤160)
    if (p.metaDescription && !/bridging loan/i.test(p.metaDescription)) {
      p.metaDescription = p.metaDescription.replace(/bridging finance/i, (m) =>
        m[0] === 'B' ? 'Bridging loans' : 'bridging loans');
    }

    const after = termCounts(content);
    console.log(`FIX  ${p.slug}: finance ${before.finance}→${after.finance}, loan ${before.loan}→${after.loan}`);

    if (!DRY_RUN) p.content = content;
    changed++;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(FILE, JSON.stringify(pages, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${FILE}`);
  }
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Pages updated: ${changed}`);
}

main();
