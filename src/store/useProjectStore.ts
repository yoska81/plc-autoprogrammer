import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizePreference, type VendorPreference } from '../electrical/catalogs';
import type { EquipmentRecommendation } from '../lib/ai/equipmentAI';

interface ProjectStore {
  /** Selected PLC profile id (see src/plc/core/profiles). */
  plcId: string;
  cpuId: string;
  setPlc: (plcId: string, cpuId: string) => void;
  /** Expansion module part numbers in slot order (slot 1 first). */
  /**
   * Version of the address layout the project's I/O is numbered with (IO_LAYOUT_VERSION is the current one).
   *   absent / 1  saved before a CLICK PLUS option-slot module became slot 0 (it was numbered as slot 1, X101…)
   *   2           the option-slot module is slot 0 (X001… / Y001…)
   * Older projects are migrated on load (src/plc/core/ioChange.ts migrateIoLayout).
   */
  ioLayoutVersion?: number;
  modules: string[];
  setModules: (modules: string[]) => void;
  /** Last AI equipment recommendation (kept so the reasons stay visible). */
  recommendation: EquipmentRecommendation | null;
  setRecommendation: (r: EquipmentRecommendation | null) => void;
  /** Project data shown on drawings and reports. */
  info: ProjectInfo;
  setInfo: (info: Partial<ProjectInfo>) => void;
}

/** Installation region: US (NEC / UL 508A), Canada (CEC / CSA C22.2 No. 14) or an IEC region (src/standards/regions.ts). */
export type { Region } from '../standards/regions';
import type { Region } from '../standards/regions';
import type { DrawingOptions } from '../standards/drawingOptions';

/** One line of the document revision history (drawings and documents share it). */
export interface Revision {
  rev: string;          // "A", "B", "0", "1"…
  date: string;         // ISO date YYYY-MM-DD
  description: string;  // "Issued for review", "Issued for construction"…
  by: string;           // initials
  /** Why it was issued despite open critical design review findings (construction override). */
  override?: string;
  /** What changed in this revision (redlines / field changes), one line each. */
  changes?: string[];
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
  /** Designations, symbols and sheet size; unset = the region's defaults. */
  drawing?: DrawingOptions;
  /** Preferred brands per equipment group ("customer standard"); AutomationDirect when absent. */
  vendors?: Partial<VendorPreference>;
  /** The user picked the PLC brand on the Brand preference card (an AutomationDirect pick is then a request, not the default). */
  plcChosen?: boolean;
  /** Makers whose "use them for panel parts too" offer the user turned down (Electrical page). */
  brandOfferDismissed?: string[];
}

/** The current I/O address layout (see ProjectStore.ioLayoutVersion). */
export const IO_LAYOUT_VERSION = 2;

export const DEFAULT_INFO: ProjectInfo = {
  region: 'US', customer: '', site: '', drawingPrefix: '', standards: ['NFPA 79', 'UL 508A'],
  projectNumber: '', company: 'ISA', preparedBy: '', checkedBy: '', approvedBy: '',
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
        const info = { ...DEFAULT_INFO, ...(p.info ?? {}) };
        return { ...current, ...p, info: { ...info, company: info.company || DEFAULT_INFO.company } };
      },
    }
  )
);

/** The project's preferred vendors per equipment group (non-React callers). */
export const vendorPreference = (): VendorPreference => normalizePreference(useProjectStore.getState().info.vendors);

/** The project's preferred vendors per equipment group. */
export function useVendorPreference(): VendorPreference {
  const v = useProjectStore((s) => s.info.vendors);
  return useMemo(() => normalizePreference(v), [v]);
}
