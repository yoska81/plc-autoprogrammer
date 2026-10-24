import type { ChatTurn } from './anthropic';
import { IS_PREVIEW } from '../../preview/mode';
import { callClaudeAccount } from '../../preview/claudeAccount';
import { trackAi } from './busy';
import { totalLimitFor, withRetries, withWatchdog } from './errors';
import { reportRetry } from './jobs';

/** One OpenAI chat request; with `schema` the reply is strict JSON. */
type OpenAIOptions = {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatTurn[];
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Most tokens the answer may take (default 16 000; reasoning models 32 000). */
  maxTokens?: number;
};

/** One OpenAI request; transient failures are retried like callClaude. */
export function callOpenAI(opts: OpenAIOptions): Promise<string> {
  // no streaming here: the watchdog caps the total time (30 min) so a dead connection can't hang the app
  return trackAi(() => withRetries(() => withWatchdog((signal) => requestOpenAI({ ...opts, signal }), { signal: opts.signal, totalMs: totalLimitFor('max'), reportsProgress: false }), {
    signal: opts.signal,
    onRetry: (n) => reportRetry(opts.signal, n),
    explain: (err) => (err instanceof Error ? err.message : String(err)),
  }));
}

async function requestOpenAI(opts: OpenAIOptions): Promise<string> {
  // The preview can't reach OpenAI; the viewer's Claude account answers instead.
  if (IS_PREVIEW) return (await callClaudeAccount({ model: 'claude-opus-5-5', effort: 'high', system: opts.system, messages: opts.messages, schema: opts.schema, signal: opts.signal })).text;
  // o-series reasoning models take a "developer" role and max_completion_tokens.
  const isReasoningModel = /^o\d/.test(opts.model);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [{ role: isReasoningModel ? 'developer' : 'system', content: opts.system }, ...opts.messages],
  };
  if (isReasoningModel) body.max_completion_tokens = opts.maxTokens ?? 32000;
  else body.max_tokens = opts.maxTokens ?? 16000;
  if (opts.schema) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'ladder_response', strict: true, schema: opts.schema } };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw Object.assign(new Error(`OpenAI API error ${response.status}${msg ? `: ${msg}` : ''}`), { status: response.status, headers: response.headers });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  };
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`OpenAI declined: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') {
    throw new Error('The answer was cut off (output limit reached). Try splitting the machine into smaller parts.');
  }
  const text = choice?.message?.content ?? '';
  if (!text) throw new Error('OpenAI returned an empty response.');
  return text;
}
