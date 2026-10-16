import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback, useRef } from 'react';

/**
 * Work in progress that belongs to the project: text typed but not yet sent (spec additions,
 * answers, chat questions) and choices not yet applied. Part of the project data (saved per
 * project, in backups and in .isap files), so nothing typed is lost when the user moves to
 * another page, reloads or switches projects.
 */
interface DraftStore {
  drafts: Record<string, unknown>;
  setDraft: (key: string, value: unknown) => void;
  clearDraft: (key: string) => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, value) => set((s) => ({ drafts: { ...s.drafts, [key]: value } })),
      clearDraft: (key) => set((s) => {
        const drafts = { ...s.drafts };
        delete drafts[key];
        return { drafts };
      }),
    }),
    { name: 'plc-draft-store', partialize: (s) => ({ drafts: s.drafts }) },
  ),
);

type SetState<T> = (v: T | ((prev: T) => T)) => void;

/** useState that survives navigation, reloads and project switches (stored with the project). */
export function useDraft<T>(key: string, init: T): [T, SetState<T>] {
  // A stable initial value: a fresh [] / {} each render would look like a store change.
  const initial = useRef(init).current;
  const value = useDraftStore((s) => (key in s.drafts ? (s.drafts[key] as T) : initial));
  const set = useCallback<SetState<T>>((v) => {
    const { drafts, setDraft } = useDraftStore.getState();
    const prev = (key in drafts ? drafts[key] : initial) as T;
    setDraft(key, typeof v === 'function' ? (v as (p: T) => T)(prev) : v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, set];
}
