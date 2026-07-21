/**
 * Anthropic-backed drop-in for the slice of the OpenAI chat API this repo uses.
 *
 * Why this exists: on 2026-07-18 the OpenAI account ran out of credit and every
 * gpt-4o-driven generator (publish-blog, publish-location, regenerate-thin-posts)
 * silently failed for days, while the Claude-based social publishers kept running.
 * The whole content pipeline hung off a single vendor with a single spend cap.
 *
 * This shim lets those generators run on Claude — which is already proven across
 * the social publishers — WITHOUT rewriting every call site. It accepts the same
 * `openai.chat.completions.create(...)` call the scripts already make and returns
 * the same response shape they already read (`res.choices[0].message.content`),
 * translating to Anthropic's Messages API underneath.
 *
 * Deliberately minimal: it implements only what this repo actually calls. It is
 * NOT a general OpenAI compatibility layer.
 */

const Anthropic = require('@anthropic-ai/sdk');

// OpenAI model ids used in this repo → Claude equivalents.
// gpt-4o was the bulk content generator; Sonnet is the quality/cost match.
const MODEL_MAP = {
  'gpt-4o': 'claude-sonnet-5',
  'gpt-4o-mini': 'claude-haiku-4-5-20251001',
  'gpt-4': 'claude-sonnet-5',
  'gpt-4-turbo': 'claude-sonnet-5',
};

const DEFAULT_MODEL = 'claude-sonnet-5';

// Sonnet 5 supports 128k output. These callers ask for 6-12k, sized for gpt-4o.
// Two things make that too tight here, and both truncate the JSON mid-object:
//   1. Sonnet 5 uses a newer tokenizer that produces materially more tokens for
//      the same text than gpt-4o did.
//   2. max_tokens is a HARD cap on thinking + response combined.
// So we raise the floor to give the JSON room to complete.
const MIN_OUTPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 32000;

function createOpenAICompatClient({ apiKey, defaultModel = DEFAULT_MODEL } = {}) {
  const anthropic = new Anthropic({ apiKey });

  async function create(params = {}) {
    const { messages = [], model, max_tokens, temperature } = params;

    // Anthropic takes `system` as a top-level string, not a message role.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : String(m.content)))
      .join('\n\n');

    const convo = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : String(m.content),
      }));

    // Anthropic requires at least one message; if a caller sent only a system
    // prompt, promote it to the user turn.
    if (convo.length === 0) convo.push({ role: 'user', content: system || '' });

    const req = {
      model: MODEL_MAP[model] || defaultModel,
      max_tokens: Math.min(Math.max(max_tokens || 4096, MIN_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS),
      messages: convo,
      // CRITICAL: on Sonnet 5, OMITTING `thinking` runs ADAPTIVE thinking, and
      // max_tokens caps thinking + response TOGETHER. These callers want a
      // single complete JSON object, so adaptive thinking silently ate the
      // budget and truncated the JSON mid-object — which surfaced as
      // "Failed to parse OpenAI response as JSON" and failed every run.
      // Disabling it matches the gpt-4o behaviour the call sites were built for.
      thinking: { type: 'disabled' },
    };
    if (system) req.system = system;
    // Sonnet 5 REJECTS non-default temperature/top_p/top_k with a 400, so this
    // is only forwarded for models that still accept it.
    if (typeof temperature === 'number' && !/^claude-sonnet-5|^claude-opus-4-[78]|^claude-fable/.test(req.model)) {
      req.temperature = temperature;
    }

    const resp = await anthropic.messages.create(req);

    // A truncated response yields invalid JSON downstream, and the caller's
    // JSON.parse error hides the real cause. Fail loudly and specifically.
    if (resp.stop_reason === 'max_tokens') {
      throw new Error(
        `Claude hit max_tokens (${req.max_tokens}) before finishing — the response is truncated ` +
        `and will not parse as JSON. Raise max_tokens or shorten the requested output.`
      );
    }

    const text = (resp.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Mirror the OpenAI response shape the callers read.
    return {
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: resp.stop_reason === 'end_turn' ? 'stop' : resp.stop_reason,
        },
      ],
      model: resp.model,
      usage: resp.usage,
    };
  }

  return { chat: { completions: { create } } };
}

module.exports = { createOpenAICompatClient };
