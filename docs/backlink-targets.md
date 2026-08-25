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

## Free/cheap directories — tested, links confirmed followed

Checked 25 Aug 2026 by pulling a live listing and reading the `rel` on the
business's own website link.

| Directory | Cost | Evidence |
|---|---|---|
| [FreeIndex](https://www.freeindex.co.uk/) | **Free** (optional £7.95/mo Premium only removes ads — not needed for the link) | `rel=NONE` on `https://clarityft.co.uk/` from a live profile page |
| [Approved Business](https://www.approvedbusiness.co.uk/) | Package-based, **not yet confirmed** — check before committing | `rel=NONE` on `https://www.keyelement.co.uk`. B2B/trade focus, better audience fit than a consumer directory |

**Could not verify** (403 / Cloudflare / timeouts, so untested — do not assume
either way): Yell, Cylex, Hotfrog, Scoot, Tupalo, BusinessMagnet. Yell is
widely *reported* to nofollow but that was not confirmed here.

**Temper expectations.** Generic directory links have been heavily discounted
by Google since the directory-spam era. "Followed" means not worthless, not
valuable — one NACFB listing is worth more than all of these together. Worth
one hour, once. Not a project, and not worth paying for.

**Free things with more value than any of the above:** claim the **Google
Business Profile** (biggest single local signal, and a trust signal for a
regulated firm), then **Bing Places**. Keep name/address/phone identical
across all listings and Companies House — the consistency is what Google uses
to confirm the business is real.

## Routes evaluated and ruled out

Checked 25 Aug 2026, so they don't get re-proposed.

**The test, for anything new:** open a live listing on the site, check whether
the listed business's own website link is `nofollow`, and look at what the site
links to *followed*. If your link is nofollowed while someone else's is not,
you are the product rather than the customer.

| Route | Verdict |
|---|---|
| **Glasgow Chamber of Commerce** | Standard membership does include a directory link, but the directory lives on `portal.glasgowchamberofcommerce.com` **behind password protection** — Googlebot cannot crawl it, so the link is worth nothing for SEO. Public followed links exist only at **Gold Partner** tier: **£5,500 + VAT** (£6,600). Mark's call: not worth it yet. Still arguable as a *networking* spend (~1,800 members, open regardless of location) — just never as a link buy. |
| **Scottish Chambers of Commerce** | Cannot join. It is an umbrella body for 30 local chambers; its members are the chambers, not businesses. Its `/partners/` page has followed links but the partners are Heathrow, SSE, CGI, ScotRail — national sponsorship scale. |
| **Lanarkshire Chamber of Commerce** | Not assessed — the site looks stale (news pages 404, markup contains a 2011-dated archive URL). Phone them rather than trusting the site. |
| **118 Business Directory** | **Avoid.** Listed businesses get `rel="nofollow"`, while followed sitewide links go to paying advertisers — one of them an escort domain. ~75,000 bulk-scraped listings. No value, and bad company for a regulated firm. |
| **BrightLocal Citation Builder** | Reputable company, wrong tool. Citations are a *local map pack* signal, not backlinks, and most citation sites nofollow. Useful only for the one real Lanarkshire location; does nothing for the 370 location pages. Do Google Business Profile free first. |
| **markhigginsmortgages.com** (same owner) | Worth one contextual link for **referral traffic and entity association**, not for ranking — a self-owned link is not an independent vote. Different IPs, so hosting is not the issue; common ownership is. Avoid sitewide footer links or exact-match anchors. |
| **Press release distribution** (PRWeb, EIN, Newswire etc.) | Not a backlink route. Google's policy is that press release links should be `nofollow`/`sponsored`. Any service promising dofollow links from releases is selling a link scheme. Earned digital PR is the real version — but see the trade-press finding above before aiming it at this sector. |

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
