import { useMemo, useState } from 'react';
import type { SimController, SimSnapshot } from '../plc/sim/controller';
import { normAddress } from '../plc/sim/engine';
import { collectProject } from '../deliverables/collect';
import { wiringPaths } from './wiringPath';
import { FAULT_LABEL, faultEffects, faultableWires, type WireFaultKind } from './faults';
import TroubleshootPanel, { type Practice } from './TroubleshootPanel';
import { useNarrow } from './useNarrow';

const btn = 'rounded border px-2 py-0.5 text-[12px] font-semibold disabled:opacity-40';

/**
 * Simulator practice mode: break a wire of the electrical design ("wire X004 open") and watch what the PLC
 * sees, or let the app pick a hidden fault to find with the meter steps (practice meter readings from the
 * fault that was set; what is found goes into the fault log). Needs an electrical design.
 */
export default function WireFaultBar({ ctl, snap }: { ctl: SimController; snap: SimSnapshot }) {
  // The design's paths, read once when the simulator opens.
  const [paths] = useState(() => {
    const ctx = collectProject().drawingCtx;
    try { return ctx ? wiringPaths(ctx) : []; } catch { return []; }
  });
  const wires = useMemo(() => faultableWires(paths), [paths]);
  const [wire, setWire] = useState('');
  const [kind, setKind] = useState<WireFaultKind>('open');
  const [hidden, setHidden] = useState(false);
  const [why, setWhy] = useState<string[]>([]);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [finding, setFinding] = useState(false);
  // Phones: the simulator page has no room, so the bar sits at the bottom of the screen and the steps take the whole screen.
  const narrow = useNarrow();
  if (!wires.length) return null;

  const apply = (w: string, k: WireFaultKind, hide: boolean) => {
    const effects = faultEffects(paths, { wire: w, kind: k });
    ctl.setWireFault({
      label: `wire ${w} ${FAULT_LABEL[k]}`,
      inputs: new Map(effects.filter((e) => e.type === 'input' && e.reads !== null).map((e) => [normAddress(e.address), e.reads as boolean])),
      deadOutputs: new Set(effects.filter((e) => e.type === 'output').map((e) => normAddress(e.address))),
    });
    setWhy(effects.map((e) => e.why));
    setHidden(hide);
    // A hidden fault leaves finding the misbehaving point to the learner.
    setPractice({ fault: { wire: w, kind: k }, points: hide ? [] : effects.map((e) => e.address) });
    setFinding(false);
  };
  const random = () => {
    const w = wires[Math.floor(Math.random() * wires.length)];
    // A signal wire may also be shorted to 24 V; supply and 0 V wires are only ever broken.
    const signal = paths.some((p) => p.signal.some((h) => h.wire === w.wire)) && !paths.some((p) => p.supply.some((h) => h.wire === w.wire) || p.ret.some((h) => h.wire === w.wire));
    apply(w.wire, signal && Math.random() < 0.25 ? 'short-24V' : 'open', true);
  };
  const active = snap.wireFault;

  const repair = () => { ctl.setWireFault(null); setWhy([]); setHidden(false); setPractice(null); setFinding(false); };

  return (
    <>
    <div className={`flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] ${narrow ? 'fixed inset-x-0 bottom-0 z-30 border-t shadow-lg [&_select]:max-w-full [&_select]:min-w-0 [&_select]:flex-1 [&_label]:min-w-0 [&_label]:flex-1' : ''}`} aria-label="Practice wiring fault">
      <span className="font-bold text-violet-900">Practice fault finding</span>
      {!active ? (
        <>
          <label className="flex items-center gap-1">Wire
            <select aria-label="Wire to break" value={wire} onChange={(e) => setWire(e.target.value)} className="max-w-64 rounded border border-violet-300 bg-white px-1 py-0.5">
              <option value="">choose…</option>
              {wires.map((w) => <option key={w.wire} value={w.wire}>{w.label}</option>)}
            </select>
          </label>
          <select aria-label="Fault" value={kind} onChange={(e) => setKind(e.target.value as WireFaultKind)} className="rounded border border-violet-300 bg-white px-1 py-0.5">
            {(Object.keys(FAULT_LABEL) as WireFaultKind[]).map((k) => <option key={k} value={k}>{FAULT_LABEL[k]}</option>)}
          </select>
          <button type="button" className={`${btn} border-violet-400 bg-white text-violet-900 hover:bg-violet-100`} disabled={!wire} onClick={() => apply(wire, kind, false)}>Break this wire</button>
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
        <TroubleshootPanel key={`${practice.fault.wire}-${practice.fault.kind}`} practice={practice} />
      </div>
    )}
    </>
  );
}
