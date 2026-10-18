/**
 * The running (or last) "update stages" run: rebuilds stages in order as one global AI job. Shared by
 * the toolbar's Update button and progress dialog (UpdateAll) and Start clean's "Build everything".
 */
import { create } from 'zustand';
import { startAiJob } from '../lib/ai/jobs';
import type { StepResult, UpdateStep } from './updateSteps';
import { aiBusyMs, aiNow, callsBetween, fmtDuration } from '../lib/ai/timing';

export const STEP_LABEL: Record<UpdateStep, string> = { equipment: 'Equipment', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI screens', program: 'PLC program' };
const ORDER: UpdateStep[] = ['equipment', 'io', 'electrical', 'hmi', 'program'];

interface UpdateRun {
  open: boolean;
  title: string;
  planned: UpdateStep[];
  results: StepResult[];
  stopping: boolean;
  stop: boolean;
  startedAt?: number;
  finishedAt?: number;
}
export const useUpdateRun = create<UpdateRun>(() => ({ open: false, title: '', planned: [], results: [], stopping: false, stop: false }));

/** "This run took 1 min 12 s (AI 58 s, 6 AI requests, 2 from the cache)." for a finished (or running) run. */
export function runSummary(r: { startedAt?: number; finishedAt?: number }, now = aiNow()): string | null {
  if (!r.startedAt) return null;
  const end = r.finishedAt ?? now;
  const calls = callsBetween(r.startedAt, end);
  const cached = calls.filter((c) => c.cached).length;
  const asked = calls.length - cached;
  return `${r.finishedAt ? 'This run took' : 'Running for'} ${fmtDuration(end - r.startedAt)} (AI ${fmtDuration(aiBusyMs(calls, r.startedAt, end))}${calls.length ? `, ${asked} AI request${asked === 1 ? '' : 's'}${cached ? `, ${cached} answered from the cache` : ''}` : ', no AI requests'}).`;
}

/**
 * Rebuild these stages in order as a global AI job, with the progress dialog open (the toolbar shows
 * "Updating… n/m" when it is hidden). Resolves with each stage's result.
 */
export async function runStages(steps: UpdateStep[], title = 'Updating the project from the spec'): Promise<StepResult[]> {
  const ordered = ORDER.filter((s) => steps.includes(s));
  useUpdateRun.setState({ open: true, title, planned: ordered, results: [], stopping: false, stop: false, startedAt: aiNow(), finishedAt: undefined });
  let done = 0;
  await startAiJob({
    kind: 'update-all', label: title.startsWith('Building') ? 'Build from the description' : 'Update all',
    run: async (h) => {
      h.stage(`${STEP_LABEL[ordered[0]]} (1/${ordered.length})`);
      try {
        // the pipeline and the engines load with the first update, not at startup
        const { runUpdateAll } = await import('./updateAll');
        await runUpdateAll(ordered, (r) => {
          // a first (rules) result is replaced by the stage's final one
          useUpdateRun.setState((s) => ({ results: [...s.results.filter((x) => x.step !== r.step), r] }));
          if (r.provisional) return;
          done++;
          const left = ordered.filter((st) => !useUpdateRun.getState().results.some((x) => x.step === st && !x.provisional));
          if (left.length) h.stage(`${left.map((st) => STEP_LABEL[st]).join(' + ')} (${Math.min(done + 1, ordered.length)}/${ordered.length})`);
        }, { signal: h.signal, shouldStop: () => useUpdateRun.getState().stop });
      } finally {
        useUpdateRun.setState({ finishedAt: aiNow() });
        const summary = runSummary(useUpdateRun.getState());
        if (summary) console.info(`[update] ${summary} ${useUpdateRun.getState().results.map((r) => `${r.step} ${r.status}${r.ms !== undefined ? ` ${fmtDuration(r.ms)}` : ''}`).join(' · ')}`);
      }
    },
  });
  return useUpdateRun.getState().results;
}
