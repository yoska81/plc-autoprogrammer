import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CommRecord, CommResult, CommSignoff } from './checklist';

/**
 * The commissioning checklist as ticked on site: per item pass / fail / N/A with a note, name
 * and date, and the sign-off. Saved per project (by project id) and in the project file, like
 * the I/O check-out.
 */

interface CommissioningStore {
  byProject: Record<string, CommRecord>;
  /** Technician name, remembered. */
  tech: string;
  setTech: (name: string) => void;
  setResult: (projectId: string | null, itemId: string, patch: Partial<CommResult>) => void;
  sign: (projectId: string | null, signoff: CommSignoff | null) => void;
  clear: (projectId: string | null) => void;
}

const key = (p: string | null) => p ?? 'default';
export const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const EMPTY: CommRecord = { results: {}, signoff: null };

export const useCommissioningStore = create<CommissioningStore>()(
  persist(
    (set) => ({
      byProject: {},
      tech: '',
      setTech: (tech) => set({ tech }),
      setResult: (projectId, itemId, patch) => set((s) => {
        const rec = s.byProject[key(projectId)] ?? EMPTY;
        const cur = rec.results[itemId] ?? { note: '', by: '', date: '' };
        // Ticking (or changing the result) records who and when; a note alone keeps them.
        const next: CommResult = { ...cur, ...patch, ...('status' in patch ? { date: nowStamp(), by: patch.by ?? (s.tech || cur.by) } : {}) };
        if (!next.status) delete next.status;
        return { byProject: { ...s.byProject, [key(projectId)]: { ...rec, results: { ...rec.results, [itemId]: next } } } };
      }),
      sign: (projectId, signoff) => set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: { ...(s.byProject[key(projectId)] ?? EMPTY), signoff } } })),
      clear: (projectId) => set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: EMPTY } })),
    }),
    { name: 'isa-commissioning' },
  ),
);

export function commissioningFor(projectId: string | null): CommRecord {
  return useCommissioningStore.getState().byProject[key(projectId)] ?? EMPTY;
}
