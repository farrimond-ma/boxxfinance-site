# How the Boxx Content Engine Works — Plain-English Reference

**Written: 2026-07-14**
**Audience: the site owner, not engineers. For the formal agent spec see [ARCHITECTURE.md](ARCHITECTURE.md) and [AGENTS.md](AGENTS.md).**

---

## The one-sentence version

Topics flow in from a few sources → land in a scheduling queue (the Google Sheet) →
an AI writer turns each one into a full article → it publishes to the live site →
once a week the system measures what actually happened in Google and in AI answers,
and feeds new topics back into the queue. It is a loop that gets a little smarter
every week.

```
  Editorial seed list ┐
  Search Console (SEO) ┼──►  Content queue  ──►  AI writer  ──►  Published +
  AI visibility (GEO) ┘      (Google Sheet)     (GPT-4o)         prerendered page
        ▲                                                              │
        └──────────────── weekly loop: measure + new topics ──────────┘
```

---

## Where blog keywords come from

Every blog topic enters the queue from one of four sources. Three are automatic.

**1. Editorial seed list (human).**
A hand-written list in `scripts/content-engine/populate-content-engine.js` — the
original backlog of obvious topics. This is now the *minority* source.

**2. Search Console content gaps (SEO — real demand).**
Weekly, `search-console-insights.js` asks Google (via the Search Console API) what
people actually type that we show up for. It finds queries where Google *already
shows us impressions but we have no dedicated page*. That proven demand is
auto-queued as a new article. The keyword is the real search query, verbatim.

**3. Trending queries (SEO — momentum).**
`gsc-performance-report.js` (added 2026-07-14) compares the last 90 days to the
prior 90 days and finds queries whose impressions are *rising fast* (roughly
doubled) but that rank below page 1 with no page. These catch a phrase on the way
up. They flow into the same queue via the `Search_Console` tab.

**4. AI visibility gaps (GEO — answer engines).**
A separate weekly check asks ChatGPT, Claude, Gemini and Perplexity our target
questions and records whether **Boxx was named vs which competitors were**. Where
competitors get cited and we do not, that question becomes a high-priority article.

> Net effect: keywords are no longer guessed. Most are pulled directly from real
> Google searches and real AI answers.

---

## How a queued topic becomes a post

The publisher (`publish-blog.js` / `publish-location.js`) picks up the next
scheduled row, hands the keyword + a content brief to GPT-4o, and gets back a full
article — headline, body, meta description, and a structured FAQ. It then:

- checks word count and expands if thin,
- runs a "humaniser" pass,
- attaches a hero image,
- links to relevant location and sibling pages,
- writes it to `src/data/blogPosts.json` and marks the sheet row published,
- deploy → prerender → live.

---

## How this improves the odds of being cited by AI (GEO)

Being cited by an AI answer engine is different from ranking on Google. The system
targets it deliberately:

- **It measures it directly.** The weekly AI visibility check tells us which
  questions Boxx is absent from. Most sites are blind to this.
- **It writes for how AI extracts answers.** Gap-driven articles answer the
  question *in the first paragraph*, name "Boxx Commercial Finance" several times
  with clear broker credentials, include a comparison / "how to choose a lender"
  section, and carry 6+ FAQ Q&As (models lean heavily on structured FAQ content).
- **It makes content machine-readable.** Every post ships with **FAQPage schema**
  and is **prerendered**, so an AI crawler sees full structured HTML, not an empty
  React shell. That is what makes a page quotable.

---

## The self-correcting loop (weekly, Mondays)

| Signal from Google / AI | Automatic action |
|---|---|
| Query with impressions but no page | Schedule a new blog post (Action 2) |
| Rising / trending query, no page | Schedule a new blog post (trending gaps) |
| Page ranks 11–30 (page 2) | Flag for a content refresh (Action 3) |
| Page 1 but low click-through | Rewrite the title + meta description (Action 1) |
| AI names competitors, not Boxx | Schedule an authority article (Action 0) |
| 90-day performance | Verdict + history written to `GSC_Report` / `GSC_History` |

---

## Why the "bridging loans" terminology rule matters

The engine concentrates *repeated signal* on the phrases in our content. If half the
pages said "bridging finance" and half said "bridging loans", that signal splits
across two terms and ranks well for neither — in Google *and* in AI answers. Picking
one term ("bridging loans") and driving everything toward it is what makes the
compounding loop actually compound. This is why all bridging content — and the
generator prompts — must use "bridging loans" only.

---

## Where things live

| Thing | Location |
|---|---|
| Topic queue | Google Sheet, `ContentEngine` tab |
| SEO opportunities | Google Sheet, `Search_Console` tab |
| AI visibility results | Google Sheet, `AI_Visibility` tab |
| 90-day performance report | Google Sheet, `GSC_Report` + `GSC_History` tabs |
| Published articles (source of truth) | `src/data/blogPosts.json` |
| Weekly SEO/GEO jobs | `.github/workflows/search-console-insights.yml`, `ai-visibility-check.yml` |
| Blog / location writers | `scripts/content-engine/publish-blog.js`, `publish-location.js` |
