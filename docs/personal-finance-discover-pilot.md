# Personal Finance / Google Discover Pilot — 2026-08-20 (narrowed 2026-08-24)

## What this is

Boxx is a B2B commercial finance broker. The idea: publish UK consumer
personal-finance/property content (stamp duty, remortgaging, savings, etc.)
alongside it, on the theory that it's more likely to get picked up by
Google Discover (a personalised feed, not search) than niche bridging-loan
content ever would — broad, personally-relevant topics are what Discover
favours.

The full plan (8 evergreen pillars, 630 pieces over 90 days) is built but
**deliberately not switched on**. Mark's direction: start small, start with
non-evergreen content specifically, and use real results to decide whether
to scale — not commit to 630 pieces before knowing if Discover picks any of
it up at all.

## 2026-08-24 update: editorial gate added

Mark checked Search Console and found a published post picking up thousands
of impressions — so Discover traffic does work — but on reviewing what had
actually gone out, two of the ten posts published 21-24 August were off
topic: *"Andy Burnham may need tax rises to fund cost of living support"*
(party politics) and *"Pay-it-forward schemes exist to help with bills"*
(general cost of living, no property content). Both reached the pipeline via
the `inflation` / `cost of living` keywords, now removed from the pre-filter.

**The scope, in Mark's words:** these posts run *in addition to* the daily
bridging posts and exist to earn Discover traffic, so they do **not** need a
bridging-loan angle. Landlords, property, auctions, mortgages, conveyancing
and property taxes are all wanted. Party politics and general
cost-of-living/household-bills content are not.

An earlier version of this gate got that wrong in the other direction — it
demanded a concrete bridging-loan use case, which would have rejected most of
the eight genuinely on-topic landlord and property posts. Worth remembering
if this is ever tightened again: **too strict starves the pipeline, and the
failure is silent** (the script just reports "nothing to publish", which is
also what a correct quiet run looks like).

`checkMarketRelevance()` in `publish-personal-finance-news.js` now makes the
call, with explicit include/exclude lists in its system prompt. The keyword
list is only a cheap pre-filter feeding it.

**Verifying the gate:** run the workflow via *Run workflow* with mode
`test-gate`. It replays all ten of the above stories through the live gate
and asserts the 8 good / 2 bad split, exiting non-zero if the gate has
drifted. Use it after any change to the gate prompt.

The two off-topic posts are still live — unpublishing them is a separate
decision, not made here.

## The thin-post regenerator was rewriting these posts (fixed 2026-08-24)

Worth knowing about, because nothing about it was obvious from either script.

`regenerate-thin-posts.js` rewrites any published post under 1200 words. News
posts are written to 700-1000 words **by design**, so every one of them looked
"thin" and became a target. Worse, `inferService()` returned `'Latest News'`,
which has no `SERVICE_META` entry, so it silently fell back to **Business
Loans** — and rewrote landlord and property news as evergreen business-loan
guides, padding them to ~1700 words, injecting business-loan CTAs and dropping
the source attribution link entirely. Articles built on Property118 and
Guardian reporting ended up crediting nobody.

Three posts were rewritten this way before it was caught
(`landlord-couple-locked-out-capital-professional-advice`,
`landlord-incorporation-relief-new-hmrc-claim-rules`,
`landlords-epc-upgrade-costs-royal-estates-comparison`). They have not been
restored — they read as business-loan content, not news. The remaining six in
the queue were all news posts too.

Two fixes, both in `regenerate-thin-posts.js`:
- `EXCLUDED_SERVICES` now skips `'Latest News'`, whatever the word count.
- The `|| SERVICE_META['Business Loans']` fallback is gone. An unknown service
  now exits non-zero instead of guessing a product, so the next time a service
  is added or renamed it surfaces as a failure rather than quietly mislabelling
  live articles.

**If you add another content pillar with its own word-count profile, check
this script first.**

## Hero images: repetition and Americana (fixed 2026-08-24)

Mark spotted the same apartment block on repeated landlord posts, and that it
looked American. Both were true, and worse than they appeared: the ten news
posts were sharing **five** images, one used four times.

Two causes:
- `fetchPexelsImage()` requested 8 results and took `filtered[0]` — the first
  one, every time. One fixed query per category meant the same query returned
  the same photo forever.
- The queries said "UK residential property", but Pexels is US-heavy and "UK"
  barely constrains it, so landlord posts kept drawing American apartment
  blocks.

(The four-way duplicate was a separate contributor: those four posts had been
rewritten by the thin-post regenerator, which sourced its own image from its
`'UK business professionals'` fallback. Excluding news posts from that script
stops it recurring.)

Now: `deriveImageQueries()` returns several variants per category, naming
British building types (terraced, semi-detached, Victorian, Georgian) that
match how UK photos actually get tagged; results are filtered against
`NON_UK_MARKERS` and preferred on `UK_MARKERS`; the pool is 80 rather than 8;
and each chosen photo's Pexels id is recorded on the tracking entry so
`usedPhotoIds` stops it being picked again. Posts sharing a query still get
different photos.

The existing posts keep their current images — this only affects new ones.

## Generated articles are now validated before publishing (2026-08-24)

The prompt always said the source citation and funding link were mandatory,
but nothing checked the output, so two posts went live without them:
`mansion-tax-hmrc-inspectors-property-valuations` (no funding link) and
`landlords-feel-persecuted-nrla-research` (no links at all, 588 words).

`validateArticle()` now enforces three things, and an article that fails is
never published:
- a citation link to the source story URL
- a link to `/funding-solutions`
- at least `MIN_ARTICLE_WORDS` (650) words

On failure it retries once, feeding the specific problems back to the model.
If the retry also fails it publishes nothing and exits non-zero, so the
failure watchdog raises it instead of the run passing quietly.

The source link is the one that really matters: these articles are written
from other outlets' reporting, so shipping without the credit is not a
formatting slip.

Also fixed alongside this: `parseRSS()` never entity-decoded the item link,
only the title and description. Feed URLs with query strings arrive escaped
(BBC's look like `?at_medium=RSS&amp;at_campaign=rss`), so the `&amp;` was
being written straight into the published citation link and breaking it. The
dedupe set now matches both the encoded and decoded forms, so stories tracked
before this fix are not republished.

## What's live right now

**`scripts/content-engine/publish-personal-finance-news.js`** + its workflow
(`publish-personal-finance-news.yml`, runs 3x/day). This is the *reactive*
piece: it watches consumer-facing UK news feeds (deliberately not the
trade-press feeds `publish-linkedin-news.js` uses, which are written for
brokers, not the general public), and when something genuinely new and
relevant has happened in the last 2 days, writes and publishes one short
(700-1000 word) news-analysis article about it. Most runs will find nothing
worth publishing — that's correct, not a bug. It won't publish more than
one article per run, and it never invents facts beyond what's in the
source story (same anti-fabrication discipline as the bridging-vertical
fixes earlier this week).

**Feed list**: `src/data/personalFinanceNewsFeeds.json` — a maintained
registry, not a hardcoded list. 20 active feeds as of 2026-08-21 (started
at 3, expanded after Mark flagged the original set leaned too heavily on
BBC Business's general-economy slant rather than homeowner/landlord-
specific coverage — now includes This Is Money's Mortgages & Home/Buy to
Let/Saving/Bills sections, Landlord Today, Property118, Property Investor
Today, Letting Agent Today, Rightmove, the Telegraph, Which?, and others).
The registry also tracks 18 "candidate" feeds that failed validation
(blocked, 404, empty, etc. — see the file for why each one), and 3
"rejected" feeds that work fine technically but were excluded on editorial
grounds (e.g. Mortgage Solutions is genuinely broker/trade-audience, not
consumer; one candidate feed labelled "Property" turned out to actually be
a politics feed). `scripts/content-engine/discover-personal-finance-feeds.js`
runs weekly (`discover-personal-finance-feeds.yml`) to re-test the active
and candidate feeds and keep the registry self-healing — it deliberately
never touches "rejected"/"excluded" entries, since a feed can pass a pure
connectivity test while still being wrong for the audience; only a human
reviewing actual content can catch that. This script does NOT discover
genuinely new outlets on its own (no search API wired in) — new candidates
get added to the registry by hand, on request; the automation's job is
keeping the existing list accurate over time, not finding new things.

**Images**: reuses the same Pexels API pipeline already proven on the
bridging vertical (real licensed photos, filtered to avoid non-UK
currency, converted to WebP) — not a placeholder or a generic stock image
repeated on every article.

## What's built but NOT live

- **`scripts/build-personal-finance-schedule.py`** — generates
  `personal-finance-schedule-90day.xlsx`, the full 8-pillar, 630-piece,
  90-day evergreen schedule. Still has an unresolved design flaw of its own
  (Pillar 17 "Property News" was originally pre-scheduled with fixed dates,
  which doesn't work for news — that's exactly why the reactive script
  above exists as a separate thing instead).
- **`scripts/content-engine/sync-personal-finance-schedule.js`** — would
  push that spreadsheet's rows into the live ContentEngine Google Sheet.
  Not run. Even if it were, `publish-blog.yml`'s `SERVICE_FILTER: "Bridging
  Finance"` means the blog-publishing workflow wouldn't pick up any of
  those rows without further changes.

Don't run either of these until there's a decision to scale — see below.

## How to tell if this is actually working

The whole point is Google Discover traffic specifically, which does **not**
show up in normal Search Console "Search results" performance — it has its
own report:

**Search Console → Performance → Discover** (a separate tab/report from
the default Search one; only appears once a property has had any Discover
impressions at all, so it may show nothing for a while even if articles are
published — that's normal in the early weeks).

What to look for after a few weeks:
- Any impressions at all in the Discover report (the real first signal —
  zero after a month suggests Discover isn't picking the domain up for this
  content, regardless of quality)
- Which specific articles get impressions, if any — tells you whether it's
  the reactive-news angle working, or something else
- Click-through rate on any impressions you do get

`search-console-insights.js` already exists for the regular Search report;
it does not currently pull Discover-specific data. Worth extending once
there's actually something to look at — not worth building before that.

## Decision point

Once there's a few weeks of real Discover data (or a confirmed absence of
any), revisit: scale up the evergreen pillars, adjust the reactive script's
feeds/keywords, or conclude Discover isn't worth prioritising for this site
and park the whole pilot. Update this doc with the outcome either way.
