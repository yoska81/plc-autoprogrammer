import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIOStore } from '../store/useIOStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { usePlc } from '../plc/usePlc';
import { useFingerprints, useStages, ioFingerprint } from '../spec/useStages';
import { generateIOFromSpec, planIOMerge, type IOMergePlan } from '../lib/ai/ioAI';
import StageBanner from './StageBanner';
import { Spinner } from './program/common';

/** Generate / update the I/O list from the spec, with a review step before applying. */
export default function IOFromSpec() {
  const settings = useSettingsStore();
  const { projectIO, applyIOUpdate } = useIOStore();
  const markGenerated = useStageStore((s) => s.markGenerated);
  const { profile, cpu } = usePlc();
  const fp = useFingerprints();
  const stages = useStages();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<(IOMergePlan & { explanation: string; questions: string[] }) | null>(null);

  const apiKey = settings.anthropicApiKey;
  const specEmpty = stages.spec.status === 'empty';

  const generate = async () => {
    if (!apiKey || specEmpty) return;
    setBusy(true);
    setError(null);
    try {
      const r = await generateIOFromSpec({
        apiKey, model: settings.anthropicModel, effort: settings.effort,
        spec: fp.spec, existing: projectIO, profile, cpu,
      });
      setPlan({ ...planIOMerge(projectIO, r.points), explanation: r.explanation, questions: r.questions });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!plan) return;
    applyIOUpdate(
      plan.kept.map(({ point, next }) => ({ id: point.id, category: next.category, deviceType: next.deviceType })),
      plan.added.map((g) => ({ description: g.description, type: g.type, category: g.category, deviceType: g.deviceType })),
      plan.removed.map((p) => p.id),
    );
    // Record what the I/O list was built from (read the store after the update).
    markGenerated('io', { specFp: fp.specFp, spec: fp.spec, ioFp: ioFingerprint(useIOStore.getState().projectIO) });
    setPlan(null);
  };

  const button = (
    <button onClick={generate} disabled={busy || !apiKey || specEmpty}
      className="px-3 py-1.5 text-sm bg-petrol-600 text-white rounded hover:bg-petrol-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
      {busy ? <><Spinner /> Reading the spec…</> : projectIO.length ? 'Update I/O from spec' : 'Generate I/O from spec'}
    </button>
  );

  return (
    <>
      <StageBanner
        info={stages.io}
        action={button}
        emptyText={specEmpty ? undefined : 'Generate the I/O list from your spec, or add points by hand below.'}
      />
      {stages.io.status === 'ready' && (
        <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center justify-end gap-3 text-xs text-gray-500">
          {specEmpty ? <span>Describe the machine on the <Link to="/spec" className="underline">Describe</Link> page to generate I/O automatically.</span> : button}
        </div>
      )}
      {error && <div role="alert" className="mx-6 my-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}

      {plan && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-full flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Review I/O changes</h3>
              <p className="text-sm text-gray-600 mt-1">{plan.explanation}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 text-sm">
              {plan.added.length > 0 && (
                <section>
                  <h4 className="font-semibold text-green-800 mb-1">Add ({plan.added.length})</h4>
                  <ul className="space-y-0.5">{plan.added.map((g, i) => (
                    <li key={i} className="flex gap-2"><span className="text-green-700 w-14 shrink-0">{g.type === 'input' ? 'Input' : 'Output'}</span><span className="flex-1">{g.description}</span><span className="text-gray-400 text-xs">{g.reason}</span></li>
                  ))}</ul>
                </section>
              )}
              {plan.removed.length > 0 && (
                <section>
                  <h4 className="font-semibold text-red-800 mb-1">Remove ({plan.removed.length})</h4>
                  <ul className="space-y-0.5">{plan.removed.map((p) => (
                    <li key={p.id} className="flex gap-2 text-red-900"><span className="w-14 shrink-0 font-mono">{p.id}</span><span className="line-through">{p.description}</span></li>
                  ))}</ul>
                </section>
              )}
              <section>
                <h4 className="font-semibold text-gray-700 mb-1">Keep ({plan.kept.length}, addresses unchanged)</h4>
                <p className="text-gray-500">{plan.kept.map((k) => k.point.description).join(' · ') || 'none'}</p>
              </section>
              {plan.questions.length > 0 && (
                <section className="bg-amber-50 border border-amber-200 rounded p-3">
                  <h4 className="font-semibold text-amber-900 mb-1">Questions</h4>
                  <ul className="list-disc pl-5 text-amber-900">{plan.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  <p className="text-xs text-amber-800 mt-1">Answer them in the spec (Describe) and update again.</p>
                </section>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setPlan(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={apply} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">Apply changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
