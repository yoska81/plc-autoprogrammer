import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  model: string;
  setModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      anthropicApiKey: '',
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
      model: 'claude-sonnet-4-6',
      setModel: (model) => set({ model }),
    }),
    { name: 'plc-settings-store' }
  )
);
