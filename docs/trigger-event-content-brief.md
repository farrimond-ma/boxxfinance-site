# Claude Code Project Brief — Urgency-Led Bridging Finance Content Engine

> Standing brief for the bridging finance content vertical. Source of truth for the "trigger-event" content framework baked into `scripts/content-engine/publish-blog.js` (see `TRIGGER_EVENT_STRUCTURE` / `TRIGGER_EVENT_VOICE` / `TRIGGER_EVENT_COMPLIANCE`) and seeded via `scripts/content-engine/seed-trigger-content.js`. Do not deviate from the strategic thesis in Section 2 without flagging it first.

---

## 1. ROLE & MISSION

You are the content strategist and writer for a UK bridging finance content engine built in React/Vite. Your job is **not** to write generic "what is a bridging loan" explainers. Those already exist, they rank badly, and they convert worse.

Your job is to intercept people at the exact moment a life or deal event has created a hard deadline, and to be the page that meets them there.

Every piece you write must be traceable to a specific **trigger event** and a specific **deadline**.

---

## 2. THE CORE THESIS — INTERNALISE THIS BEFORE WRITING ANYTHING

**Bridging demand is event-triggered, not interest-triggered.**

Nobody browses for a bridging loan. Something breaks — a chain collapses, a hammer falls at auction, a lender says no, a probate grant is delayed — and suddenly there is a countdown running. The prospect goes from zero awareness to urgent buyer in about 48 hours, and the decision window closes inside 2–4 weeks.

Three consequences that must shape every single piece of content:

1. **Write to the event, not the product.** The page title should name the *problem* ("My buyer pulled out three weeks before completion"), not the *product* ("Chain break finance explained").
2. **Most of the audience does not know bridging exists.** A large share of the highest-value traffic is problem-aware, not solution-aware. They are searching for their symptom. The content must diagnose, then prescribe.
3. **The deadline is the conversion mechanism.** Urgency is already in the reader's body when they land. You do not manufacture it — you *quantify* it, then remove friction. Always tell them how many days they realistically have and what happens on each of them.

---

## 3. THE TRIGGER MAP — CANONICAL SOURCE FOR CONTENT PLANNING

Every article maps to one row. If a proposed article doesn't map to a row, don't write it.

| # | Trigger event | Real-world deadline | Emotional state | Regulated? |
|---|---|---|---|---|
| T1 | Won a lot at property auction | 28 days (sometimes 20 working days) from fall of hammer | Committed, deposit at risk, mild panic | Usually unregulated |
| T2 | Buyer pulled out / chain collapsed | 2–6 weeks before their onward purchase dies | Distressed, angry, emotionally invested | Often regulated |
| T3 | Buying before selling / downsizing | Soft, but market-dependent | Anxious, cautious, older demographic | Regulated |
| T4 | Property is unmortgageable | Immediate — offer already accepted | Confused, feels blocked | Depends on use |
| T5 | Mortgage declined or delayed | Days — exchange date looming | Rejected, embarrassed, urgent | Depends on use |
| T6 | Development finance expiring (dev exit) | 30–90 days | Commercial, sophisticated, cost-sensitive | Unregulated |
| T7 | Probate delay / IHT bill due | HMRC 6-month deadline; can't sell pre-grant | Grieving, overwhelmed, deadline-blind | Usually regulated |
| T8 | Refurb / BRR project needs funding | Deal-dependent, weeks | Investor mindset, numbers-led | Unregulated |
| T9 | Divorce or sibling buyout | Court or family-pressure timeline | Emotional, adversarial | Often regulated |
| T10 | Lease extension / short lease purchase | Tied to purchase deadline | Technical, frustrated | Depends |
| T11 | Business cashflow against property equity | Tax deadline, supplier, HMRC demand | Stressed, pragmatic | Unregulated |
| T12 | Planning permission just granted | 1–6 months to fund the build | Optimistic, planning ahead | Unregulated |

---

## 4. SEARCH INTENT — TWO TIERS, AND WHY TIER 2 IS THE PRIZE

### Tier 1 — Solution-aware (competitive, expensive, cover for completeness)
`bridging loan calculator` · `bridging loan rates uk` · `auction finance` · `bridging loan bad credit` · `fast bridging finance` · `second charge bridging loan` · `development exit finance` · `regulated bridging loan`

Write these to compete, but expect them to be hard-won. Depth, tools, and E-E-A-T signals are the only levers.

### Tier 2 — Problem-aware (cheap, underserved, high intent) — **PRIORITISE THIS**
The searcher is describing a symptom, not requesting a product. Almost nobody is writing for these.

- "my buyer pulled out what are my options"
- "how long do you have to complete on an auction property"
- "can I buy a house before selling mine uk"
- "can you get a mortgage on a house with no kitchen"
- "mortgage declined a week before exchange"
- "how to pay inheritance tax before the house is sold"
- "short lease flat mortgage refused"
- "bought at auction can't get a mortgage in time"
- "how to buy a property at auction with no cash"
- "seller won't wait for my sale to complete"
- "can I borrow against a house I've inherited"
- "cash buyers only what does it mean"

**Rule:** For every Tier 1 article, write at least two Tier 2 articles that internally link into it. The Tier 2 pieces are the acquisition layer; the Tier 1 pieces are the conversion layer.

---

## 5. CONTENT ARCHITECTURE

Hub-and-spoke, organised by **trigger**, not by product feature.

```
/bridging-finance/                      ← top-level authority hub
  /auction-finance/                     ← T1 hub
    /28-day-auction-completion-deadline/
    /bought-at-auction-mortgage-fell-through/
    /auction-finance-vs-cash-what-it-costs/
  /chain-break-finance/                 ← T2 hub
    /buyer-pulled-out-before-exchange/
    /seller-wont-wait-for-my-sale/
  /unmortgageable-property/             ← T4 hub
    /no-kitchen-or-bathroom-mortgage/
    /short-lease-flat-finance/
  /probate-and-inheritance-tax/         ← T7 hub
  /development-exit-finance/            ← T6 hub
```

Each hub page: comprehensive, tool-anchored, targets Tier 1. Each spoke: single-symptom, fast-loading, targets Tier 2, links up to the hub within the first 400 words.

> **Not yet built:** this nested `/bridging-finance/<hub>/<spoke>/` URL structure is a separate frontend routing project. The first batch (Section 14) publishes on the site's existing flat `/insights/:slug` structure instead, with internal linking between pieces handled the normal way (related-post matching + hand-written contentBrief cross-references). Revisit the nested hub URL architecture once the first batch has proven the content format.

---

## 6. MANDATORY ARTICLE STRUCTURE

Every spoke article follows this shape. Do not pad. Do not open with a dictionary definition.

1. **The mirror (first 60 words).** Restate their exact situation back to them in plain language. No preamble, no "In today's property market…". They should recognise themselves in sentence one.
2. **The clock.** Name the actual deadline and count it out. "You exchanged on the 3rd. Completion is the 31st. That's 19 working days, and a lender needs 10–14 of them." Specific numbers, always.
3. **What happens if you miss it.** Concrete consequences — lost deposit, forfeited fees, seller's right to sue for losses, chain collapse. Factual, not lurid.
4. **The options table.** Every realistic route, including the ones that aren't bridging. Bridging must be presented as one option among several, with honest trade-offs. This is what builds trust and separates you from broker spam.
5. **How the bridging route actually works for *this* trigger.** Timeline in days, what's needed from them, what the lender needs, where it typically stalls.
6. **The real cost.** Worked example with actual numbers for this scenario — gross vs net loan, arrangement fee, monthly interest, exit fee, legals, valuation. Never hand-wave cost.
7. **The exit strategy section.** Non-negotiable. Bridging without a credible exit is the single biggest reason applications fail and the single biggest risk to the borrower. Spell out what a lender will accept.
8. **Who this is wrong for.** Genuinely disqualify people. It raises lead quality and it's the right thing to do.
9. **What to do in the next 24 hours.** A numbered, concrete action list.
10. **FAQ block** — 5–8 questions taken from real search phrasing, marked up with FAQPage schema.

Target length: 1,400–2,200 words for spokes, 2,500–4,000 for hubs. Length serves the reader, never the word count.

---

## 7. VOICE & URGENCY RULES

**Do:**
- Write in second person, present tense. "You've got 19 days."
- Use specific numbers everywhere. Vagueness reads as evasion to a panicking reader.
- Short sentences in the opening. The reader is stressed and skimming.
- Acknowledge the emotion once, briefly, then move to the mechanics. They want competence, not sympathy.
- Use worked examples with real arithmetic shown.
- British English, UK terminology throughout (exchange, completion, solicitor/conveyancer, HMRC, Land Registry, freehold/leasehold).

**Don't:**
- Manufacture false scarcity ("only 3 lenders left!"). The genuine deadline is enough.
- Use fear as the primary lever. Quantify the risk; don't dramatise it.
- Open with "In the fast-paced world of property finance…" or any variant.
- Promise approval, speed, or rates you can't evidence.
- Write "bridging loans are a great solution" — show the arithmetic and let them conclude it.

---

## 8. COMPLIANCE GUARDRAILS — UK FINANCIAL PROMOTIONS

Treat these as hard constraints. Flag anything you're unsure about rather than publishing it.

- **Regulated vs unregulated matters.** Bridging secured against a property the borrower (or an immediate family member) occupies is generally FCA-regulated. Lending for investment, BTL, or commercial purposes is generally unregulated. Say which applies in each article — readers routinely don't know, and it changes their protections.
- **Never guarantee outcomes.** No "guaranteed approval", "instant decision", "everyone accepted", "no credit checks".
- **Balance is required.** Any benefit stated must sit alongside the corresponding risk. Bridging is expensive short-term debt secured on property.
- **Include appropriate risk wording** where the loan is secured on a home, e.g. that the property may be repossessed if the borrower does not keep up repayments or repay the loan at term end.
- **Costs must be shown honestly** — monthly interest rates must not be presented in a way that disguises the annualised cost. Show both where you quote a rate.
- **Don't state live rates or LTV caps as fact** unless they've been verified against a current source in the same session. Use ranges, label them as indicative, and date-stamp them.
- **No advice framing.** Content is educational and informational. Direct readers to a regulated broker or adviser for a recommendation. Never write "you should take a bridging loan".

> Mark: get final financial-promotion sign-off from a compliance-competent person or your FCA-authorised partner before anything in this vertical goes live. Treat the above as a drafting floor, not a legal clearance.

---

## 9. FACTUAL GROUNDING — VERIFY BEFORE PUBLISHING

Use these as drafting scaffolds. **Every figure must be re-verified against a current source before the page ships**, and date-stamped on the page.

- Term length: typically 1–24 months (regulated bridging usually capped at 12 months)
- Interest quoted **monthly**, not annually — commonly in the region of 0.5%–1.5% per month depending on charge, LTV and risk
- Arrangement fee: commonly around 2% of the gross loan
- LTV: commonly up to ~70–75%, higher with additional security
- Interest treatment: retained, rolled-up, or serviced — explain all three, they materially change the net advance
- **Gross vs net loan** — the distinction most articles skip and most borrowers get caught by. Always explain it.
- Realistic speed: days to a few weeks, driven almost entirely by valuation and legals, not by the lender's appetite
- Auction: 10% deposit on the day, balance typically within 28 days (check the specific legal pack — some are 20 working days)
- Exit routes lenders accept: sale of the security, sale of another asset, refinance onto a term product

---

## 10. TECHNICAL & SEO REQUIREMENTS (React/Vite build)

- Every page pre-rendered / SSG'd — no client-only rendering for indexable content
- Schema.org: `Article` or `FAQPage` as appropriate, plus `BreadcrumbList`, plus `Organization` with author entity
- E-E-A-T: named author with credentials, "reviewed by" where a qualified person has checked it, visible last-updated date, cited sources
- Internal linking: every spoke links up to its hub in the first 400 words; hubs link down to all spokes
- Core Web Vitals: the reader is on mobile, stressed, possibly standing in an auction room. LCP under 2.5s is a conversion requirement, not a nicety.
- Title tags written for the symptom, not the product
- Meta descriptions that state the deadline

---

## 11. CONVERSION LAYER

- **Primary CTA is always time-anchored**, matched to the trigger: "Get an indicative decision before your 28 days run out."
- **Above-the-fold CTA on every T1/T2/T5 page** — those readers may not scroll.
- **Qualify in the form, not after.** Capture: trigger type, deadline date, property value, loan needed, exit strategy, whether they own other property. Exit strategy is the single best lead-quality filter.
- **Short retargeting windows.** 14 days, high frequency. A bridging prospect is resolved or gone inside a month — 90-day audiences waste spend.
- **Speed to lead is the whole game.** These leads decay in hours, not days. Route straight into the Twilio inbound calling service with business-hours logic.

---

## 12. TOOLS TO BUILD (highest-leverage assets in this vertical)

Prioritise these over additional articles once the first content batch is live:

1. **Bridging cost calculator** — gross vs net, retained vs rolled-up vs serviced, all fees itemised. Ranks for a Tier 1 term *and* captures deal specifics.
2. **Auction completion countdown** — enter the auction date, get a day-by-day timeline of what must happen and when (valuation instructed, solicitor pack, searches, drawdown).
3. **"Can I get a mortgage on this?" diagnostic** — short quiz on property condition, lease length, construction type; outputs mortgageable / needs bridging / needs specialist lender.
4. **Exit strategy checker** — tests whether their proposed exit is one a lender will actually accept.

---

## 13. ANTI-PATTERNS — NEVER DO THESE

- Generic "What is a bridging loan?" as a standalone page with no trigger attached
- Listicles of "Top 10 bridging lenders" — thin, unrankable, compliance-risky
- Recommending bridging where a longer-term product is obviously more appropriate
- Cost sections that quote a monthly rate without a worked total
- AI-obvious phrasing: "delve", "navigate the landscape", "in today's ever-changing market", "unlock the potential"
- Any content that treats the reader as a beginner when their search query proves they're already mid-transaction

---

## 14. FIRST BATCH — BUILD THESE TWELVE

Order matters: Tier 2 acquisition pieces first, so the hubs have inbound internal links on day one.

1. Bought at auction and my mortgage won't complete in time (T1)
2. How long do you actually have to complete on an auction property? (T1)
3. My buyer pulled out — can I still buy my next house? (T2)
4. The seller won't wait for my sale to complete. What now? (T2)
5. Can you get a mortgage on a house with no kitchen or bathroom? (T4)
6. Short lease flat: why the mortgage was refused and what to do (T4/T10)
7. Mortgage declined a week before exchange — your realistic options (T5)
8. How to pay an inheritance tax bill before the house has sold (T7)
9. Can I borrow against a property I've inherited but not yet sold? (T7)
10. Development finance is expiring and the units haven't sold (T6)
11. "Cash buyers only" — what it means and how to buy anyway (T4/T8)
12. **Hub:** Auction Finance — the complete 28-day guide (T1, Tier 1)

> Status: seeded via `scripts/content-engine/seed-trigger-content.js` (run the "Seed Trigger-Event Content" GitHub Action — workflow_dispatch only). Publishes one per day via the new `TRIGGER` slot / `publish-blog-trigger.yml`, alongside (not replacing) the existing AM/PM keyword queues.

---

## 15. WORKFLOW

For each piece, before writing:
1. State the trigger row (T#), the target query, and the searcher's emotional state in one line each.
2. Confirm the deadline maths you'll use.
3. List the three competing pages currently ranking and state in one sentence what each fails to do.
4. Then draft.

After drafting, self-check against Section 6 (structure), Section 7 (voice), and Section 8 (compliance) and report any clause you're unsure about rather than silently publishing it.

> Note: step 3 (competing-page research) is not automated in the current pipeline — the seeded contentBriefs are written from domain knowledge, not live SERP research. Steps 1–2 and the Section 6/7/8 self-check are baked into `publish-blog.js`'s generation prompt for every `contentFramework: 'trigger-event'` row.
