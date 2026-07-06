# /data — the engine's working data (target layout)

Layout per docs/architecture/ARCHITECTURE.md §6: per-item files + sharded
indexes + queue directories. SOURCE OF TRUTH TODAY is still src/data/*.json
(blogPosts.json, locationPages.json) — Phase 2 of the roadmap migrates those
monoliths here. Until then these directories hold queues and new data only.

- keywords/         keyword store (Keyword Intelligence Agent)
- locations/        per-item location pages (Phase 2 migration)
- blogPosts/        per-item articles (Phase 2 migration)
- contentCalendar/  one file per month (Blog Planning Agent)
- competitors/      one file per competitor domain
- queues/           message-per-file work queues (ARCHITECTURE.md §5.1)
