import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIOStore } from '../store/useIOStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { usePlc } from '../plc/core/usePlc';
import { useFingerprints, useStages, ioFingerprint } from '../spec/useStages';
import { generateIOFromSpec, planIOMerge, type IOMergePlan } from '../lib/ai/ioAI';
import StageBanner from './StageBanner';
import { Spinner } from './common';

/** Generate / update the I/O list from the spec, with a review step before applying. */
export default function IOFromSpec({ children }: { children: (generateButton: ReactNode) => ReactNode }) {
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
      title={specEmpty ? 'Describe the machine first' : !apiKey ? 'Add your Anthropic API key in Settings' : undefined}
      className="h-7 px-3 text-[13px] font-medium bg-brand-600 text-brand-950 rounded-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
      {busy ? <><Spinner /> Reading the spec…</> : projectIO.length ? 'Update I/O from spec' : 'Generate I/O from spec'}
    </button>
  );

  return (
    <>
      <StageBanner
        info={stages.io}
        emptyText={specEmpty ? undefined : 'Generate the I/O list from your machine description, or add points by hand.'}
      />
      {specEmpty && (
        <div className="px-4 py-2 border-b border-brand-200 bg-brand-50 text-brand-900">
          Describe the machine on the <Link to="/spec" className="underline">Machine description</Link> step to generate I/O automatically.
        </div>
      )}
      {children(button)}
      {error && <div role="alert" className="mx-4 mt-3 bg-red-50 border border-red-200 p-3 text-red-800">{error}</div>}

      {plan && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white border border-steel-300 shadow-2xl max-w-3xl w-full max-h-full flex flex-col">
            <div className="h-8 px-4 flex items-center bg-brand-800 text-white">
              <h3 className="text-[13px] font-semibold">Review I/O changes</h3>
            </div>
            <div className="px-4 py-3 border-b border-steel-200">
              <p className="text-steel-700">{plan.explanation}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {plan.added.length > 0 && (
                <section>
                  <h4 className="font-semibold text-green-800 mb-1">Add ({plan.added.length})</h4>
                  <ul className="space-y-0.5">{plan.added.map((g, i) => (
                    <li key={i} className="flex gap-2"><span className="text-green-700 w-14 shrink-0">{g.type === 'input' ? 'Input' : 'Output'}</span><span className="flex-1">{g.description}</span><span className="text-steel-500 text-xs">{g.reason}</span></li>
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
                <h4 className="font-semibold text-steel-700 mb-1">Keep ({plan.kept.length}, addresses unchanged)</h4>
                <p className="text-steel-500">{plan.kept.map((k) => k.point.description).join(' · ') || 'none'}</p>
              </section>
              {plan.questions.length > 0 && (
                <section className="bg-amber-50 border border-amber-200 p-3">
                  <h4 className="font-semibold text-amber-900 mb-1">Questions</h4>
                  <ul className="list-disc pl-5 text-amber-900">{plan.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  <p className="text-xs text-amber-800 mt-1">Answer them in the spec (Describe) and update again.</p>
                </section>
              )}
            </div>
            <div className="px-4 py-2 border-t border-steel-200 bg-[#f7f8f9] flex justify-end gap-2">
              <button onClick={() => setPlan(null)} className="px-4 py-1.5 border border-steel-300 bg-white rounded-sm hover:bg-steel-50">Cancel</button>
              <button onClick={apply} className="px-4 py-1.5 font-medium bg-brand-600 text-brand-950 rounded-sm hover:bg-brand-700">Apply changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
