import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'anthropic' | 'openai';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

export const ANTHROPIC_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — best (recommended)' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 — more capable, about 2.5× more expensive' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, cheaper' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, cheapest' },
];

export const EFFORT_LEVELS: { value: Effort; label: string }[] = [
  { value: 'max', label: 'Max — deepest thinking, slowest (recommended)' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low — quick drafts' },
];

/** Suggestions only — any OpenAI model ID can be typed in Settings. */
export const OPENAI_MODEL_SUGGESTIONS = ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'];

interface SettingsStore {
  provider: AIProvider;
  setProvider: (p: AIProvider) => void;

  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  anthropicModel: string;
  setAnthropicModel: (model: string) => void;
  /** How hard Claude thinks before answering. */
  effort: Effort;
  setEffort: (e: Effort) => void;

  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  openaiModel: string;
  setOpenaiModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      setProvider: (provider) => set({ provider }),

      anthropicApiKey: '',
      setAnthropicApiKey: (anthropicApiKey) => set({ anthropicApiKey }),
      anthropicModel: DEFAULT_ANTHROPIC_MODEL,
      setAnthropicModel: (anthropicModel) => set({ anthropicModel }),
      effort: 'max',
      setEffort: (effort) => set({ effort }),

      openaiApiKey: '',
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      openaiModel: 'gpt-4o',
      setOpenaiModel: (openaiModel) => set({ openaiModel }),
    }),
    {
      name: 'plc-settings-store',
      version: 4,
      // v1 stored retired model IDs and a token-budget thinking setting that
      // current Claude models reject. Keep the keys, reset the rest.
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          return {
            provider: old.provider === 'openai' ? 'openai' : 'anthropic',
            anthropicApiKey: typeof old.anthropicApiKey === 'string' ? old.anthropicApiKey : '',
            openaiApiKey: typeof old.openaiApiKey === 'string' ? old.openaiApiKey : '',
            openaiModel: typeof old.openaiModel === 'string' ? old.openaiModel : 'gpt-4o',
            anthropicModel: DEFAULT_ANTHROPIC_MODEL,
            effort: 'max',
          };
        }
        // v4: Opus 5.5 is the default again (v3 briefly defaulted to Fable 5.1).
        if (version < 4 && (old.anthropicModel === 'claude-fable-5-1' || !old.anthropicModel)) {
          return { ...old, anthropicModel: DEFAULT_ANTHROPIC_MODEL };
        }
        return old;
      },
    }
  )
);

export function activeCredentials(s: SettingsStore): { apiKey: string; model: string } {
  return s.provider === 'anthropic'
    ? { apiKey: s.anthropicApiKey, model: s.anthropicModel }
    : { apiKey: s.openaiApiKey, model: s.openaiModel };
}
