import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProjectsStore } from '../../store/useProjectsStore';
import { EMPTY_LAYOUT, type MachineLayout } from './types';

interface LayoutStore {
  /** Machine layout of each project, by project id. */
  byProject: Record<string, MachineLayout>;
  update: (projectId: string, fn: (l: MachineLayout) => MachineLayout) => void;
  clear: (projectId: string) => void;
}

/** Machine layouts, stored per project (the background picture is kept small: see MachineLayoutPanel). */
export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      byProject: {},
      update: (projectId, fn) => set((s) => ({ byProject: { ...s.byProject, [projectId]: fn(s.byProject[projectId] ?? EMPTY_LAYOUT) } })),
      clear: (projectId) => set((s) => { const next = { ...s.byProject }; delete next[projectId]; return { byProject: next }; }),
    }),
    {
      name: 'isa-machine-layout',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutStore>;
        return { ...current, byProject: Object.fromEntries(Object.entries(p.byProject ?? {}).map(([k, v]) => [k, { ...EMPTY_LAYOUT, ...v }])) };
      },
    },
  ),
);

/** Layout of a project (non-React callers, e.g. the deliverables). */
export function layoutFor(projectId: string | null): MachineLayout | undefined {
  return projectId ? useLayoutStore.getState().byProject[projectId] : undefined;
}

/** Layout of the open project and an updater. */
export function useMachineLayout(): [MachineLayout, (fn: (l: MachineLayout) => MachineLayout) => void, string | null] {
  const projectId = useProjectsStore((s) => s.activeId);
  const layout = useLayoutStore((s) => (projectId ? s.byProject[projectId] : undefined)) ?? EMPTY_LAYOUT;
  const update = useLayoutStore((s) => s.update);
  return [layout, (fn) => { if (projectId) update(projectId, fn); }, projectId];
}
