import Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import { IS_PREVIEW } from '../../preview/mode';
import { callClaudeAccount } from '../../preview/claudeAccount';

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
export async function callClaude(opts: {
  apiKey: string;
  model: string;
  effort: Effort;
  system: string;
  messages: (ChatTurn | RichTurn)[];
  schema?: Record<string, unknown>;
}): Promise<ClaudeResult> {
  // The preview can't reach the API; the viewer's own Claude account answers instead.
  if (IS_PREVIEW) return callClaudeAccount(opts as Parameters<typeof callClaudeAccount>[0]);
  // Keys live in the user's own browser; there is no backend to proxy through.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });

  let message;
  try {
    // Streamed so long, deep-thinking generations don't hit HTTP timeouts.
    // `fallbacks: 'default'` lets the API retry on another model if a safety
    // classifier declines the request instead of returning nothing.
    message = await client.beta.messages
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
        system: opts.system,
        messages: opts.messages,
      })
      .finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Anthropic rejected the API key. Check it in Settings.', { cause: err });
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Anthropic rate limit reached. Wait a moment and try again.', { cause: err });
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error ${err.status ?? ''}: ${err.message}`, { cause: err });
    }
    throw err;
  }

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
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, message: 'Anthropic rejected the key (401). It is wrong, was revoked, or was copied incompletely. Copy it again from console.anthropic.com → API keys.' };
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, message: `The key is valid but not allowed to use ${model} (403). Check the key's workspace permissions in the console, or pick another model.` };
    if (err instanceof Anthropic.NotFoundError) return { ok: false, message: `The model ${model} is not available to this account (404). Pick another model in the list.` };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, message: 'The key works but the rate or spend limit is reached (429). Wait, or raise the limit in the console.' };
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, message: 'Could not reach api.anthropic.com. A firewall, VPN or browser extension may be blocking it.' };
    if (err instanceof Anthropic.APIError) {
      if (/credit balance|billing/i.test(err.message)) return { ok: false, message: 'The key works but the account has no credit. Add credit at console.anthropic.com → Billing.' };
      return { ok: false, message: `Anthropic error ${err.status ?? ''}: ${err.message}` };
    }
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
