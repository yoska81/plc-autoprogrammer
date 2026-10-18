import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecSections } from '../spec/types';

export type StageId = 'spec' | 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';

/** What a stage was generated from, to tell when it is out of date. */
export interface StageSource {
  specFp: string;
  ioFp?: string;
  /** PLC, CPU and resolved I/O addresses at generation time (absent on stages made before it existed). */
  addrFp?: string;
  /** Installation region at generation time (codes, supply, colours: the electrical design depends on it). */
  region?: string;
  hmiFp?: string;
  /** Touch panel the HMI screens were laid out for (another panel only scales them). */
  panel?: string;
  /** Spec text at generation time, so updates can tell the AI exactly what changed. */
  spec: SpecSections;
  at: string;
}

// Fingerprint of the current PLC addresses, registered by src/spec/useStages.ts (keeps this store
// free of PLC imports). Every generated stage records it, so changing the PLC family, CPU or
// modules (which renumbers the I/O) puts the I/O-dependent stages out of date.
let addressFp: (() => string) | null = null;
let regionNow: (() => string) | null = null;
export const setAddressFingerprint = (fn: () => string, region?: () => string) => { addressFp = fn; regionNow = region ?? null; };

interface StageStore {
  sources: Partial<Record<StageId, StageSource>>;
  markGenerated: (stage: StageId, source: Omit<StageSource, 'at'>) => void;
}

export const useStageStore = create<StageStore>()(
  persist(
    (set) => ({
      sources: {},
      markGenerated: (stage, source) =>
        set((s) => ({ sources: { ...s.sources, [stage]: { ...(addressFp ? { addrFp: addressFp() } : {}), ...(regionNow ? { region: regionNow() } : {}), ...source, at: new Date().toISOString() } } })),
    }),
    { name: 'plc-stage-store' }
  )
);
