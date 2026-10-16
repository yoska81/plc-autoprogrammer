import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HmiDesign, HmiElement } from '../hmi/types';

interface HmiStore {
  /** Chosen HMI part number (before or after a design exists). */
  hmiPartNumber: string;
  setHmiPartNumber: (pn: string) => void;
  design: HmiDesign | null;
  explanation: string | null;
  setDesign: (d: HmiDesign | null, explanation: string | null) => void;
  updateElement: (screenId: string, el: HmiElement) => void;
  removeElement: (screenId: string, elementId: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

export const useHmiStore = create<HmiStore>()(
  persist(
    (set) => ({
      hmiPartNumber: '',
      setHmiPartNumber: (hmiPartNumber) => set({ hmiPartNumber }),
      design: null,
      explanation: null,
      setDesign: (design, explanation) => set({ design, explanation }),
      updateElement: (screenId, el) =>
        set((s) => (s.design ? {
          design: { ...s.design, screens: s.design.screens.map((sc) => (sc.id === screenId ? { ...sc, elements: sc.elements.map((e) => (e.id === el.id ? el : e)) } : sc)) },
        } : {})),
      removeElement: (screenId, elementId) =>
        set((s) => (s.design ? {
          design: { ...s.design, screens: s.design.screens.map((sc) => (sc.id === screenId ? { ...sc, elements: sc.elements.filter((e) => e.id !== elementId) } : sc)) },
        } : {})),
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
    }),
    {
      name: 'plc-hmi-store',
      partialize: (s) => ({ hmiPartNumber: s.hmiPartNumber, design: s.design, explanation: s.explanation }),
    }
  )
);
