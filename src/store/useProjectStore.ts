import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EquipmentRecommendation } from '../lib/ai/equipmentAI';

interface ProjectStore {
  /** Selected PLC profile id (see src/plc/profiles). */
  plcId: string;
  cpuId: string;
  setPlc: (plcId: string, cpuId: string) => void;
  /** Expansion module part numbers in slot order (slot 1 first). */
  modules: string[];
  setModules: (modules: string[]) => void;
  /** Last AI equipment recommendation (kept so the reasons stay visible). */
  recommendation: EquipmentRecommendation | null;
  setRecommendation: (r: EquipmentRecommendation | null) => void;
  /** Project data shown on drawings and reports. */
  info: ProjectInfo;
  setInfo: (info: Partial<ProjectInfo>) => void;
}

/** Electrical code region: US (NEC / UL 508A) or Canada (CEC / CSA C22.2 No. 14). */
export type Region = 'US' | 'Canada';

export interface ProjectInfo {
  region: Region;
  customer: string;
  site: string;
  drawingPrefix: string;
  standards: string[];
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      plcId: 'click',
      cpuId: '',
      setPlc: (plcId, cpuId) => set({ plcId, cpuId }),
      modules: [],
      setModules: (modules) => set({ modules }),
      recommendation: null,
      setRecommendation: (recommendation) => set({ recommendation }),
      info: { region: 'US', customer: '', site: '', drawingPrefix: '', standards: ['NFPA 79', 'UL 508A'] },
      setInfo: (info) => set((s) => ({ info: { ...s.info, ...info } })),
    }),
    { name: 'plc-project-store' }
  )
);
