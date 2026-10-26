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
import type { StepResult, UpdateStep } from '../spec/updateSteps';
import { useAiJobRunning } from '../lib/ai/jobs';
import { useIOStore } from '../store/useIOStore';
import { useUi } from '../store/useUiStore';
import { runStages, STEP_LABEL } from '../spec/updateRun';

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
    useSpecStore((s) => s.sections), useProjectsStore((s) => s.activeId), useQuestionStore((s) => s.byProject), useIOStore((s) => s.projectIO),
  );
  const leftovers = exampleLeftovers();
  const apiKey = useSettingsStore((s) => s.anthropicApiKey);
  const running = useAiJobRunning('update-all');
  // Per project and kept across pages: the banner stays until the user closes it.
  const [step, setStep] = useUi<'idle' | 'confirm' | 'cleaned' | 'built'>('startClean.step', 'idle');
  const [cleanedIo, setCleanedIo] = useUi('startClean.keptIo', true);
  const [outcome, setOutcome] = useUi<{ ok: string[]; failed: string[] }>('startClean.outcome', { ok: [], failed: [] });
  const ioExample = leftovers.some((l) => l.key === 'io');
  const hasSections = leftovers.some((l) => l.key === 'spec');
  // The example's own I/O is not "my I/O list": make it again unless the user says otherwise.
  const [keepIoChoice, setKeepIo] = useState<boolean | null>(null);
  const keepIo = keepIoChoice ?? !ioExample;
  const [clearSections, setClearSections] = useState(true);

  const ORDER: UpdateStep[] = ['equipment', 'io', 'electrical', 'hmi', 'program'];
  const build = async () => {
    const steps: UpdateStep[] = ['equipment', ...(cleanedIo ? [] : ['io' as const]), 'electrical', 'hmi', 'program'];
    const results = await runStages(steps, 'Building the project from your description');
    const name = (r: StepResult) => STEP_LABEL[r.step];
    setOutcome({ ok: results.filter((r) => r.status === 'done' || r.status === 'proposal' || (r.status === 'skipped' && r.message.startsWith('Up to date'))).map(name), failed: results.filter((r) => r.status === 'failed').sort((a, b) => ORDER.indexOf(a.step) - ORDER.indexOf(b.step)).map((r) => `${name(r)}: ${r.message}`) });
    setStep('built');
  };

  if (step === 'built') return (
    <div role="status" className={`border px-4 py-3 text-sm flex flex-wrap items-start gap-3 ${outcome.failed.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-green-300 bg-green-50 text-green-900'}`} data-testid="start-clean">
      <span className="flex-1 min-w-64">
        {outcome.ok.length ? <>Built from your description: {outcome.ok.join(', ')}.</> : <>Nothing was built.</>}
        {outcome.failed.length > 0 && <span className="block mt-1">Not built: {outcome.failed.join(' · ')}. Fix the cause and use “Update out-of-date stages” in the toolbar, or try again.</span>}
      </span>
      {outcome.failed.length > 0 && <button onClick={() => void build()} disabled={!apiKey || running} className="px-3 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-50">Try again</button>}
      <button onClick={() => setStep('idle')} className="px-2 py-1 hover:underline">Close</button>
    </div>
  );
  if (step === 'cleaned') return (
    <div role="status" className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 flex flex-wrap items-center gap-3" data-testid="start-clean">
      <span className="flex-1 min-w-64">Cleared. Your description{cleanedIo ? ' and I/O list are' : ' is'} kept; a backup of the project before this is on the Project data page under “Recover saved work”. Now build every stage from your description.</span>
      <button onClick={() => void build()} disabled={!apiKey || running} title={apiKey ? undefined : 'Add your Anthropic API key in Settings'}
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
        <div className="space-y-2 border-t border-amber-200 pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <span>Your machine overview stays. The I/O list{ioExample ? ' (still the example\'s)' : ''}:</span>
            <label className="flex items-center gap-1.5"><input type="radio" name="start-clean-io" checked={keepIo} onChange={() => setKeepIo(true)} /> Keep it</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="start-clean-io" checked={!keepIo} onChange={() => setKeepIo(false)} /> Make it again from the description</label>
          </div>
          {hasSections && (
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={clearSections} onChange={(e) => setClearSections(e.target.checked)} />
              Empty the description sections that are still the example's text</label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => { startClean({ keepIo, clearSections }); setCleanedIo(keepIo); setStep('cleaned'); setKeepIo(null); }} className="px-3 py-1.5 font-medium bg-red-600 text-white rounded-sm hover:bg-red-700">Clear the example's parts</button>
            <button onClick={() => setStep('idle')} className="px-2 py-1 hover:underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
