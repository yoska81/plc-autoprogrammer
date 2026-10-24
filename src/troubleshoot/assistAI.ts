/**
 * The AI for fault finding (assist.ts), from the app's AI settings: null with no key, so every caller
 * keeps the rule answers.
 */
import { callClaude } from '../lib/ai/anthropic';
import { callOpenAI } from '../lib/ai/openai';
import { activeCredentials, useSettingsStore } from '../store/useSettingsStore';
import type { Ask } from './assist';

export function troubleshootAsk(): Ask | null {
  const settings = useSettingsStore.getState();
  const { apiKey, model } = activeCredentials(settings);
  if (!apiKey) return null;
  const ai = { provider: settings.provider, apiKey, model, effort: settings.effort };
  return async (system, user, schema) => {
    const messages = [{ role: 'user' as const, content: user }];
    return ai.provider === 'anthropic'
      ? (await callClaude({ ...ai, task: 'troubleshoot', system, messages, schema })).text
      : callOpenAI({ ...ai, system, messages, schema });
  };
}
