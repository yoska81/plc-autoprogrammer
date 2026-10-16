import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStages } from '../spec/useStages';
import { useSettingsStore } from '../store/useSettingsStore';
import { runUpdateAll, type StepResult, type UpdateStep } from '../spec/updateAll';
import { Spinner } from './program/common';

const ORDER: { step: UpdateStep; label: string }[] = [
  { step: 'equipment', label: 'Equipment' },
  { step: 'io', label: 'I/O list' },
  { step: 'electrical', label: 'Electrical design' },
  { step: 'hmi', label: 'HMI screens' },
  { step: 'program', label: 'PLC program' },
];

/** Sidebar button + progress dialog that updates every out-of-date stage in order. */
export default function UpdateAll() {
  const stages = useStages();
  const apiKey = useSettingsStore((s) => s.anthropicApiKey);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);
  const [planned, setPlanned] = useState<UpdateStep[]>([]);

  // A stage is updated when it is stale, or when an earlier stage it depends on will change.
  const stale = ORDER.filter((o) => stages[o.step].status === 'stale').map((o) => o.step);
  if (!stale.length && !open) return null;

  const start = async () => {
    const first = ORDER.findIndex((o) => stale.includes(o.step));
    const steps = ORDER.slice(first).map((o) => o.step).filter((s) => stages[s].status !== 'empty');
    setPlanned(steps);
    setResults([]);
    setOpen(true);
    setRunning(true);
    await runUpdateAll(steps, (r) => setResults((prev) => [...prev, r]));
    setRunning(false);
  };

  return (
    <>
      {stale.length > 0 && (
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
              <p className="text-xs text-gray-500 mt-1">Each stage is rebuilt from the latest spec and the stages before it. Deep thinking can take several minutes per stage.</p>
            </div>
            <ol className="px-5 py-4 space-y-2">
              {planned.map((step) => {
                const r = results.find((x) => x.step === step);
                const label = ORDER.find((o) => o.step === step)!.label;
                const isNext = running && !r && results.length === planned.indexOf(step);
                return (
                  <li key={step} className="flex items-start gap-3 text-sm">
                    <span className="w-5 pt-0.5">
                      {r ? (r.status === 'failed' ? '✗' : r.status === 'skipped' ? '–' : r.status === 'proposal' ? '●' : '✓') : isNext ? <Spinner /> : '○'}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{label}</span>
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
              <button onClick={() => setOpen(false)} disabled={running} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
                {running ? 'Working…' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
