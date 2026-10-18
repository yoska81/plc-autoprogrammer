import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanRecord, type CommRecord, type CommResult, type CommSignoff } from './checklist';
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
  /**
   * Signs, or removes the signature (null). Signing is refused while any result is a failure; a
   * signature removed or replaced by a new one is kept on the record. True when stored.
   */
  sign: (projectId: string | null, signoff: CommSignoff | null) => boolean;
  /** Dismisses the result of an item no longer in the checklist, on the record. */
  dismiss: (projectId: string | null, itemId: string) => void;
  clear: (projectId: string | null) => void;
}

const key = (p: string | null) => p ?? 'default';

/** What browser storage holds, merged into the store: records saved by an older version, or edited by hand, are cleaned. */
export function mergeStored<S extends Pick<CommissioningStore, 'byProject' | 'tech'>>(persisted: unknown, current: S): S {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<CommissioningStore>;
  const byProject = Object.fromEntries(Object.entries(p.byProject && typeof p.byProject === 'object' ? p.byProject : {}).map(([k, r]) => [k, cleanRecord(r)]));
  return { ...current, tech: typeof p.tech === 'string' ? p.tech : current.tech, byProject };
}
export const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const EMPTY: CommRecord = { results: {}, signoff: null };

export const useCommissioningStore = create<CommissioningStore>()(
  persist(
    (set, get) => {
      const recOf = (projectId: string | null) => get().byProject[key(projectId)] ?? EMPTY;
      const put = (projectId: string | null, rec: CommRecord) => set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: rec } }));
      return {
        byProject: {},
        tech: '',
        setTech: (tech) => set({ tech }),
        setResult: (projectId, itemId, patch) => {
          const rec = recOf(projectId);
          const cur = rec.results[itemId] ?? { note: '', by: '', date: '' };
          // Ticking (or changing the result) records who and when; a note alone keeps them.
          const next: CommResult = { ...cur, ...patch, ...('status' in patch ? { date: nowStamp(), by: patch.by ?? (get().tech || cur.by) } : {}) };
          if (!next.status) delete next.status;
          // a failure recorded after the sign-off voids it: the signature no longer covers the results. It is kept
          // as a voided sign-off (who signed, when, when it was voided and by whom, which item failed) and the user is told.
          const was = rec.signoff;
          const voids = next.status === 'fail' && was !== null;
          put(projectId, {
            ...rec, results: { ...rec.results, [itemId]: next },
            ...(voids ? { signoff: null, voided: [...(rec.voided ?? []), { signoff: was, reason: 'failed', voidedAt: next.date, voidedBy: next.by, itemId }] } : {}),
          });
          if (voids) notify(`The sign-off by ${was.name} (${was.date}) is void: a failure was recorded after it. Fix the item, test it again and sign again.`);
        },
        sign: (projectId, signoff) => {
          const rec = recOf(projectId);
          // removing a signature is always allowed; signing is not while any result is a failure
          if (signoff && Object.values(rec.results).some((r) => r.status === 'fail')) return false;
          // the signature it removes or replaces stays on the record
          const was = rec.signoff;
          const voided = was ? [...(rec.voided ?? []), { signoff: was, reason: signoff ? 'replaced' as const : 'removed' as const, voidedAt: nowStamp(), voidedBy: signoff?.name ?? get().tech }] : rec.voided;
          put(projectId, { ...rec, signoff, ...(voided ? { voided } : {}) });
          return true;
        },
        dismiss: (projectId, itemId) => {
          const rec = recOf(projectId);
          const result = rec.results[itemId];
          if (!result) return;
          const results = { ...rec.results };
          delete results[itemId];
          put(projectId, { ...rec, results, dismissed: [...(rec.dismissed ?? []), { itemId, result, at: nowStamp(), by: get().tech }] });
        },
        clear: (projectId) => put(projectId, EMPTY),
      };
    },
    {
      name: 'isa-commissioning',
      merge: mergeStored,
    },
  ),
);

export function commissioningFor(projectId: string | null): CommRecord {
  return useCommissioningStore.getState().byProject[key(projectId)] ?? EMPTY;
}
