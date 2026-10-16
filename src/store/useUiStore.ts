import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback, useRef } from 'react';
import { useProjectsStore } from './useProjectsStore';

/**
 * Where the user was on each page (selected tab, sheet, screen, block, zoom, filters), per
 * project, kept in this browser. Not project data: not in .isap files.
 */
interface UiStore {
  byProject: Record<string, Record<string, unknown>>;
  setUi: (project: string, key: string, value: unknown) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      byProject: {},
      setUi: (project, key, value) => set((s) => ({ byProject: { ...s.byProject, [project]: { ...s.byProject[project], [key]: value } } })),
    }),
    { name: 'plc-ui-store' },
  ),
);

type SetState<T> = (v: T | ((prev: T) => T)) => void;

/** useState for page UI state, remembered per project across navigation and reloads. */
export function useUi<T>(key: string, init: T): [T, SetState<T>] {
  // A stable initial value: a fresh [] / {} each render would look like a store change.
  const initial = useRef(init).current;
  const project = useProjectsStore((s) => s.activeId) ?? '_';
  const value = useUiStore((s) => {
    const p = s.byProject[project];
    return p && key in p ? (p[key] as T) : initial;
  });
  const set = useCallback<SetState<T>>((v) => {
    const { byProject, setUi } = useUiStore.getState();
    const p = byProject[project];
    const prev = (p && key in p ? p[key] : initial) as T;
    setUi(project, key, typeof v === 'function' ? (v as (q: T) => T)(prev) : v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, key]);
  return [value, set];
}
