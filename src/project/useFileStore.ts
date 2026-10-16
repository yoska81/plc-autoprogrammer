import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where each project was last saved as a file, and whether it changed since. */
export interface ProjectFileInfo {
  /** File name of the last save / open (e.g. "Conveyor_Cell.isap"). */
  name?: string;
  /** Full path in the Windows app (Save writes back here without asking). */
  path?: string;
  /** Changed since the last save or open. */
  dirty: boolean;
  savedAt?: string;
}

interface FileStore {
  byProject: Record<string, ProjectFileInfo>;
  markDirty: (projectId: string) => void;
  markSaved: (projectId: string, file: { name?: string; path?: string }) => void;
}

export const useFileStore = create<FileStore>()(
  persist(
    (set) => ({
      byProject: {},
      markDirty: (id) => set((s) => (s.byProject[id]?.dirty ? s : { byProject: { ...s.byProject, [id]: { ...s.byProject[id], dirty: true } } })),
      markSaved: (id, file) => set((s) => ({
        byProject: { ...s.byProject, [id]: { ...s.byProject[id], ...file, dirty: false, savedAt: new Date().toISOString() } },
      })),
    }),
    { name: 'isa-project-files' },
  ),
);
