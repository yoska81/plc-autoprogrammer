/**
 * Global AI job runner. Every AI generation runs here instead of inside a page component, so it
 * keeps running when the user moves to another page: the job's result is applied to the project
 * stores when it finishes (wherever the user is), the status bar shows running jobs with their
 * elapsed time, stage, retries and a Cancel button, and a page shows the job's progress again
 * when the user comes back to it.
 *
 * Results that a page shows before they are applied (an equipment recommendation, an I/O merge
 * plan, the AI review) stay on the job until that page takes them (`takeResult`).
 * If the open project changed before a job finished (switching is normally blocked while the AI
 * works), its result is held and applied when that project is opened again.
 */
import { bindProgress, finishProgress } from './progress';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useProjectsStore } from '../../store/useProjectsStore';
import type { RetryNotice } from './errors';

export type AiJobKind =
  | 'spec' | 'equipment' | 'io' | 'electrical' | 'hmi' | 'hmi-recreate' | 'program' | 'program-revise'
  | 'review' | 'import' | 'update-all' | 'sourcing' | 'engineer' | 'convert';

export type AiJobStatus = 'running' | 'done' | 'failed' | 'cancelled';

export interface AiJob {
  id: string;
  kind: AiJobKind;
  label: string;
  projectId: string | null;
  startedAt: number;
  endedAt?: number;
  status: AiJobStatus;
  /** Current step, e.g. "Electrical design (3/5)". */
  stage?: string;
  /** Set while a failed request waits for its automatic retry. */
  retry?: RetryNotice | null;
  error?: string;
  /** Result kept for the page that shows it (until taken). */
  result?: unknown;
  /** The page has taken the result. */
  taken?: boolean;
  /** Finished for a project that is not open: applied when it is opened again. */
  held?: boolean;
  /** The user closed the failure notice. */
  dismissed?: boolean;
}

interface JobsState {
  jobs: AiJob[];
  patch: (id: string, p: Partial<AiJob>) => void;
  remove: (id: string) => void;
}

export const useAiJobs = create<JobsState>()((set) => ({
  jobs: [],
  patch: (id, p) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) })),
  remove: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}));

const controllers = new Map<string, AbortController>();
const signals = new Map<AbortSignal, string>();
const reruns = new Map<string, () => void>();
const heldApply = new Map<string, () => void>();
let seq = 0;

const activeProject = () => useProjectsStore.getState().activeId;

export interface JobHandle {
  /** Pass to the AI call: Cancel aborts the request. */
  signal: AbortSignal;
  /** Show the current step in the status bar and on the page. */
  stage: (text: string) => void;
}

export interface AiJobSpec<T> {
  kind: AiJobKind;
  label: string;
  run: (h: JobHandle) => Promise<T>;
  /** Write the result into the project stores (runs even if the page that started the job is gone). */
  apply?: (result: T) => void;
  /** Keep the result on the job for the page to take (results that need the user's OK first). */
  keepResult?: boolean;
}

/**
 * Start an AI job. One job per kind runs at a time (a second start of the same kind is ignored and
 * returns the running job's id). Resolves with the job id when it ends; never throws.
 */
export function startAiJob<T>(spec: AiJobSpec<T>): Promise<string> {
  const running = useAiJobs.getState().jobs.find((j) => j.kind === spec.kind && j.status === 'running');
  if (running) return Promise.resolve(running.id);
  const id = `job_${Date.now().toString(36)}_${++seq}`;
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  signals.set(ctrl.signal, id);
  bindProgress(ctrl.signal, spec.kind);
  const projectId = activeProject();
  // older finished jobs of the same kind are replaced by this one
  useAiJobs.setState((s) => ({
    jobs: [...s.jobs.filter((j) => j.kind !== spec.kind || j.status === 'running'),
      { id, kind: spec.kind, label: spec.label, projectId, startedAt: Date.now(), status: 'running' }],
  }));
  reruns.set(id, () => { void startAiJob(spec); });
  const patch = (p: Partial<AiJob>) => useAiJobs.getState().patch(id, p);
  const handle: JobHandle = { signal: ctrl.signal, stage: (text) => patch({ stage: text, retry: null }) };

  return spec.run(handle).then(
    (result) => {
      if (ctrl.signal.aborted) { patch({ status: 'cancelled', endedAt: Date.now(), retry: null }); return id; }
      const apply = () => spec.apply?.(result);
      if (projectId !== activeProject()) {
        heldApply.set(id, apply);
        patch({ status: 'done', endedAt: Date.now(), retry: null, held: true, ...(spec.keepResult ? { result } : {}) });
      } else {
        try { apply(); } catch (err) { patch({ status: 'failed', endedAt: Date.now(), retry: null, error: err instanceof Error ? err.message : String(err) }); return id; }
        patch({ status: 'done', endedAt: Date.now(), retry: null, ...(spec.keepResult ? { result } : {}) });
      }
      return id;
    },
    (err) => {
      const cancelled = ctrl.signal.aborted;
      patch({ status: cancelled ? 'cancelled' : 'failed', endedAt: Date.now(), retry: null, error: cancelled ? undefined : err instanceof Error ? err.message : String(err) });
      return id;
    },
  ).finally(() => { finishProgress(spec.kind, useAiJobs.getState().jobs.find((j) => j.id === id)?.status === 'done'); controllers.delete(id); signals.delete(ctrl.signal); });
}

/** Stop a running job (aborts its AI request). */
export function cancelAiJob(id: string) { controllers.get(id)?.abort(); }

/** Run a failed job again with the same input. */
export function retryAiJob(id: string) {
  const again = reruns.get(id);
  useAiJobs.getState().remove(id);
  again?.();
}

/** Hide a failure notice. */
export function dismissAiJob(id: string) {
  const j = useAiJobs.getState().jobs.find((x) => x.id === id);
  if (j && j.status !== 'running') useAiJobs.getState().patch(id, { dismissed: true });
}

/** The page has shown / applied the kept result. */
export function takeResult(id: string) { useAiJobs.getState().patch(id, { taken: true, result: undefined }); }

/** Called by callClaude / callOpenAI while a failed request waits for its retry. */
export function reportRetry(signal: AbortSignal | undefined, n: RetryNotice) {
  const id = signal ? signals.get(signal) : undefined;
  const st = useAiJobs.getState();
  const targets = id ? [id] : st.jobs.filter((j) => j.status === 'running').map((j) => j.id);
  for (const t of targets) st.patch(t, { retry: n });
}

/** The latest job of a kind for the open project (running, or finished and not dismissed). */
export function useAiJob(kind: AiJobKind): AiJob | undefined {
  const projectId = useProjectsStore((s) => s.activeId);
  return useAiJobs((s) => [...s.jobs].reverse().find((j) => j.kind === kind && j.projectId === projectId));
}

/** True while an AI job of this kind runs for the open project. */
export function useAiJobRunning(kind: AiJobKind): boolean {
  return useAiJob(kind)?.status === 'running';
}

/**
 * Hand a kept result to the page once (when the job finishes while the page is open, or when the
 * user comes back to the page later), then mark it taken.
 */
export function useTakeResult<T>(kind: AiJobKind, take: (result: T) => void) {
  const job = useAiJob(kind);
  const fn = useRef(take);
  useEffect(() => { fn.current = take; });
  useEffect(() => {
    if (job?.status === 'done' && !job.taken && !job.held && job.result !== undefined) {
      fn.current(job.result as T);
      takeResult(job.id);
    }
  }, [job]);
}

/** The failure message of the latest job of a kind (until dismissed or a new job starts). */
export function useAiJobError(kind: AiJobKind): string | null {
  const job = useAiJob(kind);
  return job?.status === 'failed' && !job.dismissed ? job.error ?? 'The AI request failed.' : null;
}

// Apply results held for a project when it is opened again.
useProjectsStore.subscribe((s) => {
  for (const j of useAiJobs.getState().jobs) {
    if (!j.held || j.projectId !== s.activeId) continue;
    heldApply.get(j.id)?.();
    heldApply.delete(j.id);
    useAiJobs.getState().patch(j.id, { held: false });
  }
});
