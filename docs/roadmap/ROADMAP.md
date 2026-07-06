# ContentEngine Roadmap — v0 scripts → v1 agent architecture

The platform already works (80 articles, 140 location pages, full social
distribution, AI-visibility loop). Migration is therefore **strangler-fig**:
the v0 scripts keep running; each phase moves one seam into the agent
architecture without stopping publication. Nothing is rewritten for its own sake.

## Phase 1 — Reliability floor (DONE — 2026-07-06)
- [x] Blob-API reads: engine survives data files >1MB
- [x] Bundle split: content out of the JS bundle (2.6MB → 628KB)
- [x] Schema/OG rendering fixed sitewide (react-helmet-async → React 19 native)
- [x] Build-time outcome assertions (schema, OG, content present or build fails)
- [x] Failure Watchdog (failed/cancelled run → GitHub issue → email)
- [x] LinkedIn cadence unblocked (timeout vs random-delay bug)

## Phase 2 — Structure without disruption (next)
- [ ] Create queue directories + message schema; first queue: `data/queues/qa/`
- [ ] Unified QA gate (agent #18) in front of both publishers — the single
      highest-leverage new component
- [ ] Shard the monoliths: per-item files under `data/blogPosts/`,
      `data/locations/`; indexes derived; engine scripts read/write per-item
      (removes the 1MB class of failure permanently)
- [ ] `repository_dispatch` events replace `workflow_run` chaining
- [ ] `brands/boxx/config.json` — extract every hardcoded brand literal
- [ ] Daily T3 ops agent (task #24 — awaiting operator go-ahead, billed per run)
- [ ] LinkedIn token expiry warnings in health check (task #7 interim measure)

## Phase 3 — Close the measurement loop
- [ ] Google Analytics Agent (#12) — NEW build; needs GA4 API credentials
- [ ] Competitor Intelligence Agent (#13) — NEW build on DataForSEO
- [ ] SEO Strategy Manager (#1) as weekly T3 session consuming insights
- [ ] Search Intent (#3) + Topic Cluster (#4) agents feeding Blog Planning
- [ ] Reporting Agent weekly digest (extends existing status generator)

## Phase 4 — Scale and second brand
- [ ] Incremental builds (prerender only changed pages — full rebuild dies at 50k)
- [ ] Hosted queue backend when message volume or brand #2 demands it
- [ ] Engine/brand repo split; template instantiation for new brands
- [ ] Location Agent uniqueness scoring at scale; zero-traffic pruning

## Standing risks
| Risk | Owner | Mitigation status |
|---|---|---|
| LinkedIn tokens expire (~60d) | LinkedIn Agent | Warning: Phase 2. Auto-refresh: task #7 |
| Full prerender build time grows with page count | Deployment Agent | Incremental builds: Phase 4 |
| Reddit/Pinterest platform approvals | Operator | External; blocked on platforms |
| Single FTP host, no staging | Deployment Agent | Staging: Phase 4 |
