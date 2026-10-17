import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mergeLibrary, type LibraryItem } from './library';

/** The standard-panel library: app-wide (every project sees it), kept in this browser / app storage. */
interface LibraryStore {
  items: LibraryItem[];
  add: (item: LibraryItem) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  /** Add imported items; returns how many were new. */
  importItems: (items: LibraryItem[]) => number;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      rename: (id, name) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, name } : i)) })),
      importItems: (incoming) => {
        const { items, added } = mergeLibrary(get().items, incoming);
        set({ items });
        return added;
      },
    }),
    { name: 'plc-panel-library' },
  ),
);
