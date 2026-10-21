import { IS_PREVIEW } from '../../preview/mode';
import { checkEquivalence, type EquivalenceOptions, type EquivalenceResult } from './equivalence';
import { spawnEquivalenceWorker } from './equivalenceWorkerSpawn';
import type { LadderProgram } from '../core/ladder';

/** Time the check may take in the worker: the page stays free and Cancel stops it, so it can run longer than on the page. */
export const WORKER_BUDGET_MS = 120_000;
/** On the page (the preview, or no worker could start) the page waits: a shorter check. */
export const PAGE_BUDGET_MS = 15_000;

const abortError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

/**
 * The equivalence check in a worker of its own: the page stays responsive on a program of thousands of rungs,
 * `onProgress` hears each sequence start, and the signal (Cancel) ends the worker at once. Where no worker can
 * run (the single-file preview, Node), the same check runs on the page with a shorter time limit.
 */
export function checkEquivalenceOffThread(
  original: LadderProgram, reorganized: LadderProgram, options: Omit<EquivalenceOptions, 'onProgress' | 'sim'>,
  o: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<EquivalenceResult> {
  if (o.signal?.aborted) return Promise.reject(abortError());
  let worker: Worker | null = null;
  if (!IS_PREVIEW && typeof Worker !== 'undefined') { try { worker = spawnEquivalenceWorker(); } catch { worker = null; } }
  const onPage = () => checkEquivalence(original, reorganized, { budgetMs: PAGE_BUDGET_MS, ...options, onProgress: o.onProgress });
  if (!worker) return Promise.resolve().then(onPage);
  const w = worker;
  return new Promise<EquivalenceResult>((resolve, reject) => {
    const done = () => { w.terminate(); o.signal?.removeEventListener('abort', cancel); };
    const cancel = () => { done(); reject(abortError()); };
    o.signal?.addEventListener('abort', cancel, { once: true });
    w.onmessage = (e: MessageEvent<{ progress?: { done: number; total: number }; result?: EquivalenceResult; error?: string }>) => {
      if (e.data.progress) { o.onProgress?.(e.data.progress.done, e.data.progress.total); return; }
      done();
      if (e.data.error !== undefined) reject(new Error(e.data.error)); else resolve(e.data.result!);
    };
    // The worker could not start: the check on the page instead.
    w.onerror = (ev) => { ev.preventDefault?.(); done(); try { resolve(onPage()); } catch (err) { reject(err); } };
    w.postMessage({ original, reorganized, options: { budgetMs: WORKER_BUDGET_MS, ...options } });
  });
}
