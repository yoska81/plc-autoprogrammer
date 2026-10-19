import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appPersistStorage } from '../lib/appStorage';

/**
 * I/O check-out during commissioning: for each I/O point the technician
 * ticks that the field device and the PLC agree (input seen / output
 * worked), with name, date and a note. Saved per project; printed as the
 * I/O check-out sheet and summarised in the SAT checklist.
 */

export interface CheckoutEntry {
  verified: boolean;
  by: string;
  /** YYYY-MM-DD HH:MM */
  date: string;
  note: string;
  /** Value read from the PLC when ticked ("ON" / "OFF" / a number), for the record. */
  observed?: string;
}

interface CheckoutStore {
  byProject: Record<string, Record<string, CheckoutEntry>>;
  /** Technician name, remembered. */
  tech: string;
  setTech: (name: string) => void;
  set: (projectId: string | null, ioId: string, patch: Partial<CheckoutEntry>) => void;
  clear: (projectId: string | null) => void;
}

const key = (p: string | null) => p ?? 'default';
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export const useCheckoutStore = create<CheckoutStore>()(
  persist(
    (set) => ({
      byProject: {},
      tech: '',
      setTech: (tech) => set({ tech }),
      set: (projectId, ioId, patch) => set((s) => {
        const cur = s.byProject[key(projectId)]?.[ioId] ?? { verified: false, by: '', date: '', note: '' };
        const next = { ...cur, ...patch, ...(patch.verified !== undefined ? { date: now(), by: patch.by ?? (s.tech || cur.by) } : {}) };
        return { byProject: { ...s.byProject, [key(projectId)]: { ...(s.byProject[key(projectId)] ?? {}), [ioId]: next } } };
      }),
      clear: (projectId) => set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: {} } })),
    }),
    { name: 'isa-io-checkout', storage: appPersistStorage() },
  ),
);

export function checkoutFor(projectId: string | null): Record<string, CheckoutEntry> {
  return useCheckoutStore.getState().byProject[key(projectId)] ?? {};
}
