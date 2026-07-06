# /agents — one folder per specialist agent

Each folder holds the agent's contract pointer, prompts, and config it owns.
Full 9-field contracts live in [docs/architecture/AGENTS.md](../docs/architecture/AGENTS.md) —
that document is binding; these folders are the working homes.

| Folder | Spec | Current implementation (v0) |
|---|---|---|
| seo-manager | AGENTS.md #1 | NEW (Phase 3) |
| keyword-intelligence | AGENTS.md #2 | partial: search-console-actions.js |
| search-console | AGENTS.md #11 | search-console-insights.yml |
| technical-seo | AGENTS.md #10 | generate-sitemap.js, seo-audit.js, .htaccess |
| sitemap | part of technical-seo (#10) | regenerate-sitemap.yml |
| schema | AGENTS.md #9 | SEO.jsx + prerender assertions |
| internal-linking | AGENTS.md #8 | update/fix/audit-internal-links.js |
| blog-writer | AGENTS.md #6 | publish-blog.js (generation half) |
| location-pages | AGENTS.md #7 | publish-location.js, regenerate-locations.js |
| linkedin | AGENTS.md #15 | publish-linkedin.js, publish-linkedin-news.js |
| outreach | AGENTS.md #14 | backlink-outreach.js |
| analytics | AGENTS.md #12 | NEW (Phase 3) |
| qa | AGENTS.md #18 | partial: humanizer + audits (unified gate: Phase 2) |

Not yet foldered (specs exist): search-intent (#3), topic-cluster (#4),
blog-planning (#5), competitor-intel (#13), social (#16), image-gen (#17),
deployment (#19), reporting (#20). Folders are created when their Phase begins.
