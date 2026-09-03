# Secured loans & second charge — town research for location pages

**Researched:** 2026-09-03
**Purpose:** choosing towns for secured loan and second charge location pages.
**Machine-readable output:** [`src/data/securedLoanCities.json`](../src/data/securedLoanCities.json)
**Companion:** [landlord-cities-research.md](./landlord-cities-research.md) — the buy-to-let map, which this is close to the inverse of.

---

## The customer this targets

A secured loan or second charge needs three things present at once:

1. **A property the borrower owns** — with a mortgage, in most cases
2. **Equity** in it
3. **A reason not to remortgage** — an early repayment charge, or a rate worth protecting

That is a mortgaged owner-occupier in a settled area, which is a different person in a different place from the buy-to-let landlord. Reusing the landlord city list would have been actively wrong: the northern rental cities that top the yield tables are where people *rent*, and a tenant cannot take a loan secured on a house they do not own.

---

## What the data says

### 1. Mortgaged ownership peaks in the southern commuter belt

Highest share of households owning with a mortgage, loan or shared ownership (Census 2021):

| Local authority | Owned with a mortgage |
|---|---|
| Wokingham (Berkshire) | 42.0% |
| Dartford (Kent) | 41.0% |
| Hart (Hampshire) | 40.2% |
| Bracknell Forest (Berkshire) | 39.7% |
| Central Bedfordshire | 39.3% |
| *Vale of Glamorgan (highest in Wales)* | *33.7%* |

Every one of the English leaders is in the south or east. These are commuter towns full of working-age households part-way through a mortgage — the exact profile.

### 2. Property wealth is concentrated in the same places

From the ONS Wealth and Assets Survey (April 2020 to March 2022):

- **South East:** median household total wealth **£503,400** — the wealthiest region, over twice the North of England
- **North East:** **£179,900**
- **London:** **£226,200** — below several other regions despite the highest house prices, because over 50% of London households rent

Net property wealth makes up around **40%** of household wealth. More equity means larger loans, and a secured loan case is priced on the equity available.

**London is a trap here.** High prices suggest a rich secured-loan market, but its ownership rate is low and its wealth ranks mid-table. It belongs in the buy-to-let list, not this one.

### 3. Outright ownership is the wrong signal

The areas with the highest outright ownership are North Norfolk (48.6%), Rother (48.4%), Staffordshire Moorlands (48.2%), Ceredigion (47.9%) and Derbyshire Dales (47.7%) — retirement and rural areas.

Outright owners *can* take a first-charge secured loan, but they are older, borrow less often, and are not the second charge market at all, since there is no first charge to sit behind. **Mortgaged** ownership is the signal to follow, not ownership generally.

### 4. What the market is actually being used for

Second charge lending reached **£2.14bn** in 2025, and Q1 2026 new business was up **33%** by value to **£625m**, with volumes up 22% to nearly 11,500 agreements. The market is growing quickly.

**Loan consolidation accounts for at least 60% of new business.** That is the most useful single fact in this research and it should shape the copy: these pages should not lead on home improvements and dream kitchens. The typical borrower is consolidating more expensive unsecured debt while protecting a mortgage rate they cannot replace.

That framing also carries a duty of care. Consolidating unsecured debt into a loan secured on the home converts debt that cannot take the house into debt that can, and stretches it over a longer term. The pages must say so plainly — and the repossession warning already used on the service pages applies to every one of them.

### 5. No regional second charge data exists

The FLA publishes national aggregates only. There is no public breakdown of second charge lending by region or town, and I could not find a credible proxy. The tiering below therefore rests on mortgaged-ownership share and property wealth, which are sound but indirect. Worth stating rather than dressing up as something firmer.

---

## Recommended tiers

Full lists in [`securedLoanCities.json`](../src/data/securedLoanCities.json). All 65 towns already have a bridging location page.

**Tier 1 — southern commuter belt (20 towns).** Wokingham, Bracknell, Reading, Slough, Watford, St Albans, High Wycombe, Aylesbury, Milton Keynes, Bedford, Basingstoke, Guildford, Woking, Crawley, Horsham, Maidstone, Chelmsford, Basildon, Harlow, Stevenage. Peak mortgaged ownership and the deepest equity. Highest value per case; also the most competitive.

**Tier 2 — Scotland and the Central Belt (15 towns).** Coatbridge, Motherwell, Hamilton, East Kilbride, Cumbernauld, Falkirk, Livingston, Paisley, Stirling, Perth, Ayr, Kilmarnock, Dunfermline, Kirkcaldy, Inverness. Smaller loans, but this is the home market and a Coatbridge broker has an advantage here that it does not have in Surrey. **Scottish secured lending differs in process** — standard securities rather than legal charges, and different enforcement — so this copy must be written for Scotland, not renamed from an English page.

**Tier 3 — regional cities and market towns (30 towns).** Northampton, Peterborough, Swindon, Gloucester, Cheltenham, Worcester, Telford, Shrewsbury, Lincoln, York, Harrogate, Chester, Macclesfield, Warrington, Solihull, Colchester, Ipswich, Southend-on-Sea, Exeter, Taunton, Bath, Salisbury, Winchester, Tunbridge Wells, Bournemouth, Poole, Newport, Swansea, Barry, Wrexham. Settled ownership, decent equity, much less competition.

**65 towns total.** Tier 2 is the sensible first run — 15 pages, home turf, least competition, best chance of ranking.

---

## Overlap with the landlord list

Only **Reading** appears in both, and in different roles: tier 4 (low-yield, high-value) for buy-to-let, tier 1 for secured loans. The two maps are otherwise entirely separate, which is a good sign that both are measuring something real rather than just listing big towns.

If both services eventually get location pages, keep the two page sets distinct in framing — a `secured-loans-reading` page and a `buy-to-let-refinance-reading` page must not read as the same article with a product name swapped, or they will cannibalise each other exactly as the 2026-08 duplicates did.

---

## Five towns worth adding to bridging first

These came up as strong secured-loan candidates but have **no bridging location page**, so there is no existing local relevance to build on: **Dartford** (41.0% mortgaged ownership, second highest in England), **Fleet** (Hart district, 40.2%), **Sevenoaks**, **Stafford**, **Airdrie** (neighbouring Coatbridge, which is an odd gap in the home market).

Dartford and Fleet in particular sit at the very top of the mortgaged-ownership table and are missing entirely. Worth seeding as bridging pages whenever the location queue is refilled.

---

## Before building any of this

The same three blockers as the landlord list apply — `SERVICE_FILTER` on `publish-location.yml` is pinned to `Bridging Finance`, location publishing is paused, and the seeder has no service dimension. See [landlord-cities-research.md](./landlord-cities-research.md#before-building-any-of-this).

---

## Sources

- [Census 2021 — Key statistics for housing by local area, England and Wales](https://www.sudburymercury.co.uk/news/national/23230822.census-2021-key-statistics-housing-local-area-england-wales/)
- [ONS — Household total wealth in Great Britain, April 2020 to March 2022](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/bulletins/totalwealthingreatbritain/april2020tomarch2022/pdf)
- [House of Commons Library — Wealth in Great Britain](https://researchbriefings.files.parliament.uk/documents/CBP-10210/CBP-10210.pdf)
- [Finance & Leasing Association — second charge mortgage statistics](https://fla.org.uk/news-division/second-charge-mortgage/)
- [Mortgage Solutions — Second charge lending rises to £2.14bn in 2025](https://www.mortgagesolutions.co.uk/specialist-lending/second-charge-lending/2026/02/24/second-charge-lending-rises-to-2-14bn-in-2025/)
- [Mortgage Solutions — Second charge lending up 33% to £625m in Q1 2026](https://www.mortgagesolutions.co.uk/specialist-lending/2026/05/12/second-charge-mortgage-lending-up-33-to-625m-in-q1/)

Wealth figures are 2020–22 and lending figures are 2025–26; re-check before quoting any of them in customer-facing copy.
