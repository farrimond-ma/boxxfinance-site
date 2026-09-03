# Landlord-heavy UK cities — research for per-service location pages

**Researched:** 2026-09-03
**Purpose:** choosing cities for buy-to-let refinance location pages (`buy-to-let-refinance-<city>`), rather than crossing every service with every town.
**Machine-readable output:** [`src/data/landlordCities.json`](../src/data/landlordCities.json)

---

## The question this answers

Six services × 340 existing location pages is 2,000 pages nobody asked for. The useful version is targeting each service at the places its customers actually are. For buy-to-let refinance that means landlord density, not population — Cambridge is a bigger name than Burnley and a far worse buy-to-let market.

**Every city in the shortlist below already has a bridging location page.** That matters: the site has established local relevance for each of them, so a BTL refinance page is extending existing coverage rather than starting cold in an unfamiliar town.

---

## What the data says

### 1. Landlord purchases are concentrated in the North

- A record **39%** of buy-to-lets purchased in the first four months of 2025 were in the North of England or the Midlands, up from 24% in 2007.
- The **North East** is the clearest landlord market in the UK: landlords bought around **28% of all homes sold** there in 2025, up from 23% in 2015.
- The **North West** leads on buy-to-let mortgage volume (**17.6%** of the national total) and HMO concentration (**20.4%**).

This is the single strongest signal in the research. Landlord activity, and therefore refinance demand, is disproportionately northern.

### 2. Yields follow the same map

Gross yields, September 2025:

| City | Gross yield |
|---|---|
| Sunderland | 9.3% |
| Aberdeen | 8.3% |
| Burnley | 8.2% |
| Dundee | 8.1% |
| Hull | 8.0% |
| Glasgow | 7.8% |
| Liverpool | 7.7% |
| Newcastle | ~7.5% |
| Middlesbrough | ~7.5% |
| Blackburn | ~7.5% |
| **London** | **~5.1%** |
| **Oxford** | **5.0%** |
| **Cambridge** | **4.7%** |

By region: North East **7.9%**, Scotland **7.6%**, North West **6.8%**. The national average new buy-to-let yield is **7.1%**.

Lower entry prices magnify the rent-to-price ratio, which is why northern cities and Scotland dominate and the South East does not.

### 3. Private rented sector share is a different signal

PRS share tells you where *tenants* are, which is not identical to where landlords are buying. It skews heavily to London and to student cities:

| Area | Privately rented dwellings (2023) |
|---|---|
| City of London | 51.8% |
| Westminster | 47.9% |
| Kensington and Chelsea | 42.8% |
| Newham | 41.1% |
| Tower Hamlets | 41.0% |
| **Brighton and Hove** | **33.2%** (highest outside London) |
| **Manchester** | **33.2%** (highest outside London) |
| Sheffield | 18.7% |
| *England average* | *20.8%* |

High PRS share without high yield still means real landlord density — these are places with a lot of existing mortgaged stock to refinance, even if fewer new purchases.

### 4. Scotland deserves separate treatment

Boxx is Coatbridge-based, and Scotland is the **second-highest yielding region in the UK**. Aberdeen, Dundee and Glasgow all sit in the national top ten. Among Scottish cities, Edinburgh has the highest share of people in private rented housing (**23.5%**) and Glasgow the lowest (**16.8%**) — but Glasgow's yield is materially better.

**Important for content:** Scotland has a different legal regime — mandatory landlord registration, Private Residential Tenancies rather than ASTs, and its own rent legislation. Scottish location pages need copy written for that regime, not an English page with the city name swapped. Getting this wrong is the kind of error a Scottish landlord spots immediately.

---

## Recommended tiers

Full city lists in [`landlordCities.json`](../src/data/landlordCities.json).

**Tier 1 — high-yield landlord heartlands (16 cities).** Sunderland, Newcastle, Middlesbrough, Hull, Liverpool, Manchester, Bradford, Burnley, Blackburn, Blackpool, Stoke-on-Trent, Doncaster, Barnsley, Bolton, Wigan, Salford. Highest yields and the biggest landlord share of purchases. Start here.

**Tier 2 — Scotland (4 cities).** Glasgow, Edinburgh, Dundee, Aberdeen. High yields, home market, distinct legal regime.

**Tier 3 — high PRS share (19 cities).** Brighton, Nottingham, Leicester, Sheffield, Leeds, Coventry, Portsmouth, Southampton, Norwich, Cardiff, Bristol, Preston, Plymouth, Derby, Wolverhampton, Stockport, Rotherham, Luton, Birmingham. Moderate yields, high landlord density, frequent HMO refinancing.

**Tier 4 — low-yield, high-value (4 cities).** London, Reading, Oxford, Cambridge. Few landlord purchases, but far larger loans. Lowest priority by volume, highest by value per enquiry.

**43 cities total.** Tiers 1 and 2 alone are 20 pages — a sensible first run.

---

## The other two services

The question was specifically about landlord-heavy cities, and that research is above. For completeness, and to be clear about what is *not* evidenced here:

**Bad credit mortgages.** I found no defensible per-city data on adverse credit prevalence. It would be easy to reach for a deprivation index as a proxy and rank cities by it, and that would be both statistically weak and a distasteful basis for targeting. Recommend choosing these cities on population and search volume instead, or skipping location pages for this service entirely — the topic is national and the searcher's question ("can I get a mortgage with a default") has no local component.

**Secured loans.** Driven by homeowner equity, so the useful map is close to the inverse of the landlord one — areas with high owner-occupation, long tenure and accumulated equity, meaning suburbs and commuter towns rather than the northern rental cities above. This needs its own research pass; do not reuse the landlord list for it.

---

## Before building any of this

1. **`SERVICE_FILTER` on `publish-location.yml` is pinned to `Bridging Finance`.** Any `buy-to-let-refinance-liverpool` row seeded into the sheet would be skipped silently until that is widened. This is the same trap that blocked the new blog rows.
2. **Location publishing is currently paused** — the cron is commented out deliberately (2026-09-03).
3. **The queue seeder builds bridging rows only.** `seed-content-engine.js` would need a service dimension before it can produce these.
4. **Mark's sequencing:** build these *after* the 24 focus-service topic articles have published, so the location pages have real articles to link to.

---

## Sources

- [ONS — Subnational estimates of dwellings and households by tenure, England (2023)](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/articles/researchoutputssubnationaldwellingstockbytenureestimatesengland2012to2015/2023)
- [ONS — Private rented sector statistics from across the UK (2025)](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/articles/privaterentedsectorstatisticsfromacrosstheuk/2025)
- [House of Commons Library — 2021 census results: home ownership and renting](https://commonslibrary.parliament.uk/constituency-data-housing-tenure/)
- [Parachute Law — Highest-yielding areas for buy-to-let (September 2025)](https://www.parachutelaw.co.uk/news/property/the-highest-yielding-areas-for-buy-to-let-property-in-the-uk-september-2025)
- [Landlord Today — Landlords head north in search of higher yields (May 2025)](https://www.landlordtoday.co.uk/breaking-news/2025/05/landlords-head-north-in-search-of-higher-yields/)
- [MoneyWeek — The best UK regions for buy-to-let landlords](https://moneyweek.com/investments/property/top-areas-for-buy-to-let)
- [The Ferret — Explainer: Scotland's private rental sector](https://www.theferret.scot/explainer-scotlands-private-rental-sector/)
- [Understanding Glasgow — tenure across Scottish cities](https://www.understandingglasgow.com/glasgow-indicators/social-capital/tenure/scottish-cities)
- [Sheffield City Council — Census 2021 housing topic summary](https://www.sheffield.gov.uk/sites/default/files/2024-09/housing-topic-summary.pdf)

Figures are as published at the dates given; yields in particular move, so re-check before relying on any specific number in customer-facing copy.
