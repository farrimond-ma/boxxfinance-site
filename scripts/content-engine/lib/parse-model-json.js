/**
 * Robustly parse a JSON object out of a model response.
 *
 * Why this exists: the generators used to sanitise the raw response with
 *
 *     .replace(/“/g, '"').replace(/”/g, '"')
 *
 * which rewrites curly quotes to straight quotes ANYWHERE — including inside
 * JSON string values, where an unescaped `"` terminates the string and destroys
 * the document. gpt-4o rarely emitted curly quotes, so it went unnoticed for
 * months. Claude writes typographically correct prose (“exit strategy”), so
 * after the migration every article came back as valid JSON and was then
 * corrupted on the way in — surfacing as "Failed to parse response as JSON".
 *
 * The order here is the whole point: parse the response AS WRITTEN first, and
 * only fall back to quote-normalising if that genuinely fails (some older
 * models used curly quotes as the JSON delimiters themselves). Never normalise
 * first.
 */

// Pull the outermost {...} so stray preamble or trailing prose is ignored.
function extractObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

function parseModelJson(raw, { label = 'model' } = {}) {
  const text = String(raw ?? '');
  const body = extractObject(
    text.replace(/```json/gi, '').replace(/```/g, '').trim()
  );

  const attempts = [
    ['as written', body],
    // Fallback ONLY — for models that use curly quotes as JSON delimiters.
    ['curly quotes normalised', body.replace(/“/g, '"').replace(/”/g, '"')],
  ];

  let lastErr;
  for (const [, candidate] of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastErr = err;
    }
  }

  // Diagnostics that actually locate the problem, instead of blindly printing
  // the first 500 characters (which never contained the failure).
  const pos = Number((/position (\d+)/.exec(lastErr.message) || [])[1]);
  const err = new Error(`Failed to parse ${label} response as JSON: ${lastErr.message}`);
  err.diagnostics = {
    length: body.length,
    position: Number.isFinite(pos) ? pos : null,
    context: Number.isFinite(pos)
      ? body.slice(Math.max(0, pos - 150), pos + 150)
      : null,
    head: body.slice(0, 200),
    tail: body.slice(-200),
  };
  throw err;
}

// Print the diagnostics above in a form that makes the cause obvious in CI logs.
function logJsonFailure(err) {
  const d = err.diagnostics || {};
  console.error(err.message);
  console.error(`  content length: ${d.length ?? 'unknown'} chars`);
  if (d.context) {
    console.error(`  around failure (position ${d.position}):`);
    console.error(`    …${d.context}…`);
  } else {
    console.error(`  head: ${d.head}`);
    console.error(`  tail: ${d.tail}`);
  }
}

module.exports = { parseModelJson, logJsonFailure };
