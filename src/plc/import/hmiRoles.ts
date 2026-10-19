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
export interface ValueRole extends Role { preset?: string; unit?: string; /** Counters: 1, or one more than the counters it counts. */ level?: number }

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
  /** The internal fault bits with a short text, for the panel's alarm list ("Agitator motor overload"). */
  alarms: (Role & { text: string })[];
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
const ESTOP = /\be[-\s]?stop|emergency|safety[_\s]?relay|\bes[_\s]?ok/i;
const RUN = /\brun(ning)?\b|\bauto\b|\bcycle\b|\bin auto|machine on|\bstarted\b/i;
const RESET = /reset|\back\b|acknowledge|fault_?clear/i;
const MODE = /\bauto\b|\bmanual\b|\bmode\b|selector|\bhand\b/i;
const FAULT = /fault|alarm|\balm\b|trip|overload|\bol\b|\berror\b|\bjam\b|timeout|failed/i;
/** Names of sensors (a photo eye at a "case stop" is not a Stop button, one with "jam" in its comment not a fault). */
const SENSOR = /(^|\s)(pe|px|ls|ps|ts|fs|lt|pt|tt|prox|photo|eye|sensor|switch|level|limit)(\s|$|\d)/i;
/** Inputs that are ON when all is well: never an alarm bit. */
const HEALTHY = /\bok\b|healthy|\bready\b|\bclear\b/i;
/** Lamps and horns show an alarm, they are not one. */
const ANNUNCIATOR = /lamp|light|\blt\b|horn|buzzer|beacon|siren|stack/i;

const isX = (a: string) => /^X\d+$/i.test(a);
const isY = (a: string) => /^Y\d+$/i.test(a);
const isWord = (a: string) => /^(DS|DD|DF|DH)\d+$/i.test(a);

export function programRoles(program: LadderProgram, labels: Map<string, string> = new Map()): ProgramRoles {
  const tag = new Map(program.tags.map((t) => [t.address.toUpperCase(), t]));
  const nick = (a: string) => tag.get(a.toUpperCase())?.nickname || labels.get(a.toUpperCase()) || a;
  // Roles are told by the name (the comment alone says too much: "photo eye … (jam detection)").
  const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.[\]]+/g, ' ');
  const name = (a: string) => words(nick(a));
  const comment = (a: string) => tag.get(a.toUpperCase())?.comment || labels.get(a.toUpperCase()) || '';
  const role = (address: string, why: string): Role => ({ address: address.toUpperCase(), nickname: nick(address), why });
  const contacts = (r: Rung) => r.branches.flat().flatMap((e) => ('address' in e && (e.type === 'NO' || e.type === 'NC' || e.type === 'RISE') ? [{ a: e.address.toUpperCase(), nc: e.type === 'NC' }] : []));
  const inputs = [...new Set([...program.tags.map((t) => t.address.toUpperCase()).filter(isX), ...program.rungs.flatMap(contacts).map((c) => c.a).filter(isX)])];
  const uniq = <T extends Role>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.address === x.address) === i);
  // A counter's level: 1, or one more than the counters whose done bits it counts (pallets count layers count cases).
  const cntRung = new Map(program.rungs.flatMap((r) => r.outputs.flatMap((o) => (o.type === 'CNT' ? [[o.address.toUpperCase(), r] as const] : []))));
  const counterLevel = (a: string, seen = new Set<string>()): number => {
    const r = cntRung.get(a);
    if (!r || seen.has(a)) return 0;
    seen.add(a);
    return 1 + Math.max(0, ...contacts(r).map((c) => counterLevel(c.a, seen)));
  };

  // Bits the program reads but never writes are set from outside: an old panel's buttons (the panel writes them).
  const writtenBits = new Set(program.rungs.flatMap((r) => r.outputs).flatMap((o) => ('address' in o && (o.type === 'OUT' || o.type === 'SET' || o.type === 'RST') ? [o.address.toUpperCase()] : [])));
  const panelBits = [...new Set(program.rungs.flatMap(contacts).map((c) => c.a))].filter((a) => /^C\d+$/i.test(a) && !writtenBits.has(a));
  const out: ProgramRoles = { start: [], stop: [], reset: [], estop: [], mode: [], running: [], faults: [], alarms: [], counters: [], timers: [], setpoints: [], outputs: [], missing: [] };
  for (const a of [...inputs, ...panelBits]) {
    const t = name(a);
    const bit = !isX(a);
    if (SENSOR.test(t) && !ESTOP.test(t)) continue;
    const what = (name: string) => (bit ? `a ${name} bit the program reads but never sets (an old panel's button): the panel writes it` : `the ${name} pushbutton input`);
    if (ESTOP.test(t)) { if (!bit) out.estop.push(role(a, 'an emergency-stop / safety input: shown on the panel, never written')); }
    else if (START.test(t)) out.start.push(role(a, what('start')));
    else if (STOP.test(t)) out.stop.push(role(a, what('stop')));
    else if (RESET.test(t)) out.reset.push(role(a, what('reset')));
    else if (MODE.test(t)) out.mode.push(role(a, bit ? what('mode') : 'a mode selector input'));
    else if (FAULT.test(t) && !bit && !HEALTHY.test(t)) out.faults.push(role(a, 'a fault input (overload, trip…)'));
  }
  for (const r of program.rungs) {
    for (const o of r.outputs) {
      if (o.type === 'OUT' || o.type === 'SET') {
        const a = o.address.toUpperCase();
        const sealed = r.branches.some((b) => b.some((e) => e.type === 'NO' && e.address.toUpperCase() === a));
        const fromStart = contacts(r).some((c) => out.start.some((s) => s.address === c.a));
        if (fromStart && (sealed || (o.type === 'SET' && RUN.test(name(a)))) && !isY(a)) out.running.push(role(a, sealed ? 'seals itself in after the start button: the machine is running' : 'set by the start button: the machine is running'));
        else if (!isX(a) && !isY(a) && FAULT.test(name(a)) && !HEALTHY.test(name(a)) && !ANNUNCIATOR.test(name(a))) {
          out.faults.push(role(a, `${o.type === 'SET' ? 'a latched' : 'a'} fault / alarm bit`));
          // The comment as the original programmer wrote it (not the import's own "Original: M51 —" / "Bit 0 of …").
          // No comment of its own (an array bit, Alm[0].3): the comment of the rung that sets it ("Alarm 3: infeed overload").
          const plain = (t: string) => t.replace(/^Original:[^—]*—\s*/, '').replace(/^Bit \d+ of .*$/, '').replace(/^\s*(alarm|fault|alm)\s*\d*\s*[:-]\s*/i, '').split('\n')[0].trim();
          // Only a rung that writes this one fault bit speaks for it ("Alarms: overloads" over two bits names neither).
          const faultBits = r.outputs.filter((x) => (x.type === 'OUT' || x.type === 'SET') && !isX(x.address) && !isY(x.address) && FAULT.test(name(x.address.toUpperCase()))).length;
          const said = plain(comment(a)) || (faultBits === 1 ? plain(r.comment ?? '') : '');
          out.alarms.push({ ...role(a, 'a fault / alarm bit of the program'), text: said ? said[0].toUpperCase() + said.slice(1) : nick(a) });
        }
        if (isY(a)) out.outputs.push(role(a, 'a physical output'));
      }
      if (o.type === 'CNT') out.counters.push({ ...role(o.address, 'a counter'), preset: o.preset, level: 1 + Math.max(0, ...contacts(r).map((c) => counterLevel(c.a))) });
      if (o.type === 'TMR') out.timers.push({ ...role(o.address, 'a timer'), preset: o.preset, unit: o.unit });
      if ((o.type === 'CNT' || o.type === 'TMR') && isWord(o.preset)) out.setpoints.push(role(o.preset, `the preset of ${nick(o.address)}`));
    }
  }
  // A register compared with another, that the program never writes (also not in kept code: "Level_Pct := …"), is
  // set from outside: a setpoint.
  const byNick = new Map(program.tags.map((t) => [t.nickname.toLowerCase(), t.address.toUpperCase()]));
  const rawWrites = program.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'RAW' ? [...o.text.matchAll(/["#]?([A-Za-z_][\w.]*)"?\s*:=/g)].map((m) => byNick.get(m[1].toLowerCase()) ?? '') : []));
  const written = new Set([...program.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'COPY' || o.type === 'MATH' ? [o.dest.toUpperCase()] : [])), ...rawWrites]);
  for (const e of program.rungs.flatMap((r) => r.branches.flat())) {
    if (e.type !== 'CMP' || !isWord(e.left) || !isWord(e.right)) continue;
    for (const [x, y] of [[e.left, e.right], [e.right, e.left]]) if (!written.has(x.toUpperCase())) out.setpoints.push(role(x, `compared with ${nick(y)} and never written by the program`));
  }
  // No running coil found from the start button: a bit named for it (Auto_Run), set or driven by the program.
  if (!out.running.length) {
    const named = [...writtenBits].find((a) => /^C\d+$/i.test(a) && RUN.test(name(a)) && !FAULT.test(name(a)));
    if (named) out.running.push(role(named, 'named for the running state and set by the program'));
  }
  for (const k of ['start', 'stop', 'reset', 'estop', 'mode', 'running', 'faults', 'outputs', 'setpoints'] as const) out[k] = uniq(out[k]);
  out.alarms = uniq(out.alarms);
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

/** The parts of an HMI tag (src/hmi/types.ts HmiTag) the panel builder reuses for a role. */
export interface RoleTag { name: string; address: string; dataType: 'BIT' | 'INT' | 'INT2' | 'FLOAT'; access: 'read' | 'write' | 'read-write'; description: string; role: string }

export interface ImportPanelTags {
  /** Tags with a role of the panel builder (build.ts planTags): it binds to these instead of its own C1001… blocks. */
  tags: RoleTag[];
  /** Commands the program takes from a physical input: the panel needs its own bit in parallel (in series for a stop). */
  parallelTo: { role: string; address: string; nickname: string }[];
  /** Counter presets written as constants in the rung: to move into a register so the panel can set them. */
  constPresets: { address: string; nickname: string; preset: string }[];
}

const dataTypeOf = (a: string): RoleTag['dataType'] => (/^(DF)\d+$/i.test(a) ? 'FLOAT' : /^(DD|CTD)\d+$/i.test(a) ? 'INT2' : /^(DS|DH|TD)\d+$/i.test(a) ? 'INT' : 'BIT');

/**
 * The roles as the panel builder's tags (role names of src/hmi/engine/build.ts): commands an old panel already
 * wrote (cmd:start / stop / reset / manual), the running state, fault inputs (alarm:fault:<input>), the count and
 * the batch setpoint. Only roles whose meaning is plain are given; the builder allocates the rest and lists them as
 * PLC changes. An "OK" safety input is the inverse of an alarm bit, so it is not given as alarm:safety.
 */
export function panelTags(r: ProgramRoles): ImportPanelTags {
  const tags: RoleTag[] = [];
  const parallelTo: ImportPanelTags['parallelTo'] = [];
  const constPresets: ImportPanelTags['constPresets'] = [];
  const tag = (x: Role, role: string, access: RoleTag['access'], address = x.address) => tags.push({ name: x.nickname, address, dataType: dataTypeOf(address), access, description: x.why, role });
  const command = (xs: Role[], role: string) => {
    const bit = xs.find((x) => !isX(x.address));
    if (bit) tag(bit, role, 'read-write');
    else if (xs[0]) parallelTo.push({ role, address: xs[0].address, nickname: xs[0].nickname });
  };
  command(r.start, 'cmd:start');
  command(r.stop, 'cmd:stop');
  command(r.reset, 'cmd:reset');
  const manual = r.mode.find((x) => /manual|hand/i.test(x.nickname));
  if (manual) { if (isX(manual.address)) tag(manual, 'sts:manual', 'read'); else tag(manual, 'cmd:manual', 'read-write'); }
  if (r.running[0]) tag(r.running[0], 'sts:running', 'read');
  for (const f of r.faults) if (isX(f.address) && !/\bok\b|_ok\b|healthy/i.test(f.nickname)) tag(f, `alarm:fault:${f.address}`, 'read');
  // The production count: not a reject / fault counter; the top of a chain (pallets, not cases); a settable preset.
  const score = (c: ValueRole) => (/reject|fault|error|alarm|scrap/i.test(c.nickname) ? 0 : 100) + 10 * (c.level ?? 1) + (c.preset && isWord(c.preset) ? 1 : 0);
  const count = [...r.counters].sort((a, b) => score(b) - score(a))[0];
  if (count) {
    // The counter's value word: CT1 counts in CTD1.
    tag(count, 'word:count', 'read', count.address.replace(/^CT(\d+)$/i, 'CTD$1'));
    if (count.preset && isWord(count.preset)) tag({ ...count, nickname: nickOf(r, count.preset) ?? count.preset, why: `the preset of ${count.nickname}` }, 'sp:batch', 'read-write', count.preset.toUpperCase());
    else if (count.preset) constPresets.push({ address: count.address, nickname: count.nickname, preset: count.preset });
  }
  return { tags, parallelTo, constPresets };
}
const nickOf = (r: ProgramRoles, address: string) => r.setpoints.find((s) => s.address === address.toUpperCase())?.nickname;
