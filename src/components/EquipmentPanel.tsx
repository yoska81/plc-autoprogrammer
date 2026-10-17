import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSpecStore } from '../store/useSpecStore';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { useIOStore } from '../store/useIOStore';
import { PLC_PROFILES } from '../plc/core/profiles';
import { getPart, partsIn } from '../electrical/catalog';
import { HMI_MODELS, getHmi, type HmiModel } from '../hmi/hmiCatalog';
import { catalogPanels } from '../hmi/panels';
import { normalizePreference } from '../electrical/catalogs';
import { useUi } from '../store/useUiStore';
import { moduleSlots, ioCapacity } from '../plc/core/modules';
import { cpuFit, findCpu, hmiFit, platformOf, type Need } from '../plc/core/fit';
import { recommendEquipment, type EquipmentRecommendation } from '../lib/ai/equipmentAI';
import { applyEquipment, recommendedChoice, type EquipmentChoice } from '../spec/equipment';
import VendorPreferenceCard from './VendorPreferenceCard';
import BrandHardwareCard from './BrandHardwareCard';
import { Spinner, ReasoningPanel } from './common';
import { useDraft } from '../store/useDraftStore';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';

const MAX_MODULES = 8;

function CapacityBar({ label, need, have }: { label: string; need: number; have: number }) {
  const spare = have - need;
  const ok = spare >= 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-steel-600 mb-1">
        <span>{label}</span>
        <span className={ok ? 'text-steel-700' : 'text-red-700 font-medium'}>{need} needed · {have} available{ok ? ` · ${spare} spare` : ` · ${-spare} short`}</span>
      </div>
      <div className="h-2 rounded bg-steel-100 overflow-hidden">
        <div className={`h-full ${ok ? 'bg-brand-500' : 'bg-red-500'}`} style={{ width: `${have ? Math.min(100, (need / have) * 100) : 100}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-white border border-steel-200">
      <div className="h-8 px-3 flex items-center justify-between bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50';
const td = 'px-3 py-1.5 border-b border-steel-100';

/**
 * AI recommendation plus a free chooser: every CPU, module and HMI is listed;
 * options too weak for this machine are grey with the reason, anything that
 * fits (including bigger than recommended) can be chosen.
 */
export default function EquipmentPanel({ onApplied }: { onApplied?: () => void }) {
  const settings = useSettingsStore();
  const spec = useSpecStore((s) => s.sections);
  const project = useProjectStore();
  const appliedHmi = useHmiStore((s) => s.hmiPartNumber);
  const ioPoints = useIOStore((s) => s.projectIO);
  // Global AI job: keeps running across pages; the recommendation is shown here when it arrives.
  const busy = useAiJobRunning('equipment');
  const error = useAiJobError('equipment');
  const [reasoning, setReasoning] = useState<string | null>(null);
  // A new AI suggestion stays with the project until applied; dropped if the applied one changes.
  const recBasis = JSON.stringify(project.recommendation);
  const [pendingRec, setPendingRec] = useDraft<{ basis: string; rec: EquipmentRecommendation | null } | null>('equipment.rec', null);
  const rec = pendingRec && pendingRec.basis === recBasis ? pendingRec.rec : project.recommendation;
  const setRec = (r: EquipmentRecommendation | null) => setPendingRec({ basis: recBasis, rec: r });
  // The selection being edited; starts from what's applied, else the recommendation. Kept with the
  // project until applied (so leaving the page never loses it), and dropped if the applied
  // equipment changes elsewhere (wizard, update all stages).
  const appliedChoice: EquipmentChoice | null = project.cpuId && project.recommendation ? { cpuId: project.cpuId, modules: project.modules, hmiPartNumber: appliedHmi || null }
    : project.recommendation ? recommendedChoice(project.recommendation) : null;
  const basis = JSON.stringify([project.cpuId, project.modules, appliedHmi || null]);
  const [pending, setPending] = useDraft<{ basis: string; choice: EquipmentChoice | null } | null>('equipment.choice', null);
  const choice = pending && pending.basis === basis ? pending.choice : appliedChoice;
  const setChoice = (next: EquipmentChoice | null | ((c: EquipmentChoice | null) => EquipmentChoice | null)) =>
    setPending({ basis, choice: typeof next === 'function' ? next(choice) : next });

  const specEmpty = !Object.values(spec).some((t) => typeof t === 'string' && t.trim());
  const apiKey = settings.anthropicApiKey;

  // What the machine needs: the AI estimate, or the real I/O list once it exists (whichever is larger).
  const need: Need = useMemo(() => {
    const realIn = ioPoints.filter((p) => p.type === 'input').length;
    const realOut = ioPoints.filter((p) => p.type === 'output').length;
    const recHmi = rec?.hmi ? getHmi(rec.hmi.partNumber) : undefined;
    return {
      digitalInputs: Math.max(rec?.estimatedIO.digitalInputs ?? 0, realIn),
      digitalOutputs: Math.max(rec?.estimatedIO.digitalOutputs ?? 0, realOut),
      analogInputs: rec?.estimatedIO.analogInputs ?? 0,
      analogOutputs: rec?.estimatedIO.analogOutputs ?? 0,
      ethernetHmi: Boolean(choice?.hmiPartNumber),
      minHmiSizeIn: recHmi ? recHmi.sizeIn : null,
    };
  }, [ioPoints, rec, choice?.hmiPartNumber]);

  const recommend = () => {
    if (!apiKey || specEmpty) return;
    void startAiJob({
      kind: 'equipment', label: 'Equipment selection', keepResult: true,
      run: (h) => recommendEquipment({ apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal, spec }),
    });
  };
  useTakeResult<Awaited<ReturnType<typeof recommendEquipment>>>('equipment', (r) => {
    setRec(r.rec);
    setChoice(recommendedChoice(r.rec));
    setReasoning(r.reasoning);
  });

  const cpus = PLC_PROFILES.filter((p) => p.available && p.language === 'ladder').flatMap((p) => p.cpuModels);
  // Expansion modules of the chosen CPU's platform (multi-vendor profiles); CLICK modules otherwise.
  const platform = choice ? platformOf(choice.cpuId) : undefined;
  const modules = platform ? platform.modules.map((m) => getPart(m)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : partsIn('plcModule');
  // Touch panels: C-more and every catalog maker's panels; the project's preferred HMI makers
  // first (Brand preference), all makers on request. A panel whose resolution is not confirmed
  // is listed but cannot be chosen (screens are never laid out on a guessed resolution).
  const hmiMakers = normalizePreference(project.info.vendors).hmi;
  const [allMakers, setAllMakers] = useUi('equipment.allHmiMakers', false);
  const panelRows: { pn: string; maker: string; sizeIn: number; res: string; model: HmiModel | null }[] = [
    ...HMI_MODELS.filter((h) => h.touch).map((h) => ({ pn: h.partNumber, maker: 'AutomationDirect', vendor: 'automationdirect', sizeIn: h.sizeIn, res: `${h.widthPx}×${h.heightPx}`, model: h as HmiModel | null })),
    ...catalogPanels().filter((o) => o.model?.touch !== false).map((o) => ({ pn: o.part.partNumber, maker: o.part.manufacturer, vendor: o.part.vendor ?? '', sizeIn: Number(o.part.ratings.displayIn ?? o.part.ratings.sizeIn ?? 0), res: o.model ? `${o.model.widthPx}×${o.model.heightPx}` : '—', model: o.model })),
  ].filter((r) => allMakers || hmiMakers.includes(r.vendor as never) || r.pn === choice?.hmiPartNumber);
  const cpu = choice ? findCpu(choice.cpuId) : null;
  const fit = cpu && choice ? cpuFit(cpu, choice.modules, need) : null;
  const cap = cpu && choice ? ioCapacity(cpu, moduleSlots(choice.modules)) : null;
  const applied = Boolean(project.recommendation) && choice?.cpuId === project.cpuId
    && JSON.stringify(choice?.modules) === JSON.stringify(project.modules) && (choice?.hmiPartNumber ?? '') === (appliedHmi ?? '');

  const set = (patch: Partial<EquipmentChoice>) => setChoice((c) => ({ cpuId: c?.cpuId ?? cpus[0].id, modules: c?.modules ?? [], hmiPartNumber: c?.hmiPartNumber ?? null, ...patch }));
  const apply = () => {
    if (!choice || !fit?.ok) return;
    applyEquipment(choice, rec);
    onApplied?.();
  };

  return (
    <div className="space-y-4">
      <VendorPreferenceCard />
      <div className="bg-white border border-steel-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-64">
          <h3 className="font-semibold text-steel-900">Control equipment</h3>
          <p className="text-steel-600">The AI suggests a configuration from your description. You decide: every option is listed below. Options too small for this machine are grey; anything that fits can be chosen, including bigger than suggested.</p>
        </div>
        <button onClick={recommend} disabled={busy || !apiKey || specEmpty}
          className="px-4 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          {busy ? <><Spinner /> Selecting equipment…</> : rec ? 'Suggest again' : 'Suggest equipment'}
        </button>
        {specEmpty && <p className="w-full text-amber-800">Describe the machine first on the <Link to="/spec" className="underline">Machine description</Link> step.</p>}
        {!apiKey && !specEmpty && <p className="w-full text-amber-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</p>}
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 p-3 text-red-800">{error}</div>}
      {reasoning && <ReasoningPanel reasoning={reasoning} />}
      {choice && !applied && (
        <div role="status" className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 shadow-sm">
          <span className="flex-1 min-w-48">Your equipment selection ({choice.cpuId}{choice.modules.length ? ` + ${choice.modules.length} module(s)` : ''}{choice.hmiPartNumber ? `, ${choice.hmiPartNumber}` : ''}) is not applied to the project yet.</span>
          <button onClick={apply} disabled={!fit?.ok} className="px-3 py-1 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-40">Use this selection</button>
        </div>
      )}

      {rec && (
        <div className="bg-brand-50 border border-brand-200 p-3 text-steel-800">
          <span className="font-semibold text-brand-800">AI suggestion: </span>{rec.summary}
          <span className="block mt-1 text-xs text-steel-600">CPU {rec.plc.cpuId}: {rec.plc.why}{rec.hmi ? ` · HMI ${rec.hmi.partNumber}: ${rec.hmi.why}` : ''}</span>
        </div>
      )}

      <BrandHardwareCard need={need} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <Section title="PLC CPU">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>{['', 'Part number', 'Inputs', 'Outputs', 'Features', 'Fits this machine?'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {cpus.map((c) => {
                    const f = cpuFit(c, choice?.modules ?? [], need);
                    const selected = choice?.cpuId === c.id;
                    return (
                      <tr key={c.id} onClick={() => f.ok && set({ cpuId: c.id })}
                        className={`${f.ok ? 'cursor-pointer hover:bg-brand-50' : 'text-steel-400 bg-steel-50/60 cursor-not-allowed'} ${selected ? 'bg-brand-100' : ''}`}>
                        <td className={td}><input type="radio" readOnly checked={selected} disabled={!f.ok} aria-label={`Choose ${c.id}`} /></td>
                        <td className={`${td} font-mono`}>{c.id}{rec?.plc.cpuId === c.id && <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-sm font-sans">SUGGESTED</span>}</td>
                        <td className={td}>{c.builtInInputs}</td>
                        <td className={td}>{c.builtInOutputs}</td>
                        <td className={`${td} text-xs`}>{[/ethernet/i.test(c.label) && 'Ethernet', /analog/i.test(c.label) && 'Analog', /relay/i.test(c.label) && 'Relay out', /sourcing/i.test(c.label) && 'Sourcing out', /CLICK PLUS/.test(c.label) && 'CLICK PLUS'].filter(Boolean).join(' · ')}</td>
                        <td className={`${td} text-xs`}>{f.ok ? <span className="text-green-700">Yes · {f.spareIn} in / {f.spareOut} out spare</span> : f.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`I/O expansion modules (slot order, max ${MAX_MODULES})`}
            aside={<button disabled={(choice?.modules.length ?? 0) >= MAX_MODULES} onClick={() => set({ modules: [...(choice?.modules ?? []), modules[0].partNumber] })} className="text-xs text-brand-800 hover:underline disabled:opacity-40">+ Add module</button>}>
            {!(choice?.modules.length) ? <p className="px-3 py-2 text-steel-500">No expansion modules: the CPU's built-in I/O is used.</p> : (
              <table className="w-full">
                <tbody>
                  {choice.modules.map((m, i) => (
                    <tr key={i}>
                      <td className={`${td} w-16 text-steel-500`}>Slot {i + 1}</td>
                      <td className={td}>
                        <select value={m} onChange={(e) => set({ modules: choice.modules.map((x, j) => (j === i ? e.target.value : x)) })} className="w-full border border-steel-300 rounded-sm px-2 py-1 bg-white">
                          {modules.map((p) => <option key={p.partNumber} value={p.partNumber}>{p.partNumber} — {p.description}</option>)}
                        </select>
                      </td>
                      <td className={`${td} w-8`}><button onClick={() => set({ modules: choice.modules.filter((_, j) => j !== i) })} className="text-steel-400 hover:text-red-600" aria-label={`Remove slot ${i + 1}`}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Operator panel (HMI)"
            aside={<label className="text-xs text-steel-600 flex items-center gap-1.5"><input type="checkbox" checked={allMakers} onChange={(e) => setAllMakers(e.target.checked)} /> Every maker's panels</label>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>{['', 'Part number', 'Maker', 'Size', 'Resolution', 'Fits this machine?'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr onClick={() => set({ hmiPartNumber: null })} className={`cursor-pointer hover:bg-brand-50 ${!choice?.hmiPartNumber ? 'bg-brand-100' : ''}`}>
                    <td className={td}><input type="radio" readOnly checked={!choice?.hmiPartNumber} aria-label="No HMI" /></td>
                    <td className={td} colSpan={5}>No touch panel (pushbuttons and lights only)</td>
                  </tr>
                  {panelRows.map((r) => {
                    const f = r.model ? hmiFit(r.model, need, choice?.cpuId) : { ok: false, reason: "Resolution not confirmed on the maker's datasheet yet." };
                    const selected = choice?.hmiPartNumber === r.pn;
                    return (
                      <tr key={r.pn} onClick={() => f.ok && set({ hmiPartNumber: r.pn })}
                        className={`${f.ok ? 'cursor-pointer hover:bg-brand-50' : 'text-steel-400 bg-steel-50/60 cursor-not-allowed'} ${selected ? 'bg-brand-100' : ''}`}>
                        <td className={td}><input type="radio" readOnly checked={selected} disabled={!f.ok} aria-label={`Choose ${r.pn}`} /></td>
                        <td className={`${td} font-mono`}>{r.pn}{rec?.hmi?.partNumber === r.pn && <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-sm font-sans">SUGGESTED</span>}</td>
                        <td className={`${td} text-xs`}>{r.maker}</td>
                        <td className={td}>{r.sizeIn ? `${r.sizeIn}"` : '—'}</td>
                        <td className={td}>{r.res}</td>
                        <td className={`${td} text-xs`}>{f.ok ? <span className="text-green-700">Yes</span> : f.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0">
          <Section title="Your selection">
            <div className="p-3 space-y-3">
              {choice && cpu ? (
                <>
                  <dl className="space-y-1">
                    <div className="flex justify-between"><dt className="text-steel-500">CPU</dt><dd className="font-mono">{cpu.id}</dd></div>
                    {choice.modules.map((m, i) => <div key={i} className="flex justify-between"><dt className="text-steel-500">Slot {i + 1}</dt><dd className="font-mono">{m}</dd></div>)}
                    <div className="flex justify-between"><dt className="text-steel-500">HMI</dt><dd className="font-mono">{choice.hmiPartNumber ?? 'none'}</dd></div>
                  </dl>
                  {cap && <CapacityBar label="Digital inputs" need={need.digitalInputs} have={cap.inputs} />}
                  {cap && <CapacityBar label="Digital outputs" need={need.digitalOutputs} have={cap.outputs} />}
                  {fit && !fit.ok && <p className="text-red-700 text-xs">{fit.reason}</p>}
                  {applied ? (
                    <p className="text-xs bg-green-50 border border-green-200 text-green-800 px-2 py-1.5">Applied to the project.</p>
                  ) : (
                    <button onClick={apply} disabled={!fit?.ok} className="w-full px-4 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-40">Use this selection</button>
                  )}
                  {choice.modules.some((m) => !getPart(m)) && <p className="text-xs text-amber-700">A module is not in the catalog.</p>}
                </>
              ) : (
                <p className="text-steel-500">Ask for a suggestion, or pick a CPU from the list.</p>
              )}
            </div>
          </Section>
          {rec && rec.alternatives.length > 0 && (
            <Section title="Other suggestions">
              <div className="p-3 space-y-3">
                {rec.alternatives.map((a, i) => (
                  <div key={i}>
                    <div className="font-medium text-steel-800">{a.label}</div>
                    <div className="text-xs font-mono text-steel-600">{a.cpuId}{a.hmiPartNumber ? ` · ${a.hmiPartNumber}` : ''}</div>
                    <p className="text-xs text-steel-600">{a.tradeoff}</p>
                    <button onClick={() => set({ cpuId: a.cpuId, hmiPartNumber: a.hmiPartNumber })} className="text-xs text-brand-800 font-medium hover:underline">Select</button>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {rec && rec.cautions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1">Please note</h4>
              <ul className="list-disc pl-4 text-amber-900 space-y-1">{rec.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
