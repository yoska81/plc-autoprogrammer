import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'anthropic' | 'openai';

export const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (Best quality)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
];

export const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
  { value: 'o3', label: 'o3 (Deep reasoning)' },
  { value: 'o4-mini', label: 'o4-mini (Fast reasoning)' },
];

interface SettingsStore {
  provider: AIProvider;
  setProvider: (p: AIProvider) => void;

  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  anthropicModel: string;
  setAnthropicModel: (model: string) => void;

  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  openaiModel: string;
  setOpenaiModel: (model: string) => void;

  // Extended thinking (Anthropic only)
  extendedThinking: boolean;
  setExtendedThinking: (v: boolean) => void;
  thinkingBudget: number;
  setThinkingBudget: (n: number) => void;

  // Convenience getters
  activeApiKey: () => string;
  activeModel: () => string;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      provider: 'anthropic',
      setProvider: (provider) => set({ provider }),

      anthropicApiKey: '',
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
      anthropicModel: 'claude-sonnet-4-6',
      setAnthropicModel: (model) => set({ anthropicModel: model }),

      openaiApiKey: '',
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      openaiModel: 'gpt-4o',
      setOpenaiModel: (model) => set({ openaiModel: model }),

      extendedThinking: false,
      setExtendedThinking: (v) => set({ extendedThinking: v }),
      thinkingBudget: 10000,
      setThinkingBudget: (n) => set({ thinkingBudget: n }),

      activeApiKey: () => {
        const s = get();
        return s.provider === 'anthropic' ? s.anthropicApiKey : s.openaiApiKey;
      },
      activeModel: () => {
        const s = get();
        return s.provider === 'anthropic' ? s.anthropicModel : s.openaiModel;
      },
    }),
    { name: 'plc-settings-store' }
  )
);
