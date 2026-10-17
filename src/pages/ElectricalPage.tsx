import { useMemo, useState } from 'react';
import { looksLeftOver } from '../spec/leftovers';
import { Link, useSearchParams } from 'react-router-dom';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProgramStore } from '../store/useProgramStore';
import { usePlc } from '../plc/core/usePlc';
import { getPart, partsIn } from '../electrical/catalog';
import { catalogFor } from '../electrical/catalogs';
import PartPicker from '../electrical/PartPicker';
import type { ElectricalDesign } from '../electrical/types';
import { buildDrawingsPdf, saveBlob } from '../deliverables/files';
import { collectProject } from '../deliverables/collect';
import { printPdf } from '../deliverables/printPdf';
import { sheetOnPaper } from '../standards/regions';
import { notify } from '../store/useNoticeStore';
import { keyRatings } from '../electrical/strength';
import { useProjectStore, useVendorPreference, type Region } from '../store/useProjectStore';
import { hpToKw, isIec, NEMA_TO_IP, REGIONS, regionSpec, SUPPLY_INFO } from '../standards/regions';
import { applyRegion, regionOption } from '../standards/applyRegion';
import { bomCsv, cableScheduleCsv, designWarnings, motorFla, wireListCsv } from '../electrical/derive';
import CabinetPictures from '../electrical/CabinetPictures';
import EnclosureFitBanner from '../electrical/EnclosureFitBanner';
import MachiningPanel from '../electrical/MachiningPanel';
import LabelsPanel from '../electrical/labels/LabelsPanel';
import MachineLayoutPanel from '../electrical/layout/MachineLayoutPanel';
import { userNotes } from '../components/questions/classify';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions, useSyncQuestions } from '../components/questions/useQuestionStore';
import { useDrawingContext } from '../electrical/useDrawingContext';
import DrawingSet from '../electrical/drawings/DrawingSet';
import { generateElectricalDesign } from '../lib/ai/electricalAI';
import { generateRuleBasedDesign } from '../lib/ai/machineModelAI';
import { useHmiStore } from '../store/useHmiStore';
import type { CatalogCategory, DesignInputs, EnclosureRating, MotorSpec, StarterType, SupplyVoltage } from '../electrical/types';
import { Spinner, ReasoningPanel } from '../components/common';
import StageBanner from '../components/StageBanner';
import { useFingerprints, useStages } from '../spec/useStages';
import { useStageStore } from '../store/useStageStore';
import { specToText } from '../spec/types';
import { useDraft } from '../store/useDraftStore';
import { useUi } from '../store/useUiStore';
import { startAiJob, useAiJobError, useTakeResult } from '../lib/ai/jobs';

const ENCLOSURES: EnclosureRating[] = ['NEMA 12', 'NEMA 4', 'NEMA 4X', 'NEMA 1'];
const STARTERS: { value: StarterType; label: string }[] = [
  { value: 'contactor-overload', label: 'Contactor + overload' },
  { value: 'motor-protector', label: 'Motor protector + contactor' },
  { value: 'vfd', label: 'VFD (variable speed)' },
];
const CATEGORY_LABEL: Partial<Record<CatalogCategory, string>> = {
  enclosure: 'Enclosure', disconnect: 'Disconnect switch', breaker: 'Circuit breaker', fuse: 'Fuse / fuse holder', powerSupply: 'Power supply',
  contactor: 'Contactor', overload: 'Overload relay', motorProtector: 'Motor protector', vfd: 'Variable-speed drive (VFD)',
  relay: 'Relay', safetyRelay: 'Safety relay', terminal: 'Terminal block', terminalAccessory: 'Terminal accessory',
  pushbutton: 'Pushbutton', estop: 'E-stop', pilotLight: 'Pilot light', selector: 'Selector switch', stackLight: 'Stack light',
  plc: 'PLC CPU', plcModule: 'PLC I/O module', hmi: 'Touch panel (HMI)', sensor: 'Sensor', solenoidValve: 'Solenoid valve',
  dinRail: 'DIN rail', wireDuct: 'Wire duct', groundBar: 'Ground bar', fan: 'Fan / filter', other: 'Other',
};

const input = 'border border-steel-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const card = 'bg-white rounded-sm border border-steel-200 p-5';

const download = (name: string, content: string, mime: string) => saveBlob(name, new Blob([content], { type: mime }));

type Tab = 'design' | 'cabinet' | 'machine' | 'layout' | 'picture' | 'machining' | 'labels';

const TAB_TITLE: Record<Tab, string> = { design: 'Design', cabinet: 'Cabinet wiring', machine: 'Machine wiring', layout: 'Machine layout', picture: 'Cabinet picture', machining: 'Machining (DXF)', labels: 'Labels' };

/** The motor a component belongs to (its branch protection is limited by the motor current). */
function motorContext(d: ElectricalDesign, tag: string | null | undefined, iec: boolean) {
  const m = tag ? d.inputs.motors.find((x) => x.tag === tag) : undefined;
  return m ? { tag: m.tag, fla: motorFla(m.hp, m.voltage), iec } : undefined;
}

export default function ElectricalPage() {
  const el = useElectricalStore();
  const settings = useSettingsStore();
  const { projectName } = useProgramStore();
  const fp = useFingerprints();
  const stages = useStages();
  const specText = specToText(fp.spec);
  const { profile, cpu, io, addresses, analog } = usePlc();
  const modules = useProjectStore((s) => s.modules);
  const hmiPartNumber = useHmiStore((s) => s.design?.hmiPartNumber || s.hmiPartNumber || null);
  const ctx = useDrawingContext();
  // The layout editor stores device tags: it works with the design's own tags.
  const rawCtx = useDrawingContext({ raw: true });

  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') as Tab | null;
  const tab: Tab = urlTab && ['design', 'cabinet', 'machine', 'layout', 'picture', 'machining', 'labels'].includes(urlTab) ? urlTab : el.design ? 'cabinet' : 'design';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [localError, setError] = useState<string | null>(null);
  // AI generation runs as a global job (keeps going across pages).
  const jobError = useAiJobError('electrical');
  const error = localError ?? jobError;
  const [reasoning, setReasoning] = useState<string | null>(null);
  const pref = useVendorPreference();
  const CATEGORIES = useMemo(() => [...new Set(catalogFor(pref).map((p) => p.category))].sort((a, b) => (CATEGORY_LABEL[a] ?? a).localeCompare(CATEGORY_LABEL[b] ?? b)) as CatalogCategory[], [pref]);
  const [pickCat, setPickCat] = useUi<CatalogCategory>('electrical.pickCat', 'breaker');
  const [pickPart, setPickPart] = useDraft('electrical.pickPart', '');
  const [swap, setSwap] = useState<number | null>(null);
  const region = useProjectStore((s) => s.info.region);

  // "Assumptions to confirm", answered under each item.
  useSyncQuestions('electrical', el.design ? userNotes(el.design).map((n) => ({ text: n, assumption: n })) : null);
  const elecQuestions = useQuestions('electrical');
  const { inputs } = el;
  const setInputs = (patch: Partial<DesignInputs>) => el.setInputs({ ...inputs, ...patch });
  const setMotor = (i: number, patch: Partial<MotorSpec>) =>
    setInputs({ motors: inputs.motors.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const warnings = useMemo(() => (ctx ? designWarnings(ctx) : []), [ctx]);
  const [pdfBusy, setPdfBusy] = useState<'print' | 'save' | null>(null);
  // The drawing set as a real PDF (one page per sheet, 1:1 on the project's paper): print it or save it.
  const drawingsPdf = async (mode: 'print' | 'save') => {
    setPdfBusy(mode);
    try {
      const pdf = await buildDrawingsPdf(collectProject());
      if (!pdf) { notify('There is no electrical design to print yet.'); return; }
      const name = `${base}_drawings.pdf`;
      if (mode === 'save') saveBlob(name, pdf);
      else {
        const paper = sheetOnPaper(ctx?.sheet ?? 'ANSI B').paper;
        const r = await printPdf(pdf, name, { wMm: paper.w, hMm: paper.h });
        if (r === 'saved') notify('Printing is not available here, so the drawings PDF was saved: open it and print from the PDF reader.');
      }
    } catch (e) {
      notify(`The drawings PDF could not be made: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPdfBusy(null);
    }
  };
  const base = projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'panel';
  const apiKey = settings.anthropicApiKey;

  /**
   * Generate: the AI reads the specification into a small machine model (when a key is set) and the
   * rule-based engine designs the panel from it — with no key, or when the AI fails, from the rules'
   * own reading. `full` = the older all-AI design (experimental: the AI picks every part).
   */
  const generate = (full = false) => {
    if (el.isGenerating || (full && !apiKey)) return;
    if (el.design && !confirm('Replace the current electrical design?')) return;
    setError(null);
    const snap = { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp };
    void startAiJob({
      kind: 'electrical', label: full ? 'Electrical design (full AI)' : 'Electrical design', keepResult: true,
      run: async (h) => {
        useElectricalStore.getState().setIsGenerating(true);
        try {
          if (full) {
            return await generateElectricalDesign({
              apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal,
              profile, cpu, io, addresses, machineDescription: specText, inputs, region,
            });
          }
          return await generateRuleBasedDesign({
            apiKey: apiKey || undefined, model: settings.anthropicModel, effort: settings.effort, signal: h.signal,
            spec: specText, io, addresses, inputs, region, pref, getPart, hmiPartNumber, analog, modules, projectName,
            plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
          });
        } finally { useElectricalStore.getState().setIsGenerating(false); }
      },
      apply: (r) => {
        const st = useElectricalStore.getState();
        st.setInputs(r.design.inputs);
        st.setDesign(r.design, 'generated', r.explanation);
        useStageStore.getState().markGenerated('electrical', snap);
      },
    });
  };
  useTakeResult<{ reasoning: string | null }>('electrical', (r) => {
    setReasoning(r.reasoning);
    setTab('cabinet');
  });

  return (
    <>
      <header className="px-6 py-3 bg-white border-b border-steel-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-steel-800">4 · Electrical Design{tab !== 'design' && <span className="font-normal text-steel-500"> — {TAB_TITLE[tab]}</span>}</h2>
            <p className="text-xs text-steel-400 mt-0.5">Control panel design and drawings · AutomationDirect parts · {profile.name} {cpu.id}</p>
          </div>
          {el.design && (
            <div className="flex gap-2">
              <button onClick={() => void drawingsPdf('print')} disabled={pdfBusy !== null} className="px-3 py-1.5 text-sm bg-steel-800 text-white rounded hover:bg-steel-900 disabled:opacity-60">{pdfBusy === 'print' ? 'Preparing…' : 'Print'}</button>
              <button onClick={() => void drawingsPdf('save')} disabled={pdfBusy !== null} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50 disabled:opacity-60">{pdfBusy === 'save' ? 'Preparing…' : 'Drawings PDF'}</button>
              {ctx && <button onClick={() => download(`${base}_BOM.csv`, bomCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">BOM CSV</button>}
              {ctx && <Link to="/export#order-list" className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Order list</Link>}
              {ctx && <button onClick={() => download(`${base}_cable_schedule.csv`, cableScheduleCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Cable schedule CSV</button>}
              {ctx && <button onClick={() => download(`${base}_wire_list.csv`, wireListCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Wire list CSV</button>}
            </div>
          )}
        </div>
      </header>

      <StageBanner info={stages.electrical} action={
        <button onClick={() => generate()} disabled={el.isGenerating} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded disabled:opacity-50">
          {el.isGenerating ? 'Updating…' : 'Update design'}
        </button>} />
      {ctx && el.design && <EnclosureFitBanner ctx={ctx} />}
      {tab === 'labels' ? (
        <LabelsPanel ctx={ctx} fileBase={base} projectName={projectName} />
      ) : tab === 'layout' ? (
        <MachineLayoutPanel ctx={rawCtx} />
      ) : tab === 'machining' ? (
        <MachiningPanel ctx={ctx} fileBase={base} />
      ) : tab === 'picture' ? (
        <CabinetPictures ctx={ctx} />
      ) : tab === 'cabinet' || tab === 'machine' ? (
        <div className="flex-1 overflow-hidden flex flex-col bg-steel-100">
          {ctx ? (
            <>
              {warnings.length > 0 && (
                <details className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-900">
                  <summary className="cursor-pointer font-medium">{warnings.length} item{warnings.length !== 1 && 's'} to check before building</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}
              <div className="flex-1 overflow-hidden"><DrawingSet ctx={ctx} section={tab} /></div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-steel-500">
              No design yet. Fill in the Design tab and click Generate.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-steel-50 p-6">
          <div className="max-w-5xl space-y-5">
            {el.source === 'imported' && (
              <div className="bg-brand-50 border border-brand-200 rounded p-3 text-sm text-brand-800">
                This design was read from an existing machine (Import). Generating a new design replaces it.
              </div>
            )}

            {/* Inputs */}
            <div className={`${card} space-y-4`}>
              <h3 className="text-sm font-semibold text-steel-800">1. Machine and power</h3>
              <p className="text-xs text-steel-500">
                The design is made from your <Link to="/spec" className="underline">spec</Link>
                {specText ? '' : ' (still empty: describe the machine first)'} and the <Link to="/io" className="underline">I/O List</Link> ({io.length} points). Motors and voltages below are filled in from the spec when you generate; adjust them if needed.
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="text-sm text-steel-700">Electrical code<br />
                  <select value={region} onChange={(e) => applyRegion(e.target.value as Region)} className={input} aria-label="Electrical code">
                    {REGIONS.map((r) => <option key={r.value} value={r.value}>{regionOption(r.value)}</option>)}
                  </select>
                </label>
                <label className="text-sm text-steel-700">Supply voltage<br />
                  <select value={inputs.supply} onChange={(e) => setInputs({ supply: e.target.value as SupplyVoltage })} className={input}>{regionSpec(region).supplies.map((s) => <option key={s} value={s}>{SUPPLY_INFO[s].label}</option>)}</select>
                </label>
                <label className="text-sm text-steel-700">Enclosure<br />
                  <select value={inputs.enclosureRating} onChange={(e) => setInputs({ enclosureRating: e.target.value as EnclosureRating })} className={input}>{ENCLOSURES.map((s) => <option key={s} value={s}>{isIec(region) ? `${NEMA_TO_IP[s]} (${s})` : s}</option>)}</select>
                </label>
              </div>
              <label className="block text-sm text-steel-700">Other requirements
                <textarea value={inputs.notes} onChange={(e) => setInputs({ notes: e.target.value })} rows={2}
                  placeholder="e.g. 3-color stack light, HMI on the door, 25% spare space, 120VAC outlet, panel max 30 x 24 in"
                  className={`${input} w-full mt-1`} />
              </label>
            </div>

            <div className={`${card} space-y-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-steel-800">2. Motors</h3>
                <button onClick={() => setInputs({ motors: [...inputs.motors, { tag: `M${inputs.motors.length + 1}`, description: '', hp: 1, voltage: inputs.supply, starter: 'contactor-overload', reversing: false }] })}
                  className="px-3 py-1 text-xs border border-steel-300 rounded hover:bg-steel-50">+ Add motor</button>
              </div>
              {inputs.motors.filter((m) => m.description.trim() && looksLeftOver(m.description, specText, 1).leftOver).map((m) => (
                <div key={m.tag} className="px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded" role="alert" data-testid="leftover-motor">
                  {m.tag} “{m.description}” is not in your machine description; it may be left over from another project.
                  <button onClick={() => setInputs({ motors: inputs.motors.filter((x) => x !== m) })} className="ml-2 underline font-medium">Remove {m.tag}</button>
                </div>
              ))}
              {!inputs.motors.length && <p className="text-xs text-steel-500">No motors. Add each motor the panel drives.</p>}
              {inputs.motors.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input value={m.tag} onChange={(e) => setMotor(i, { tag: e.target.value.toUpperCase() })} className={`${input} w-16 font-mono`} aria-label="Motor tag" />
                  <input value={m.description} onChange={(e) => setMotor(i, { description: e.target.value })} placeholder="Conveyor 1 drive" className={`${input} flex-1 min-w-40`} aria-label="Motor description" />
                  {isIec(region) ? (
                    // IEC regions: power in kW (stored as HP, the unit the rest of the design uses).
                    <label className="text-xs text-steel-500 flex items-center gap-1">kW
                      <input type="number" min={0.06} step={0.01} key={`kw-${m.hp}`} defaultValue={Math.round(hpToKw(m.hp) * 100) / 100}
                        onBlur={(e) => { const kw = Number(e.target.value); if (kw > 0 && Math.abs(kw - hpToKw(m.hp)) > 0.004) setMotor(i, { hp: kw / 0.7457 }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} className={`${input} w-20`} aria-label="Motor power (kW)" />
                    </label>
                  ) : (
                  <label className="text-xs text-steel-500 flex items-center gap-1">HP
                    <input type="number" min={0.1} step={0.25} value={m.hp} onChange={(e) => setMotor(i, { hp: Number(e.target.value) })} className={`${input} w-20`} />
                  </label>
                  )}
                  <select value={m.voltage} onChange={(e) => setMotor(i, { voltage: e.target.value as SupplyVoltage })} className={input} aria-label="Motor voltage">{regionSpec(region).supplies.map((s) => <option key={s} value={s}>{SUPPLY_INFO[s].label}</option>)}</select>
                  <select value={m.starter} onChange={(e) => setMotor(i, { starter: e.target.value as StarterType })} className={input} aria-label="Starter">{STARTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                  <label className="text-xs text-steel-600 flex items-center gap-1"><input type="checkbox" checked={m.reversing} onChange={(e) => setMotor(i, { reversing: e.target.checked })} /> Reversing</label>
                  <button onClick={() => setInputs({ motors: inputs.motors.filter((_, j) => j !== i) })} className="text-steel-400 hover:text-red-600 text-sm" aria-label="Remove motor">✕</button>
                </div>
              ))}
            </div>

            <div className={`${card} space-y-3`}>
              <h3 className="text-sm font-semibold text-steel-800">3. Parts you already chose <span className="font-normal text-steel-400">(optional; the AI picks the rest)</span></h3>
              <div className="flex flex-wrap gap-2">
                <select value={pickCat} onChange={(e) => { setPickCat(e.target.value as CatalogCategory); setPickPart(''); }} className={input} aria-label="Category">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
                </select>
                <select value={pickPart} onChange={(e) => setPickPart(e.target.value)} className={`${input} flex-1 min-w-64`} aria-label="Part">
                  <option value="">Choose a part…</option>
                  {partsIn(pickCat, pref).map((p) => <option key={p.partNumber} value={p.partNumber}>{p.partNumber} — {p.description}</option>)}
                </select>
                <button disabled={!pickPart} onClick={() => { setInputs({ requiredParts: [...inputs.requiredParts, { partNumber: pickPart, quantity: 1 }] }); setPickPart(''); }}
                  className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50 disabled:opacity-40">Add</button>
              </div>
              {inputs.requiredParts.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-mono w-40">{r.partNumber}</span>
                  <span className="flex-1 text-steel-600">{getPart(r.partNumber)?.description ?? 'not in catalog'}</span>
                  <input type="number" min={1} value={r.quantity} aria-label="Quantity"
                    onChange={(e) => setInputs({ requiredParts: inputs.requiredParts.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)) })}
                    className={`${input} w-16`} />
                  <button onClick={() => setInputs({ requiredParts: inputs.requiredParts.filter((_, j) => j !== i) })} className="text-steel-400 hover:text-red-600" aria-label="Remove part">✕</button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => generate()} disabled={el.isGenerating}
                className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                {el.isGenerating ? <><Spinner /> Designing the panel…</> : el.design ? 'Generate New Design' : 'Generate Electrical Design'}
              </button>
              <button onClick={() => generate(true)} disabled={el.isGenerating || !apiKey}
                title="The AI picks every part itself (slower; the standard design uses the AI only to read the specification)"
                className="px-3 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50 disabled:opacity-40">AI full design (experimental)</button>
              {!apiKey && <span className="text-xs text-steel-500">Without an API key the design is made from the I/O list and motor list by the rules only. Add a key in <Link to="/settings" className="underline">Settings</Link> to let the AI read the specification.</span>}
            </div>
            {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
            {reasoning && <ReasoningPanel reasoning={reasoning} />}

            {/* Result review */}
            {el.design && (
              <>
                {el.explanation && <div className={`${card} text-sm text-steel-700`}><h3 className="text-sm font-semibold text-steel-800 mb-1">Design summary</h3>{el.explanation}</div>}

                <div className={`${card} overflow-x-auto`}>
                  <h3 className="text-sm font-semibold text-steel-800 mb-2">Components ({el.design.components.length})</h3>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-steel-500 uppercase"><tr>{['Tag', 'Part', 'Qty', 'Function', ''].map((h) => <th key={h} className="text-left py-1 pr-2">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-steel-100">
                      {el.design.components.map((c, i) => {
                        const part = getPart(c.partNumber);
                        const options = part ? [...new Map([...partsIn(part.category, pref), part].map((x) => [x.partNumber, x])).values()] : [];
                        return (
                          <tr key={i}>
                            <td className="py-1 pr-2"><input value={c.tag} onChange={(e) => el.updateComponent(i, { ...c, tag: e.target.value.toUpperCase() })} className={`${input} w-20 font-mono`} aria-label="Tag" /></td>
                            <td className="py-1 pr-2">
                              {part ? (
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="font-mono">{c.partNumber}</div>
                                    <div className="text-xs text-steel-500 truncate max-w-md" title={part.description}>{keyRatings(part) || part.description}</div>
                                  </div>
                                  {options.length > 1 && <button onClick={() => setSwap(i)} className="ml-auto px-2 py-0.5 text-xs border border-steel-300 rounded-sm hover:bg-brand-50 hover:border-brand-300 whitespace-nowrap" aria-label={`Change ${c.tag}`}>Change…</button>}
                                </div>
                              ) : (
                                <span className="text-amber-700 text-xs">{c.partNumber || '(no part number)'} · not in catalog</span>
                              )}
                            </td>
                            <td className="py-1 pr-2"><input type="number" min={1} value={c.quantity} onChange={(e) => el.updateComponent(i, { ...c, quantity: Math.max(1, Number(e.target.value)) })} className={`${input} w-16`} aria-label="Quantity" /></td>
                            <td className="py-1 pr-2 text-steel-600">{c.function}</td>
                            <td className="py-1"><button onClick={() => { if (confirm(`Remove ${c.tag || 'this component'}${c.partNumber ? ` (${c.partNumber})` : ''}? Where the I/O list or the motor list still uses it, the drawings keep it and flag it as not in the BOM until the design is regenerated.`)) el.removeComponent(i); }} className="text-steel-400 hover:text-red-600" aria-label="Remove component">✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {swap !== null && el.design.components[swap] && (
                  <PartPicker tag={el.design.components[swap].tag} partNumber={el.design.components[swap].partNumber}
                    motor={motorContext(el.design, el.design.components[swap].motorTag, isIec(region))}
                    onPick={(pn) => el.updateComponent(swap, { ...el.design!.components[swap], partNumber: pn })} onClose={() => setSwap(null)} />
                )}

                <QuestionList questions={elecQuestions} title="Assumptions to confirm"
                  intro="The AI made these assumptions. Confirm each one, or type the correct value in the box under it; answers are saved in the Questions & answers of the machine description (part of the spec) and the design becomes out of date so Update uses them." />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
