import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appPersistStorage } from '../lib/appStorage';

/**
 * Fault log: every guided fault finding that reached an answer, with the point, the symptom, what was found
 * and the fix, the date and the technician. Saved per project (and in the project file), so the next visit
 * to the machine starts from its history.
 */

export interface FaultLogEntry {
  id: string;
  /** YYYY-MM-DD HH:MM */
  date: string;
  by: string;
  address: string;
  description: string;
  /** The symptom in plain words ("never comes ON"). */
  symptom: string;
  found: string;
  fix: string;
  /** Wire number pointed at, when there is one. */
  wire?: string;
  /** Readings taken (steps answered yes / no; skipped steps not counted). */
  readings: number;
  /** True when the fault was a practice fault set in the simulator. */
  practice?: boolean;
  note?: string;
}

interface FaultLogStore {
  byProject: Record<string, FaultLogEntry[]>;
  /** Technician name, remembered. */
  tech: string;
  setTech: (name: string) => void;
  add: (projectId: string | null, e: Omit<FaultLogEntry, 'id' | 'date' | 'by'> & { by?: string }) => FaultLogEntry;
  update: (projectId: string | null, id: string, patch: Partial<FaultLogEntry>) => void;
  remove: (projectId: string | null, id: string) => void;
}

const key = (p: string | null) => p ?? 'default';
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export const useFaultLogStore = create<FaultLogStore>()(
  persist(
    (set, get) => ({
      byProject: {},
      tech: '',
      setTech: (tech) => set({ tech }),
      add: (projectId, e) => {
        const entry: FaultLogEntry = { ...e, id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: now(), by: e.by ?? get().tech };
        set((s) => ({ byProject: { ...s.byProject, [key(projectId)]: [entry, ...(s.byProject[key(projectId)] ?? [])] } }));
        return entry;
      },
      update: (projectId, id, patch) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) },
      })),
      remove: (projectId, id) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).filter((x) => x.id !== id) },
      })),
    }),
    { name: 'isa-fault-log', storage: appPersistStorage() },
  ),
);

const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** The log as CSV (newest first). */
export function faultLogCsv(entries: FaultLogEntry[]): string {
  const rows: (string | number)[][] = [['Date', 'By', 'Point', 'Description', 'Symptom', 'Found', 'Fix', 'Wire', 'Readings', 'Practice', 'Note']];
  for (const e of entries) rows.push([e.date, e.by, e.address, e.description, e.symptom, e.found, e.fix, e.wire ?? '', e.readings, e.practice ? 'yes' : '', e.note ?? '']);
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
