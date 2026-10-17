import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '../components/common';
import { useDrawingContext } from '../electrical/useDrawingContext';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSpecStore } from '../store/useSpecStore';
import { useProjectStore } from '../store/useProjectStore';
import { useDraft } from '../store/useDraftStore';
import { usePlc } from '../plc/core/usePlc';
import { ioCapacity, moduleSlots } from '../plc/core/modules';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';
import { collectProject } from '../deliverables/collect';
import { saveBlob } from '../deliverables/files';
import { checksFor } from '../review/actions';
import { SEVERITY_LABEL, SEVERITY_ORDER, sortFindings, type Severity } from '../review/types';
import { engineerChecks, type EngineerFinding } from '../engineer/checks';
import { runEngineerAI } from '../engineer/engineerAI';
import { buildReviewPackage, reviewMailto } from '../engineer/package';
import { impactOf, swapInDesign, type ImpactLine } from '../sourcing/swap';
import { notify } from '../store/useNoticeStore';

const SEV_CLS: Record<Severity, string> = { critical: 'bg-red-100 text-red-800', major: 'bg-amber-100 text-amber-900', minor: 'bg-steel-100 text-steel-700', info: 'bg-sky-50 text-sky-800' };

export default function EngineerPage() {
  const ctx = useDrawingContext();
  const design = useElectricalStore((s) => s.design);
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  const navigate = useNavigate();
  const spec = useSpecStore((s) => s.sections);
  const { io, cpu, addresses } = usePlc();
  const modules = useProjectStore((s) => s.modules);
  const [ai, setAi] = useDraft<{ summary: string; findings: EngineerFinding[]; at: string } | null>('engineer.ai', null);
  const [fixed, setFixed] = useDraft<{ title: string; impact: ImpactLine[] } | null>('engineer.fixed', null);
  const [email, setEmail] = useState('');
  const [packing, setPacking] = useState(false);
  const busy = useAiJobRunning('engineer');
  useTakeResult<{ summary: string; findings: EngineerFinding[]; at: string }>('engineer', setAi);
  const error = useAiJobError('engineer');

  const rules = useMemo<EngineerFinding[]>(() => {
    if (!ctx) return [];
    const cap = ioCapacity(cpu, moduleSlots(modules));
    const used = { inputs: io.filter((p) => p.type === 'input' && addresses.get(p.id)).length, outputs: io.filter((p) => p.type === 'output' && addresses.get(p.id)).length };
    const pl = `${spec.safety} ${spec.guarding}`.match(/\bPL\s*([a-e])\b/i)?.[1] ?? null;
    const own = engineerChecks({ ctx, io: { ...used, capInputs: cap.inputs, capOutputs: cap.outputs }, requiredPL: pl });
    // The Design review's rules on the electrical side (code rules, wiring, protection, safety).
    const review = checksFor(collectProject()).filter((f) => f.area === 'electrical' || f.area === 'safety');
    return [...own, ...review.filter((f) => !own.some((o) => o.title === f.title))];
  }, [ctx, cpu, modules, io, addresses, spec]);
  const all = useMemo(() => sortFindings([...rules, ...(ai?.findings ?? [])]) as EngineerFinding[], [rules, ai]);

  const runAi = () => {
    if (!apiKey) return;
    const snapshot = collectProject();
    void startAiJob({
      kind: 'engineer', label: 'Engineer review', keepResult: true,
      run: async (h) => ({ ...(await runEngineerAI({ apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal }, snapshot, rules)), at: new Date().toISOString() }),
    });
  };

  const applyFix = (f: EngineerFinding) => {
    if (!ctx || !design || !f.oneClick) return;
    const impact = impactOf(ctx, { ...ctx, design: swapInDesign(ctx.design, f.oneClick.from, f.oneClick.to) });
    useElectricalStore.getState().setDesign(swapInDesign(design, f.oneClick.from, f.oneClick.to), 'generated', useElectricalStore.getState().explanation);
    setFixed({ title: `${f.oneClick.from} → ${f.oneClick.to} (${f.title})`, impact });
  };

  const sendPackage = async (mail: boolean) => {
    setPacking(true);
    try {
      const p = collectProject();
      const pkg = await buildReviewPackage(p, all, ai?.summary ?? null);
      saveBlob(pkg.name, pkg.blob);
      if (mail) window.location.href = reviewMailto(p, all, pkg.name, email.trim());
    } catch (e) { notify(e instanceof Error ? e.message : String(e)); }
    finally { setPacking(false); }
  };

  if (!ctx || !design) return (
    <div className="p-6 text-sm text-steel-600">No electrical design yet. Design the panel on the <Link to="/electrical?tab=design" className="underline">Electrical design</Link> page first; the engineer review checks it.</div>
  );
  const count = (s: Severity) => all.filter((f) => f.severity === s).length;

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-steel-800">Engineer review</h2>
          <p className="mt-0.5 text-xs text-steel-500">An electrical engineer's check of the panel: code compliance, wire sizing and voltage drop, SCCR, heat, spare I/O and space, selectivity, safety rating, labelling, maintainability and obsolete parts. Rule checks run instantly; the AI engineer adds judgment.</p>
        </div>
        <button onClick={runAi} disabled={!apiKey || busy} title={!apiKey ? 'Needs your Anthropic API key (Settings)' : undefined}
          className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <><Spinner /> Reviewing…</> : ai ? 'Re-run AI engineer' : 'Run AI engineer'}
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>Engineer review failed:</b> {error}</div>}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SEVERITY_ORDER.map((s) => (
            <div key={s} className="rounded border border-steel-200 bg-white p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-steel-500">{SEVERITY_LABEL[s]}</div>
              <div className="text-2xl font-semibold text-steel-800">{count(s)}</div>
            </div>
          ))}
        </div>
        {ai?.summary && <p className="rounded border border-steel-200 bg-white p-3 text-sm"><b>Engineer's verdict: </b>{ai.summary} <span className="text-xs text-steel-500">({new Date(ai.at).toLocaleString()})</span></p>}
        {fixed && (
          <section className="rounded border border-brand-200 bg-brand-50 p-3 text-sm" data-testid="engineer-fixed">
            <div className="flex items-center gap-3"><b className="flex-1">Fixed: {fixed.title}</b><button onClick={() => setFixed(null)} className="text-xs underline">Close</button></div>
            <ul className="mt-1 text-[13px]">{fixed.impact.map((i, k) => <li key={k} className={i.level === 'bad' ? 'text-red-700' : i.level === 'good' ? 'text-emerald-700' : ''}>{i.what}: {i.before} → {i.after}</li>)}</ul>
          </section>
        )}
        <ul className="space-y-2" data-testid="engineer-findings">
          {all.map((f) => (
            <li key={f.id} className="rounded border border-steel-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SEV_CLS[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
                <b className="flex-1 text-steel-900">{f.title}</b>
                <span className="text-[11px] text-steel-400">{f.source === 'ai' ? 'AI engineer' : 'Rule check'}</span>
              </div>
              <p className="mt-1 text-steel-700">{f.detail}</p>
              <p className="mt-1 text-steel-700"><b>Fix:</b> {f.fix}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                {f.ref && <button onClick={() => navigate('/electrical?tab=cabinet')} className="text-brand-700 hover:underline">Drawings {f.ref}</button>}
                {!f.ref && f.item && <span className="text-steel-500">Device {f.item}</span>}
                {f.oneClick && <button onClick={() => applyFix(f)} className="rounded bg-brand-600 px-2 py-0.5 font-medium text-white hover:bg-brand-700">{f.oneClick.label}</button>}
              </div>
            </li>
          ))}
          {!all.length && <li className="text-sm text-emerald-700">No findings: the rule checks pass. Run the AI engineer for a judgment pass.</li>}
        </ul>

        <section className="rounded border border-steel-200 bg-white p-3 text-sm" data-testid="ask-engineer">
          <h3 className="font-semibold text-steel-800">Ask a human engineer</h3>
          <p className="mt-0.5 text-xs text-steel-500">Download a review package (drawings PDF, bill of materials, I/O list, machine specification and these findings) and send it to an engineer you choose. The e-mail is written for you; attach the downloaded zip.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engineer@example.com (optional)" aria-label="Engineer's e-mail"
              className="w-64 rounded border border-steel-300 px-2 py-1 text-sm" />
            <button onClick={() => void sendPackage(false)} disabled={packing} className="rounded border border-steel-300 px-3 py-1 hover:bg-steel-50 disabled:opacity-50">{packing ? 'Packing…' : 'Download review package'}</button>
            <button onClick={() => void sendPackage(true)} disabled={packing} className="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:opacity-50">Download and write the e-mail</button>
          </div>
        </section>
      </div>
    </>
  );
}

