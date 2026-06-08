import type { IOPoint } from '../types/io';

export async function generatePLCProgram(
  apiKey: string,
  model: string,
  userPrompt: string,
  ioPoints: IOPoint[]
): Promise<string> {
  const ioList = ioPoints
    .map((p) => `${p.id} - ${p.description || '(no description)'} (${p.type}, ${p.category})`)
    .join('\n');

  const userMessage = `I/O List:
${ioList}

Machine Description:
${userPrompt}

Generate the IEC 61131-3 Structured Text program.`;

  const systemPrompt = `You are an expert PLC programmer specializing in IEC 61131-3 Structured Text (ST).
Generate clean, well-commented PLC code based on the user's description and the provided I/O list.

Rules:
- Use IEC 61131-3 Structured Text syntax
- Use the exact I/O variable names provided (e.g. I001, Q005)
- Add a VAR section at the top declaring all internal variables used
- Add comments explaining each major logic section
- Use proper PLC programming patterns: interlocks, safety checks first, then sequence logic
- Always check safety inputs (category: Safety) as preconditions before enabling outputs
- Structure code with: Safety checks → Mode handling → Sequence/Process logic → Output assignments
- Use TON timers where timing is implied
- Return ONLY the PLC code, no explanation text before or after`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message ||
      `API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  return text;
}
