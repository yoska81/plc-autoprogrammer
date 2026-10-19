import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HmiDesign, HmiElement } from '../hmi/types';
import { keepAlarmTexts } from '../edits/hmiTexts';

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
      // Alarm messages the user rewrote stay through regenerations.
      // A design made without a panel part number (QA: a rules-built KTP700 design drew NaN) is the project's panel.
      setDesign: (design, explanation) => set((s) => ({ design: keepAlarmTexts(design && !design.hmiPartNumber?.trim() && s.hmiPartNumber ? { ...design, hmiPartNumber: s.hmiPartNumber } : design), explanation })),
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
