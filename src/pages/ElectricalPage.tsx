import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProgramStore } from '../store/useProgramStore';
import { usePlc } from '../plc/core/usePlc';
import { getPart, partsIn } from '../electrical/catalog';
import { catalogFor } from '../electrical/catalogs';
import PartPicker from '../electrical/PartPicker';
import { saveBlob } from '../deliverables/files';
import { keyRatings } from '../electrical/strength';
import { useProjectStore, useVendorPreference, type Region } from '../store/useProjectStore';
import { bomCsv, cableScheduleCsv, designWarnings, wireListCsv } from '../electrical/derive';
import CabinetPictures from '../electrical/CabinetPictures';
import MachiningPanel from '../electrical/MachiningPanel';
import LabelsPanel from '../electrical/labels/LabelsPanel';
import MachineLayoutPanel from '../electrical/layout/MachineLayoutPanel';
import { userNotes } from '../components/questions/classify';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions, useSyncQuestions } from '../components/questions/useQuestionStore';
import { useDrawingContext } from '../electrical/useDrawingContext';
import DrawingSet from '../electrical/drawings/DrawingSet';
import { generateElectricalDesign } from '../lib/ai/electricalAI';
import type { CatalogCategory, DesignInputs, EnclosureRating, MotorSpec, StarterType, SupplyVoltage } from '../electrical/types';
import { Spinner, ReasoningPanel } from '../components/common';
import StageBanner from '../components/StageBanner';
import { useFingerprints, useStages } from '../spec/useStages';
import { useStageStore } from '../store/useStageStore';
import { specToText } from '../spec/types';

const SUPPLIES: SupplyVoltage[] = ['600VAC-3PH', '480VAC-3PH', '240VAC-3PH', '208VAC-3PH', '120VAC-1PH'];
const ENCLOSURES: EnclosureRating[] = ['NEMA 12', 'NEMA 4', 'NEMA 4X', 'NEMA 1'];
const STARTERS: { value: StarterType; label: string }[] = [
  { value: 'contactor-overload', label: 'Contactor + overload' },
  { value: 'motor-protector', label: 'Motor protector + contactor' },
  { value: 'vfd', label: 'VFD (variable speed)' },
];
const SUPPLY_LABEL: Record<SupplyVoltage, string> = {
  '600VAC-3PH': '600 V 3-phase', '480VAC-3PH': '480 V 3-phase', '240VAC-3PH': '240 V 3-phase', '208VAC-3PH': '208 V 3-phase', '120VAC-1PH': '120 V single-phase',
};
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

export default function ElectricalPage() {
  const el = useElectricalStore();
  const settings = useSettingsStore();
  const { projectName } = useProgramStore();
  const fp = useFingerprints();
  const stages = useStages();
  const markGenerated = useStageStore((s) => s.markGenerated);
  const specText = specToText(fp.spec);
  const { profile, cpu, io, addresses } = usePlc();
  const ctx = useDrawingContext();

  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') as Tab | null;
  const tab: Tab = urlTab && ['design', 'cabinet', 'machine', 'layout', 'picture', 'machining', 'labels'].includes(urlTab) ? urlTab : el.design ? 'cabinet' : 'design';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const pref = useVendorPreference();
  const CATEGORIES = useMemo(() => [...new Set(catalogFor(pref).map((p) => p.category))].sort((a, b) => (CATEGORY_LABEL[a] ?? a).localeCompare(CATEGORY_LABEL[b] ?? b)) as CatalogCategory[], [pref]);
  const [pickCat, setPickCat] = useState<CatalogCategory>('breaker');
  const [pickPart, setPickPart] = useState('');
  const [swap, setSwap] = useState<number | null>(null);
  const region = useProjectStore((s) => s.info.region);
  const setInfo = useProjectStore((s) => s.setInfo);

  // "Assumptions to confirm", answered under each item.
  useSyncQuestions('electrical', el.design ? userNotes(el.design).map((n) => ({ text: n, assumption: n })) : null);
  const elecQuestions = useQuestions('electrical');
  const { inputs } = el;
  const setInputs = (patch: Partial<DesignInputs>) => el.setInputs({ ...inputs, ...patch });
  const setMotor = (i: number, patch: Partial<MotorSpec>) =>
    setInputs({ motors: inputs.motors.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const warnings = useMemo(() => (ctx ? designWarnings(ctx) : []), [ctx]);
  const base = projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'panel';
  const apiKey = settings.anthropicApiKey;

  const generate = async () => {
    if (!apiKey || el.isGenerating) return;
    if (el.design && !confirm('Replace the current electrical design?')) return;
    el.setIsGenerating(true);
    setError(null);
    try {
      const r = await generateElectricalDesign({
        apiKey, model: settings.anthropicModel, effort: settings.effort,
        profile, cpu, io, addresses, machineDescription: specText, inputs, region,
      });
      el.setInputs(r.design.inputs);
      el.setDesign(r.design, 'generated', r.explanation);
      markGenerated('electrical', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp });
      setReasoning(r.reasoning);
      setTab('cabinet');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      el.setIsGenerating(false);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === id ? 'border-brand-600 text-brand-800' : 'border-transparent text-steel-500 hover:text-steel-700'}`}>{label}</button>
  );

  return (
    <>
      <header className="px-6 pt-4 bg-white border-b border-steel-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-steel-800">4 · Electrical Design</h2>
            <p className="text-xs text-steel-400 mt-0.5">Control panel design and drawings · AutomationDirect parts · {profile.name} {cpu.id}</p>
          </div>
          {el.design && (
            <div className="flex gap-2">
              <Link to="/print-electrical" target="_blank" className="px-3 py-1.5 text-sm bg-steel-800 text-white rounded hover:bg-steel-900">Print / PDF</Link>
              {ctx && <button onClick={() => download(`${base}_BOM.csv`, bomCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">BOM CSV</button>}
              {ctx && <Link to="/export#order-list" className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Order list</Link>}
              {ctx && <button onClick={() => download(`${base}_cable_schedule.csv`, cableScheduleCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Cable schedule CSV</button>}
              {ctx && <button onClick={() => download(`${base}_wire_list.csv`, wireListCsv(ctx), 'text/csv')} className="px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50">Wire list CSV</button>}
            </div>
          )}
        </div>
        <div className="flex mt-2">{tabBtn('design', 'Design')}{tabBtn('cabinet', 'Cabinet wiring')}{tabBtn('machine', 'Machine wiring')}{tabBtn('layout', 'Machine layout')}{tabBtn('picture', 'Cabinet picture')}{tabBtn('machining', 'Machining (DXF)')}{tabBtn('labels', 'Labels')}</div>
      </header>

      <StageBanner info={stages.electrical} action={
        <button onClick={generate} disabled={el.isGenerating || !apiKey} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded disabled:opacity-50">
          {el.isGenerating ? 'Updating…' : 'Update design'}
        </button>} />
      {tab === 'labels' ? (
        <LabelsPanel ctx={ctx} fileBase={base} projectName={projectName} />
      ) : tab === 'layout' ? (
        <MachineLayoutPanel ctx={ctx} />
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
                  <select value={region} onChange={(e) => setInfo({ region: e.target.value as Region, standards: e.target.value === 'Canada' ? ['CSA C22.2 No. 14', 'CEC'] : ['NFPA 79', 'UL 508A', 'NEC'] })} className={input} aria-label="Electrical code">
                    <option value="US">US — NEC / UL 508A (breakers)</option>
                    <option value="Canada">Canada — CEC / CSA C22.2 No. 14 (fuses)</option>
                  </select>
                </label>
                <label className="text-sm text-steel-700">Supply voltage<br />
                  <select value={inputs.supply} onChange={(e) => setInputs({ supply: e.target.value as SupplyVoltage })} className={input}>{SUPPLIES.map((s) => <option key={s} value={s}>{SUPPLY_LABEL[s] ?? s}</option>)}</select>
                </label>
                <label className="text-sm text-steel-700">Enclosure<br />
                  <select value={inputs.enclosureRating} onChange={(e) => setInputs({ enclosureRating: e.target.value as EnclosureRating })} className={input}>{ENCLOSURES.map((s) => <option key={s}>{s}</option>)}</select>
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
              {!inputs.motors.length && <p className="text-xs text-steel-500">No motors. Add each motor the panel drives.</p>}
              {inputs.motors.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input value={m.tag} onChange={(e) => setMotor(i, { tag: e.target.value.toUpperCase() })} className={`${input} w-16 font-mono`} aria-label="Motor tag" />
                  <input value={m.description} onChange={(e) => setMotor(i, { description: e.target.value })} placeholder="Conveyor 1 drive" className={`${input} flex-1 min-w-40`} aria-label="Motor description" />
                  <label className="text-xs text-steel-500 flex items-center gap-1">HP
                    <input type="number" min={0.1} step={0.25} value={m.hp} onChange={(e) => setMotor(i, { hp: Number(e.target.value) })} className={`${input} w-20`} />
                  </label>
                  <select value={m.voltage} onChange={(e) => setMotor(i, { voltage: e.target.value as SupplyVoltage })} className={input} aria-label="Motor voltage">{SUPPLIES.map((s) => <option key={s} value={s}>{SUPPLY_LABEL[s] ?? s}</option>)}</select>
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
              <button onClick={generate} disabled={el.isGenerating || !apiKey}
                className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                {el.isGenerating ? <><Spinner /> Designing the panel… this can take several minutes</> : el.design ? 'Generate New Design' : 'Generate Electrical Design'}
              </button>
              {!apiKey && <span className="text-sm text-yellow-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</span>}
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
                            <td className="py-1"><button onClick={() => el.removeComponent(i)} className="text-steel-400 hover:text-red-600" aria-label="Remove component">✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {swap !== null && el.design.components[swap] && (
                  <PartPicker tag={el.design.components[swap].tag} partNumber={el.design.components[swap].partNumber}
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
