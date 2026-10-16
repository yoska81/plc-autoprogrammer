/**
 * Marks the open project "changed since last save" whenever its data changes.
 * Loading / switching projects and derived data (stage status, automatic review) don't count.
 */
import { isProjectLoading, PROJECT_STORE_LIST, useProjectsStore } from '../store/useProjectsStore';
import { useLayoutStore } from '../electrical/layout/useLayoutStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { useCheckoutStore } from '../online/useCheckoutStore';
import { useLabelSetupStore } from '../electrical/labels/setup';
import { useFileStore } from './useFileStore';

// Recomputed from the data, not edited by the user.
const DERIVED = new Set(['stages', 'review']);

type AnyStore = { subscribe: (fn: (s: unknown, p: unknown) => void) => () => void; persist?: { getOptions: () => { partialize?: (s: never) => unknown } } };

function changed(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return true;
  const ka = Object.keys(a as object);
  if (ka.length !== Object.keys(b as object).length) return true;
  return ka.some((k) => (a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]);
}

let installed = false;

export function installDirtyTracking(): void {
  if (installed) return;
  installed = true;
  const mark = () => {
    if (isProjectLoading()) return;
    const id = useProjectsStore.getState().activeId;
    if (id) useFileStore.getState().markDirty(id);
  };
  for (const { key, store } of PROJECT_STORE_LIST) {
    if (DERIVED.has(key)) continue;
    const st = store as unknown as AnyStore;
    const part = st.persist?.getOptions().partialize;
    st.subscribe((s, p) => {
      const a = part ? part(s as never) : s;
      const b = part ? part(p as never) : p;
      if (changed(a, b)) mark();
    });
  }
  const perProject = [useLayoutStore, useQuestionStore, useCheckoutStore, useLabelSetupStore] as unknown as { subscribe: (fn: (s: { byProject: Record<string, unknown> }, p: { byProject: Record<string, unknown> }) => void) => () => void }[];
  for (const st of perProject) {
    st.subscribe((s, p) => {
      const id = useProjectsStore.getState().activeId;
      if (!id) return;
      const k = id;
      if ((s.byProject[k] ?? s.byProject.default) !== (p.byProject[k] ?? p.byProject.default)) mark();
    });
  }
}
