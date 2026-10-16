import Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import { IS_PREVIEW } from '../../preview/mode';
import { callClaudeAccount } from '../../preview/claudeAccount';
import { trackAi } from './busy';
import { KIND_TEXT, withRetries, type AiErrorInfo } from './errors';
import { reportRetry } from './jobs';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** A user turn with images/PDFs (used by Import). */
export interface RichTurn {
  role: 'user';
  content: Anthropic.Beta.Messages.BetaContentBlockParam[];
}

export interface ClaudeResult {
  text: string;
  reasoning: string | null;
}

/**
 * One Claude request. With `schema`, the reply is constrained to that JSON
 * schema (structured outputs) and `text` is the JSON string.
 */
export type ClaudeOptions = {
  apiKey: string;
  model: string;
  effort: Effort;
  system: string;
  messages: (ChatTurn | RichTurn)[];
  schema?: Record<string, unknown>;
  /** Aborts the request (job Cancel). */
  signal?: AbortSignal;
};

/**
 * Test hook (AI quality harness, tools/ai-quality): when set, every request goes
 * through it; it may answer from a recording or call `real` and record the reply.
 * Never set in the app.
 */
export type ClaudeInterceptor = (opts: ClaudeOptions, real: (o: ClaudeOptions) => Promise<ClaudeResult>) => Promise<ClaudeResult>;
let interceptor: ClaudeInterceptor | null = null;
export function setClaudeInterceptor(fn: ClaudeInterceptor | null) { interceptor = fn; }

/**
 * One Claude request with automatic retries: a dropped connection, an overloaded service (429 / 529 /
 * 5xx) or a timeout is retried up to 3 times with backoff ("retrying (2/3)…" in the status bar), then
 * reported in plain English. `opts.signal` stops it (job Cancel).
 */
export function callClaude(opts: ClaudeOptions): Promise<ClaudeResult> {
  return trackAi(() => withRetries(() => (interceptor ? interceptor(opts, requestClaude) : requestClaude(opts)), {
    signal: opts.signal,
    onRetry: (n) => reportRetry(opts.signal, n),
    explain: (err, info) => explainFailure(err, info, opts.model),
  }));
}

/** Final message for a failed request (after any retries). */
function explainFailure(err: unknown, info: AiErrorInfo, model: string): string {
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) return explainApiError(err, model);
  const msg = err instanceof Error ? err.message : String(err);
  if (info.kind === 'network' || info.kind === 'timeout') return `${KIND_TEXT[info.kind]} before the answer was complete. Check the internet connection and try again.`;
  return msg;
}

async function requestClaude(opts: ClaudeOptions): Promise<ClaudeResult> {
  // The preview can't reach the API; the viewer's own Claude account answers instead.
  if (IS_PREVIEW) return callClaudeAccount(opts as Parameters<typeof callClaudeAccount>[0]);
  // Keys live in the user's own browser; there is no backend to proxy through.
  // Retries are done by callClaude (also for streams that drop half-way), not by the SDK.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });

  // Streamed so long, deep-thinking generations don't hit HTTP timeouts.
  // `fallbacks: 'default'` lets the API retry on another model if a safety
  // classifier declines the request instead of returning nothing.
  const message = await client.beta.messages
    .stream({
      model: opts.model,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: {
        effort: opts.effort,
        ...(opts.schema ? { format: { type: 'json_schema' as const, schema: opts.schema } } : {}),
      },
      // The system prompt is static per stage: cached across calls (5 min) when it is long enough.
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages: opts.messages,
    }, { signal: opts.signal })
    .finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('Claude declined this request. Try rephrasing it.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('The answer was cut off (output limit reached). Try splitting the machine into smaller parts.');
  }

  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const reasoning = message.content
    .flatMap((b) => (b.type === 'thinking' && b.thinking ? [b.thinking] : []))
    .join('\n\n');
  if (!text) throw new Error('Claude returned an empty response.');
  return { text, reasoning: reasoning || null };
}

/** Plain-English text for an Anthropic API failure (shared by generation and the connection test). */
function explainApiError(err: unknown, model: string): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic rejected the key (401). It is wrong, was revoked, or was copied incompletely. Copy it again from console.anthropic.com → API keys and paste it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return `The key is valid but not allowed to use ${model} (403). Check the key's workspace permissions in the console, or pick another model in Settings.`;
  if (err instanceof Anthropic.NotFoundError) return `The model ${model} is not available to this account (404). Pick another model in Settings.`;
  if (err instanceof Anthropic.RateLimitError) return 'The key works but the rate or spend limit is reached (429). Wait a moment and try again, or raise the limit in the console.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach api.anthropic.com. Check the internet connection; a firewall, VPN or browser extension may be blocking it.';
  if (err instanceof Anthropic.APIError) {
    if (/credit balance|billing/i.test(err.message)) return 'The key works but the account has no credit. Add credit at console.anthropic.com → Billing.';
    if (err.status === 529 || (err.status ?? 0) >= 500) return `The AI service is busy or having a problem right now (${err.status}). Wait a minute and try again.`;
    return `Anthropic error ${err.status ?? ''}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Check an API key with one tiny request and explain any problem in plain
 * words. In the preview it checks the viewer's Claude account instead.
 */
export async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; message: string }> {
  if (IS_PREVIEW) {
    try {
      await callClaudeAccount({ model, effort: 'low', system: 'Reply with the single word OK.', messages: [{ role: 'user', content: 'Connection test' }] });
      return { ok: true, message: 'Connected: Claude answered through your Claude account. No API key is needed in this preview.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  const key = apiKey.trim();
  if (!key) return { ok: false, message: 'No API key entered. Create one at console.anthropic.com → API keys, then paste it here.' };
  if (!key.startsWith('sk-ant-')) {
    return { ok: false, message: 'This does not look like an Anthropic API key (they start with "sk-ant-"). A Claude.ai subscription login is not an API key: create a key at console.anthropic.com → API keys.' };
  }
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    await client.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with OK.' }] });
    return { ok: true, message: `Connected: ${model} answered. The key works.` };
  } catch (err) {
    return { ok: false, message: explainApiError(err, model) };
  }
}
