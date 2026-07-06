# Boxx ContentEngine — Agent Specifications

**Version 1.0 — 2026-07-06.** Companion to [ARCHITECTURE.md](ARCHITECTURE.md).

Every agent has exactly one responsibility. Contracts below are binding: an agent
may be reimplemented freely (script → LLM → autonomous session) but its inputs,
outputs and ownership boundaries only change by editing this document.

**Conventions used below**
- *Tier*: T1 deterministic script · T2 LLM-in-the-loop script · T3 autonomous agent session (see ARCHITECTURE §2).
- *Owns*: only this agent may write these paths. *Reads*: read-only. Everything not listed: no access.
- All agents read `brands/<brand>/config.json` and may write only inside their own `data/` subtree and queues they produce.
- All agents: failure/cancellation is reported by the Failure Watchdog (they do not self-report).
- "v0" = the current implementation being absorbed (see ROADMAP).

---

## 1. SEO Strategy Manager

| Field | Contract |
|---|---|
| **Purpose** | The only agent with cross-system judgment: converts measurement into direction. |
| **Responsibilities** | Weekly review of insights (GSC, GA, AI visibility, competitors); set topic priorities, service focus and cadence; approve/adjust the 90-day plan; arbitrate conflicts between agents (e.g. cannibalising keywords). |
| **Inputs** | `data/insights/**`, `data/competitors/**`, open watchdog issues, brand config. |
| **Outputs** | Directive messages → `data/queues/directives/` (topic priorities, kill/boost instructions, cadence changes). |
| **Trigger** | Weekly cron (Mon), plus `insights-updated` event. |
| **Files owned** | `data/queues/directives/`, `docs/strategy/`. |
| **Dependencies** | GSC, GA, Competitor Intel, AI-visibility outputs (consumes); all planning agents (consume its directives). |
| **KPIs** | Organic clicks trend (28-day); % of published content matching current directives; time from insight → directive. |
| **Future** | Tier T3 from day one; later: budget allocation across brands, automatic A/B of content strategies. |

## 2. Keyword Intelligence Agent

| Field | Contract |
|---|---|
| **Purpose** | Own the raw keyword universe: volumes, difficulty, CPC, trends. |
| **Responsibilities** | Pull keyword data (DataForSEO) for seed terms and competitor gaps; dedupe and normalise; maintain the keyword store; flag rising/dying terms. |
| **Inputs** | Directives queue (seed topics), `data/competitors/**` (gap terms), brand config services. |
| **Outputs** | `data/keywords/` shards; `keyword-opportunities` messages → `data/queues/keywords/`. |
| **Trigger** | Weekly cron; `directive` event with type `research`. |
| **Files owned** | `data/keywords/`, `data/queues/keywords/`. |
| **Dependencies** | DataForSEO API (v0: `search-console-actions.js` holds partial integration). |
| **KPIs** | Coverage (keywords tracked per service); freshness (age of newest pull); opportunity precision (% of flagged terms that become ranking pages). |
| **Future** | Seasonal forecasting; auto-budgeting API spend by expected value. |

## 3. Search Intent Agent

| Field | Contract |
|---|---|
| **Purpose** | Classify every keyword's intent so content matches what the searcher wants. |
| **Responsibilities** | Label queue items informational / commercial / transactional / navigational / AI-answer-prone; attach recommended content type (guide, comparison, location page, FAQ) and answer-first structure hints. |
| **Inputs** | `data/queues/keywords/` (consumes). |
| **Outputs** | Enriched keyword messages → `data/queues/intents/`. |
| **Trigger** | `keywords` queue non-empty (dispatch event from producer). |
| **Files owned** | `data/queues/intents/`, `prompts/intent-agent.md`. |
| **Dependencies** | Claude API (T2). |
| **KPIs** | Classification agreement rate on sampled audits; downstream CTR of pages built from its labels. |
| **Future** | SERP-feature detection (AI Overview present? shopping pack?) to sharpen format choice. |

## 4. Topic Cluster Agent

| Field | Contract |
|---|---|
| **Purpose** | Organise keywords into pillar-and-cluster structures so authority concentrates instead of scattering. |
| **Responsibilities** | Group intent-labelled keywords into clusters; map each cluster to a pillar page and supporting articles; detect cannibalisation; maintain the cluster map. |
| **Inputs** | `data/queues/intents/` (consumes); existing content indexes (reads). |
| **Outputs** | `data/keywords/clusters/` map; cluster briefs → `data/queues/clusters/`. |
| **Trigger** | `intents` queue non-empty. |
| **Files owned** | `data/keywords/clusters/`, `data/queues/clusters/`, `prompts/cluster-agent.md`. |
| **Dependencies** | Claude API (T2); Internal Linking Agent consumes its cluster map (reads). |
| **KPIs** | % of pages belonging to a cluster; cannibalisation incidents caught; avg cluster ranking lift. |
| **Future** | Graph-based authority modelling; automatic pillar-page refresh scheduling. |

## 5. Blog Planning Agent

| Field | Contract |
|---|---|
| **Purpose** | Own the 90-day content calendar; convert clusters + directives into concrete briefs. |
| **Responsibilities** | Maintain the rolling calendar; sequence briefs (title, target keyword, intent, cluster, outline, internal-link targets, schema type, word range); rebalance when directives change; feed the writing queue at the configured cadence. |
| **Inputs** | `data/queues/clusters/`, `data/queues/directives/` (consumes); AI-visibility gap list (reads). |
| **Outputs** | `data/contentCalendar/<yyyy-mm>.json`; briefs → `data/queues/briefs/`. |
| **Trigger** | Daily cron (keeps writing queue primed to cadence); `directive` events. |
| **Files owned** | `data/contentCalendar/`, `data/queues/briefs/`. |
| **Dependencies** | v0: Google Sheets content engine + `populate-content-engine.js` (absorbed in Phase 2). |
| **KPIs** | Queue never empty at publish time; calendar horizon ≥ 60 days; % briefs from visibility gaps. |
| **Future** | Value-weighted sequencing (expected traffic × conversion intent); event/news-reactive slots. |

## 6. Blog Writing Agent

| Field | Contract |
|---|---|
| **Purpose** | Turn a brief into a publish-ready article. Nothing else. |
| **Responsibilities** | Write answer-first, AEO-structured articles per brief (headline, meta, FAQ block, internal-link anchors as specified); run the humanizer pass; attach required schema data (content only — Schema Agent owns markup). |
| **Inputs** | `data/queues/briefs/` (consumes); brand style files (reads). |
| **Outputs** | Draft article (per-item file) + draft message → `data/queues/qa/`. |
| **Trigger** | `briefs` queue non-empty. |
| **Files owned** | `data/blogPosts/` (drafts only — QA promotes to published), `prompts/blog-agent.md`. |
| **Dependencies** | Claude API (T2). v0: generation half of `publish-blog.js`. |
| **KPIs** | QA first-pass approval rate; word-count compliance; avg time brief → draft. |
| **Future** | Style memory per brand; source citation with live fact-checking. |

## 7. Location Page Agent

| Field | Contract |
|---|---|
| **Purpose** | Programmatic local-SEO pages ("<service> in <town>") at scale without thin-content penalties. |
| **Responsibilities** | Maintain the location target list; generate location pages with genuinely local substance (local market data, regional lenders, distinct FAQs); regenerate thin pages; keep uniqueness above threshold across 50k pages. |
| **Inputs** | Location targets (`data/locations/targets/`), directives, brand config service list. |
| **Outputs** | Per-item files in `data/locations/` + draft messages → `data/queues/qa/`. |
| **Trigger** | Daily cron at configured cadence; `directive` events (new service/region). |
| **Files owned** | `data/locations/`, `prompts/location-agent.md`. v0: `publish-location.js`, `regenerate-locations.js`, `expand-uk-places.js`. |
| **Dependencies** | Claude API (T2); QA Agent gate. |
| **KPIs** | Cross-page similarity score below threshold; indexed rate of location pages; local-pack impressions. |
| **Future** | Per-town data enrichment (property prices, business counts); auto-pruning of zero-traffic pages. |

## 8. Internal Linking Agent

| Field | Contract |
|---|---|
| **Purpose** | Own the site's link graph: every page well-linked, descriptive anchors, no orphans, no broken links. |
| **Responsibilities** | On publish, inject links from and to the new page per cluster map; maintain anchor-text quality rules; run periodic full-graph audits; fix broken links. |
| **Inputs** | `content-published` events; cluster map (reads); content per-item files (reads). |
| **Outputs** | Link-edit commits to content files (the one sanctioned cross-file writer — edits are scoped to link markup only); audit reports → `data/insights/links/`. |
| **Trigger** | `content-published` event; weekly full-audit cron. |
| **Files owned** | Link markup within content files (scoped); `data/insights/links/`. v0: `update-internal-links.js`, `fix-internal-links.js`, `audit-internal-links.js`. |
| **Dependencies** | Topic Cluster Agent's map. |
| **KPIs** | Orphan pages = 0; broken internal links = 0; avg inbound links per page ≥ 3. |
| **Future** | PageRank-style internal authority flow optimisation. |

## 9. Schema Agent

| Field | Contract |
|---|---|
| **Purpose** | Every page carries correct, valid structured data. The only agent that writes JSON-LD. |
| **Responsibilities** | Generate Article/FAQPage/LocalBusiness/BreadcrumbList markup per content type; validate against schema.org; verify presence in **built HTML** (post-incident rule — schema was silently missing sitewide until 2026-07-06); maintain schema templates. |
| **Inputs** | Draft messages in QA queue (enrichment step); built `dist/` HTML (validation). |
| **Outputs** | `schema`/`faqSchema` fields on content items; validation report (build-blocking). |
| **Trigger** | QA pipeline step; every build (validation). |
| **Files owned** | `prompts/schema-agent.md`, schema templates, prerender schema assertions in `scripts/prerender.js`. |
| **Dependencies** | Runs inside QA and Deployment gates. |
| **KPIs** | Pages with valid schema = 100%; rich-result eligibility in GSC; zero schema regressions shipped. |
| **Future** | Auto-adopt new schema types Google starts rewarding (e.g. `FinancialProduct`). |

## 10. Technical SEO Agent

| Field | Contract |
|---|---|
| **Purpose** | Everything crawlers experience except content: sitemaps, canonicals, robots, redirects, speed. |
| **Responsibilities** | Regenerate sitemap on publish; maintain canonical/redirect rules and `.htaccess`; enforce performance budget (bundle size, image weights); run technical audits (crawlability, CWV, mobile). |
| **Inputs** | `content-published` events; build outputs; CWV data. |
| **Outputs** | `sitemap.xml`, robots/canonical/redirect config; audit reports → `data/insights/technical/`. |
| **Trigger** | `content-published`; weekly audit cron. |
| **Files owned** | `scripts/generate-sitemap.js`, `public/.htaccess`, RSS generators, performance budget config. v0: `regenerate-sitemap.yml`, `seo-audit.js`. |
| **Dependencies** | Deployment Agent (its checks run in the build). |
| **KPIs** | Index coverage errors = 0; sitemap freshness < 24h; JS bundle ≤ 700KB; CWV all green. |
| **Future** | Edge-rendering evaluation at 50k pages; automatic image CDN migration. |

## 11. Google Search Console Agent

| Field | Contract |
|---|---|
| **Purpose** | The system's eyes on Google: queries, impressions, positions, index status. |
| **Responsibilities** | Weekly pulls per property; diff against previous pulls; flag winners (push further) and decayers (refresh); detect indexing problems early. |
| **Inputs** | GSC API (service account), sitemap state. |
| **Outputs** | `data/insights/searchConsole/<date>.json`; `insights-updated` event; refresh candidates → `data/queues/refresh/`. |
| **Trigger** | Weekly cron. v0: `search-console-insights.yml` + `search-console-actions.js`. |
| **Files owned** | `data/insights/searchConsole/`, `data/queues/refresh/`. |
| **Dependencies** | GSC API credentials. |
| **KPIs** | Pull reliability = 100%; insight → action latency; refresh-candidate hit rate. |
| **Future** | URL Inspection API sampling for index diagnostics at scale. |

## 12. Google Analytics Agent

| Field | Contract |
|---|---|
| **Purpose** | What happens *after* the click: sessions, engagement, conversions (enquiries). |
| **Responsibilities** | Pull GA4 data weekly; attribute enquiries to landing pages/channels; compute per-cluster conversion rates; feed the money-metric back to strategy. |
| **Inputs** | GA4 Data API. |
| **Outputs** | `data/insights/analytics/<date>.json`; `insights-updated` event. |
| **Trigger** | Weekly cron. **Status: NEW — no v0 equivalent; Phase 3 build.** |
| **Files owned** | `data/insights/analytics/`. |
| **Dependencies** | GA4 property + API credentials (operator must provision). |
| **KPIs** | Enquiry attribution coverage; report reliability. |
| **Future** | Call-tracking integration; revenue-per-cluster once deal data exists. |

## 13. Competitor Intelligence Agent

| Field | Contract |
|---|---|
| **Purpose** | Know what competing brokers rank for, publish, and earn links from. |
| **Responsibilities** | Track configured competitor domains (SERP overlap, new content, backlink sources); maintain competitor profiles; emit gap opportunities (they rank, we don't). |
| **Inputs** | DataForSEO SERP/backlink endpoints; brand config competitor list. |
| **Outputs** | `data/competitors/<domain>.json`; gap messages → `data/queues/keywords/` (feeds Keyword Intel). |
| **Trigger** | Weekly cron. **Status: NEW — partial v0 in visibility checker; Phase 3 build.** |
| **Files owned** | `data/competitors/`. |
| **Dependencies** | DataForSEO API. |
| **KPIs** | Gap-to-published conversion; competitor coverage freshness. |
| **Future** | Alert on competitor content-velocity spikes; pricing-page change detection. |

## 14. Backlink Outreach Agent

| Field | Contract |
|---|---|
| **Purpose** | Earn authority: find link opportunities and draft the outreach. |
| **Responsibilities** | Monitor industry publications and journalist requests; match opportunities to existing content; draft personalised pitches (operator approves sends); track responses and won links. |
| **Inputs** | Publication feeds, competitor backlink data (reads), content indexes (reads). |
| **Outputs** | Draft pitches → `data/queues/outreach/` (human-approval queue); outreach log. |
| **Trigger** | Weekdaily cron. v0: `backlink-outreach.js` + `backlink-outreach.yml`. |
| **Files owned** | `data/queues/outreach/`, outreach log, `prompts/outreach-agent.md`. |
| **Dependencies** | Claude API (T2); operator approval for anything that sends. |
| **KPIs** | Response rate; links won/month; referring-domain growth. |
| **Future** | Digital-PR data assets (SME Funding Index already exists as linkable asset — exploit it). |

## 15. LinkedIn Content Agent

| Field | Contract |
|---|---|
| **Purpose** | The brand's professional voice: article shares and curated industry news on LinkedIn. |
| **Responsibilities** | Share new articles using rotating formats (6 formats, random timing ±90min — anti-pattern rules are its property); curate/comment on industry news 3-4x/week; manage per-author voices (Mark/Andrew/company page); monitor token health and warn ≥14 days before expiry. |
| **Inputs** | `content-published` events; news feeds; brand config voices. |
| **Outputs** | LinkedIn posts (API); post log; token-expiry warnings → watchdog issue. |
| **Trigger** | `content-published`; daily news cron with configured skip-rate. v0: `publish-linkedin.js`, `publish-linkedin-news.js`. |
| **Files owned** | `prompts/linkedin-agent.md`, format definitions, `data/linkedinPosts/`. |
| **Dependencies** | LinkedIn API tokens (60-day expiry — the known operational risk, task #7). |
| **KPIs** | Posting cadence hit-rate ≥ 95% (was ~11% before 2026-07-06 timeout fix); engagement rate trend; zero token-expiry outages. |
| **Future** | Token auto-refresh; comment-reply drafting; DM lead triage. |

## 16. Social Content Agent

| Field | Contract |
|---|---|
| **Purpose** | Everything social that isn't LinkedIn: Facebook, Instagram, Pinterest, Reels (Reddit when unblocked). |
| **Responsibilities** | Platform-native posts per new article (right tone/format per platform); video reels; per-platform cadence and timing variation; platform token health. |
| **Inputs** | `content-published` events; brand config platform settings. |
| **Outputs** | Posts via platform APIs; post log per platform. |
| **Trigger** | `content-published` + per-platform crons. v0: `publish-facebook.js`, `publish-instagram.js`, `publish-pinterest.js`, `publish-facebook-reels.js`, `publish-reddit.js`. |
| **Files owned** | Per-platform prompt/config files, `data/socialPosts/`. |
| **Dependencies** | Platform APIs and tokens; Image Generation Agent (reel/pin assets). |
| **KPIs** | Cadence hit-rate per platform; referral sessions from social; zero silent platform outages. |
| **Future** | Best-time-to-post learning per platform; comment monitoring. |

## 17. Image Generation Agent

| Field | Contract |
|---|---|
| **Purpose** | Every piece of content ships with an on-brand visual. |
| **Responsibilities** | Hero images per article (style-consistent); social/pin variants at platform dimensions; WebP conversion and weight budget; maintain the brand's visual style prompt. |
| **Inputs** | Draft messages (QA pipeline step); brand style config. |
| **Outputs** | `public/images/blog/<slug>.webp` + variants; image fields on content items. |
| **Trigger** | QA pipeline step. v0: DALL-E call inside `publish-blog.js`, `convert-images-to-webp.js`. |
| **Files owned** | Image style prompts, `public/images/blog/`, image budget config. |
| **Dependencies** | Image model API (DALL-E; Higgsfield/Agent Opus for video — on hold pending API access). |
| **KPIs** | Images ≤ 150KB; style-consistency (sampled); zero posts shipped imageless. |
| **Future** | Avatar video via Agent Opus once API access confirmed; brand-trained image style. |

## 18. QA Agent

| Field | Contract |
|---|---|
| **Purpose** | The gate. Nothing publishes without passing it. |
| **Responsibilities** | Validate every draft: word count vs brief, keyword presence, answer-first structure, FAQ present, internal-link targets resolve, schema fields present and valid (delegates to Schema Agent), image present and within budget, no banned phrases, humanizer score, uniqueness vs existing content. Approve → promote draft to published. Reject → back to producer queue with reasons, max 2 retries then watchdog issue. |
| **Inputs** | `data/queues/qa/` (consumes); content indexes, brand style rules (reads). |
| **Outputs** | Promotion commits; `qa-approved` events; rejection messages; QA metrics log. |
| **Trigger** | `qa` queue non-empty. **Status: partial v0** (humanizer + audits exist; the unified gate is Phase 2). |
| **Files owned** | QA rulebook (`agents/qa/rules.json`), QA metrics log. |
| **Dependencies** | Schema Agent (validation step); every producer (consumes their drafts). |
| **KPIs** | Defects caught pre-publish vs post-publish (target ratio > 10:1); gate latency < 30 min; false-reject rate. |
| **Future** | T2 editorial judgment pass (readability, argument quality); regression sampling of published pages. |

## 19. Deployment Agent

| Field | Contract |
|---|---|
| **Purpose** | Content in Git becomes a verified live site. The only agent that touches production. |
| **Responsibilities** | Build (split → bundle → prerender with assertions → sitemap/RSS); deploy via FTP; **post-deploy live verification** (sampled URLs return 200 with expected content, schema present, bundle within budget); rollback signal on verification failure. |
| **Inputs** | Push events to main; QA-approved content. |
| **Outputs** | Live site; deploy log; `deployed` event; verification report. |
| **Trigger** | Push to main. v0: `deploy.yml`, `scripts/prerender.js`, `scripts/split-content.js`. |
| **Files owned** | `.github/workflows/deploy.yml`, build scripts, `scripts/prerender.js` assertions (shared with Schema/Technical SEO by contract). |
| **Dependencies** | SiteGround FTP credentials. |
| **KPIs** | Deploy success ≥ 99%; post-deploy verification pass = 100%; build time within budget as page count grows. |
| **Future** | Incremental builds at 50k pages (full prerender won't scale — build only changed pages); staging environment for QA sampling. |

## 20. Reporting Agent

| Field | Contract |
|---|---|
| **Purpose** | The operator's one honest window into the whole system. |
| **Responsibilities** | Maintain the live status dashboard (system-status.json); produce the weekly digest: content shipped, traffic and ranking movement, AI-visibility scores, social cadence, incidents and their resolution, upcoming risks (token expiries); flag anomalies plainly ("engine healthy" / "engine broken because X"). |
| **Inputs** | Everything in `data/insights/**`, queue states, watchdog issues, Actions history (all read-only). |
| **Outputs** | `system-status.json` (site dashboard); weekly digest (email/issue); monthly trend report. |
| **Trigger** | Status: on every publisher completion + 3x daily cron (v0: `system-status.yml`, `generate-status.js`). Digest: weekly cron. |
| **Files owned** | `scripts/content-engine/generate-status.js`, digest templates, `docs/changelog/` entries for incidents. |
| **Dependencies** | Read-only on everything; owns nothing another agent needs. |
| **KPIs** | Zero "unknown state" incidents (operator never learns of a failure from anywhere but the system); digest delivered 52/52 weeks. |
| **Future** | Becomes the daily T3 ops agent's briefing document; natural-language Q&A over system state. |

---

## Cross-cutting ownership table (conflict resolution)

| Resource | Owner | Everyone else |
|---|---|---|
| Content item files | Producing agent (drafts) → QA (promotion) | Internal Linking: link markup only. Schema: schema fields only. Image: image fields only. |
| Indexes/manifest | Technical SEO Agent (rebuild job) | read-only |
| `data/queues/<q>/` | Producing agent creates; consuming agent updates status/archives | no third-party writes |
| `.github/workflows/` | Deployment Agent | agents propose changes via PR-style review, never direct edits |
| Brand config | Operator (human) | read-only for all agents |
| Secrets | Operator (human) | agents receive via env only; never read/write stores |
