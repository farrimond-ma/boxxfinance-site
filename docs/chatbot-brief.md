# AI Bridging Finance Sales Chatbot — architecture & setup

Built from Mark's full chatbot spec (28 sections — personality, bridging finance
knowledge, qualification flow, lead capture, technical accuracy rules, etc.).
This doc covers the parts that aren't obvious from the code: why the backend
lives where it does, and the one manual step needed to actually turn it on.

## Why a PHP backend, on SiteGround

The spec is explicit (item 26) that the AI API key must never reach the
frontend. This site is 100% static — Vite build, FTP to SiteGround, no
serverless platform, no Node backend anywhere. The only precedent for a
secret-holding backend on this project is the CRM's PHP setup
(`crm.boxxfinance.co.uk`), so the same pattern was used here: a small PHP
endpoint deployed alongside the static site, holding the key server-side.

- `public/api/chat.php` — the endpoint. Receives `{messages, pageContext}`,
  calls Anthropic server-side, parses the model's `<reply>`/`<lead_data>`
  response, submits qualified leads to the Google Sheet, returns just the
  reply text to the browser.
- `public/api/prompt.php` — the system prompt, kept separate so it can be
  edited without touching request-handling logic (spec item 26: "the system
  prompt can be changed without rewriting the UI").
- `public/api/config.sample.php` — committed template. **Never holds a real
  key.**
- `public/api/config.php` — the real config, **gitignored, never committed**.
  Placed on the server manually, once.

Because `public/` is copied verbatim into `dist/` by Vite, and `dist/` is
what gets FTP-synced to the server, `config.php` needs a different path onto
the server than "commit it and let the pipeline deploy it" — that would mean
the key sits in the repo and in the build output, and any AI or human
working on this repo could read it. Manual placement is the deliberate
tradeoff: one five-minute one-off step, in exchange for the key never
existing in git history or CI logs.

## One-off setup (do this once)

1. Copy `public/api/config.sample.php` to `config.php`.
2. Fill in `ANTHROPIC_API_KEY` with a real key from
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
3. Upload just that one file to `public_html/api/config.php` on SiteGround
   (file manager or FTP client — not via GitHub Actions).

That's it. `chat.php` and `prompt.php` deploy automatically with every push,
same as the rest of the site. Only `config.php` is manual, and only once —
`.github/workflows/deploy.yml` excludes `**/api/config.php` from the FTP
sync specifically so a normal deploy never touches or deletes it.

## Testing it worked

Open any content page (a service page, blog post, or location page all
render the "Talk to us" floating pill via `FloatingCta`), click it, and send
a message. If `config.php` isn't there yet, or the key is wrong, the chat
degrades gracefully to "Chat is temporarily unavailable — please call
[number] instead" rather than breaking.

## How a conversation becomes a lead

The model is instructed (in `prompt.php`) to end every single response with
a hidden `<lead_data>` JSON block — accumulated fields (name, telephone,
loan amount, exit strategy, etc.), a `lead_quality` classification (HOT /
WARM / COLD / HUMAN_REQUEST), and a `ready_to_submit` flag. `chat.php` never
shows this to the visitor — it strips it out, and only acts on it: once
`ready_to_submit` is true and there's a name plus a phone or email,
`chat.php` posts the lead server-side to the same Google Sheet every other
form on the site already uses (`GOOGLE_SCRIPT_URL`), tagged
`AI Chatbot (bridging)` so it's distinguishable from other sources in the
sheet. This happens the moment the model decides the visitor has given
enough — not on a separate explicit "submit" step — so a lead is captured
even if the visitor closes the tab right after typing their number.

## Where the "Talk to us" button went

The existing floating "Talk to us" pill (`FloatingCta` in
`src/components/resource/ResourceHero.jsx`), shown on the vast majority of
content pages via `ResourcePage.jsx` and `ServicePage.jsx`, now opens the
chat panel instead of navigating to `/chat-about-funding`. This was a
deliberate choice over adding a second, separate floating chat bubble —
one persistent bottom-right element, not two competing for the same corner.
The multi-step form at `/chat-about-funding` itself is untouched and still
reachable from the "Get a free quote" / "Start your enquiry" buttons
elsewhere on the same pages, for visitors who'd rather fill in a form than
chat.

## Extending this later

- **Rate limiting** is a simple file-based per-IP counter (40 req/hour) in
  `chat.php` — adequate for a sales chat's real traffic level, not
  bulletproof against a determined abuser. Worth revisiting if traffic grows.
- **CRM delivery**: leads currently go to the Sheet only, per the "start
  simple" decision when this was scoped. Same pattern as
  `scripts/content-engine/sync-backlinks-to-crm.js` could be used to also
  push chatbot leads into the CRM once it has a suitable intake endpoint.
- **Model swap**: `MODEL` lives in `config.php`, not hardcoded, so changing
  providers only touches `chat.php`'s Anthropic-specific cURL call — the
  frontend and lead logic don't know or care which model answered.
