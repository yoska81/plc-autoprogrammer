/**
 * Truthful meter answers from the circuit itself: with one conductor broken (or a place shorted), the solver
 * works out every voltage, and each step of guided fault finding is answered with what a meter would show.
 * Used by the practice meter in the simulator, by the simulator's practice faults (what the PLC then sees)
 * and by the fault-sweep tests. No AI and no wire-number guessing: the readings follow the real conductors.
 */
import { healthy, solve, type Circuit, type Link, type Solution } from './circuit';
import type { ElectricalModel } from '../electrical/derive';
import type { PathHop, WiringPath } from './wiringPath';
import type { Step, Symptom } from './steps';

export interface CircuitFault {
  /** A broken conductor (wire, jumper, fuse, contact that does not close). */
  link?: string;
  /** A place shorted to 24 V or to 0 V. */
  short?: { node: string; to: 24 | 0 };
  /** In plain words, for the practice bar. */
  label: string;
}

/** The value a reading asks for, in volts ("24 VDC" → 24, "about 0 V" → 0); null when it is not a voltage. */
export function expectedVolts(text: string): number | null {
  if (/^about 0 V|^0 V/i.test(text)) return 0;
  const m = /(\d+(?:\.\d+)?)\s*(?:–\s*\d+\s*)?VDC/.exec(text);
  return m ? Number(m[1]) : null;
}

const otherOf = (h: PathHop) => (h.measure?.otherwise ?? '').replace(/\s+(when|with|while|after|below|in the|:).*$/i, '') || 'about 0 V';

/** The load's own terminal on the signal (one coil of a double solenoid). */
const loadNode = (p: WiringPath) => [...p.signal].reverse().find((h) => h.kind === 'device')?.node;

/** The device states that make the point do its job (ON for an input, the load working for an output). */
export function activeState(m: ElectricalModel, c: Circuit, p: WiringPath): Record<string, boolean> | null {
  const tag = p.device;
  for (const v of [true, false]) {
    const active: Record<string, boolean> = { [p.address]: true, ...(tag ? { [tag]: v } : {}) };
    const sol = solve(c, { on: healthy(m, active) });
    if (p.type === 'input' ? sol.inputOn(p.address) : sol.loadPowered(tag, loadNode(p))) return active;
    if (!tag) break;
  }
  return null;
}

/** The opposite state of the device (OFF for an input). */
export function restState(active: Record<string, boolean>, p: WiringPath): Record<string, boolean> {
  return p.device ? { ...active, [p.device]: !active[p.device] } : active;
}

export interface Oracle {
  sol: Solution;
  answer: (step: Step, symptom: Symptom) => { yes: boolean; shows: string };
}

/** Meter answers for one point with this fault, the device in the state the symptom asks for. */
export function oracleFor(m: ElectricalModel, c: Circuit, p: WiringPath, f: CircuitFault, symptom: Symptom): Oracle | null {
  const active = activeState(m, c, p);
  if (!active) return null;
  const state = symptom === 'always-on' ? restState(active, p) : active;
  const base = { on: healthy(m, state), broken: f.link ? new Set([f.link]) : undefined, shorted: f.short ? new Map([[f.short.node, f.short.to]]) : undefined };
  const sol = solve(c, base);
  const show = (v: number) => (Math.abs(v) < 3 ? 'about 0 V' : `${Math.round(Math.abs(v))} VDC`);
  return {
    sol,
    answer: (step, sym) => {
      const h = step.hop;
      if (step.part === 'prepare' || !h) return { yes: true, shows: '' };
      if (step.part === 'isolate') {
        // The wire taken off the device: the device's signal pin cut off.
        const lifted = solve(c, { ...base, lifted: new Set(h.node ? [h.node] : []) });
        const on = lifted.inputOn(p.address);
        return { yes: on, shows: on ? `${p.address} stays ON` : `${p.address} goes OFF` };
      }
      const ns = h.measure?.nodes;
      if (!ns) return { yes: true, shows: '' };
      const v = sol.read(ns[0], ns[1]);
      const want = expectedVolts(sym === 'always-on' && step.part === 'signal' ? otherOf(h) : h.measure!.expect);
      if (want === null) return { yes: true, shows: '' };
      return { yes: Math.abs(Math.abs(v) - want) < 4, shows: show(v) };
    },
  };
}

/** Does the fault show as the symptom (the input stays OFF / ON, the load stays dead)? */
export function showsSymptom(m: ElectricalModel, c: Circuit, p: WiringPath, f: CircuitFault, symptom: Symptom): boolean {
  const active = activeState(m, c, p);
  if (!active) return false;
  const run = (state: Record<string, boolean>) => solve(c, { on: healthy(m, state), broken: f.link ? new Set([f.link]) : undefined, shorted: f.short ? new Map([[f.short.node, f.short.to]]) : undefined });
  if (symptom === 'always-on') return run(restState(active, p)).inputOn(p.address);
  const sol = run(active);
  return p.type === 'input' ? !sol.inputOn(p.address) : !sol.loadPowered(p.device, loadNode(p));
}

/** The conductors a point's steps walk past (signal, supply, return, module common). */
export function linksOf(c: Circuit, p: WiringPath): Link[] {
  const ids = new Set([...p.signal, ...p.supply, ...p.ret].map((h) => h.link?.id).filter(Boolean) as string[]);
  return c.links.filter((l) => ids.has(l.id));
}

/** What a broken conductor does to every point of the design (for the simulator's practice faults). */
export function circuitFaultEffects(m: ElectricalModel, c: Circuit, paths: WiringPath[], f: CircuitFault): { address: string; type: 'input' | 'output'; reads: boolean | null; why: string }[] {
  const out: { address: string; type: 'input' | 'output'; reads: boolean | null; why: string }[] = [];
  for (const p of paths) {
    if (p.analog) continue;
    const active = activeState(m, c, p);
    if (!active) continue;
    const rest = restState(active, p);
    const run = (state: Record<string, boolean>) => solve(c, { on: healthy(m, state), broken: f.link ? new Set([f.link]) : undefined, shorted: f.short ? new Map([[f.short.node, f.short.to]]) : undefined });
    if (p.type === 'input') {
      const on = run(active).inputOn(p.address), off = run(rest).inputOn(p.address);
      if (!on && !off) out.push({ address: p.address, type: 'input', reads: false, why: `${f.label}: ${p.address} never turns ON, whatever ${p.device || 'the device'} does` });
      else if (on && off) out.push({ address: p.address, type: 'input', reads: true, why: `${f.label}: ${p.address} is ON all the time, whatever ${p.device || 'the device'} does` });
    } else if (!run(active).loadPowered(p.device, loadNode(p))) out.push({ address: p.address, type: 'output', reads: null, why: `${f.label}: ${p.device || 'the load'} gets no power when ${p.address} turns ON` });
  }
  return out;
}

/** Did the steps name this fault: the broken conductor (its wire and one of its ends) or the contact / fuse? */
export function verdictNames(c: Circuit, v: { text: string; wire?: string; hops: PathHop[] }, f: CircuitFault): boolean {
  if (f.short) return v.hops.some((h) => h.node === f.short!.node) || (v.wire !== undefined && (c.at.get(f.short.node) ?? []).some((l) => l.wire === v.wire));
  const l = c.links.find((x) => x.id === f.link);
  if (!l) return false;
  const atEnd = v.hops.some((h) => h.node === l.a || h.node === l.b);
  if (l.kind === 'contact' || l.kind === 'fuse') return atEnd && v.text.includes(l.tag ?? '');
  return atEnd && v.wire === l.wire;
}
