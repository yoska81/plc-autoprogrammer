import type { IOPoint } from '../types/io';
import type { AIProvider } from '../store/useSettingsStore';

export interface GenerateOptions {
  provider: AIProvider;
  apiKey: string;
  model: string;
  userPrompt: string;
  ioPoints: IOPoint[];
  extendedThinking?: boolean;
  thinkingBudget?: number;
  onThinkingUpdate?: (summary: string) => void;
}

const SYSTEM_PROMPT = `You are an expert PLC programmer specializing in IEC 61131-3 Structured Text (ST).
Generate clean, well-commented PLC code based on the user's description and the provided I/O list.

Rules:
- Use IEC 61131-3 Structured Text syntax exactly
- Use the exact I/O variable names provided (e.g. I001, Q005) — do NOT invent new ones
- Declare all internal variables in a VAR ... END_VAR block at the top
- Declare timers as TON type where timing is used
- Add inline comments (// ...) explaining each major logic section
- ALWAYS check safety inputs (category: Safety) as preconditions before enabling any outputs
- Structure code in this order:
    1. VAR declarations
    2. Safety / E-Stop interlock check
    3. Mode selection logic (Auto / Manual / Setup if present)
    4. Sequence / process logic
    5. Output assignments
- Use step-sequencer pattern (CASE iStep OF ...) for multi-step processes
- Return ONLY the PLC code — no explanation, no markdown fences`;

function buildUserMessage(userPrompt: string, ioPoints: IOPoint[]): string {
  const ioList = ioPoints
    .map((p) => `${p.id} - ${p.description || '(no description)'} (${p.type}, ${p.category})`)
    .join('\n');
  return `I/O List:\n${ioList}\n\nMachine Description:\n${userPrompt}\n\nGenerate the IEC 61131-3 Structured Text program.`;
}

// ── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(opts: GenerateOptions): Promise<string> {
  const {
    apiKey, model, userPrompt, ioPoints,
    extendedThinking = false, thinkingBudget = 10000,
    onThinkingUpdate,
  } = opts;

  const body: Record<string, unknown> = {
    model,
    max_tokens: extendedThinking ? thinkingBudget + 8000 : 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(userPrompt, ioPoints) }],
  };

  if (extendedThinking) {
    body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message ||
      `Anthropic API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string; thinking?: string }>;
  };

  // If extended thinking was used, surface the thinking summary
  if (extendedThinking && onThinkingUpdate) {
    const thinkingBlock = data.content.find((c) => c.type === 'thinking');
    if (thinkingBlock?.thinking) {
      onThinkingUpdate(thinkingBlock.thinking);
    }
  }

  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  if (!text) throw new Error('Model returned empty response');
  return text;
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(opts: GenerateOptions): Promise<string> {
  const { apiKey, model, userPrompt, ioPoints } = opts;

  // o-series models use a different endpoint shape (no system role, use developer role)
  const isReasoningModel = model.startsWith('o');

  const messages = isReasoningModel
    ? [
        { role: 'developer', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(userPrompt, ioPoints) },
      ]
    : [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(userPrompt, ioPoints) },
      ];

  const body: Record<string, unknown> = {
    model,
    messages,
  };

  // o-series models use max_completion_tokens, standard models use max_tokens
  if (isReasoningModel) {
    body.max_completion_tokens = 8000;
  } else {
    body.max_tokens = 4096;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message ||
      `OpenAI API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string | null } }>;
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Model returned empty response');
  return text;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function generatePLCProgram(opts: GenerateOptions): Promise<string> {
  if (opts.provider === 'anthropic') return callAnthropic(opts);
  return callOpenAI(opts);
}
