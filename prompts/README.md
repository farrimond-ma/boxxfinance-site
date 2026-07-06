# /prompts — versioned LLM prompts, one file per generation task

Target home for every prompt the engine sends to Claude. Currently most prompts
live inline in scripts/content-engine/*.js — they are extracted here as each
agent is migrated (see docs/roadmap/ROADMAP.md Phase 2+). A prompt change is a
reviewable diff, not a code change.

Planned files: keyword-agent.md, blog-agent.md, linkedin-agent.md,
sitemap-agent.md, schema-agent.md, location-agent.md, intent-agent.md,
cluster-agent.md, outreach-agent.md.
