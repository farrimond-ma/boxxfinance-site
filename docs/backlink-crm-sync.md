# Backlink Prospects → CRM Sync — receiving endpoint spec

Source of truth for `scripts/content-engine/sync-backlinks-to-crm.js` in the
`boxxfinance-site` repo, which runs daily (and on manual trigger) and POSTs
every current backlink prospect row to a CRM endpoint. This doc is what to
hand the CRM project when building the receiving side.

## What the sync sends

`POST` to `CRM_BACKLINKS_URL`, `Content-Type: application/x-www-form-urlencoded`,
one request per prospect, every run (see "Idempotency" below for why it's
safe to send the same rows repeatedly):

| Field | Example | Notes |
|---|---|---|
| `intake_key` | — | Same auth pattern as `intake.php` — validate against config. |
| `article_url` | `https://www.mortgagesolutions.co.uk/...` | **Unique key.** Use this to dedupe. |
| `date_found` | `2026-06-05` | |
| `publication` | `Mortgage Solutions` | |
| `domain_authority` | `52` | Numeric string. |
| `article_title` | `Cambridge & Counties Bank promotes Parr...` | |
| `keywords_matched` | `bridging` | |
| `suggested_author` | `Mark Higgins` | Which Boxx author should send the outreach. |
| `expert_comment_draft` | (long text) | Drafted comment for the article/journalist. |
| `outreach_email_draft` | (long text) | Drafted outreach email. |
| `editor_contact` | — | May be blank. |

## Idempotency — the important part

The sync is **insert-only and one-way**. It sends the full current set of
prospects on every run (daily + whenever run manually), not just new ones —
simpler and safer than trying to track "already sent" state on the sheet
side. The endpoint must:

1. **Insert** a new row only if `article_url` doesn't already exist in the
   `backlink_prospects` table.
2. **Never update** a row that already exists — once a prospect lands in the
   CRM, all the CRM-owned fields below become freely editable there and must
   survive every future sync untouched.
3. Respond so the sync script can tell the difference (see "Response shape").

## CRM-owned fields (never sent by the sync, set once on insert)

These belong entirely to the CRM after the initial insert:

- `status` — suggested default `'new'`, then editable to something like
  `sent` / `replied` / `declined` / `published` as outreach progresses.
- `date_sent`
- `notes`

If it's useful to let someone tweak the draft text in the CRM before sending
(rather than only ever seeing the sheet's original draft), consider storing
`expert_comment_draft` / `outreach_email_draft` as CRM-editable fields too,
initialised from the synced value on insert but never overwritten by a later
sync — same rule as `status`/`notes`.

## Response shape the sync script expects

```json
{ "inserted": true }
```
or, when the `article_url` already existed and nothing was touched:
```json
{ "skipped": true }
```
Any other shape (or a non-2xx status) is treated as a failure for that row
and logged, but doesn't stop the rest of the batch.

## Suggested table

```sql
CREATE TABLE backlink_prospects (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  article_url            VARCHAR(512) NOT NULL UNIQUE,
  date_found             DATE NULL,
  publication            VARCHAR(255),
  domain_authority       INT NULL,
  article_title          TEXT,
  keywords_matched       VARCHAR(255),
  suggested_author       VARCHAR(100),
  expert_comment_draft   TEXT,
  outreach_email_draft   TEXT,
  editor_contact         VARCHAR(255),
  status                 VARCHAR(30) NOT NULL DEFAULT 'new',
  date_sent              DATE NULL,
  notes                  TEXT,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## One-off backfill

The current 82 prospects were already exported and fixed (old "Boxx
Commercial Finance" brand references corrected) as a CSV, sent to Mark
directly — that CSV can seed the table before the daily sync starts running,
or the sync's first run will insert all 82 itself since it sends everything
each time.

## Secrets needed on the boxxfinance-site repo, once this endpoint exists

- `CRM_BACKLINKS_URL` — the endpoint URL (e.g. `https://crm.boxxfinance.co.uk/backlinks_sync.php`)
- `CRM_BACKLINKS_KEY` — the `intake_key` value to validate against (can reuse
  the existing intake key already used by `intake.php` / `ProgressApplication.jsx`
  if that's simplest, or a new one — either way, Mark needs to add it as a
  GitHub Actions secret on `boxxfinance-site` before
  `.github/workflows/sync-backlinks-to-crm.yml` will run for real.)
