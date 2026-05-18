# Boxx Finance — AI Visibility Checker

Tests 80 property finance prompts across **ChatGPT**, **Perplexity**, and **Claude** to measure how often Boxx Finance is mentioned vs competitors. Results export to CSV and your Google Sheet.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file (local runs only)
```bash
cp .env.example .env
```

Fill in your keys:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
GOOGLE_CREDENTIALS=<base64-encoded service account JSON>
SPREADSHEET_ID=1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg
```

To encode your Google service account JSON:
```bash
base64 -i boxx-content-engine.json | tr -d '\n'
```

---

## Running

```bash
# Full run — all 80 prompts, all 3 services
npm start

# Dry run (no API calls, tests the pipeline)
npm run dry-run

# High-priority prompts only (faster, ~30 queries)
npm run high-priority

# Single service
npm run chatgpt-only
npm run perplexity-only
npm run claude-only

# Skip Google Sheets export
npm run no-sheets

# Custom flags
node src/checker.js --services=chatgpt,perplexity --high-only
```

---

## GitHub Actions

The workflow runs **every Monday at 07:00 UTC** automatically.

### Required GitHub Secrets
Add these under **Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `PERPLEXITY_API_KEY` | Your Perplexity API key |
| `GOOGLE_CREDENTIALS` | Base64-encoded service account JSON |
| `SPREADSHEET_ID` | `1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg` |

### Manual trigger
Go to **Actions → AI Visibility Check → Run workflow** and optionally override:
- Priority filter (`high` / `medium` / `low` / `all`)
- Services to test
- Dry run toggle

### Artifacts
Each run uploads a CSV to the workflow artifacts (retained 90 days).

---

## Output

### Console
```
  [001] chatgpt     | Bridging Finance        | What are the best bridging loan lenders...   · 1243ms
  [002] chatgpt     | Bridging Finance        | How do I get a bridging loan...               ✅ 987ms
  ...

📊 Visibility by pillar:
  Bridging Finance         ████░░░░░░ 40% (4/10)
  General Brand            ███░░░░░░░ 30% (3/10)
  ...

🏆 Most mentioned competitors:
  Together                  12x
  MT Finance                8x
```

### CSV
Saved to `results/boxx_visibility_YYYY-MM-DD.csv` with columns:
- Prompt ID, Prompt, Pillar, Priority
- Service, Boxx Mentioned (YES/NO), Boxx Snippet
- Competitor Mentions, Competitor Count
- Response Preview, Elapsed MS, Run Date

### Google Sheet
Written to the `AI_Visibility` tab with bold headers and auto-sized columns.

---

## Prompts structure

| Pillar | Count | Priority |
|--------|-------|----------|
| Bridging Finance | 10 | High |
| Development Finance | 10 | High |
| General Brand | 10 | High |
| Refurbishment Loans | 10 | Medium |
| Commercial Finance | 10 | Medium |
| Buy-to-Let | 10 | Medium |
| Auction Finance | 10 | Mixed |
| Second Charge | 10 | Mixed |

---

## Competitors tracked

Together, MT Finance, West One, Roma Finance, Precise, Octane Capital, United Trust Bank, LendInvest, Masthaven, TML, Funding 365, InterBay, Shawbrook, Together Money, Castle Trust, Landbay, Paragon
