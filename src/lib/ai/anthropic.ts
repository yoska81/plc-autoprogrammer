import Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import { SYSTEM_PROMPT } from './prompt';

export interface AnthropicResult {
  text: string;
  reasoning: string | null;
}

export async function generateWithClaude(
  apiKey: string,
  model: string,
  effort: Effort,
  userMessage: string,
): Promise<AnthropicResult> {
  // Keys live in the user's own browser; there is no backend to proxy through.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let message;
  try {
    // Streamed so long, deep-thinking generations don't hit HTTP timeouts.
    // `fallbacks: 'default'` lets the API retry on another model if a safety
    // classifier declines the request instead of returning nothing.
    message = await client.beta.messages
      .stream({
        model,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
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
    throw new Error('Claude declined this request. Try rephrasing the machine description.');
  }

  const text = message.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('');
  const reasoning = message.content
    .flatMap((b) => (b.type === 'thinking' && b.thinking ? [b.thinking] : []))
    .join('\n\n');

  if (!text) throw new Error('Claude returned an empty response.');
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Program was cut off (output limit reached). Try splitting the machine into smaller parts.');
  }
  return { text, reasoning: reasoning || null };
}
