import type { ChatTurn } from './anthropic';
import { IS_PREVIEW, PREVIEW_AI_MESSAGE } from '../../preview/mode';

/** One OpenAI chat request; with `schema` the reply is strict JSON. */
export async function callOpenAI(opts: {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatTurn[];
  schema?: Record<string, unknown>;
}): Promise<string> {
  if (IS_PREVIEW) throw new Error(PREVIEW_AI_MESSAGE);
  // o-series reasoning models take a "developer" role and max_completion_tokens.
  const isReasoningModel = /^o\d/.test(opts.model);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [{ role: isReasoningModel ? 'developer' : 'system', content: opts.system }, ...opts.messages],
  };
  if (isReasoningModel) body.max_completion_tokens = 32000;
  else body.max_tokens = 16000;
  if (opts.schema) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'ladder_response', strict: true, schema: opts.schema } };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw new Error(`OpenAI API error ${response.status}${msg ? `: ${msg}` : ''}`);
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
