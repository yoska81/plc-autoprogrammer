import type { IOPoint } from '../types/io';
import type { AIProvider, Effort } from '../store/useSettingsStore';
import { buildUserMessage, stripCodeFences } from './ai/prompt';
import { generateWithClaude } from './ai/anthropic';
import { generateWithOpenAI } from './ai/openai';

export interface GenerateOptions {
  provider: AIProvider;
  apiKey: string;
  model: string;
  effort: Effort;
  userPrompt: string;
  ioPoints: IOPoint[];
}

export interface GenerateResult {
  code: string;
  /** Summarized reasoning (Claude only). */
  reasoning: string | null;
}

export async function generatePLCProgram(opts: GenerateOptions): Promise<GenerateResult> {
  const userMessage = buildUserMessage(opts.userPrompt, opts.ioPoints);
  if (opts.provider === 'anthropic') {
    const { text, reasoning } = await generateWithClaude(opts.apiKey, opts.model, opts.effort, userMessage);
    return { code: stripCodeFences(text), reasoning };
  }
  const text = await generateWithOpenAI(opts.apiKey, opts.model, userMessage);
  return { code: stripCodeFences(text), reasoning: null };
}
