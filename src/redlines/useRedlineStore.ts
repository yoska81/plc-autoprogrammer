import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Redline } from './fieldChange';

/** Redlines and field changes of each project (by project id; also saved in the project file). */
interface RedlineStore {
  byProject: Record<string, Redline[]>;
  add: (projectId: string | null, r: Omit<Redline, 'id' | 'status' | 'date'>) => void;
  update: (projectId: string | null, id: string, patch: Partial<Redline>) => void;
  remove: (projectId: string | null, id: string) => void;
}

const key = (p: string | null) => p ?? 'default';
export const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
let seq = 0;

export const useRedlineStore = create<RedlineStore>()(
  persist(
    (set) => ({
      byProject: {},
      add: (projectId, r) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: [...(s.byProject[key(projectId)] ?? []), { ...r, id: `rl-${Date.now().toString(36)}-${(seq++).toString(36)}`, status: 'open', date: stamp() }] },
      })),
      update: (projectId, id, patch) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) },
      })),
      remove: (projectId, id) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).filter((r) => r.id !== id) },
      })),
    }),
    { name: 'isa-redlines' },
  ),
);

const NONE: Redline[] = [];
export function redlinesFor(projectId: string | null): Redline[] {
  return useRedlineStore.getState().byProject[key(projectId)] ?? NONE;
}
export function useRedlines(projectId: string | null): Redline[] {
  return useRedlineStore((s) => s.byProject[key(projectId)] ?? NONE);
}
