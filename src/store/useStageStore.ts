import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecSections } from '../spec/types';

export type StageId = 'spec' | 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';

/** What a stage was generated from, to tell when it is out of date. */
export interface StageSource {
  specFp: string;
  ioFp?: string;
  hmiFp?: string;
  /** Spec text at generation time, so updates can tell the AI exactly what changed. */
  spec: SpecSections;
  at: string;
}

interface StageStore {
  sources: Partial<Record<StageId, StageSource>>;
  markGenerated: (stage: StageId, source: Omit<StageSource, 'at'>) => void;
}

export const useStageStore = create<StageStore>()(
  persist(
    (set) => ({
      sources: {},
      markGenerated: (stage, source) =>
        set((s) => ({ sources: { ...s.sources, [stage]: { ...source, at: new Date().toISOString() } } })),
    }),
    { name: 'plc-stage-store' }
  )
);
