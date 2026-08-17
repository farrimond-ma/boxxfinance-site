# Chatbot Leads → CRM Sync — receiving endpoint spec

Source of truth for `submitLeadToCrm()` in `public/api/chat.php` in the
`boxxfinance-site` repo, which fires once per captured lead from the AI chat
widget. This doc is what to hand the CRM project when building the
receiving side.

## Background

The site has an AI chat widget (Claude Haiku, via a PHP proxy) that
qualifies bridging-loan (and other) enquiries in conversation. When a
visitor gives their name and (phone or email) and agrees to be contacted,
the model marks the lead `ready_to_submit` and `chat.php`:

1. Posts a one-line summary to the same Google Sheet every other form on
   the site already writes to (unchanged, existing behaviour).
2. **New**: also POSTs the structured fields *and the full back-and-forth
   transcript* directly to the CRM, so an adviser can read exactly how the
   visitor described their situation rather than only a compressed summary.

Step 2 is what this doc specifies. It's modelled on the same pattern as
`ProgressApplication.jsx` posting to `intake.php`, but as its **own
endpoint** rather than reusing `intake.php` — a chat lead has a different
shape (a long transcript, no application token, mostly-optional structured
fields since it's captured much earlier in the funnel than a full
application) and reusing `intake.php` risked breaking that existing flow.

## What the sync sends

`POST`, `Content-Type: application/x-www-form-urlencoded`, one request per
captured lead (fires once, when `ready_to_submit` first becomes true — not
repeated on every subsequent message in that conversation):

| Field | Example | Notes |
|---|---|---|
| `intake_key` | — | Same auth pattern as `intake.php` — validate against config. |
| `source` | `AI Chatbot` | Always this literal value — lets the CRM distinguish these from `ProgressApplication` / other intake sources. |
| `full_name` | `Jane Doe` | |
| `email` | `jane@example.com` | May be blank if only phone was given. |
| `phone` | `07700 900000` | May be blank if only email was given. |
| `company` | — | Often blank — only populated if the visitor volunteered it. |
| `finance_type` | `bridging`, `commercial mortgage`, `asset finance`, etc. | Whatever the visitor was actually asking about — not always bridging, the bot now handles Boxx's full service range. |
| `purpose` | `Refinance an existing bridging loan and raise capital` | |
| `property_type` | `Residential`, `Commercial`, `Mixed-use` | Often blank. |
| `property_location` | — | Often blank — chat leads are earlier-stage than a full application, most fields here are optional. |
| `property_value` | `560000` | Numeric string, no currency symbol/commas guaranteed. |
| `purchase_price` | — | Only populated on a purchase scenario. |
| `loan_amount` | `250000` | |
| `existing_mortgage` | — | |
| `ltv_estimate` | `43%` | Free text, not guaranteed numeric-only. |
| `exit_strategy` | `Sale of another property` | Often blank/vague — the bot deliberately doesn't push hard for this before converting (see prompt.php's WHEN TO ASK FOR CONTACT DETAILS), so don't treat a blank exit strategy as unusual. |
| `required_completion_date` | — | |
| `term_required` | — | |
| `borrower_type` | `Individual`, `Limited company` | |
| `additional_information` | — | Free text, anything else volunteered. |
| `conversation_summary` | `Wants to refinance an existing bridge and raise capital to buy another property.` | One or two plain sentences, written by the model specifically so an adviser can pick the lead up cold without reading the full transcript. |
| `lead_quality` | `HOT`, `WARM`, `COLD`, or `HUMAN_REQUEST` | The model's own read of how qualified the enquiry is. |
| `chat_transcript` | (long text) | The full conversation, formatted as alternating `Visitor: ...` / `Boxx AI: ...` lines separated by blank lines. Plain text, not HTML/markdown. |
| `page_url` | `https://boxxfinance.co.uk/funding-solutions/bridging-loans` | The page the conversation started on. |

## Idempotency

Unlike the backlink sync (which resends everything every run), this fires
**once per lead**, at the moment `ready_to_submit` first becomes true in
that conversation. There's no dedupe key to worry about on the CRM side —
just insert what arrives. (If the same visitor starts a *new* chat later
and converts again, that's a genuinely separate enquiry and should be a
separate row — no need to detect or merge it with an earlier one.)

## Response shape

Fire-and-forget from `chat.php`'s side — it doesn't currently check the
response body, only that the request was sent (failure here never blocks
the chat reply or the Sheet write, which is the fallback of record). Return
whatever's natural for the CRM's own conventions; a 2xx status is enough for
now. If stricter handling is wanted later (retry on failure, etc.), that's
a `chat.php` change to make once the endpoint exists and its behaviour is
known.

## Suggested table

```sql
CREATE TABLE chatbot_leads (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  full_name                 VARCHAR(255),
  email                     VARCHAR(255),
  phone                     VARCHAR(50),
  company                   VARCHAR(255),
  finance_type              VARCHAR(100),
  purpose                   TEXT,
  property_type             VARCHAR(100),
  property_location         VARCHAR(255),
  property_value            VARCHAR(50),
  purchase_price            VARCHAR(50),
  loan_amount                VARCHAR(50),
  existing_mortgage         VARCHAR(50),
  ltv_estimate               VARCHAR(50),
  exit_strategy             TEXT,
  required_completion_date  VARCHAR(100),
  term_required              VARCHAR(100),
  borrower_type              VARCHAR(100),
  additional_information    TEXT,
  conversation_summary      TEXT,
  lead_quality               VARCHAR(20) NOT NULL DEFAULT 'COLD',
  chat_transcript            TEXT,
  page_url                  VARCHAR(512),
  status                     VARCHAR(30) NOT NULL DEFAULT 'new',
  notes                      TEXT,
  created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`status` and `notes` are CRM-owned, same convention as the backlinks table —
set a default on insert, then freely editable in the CRM without anything
on the site side ever touching them again (there's no update path here at
all, only insert).

## Secrets needed on the boxxfinance-site repo, once this endpoint exists

Both go in `public/api/config.php` on the SiteGround server (already
gitignored, excluded from the automated FTP deploy — see
`docs/chatbot-brief.md` for how that file is placed):

- `CRM_CHATBOT_URL` — the endpoint URL (e.g.
  `https://crm.boxxfinance.co.uk/chatbot_leads.php`)
- `CRM_CHATBOT_KEY` — the `intake_key` value to validate against (can reuse
  the existing intake key already used by `intake.php`, or a new one — your
  call on the CRM side)

Until both are set, `chat.php` skips the CRM push entirely (still writes to
the Sheet as before) — nothing breaks by building this endpoint at your own
pace.
