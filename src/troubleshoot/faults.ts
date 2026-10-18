/**
 * Wiring faults for practice (simulator) and for ranking causes: what each fault does to the PLC points.
 * A wire number is a net, so a fault on it acts on every point whose path uses it, the way a real broken
 * conductor or short does: an open signal wire keeps its input OFF, an open supply wire kills every device
 * fed through it, a signal shorted to 24 V keeps its input ON.
 */
import type { PathHop, WiringPath } from './wiringPath';

export type WireFaultKind = 'open' | 'short-0V' | 'short-24V';

export interface WireFault {
  wire: string;
  kind: WireFaultKind;
  /** The terminal where it is, when the fault is at one place ("TB2-4"); the whole net otherwise. */
  at?: string;
}

export interface FaultEffect {
  address: string;
  type: 'input' | 'output';
  /** Input: the value the PLC reads whatever the device does. Output: the load gets no power (null). */
  reads: boolean | null;
  /** Why, in plain words ("wire 205 open: X003 never turns ON"). */
  why: string;
}

export const FAULT_LABEL: Record<WireFaultKind, string> = { open: 'open (broken or loose)', 'short-0V': 'shorted to 0 V', 'short-24V': 'shorted to 24 V' };

const onPath = (hs: PathHop[], f: WireFault) => hs.some((h) => h.wire === f.wire && (!f.at || h.label.includes(f.at) || `${h.tag}-${h.terminal}` === f.at || `${h.tag}:${h.terminal}` === f.at));

/** The points a fault affects, and what each one then does. */
export function faultEffects(paths: WiringPath[], f: WireFault): FaultEffect[] {
  const out: FaultEffect[] = [];
  const w = `wire ${f.wire} ${FAULT_LABEL[f.kind]}`;
  for (const p of paths) {
    if (p.analog) {
      if (onPath(p.signal, f) || onPath(p.supply, f)) out.push({ address: p.address, type: p.type, reads: null, why: `${w}: ${p.address} reads out of range (open loop / burnout)` });
      continue;
    }
    const sig = onPath(p.signal, f);
    // Mains conductors of the power supply's feed: the whole 24 V side drops out.
    const sup = onPath(p.supply, f) || onPath(p.ret, f);
    if (!sig && !sup) continue;
    if (p.type === 'input') {
      if (sig && f.kind === 'short-24V') out.push({ address: p.address, type: 'input', reads: true, why: `${w}: ${p.address} is ON all the time, whatever ${p.device || 'the device'} does` });
      else if (sig) out.push({ address: p.address, type: 'input', reads: false, why: `${w}: ${p.address} never turns ON, whatever ${p.device || 'the device'} does` });
      else if (f.kind === 'short-24V') continue;
      else out.push({ address: p.address, type: 'input', reads: false, why: `${w}: ${p.device || p.address} has no supply, so ${p.address} stays OFF` });
    } else {
      if (sig && f.kind === 'short-24V') out.push({ address: p.address, type: 'output', reads: null, why: `${w}: ${p.device || 'the load'} is ON all the time (sourcing) or never (sinking), whatever ${p.address} does` });
      else out.push({ address: p.address, type: 'output', reads: null, why: `${w}: ${p.device || 'the load'} gets no power when ${p.address} turns ON` });
    }
  }
  // A short to 0 V on a 24 V supply net puts the power supply into current limit: everything on it dies.
  if (f.kind === 'short-0V') {
    const supplyNets = new Set(paths.flatMap((p) => p.supply.filter((h) => h.kind === 'source').map((h) => h.wire)));
    if (supplyNets.has(f.wire)) {
      for (const p of paths) {
        if (out.some((e) => e.address === p.address)) continue;
        out.push({ address: p.address, type: p.type, reads: p.type === 'input' ? false : null, why: `${w}: the power supply is overloaded (current limit or its breaker trips): ${p.address} is dead too` });
      }
    }
  }
  return out;
}

/** Wires a learner can break, in the order of the paths (signal wires first, then supply wires). */
export function faultableWires(paths: WiringPath[]): { wire: string; label: string; points: string[] }[] {
  const by = new Map<string, { label: string; points: Set<string> }>();
  for (const p of paths) {
    for (const h of [...p.signal, ...p.supply, ...p.ret]) {
      if (!h.wire || /^(L\d|\dL\d|PE)$/i.test(h.wire) || h.kind === 'supply') continue;
      const e = by.get(h.wire) ?? { label: `${h.wire} (${h.label})`, points: new Set<string>() };
      e.points.add(p.address);
      by.set(h.wire, e);
    }
  }
  return [...by].map(([wire, e]) => ({ wire, label: e.label, points: [...e.points] }));
}
