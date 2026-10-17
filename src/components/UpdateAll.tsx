import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStages } from '../spec/useStages';
import { useSettingsStore } from '../store/useSettingsStore';
import { UPDATE_GROUPS, type UpdateStep } from '../spec/updateAll';
import { runStages, runSummary, useUpdateRun } from '../spec/updateRun';
import { cancelAiJob, useAiJob } from '../lib/ai/jobs';
import { Spinner } from './common';
import { isThinking, percentOf, useAiProgress } from '../lib/ai/progress';
import { fmtDuration } from '../lib/ai/timing';

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

/** "This run took 48 s (AI 41 s, 5 AI requests)" — ticks while the run is going. */
function RunTime() {
  const run = useUpdateRun();
  const [, tick] = useState(0);
  useEffect(() => { if (run.finishedAt) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [run.finishedAt]);
  const text = runSummary(run);
  return text ? <p className="px-5 pb-3 -mt-1 text-xs text-gray-500 tabular-nums" data-testid="update-run-time">{text}</p> : null;
}

/** Sidebar button + progress dialog that updates every out-of-date stage in order. */
export default function UpdateAll() {
  const stages = useStages();
  const apiKey = useSettingsStore((s) => s.anthropicApiKey);
  const navigate = useNavigate();
  const { open, title, planned, results, stopping } = useUpdateRun();
  const setOpen = (o: boolean) => useUpdateRun.setState({ open: o });
  // Runs as a global AI job: the status bar shows the stage and can cancel it; closing this dialog doesn't stop it.
  const job = useAiJob('update-all');
  const running = job?.status === 'running';

  // A stage is updated when it is stale, or when an earlier stage it depends on will change.
  const stale = ORDER.filter((o) => stages[o.step].status === 'stale').map((o) => o.step);
  if (!stale.length && !open && !running) return null;

  const start = () => {
    const first = ORDER.findIndex((o) => stale.includes(o.step));
    void runStages(ORDER.slice(first).map((o) => o.step).filter((s) => stages[s].status !== 'empty'));
  };
  // the group still being worked on: its unfinished steps show a spinner
  const final = (st: UpdateStep) => results.find((r) => r.step === st && !r.provisional);
  const activeGroup = UPDATE_GROUPS.findIndex((g) => g.some((st) => planned.includes(st) && !final(st)));

  return (
    <>
      {running && !open && (
        <button onClick={() => setOpen(true)} className="px-3 py-1 text-sm font-semibold rounded bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-2" data-testid="update-progress">
          <Spinner /> {title.startsWith('Building') ? 'Building' : 'Updating'}… {results.filter((r) => !r.provisional).length}/{planned.length}
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
              <h3 className="text-base font-semibold">{title || 'Updating the project from the spec'}</h3>
              <p className="text-xs text-gray-500 mt-1">Each stage is rebuilt from the latest spec and the stages before it; stages that don't depend on each other run at the same time.
                The rules' version of a stage appears first, then the AI's (Settings → AI per stage). You can hide this window and keep working: the update continues on every page (progress is shown in the toolbar).</p>
            </div>
            <ol className="px-5 py-4 space-y-2">
              {planned.map((step) => {
                const r = results.find((x) => x.step === step);
                const label = ORDER.find((o) => o.step === step)!.label;
                const refining = Boolean(r?.provisional && running);
                const isNext = running && (!r || refining) && (refining || UPDATE_GROUPS[activeGroup]?.includes(step));
                return (
                  <li key={step} className="flex items-start gap-3 text-sm">
                    <span className="w-5 pt-0.5">
                      {r && !refining ? (r.status === 'failed' ? '✗' : r.status === 'skipped' ? '–' : r.status === 'proposal' ? '●' : '✓') : isNext ? <Spinner /> : '○'}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{label}</span>
                        {r && !refining && r.status !== 'failed' && r.status !== 'skipped' && <span className="ml-auto text-xs tabular-nums text-green-700" data-testid={`progress-${step}`}>100%{r.ms !== undefined ? <span className="text-gray-400 font-normal"> · {fmtDuration(r.ms)}</span> : null}</span>}
                        {(!r || refining) && isNext && <StepProgress step={step} />}
                      </span>
                      {r && <span className={`block text-xs ${r.status === 'failed' ? 'text-red-700' : r.status === 'proposal' ? 'text-indigo-700' : 'text-gray-500'}`}>{r.message}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <RunTime />
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              {results.some((r) => r.status === 'proposal') && !running && (
                <button onClick={() => { setOpen(false); navigate('/program'); }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Review program changes</button>
              )}
              {running && (
                <button onClick={() => useUpdateRun.setState({ stop: true, stopping: true })} disabled={stopping} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
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
