import { useProjectPanelPart } from '../../hmi/projectPanel';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useProjectStore, useVendorPreference, type Region } from '../../store/useProjectStore';
import { useHmiStore } from '../../store/useHmiStore';
import { useIOStore } from '../../store/useIOStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useStageStore } from '../../store/useStageStore';
import { notify } from '../../store/useNoticeStore';
import { usePlc } from '../../plc/core/usePlc';
import { useFingerprints } from '../../spec/useStages';
import { specToText } from '../../spec/types';
import { applyEquipment } from '../../spec/equipment';
import { getPart } from '../catalog';
import { designWarnings, type DrawingContext } from '../derive';
import { saveBlob } from '../../deliverables/files';
import { collectProject } from '../../deliverables/collect';
import { Spinner } from '../../components/common';
import { useDrawingContext } from '../useDrawingContext';
import { applyProposal, costDownPass, savingText, type Proposal } from './costDown';
import { insertSection, KIND_LABEL, libraryFile, makePanel, makeSection, parseLibrary, type LibraryItem, type LibraryKind } from './library';
import { useLibraryStore } from './useLibraryStore';
import { differences, KIND_TITLE, runDesign, whatIfOptions, type BaseInput, type WhatIfOption, type WhatIfResult } from './whatIf';
import { designFacts, LEAD_LABEL, usd } from './facts';
import { CRITICALITY_LABEL, FAILURE_LABEL, spareParts, SPARES_BASIS } from './spares';

const card = 'bg-white rounded-sm border border-steel-200 p-5 space-y-3';
const btn = 'px-3 py-1.5 text-sm border border-steel-300 rounded hover:bg-steel-50 disabled:opacity-40';
const primary = 'px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40';
const input = 'border border-steel-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/** Design checks that point at a real gap (same idea as the engine tests): a change must not add any. */
const GAP = /does not fit|overflow|below the motor|over capacity|not found in the catalog|no (branch|contactor|overload|24VDC)/i;

/** Electrical → Improve design: cost-down, what-if compare, standard-panel library, spare parts. */
export default function ImprovePanel({ fileBase }: { fileBase: string }) {
  const ctx = useDrawingContext({ raw: true });
  return (
    <div className="flex-1 overflow-auto bg-steel-50 p-6">
      <div className="max-w-5xl space-y-5">
        <p className="text-sm text-steel-600">Ways to make this design cheaper, compare it with other choices, reuse proven panels, and plan the spare parts. Nothing changes until you accept or apply something.</p>
        {ctx ? <CostDownCard ctx={ctx} /> : <div className={card}><p className="text-sm text-steel-500">No design yet. Make one on the Design tab first; the library below can also start from a saved panel.</p></div>}
        {ctx && <WhatIfCard ctx={ctx} />}
        <LibraryCard ctx={ctx} />
        {ctx && <SparesCard ctx={ctx} fileBase={fileBase} />}
      </div>
    </div>
  );
}

function CostDownCard({ ctx }: { ctx: DrawingContext }) {
  const el = useElectricalStore();
  const r = useMemo(() => costDownPass(ctx), [ctx]);
  const [last, setLast] = useState<string | null>(null);
  const accept = (ps: Proposal[]) => {
    if (!el.design) return;
    const before = designWarnings(ctx).filter((w) => GAP.test(w)).length;
    let d = el.design;
    for (const p of ps) d = applyProposal(d, p);
    // The checks run again on the changed design before it is kept.
    const after = designWarnings({ ...ctx, design: d }).filter((w) => GAP.test(w));
    if (after.length > before) { notify(`Not changed: the drawings would show a problem — ${after[after.length - 1]}`); return; }
    el.setDesign(d, el.source ?? 'generated', el.explanation);
    const left = costDownPass({ ...ctx, design: d }).proposals.length;
    setLast(`Changed ${ps.map((p) => `${p.tag} to ${p.to}`).join(', ')}. Checked again: ${left ? `${left} more to look at` : 'everything is right-sized now'}.`);
  };
  return (
    <section className={card} aria-label="Save money">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">1. Save money: parts bigger than they need to be</h3>
        {r.proposals.length > 1 && <button className={btn} onClick={() => accept(r.proposals)}>Accept all ({r.proposals.length})</button>}
      </div>
      <p className="text-xs text-steel-500">Each breaker, contactor, drive, power supply, disconnect and the enclosure is checked against the load it really carries, with the same rules the design uses. Smaller parts of the same brand are offered with the calculation; accept the lines you agree with.</p>
      {last && <p className="text-xs bg-brand-50 border border-brand-200 text-brand-800 rounded p-2" role="status">{last}</p>}
      {r.proposals.length ? (
        <>
          <ul className="divide-y divide-steel-100">
            {r.proposals.map((p) => (
              <li key={p.id} className="py-2 flex items-start gap-3" data-testid="cost-down-line">
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-medium text-steel-800">{p.tag} · {p.what}: {p.fromText} → {p.toText} <span className="font-normal text-steel-500">({p.from} → {p.to})</span></div>
                  <ul className="list-disc pl-5 text-xs text-steel-600">{p.calc.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
                <span className={`text-sm whitespace-nowrap ${p.saving ? 'text-green-700 font-medium' : 'text-steel-500'}`}>{p.saving === 0 ? 'no price difference' : savingText(p)}</span>
                <button className={primary} onClick={() => accept([p])} aria-label={`Accept ${p.tag}`}>Accept</button>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-steel-800">Possible saving: {usd(r.total)}{r.unpricedCount ? ` + ${r.unpricedCount} line${r.unpricedCount > 1 ? 's' : ''} with a price to confirm` : ''}</p>
        </>
      ) : <p className="text-sm text-green-700">Every part is already the right size for its load.</p>}
      <details className="text-xs text-steel-600">
        <summary className="cursor-pointer">What was checked ({r.checked.length})</summary>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">{r.checked.map((c, i) => <li key={i}><span className="font-mono">{c.tag}</span> {c.what}: {c.result}</li>)}</ul>
      </details>
    </section>
  );
}

/** The engine input of the open project (as Generate uses it, without the AI). */
function useBaseInput(): BaseInput {
  const el = useElectricalStore();
  const { profile, cpu, io, addresses, analog } = usePlc();
  const modules = useProjectStore((s) => s.modules);
  const region = useProjectStore((s) => s.info.region);
  const pref = useVendorPreference();
  const hmiPartNumber = useProjectPanelPart();
  const projectName = useProgramStore((s) => s.projectName);
  const fp = useFingerprints();
  return useMemo(() => ({
    io, addresses, spec: specToText(fp.spec), inputs: el.inputs, modules, region, pref, getPart, hmiPartNumber, analog, projectName, plcId: profile.id,
    plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
  }), [io, addresses, fp.spec, el.inputs, modules, region, pref, hmiPartNumber, analog, projectName, profile, cpu]);
}

function WhatIfCard({ ctx }: { ctx: DrawingContext }) {
  const base = useBaseInput();
  const fp = useFingerprints();
  const options = useMemo(() => whatIfOptions(base), [base]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ now: WhatIfResult; rules: WhatIfResult | null; alts: WhatIfResult[] } | null>(null);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  const compare = () => {
    setBusy(true);
    // Let the spinner paint: each option is a full design run.
    setTimeout(() => {
      try {
        // "As it is now" is the design in the project (same total as the order list and Sourcing). When it is not
        // what the rules would make today (edited, AI or imported), the rules' own design is shown too.
        const now: WhatIfResult = { option: null, ctx, facts: designFacts(ctx), gaps: [], layoutOk: true };
        const rules = runDesign(base, null);
        const same = rules.facts.cost === now.facts.cost && rules.facts.pieces === now.facts.pieces && rules.facts.enclosure.text === now.facts.enclosure.text;
        setRes({ now, rules: same ? null : rules, alts: picked.map((id) => runDesign(base, options.find((o) => o.id === id)!)) });
      } catch (e) { notify(`The comparison could not be made: ${e instanceof Error ? e.message : String(e)}`); }
      finally { setBusy(false); }
    }, 20);
  };
  const apply = (r: WhatIfResult) => {
    const o = r.option!;
    if (!confirm(`Apply "${o.label}" to the project? The electrical design is replaced by this option's design.`)) return;
    const el = useElectricalStore.getState();
    const c = o.change;
    if (c.plc) {
      // Addresses typed for the old PLC do not carry over.
      for (const p of useIOStore.getState().projectIO) if (p.plcAddress) useIOStore.getState().setPlcAddress(p.id, '');
      applyEquipment({ cpuId: c.plc.cpuId, modules: c.plc.modules, hmiPartNumber: useHmiStore.getState().hmiPartNumber || null }, useProjectStore.getState().recommendation);
    }
    if (c.pref) useProjectStore.getState().setInfo({ vendors: c.pref });
    const d = r.ctx.design;
    useElectricalStore.getState().setInputs({ ...d.inputs, requiredParts: c.plc ? useElectricalStore.getState().inputs.requiredParts : el.inputs.requiredParts });
    useElectricalStore.getState().setDesign(d, 'generated', `Option applied from "Compare options": ${o.label}.`);
    useStageStore.getState().markGenerated('electrical', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp });
    setRes(null);
    setPicked([]);
    notify(`Applied: ${o.label}.${c.plc ? ' The PLC program and the HMI now need updating for the new PLC.' : ''}`);
  };
  const groups = (Object.keys(KIND_TITLE) as WhatIfOption['kind'][]).map((k) => ({ k, list: options.filter((o) => o.kind === k) })).filter((g) => g.list.length);
  const cols = res ? [res.now, ...(res.rules ? [res.rules] : []), ...res.alts] : [];
  const row = (label: string, f: (r: WhatIfResult) => string) => (
    <tr><th className="text-left font-medium text-steel-600 py-1 pr-3 whitespace-nowrap">{label}</th>{cols.map((r, i) => <td key={i} className="py-1 pr-3 align-top">{f(r)}</td>)}</tr>
  );
  return (
    <section className={card} aria-label="Compare options">
      <h3 className="text-sm font-semibold text-steel-800">2. Compare options (what if…)</h3>
      <p className="text-xs text-steel-500">Pick up to 3 changes. The panel is designed again for each one, in memory only, and shown next to the project as it is.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.k} className="text-sm">
            <legend className="text-xs font-medium text-steel-700 mb-1">{KIND_TITLE[g.k]}</legend>
            {g.list.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-steel-700">
                <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} disabled={!picked.includes(o.id) && picked.length >= 3} /> {o.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <button className={`${primary} flex items-center gap-2`} disabled={!picked.length || busy} onClick={compare}>{busy ? <><Spinner /> Designing the options…</> : 'Compare'}</button>
      {res && (
        <div className="overflow-x-auto">
          <table className="text-sm w-full" data-testid="what-if-table">
            <thead><tr><th />{cols.map((r, i) => <th key={i} className="text-left py-1 pr-3 text-steel-800">{r.option ? r.option.label : r === res.now ? 'As it is now' : 'Redesigned by the rules, no change'}</th>)}</tr></thead>
            <tbody className="divide-y divide-steel-100">
              {row('Cost (list prices)', (r) => `${usd(r.facts.cost)}${r.facts.unpriced ? ` + ${r.facts.unpriced} to confirm (${r.facts.unpricedParts.slice(0, 3).join(', ')}${r.facts.unpriced > 3 ? '…' : ''})` : ''}`)}
              {row('Enclosure', (r) => `${r.facts.enclosure.text}${r.facts.enclosure.partNumber ? ` (${r.facts.enclosure.partNumber})` : ''}`)}
              {row('Heat inside', (r) => `${r.facts.heatW} W${r.facts.riseC !== null ? `, +${r.facts.riseC} °C without a fan` : ''}`)}
              {row('Lead time', (r) => `${LEAD_LABEL[r.facts.lead]}${r.facts.lead !== 'stock' ? `: ${r.facts.leadParts.slice(0, 3).join(', ')}` : ''}${r.facts.leadTypical ? ' (typical)' : ''}`)}
              {row('Parts', (r) => `${r.facts.pieces} pieces, ${r.facts.lines} part numbers`)}
              {row('To check', (r) => (r.gaps.length || !r.layoutOk ? [...(r.layoutOk ? [] : ['less than 25% spare space']), ...r.gaps].join(' · ') : '—'))}
              {row('Differences', (r) => (r === res.now ? '' : differences(res.now.facts, r.facts).join(' · ') || 'none'))}
              <tr><th />{cols.map((r, i) => <td key={i} className="py-2">{r.option && <button className={primary} onClick={() => apply(r)}>Apply this option</button>}</td>)}</tr>
            </tbody>
          </table>
          <p className="text-xs text-steel-500 mt-1">Each option is the panel designed again by the rules with that one change. Costs use the same prices as the order list and Sourcing (yours where you typed one); a part with no price is "to confirm" and not in the total, so two costs are only compared when the same parts are priced. Lead times marked "typical" are by kind of part where the supplier's stock is not known.</p>
        </div>
      )}
    </section>
  );
}

function LibraryCard({ ctx }: { ctx: DrawingContext | null }) {
  const lib = useLibraryStore();
  const el = useElectricalStore();
  const projectName = useProgramStore((s) => s.projectName);
  const [kind, setKind] = useState<LibraryKind>('panel');
  const [motor, setMotor] = useState('');
  const [name, setName] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const motors = el.design?.inputs.motors ?? [];

  const save = () => {
    const d = el.design;
    if (!d) return;
    let item: LibraryItem | null;
    if (kind === 'panel') {
      const { plcId, cpuId, modules, info } = useProjectStore.getState();
      item = makePanel(d, { io: useIOStore.getState().projectIO, plcId, cpuId, modules, hmiPartNumber: useHmiStore.getState().hmiPartNumber, region: info.region }, name || projectName, projectName);
    } else item = makeSection(d, kind, name, projectName, getPart, motor || motors[0]?.tag);
    if (!item) { notify(`This design has no ${KIND_LABEL[kind].toLowerCase()} to save.`); return; }
    lib.add(item);
    setName('');
    notify(`Saved "${item.name}" to the panel library.`);
  };

  const addSection = (it: LibraryItem) => {
    if (!el.design) return;
    const r = insertSection(el.design, it);
    el.setDesign(r.design, el.source ?? 'generated', el.explanation);
    el.setInputs({ ...el.inputs, motors: r.design.inputs.motors });
    notify(`Added "${it.name}" as ${[...r.tags.values()].join(', ')}${r.motorTag ? ` (motor ${r.motorTag})` : ''}. Wire it in the I/O list and check the drawings.`);
  };

  const startProject = (it: LibraryItem) => {
    const pname = prompt('Name of the new project', `${it.name} copy`);
    if (!pname?.trim() || !it.design || !it.project) return;
    if (!useProjectsStore.getState().createProject(pname.trim())) return;
    const pr = it.project;
    useIOStore.setState({ projectIO: structuredClone(pr.io) });
    useProjectStore.getState().setPlc(pr.plcId, pr.cpuId);
    useProjectStore.getState().setModules(pr.modules);
    useProjectStore.getState().setInfo({ region: pr.region as Region });
    useHmiStore.getState().setHmiPartNumber(pr.hmiPartNumber);
    useElectricalStore.getState().setInputs(structuredClone(it.design.inputs));
    useElectricalStore.getState().setDesign(structuredClone(it.design), 'generated', `Started from the panel library: "${it.name}".`);
    notify(`New project "${pname.trim()}" started from "${it.name}": the I/O list, PLC and electrical design are in. Describe the machine on the Spec page, then build the program.`);
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const items = parseLibrary(await f.text());
      const n = lib.importItems(items);
      notify(n ? `Imported ${n} item${n > 1 ? 's' : ''} into the panel library.` : 'Nothing new: everything in that file is already in the library.');
    } catch (e) { notify(e instanceof Error ? e.message : String(e)); }
    if (file.current) file.current.value = '';
  };

  return (
    <section className={card} aria-label="Panel library">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">3. Standard-panel library</h3>
        <div className="flex gap-2">
          <button className={btn} disabled={!lib.items.length} onClick={() => saveBlob('panel_library.json', new Blob([libraryFile(lib.items)], { type: 'application/json' }))}>Export library file</button>
          <button className={btn} onClick={() => file.current?.click()}>Import library file</button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" aria-label="Library file" onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
      </div>
      <p className="text-xs text-steel-500">Save a proven design, or one part of it (a motor starter, the safety circuit, the power supply section), and reuse it: start a new project from a saved panel, or add a saved section to this design. The library is shared by all your projects on this computer.</p>
      {ctx && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-steel-600">Save<br />
            <select value={kind} onChange={(e) => setKind(e.target.value as LibraryKind)} className={input} aria-label="What to save">
              {(Object.keys(KIND_LABEL) as LibraryKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          {kind === 'motor-starter' && (
            <label className="text-xs text-steel-600">Motor<br />
              <select value={motor || motors[0]?.tag || ''} onChange={(e) => setMotor(e.target.value)} className={input} aria-label="Motor">
                {motors.map((m) => <option key={m.tag} value={m.tag}>{m.tag} {m.description} ({m.hp} HP)</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-steel-600 flex-1 min-w-48">Name<br />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'panel' ? projectName : KIND_LABEL[kind]} className={`${input} w-full`} aria-label="Library name" />
          </label>
          <button className={primary} onClick={save} disabled={kind === 'motor-starter' && !motors.length}>Save to library</button>
        </div>
      )}
      {lib.items.length ? (
        <ul className="divide-y divide-steel-100" data-testid="library-list">
          {lib.items.map((it) => (
            <li key={it.id} className="py-2 flex items-start gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-steel-800">{it.name} <span className="text-xs font-normal text-steel-500">· {KIND_LABEL[it.kind]} · saved {it.savedAt.slice(0, 10)} from {it.from || 'a project'}</span></div>
                <div className="text-xs text-steel-600 truncate" title={it.summary}>{it.summary}</div>
              </div>
              {it.kind === 'panel'
                ? <button className={btn} onClick={() => startProject(it)}>Start a new project from it</button>
                : <button className={btn} disabled={!el.design} onClick={() => addSection(it)}>Add to this design</button>}
              <button className="text-steel-400 hover:text-red-600" aria-label={`Delete ${it.name}`} onClick={() => { if (confirm(`Delete "${it.name}" from the library?`)) lib.remove(it.id); }}>✕</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-steel-500">The library is empty.</p>}
    </section>
  );
}

function SparesCard({ ctx, fileBase }: { ctx: DrawingContext; fileBase: string }) {
  const s = useMemo(() => spareParts(ctx), [ctx]);
  const [busy, setBusy] = useState<string | null>(null);
  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label);
    try { await fn(); } catch (e) { notify(`The file could not be made: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(null); }
  };
  return (
    <section className={card} aria-label="Spare parts">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">4. Spare parts to keep on the shelf</h3>
        <div className="flex gap-2">
          <button className={btn} disabled={Boolean(busy)} onClick={run('xlsx', async () => {
            const { sparePartsXlsx } = await import('../../deliverables/sparePartsFiles');
            saveBlob(`${fileBase}_spare_parts.xlsx`, await sparePartsXlsx(s, ctx.projectName));
          })}>{busy === 'xlsx' ? 'Preparing…' : 'Excel'}</button>
          <button className={btn} disabled={Boolean(busy)} onClick={run('pdf', async () => {
            const { sparePartsPdf } = await import('../../deliverables/sparePartsFiles');
            const pdf = await sparePartsPdf(collectProject());
            if (pdf) saveBlob(`${fileBase}_spare_parts.pdf`, pdf);
          })}>{busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
        </div>
      </div>
      <p className="text-xs text-steel-500">{SPARES_BASIS} The same list is in the <Link to="/export" className="underline">Deliverables</Link> (Spare parts, and the maintenance chapter).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="spares-table">
          <thead className="text-xs text-steel-500 uppercase"><tr>{['Part', 'Installed', 'How critical', 'Fails', 'Keep', 'Price', 'Why'].map((h) => <th key={h} className="text-left py-1 pr-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-steel-100">
            {s.lines.map((l) => (
              <tr key={l.partNumber}>
                <td className="py-1 pr-2"><div className="font-mono">{l.partNumber}</div><div className="text-xs text-steel-500 truncate max-w-xs" title={l.description}>{l.tags.join(', ')} · {l.description}</div></td>
                <td className="py-1 pr-2">{l.installed}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{CRITICALITY_LABEL[l.criticality]}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{FAILURE_LABEL[l.failure]}</td>
                <td className="py-1 pr-2 font-medium">{l.qty}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{l.extended !== undefined ? usd(l.extended) : 'to confirm'}</td>
                <td className="py-1 pr-2 text-xs text-steel-600">{l.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-medium text-steel-800">Spares total: {usd(s.total)}{s.unpriced ? ` + ${s.unpriced} with a price to confirm` : ''}</p>
    </section>
  );
}
