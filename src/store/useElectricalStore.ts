import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DesignComponent, DesignInputs, ElectricalDesign, IOWiring } from '../electrical/types';
import { appPersistStorage } from '../lib/appStorage';

export const DEFAULT_INPUTS: DesignInputs = {
  supply: '480VAC-3PH',
  enclosureRating: 'NEMA 12',
  notes: '',
  motors: [],
  requiredParts: [],
};

interface ElectricalStore {
  inputs: DesignInputs;
  setInputs: (inputs: DesignInputs) => void;
  design: ElectricalDesign | null;
  /** Where the current design came from. */
  source: 'generated' | 'imported' | null;
  /** AI explanation of the last generation. */
  explanation: string | null;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  setDesign: (design: ElectricalDesign, source: 'generated' | 'imported', explanation: string | null) => void;
  updateComponent: (index: number, c: DesignComponent) => void;
  removeComponent: (index: number) => void;
  addComponent: (c: DesignComponent) => void;
  updateWiring: (index: number, w: IOWiring) => void;
  clearDesign: () => void;
}

const mapDesign = (s: ElectricalStore, fn: (d: ElectricalDesign) => ElectricalDesign) =>
  s.design ? { design: fn(s.design) } : {};

export const useElectricalStore = create<ElectricalStore>()(
  persist(
    (set) => ({
      inputs: DEFAULT_INPUTS,
      setInputs: (inputs) => set({ inputs }),
      design: null,
      source: null,
      explanation: null,
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setDesign: (design, source, explanation) => set({ design, source, explanation }),
      updateComponent: (i, c) => set((s) => mapDesign(s, (d) => ({ ...d, components: d.components.map((x, j) => (j === i ? c : x)) }))),
      removeComponent: (i) => set((s) => mapDesign(s, (d) => ({ ...d, components: d.components.filter((_, j) => j !== i) }))),
      addComponent: (c) => set((s) => mapDesign(s, (d) => ({ ...d, components: [...d.components, c] }))),
      updateWiring: (i, w) => set((s) => mapDesign(s, (d) => ({ ...d, ioWiring: d.ioWiring.map((x, j) => (j === i ? w : x)) }))),
      clearDesign: () => set({ design: null, source: null, explanation: null }),
    }),
    {
      name: 'plc-electrical-store',
      storage: appPersistStorage(),
      partialize: (s) => ({ inputs: s.inputs, design: s.design, source: s.source, explanation: s.explanation }),
    }
  )
);
