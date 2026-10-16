import { SYSTEM_PROMPT } from './prompt';

export async function generateWithOpenAI(
  apiKey: string,
  model: string,
  userMessage: string,
): Promise<string> {
  // o-series reasoning models take a "developer" role and max_completion_tokens.
  const isReasoningModel = /^o\d/.test(model);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: isReasoningModel ? 'developer' : 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  };
  if (isReasoningModel) body.max_completion_tokens = 32000;
  else body.max_tokens = 16000;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw new Error(`OpenAI API error ${response.status}${msg ? `: ${msg}` : ''}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  };
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? '';
  if (!text) throw new Error('OpenAI returned an empty response.');
  if (choice?.finish_reason === 'length') {
    throw new Error('Program was cut off (output limit reached). Try splitting the machine into smaller parts.');
  }
  return text;
}
