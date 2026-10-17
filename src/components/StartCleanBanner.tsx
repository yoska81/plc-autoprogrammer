import { useState } from 'react';

/** Takes the selected store values only so the component re-renders when they change. */
const useSubscribe = (...values: unknown[]) => values.length;
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useProgramStore } from '../store/useProgramStore';
import { useSpecStore } from '../store/useSpecStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { useQuestionStore } from './questions/useQuestionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { exampleLeftovers, startClean } from '../spec/startClean';
import { runUpdateAll, type UpdateStep } from '../spec/updateAll';
import { startAiJob, useAiJobRunning } from '../lib/ai/jobs';

/**
 * Shown on a project that still holds parts of the example (a copy of it): lists them and offers
 * to clear them, keeping the user's description (and I/O list, if they want), then to build every
 * stage again from that description.
 */
export default function StartCleanBanner() {
  // Subscribed so the banner re-checks when any of the stores the check reads change.
  useSubscribe(
    useProjectStore((s) => s.recommendation), useProjectStore((s) => s.info), useElectricalStore((s) => s.design), useElectricalStore((s) => s.inputs.motors),
    useHmiStore((s) => s.design), useProgramStore((s) => s.ladder), useProgramStore((s) => s.userPrompt),
    useSpecStore((s) => s.sections), useProjectsStore((s) => s.activeId), useQuestionStore((s) => s.byProject),
  );
  const leftovers = exampleLeftovers();
  const apiKey = useSettingsStore((s) => s.anthropicApiKey);
  const running = useAiJobRunning('update-all');
  const [step, setStep] = useState<'idle' | 'confirm' | 'cleaned'>('idle');
  const [keepIo, setKeepIo] = useState(true);
  const [cleanedIo, setCleanedIo] = useState(true);

  const build = () => {
    const steps: UpdateStep[] = ['equipment', ...(cleanedIo ? [] : ['io' as const]), 'electrical', 'hmi', 'program'];
    void startAiJob({ kind: 'update-all', label: 'Build from my description', run: async (h) => { h.stage('Equipment'); await runUpdateAll(steps, (r) => h.stage(`${r.step} ${r.status}`), { signal: h.signal }); } });
  };

  if (step === 'cleaned') return (
    <div role="status" className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 flex flex-wrap items-center gap-3" data-testid="start-clean">
      <span className="flex-1 min-w-64">Cleared. Your description{cleanedIo ? ' and I/O list are' : ' is'} kept; a backup of the project before this is under Project › Recover work. Now build every stage from your description.</span>
      <button onClick={build} disabled={!apiKey || running} title={apiKey ? undefined : 'Add your Anthropic API key in Settings'}
        className="px-3 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-50">{running ? 'Building…' : 'Build everything from my description'}</button>
      <button onClick={() => setStep('idle')} className="px-2 py-1 text-green-800 hover:underline">Close</button>
    </div>
  );
  if (!leftovers.length) return null;
  return (
    <div role="alert" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2" data-testid="start-clean">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 min-w-64"><b>This project still holds parts of the example</b>: {leftovers.map((l) => l.label).join('; ')}. They don't describe your machine.</span>
        {step === 'idle' && <button onClick={() => setStep('confirm')} className="px-3 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700">Start clean from my description</button>}
      </div>
      {step === 'confirm' && (
        <div className="flex flex-wrap items-center gap-4 border-t border-amber-200 pt-2">
          <span>Your machine description stays. The I/O list:</span>
          <label className="flex items-center gap-1.5"><input type="radio" name="start-clean-io" checked={keepIo} onChange={() => setKeepIo(true)} /> Keep my I/O list</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="start-clean-io" checked={!keepIo} onChange={() => setKeepIo(false)} /> Make it again from the description</label>
          <button onClick={() => { startClean({ keepIo }); setCleanedIo(keepIo); setStep('cleaned'); }} className="px-3 py-1.5 font-medium bg-red-600 text-white rounded-sm hover:bg-red-700">Clear the example's parts</button>
          <button onClick={() => setStep('idle')} className="px-2 py-1 hover:underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
