// Seeds the first batch of urgency-led "trigger-event" bridging content into
// ContentEngine, per the Trigger Map brief (Section 14 — First Batch).
//
// This is a ONE-OFF seed, not a recurring generator. It runs alongside the
// existing keyword-driven AM/PM queues (does not touch or replace them) —
// these rows get their own publishSlot ('TRIGGER') and their own workflow
// (.github/workflows/publish-blog-trigger.yml), so they never compete with
// the standard AM/PM content for a publish slot.
//
// Each row is tagged contentFramework='trigger-event' in column AD, which
// publish-blog.js reads to switch the generation prompt to the mirror/clock/
// options-table/worked-cost/exit-strategy/disqualify structure and the extra
// urgency-voice and compliance rules — see TRIGGER_EVENT_STRUCTURE /
// TRIGGER_EVENT_VOICE / TRIGGER_EVENT_COMPLIANCE in publish-blog.js.
//
// Order matters (per the brief): the 11 Tier-2 spoke pieces are scheduled
// before the Tier-1 auction hub, so the hub has inbound internal links
// (via getPublishedBlogs' same-service related-post matching) once it goes
// out. One per day, PUBLISH_SLOT=TRIGGER.
//
// Usage:
//   node seed-trigger-content.js            — write the rows
//   node seed-trigger-content.js --dry-run  — print what would be added, no writes

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CE_TAB = 'ContentEngine';
const isDryRun = process.argv.includes('--dry-run');

function addDays(base, n) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── The first batch — Section 14 of the Trigger Map brief ──────────────────
// author alternates Mark Higgins / Tara Jameson, same rotation convention
// used elsewhere in the content engine (see visibility-checker/src/*.js).
const BATCH = [
  {
    trigger: 'T1', tier: 2,
    keyword: `bought at auction and my mortgage won't complete in time`,
    title: `Bought At Auction — What If My Mortgage Won't Complete In Time?`,
    author: 'Mark Higgins',
    brief: `Trigger T1 — won a lot at auction, now the mortgage application is stalling and the legal completion deadline (28 days standard, sometimes 20 working days — check the specific auctioneer's legal pack) is closing in. The reader has already paid a 10% deposit non-refundable at risk and is starting to realise mainstream mortgage timelines (often 6-8+ weeks) do not fit an auction completion window. Emotional state: committed, deposit at risk, mild panic — they are not shopping around, they are trying to stop a specific loss. Deadline maths to use: pick a plausible worked date pair (e.g. "won the lot on the 3rd, completion due the 31st") and count working days, noting how many of those a lender realistically needs (10-14 working days for bridging vs 6-8+ weeks for a mainstream mortgage). This is usually UNREGULATED bridging (investment/BTL purchase) unless the reader is buying it as their own home, in which case flag that regulated bridging applies and the process differs slightly — say so rather than assuming. Consequence of missing the deadline: forfeiture of the 10% deposit and the auctioneer's right to resell and pursue the reader for any shortfall plus costs (RICS/legal pack terms) — state this factually, do not dramatise beyond it.`,
  },
  {
    trigger: 'T1', tier: 2,
    keyword: `how long do you actually have to complete on an auction property`,
    title: `How Long Do You Actually Have To Complete On An Auction Property?`,
    author: 'Tara Jameson',
    brief: `Trigger T1 — supporting/educational piece for the auction-completion trigger, feeding the auction finance hub. Answer the literal question first and precisely: standard is 28 calendar days from the fall of the hammer under the Common Auction Conditions, but some auction houses (particularly online/timed auctions) use a 20-working-day condition instead — tell the reader to check their specific legal pack rather than assume. Walk the reader day-by-day through what has to happen inside that window: instructing a solicitor same day, valuation instruction within days 1-3, searches typically taking 5-10 working days, mortgage/bridging offer needed with enough runway before completion for legal work. Deadline maths: show a worked day-by-day table for a 28-day window. Regulated status: usually unregulated (most auction purchases are investment/BTL) but note when it would be regulated (reader's own residence). This piece should explicitly link up to the "Auction Finance — the complete 28-day guide" hub once published.`,
  },
  {
    trigger: 'T2', tier: 2,
    keyword: `my buyer pulled out can I still buy my next house`,
    title: `My Buyer Pulled Out — Can I Still Buy My Next House?`,
    author: 'Mark Higgins',
    brief: `Trigger T2 — chain collapse. The reader's own buyer has withdrawn, and without those sale proceeds they can no longer complete on the property they're buying. Their onward purchase is now at risk inside 2-6 weeks. Emotional state: distressed, angry, emotionally invested — this is usually their home, not an investment. This is usually REGULATED bridging (secured against/for the purchase of a residence they will occupy) — say so clearly and explain what that means for them (FCA protections, affordability checks). Deadline maths: use a worked example — exchange already happened or is imminent on the onward purchase, count the days until that completion date and explain a lender typically needs 10-14 working days once instructed. Consequence of missing it: losing the onward purchase, potentially losing any deposit already paid on it, and having to restart the search. Exit strategy for this trigger is critical and specific: it's the sale of their existing (now buyer-less) property once re-marketed — lenders will want to see it back on the market and a realistic re-sale valuation, not just a promise.`,
  },
  {
    trigger: 'T2', tier: 2,
    keyword: `seller won't wait for my sale to complete what now`,
    title: `The Seller Won't Wait For My Sale To Complete — What Now?`,
    author: 'Tara Jameson',
    brief: `Trigger T2 — mirror image of the buyer-pulled-out scenario: here the reader's own sale is delayed (buyer's chain, mortgage delay, survey issue) and the seller of the property they're buying is threatening to walk or has set a hard deadline. Emotional state: distressed, feeling squeezed from both directions, some anger at being penalised for someone else's delay. Usually REGULATED bridging if this is their residence. Deadline maths: worked example with a seller-imposed deadline (e.g. "the seller has given you until the 20th or they're relisting") — count the days and explain what a lender needs. Consequence of missing it: losing the purchase, having spent money on searches/survey/legal fees already sunk. Exit strategy: sale of their own property completing shortly after (needs evidence it's genuinely close — exchanged but not yet completed is a much stronger case than merely "under offer"). Note where bridging is the WRONG answer here: if their own sale has fallen through entirely rather than merely delayed, a short extension request or a different onward purchase may be more sensible than bridging debt.`,
  },
  {
    trigger: 'T4', tier: 2,
    keyword: `can you get a mortgage on a house with no kitchen or bathroom`,
    title: `Can You Get A Mortgage On A House With No Kitchen Or Bathroom?`,
    author: 'Mark Higgins',
    brief: `Trigger T4 — unmortgageable property. The reader has an offer accepted (or has already exchanged) on a property with no working kitchen and/or bathroom, and their mainstream mortgage lender has declined or the valuer has down-valued/refused because the property isn't habitable in the lender's eyes. Emotional state: confused, feels blocked by a rule they didn't know existed. Deadline is immediate — the offer/exchange is already in place and every day without funding risks the deal. Explain why mainstream lenders decline: most require a property to be of "habitable standard" (working kitchen, bathroom, heating, weathertight) before they'll lend against it as a standard resi/BTL mortgage. Bridging route: bridging lenders will lend against the property in its current condition (often on a lower LTV reflecting as-is value) specifically so the reader can complete, then refurbish, then remortgage onto a standard product once habitable — explain this refinance-exit clearly. Regulated status: depends on whether it will be the reader's residence once refurbished (regulated) or a BTL/investment (unregulated) — say both are possible and ask the reader to know which applies to them. Include the gross/net loan distinction since refurb bridging often retains funds for works.`,
  },
  {
    trigger: 'T4', tier: 2,
    keyword: `short lease flat mortgage refused`,
    title: `Short Lease Flat: Why The Mortgage Was Refused, And What To Do`,
    author: 'Tara Jameson',
    brief: `Trigger T4/T10 — short lease. The reader is buying (or already owns and is trying to remortgage/sell) a leasehold flat with a short remaining lease — most mainstream lenders have a minimum unexpired term requirement (commonly 70-85 years remaining at the END of the mortgage term, so the practical cut-off is often higher than people expect once the mortgage term is added). Emotional state: technical, frustrated — they often don't understand WHY they were declined until it's explained. Explain the mechanics plainly: lease value cliff-edges as the term shortens (marriage value kicks in under 80 years remaining), and mainstream lenders won't touch anything close to that ceiling. Bridging route: bridging lenders can lend against short-lease property (again usually at a lower LTV) to allow completion, buying time either to complete a formal lease extension (which typically takes 3-9 months via the statutory Leasehold Reform Act process, longer if informal/negotiated) or to complete a quick resale/refinance once extended. Deadline maths: use a worked exchange/completion date example. Regulated status depends on owner-occupation. Note where this is the WRONG choice: if there's no realistic route to a lease extension (e.g. freeholder unreachable, insufficient ownership history for a statutory claim) bridging just delays an unresolvable problem — say so.`,
  },
  {
    trigger: 'T5', tier: 2,
    keyword: `mortgage declined a week before exchange`,
    title: `Mortgage Declined A Week Before Exchange — Your Realistic Options`,
    author: 'Mark Higgins',
    brief: `Trigger T5 — mortgage declined or delayed at the worst possible moment, days before exchange (or between exchange and completion). Emotional state: rejected, embarrassed, urgent — often their first time this has happened to them and they don't know if it's fixable. Deadline maths: worked example — exchange in 5-7 days, and explain what's actually achievable in that window (a same-lender appeal/underwriter review, a broker resubmission to a different lender, or bridging as the fallback that actually meets the date). Be honest that same-week remortgage approval from a mainstream lender is very unlikely, which is precisely why bridging exists for this trigger. Explain the most common reasons for late decline (down-valuation, last-minute credit file change, income verification issues, lender policy change) briefly, factually, without shaming the reader. Regulated status: usually regulated if this is their residence. Exit strategy: refinancing onto a proper mortgage once the underlying issue is resolved (e.g. credit file corrected, alternative lender found) — be clear a lender will want to see evidence that exit is realistic, not just hoped for. Disqualify clearly: if the underlying reason for decline is unlikely to be resolved within the bridging term (e.g. a fundamental affordability shortfall), bridging just delays the same problem at extra cost — say this plainly.`,
  },
  {
    trigger: 'T7', tier: 2,
    keyword: `how to pay an inheritance tax bill before the house has sold`,
    title: `How To Pay An Inheritance Tax Bill Before The House Has Sold`,
    author: 'Tara Jameson',
    brief: `Trigger T7 — probate/IHT. HMRC generally requires Inheritance Tax to be paid by the end of the 6th month after the person died (interest starts accruing after that even though the estate often can't be settled that fast), but the property usually can't be sold until probate/grant of representation is obtained, which itself can take months. This creates a genuine cashflow trap: tax due before the asset that would pay it can be sold. Emotional state: grieving, overwhelmed, deadline-blind — they may not have even registered the 6-month clock is running. Explain the options plainly: HMRC's "Direct Payment Scheme" (paying IHT straight from the deceased's bank/ISA accounts where available), the "instalment option" for property (spread over 10 years, but interest applies and it doesn't fully solve a cashflow gap on the first instalment), and bridging secured against the property itself — noting some specialist lenders will lend PRE-grant against the expectation of it (a smaller, more specialist part of the market, be honest about that), and more commonly POST-grant once representation is obtained. This is usually REGULATED bridging if the property was the deceased's residence and will pass to someone who will occupy it, otherwise likely unregulated — flag this needs checking case by case, it is genuinely fact-specific in probate. Exit: sale of the property once grant is obtained and it's marketed. Be careful and factual about the 6-month HMRC deadline — do not state it as universal without the caveat that estate specifics vary; recommend the reader also speak to the estate's solicitor.`,
  },
  {
    trigger: 'T7', tier: 2,
    keyword: `can I borrow against a property I've inherited but not yet sold`,
    title: `Can I Borrow Against A Property I've Inherited But Not Yet Sold?`,
    author: 'Mark Higgins',
    brief: `Trigger T7 — companion piece to the IHT-deadline article, more general: the reader has inherited a property (or a share of one) and wants to release cash against it before selling — could be to pay IHT, to settle other beneficiaries/siblings, or simply because they want funds now rather than waiting for a sale. Emotional state: grieving, overwhelmed. Explain the mechanics: once grant of probate/representation is obtained, the personal representative(s) or beneficiary (if the property has been assented/transferred to them) can typically use it as security for bridging. Explain WHY pre-grant lending is rarer/harder (title isn't yet in a lendable position) versus post-grant being the more common route. Cover multiple-beneficiary complexity briefly — all beneficiaries with a legal interest typically need to consent, which is a common stalling point worth flagging honestly. Regulated status depends on intended occupation, same caveat as the IHT piece. Exit strategy: sale of the inherited property, or refinance if a beneficiary intends to keep and occupy it (buying out the others). Disqualify: if title/probate isn't even close to being resolved, bridging can't help yet — say plainly this needs at least grant of probate in progress, ideally obtained, before a lender will seriously engage.`,
  },
  {
    trigger: 'T6', tier: 2,
    keyword: `development finance is expiring and the units haven't sold`,
    title: `Development Finance Is Expiring And The Units Haven't Sold — What Are Your Options?`,
    author: 'Tara Jameson',
    brief: `Trigger T6 — development exit. The reader's development finance facility (used to build) is approaching its end date, but the completed units haven't sold (or haven't sold fast enough) to repay it in full. Deadline: 30-90 days is typical remaining runway before the facility matures and default interest/penalties kick in. Emotional state: commercial, sophisticated, cost-sensitive — this reader understands finance already, so do not over-explain basics; focus on numbers and lender mechanics. Explain development EXIT finance specifically (distinct from the original development loan): typically cheaper than the development facility it's refinancing (because the build risk is gone — units are complete), gives breathing room to market and sell at the right price rather than a fire-sale, and can sometimes release some equity for the next project. This is UNREGULATED (commercial/investment purpose). Worked cost example should reflect commercial-scale numbers (e.g. a facility in the hundreds of thousands to low millions, not a residential-scale example) — keep it realistic for a small developer. Common lender requirements: evidence of a credible sales/marketing strategy, updated valuation reflecting current market sale prices, sometimes partial pre-sales or reservations. Disqualify: if units genuinely aren't sellable at any realistic price in the current market, exit finance just delays the reckoning at extra cost — say this honestly, it's the single biggest risk in this trigger.`,
  },
  {
    trigger: 'T4', tier: 2,
    keyword: `cash buyers only what does it mean and how to buy anyway`,
    title: `"Cash Buyers Only" — What It Means, And How To Buy Anyway`,
    author: 'Mark Higgins',
    brief: `Trigger T4/T8 — the reader has found a property listed "cash buyers only" and assumes this rules them out unless they have the full purchase price in savings. Emotional state: frustrated, feels excluded from a property they want. Explain plainly WHY agents/sellers use this phrase: usually because the property won't pass a mainstream mortgage valuation (structural issues, non-standard construction, short lease, no kitchen/bathroom, japanese knotweed, or the seller simply wants a fast, certain, chain-free completion e.g. from a repossession or a fast-moving probate sale). Reframe the core insight of the whole piece: "cash buyer" in an agent's mind usually just means "not dependent on a slow, conditional mortgage" — a bridging loan, because it completes fast and isn't subject to the same conditionality, is functionally treated as a cash offer by most agents and sellers, even though the buyer is borrowing. This is the single most valuable reframe in the article — lead with it after the mirror/clock sections. Deadline maths: use a worked example of a seller wanting completion in 2-3 weeks. Regulated status depends on occupation intent. Disqualify: if the true reason for "cash buyers only" is a structural/legal problem so severe no lender (bridging or otherwise) will touch it even at low LTV, say so — this does happen and it's better to find out early via a proper valuation than after committing.`,
  },
  {
    trigger: 'T1', tier: 1, hub: true,
    keyword: `auction finance`,
    title: `Auction Finance: The Complete 28-Day Guide`,
    author: 'Mark Higgins',
    brief: `HUB / pillar page for auction bridging finance — Tier 1, comprehensive (2500-4000 words), NOT a single-symptom trigger piece: cover the full topic properly (what auction finance is, how it differs from a mortgage, the 28-day/20-working-day completion mechanics, costs with a full worked example, what lenders look for, common mistakes, when auction finance is the wrong choice, FAQ). This is the page the two auction spoke articles ("Bought at auction and my mortgage won't complete in time" and "How long do you actually have to complete on an auction property?") should both link up to, and it should in turn reference those two scenarios naturally as examples of when readers reach for this. Usually unregulated (investment/BTL auction purchases) but note the regulated exception clearly for owner-occupier auction buyers. Include a comparison table of auction finance vs a mainstream mortgage vs cash, and a full gross/net worked cost example.`,
  },
];

async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Seed trigger-event content (Trigger Map)       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID not set');
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A2:K`,
  });
  const rows = res.data.values || [];

  let maxId = 0;
  const existingSlugs = new Set();
  for (const row of rows) {
    const id = parseInt(row[0], 10);
    if (!isNaN(id) && id > maxId) maxId = id;
    if (row[10]) existingSlugs.add(row[10]);
  }

  const tomorrow = addDays(new Date(), 1);
  let nextId = maxId + 1;
  const newRows = [];
  const skipped = [];

  BATCH.forEach((item, i) => {
    const slug = toSlug(item.keyword);
    if (existingSlugs.has(slug)) {
      skipped.push(`${item.title} (slug already exists: ${slug})`);
      return;
    }
    const publishDate = addDays(tomorrow, i); // one per day, in brief order
    const url = `https://boxxfinance.co.uk/insights/${slug}`;
    const metaTitle = `${item.title} | Boxx Finance`;

    // 30 columns, A-AD. See publish-blog.js getScheduledRow() for the read
    // side of this schema.
    newRows.push([
      String(nextId++),        // A id
      'blog',                  // B type
      'scheduled',             // C status
      publishDate,             // D publishDate
      'TRIGGER',                // E publishSlot — own slot, never competes with AM/PM
      'Bridging Finance',       // F service
      '',                       // G city
      item.keyword,             // H keyword
      '',                        // I topic
      item.title,                // J title
      slug,                       // K slug
      url,                         // L url
      metaTitle,                   // M metaTitle
      '',                            // N metaDescription
      'Bridging Finance',              // O category
      item.brief,                       // P contentBrief
      '/funding-solutions/bridging-loans', // Q internalLinkService
      '', '', '',                            // R,S,T internalLinkCity1-3
      '', '', '',                              // U,V,W relatedBlog1-3
      'yes',                                     // X faqRequired
      'yes',                                       // Y linkedInRequired
      item.author,                                   // Z author
      '',                                               // AA jsonStatus
      '',                                                 // AB publishedAt
      `Trigger-event content [${item.trigger}]${item.hub ? ' — HUB' : ' — spoke'} — from the Urgency-Led Bridging Finance brief`, // AC notes
      item.hub ? '' : 'trigger-event',                     // AD contentFramework — hub uses the standard framework (see brief)
    ]);
  });

  console.log(`Batch defined: ${BATCH.length} articles`);
  console.log(`Already in sheet (skipped): ${skipped.length}`);
  skipped.forEach(s => console.log(`  - ${s}`));
  console.log(`New rows to add: ${newRows.length}\n`);

  newRows.forEach(r => console.log(`  [${r[3]}] ${r[4]} | ${r[25]} | "${r[9]}"`));

  if (newRows.length === 0) {
    console.log('\nNothing to add.');
    return;
  }

  if (isDryRun) {
    console.log('\nDry run — no changes written.');
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CE_TAB}!A:AD`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newRows },
  });

  console.log(`\n✅ Added ${newRows.length} trigger-event row(s) to ContentEngine.`);
  console.log(`   Publish dates: ${newRows[0][3]} → ${newRows[newRows.length - 1][3]}`);
  console.log(`   These publish via the TRIGGER slot — see publish-blog-trigger.yml.`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
