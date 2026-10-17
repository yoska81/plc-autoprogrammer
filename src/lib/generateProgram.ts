import type { IOPoint } from '../types/io';
import type { AIConfig } from '../plc/ai/ladderAI';
import { SYSTEM_PROMPT, buildUserMessage, stripCodeFences } from './ai/prompt';
import { callClaude } from './ai/anthropic';
import { callOpenAI } from './ai/openai';

export interface GenerateResult {
  code: string;
  /** Summarized reasoning (Claude only). */
  reasoning: string | null;
}

/** Structured Text generation for text-language PLC profiles. */
export async function generatePLCProgram(ai: AIConfig, userPrompt: string, ioPoints: IOPoint[]): Promise<GenerateResult> {
  const messages = [{ role: 'user' as const, content: buildUserMessage(userPrompt, ioPoints) }];
  if (ai.provider === 'anthropic') {
    const { text, reasoning } = await callClaude({ ...ai, task: 'program', system: SYSTEM_PROMPT, messages });
    return { code: stripCodeFences(text), reasoning };
  }
  const text = await callOpenAI({ ...ai, system: SYSTEM_PROMPT, messages });
  return { code: stripCodeFences(text), reasoning: null };
}
