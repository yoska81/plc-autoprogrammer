import Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
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
  messages: ChatTurn[];
  schema?: Record<string, unknown>;
}): Promise<ClaudeResult> {
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
