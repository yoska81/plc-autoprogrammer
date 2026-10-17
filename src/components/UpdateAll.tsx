import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStages } from '../spec/useStages';
import { useSettingsStore } from '../store/useSettingsStore';
import { runUpdateAll, UPDATE_GROUPS, type StepResult, type UpdateStep } from '../spec/updateAll';
import { cancelAiJob, startAiJob, useAiJob } from '../lib/ai/jobs';
import { Spinner } from './common';
import { isThinking, percentOf, useAiProgress } from '../lib/ai/progress';

const ORDER: { step: UpdateStep; label: string }[] = [
  { step: 'equipment', label: 'Equipment' },
  { step: 'io', label: 'I/O list' },
  { step: 'electrical', label: 'Electrical design' },
  { step: 'hmi', label: 'HMI screens' },
  { step: 'program', label: 'PLC program' },
];

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** "Thinking 1:23" while the model thinks, then "Writing 45 %" with a bar while the answer arrives. */
function StepProgress({ step }: { step: string }) {
  const p = useAiProgress(step);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!p || p.done) return <span className="ml-auto text-xs text-gray-400">waiting…</span>;
  const pct = percentOf(step, p, now) ?? 0;
  return (
    <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-gray-600" data-testid={`progress-${step}`}>
      <span className="text-gray-500">{isThinking(p) ? 'thinking' : 'writing'} {mmss(Math.max(0, now - p.startedAt))}</span>
      <span className="w-24 h-1.5 bg-gray-200 rounded overflow-hidden"><span className="block h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></span>
      <span className="w-9 text-right font-medium text-brand-800">{pct}%</span>
    </span>
  );
}

/** Sidebar button + progress dialog that updates every out-of-date stage in order. */
export default function UpdateAll() {
  const stages = useStages();
  const apiKey = useSettingsStore((s) => s.anthropicApiKey);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Runs as a global AI job: the status bar shows the stage and can cancel it; closing this dialog doesn't stop it.
  const job = useAiJob('update-all');
  const running = job?.status === 'running';
  const [results, setResults] = useState<StepResult[]>([]);
  const [planned, setPlanned] = useState<UpdateStep[]>([]);
  const stopRef = useRef(false);
  const [stopping, setStopping] = useState(false);

  // A stage is updated when it is stale, or when an earlier stage it depends on will change.
  const stale = ORDER.filter((o) => stages[o.step].status === 'stale').map((o) => o.step);
  if (!stale.length && !open && !running) return null;

  const start = async () => {
    const first = ORDER.findIndex((o) => stale.includes(o.step));
    const steps = ORDER.slice(first).map((o) => o.step).filter((s) => stages[s].status !== 'empty');
    setPlanned(steps);
    setResults([]);
    setOpen(true);
    const label = (st: UpdateStep) => ORDER.find((o) => o.step === st)!.label;
    stopRef.current = false;
    setStopping(false);
    let done = 0;
    await startAiJob({
      kind: 'update-all', label: 'Update all',
      run: async (h) => {
        h.stage(`${label(steps[0])} (1/${steps.length})`);
        await runUpdateAll(steps, (r) => {
          done++;
          setResults((prev) => [...prev, r]);
          const next = steps.find((st, i) => i >= done && st !== r.step);
          if (next) h.stage(`${label(next)} (${Math.min(done + 1, steps.length)}/${steps.length})`);
        }, { signal: h.signal, shouldStop: () => stopRef.current });
      },
    });
  };
  // the group still being worked on: its unfinished steps show a spinner
  const activeGroup = UPDATE_GROUPS.findIndex((g) => g.some((st) => planned.includes(st) && !results.some((r) => r.step === st)));

  return (
    <>
      {running && !open && (
        <button onClick={() => setOpen(true)} className="px-3 py-1 text-sm font-semibold rounded bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-2" data-testid="update-progress">
          <Spinner /> Updating… {results.length}/{planned.length}
        </button>
      )}
      {stale.length > 0 && !running && (
        <button onClick={start} disabled={!apiKey || running}
          title={apiKey ? undefined : 'Add your Anthropic API key in Settings'}
          className="px-3 py-1 text-sm font-semibold rounded bg-amber-400 text-steel-900 hover:bg-amber-300 disabled:opacity-50">
          Update out-of-date stages ({stale.length})
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white text-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold">Updating the project from the spec</h3>
              <p className="text-xs text-gray-500 mt-1">Each stage is rebuilt from the latest spec and the stages before it. Deep thinking can take several minutes per stage.
                You can hide this window and keep working: the update continues on every page (progress is shown in the toolbar).</p>
            </div>
            <ol className="px-5 py-4 space-y-2">
              {planned.map((step) => {
                const r = results.find((x) => x.step === step);
                const label = ORDER.find((o) => o.step === step)!.label;
                const isNext = running && !r && UPDATE_GROUPS[activeGroup]?.includes(step);
                return (
                  <li key={step} className="flex items-start gap-3 text-sm">
                    <span className="w-5 pt-0.5">
                      {r ? (r.status === 'failed' ? '✗' : r.status === 'skipped' ? '–' : r.status === 'proposal' ? '●' : '✓') : isNext ? <Spinner /> : '○'}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{label}</span>
                        {r && r.status !== 'failed' && r.status !== 'skipped' && <span className="ml-auto text-xs tabular-nums text-green-700" data-testid={`progress-${step}`}>100%</span>}
                        {!r && isNext && <StepProgress step={step} />}
                      </span>
                      {r && <span className={`block text-xs ${r.status === 'failed' ? 'text-red-700' : r.status === 'proposal' ? 'text-indigo-700' : 'text-gray-500'}`}>{r.message}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              {results.some((r) => r.status === 'proposal') && !running && (
                <button onClick={() => { setOpen(false); navigate('/program'); }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Review program changes</button>
              )}
              {running && (
                <button onClick={() => { stopRef.current = true; setStopping(true); }} disabled={stopping} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
                  {stopping ? 'Stopping after this stage…' : 'Stop after this stage'}
                </button>
              )}
              {running && job && (
                <button onClick={() => cancelAiJob(job.id)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel now</button>
              )}
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                {running ? 'Hide (keep working)' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
