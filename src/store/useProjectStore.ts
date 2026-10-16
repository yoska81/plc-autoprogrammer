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

/** One line of the document revision history (drawings and documents share it). */
export interface Revision {
  rev: string;          // "A", "B", "0", "1"…
  date: string;         // ISO date YYYY-MM-DD
  description: string;  // "Issued for review", "Issued for construction"…
  by: string;           // initials
}

export interface ProjectInfo {
  region: Region;
  customer: string;
  site: string;
  /** Prefix of drawing / document numbers, e.g. "WCC" -> WCC-E01, WCC-FDS. */
  drawingPrefix: string;
  standards: string[];
  /** Customer or internal job number shown on every title block. */
  projectNumber: string;
  /** Company preparing the documents (title blocks, cover pages). */
  company: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  /** Oldest first; the last entry is the current revision. */
  revisions: Revision[];
}

export const DEFAULT_INFO: ProjectInfo = {
  region: 'US', customer: '', site: '', drawingPrefix: '', standards: ['NFPA 79', 'UL 508A'],
  projectNumber: '', company: '', preparedBy: '', checkedBy: '', approvedBy: '',
  revisions: [],
};

/** Current revision letter, or "A" before the first issue. */
export function currentRevision(info: Pick<ProjectInfo, 'revisions'>): Revision {
  return info.revisions?.[info.revisions.length - 1] ?? { rev: 'A', date: new Date().toISOString().slice(0, 10), description: 'Preliminary — issued for review', by: '' };
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
      info: DEFAULT_INFO,
      setInfo: (info) => set((s) => ({ info: { ...s.info, ...info } })),
    }),
    {
      name: 'plc-project-store',
      // Older projects stored fewer project-data fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProjectStore>;
        return { ...current, ...p, info: { ...DEFAULT_INFO, ...(p.info ?? {}) } };
      },
    }
  )
);
