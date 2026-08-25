# Competitor content gap analysis — 25 Aug 2026

Built by pulling the public sitemaps of five bridging competitors (Together,
MT Finance, West One, Roma Finance, Octane Capital), isolating their editorial
pages, and comparing topics against every published Boxx post using the same
similarity measure as the duplicate-coverage guard in publish-blog.js.

**This is not ranking data.** Real competitor positions need a paid tool
(Ahrefs/Semrush). This shows what they publish, which is the input to rankings
and is free to observe.

## Scale

| | Count |
|---|---|
| Competitor URLs pulled | 2,238 |
| Editorial pages (blog/news/hub/guides) | 1,265 |
| Bridging-relevant with no close Boxx equivalent | 235 |
| **Genuinely informational after stripping PR** | **25** |

Most of the 235 was corporate noise — product launches, rate changes, team
announcements, case studies, brand content. A broker cannot and should not
replicate lender announcements, so only the question-led content is listed.

MT Finance publishes no editorial content at all (case studies only). Roma
Finance and Octane Capital produce almost entirely PR. **West One and Together
are the only two running a real content operation** — 19 and 6 of the 25.

## The gaps, clustered

### HMOs — strongest cluster, Boxx has 1 post
Boxx covers only `bridging-loans-for-hmo-conversion`.

- A beginner's guide to HMOs *(West One)*
- Can higher yield be generated from HMOs in the current climate *(West One)*
- Why the UK's booming student population could lead to an HMO revival *(West One)*
- Refinancing an HMO on a corporate/local-authority letting *(West One)*
- Is student accommodation still a good investment for landlords *(Together)*

### Second charge — Boxx has 3, all product-explainer; competitors angle at use cases
- Second charges for business purposes *(West One)*
- Second charge to fund green/EPC home upgrades for landlords *(West One)*
- Why high-net-worth borrowers are turning to second charge *(West One)*
- Remortgage or second charge — how to choose *(Together)*

### Landlord affordability and strategy — Boxx has none
- How top-slicing helps affordability on buy-to-let cases *(Together)*
- Should you conduct a survey on a BTL investment *(West One)*
- Recession and landlords *(West One)*

### Refurbishment and flipping — Boxx has 1
- Five tips for your property flip *(Together)*
- Renovating on a tight budget *(Together)*
- Improving a commercial property's EPC rating *(West One)*

### Chain breaks — Boxx already covers this well
- Five tips if you are tied up in a property chain *(Together)* — Boxx has
  several chain-break posts already; listed for completeness, low priority.

## Recommended priority

1. **HMO cluster** — the clearest gap. Two competitors are investing in it,
   Boxx has one conversion-specific post, and it maps to the Refurbishment
   Loans and Buy-to-Let pillars already in the AI visibility checker.
2. **Second charge use cases** — Boxx has the product explainers but not the
   situations that make someone search. That is where the intent is.
3. **Top-slicing / BTL affordability** — zero coverage, and a real question
   landlords ask.

Skip the dated market commentary ("why recession doesn't need to be a dirty
word") — it dates badly and competes on opinion rather than answering a question.

## Caveats

- Sitemaps show what is published, not what performs. A competitor may have
  20 HMO posts that all rank nowhere.
- Slug-based topic matching is approximate; a Boxx post could cover a topic
  under wording this did not match.
- MT Finance's sitemap exposed no editorial section, and LendInvest's standard
  sitemap path 404s, so neither is represented here.

## Reproducing this

The URL pulls and intermediate JSON are in the session scratchpad, not the
repo. Re-running means re-pulling the five sitemaps — worth doing perhaps
quarterly rather than on a schedule, since competitor content strategy moves
slowly and the PR noise ratio is high.
