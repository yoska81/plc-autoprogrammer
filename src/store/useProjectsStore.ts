import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSpecStore } from './useSpecStore';
import { useIOStore } from './useIOStore';
import { DEFAULT_INFO, useProjectStore } from './useProjectStore';
import { useProgramStore } from './useProgramStore';
import { useElectricalStore } from './useElectricalStore';
import { useHmiStore } from './useHmiStore';
import { useStageStore } from './useStageStore';
import { aiBusy } from '../lib/ai/busy';
import { notify } from './useNoticeStore';

/**
 * Several projects in one browser. The per-stage stores always hold the
 * ACTIVE project; switching saves their persisted state under the old
 * project's key and loads the other project's saved state into them.
 */

// Stores that make up one project (settings/API keys are global, not per project).
const PROJECT_STORES = {
  spec: useSpecStore,
  io: useIOStore,
  plc: useProjectStore,
  program: useProgramStore,
  electrical: useElectricalStore,
  hmi: useHmiStore,
  stages: useStageStore,
} as const;

type StoreKey = keyof typeof PROJECT_STORES;
type Snapshot = Partial<Record<StoreKey, unknown>>;

const dataKey = (id: string) => `plc-project-data:${id}`;

function snapshot(): Snapshot {
  const out: Snapshot = {};
  for (const [key, store] of Object.entries(PROJECT_STORES) as [StoreKey, (typeof PROJECT_STORES)[StoreKey]][]) {
    const partialize = store.persist.getOptions().partialize;
    const state = store.getState();
    out[key] = partialize ? partialize(state as never) : state;
  }
  return out;
}

function load(data: Snapshot | null) {
  for (const [key, store] of Object.entries(PROJECT_STORES) as [StoreKey, (typeof PROJECT_STORES)[StoreKey]][]) {
    // Start from the store's defaults so nothing leaks from the previous project.
    const initial = store.getInitialState();
    (store.setState as (s: unknown, replace: true) => void)({ ...initial, ...((data?.[key] as object) ?? {}) }, true);
  }
  // Projects saved before newer project-data fields existed.
  const info = useProjectStore.getState().info;
  useProjectStore.setState({ info: { ...DEFAULT_INFO, ...info, company: info.company || DEFAULT_INFO.company } });
}

function save(id: string) {
  try {
    localStorage.setItem(dataKey(id), JSON.stringify(snapshot()));
  } catch {
    // Storage full or blocked; the active project still lives in the stores.
  }
}

function read(id: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(dataKey(id));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export interface ProjectEntry {
  id: string;
  name: string;
  createdAt: string;
}

interface ProjectsStore {
  projects: ProjectEntry[];
  activeId: string | null;
  /** Make sure the project currently in the stores is registered. */
  ensureActive: () => void;
  /** False when the project could not be created (an AI request is still running). */
  createProject: (name: string) => boolean;
  openProject: (id: string) => void;
  renameActive: (name: string) => void;
  deleteProject: (id: string) => void;
}

/** An AI answer still on its way would land in whichever project is open when it arrives. */
function blockedByAi(): boolean {
  if (!aiBusy()) return false;
  notify('The AI is still working on this project. Wait until it finishes, then switch projects.');
  return true;
}

const newId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      ensureActive: () => {
        if (get().activeId) return;
        const id = newId();
        set({ projects: [{ id, name: useProgramStore.getState().projectName, createdAt: new Date().toISOString() }], activeId: id });
      },
      createProject: (name) => {
        if (blockedByAi()) return false;
        const { activeId } = get();
        if (activeId) save(activeId);
        load(null);
        useProgramStore.getState().setProjectName(name);
        const id = newId();
        set((s) => ({ projects: [...s.projects, { id, name, createdAt: new Date().toISOString() }], activeId: id }));
        return true;
      },
      openProject: (id) => {
        const { activeId } = get();
        if (id === activeId || blockedByAi()) return;
        if (activeId) save(activeId);
        load(read(id));
        set({ activeId: id });
      },
      renameActive: (name) => {
        useProgramStore.getState().setProjectName(name);
        set((s) => ({ projects: s.projects.map((p) => (p.id === s.activeId ? { ...p, name } : p)) }));
      },
      deleteProject: (id) => {
        const { activeId, projects } = get();
        if (id === activeId) return; // can't delete the open project
        try { localStorage.removeItem(dataKey(id)); } catch { /* ignore */ }
        set({ projects: projects.filter((p) => p.id !== id) });
      },
    }),
    { name: 'plc-projects' }
  )
);
