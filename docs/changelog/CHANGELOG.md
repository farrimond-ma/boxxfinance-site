# ContentEngine Changelog

Dated entries for every production change and incident. Newest first.

## 2026-07-06 — Reliability day (three incidents found and fixed)

**Incident: engine silent for 8 days (Jun 29 – Jul 6).**
Root cause: `blogPosts.json` crossed GitHub's 1MB contents-API limit on Jun 28
(PM post); every publisher read returned empty content and crashed. `locationPages.json`
crossed the same limit days later. Fix: blob-API fallback in all 15 engine scripts
(`2be89e6`). Lesson → architecture rule: no monolithic data files (sharding: Phase 2).

**Incident: JSON-LD schema + OpenGraph tags never rendered, since launch.**
react-helmet-async v2 renders nothing under React 19 (title only survived).
Every page shipped without Article/FAQ schema despite the engine generating it.
Fix: React 19 native head hoisting, helmet removed (`d39e1ef`). Guards: prerender
now fails the build if any article lacks schema/OG. Lesson → assert outcomes, not activity.

**Incident: ~89% of LinkedIn runs cancelled since Jun 18.**
`timeout-minutes: 10` vs random delay up to 90 min. Fix: timeout 105 min (`557f1b8`).
Lesson → failures must announce themselves; Failure Watchdog added (`d39e1ef`).

**Also shipped:**
- Bundle split: article content fetched per-page; JS bundle 2.6MB → 628KB (`bf78880`)
- Failure Watchdog workflow: failed/cancelled runs file GitHub issues
- v1 agent architecture adopted: docs/architecture/

## 2026-06-18 — LinkedIn anti-pattern work
Six rotating post formats; random ±90min delay; news-curation publisher with
~40% day-skip. (Cadence throttled by the timeout bug above until 2026-07-06.)
