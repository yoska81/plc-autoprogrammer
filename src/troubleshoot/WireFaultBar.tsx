import { useMemo, useState, useContext } from 'react';
import type { SimController, SimSnapshot } from '../plc/sim/controller';
import { normAddress } from '../plc/sim/engine';
import { collectProject } from '../deliverables/collect';
import { circuitOf, prepareWiring, wiringPaths } from './wiringPath';
import { circuitFaultEffects, linksOf, type CircuitFault } from './oracle';
import TroubleshootPanel, { type Practice } from './TroubleshootPanel';
import { useNarrow } from './useNarrow';
import { PlcNamesContext } from '../plc/ui/ladder/mnemonics';

const btn = 'rounded border px-2 py-0.5 text-[12px] font-semibold disabled:opacity-40';
type Kind = 'open' | 'short-24V' | 'short-0V';
const KIND_LABEL: Record<Kind, string> = { open: 'open (broken or loose)', 'short-24V': 'shorted to 24 V', 'short-0V': 'shorted to 0 V' };

/**
 * Simulator practice mode: break one real conductor of the electrical design (a wire end, a cable core, a
 * jumper) or short a signal place, and the PLC sees what the circuit then does; or let the app pick a hidden
 * fault to find with the meter steps (practice meter readings from the same circuit; what is found goes into
 * the fault log). Needs an electrical design.
 */
export default function WireFaultBar({ ctl, snap }: { ctl: SimController; snap: SimSnapshot }) {
  // The design's paths and conductors, read once when the simulator opens.
  const [{ paths, circ }] = useState(() => {
    const ctx = collectProject().drawingCtx;
    try { if (ctx) { const prep = prepareWiring(ctx); return { paths: wiringPaths(prep), circ: circuitOf(prep) }; } } catch { /* no design */ }
    return { paths: [], circ: null };
  });
  // Siemens / Logix: a PLC terminal by the PLC's own address ("PLC:%I0.0", not the app's X001).
  const names = useContext(PlcNamesContext);
  // Every conductor a point's steps walk past, signal ones first; the label says where it runs.
  const options = useMemo(() => {
    if (!circ) return [];
    const plcIo = (t: string) => t.replace(/(:)([XY]\d{3})\b/g, (m, c: string, a: string) => { const n = names?.(a); return n?.io ? `${c}${n.io}` : m; });
    const seen = new Map<string, { id: string; label: string; signal: boolean; node: string }>();
    for (const p of paths) {
      const sig = new Set(p.signal.map((h) => h.link?.id).filter(Boolean));
      for (const l of linksOf(circ.circuit, p)) {
        if (l.kind === 'contact' || seen.has(l.id)) continue;
        seen.set(l.id, { id: l.id, label: plcIo(`${l.wire ?? ''} — ${l.a} → ${l.b}${l.cable ? ` (${l.cable} core ${l.core})` : l.kind === 'jumper' ? ' (jumper)' : ''}`), signal: sig.has(l.id), node: l.b });
      }
    }
    return [...seen.values()].sort((a, b) => Number(b.signal) - Number(a.signal) || a.label.localeCompare(b.label));
  }, [paths, circ, names]);
  const [pick, setPick] = useState('');
  const [kind, setKind] = useState<Kind>('open');
  const [hidden, setHidden] = useState(false);
  const [why, setWhy] = useState<string[]>([]);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [finding, setFinding] = useState(false);
  // Phones: the simulator page has no room, so the bar sits at the bottom of the screen and the steps take the whole screen.
  const narrow = useNarrow();
  if (!circ || !options.length) return null;

  const apply = (id: string, k: Kind, hide: boolean) => {
    const o = options.find((x) => x.id === id)!;
    const fault: CircuitFault = k === 'open' ? { link: id, label: `wire ${o.label.split(' (')[0]} ${KIND_LABEL[k]}` } : { short: { node: o.node, to: k === 'short-24V' ? 24 : 0 }, label: `${o.node} ${KIND_LABEL[k]}` };
    const effects = circuitFaultEffects(circ.model, circ.circuit, paths, fault);
    ctl.setWireFault({
      label: fault.label,
      inputs: new Map(effects.filter((e) => e.type === 'input' && e.reads !== null).map((e) => [normAddress(e.address), e.reads as boolean])),
      deadOutputs: new Set(effects.filter((e) => e.type === 'output').map((e) => normAddress(e.address))),
    });
    setWhy(effects.map((e) => e.why));
    setHidden(hide);
    // A hidden fault leaves finding the misbehaving point to the learner.
    setPractice({ fault, points: hide ? [] : effects.map((e) => e.address) });
    setFinding(false);
  };
  const random = () => {
    // Faults that show on a point; a signal conductor may also be shorted to 24 V.
    for (let t = 0; t < 30; t++) {
      const o = options[Math.floor(Math.random() * options.length)];
      const k: Kind = o.signal && Math.random() < 0.25 ? 'short-24V' : 'open';
      const f: CircuitFault = k === 'open' ? { link: o.id, label: '' } : { short: { node: o.node, to: 24 }, label: '' };
      if (circuitFaultEffects(circ.model, circ.circuit, paths, f).length) { apply(o.id, k, true); return; }
    }
  };
  const repair = () => { ctl.setWireFault(null); setWhy([]); setHidden(false); setPractice(null); setFinding(false); };
  const active = snap.wireFault;

  return (
    <>
    <div className={`flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] ${narrow ? 'fixed inset-x-0 bottom-0 z-30 border-t shadow-lg [&_select]:max-w-full [&_select]:min-w-0 [&_select]:flex-1 [&_label]:w-full [&_label]:min-w-0 [&_select]:w-full [&_button]:min-h-11 [&_button]:px-3 [&_select]:min-h-11' : ''}`} aria-label="Practice wiring fault">
      <span className="font-bold text-violet-900">Practice fault finding</span>
      {!active ? (
        <>
          <label className="flex items-center gap-1">Wire
            <select aria-label="Wire to break" value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-64 rounded border border-violet-300 bg-white px-1 py-0.5">
              <option value="">choose…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <select aria-label="Fault" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="rounded border border-violet-300 bg-white px-1 py-0.5">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <button type="button" className={`${btn} border-violet-400 bg-white text-violet-900 hover:bg-violet-100`} disabled={!pick} onClick={() => apply(pick, kind, false)}>Break this wire</button>
          <button type="button" className={`${btn} border-violet-600 bg-violet-600 text-white hover:bg-violet-700`} onClick={random}>Hidden fault (find it)</button>
          <span className="text-violet-700">The PLC then sees what a real broken or shorted wire would do.</span>
        </>
      ) : (
        <>
          <span className="rounded bg-violet-600 px-1.5 py-px font-semibold text-white" role="status">{hidden ? 'A hidden wiring fault is active — find it with the meter steps' : `Fault: ${active.label}`}</span>
          {!hidden && why.length > 0 && <span className="text-violet-900">{why.slice(0, 3).join(' · ')}{why.length > 3 ? ` · +${why.length - 3} more` : ''}</span>}
          {practice && <button type="button" className={`${btn} border-violet-600 bg-violet-600 text-white hover:bg-violet-700`} onClick={() => setFinding((v) => !v)}>{finding ? 'Hide the meter steps' : 'Find it with the meter steps'}</button>}
          {hidden && <button type="button" className={`${btn} border-violet-400 bg-white text-violet-900`} onClick={() => setHidden(false)}>Reveal</button>}
          <button type="button" className={`${btn} ml-auto border-violet-400 bg-white text-violet-900 hover:bg-violet-100`} onClick={repair}>Repair the wire</button>
        </>
      )}
    </div>
    {active && practice && finding && (
      <div className={narrow ? 'fixed inset-0 z-40 overflow-auto bg-steel-50 p-3' : 'max-h-[70vh] overflow-auto border-b border-violet-200 bg-steel-50 p-3'}>
        {narrow && <button type="button" className="mb-2 rounded border border-violet-400 bg-white px-3 py-1.5 text-sm text-violet-900" onClick={() => setFinding(false)}>Back to the simulator</button>}
        <TroubleshootPanel key={practice.fault.link ?? practice.fault.short?.node} practice={practice} />
      </div>
    )}
    </>
  );
}
