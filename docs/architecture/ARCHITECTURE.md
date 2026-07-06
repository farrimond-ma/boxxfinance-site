# Boxx ContentEngine — System Architecture

**Version 1.0 — 2026-07-06**
**Status: Adopted. Migration from the v0 script collection is phased — see [ROADMAP](../roadmap/ROADMAP.md).**

---

## 1. What this system is

An autonomous content-marketing platform. It plans, writes, publishes, distributes,
measures and repairs SEO content with no human in the daily loop. It currently runs
one brand (Boxx Commercial Finance, boxxfinance.co.uk) and is designed to scale to
50,000+ pages and multiple brands.

The platform is a **team of specialist agents**. Each agent has exactly one
responsibility, owns its own files, and communicates through queues and events —
never by reaching into another agent's internals. Agent specifications live in
[AGENTS.md](AGENTS.md).

## 2. Execution model — what an "agent" physically is

An agent is a **role with a contract**, not necessarily a resident LLM process.
Each agent is implemented as whichever of these is cheapest to run and easiest to
verify, without changing its contract:

| Tier | Implementation | Used for |
|------|---------------|----------|
| T1 — Deterministic | Node script in GitHub Actions | Sitemaps, linking, deploys, QA assertions, data pulls |
| T2 — LLM-in-the-loop | Node script that calls the Claude API for generation steps | Writing, social posts, outreach drafts |
| T3 — Autonomous | Scheduled Claude agent session (cloud routine) | Strategy review, incident diagnosis, reporting judgment |

A single agent may move between tiers over time (e.g. QA starts as T1 assertions,
later gains a T2 editorial-review pass). The contract in AGENTS.md is what stays fixed.

## 3. Design rules (each one paid for by a production incident)

1. **No monolithic data files.** On 2026-06-28 `blogPosts.json` crossed GitHub's
   1MB API limit and silently halted every publisher for 8 days. All content is
   stored as **one file per item** with **sharded indexes** (§6). No index shard
   may exceed 512KB.
2. **Assert outcomes, not activity.** For weeks every page shipped with zero
   JSON-LD schema while all workflows were green — the system checked that jobs
   ran, not that output was right. Every agent defines success criteria that are
   **verified against its actual output** (built HTML, live URLs, API responses),
   and the Deployment and QA agents fail loudly when they aren't met.
3. **Failures must announce themselves.** A 10-minute timeout silently cancelled
   ~89% of LinkedIn runs. The Failure Watchdog converts any failed/cancelled
   workflow into a GitHub issue (which emails the operator). New agents are added
   to the watchdog's watch list as part of their definition of done.
4. **Loose coupling only.** Agents communicate via queues (§5) and events. An
   agent never imports another agent's code or writes another agent's files.
   New agents subscribe to existing events; producers are never modified to add
   a consumer.
5. **Brand is a parameter.** No agent hardcodes a domain, tone, or service list;
   everything comes from `brands/<brand>/config.json` (§7).

## 4. Topology

```
                            ┌──────────────────────┐
                            │  SEO Strategy Manager │  (weekly, T3)
                            │  sets priorities      │
                            └──────────┬───────────┘
              directives (data/queues/directives)
        ┌──────────────┬───────────────┼────────────────┬─────────────┐
        ▼              ▼               ▼                ▼             ▼
 Keyword Intel → Search Intent → Topic Cluster → Blog Planning   Location Page
   (T1+T2)         (T2)            (T2)          (T1+T2)           Agent
        │                                             │               │
   data/keywords                              briefs (data/queues/briefs)
                                                      ▼               ▼
                                            Blog Writing Agent   (writes draft)
                                                      │               │
                                              drafts (data/queues/qa)
                                                      ▼
                                                  QA Agent  ── reject → back to producer queue
                                                      │ approve
                                                      ▼
                                        content committed (per-item files)
                                                      │  push event
                       ┌──────────────┬───────────────┼────────────────┐
                       ▼              ▼               ▼                ▼
                Internal Linking   Schema Agent   Image Gen      Deployment Agent
                       │              │               │           build+assert+FTP
                       └──────────────┴───────┬───────┘                │
                                              ▼                        ▼
                                    publish events            live-site verification
                       ┌──────────────┬───────┴────────┐
                       ▼              ▼                ▼
                LinkedIn Agent   Social Agent    Backlink Outreach
                                                        
 Measurement loop:  GSC Agent + GA Agent + Competitor Intel → data/insights
                    → consumed by SEO Strategy Manager (closes the loop)
 Oversight:         Technical SEO (build guards) · Reporting (weekly digest)
                    · Failure Watchdog (always on)
```

## 5. Communication — queues and events

### 5.1 Queues (work handoff)

Work moves between agents through **queue directories** in the repo:
`data/queues/<queue-name>/`, one JSON file per message:

```
data/queues/briefs/2026-07-06-bridging-loan-exit-strategies.json
```

```json
{
  "id": "2026-07-06-bridging-loan-exit-strategies",
  "queue": "briefs",
  "brand": "boxx",
  "producer": "blog-planning",
  "created": "2026-07-06T09:00:00Z",
  "status": "pending",          // pending → claimed → done | failed
  "attempts": 0,
  "payload": { }
}
```

Rules:
- One message = one file (no shared-file write races; honors design rule 1).
- Consumers claim by updating `status` in a single commit; Git conflicts on
  concurrent claims resolve by retry-and-refetch (at most one winner).
- `done` messages are moved to `data/queues/<name>/archive/<yyyy-mm>/` by the
  consumer; `failed` messages stay in place and are surfaced by the Watchdog.
- Queue files are versioned in Git → every handoff is auditable and replayable.
- **Scale valve:** when any queue exceeds ~200 messages/day or a second brand
  goes live, swap the backing store for a hosted queue (the message schema is
  the contract; the storage is an implementation detail).

### 5.2 Events (triggers)

- **`repository_dispatch`** is the event bus. Producers emit typed events
  (`content-published`, `insights-updated`, `qa-approved`, …); any agent
  subscribes by adding its own workflow that listens for the type.
  **This is how new agents are added without touching existing ones.**
- `workflow_run` chaining (current v0 mechanism) is being phased out in favor of
  dispatch events, because it couples the consumer to the producer's *name*.
- Schedules (cron) are reserved for time-driven agents (planning, measurement,
  reporting) — never for "poll until work appears"; that's what queues are for.

### 5.3 Adding a new agent (extension protocol)

1. Write its spec in AGENTS.md (the 9-field contract).
2. Create `agents/<name>/` with its README and prompt files.
3. Subscribe to existing events / consume an existing queue.
4. Add its workflow to the Failure Watchdog watch list.
5. Add its output assertions to QA / Deployment verification.
No existing agent changes. If it needs an input nobody produces yet, it defines a
new queue and the producing agent adds one emit — the only permitted producer change.

## 6. Data architecture (50,000-page scale)

```
data/
  keywords/            one file per keyword-cluster shard (≤500 records)
  locations/           one file per location page          ← per-item
  blogPosts/           one file per article                ← per-item
  contentCalendar/     one file per month
  competitors/         one file per competitor domain
  insights/            GSC/GA/visibility pulls, one file per pull
  queues/              §5.1
  indexes/
    blog-index-000.json      metadata-only shards, ≤512KB each
    location-index-000.json
    manifest.json            shard list + counts + checksums
```

- **Per-item files** are the source of truth. Indexes are derived, rebuilt by the
  owning agent, and validated against `manifest.json` counts.
- The website build consumes **index shards + per-item files** (already live:
  `scripts/split-content.js` splits content out of the JS bundle; at 50k pages the
  split inverts — per-item files become the source and the monolith disappears).
- **Migration note:** v0's `src/data/blogPosts.json` / `locationPages.json`
  monoliths are Phase-2 migration targets (see ROADMAP). Until then, all engine
  reads go through the blob-API fallback added 2026-07-06.

## 7. Multi-brand support

```
brands/
  boxx/
    config.json        domain, language, services, tone, authors, socials,
                       posting cadence, secrets prefix (BOXX_*)
    style/             brand voice samples, banned phrases, image style
```

- Every queue message and every event payload carries `brand`.
- Agents read `brands/<brand>/config.json` at startup; no brand literals in code.
- Secrets are namespaced per brand (`BOXX_LINKEDIN_TOKEN`, `ACME_LINKEDIN_TOKEN`).
- A new brand = new config folder + secrets + its own data subtree. Zero code changes.
- Repos: single repo until the second brand is signed; then this repo becomes the
  engine template and each brand gets a data/site repo instantiated from it.

## 8. Reliability and monitoring stack

| Layer | Mechanism | Catches |
|-------|-----------|---------|
| Build guards | Prerender assertions (schema, OG, content present) — build fails | Silent output regressions |
| Watchdog | Failed/cancelled workflow → GitHub issue → email | Dead publishers, timeouts |
| Health check | Nightly cross-system check (queues stuck, tokens near expiry, data drift) | Slow-burn failures |
| Ops agent (T3) | Daily review of status + issues; fixes trivial breaks, reports | Anything the layers above miss |
| Reporting agent | Weekly digest: traffic, output, visibility, incidents | Strategy drift |

## 9. Repository layout

```
agents/          one folder per agent: README (contract) + implementation notes
prompts/         versioned LLM prompts, one file per generation task
data/            §6 — queues, per-item content, insights, indexes
workflows/       thin docs mapping agent → .github/workflows/*.yml
docs/
  architecture/  this file + AGENTS.md
  roadmap/       phased migration plan
  changelog/     dated entries for every production change
brands/          §7
scripts/         v0 implementation (being absorbed into agents/ per ROADMAP)
src/, public/    the website (Deployment agent's domain)
```
