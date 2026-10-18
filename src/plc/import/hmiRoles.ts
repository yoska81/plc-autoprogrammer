/**
 * What an operator panel for an imported (upgraded) program can bind to: the program's own addresses for the
 * usual HMI roles, found from the ladder and the original names. The app's generated programs keep HMI bits in
 * fixed blocks (C1001…, DS1001…); an imported program has none, so the panel uses these instead, and `missing`
 * says in plain words what the panel would need that the program does not have (a PLC change to make first).
 * Pure: X = inputs, Y = outputs, C / DS / DD / DF / T / CT as everywhere in the app.
 */
import type { LadderProgram, Rung } from '../core/ladder';

export interface Role {
  address: string;
  /** The original name. */
  nickname: string;
  /** Why this address has this role, in plain words. */
  why: string;
}
export interface ValueRole extends Role { preset?: string; unit?: string }

export interface ProgramRoles {
  start: Role[];
  stop: Role[];
  reset: Role[];
  estop: Role[];
  mode: Role[];
  /** The machine's running state: a coil that seals itself in. */
  running: Role[];
  /** Fault / alarm bits (internal bits or inputs). */
  faults: Role[];
  counters: ValueRole[];
  timers: ValueRole[];
  /** Registers an operator would set: compared against or used as a preset. */
  setpoints: Role[];
  /** Physical outputs (motors, valves, lamps), for status on the panel. */
  outputs: Role[];
  /** What the panel would need that the program does not have, in plain words. */
  missing: string[];
}

const START = /\bstart\b|start_?pb|\bstrt\b|\bcycle_?start/i;
const STOP = /\bstop\b|stop_?pb/i;
const ESTOP = /e-?stop|emergency|safety_?relay|\bes_?ok/i;
const RESET = /reset|\back\b|acknowledge|fault_?clear/i;
const MODE = /\bauto\b|\bmanual\b|\bmode\b|selector|\bhand\b/i;
const FAULT = /fault|alarm|trip|overload|\berror\b|\bjam\b|timeout|failed|_ol\b|\bol_/i;

const isX = (a: string) => /^X\d+$/i.test(a);
const isY = (a: string) => /^Y\d+$/i.test(a);
const isWord = (a: string) => /^(DS|DD|DF|DH)\d+$/i.test(a);

export function programRoles(program: LadderProgram, labels: Map<string, string> = new Map()): ProgramRoles {
  const tag = new Map(program.tags.map((t) => [t.address.toUpperCase(), t]));
  const nick = (a: string) => tag.get(a.toUpperCase())?.nickname || labels.get(a.toUpperCase()) || a;
  const text = (a: string) => [tag.get(a.toUpperCase())?.nickname, tag.get(a.toUpperCase())?.comment, labels.get(a.toUpperCase())].filter(Boolean).join(' ').replace(/_/g, ' ');
  const role = (address: string, why: string): Role => ({ address: address.toUpperCase(), nickname: nick(address), why });
  const contacts = (r: Rung) => r.branches.flat().flatMap((e) => ('address' in e && (e.type === 'NO' || e.type === 'NC' || e.type === 'RISE') ? [{ a: e.address.toUpperCase(), nc: e.type === 'NC' }] : []));
  const inputs = [...new Set([...program.tags.map((t) => t.address.toUpperCase()).filter(isX), ...program.rungs.flatMap(contacts).map((c) => c.a).filter(isX)])];
  const uniq = <T extends Role>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.address === x.address) === i);

  // Bits the program reads but never writes are set from outside: an old panel's buttons (the panel writes them).
  const writtenBits = new Set(program.rungs.flatMap((r) => r.outputs).flatMap((o) => ('address' in o && (o.type === 'OUT' || o.type === 'SET' || o.type === 'RST') ? [o.address.toUpperCase()] : [])));
  const panelBits = [...new Set(program.rungs.flatMap(contacts).map((c) => c.a))].filter((a) => /^C\d+$/i.test(a) && !writtenBits.has(a));
  const out: ProgramRoles = { start: [], stop: [], reset: [], estop: [], mode: [], running: [], faults: [], counters: [], timers: [], setpoints: [], outputs: [], missing: [] };
  for (const a of [...inputs, ...panelBits]) {
    const t = text(a);
    const bit = !isX(a);
    const what = (name: string) => (bit ? `a ${name} bit the program reads but never sets (an old panel's button): the panel writes it` : `the ${name} pushbutton input`);
    if (ESTOP.test(t)) { if (!bit) out.estop.push(role(a, 'an emergency-stop / safety input: shown on the panel, never written')); }
    else if (START.test(t)) out.start.push(role(a, what('start')));
    else if (STOP.test(t)) out.stop.push(role(a, what('stop')));
    else if (RESET.test(t)) out.reset.push(role(a, what('reset')));
    else if (MODE.test(t)) out.mode.push(role(a, bit ? what('mode') : 'a mode selector input'));
    else if (FAULT.test(t) && !bit) out.faults.push(role(a, 'a fault input (overload, trip…)'));
  }
  for (const r of program.rungs) {
    for (const o of r.outputs) {
      if (o.type === 'OUT' || o.type === 'SET') {
        const a = o.address.toUpperCase();
        const sealed = r.branches.some((b) => b.some((e) => e.type === 'NO' && e.address.toUpperCase() === a));
        if (sealed && contacts(r).some((c) => out.start.some((s) => s.address === c.a))) out.running.push(role(a, 'seals itself in after the start button: the machine is running'));
        else if (FAULT.test(text(a)) && !isX(a)) out.faults.push(role(a, `${o.type === 'SET' ? 'a latched' : 'a'} fault / alarm bit`));
        if (isY(a)) out.outputs.push(role(a, 'a physical output'));
      }
      if (o.type === 'CNT') out.counters.push({ ...role(o.address, 'a counter'), preset: o.preset });
      if (o.type === 'TMR') out.timers.push({ ...role(o.address, 'a timer'), preset: o.preset, unit: o.unit });
      if ((o.type === 'CNT' || o.type === 'TMR') && isWord(o.preset)) out.setpoints.push(role(o.preset, `the preset of ${nick(o.address)}`));
    }
  }
  // A register compared with another, that the program never writes, is set from outside: a setpoint.
  const written = new Set(program.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'COPY' || o.type === 'MATH' ? [o.dest.toUpperCase()] : [])));
  for (const e of program.rungs.flatMap((r) => r.branches.flat())) {
    if (e.type !== 'CMP' || !isWord(e.left) || !isWord(e.right)) continue;
    for (const [x, y] of [[e.left, e.right], [e.right, e.left]]) if (!written.has(x.toUpperCase())) out.setpoints.push(role(x, `compared with ${nick(y)} and never written by the program`));
  }
  for (const k of ['start', 'stop', 'reset', 'estop', 'mode', 'running', 'faults', 'outputs', 'setpoints'] as const) out[k] = uniq(out[k]);
  out.counters = uniq(out.counters);
  out.timers = uniq(out.timers);

  // What a panel would need that the program does not have: PLC changes, said plainly.
  if (!out.start.length) out.missing.push('No start input was found: a Start button on the panel needs a PLC bit and a rung that starts the machine with it.');
  else if (out.start.every((s) => isX(s.address))) out.missing.push(`Start and Stop on the panel: the program starts from ${out.start.map((s) => s.nickname).join(', ')} (a physical input). A panel button needs its own PLC bit wired in parallel with it, and a panel Stop in series with ${out.stop.map((s) => s.nickname).join(', ') || 'the stop circuit'}.`);
  const latched = program.rungs.flatMap((r) => r.outputs).filter((o) => o.type === 'SET' && out.faults.some((f) => f.address === o.address.toUpperCase()));
  if (latched.length && !out.reset.length) out.missing.push(`Faults latch (${[...new Set(latched.map((o) => ('address' in o ? nick(o.address) : '')))].join(', ')}) but no reset input was found: a panel Reset needs a PLC bit and a rung that clears them.`);
  if (!out.faults.length) out.missing.push('No fault or alarm bits were found: the alarm screen has nothing to show until the program sets some.');
  return out;
}
