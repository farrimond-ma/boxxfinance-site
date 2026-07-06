# /workflows — agent-to-workflow map

Executable workflows live in .github/workflows/ (GitHub requires that path).
This maps the five core pipelines to their workflow files and owning agents:

| Pipeline | Workflow file | Owning agent |
|---|---|---|
| publish-blog | publish-blog.yml, publish-blog-pm.yml | Blog Writing (#6) via QA (#18) |
| publish-location | publish-location.yml | Location Page (#7) via QA (#18) |
| update-sitemap | regenerate-sitemap.yml | Technical SEO (#10) |
| publish-linkedin | publish-linkedin.yml, publish-linkedin-news.yml | LinkedIn (#15) |
| backlink-outreach | backlink-outreach.yml | Outreach (#14) |

Cross-cutting: deploy.yml (Deployment #19) · system-status.yml (Reporting #20)
· health-check.yml (Reporting #20) · failure-watchdog.yml (platform).
