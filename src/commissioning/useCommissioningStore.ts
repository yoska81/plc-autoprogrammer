import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanRecord, signRefused, type CommRecord, type CommResult, type CommSignoff } from './checklist';
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
   * Signs. Refused while any result is a failure, or an item that failed and was dismissed while removed
   * is back in the checklist without passing since. A valid signature it replaces is kept on the record.
   * True when stored.
   *
   * currentIds: the ids of the checklist as it is now. The checklist is made from the project (I/O list,
   * program, safety functions, alarms: commissioningItems(collectProject())), which this store does not
   * own, so the caller passes it; the page passes the same items it shows and checks with signBlock.
   */
  sign: (projectId: string | null, signoff: CommSignoff, currentIds: string[]) => boolean;
  /** Removes the signature, on the record (who removed it: required). True when removed. */
  unsign: (projectId: string | null, by: string) => boolean;
  /**
   * Dismisses the failed result of an item no longer in the checklist, on the record (who: required).
   * Refused for an item still in the checklist (currentIds, as for sign), a result that is not a failure,
   * or no name.
   */
  dismiss: (projectId: string | null, itemId: string, currentIds: string[], by: string) => boolean;
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
        sign: (projectId, signoff, currentIds) => {
          const rec = recOf(projectId);
          if (!signoff.name.trim() || signRefused(currentIds, rec)) return false;
          // a valid signature it replaces stays on the record
          const was = rec.signoff;
          const voided = was ? [...(rec.voided ?? []), { signoff: was, reason: 'replaced' as const, voidedAt: nowStamp(), voidedBy: signoff.name }] : rec.voided;
          // no empty keys (drawn: undefined): the record is the same after a project file save and open
          const stored: CommSignoff = { name: signoff.name, company: signoff.company, signature: signoff.signature, date: signoff.date, ...(signoff.drawn ? { drawn: signoff.drawn } : {}) };
          put(projectId, { ...rec, signoff: stored, ...(voided ? { voided } : {}) });
          return true;
        },
        unsign: (projectId, by) => {
          const rec = recOf(projectId);
          if (!rec.signoff || !by.trim()) return false;
          put(projectId, { ...rec, signoff: null, voided: [...(rec.voided ?? []), { signoff: rec.signoff, reason: 'removed', voidedAt: nowStamp(), voidedBy: by.trim() }] });
          return true;
        },
        dismiss: (projectId, itemId, currentIds, by) => {
          const rec = recOf(projectId);
          const result = rec.results[itemId];
          if (!by.trim() || currentIds.includes(itemId) || result?.status !== 'fail') return false;
          const results = { ...rec.results };
          delete results[itemId];
          put(projectId, { ...rec, results, dismissed: [...(rec.dismissed ?? []), { itemId, result, at: nowStamp(), by: by.trim() }] });
          return true;
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
