import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSpecStore } from './useSpecStore';
import { useIOStore } from './useIOStore';
import { DEFAULT_INFO, useProjectStore } from './useProjectStore';
import { useProgramStore } from './useProgramStore';
import { useElectricalStore } from './useElectricalStore';
import { useHmiStore } from './useHmiStore';
import { useReviewStore } from '../review/useReviewStore';
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
  review: useReviewStore,
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

// True while a project's data is being loaded into the stores (not a user change).
let loadingProject = false;
let derivedDepth = 0;
export const isProjectLoading = () => loadingProject || derivedDepth > 0;

/** Run a write that only recomputes data from other data (not a user change: no "unsaved changes"). */
export function runDerived(fn: () => void): void {
  derivedDepth++;
  try { fn(); } finally { derivedDepth--; }
}

/** The stores that hold the open project's own data (for change tracking). */
export const PROJECT_STORE_LIST = Object.entries(PROJECT_STORES).map(([key, store]) => ({ key, store }));

function load(data: Snapshot | null) {
  loadingProject = true;
  try { loadInto(data); } finally { loadingProject = false; }
}

function loadInto(data: Snapshot | null) {
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

// ---------------------------------------------------------------------------
// Safety net: backups and recovery of work saved in this browser.

const BACKUP_PREFIX = 'plc-backup:';
const MAX_BACKUPS = 15;

/** Save the open project's data under its own key (as switching does). */
export function saveActiveProject(): void {
  const { activeId } = useProjectsStore.getState();
  if (activeId) save(activeId);
}

/** Copy of the open project, kept before anything is written over the stores. */
export function backupActiveProject(reason: string): void {
  const { activeId, projects } = useProjectsStore.getState();
  const name = projects.find((p) => p.id === activeId)?.name ?? useProgramStore.getState().projectName;
  try {
    const at = new Date().toISOString();
    localStorage.setItem(`${BACKUP_PREFIX}${at}`, JSON.stringify({ name, at, reason, projectId: activeId, data: snapshot() }));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(BACKUP_PREFIX)).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_BACKUPS))) localStorage.removeItem(k);
  } catch {
    // storage full or blocked: nothing more we can do here
  }
}

/** Write the current stores as the saved data of project `id`, then load project `restoreId` back. */
export function storeStateAs(id: string, restoreId: string | null): void {
  save(id);
  if (restoreId) load(read(restoreId));
}

export interface SavedWork {
  key: string;
  kind: 'project' | 'backup';
  name: string;
  at: string | null;
  reason: string | null;
  io: number;
  rungs: number;
  spec: string;
  open: boolean;
}

function summarise(data: Snapshot): Pick<SavedWork, 'io' | 'rungs' | 'spec'> {
  const io = (data.io as { projectIO?: unknown[] } | undefined)?.projectIO?.length ?? 0;
  const rungs = (data.program as { ladder?: { rungs?: unknown[] } } | undefined)?.ladder?.rungs?.length ?? 0;
  const sections = (data.spec as { sections?: Record<string, string> } | undefined)?.sections ?? {};
  const spec = Object.values(sections).find((t) => t?.trim())?.trim().slice(0, 140) ?? '';
  return { io, rungs, spec };
}

/** Every project copy and backup saved in this browser, newest first. */
export function listSavedWork(): SavedWork[] {
  const { projects, activeId } = useProjectsStore.getState();
  const out: SavedWork[] = [];
  let keys: string[];
  try { keys = Object.keys(localStorage); } catch { return out; }
  for (const k of keys) {
    try {
      if (k.startsWith('plc-project-data:')) {
        const id = k.slice('plc-project-data:'.length);
        const data = JSON.parse(localStorage.getItem(k) ?? 'null') as Snapshot | null;
        if (!data) continue;
        const name = projects.find((p) => p.id === id)?.name ?? (data.program as { projectName?: string } | undefined)?.projectName ?? 'Unnamed project';
        out.push({ key: k, kind: 'project', name, at: null, reason: id === activeId ? 'Last saved copy of the open project' : null, open: id === activeId, ...summarise(data) });
      } else if (k.startsWith(BACKUP_PREFIX)) {
        const b = JSON.parse(localStorage.getItem(k) ?? 'null') as { name: string; at: string; reason: string; data: Snapshot } | null;
        if (!b) continue;
        out.push({ key: k, kind: 'backup', name: b.name, at: b.at, reason: b.reason, open: false, ...summarise(b.data) });
      }
    } catch {
      // unreadable entry: skip
    }
  }
  return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

/** Open a saved copy or backup as a NEW project (nothing existing is overwritten). */
export function restoreAsNewProject(key: string, name: string): boolean {
  let data: Snapshot | null;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Snapshot | { data: Snapshot } | null;
    data = raw && 'data' in raw && key.startsWith(BACKUP_PREFIX) ? (raw as { data: Snapshot }).data : (raw as Snapshot | null);
  } catch {
    data = null;
  }
  if (!data) return false;
  const st = useProjectsStore.getState();
  if (!st.createProject(name)) return false;
  load(data);
  useProgramStore.getState().setProjectName(name);
  saveActiveProject();
  return true;
}

// ---------------------------------------------------------------------------
// Project files (.isap): the open project's data out, and a saved file back in as a new project.

/** Everything stored for the open project (saved first, so nothing is lost). */
export function activeProjectData(): { id: string | null; name: string; data: Record<string, unknown> } {
  const { activeId, projects } = useProjectsStore.getState();
  if (activeId) save(activeId);
  return { id: activeId, name: projects.find((p) => p.id === activeId)?.name ?? useProgramStore.getState().projectName, data: snapshot() as Record<string, unknown> };
}

/** Add a project from a file's data and open it. Returns the new project id, or null when the AI is busy. */
export function addProjectFromData(name: string, data: Record<string, unknown>): string | null {
  if (blockedByAi()) return null;
  const { activeId } = useProjectsStore.getState();
  if (activeId) save(activeId);
  const id = newId();
  load(data as Snapshot);
  useProgramStore.getState().setProjectName(name);
  useProjectsStore.setState((s) => ({ projects: [...s.projects, { id, name, createdAt: new Date().toISOString() }], activeId: id }));
  save(id);
  return id;
}
