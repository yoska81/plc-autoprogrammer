/**
 * Wiring faults for practice (simulator) and for ranking causes: what each fault does to the PLC points.
 * A wire number is a net, so a fault on it acts on every point whose path uses it, the way a real broken
 * conductor or short does: an open signal wire keeps its input OFF, an open supply wire kills every device
 * fed through it, a signal shorted to 24 V keeps its input ON.
 */
import type { PathHop, WiringPath } from './wiringPath';
import { chains } from './steps';

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

/** "TB2:5" / "PLC:COM": the key a fault's `at` names a hop by. */
export const hopKey = (h: PathHop) => `${h.tag}:${h.terminal ?? ''}`;

/**
 * Practice mode: what the meter would show at a step of guided fault finding with this fault in the wiring,
 * so a learner can walk the steps on the simulator (and the tests can check every fault). `yes` = the
 * step's question is answered yes (the reading it asks for, or "still ON" when a wire is taken off).
 * An open conductor sits just past the faulty hop, on the side away from where the current comes from:
 * hops on the near side read bad, hops beyond it read good.
 */
export function practiceReading(path: WiringPath, step: { part: string; hop?: PathHop }, f: WireFault, symptom: string): { yes: boolean; shows: string } {
  const h = step.hop;
  if (!h) return { yes: true, shows: '' };
  const m = h.measure;
  const zero = m?.kind === 'mA' ? '0 mA' : 'about 0 V';
  const hit = (x: PathHop) => x.wire === f.wire && (!f.at || hopKey(x) === f.at);
  const ch = chains(path);
  if (step.part === 'isolate') {
    const still = f.kind === 'short-24V' && path.signal.some(hit);
    return { yes: still, shows: still ? `${path.address} stays ON` : `${path.address} goes OFF` };
  }
  if (symptom === 'always-on') {
    // The question asks for "about 0 V" with the device OFF; a short to 24 V shows 24 V on its wire.
    const on = f.kind === 'short-24V' && h.wire === f.wire;
    return { yes: !on, shows: on ? (m?.expect ?? '24 VDC') : zero };
  }
  // Where the fault is: the signal, the device feed / return, or the module's common (or output supply).
  const inSig = path.signal.some(hit), inFeed = ch.feed.some(hit), inRet = ch.ret.some(hit), inCom = ch.common.some(hit);
  const supplyDead = f.kind === 'short-0V' && path.supply.some((x) => x.kind === 'source' && x.wire === f.wire);
  const sourceSide = (x: PathHop) => ['source', 'protection', 'disconnect', 'supply'].includes(x.kind);
  const listOf = (part: string) => (part === 'supply' ? ch.feed : part === 'return' ? ch.ret : part === 'common' ? ch.common : part === 'signal' ? path.signal : []);
  const list = listOf(step.part);
  let good: boolean;
  if (supplyDead) good = false;
  else if (f.kind !== 'open') good = f.kind === 'short-24V' || h.wire !== f.wire;
  else if (step.part === 'signal') {
    if (inSig) {
      const i0 = path.signal.findIndex(hit), idx = path.signal.indexOf(h);
      // Inputs are fed from the device end, outputs from the PLC.
      good = path.type === 'output' ? idx <= i0 : idx > i0;
    // An input's device without its supply or 0 V gives no signal.
    } else if (path.type === 'input') good = !(inFeed || inRet);
    // A sinking output's terminal floats up without its common; a sourcing one has nothing without its supply.
    else good = !inCom;
    // Mains-side faults kill the 24 V everywhere.
    if (!inSig && [...ch.feed, ...ch.common].filter(hit).some(sourceSide)) good = false;
  } else if (list.some(hit)) {
    const i0 = list.findIndex(hit), idx = list.indexOf(h);
    good = idx > i0;
  } else good = !(path.supply.filter(hit).some(sourceSide) && step.part !== 'return');
  return { yes: good, shows: good ? (m?.expect ?? '') : zero };
}

/**
 * Practice: did the steps find the fault that was set? The wire itself (at the right hop when the fault
 * names one), or for a fault on the mains side of the power supply, "no output from" that supply (the 24 V
 * steps stop there; mains is for an electrician).
 */
export function practiceFound(path: WiringPath, v: { wire?: string; hops: PathHop[] }, f: WireFault): boolean {
  if (v.wire === f.wire && (!f.at || v.hops.some((h) => hopKey(h) === f.at))) return true;
  for (const list of [path.supply, path.ret]) {
    const src = list.findIndex((h) => h.kind === 'source');
    const at = list.findIndex((h) => h.wire === f.wire && (!f.at || hopKey(h) === f.at));
    if (src >= 0 && at >= src && v.hops.some((h) => h.kind === 'source' && h.tag === list[src].tag)) return true;
  }
  return false;
}
