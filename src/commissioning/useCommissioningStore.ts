import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CommRecord, CommResult, CommSignoff } from './checklist';
import { notify } from '../store/useNoticeStore';

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
  /** Signs (or removes the signature); refused while any item has failed. True when stored. */
  sign: (projectId: string | null, signoff: CommSignoff | null) => boolean;
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
        // a failure recorded after the sign-off voids it: the signature no longer covers the results. It is kept
        // as a voided sign-off (who signed, when, when it was voided and by whom, which item failed) and the user is told.
        const voids = next.status === 'fail' && rec.signoff !== null;
        if (voids) notify(`The sign-off by ${rec.signoff!.name} (${rec.signoff!.date}) is void: a failure was recorded after it. Fix the item, test it again and sign again.`);
        const voided = voids ? [...(rec.voided ?? []), { signoff: rec.signoff!, voidedAt: next.date, voidedBy: next.by, itemId }] : rec.voided;
        return { byProject: { ...s.byProject, [key(projectId)]: { ...rec, signoff: voids ? null : rec.signoff, ...(voided ? { voided } : {}), results: { ...rec.results, [itemId]: next } } } };
      }),
      sign: (projectId, signoff) => {
        const rec = useCommissioningStore.getState().byProject[key(projectId)] ?? EMPTY;
        // removing a signature is always allowed; signing is not while an item has failed
        if (signoff && Object.values(rec.results).some((r) => r.status === 'fail')) return false;
        set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: { ...(s.byProject[key(projectId)] ?? EMPTY), signoff } } }));
        return true;
      },
      clear: (projectId) => set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: EMPTY } })),
    }),
    { name: 'isa-commissioning' },
  ),
);

export function commissioningFor(projectId: string | null): CommRecord {
  return useCommissioningStore.getState().byProject[key(projectId)] ?? EMPTY;
}
