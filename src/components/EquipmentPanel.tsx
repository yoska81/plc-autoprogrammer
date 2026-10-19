import { addedOperatorPoints } from '../spec/operatorIo';
import { isAnalog } from '../types/io';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSpecStore } from '../store/useSpecStore';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { useIOStore } from '../store/useIOStore';
import { PLC_PROFILES } from '../plc/core/profiles';
import { getPart, partsIn } from '../electrical/catalog';
import { getHmi } from '../hmi/hmiCatalog';
import { normalizePreference } from '../electrical/catalogs';
import { moduleSlots, ioCapacity } from '../plc/core/modules';
import { cpuFit, findCpu, hmiFit, platformOf, type Need } from '../plc/core/fit';
import { nearestPanel } from '../hmi/nearestPanel';
import { recommendEquipment, type EquipmentRecommendation } from '../lib/ai/equipmentAI';
import { applyEquipment, recommendedChoice, usePendingEquipment, type EquipmentChoice } from '../spec/equipment';
import HmiChooser from './HmiChooser';
import { hasBuiltInPanel } from '../hmi/panels';
import VendorPreferenceCard from './VendorPreferenceCard';
import BrandHardwareCard from './BrandHardwareCard';
import { Spinner, ReasoningPanel } from './common';
import { useDraft } from '../store/useDraftStore';
import { useUi } from '../store/useUiStore';
import { plcPreferenceOf, requestedProfiles, vendorOf } from '../spec/brand';
import { specToText } from '../spec/types';
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
  /** Why the touch panel changed with the PLC (it could not stay), shown under the panel chooser. */
  const [panelNote, setPanelNote] = useState<string | null>(null);
  // A new AI suggestion stays with the project until applied; dropped if the applied one changes.
  const recBasis = JSON.stringify(project.recommendation);
  const [pendingRec, setPendingRec] = useDraft<{ basis: string; rec: EquipmentRecommendation | null } | null>('equipment.rec', null);
  const rec = pendingRec && pendingRec.basis === recBasis ? pendingRec.rec : project.recommendation;
  const setRec = (r: EquipmentRecommendation | null) => setPendingRec({ basis: recBasis, rec: r });
  // The selection being edited; starts from what's applied, else the recommendation. Kept with the
  // project until applied (so leaving the page never loses it), and dropped if the applied
  // equipment changes elsewhere (wizard, update all stages).
  // Without any AI suggestion the chooser starts from the project's current equipment: everything can be chosen by hand.
  const firstCpu = PLC_PROFILES.find((p) => p.available && p.language === 'ladder')?.cpuModels[0]?.id ?? '';
  const appliedChoice: EquipmentChoice | null = project.cpuId ? { cpuId: project.cpuId, modules: project.modules, hmiPartNumber: appliedHmi || null }
    : project.recommendation ? recommendedChoice(project.recommendation)
    : firstCpu ? { cpuId: firstCpu, modules: [], hmiPartNumber: null } : null;
  const basis = JSON.stringify([project.cpuId, project.modules, appliedHmi || null]);
  const [pending, setPending] = useDraft<{ basis: string; choice: EquipmentChoice | null } | null>('equipment.choice', null);
  const choice = pending && pending.basis === basis ? pending.choice : appliedChoice;
  const setChoice = (next: EquipmentChoice | null | ((c: EquipmentChoice | null) => EquipmentChoice | null)) =>
    setPending({ basis, choice: typeof next === 'function' ? next(choice) : next });

  const specEmpty = !Object.values(spec).some((t) => typeof t === 'string' && t.trim());
  const apiKey = settings.anthropicApiKey;

  // What the machine needs: the real I/O list once it exists (the same count the design review uses),
  // the AI estimate before that.
  const need: Need = useMemo(() => {
    // Analog points count against analog channels, not the discrete inputs/outputs.
    const count = (type: 'input' | 'output', analog: boolean) => ioPoints.filter((p) => p.type === type && isAnalog(p) === analog).length;
    const recHmi = rec?.hmi ? getHmi(rec.hmi.partNumber) : undefined;
    const est = rec?.estimatedIO;
    const n = (k: 'digitalInputs' | 'digitalOutputs' | 'analogInputs' | 'analogOutputs', type: 'input' | 'output', analog: boolean) => (ioPoints.length ? count(type, analog) : est?.[k] ?? 0);
    return {
      digitalInputs: n('digitalInputs', 'input', false),
      digitalOutputs: n('digitalOutputs', 'output', false),
      analogInputs: n('analogInputs', 'input', true),
      analogOutputs: n('analogOutputs', 'output', true),
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
  // The brand asked for (named in the description or set in Brand preference), else the chosen PLC's: its CPUs and its
  // panels first; the other brands are one click away, never hidden for good.
  const asked = requestedProfiles(specToText(spec), plcPreferenceOf(project.info.vendors?.plc, project.info.plcChosen));
  const mainProfiles = asked.length ? asked : PLC_PROFILES.filter((p) => p.cpuModels.some((c) => c.id === (choice?.cpuId ?? project.cpuId)));
  const isMain = (id: string) => !mainProfiles.length || mainProfiles.some((p) => p.cpuModels.some((c) => c.id === id));
  const [otherCpus, setOtherCpus] = useUi('equipment.otherBrandCpus', false);
  const otherCount = cpus.filter((c) => !isMain(c.id)).length;
  const shownCpus = otherCpus ? cpus : cpus.filter((c) => isMain(c.id) || c.id === choice?.cpuId);
  // Expansion modules of the chosen CPU's platform (multi-vendor profiles); CLICK modules otherwise.
  const platform = choice ? platformOf(choice.cpuId) : undefined;
  const modules = platform ? platform.modules.map((m) => getPart(m)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : partsIn('plcModule');
  // Touch panels: C-more and every catalog maker's panels; the project's preferred HMI makers
  // first (Brand preference), all makers on request. A panel whose resolution is not confirmed
  // is listed but cannot be chosen (screens are never laid out on a guessed resolution).
  // Panels of the HMI brands the user chose; none chosen: the PLC brand's own panels first (C-more for CLICK).
  const plcVendor = mainProfiles[0] ? vendorOf(mainProfiles[0]) : '';
  const hmiMakers = project.info.vendors?.hmi?.length || !plcVendor ? normalizePreference(project.info.vendors).hmi : [plcVendor];
  const cpu = choice ? findCpu(choice.cpuId) : null;
  const fit = cpu && choice ? cpuFit(cpu, choice.modules, need) : null;
  const cap = cpu && choice ? ioCapacity(cpu, moduleSlots(choice.modules)) : null;
  // something to apply: the user's own pick, or the AI's suggestion (not the default a fresh project starts from)
  const chosen = Boolean(pending && pending.basis === basis) || Boolean(project.recommendation);
  const applied = choice?.cpuId === project.cpuId
    && JSON.stringify(choice?.modules) === JSON.stringify(project.modules) && (choice?.hmiPartNumber ?? '') === (appliedHmi ?? '');

  // An all-in-one PLC brings its own screen: choosing it selects that screen. Leaving it, or moving to a PLC the
  // chosen panel cannot talk to, selects the closest panel that can (screens scale least) and says so.
  const withCpu = (cpuId: string): Partial<EquipmentChoice> => {
    setPanelNote(null);
    if (hasBuiltInPanel(getPart(cpuId))) return { cpuId, hmiPartNumber: cpuId };
    const old = choice?.hmiPartNumber;
    const was = old ? getHmi(old) : undefined;
    const builtIn = Boolean(old && hasBuiltInPanel(getPart(old)));
    if (!old || (!builtIn && was && hmiFit(was, need, cpuId).ok)) return { cpuId };
    const next = nearestPanel(cpuId, need, was ? { w: was.widthPx, h: was.heightPx } : null, hmiMakers);
    const why = builtIn ? `The ${old} screen is built into that PLC, so it goes with it.` : `The ${old} cannot talk to the ${cpuId}.`;
    setPanelNote(next
      ? `${why} ${next.partNumber} (${next.sizeIn}", ${next.widthPx}×${next.heightPx}) is selected instead: the closest touch panel that can. Designed screens are kept and scaled to it; pick another below if you prefer.`
      : `${why} Choose a touch panel for the ${cpuId} below; designed screens are kept and scaled to it.`);
    return { cpuId, hmiPartNumber: next?.partNumber ?? null };
  };
  const set = (patch: Partial<EquipmentChoice>) => setChoice((c) => ({ cpuId: c?.cpuId ?? cpus[0].id, modules: c?.modules ?? [], hmiPartNumber: c?.hmiPartNumber ?? null, ...patch }));
  const apply = () => {
    if (!choice || !fit?.ok) return;
    // Back from "No touch panel" to a panel: offer to remove the door pushbuttons, selector and lamps it added.
    const doorPoints = choice.hmiPartNumber && !appliedHmi && project.cpuId ? addedOperatorPoints(useIOStore.getState().projectIO) : [];
    if (doorPoints.length && confirm(`The touch panel takes over Start, Stop, Reset and Auto/Manual. Remove the door devices added for "No touch panel"?\n\n${doorPoints.map((p) => `• ${p.description}`).join('\n')}\n\n(Cancel keeps them: the program then uses both.)`)) {
      useIOStore.getState().applyIOUpdate([], [], doorPoints.map((p) => p.id));
    }
    // A panel that cannot talk to the chosen CPU is never applied: the closest one that can takes its place (said).
    const panel = choice.hmiPartNumber ? getHmi(choice.hmiPartNumber) : undefined;
    const talks = !choice.hmiPartNumber || hasBuiltInPanel(getPart(choice.hmiPartNumber)) || (panel ? hmiFit(panel, need, choice.cpuId).ok : true);
    const checked = talks ? choice : { ...choice, ...withCpu(choice.cpuId) };
    if (!talks) setChoice(checked);
    const warning = applyEquipment(checked, rec);
    if (warning) alert(warning);
    onApplied?.();
  };
  // Let the New project wizard apply a selection the user did not apply themselves.
  const pendingLabel = choice && !applied && chosen ? `${choice.cpuId}${choice.hmiPartNumber ? ` + ${choice.hmiPartNumber}` : ''}` : null;
  const canApply = Boolean(pendingLabel && fit?.ok);
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; });
  useEffect(() => {
    usePendingEquipment.setState({ apply: canApply ? () => applyRef.current() : null, label: pendingLabel });
    return () => usePendingEquipment.setState({ apply: null, label: null });
  }, [canApply, pendingLabel]);

  return (
    <div className="space-y-4">
      <VendorPreferenceCard />
      <div className="bg-white border border-steel-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-64">
          <h3 className="font-semibold text-steel-900">Control equipment</h3>
          <p className="text-steel-600">Choose the PLC, I/O modules and touch panel yourself in the lists below, or let the AI suggest a configuration from your description (optional). Options too small for this machine are grey.</p>
        </div>
        <button onClick={recommend} disabled={busy || !apiKey || specEmpty}
          className="px-4 py-1.5 font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          {busy ? <><Spinner /> Selecting equipment…</> : rec ? 'Suggest again (AI)' : 'Suggest for me (AI, optional)'}
        </button>
        {specEmpty && <p className="w-full text-amber-800">Describe the machine first on the <Link to="/spec" className="underline">Machine description</Link> step.</p>}
        {!apiKey && !specEmpty && <p className="w-full text-amber-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</p>}
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 p-3 text-red-800">{error}</div>}
      {reasoning && <ReasoningPanel reasoning={reasoning} />}
      {choice && !applied && chosen && (
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

      <BrandHardwareCard need={need} onPick={(cpuId, mods) => set({ ...withCpu(cpuId), modules: mods })} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <Section title="PLC CPU">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>{['', 'Part number', 'Inputs', 'Outputs', 'Features', 'Fits this machine?'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {shownCpus.map((c) => {
                    const f = cpuFit(c, choice?.modules ?? [], need);
                    const selected = choice?.cpuId === c.id;
                    return (
                      <tr key={c.id} onClick={() => f.ok && set(withCpu(c.id))}
                        className={`${f.ok ? 'cursor-pointer hover:bg-brand-50' : 'text-steel-400 bg-steel-50/60 cursor-not-allowed'} ${selected ? 'bg-brand-100' : ''}`}>
                        <td className={td}><input type="radio" readOnly checked={selected} disabled={!f.ok} aria-label={`Choose ${c.id}`} /></td>
                        <td className={`${td} font-mono`}>{c.id}{rec?.plc.cpuId === c.id && <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-sm font-sans">SUGGESTED</span>}</td>
                        <td className={td}>{c.builtInInputs}</td>
                        <td className={td}>{c.builtInOutputs}</td>
                        <td className={`${td} text-xs`}>{[/ethernet/i.test(c.label) && 'Ethernet', /analog/i.test(c.label) && 'Analog', /relay/i.test(c.label) && 'Relay out', /sourcing/i.test(c.label) && 'Sourcing out', /CLICK PLUS/.test(c.label) && 'CLICK PLUS', /built-in [\d.]+" touch screen/.test(c.label) && 'Built-in touch screen'].filter(Boolean).join(' · ')}</td>
                        <td className={`${td} text-xs`}>{f.ok ? <span className="text-green-700">Yes · {f.spareIn} in / {f.spareOut} out spare</span> : f.reason}</td>
                      </tr>
                    );
                  })}
                  {otherCount > 0 && (
                    <tr><td colSpan={6} className={`${td} text-xs`}>
                      <button onClick={() => setOtherCpus(!otherCpus)} className="text-brand-800 font-medium hover:underline" aria-expanded={otherCpus}>
                        {otherCpus ? `Show only ${[...new Set(mainProfiles.map((p) => `${p.vendor} ${p.name}`))].join(' / ')} CPUs` : `Show ${otherCount} CPUs of other brands`}
                      </button>
                    </td></tr>
                  )}
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

          <Section title="Operator panel (HMI)">
            {panelNote && <p role="status" data-testid="panel-note" className="mb-2 text-sm rounded border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">{panelNote}</p>}
            <HmiChooser need={need} cpuId={choice?.cpuId} selected={choice?.hmiPartNumber ?? null} suggested={rec?.hmi?.partNumber}
              makers={hmiMakers} onPick={(pn) => { setPanelNote(null); set({ hmiPartNumber: pn }); }} />
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
                  {applied && fit && !fit.ok ? (
                    <p className="text-xs bg-red-50 border border-red-200 text-red-800 px-2 py-1.5">This is the project's PLC, but it cannot hold the I/O list. Choose a larger CPU or add modules.</p>
                  ) : applied ? (
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
                    <button onClick={() => {
                      // The suggestion's own panel when it talks to that CPU, else the same check as any CPU change.
                      const own = a.hmiPartNumber ? getHmi(a.hmiPartNumber) : undefined;
                      if (a.hmiPartNumber && (hasBuiltInPanel(getPart(a.hmiPartNumber)) || (own && hmiFit(own, need, a.cpuId).ok))) { setPanelNote(null); set({ cpuId: a.cpuId, hmiPartNumber: a.hmiPartNumber }); }
                      else set(withCpu(a.cpuId));
                    }} className="text-xs text-brand-800 font-medium hover:underline">Select</button>
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
