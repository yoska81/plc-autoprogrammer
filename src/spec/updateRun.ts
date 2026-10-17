/**
 * The running (or last) "update stages" run: rebuilds stages in order as one global AI job. Shared by
 * the toolbar's Update button and progress dialog (UpdateAll) and Start clean's "Build everything".
 */
import { create } from 'zustand';
import { startAiJob } from '../lib/ai/jobs';
import { runUpdateAll, type StepResult, type UpdateStep } from './updateAll';

export const STEP_LABEL: Record<UpdateStep, string> = { equipment: 'Equipment', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI screens', program: 'PLC program' };
const ORDER: UpdateStep[] = ['equipment', 'io', 'electrical', 'hmi', 'program'];

interface UpdateRun {
  open: boolean;
  title: string;
  planned: UpdateStep[];
  results: StepResult[];
  stopping: boolean;
  stop: boolean;
}
export const useUpdateRun = create<UpdateRun>(() => ({ open: false, title: '', planned: [], results: [], stopping: false, stop: false }));

/**
 * Rebuild these stages in order as a global AI job, with the progress dialog open (the toolbar shows
 * "Updating… n/m" when it is hidden). Resolves with each stage's result.
 */
export async function runStages(steps: UpdateStep[], title = 'Updating the project from the spec'): Promise<StepResult[]> {
  const ordered = ORDER.filter((s) => steps.includes(s));
  useUpdateRun.setState({ open: true, title, planned: ordered, results: [], stopping: false, stop: false });
  let done = 0;
  await startAiJob({
    kind: 'update-all', label: title.startsWith('Building') ? 'Build from the description' : 'Update all',
    run: async (h) => {
      h.stage(`${STEP_LABEL[ordered[0]]} (1/${ordered.length})`);
      await runUpdateAll(ordered, (r) => {
        done++;
        useUpdateRun.setState((s) => ({ results: [...s.results, r] }));
        const next = ordered.find((st, i) => i >= done && st !== r.step);
        if (next) h.stage(`${STEP_LABEL[next]} (${Math.min(done + 1, ordered.length)}/${ordered.length})`);
      }, { signal: h.signal, shouldStop: () => useUpdateRun.getState().stop });
    },
  });
  return useUpdateRun.getState().results;
}
