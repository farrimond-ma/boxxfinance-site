/**
 * Preflight check — verify every external dependency BEFORE the day's jobs run.
 *
 * Why this exists: in four days three separate services ran dry or expired, and
 * each time the visible symptom pointed somewhere else entirely:
 *
 *   - Anthropic credit hit $0        → surfaced as "Failed to parse response as JSON"
 *   - Google One storage lapsed      → surfaced as three unrelated-looking failures
 *   - LinkedIn tokens near expiry    → will surface as a generic 401 mid-post
 *
 * The existing watchdogs (failure-watchdog, health-check) are all REACTIVE —
 * they tell you a job already failed. This one runs first thing in the morning,
 * before the AM blog job, and answers a different question: will today's jobs be
 * able to run at all?
 *
 * There is no credit-balance endpoint on the Anthropic API — the Admin API
 * exposes usage/cost REPORTS, not a spendable balance. So this doesn't read a
 * number; it makes a minimal real call to each service and classifies the
 * failure. That's strictly better than a balance check: it also catches expired
 * tokens, revoked keys, and lapsed storage quota, which no balance would show.
 */

require('dotenv').config();
const { google } = require('googleapis');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Boxx-Commercial-Finance';

// Bot-authored, so GitHub actually emails the repo owner. A PAT-authored issue
// makes the owner the author, and GitHub never notifies you about your own.
const octokit = new (require('@octokit/rest').Octokit)({ auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });

const results = [];

function record(name, ok, detail, { fatal = false } = {}) {
  results.push({ name, ok, detail, fatal });
  const mark = ok ? 'OK  ' : (fatal ? 'FAIL' : 'WARN');
  console.log(`  [${mark}] ${name}: ${detail}`);
}

/**
 * Anthropic — the one that took three days to diagnose.
 *
 * A one-token request costs a fraction of a penny and exercises the exact path
 * the generators use. Credit exhaustion returns 400 with `type: "billing_error"`,
 * which is distinguishable from an invalid key (401 authentication_error) and
 * from a revoked key (403 permission_error) — so the message names the actual
 * problem instead of leaving it to be inferred from a downstream parse error.
 */
async function checkAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return record('Anthropic API', false, 'ANTHROPIC_API_KEY is not set', { fatal: true });
  }
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // cheapest model — this is a liveness probe, not work
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
      thinking: { type: 'disabled' },
    });
    record('Anthropic API', true, 'key valid, credit available');
  } catch (err) {
    const type = err?.type || err?.error?.error?.type || '';
    const status = err?.status;
    let detail;
    if (type === 'billing_error' || /credit balance is too low/i.test(err.message || '')) {
      detail = 'OUT OF CREDIT — top up at console.anthropic.com/settings/billing. ' +
               'Every blog, location and social generator will fail until this is fixed.';
    } else if (status === 401) {
      detail = 'API key rejected (401) — the key is invalid or was rotated.';
    } else if (status === 403) {
      detail = 'API key lacks permission (403) — check the key\'s workspace scope.';
    } else if (status === 429) {
      detail = `Rate limited (429) — not fatal, but today's jobs may be throttled.`;
      return record('Anthropic API', false, detail, { fatal: false });
    } else if (status >= 500 || !status) {
      // Transient: Anthropic 5xx/529, or a network blip on our side. Warn but
      // don't block — otherwise a momentary overload at 05:47 files a
      // "content engine cannot run" issue while everything is actually fine.
      detail = `Service unreachable (${status || 'network error'}) — likely transient: ${err.message}. ` +
               `Not treated as blocking; the jobs themselves retry.`;
      return record('Anthropic API', false, detail, { fatal: false });
    } else {
      detail = `Unexpected error (${status}): ${err.message}`;
    }
    record('Anthropic API', false, detail, { fatal: true });
  }
}

/**
 * Google Sheets — the content queue. Checks READ and WRITE separately, because
 * the Google One storage lapse broke writes while reads kept working, which is
 * exactly why it looked like three unrelated faults.
 */
async function checkSheets() {
  if (!process.env.GOOGLE_CREDENTIALS || !process.env.SPREADSHEET_ID) {
    return record('Google Sheets', false, 'GOOGLE_CREDENTIALS or SPREADSHEET_ID not set', { fatal: true });
  }
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const id = process.env.SPREADSHEET_ID;

    const read = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'A1:A2' });
    if (!read.data) throw new Error('read returned no data');
    record('Google Sheets (read)', true, 'queue readable');

    // Write to a dedicated heartbeat cell rather than touching queue data.
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: 'Preflight!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [[new Date().toISOString()]] },
    });
    record('Google Sheets (write)', true, 'queue writable');
  } catch (err) {
    const msg = err.message || '';
    let detail;
    if (/storage quota|quota.*exceeded|insufficient.*storage/i.test(msg)) {
      detail = 'STORAGE QUOTA EXCEEDED — the Google account is out of space, so writes fail ' +
               'while reads still work. This previously mimicked three unrelated failures.';
    } else if (/Unable to parse range.*Preflight/i.test(msg)) {
      detail = 'Add a sheet tab named "Preflight" to the spreadsheet for the write heartbeat.';
      return record('Google Sheets (write)', false, detail, { fatal: false });
    } else if (err.code === 403) {
      detail = `Access denied (403) — the service account may have lost access: ${msg}`;
    } else {
      detail = msg;
    }
    record('Google Sheets', false, detail, { fatal: true });
  }
}

/**
 * Social tokens. Long-lived but NOT permanent — LinkedIn's expire roughly every
 * 60 days and Facebook page tokens can be invalidated by a password change.
 * Checking the token directly means a stale token is caught the morning it dies
 * rather than on the next scheduled post.
 */
async function checkLinkedIn() {
  const tokens = [
    ['LinkedIn (org)', process.env.LINKEDIN_ORG_ACCESS_TOKEN],
    ['LinkedIn (Mark)', process.env.LINKEDIN_ACCESS_TOKEN_MARK],
    ['LinkedIn (Andrew)', process.env.LINKEDIN_ACCESS_TOKEN_ANDREW],
  ];
  for (const [label, token] of tokens) {
    if (!token) { record(label, false, 'token not set', { fatal: false }); continue; }
    try {
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        record(label, true, 'token valid');
      } else if (res.status === 401) {
        record(label, false, 'TOKEN EXPIRED — regenerate it; LinkedIn posts will fail.', { fatal: false });
      } else {
        record(label, false, `unexpected status ${res.status}`, { fatal: false });
      }
    } catch (err) {
      record(label, false, `check failed: ${err.message}`, { fatal: false });
    }
  }
}

async function checkFacebook() {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return record('Facebook', false, 'token or page ID not set', { fatal: false });
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${token}`);
    const body = await res.json();
    if (res.ok && body.id) {
      record('Facebook', true, `page token valid (${body.name})`);
    } else {
      const m = body?.error?.message || `status ${res.status}`;
      record('Facebook', false, `TOKEN INVALID — ${m}`, { fatal: false });
    }
  } catch (err) {
    record('Facebook', false, `check failed: ${err.message}`, { fatal: false });
  }
}

function buildReport() {
  const failures = results.filter(r => !r.ok);
  const fatal = failures.filter(r => r.fatal);
  const lines = [];

  lines.push(fatal.length
    ? `## Preflight FAILED — today's content jobs will not work\n`
    : `## Preflight: ${failures.length} warning(s)\n`);

  if (fatal.length) {
    lines.push(`### Blocking — fix before the next scheduled run\n`);
    for (const f of fatal) lines.push(`- **${f.name}** — ${f.detail}`);
    lines.push('');
  }
  const warns = failures.filter(r => !r.fatal);
  if (warns.length) {
    lines.push(`### Warnings — some publishers affected\n`);
    for (const w of warns) lines.push(`- **${w.name}** — ${w.detail}`);
    lines.push('');
  }
  lines.push(`### Passing\n`);
  for (const r of results.filter(x => x.ok)) lines.push(`- ${r.name} — ${r.detail}`);
  return lines.join('\n');
}

async function postIssue(report, fatalCount) {
  const title = fatalCount
    ? 'Preflight: content engine cannot run'
    : 'Preflight: service warnings';
  const body = `${report}\n\n---\n_Auto-generated by \`preflight-check.js\`, which runs before the day's content jobs. ` +
    `It makes a minimal live call to each service rather than reading a balance, so it catches ` +
    `exhausted credit, expired tokens, and lapsed storage quota alike. Close this once fixed._`;

  let existing;
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, state: 'open', per_page: 30,
    });
    existing = issues.find(i => i.title === title);
  } catch (err) {
    console.warn(`  Could not list issues: ${err.message}`);
  }

  try {
    if (existing) {
      await octokit.issues.createComment({
        owner: GITHUB_OWNER, repo: GITHUB_REPO, issue_number: existing.number, body,
      });
      console.log(`\nCommented on existing issue #${existing.number}`);
    } else {
      const { data: created } = await octokit.issues.create({
        owner: GITHUB_OWNER, repo: GITHUB_REPO, title, body,
      });
      console.log(`\nOpened issue #${created.number}`);
    }
  } catch (err) {
    console.error(`  Could not file issue: ${err.message}`);
  }
}

async function main() {
  console.log('Preflight check — verifying services before today\'s content jobs\n');

  await checkAnthropic();
  await checkSheets();
  await checkLinkedIn();
  await checkFacebook();

  const failures = results.filter(r => !r.ok);
  const fatal = failures.filter(r => r.fatal);
  const report = buildReport();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.filter(r => r.ok).length}/${results.length} checks passed`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  }

  if (failures.length) {
    await postIssue(report, fatal.length);
  }

  // Fail the run only on blocking problems, so a stale social token doesn't
  // mask a real outage in the Actions tab.
  if (fatal.length) {
    console.error(`\n${fatal.length} blocking problem(s) — today's jobs will fail until fixed.`);
    process.exit(1);
  }
  console.log('\nAll blocking checks passed.');
}

main().catch(err => {
  console.error('Preflight check itself failed:', err);
  process.exit(1);
});
