import { useMemo, useState } from 'react';
import type { SimController, SimSnapshot } from '../plc/sim/controller';
import { normAddress } from '../plc/sim/engine';
import { collectProject } from '../deliverables/collect';
import { wiringPaths } from './wiringPath';
import { FAULT_LABEL, faultEffects, faultableWires, type WireFaultKind } from './faults';

const btn = 'rounded border px-2 py-0.5 text-[12px] font-semibold disabled:opacity-40';

/**
 * Simulator practice mode: break a wire of the electrical design ("wire X004 open") and watch what the PLC
 * sees, or let the app pick a hidden fault to find with the meter steps. Needs an electrical design.
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
  };
  const random = () => {
    const w = wires[Math.floor(Math.random() * wires.length)];
    // A signal wire may also be shorted to 24 V; supply and 0 V wires are only ever broken.
    const signal = paths.some((p) => p.signal.some((h) => h.wire === w.wire)) && !paths.some((p) => p.supply.some((h) => h.wire === w.wire) || p.ret.some((h) => h.wire === w.wire));
    apply(w.wire, signal && Math.random() < 0.25 ? 'short-24V' : 'open', true);
  };
  const active = snap.wireFault;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px]" aria-label="Practice wiring fault">
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
          {hidden && <button type="button" className={`${btn} border-violet-400 bg-white text-violet-900`} onClick={() => setHidden(false)}>Reveal</button>}
          <button type="button" className={`${btn} ml-auto border-violet-400 bg-white text-violet-900 hover:bg-violet-100`} onClick={() => { ctl.setWireFault(null); setWhy([]); setHidden(false); }}>Repair the wire</button>
        </>
      )}
    </div>
  );
}
