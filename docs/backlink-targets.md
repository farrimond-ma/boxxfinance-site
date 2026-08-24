# Backlink targets — status and triage

The full list is `docs/backlink-targets.csv` (101 targets, built 15 Aug 2026).

It previously existed only as `boxx-backlink-targets.pdf` in
`Downloads\Boxx\` (an earlier, 5 Aug version) and as a CSV in a temporary
scratchpad folder, which is why it could not be found and would eventually
have been deleted. Moved into the repo 2026-08-24 so it is durable.

## Read this before working the list

**Roughly three quarters of it is no longer viable.** The list was compiled
before we established that the UK bridging and property trade press **do not
hyperlink sources in their article copy** — they will name a broker, but as
plain text. Mark also sent 10 outreach emails from that route and **every one
bounced**, because the contact addresses were guessed generic patterns
(`editor@`, `editorial@`, `news@`) rather than real journalist addresses.

That kills the editorial-pitch route specifically, which is most of the list.
Nine entries are the exact publications the emails bounced from.

| Bucket | Count | Status |
|---|---|---|
| Directory / membership | 8 | **Live** — these actually hyperlink |
| Guest / sponsored content | 17 | **Probably live** — you write the piece, so the link is in your control |
| Editorial pitch only | 76 | **Dead** — no link in copy, contacts bounce |

## The 8 that actually give links

Ordered by how realistic they are for Boxx.

| Body | Domain | Notes |
|---|---|---|
| **NACFB** | nacfb.org | Membership directory listing. Acceptance was close as of 24 Aug 2026 — this is the immediate one. |
| Propertymark | propertymark.co.uk | Property professional body, broker directory route. |
| UK Finance | ukfinance.org.uk | Main UK banking/finance trade body; membership directory listing is the realistic route. |
| Finance & Leasing Association | fla.org.uk | Relevant only if Boxx pursues asset finance / leasing membership. |
| NRLA Property Magazine | nrla.org.uk | National Residential Landlords Association's own magazine — membership/PR route. |
| UK Business Angels Association | ukbaa.org.uk | Relevant only if pursuing an angel / growth-funding angle. |
| Building Societies Association | bsa.org.uk | Adjacent sector, lower priority. |
| British Business Bank | british-business-bank.co.uk | Government-backed, high prestige. PR / resource-hub route, not a directory listing — hardest of the eight. |

Every one of these requires genuine eligibility. They are membership
directories, not link farms — the link is a by-product of actually being a
member, which is why they are worth having.

## When the NACFB listing goes live

Worth getting right first time:

- Give the exact canonical URL — `https://boxxfinance.co.uk` (no `www`, no
  trailing slash). The site 301s `www` → non-`www`, and a redirected link
  passes slightly less than a direct one.
- Use the exact registered company name, consistent with Companies House and
  the site footer, so the citation matches other listings.
- Check whether the directory link is `nofollow`. Many trade bodies apply it
  by default. It is still worth having for referral traffic and credibility,
  but if it is nofollowed it will not move rankings, and expectations should
  be set accordingly rather than waiting for an effect that cannot come.

## Related

`scripts/content-engine/backlink-outreach.js` targets the dead editorial route
and is deliberately unscheduled. Note that `health-check.js` and
`generate-status.js` both still reference a `backlink-outreach.yml` workflow
that **does not exist**, so both dashboards are reporting on a phantom job.
