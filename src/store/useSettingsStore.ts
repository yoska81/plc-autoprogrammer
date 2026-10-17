import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'anthropic' | 'openai';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
/** fast: each AI task thinks only as hard as it needs (src/lib/ai/tasks.ts); thorough: every task at the Settings effort. */
export type Speed = 'fast' | 'thorough';
/** How Update builds a stage: rules only (seconds), rules first then the AI's version, or the AI's version only. */
export type StageMode = 'quick' | 'quick-then-ai' | 'ai';
export type ModeStage = 'equipment' | 'electrical' | 'hmi' | 'program';
export const DEFAULT_STAGE_MODES: Record<ModeStage, StageMode> = { equipment: 'ai', electrical: 'quick-then-ai', hmi: 'quick-then-ai', program: 'quick-then-ai' };

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

export const ANTHROPIC_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — best (recommended)' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 — more capable, about 2.5× more expensive' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, cheaper' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, cheapest' },
];

export const SPEEDS: { value: Speed; label: string }[] = [
  { value: 'fast', label: 'Fast — each task thinks only as hard as it needs (recommended)' },
  { value: 'thorough', label: 'Thorough — every task at the thinking depth above (slow)' },
];

/** '' = the main model. Only small JSON tasks (HMI names, equipment choice) use it. */
export const SMALL_TASK_MODELS = [
  { value: '', label: 'Same as the main model' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest' },
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
  speed: Speed;
  setSpeed: (s: Speed) => void;
  /** Show the older all-AI generate buttons (Electrical, HMI, PLC program); off: one clear Generate path. */
  showExperimental: boolean;
  setShowExperimental: (on: boolean) => void;
  /** Model for the small tasks ('' = the main model). */
  smallTaskModel: string;
  setSmallTaskModel: (m: string) => void;
  stageModes: Record<ModeStage, StageMode>;
  setStageMode: (stage: ModeStage, mode: StageMode) => void;

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
      speed: 'fast',
      setSpeed: (speed) => set({ speed }),
      showExperimental: false,
      setShowExperimental: (showExperimental) => set({ showExperimental }),
      smallTaskModel: '',
      setSmallTaskModel: (smallTaskModel) => set({ smallTaskModel }),
      stageModes: DEFAULT_STAGE_MODES,
      setStageMode: (stage, mode) => set((s) => ({ stageModes: { ...s.stageModes, [stage]: mode } })),

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
