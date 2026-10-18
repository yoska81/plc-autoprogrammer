/// <reference types="node" />
/**
 * Independent strict fault sweep (the reviewer's spec). Run with:  npx tsx src/troubleshoot/isweep.test.ts
 *
 * The circuit is built here from buildModel(ctx) alone — none of wiringPath / circuit.ts / faults.ts — and
 * solved by nodal analysis with one fault at a time; the guided steps are answered with the meter readings it
 * gives, and the verdict must name the fault. Beyond the spec's wire-list circuit, the trunk and device cable
 * cores and the junction-box terminals of the design are modelled too (the steps read at JB terminals).
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { buildModel, type DrawingContext, type ElectricalModel } from '../electrical/derive';
import { wiringPaths, type PathHop, type WiringPath } from './wiringPath';
import { answer, currentStep, startSession, type Step, type Symptom, type Verdict } from './steps';
import { sealingHead, sealingHeadMixed } from './testFixtures';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

// --- circuit -------------------------------------------------------------------------------------------------
interface Cond { id: number; a: string; b: string; wire: string; join: boolean; ends: [string, string] }
interface Contact { tag: string; a: string; b: string; nc: boolean; pins: string }
interface Gel { a: string; b: string; g: number; tag: string; kind: 'coil' | 'load' | 'input' | 'power' }
interface Sensor { tag: string; bn: string; bu: string; bk: string; npn: boolean }
interface Model {
  conds: Cond[]; contacts: Contact[]; gs: Gel[]; sensors: Sensor[];
  plus: string; minus: string; ground: string;
  /** PLC input address → [terminal node, common node]; output address → [terminal, common or +V]. */
  inputs: Map<string, [string, string]>; outputs: Map<string, [string, string]>;
  nodes: Set<string>; byRaw: Map<string, string[]>;
  coilTags: Set<string>;
}
const nk = (raw: string, wire: string) => `${raw.trim()}|${wire}`;
const rawOf = (n: string) => n.slice(0, n.lastIndexOf('|'));
const wireOf = (n: string) => n.slice(n.lastIndexOf('|') + 1);
const tagOfRaw = (raw: string): string[] => {
  const jb = /^(\S+)\s+\((.+)\)$/.exec(raw);
  if (jb) return [jb[1], jb[2]];
  if (raw.includes(':')) return [raw.split(':')[0]];
  const t = /^([A-Z]+\d+)[- ]/.exec(raw);
  return [t ? t[1] : raw];
};
const DROP = /^(L\d|T\d|\dL\d|\dT\d|PE|SH|ENET|N)$|-(L|T)\d$|^M\d-|^PS\d-L/i;

function buildCircuitModel(m: ElectricalModel): Model {
  const conds: Cond[] = [];
  const add = (a: string, b: string, wire: string, join = false) => { if (a !== b) conds.push({ id: conds.length, a, b, wire, join, ends: [rawOf(a), rawOf(b)] }); };
  const plcTag = m.plcTag;
  const devCables = m.machine.cables.filter((c) => c.kind === 'device');
  const viaCable = new Set(devCables.map((c) => c.to));
  const isJbEnd = (x: string) => /^\S+\s+\(.+\)$/.test(x) || m.machine.jbs.some((j) => x.startsWith(`${j.tag} `));
  // Device pin per wire as the wire list names it ("PE1" + "24+" → "PE1:BN").
  const listPin = new Map<string, string>();
  for (const w of m.wires) for (const e of [w.from.trim(), w.to.trim()]) if (/^[^\s:]+:\S+$/.test(e) && viaCable.has(e.split(':')[0])) listPin.set(`${e.split(':')[0]}|${w.wire}`, e);
  for (const w of m.wires) {
    if (DROP.test(w.wire) || /ethernet|shield/i.test(w.function)) continue;
    const [a, b] = [w.from.trim(), w.to.trim()];
    // Entries that run through the field cables are replaced by their cores below.
    if ([a, b].some((x) => isJbEnd(x) || (x.includes(':') && viaCable.has(x.split(':')[0]) && x.split(':')[0] !== plcTag))) continue;
    add(nk(a, w.wire), nk(b, w.wire), w.wire);
  }
  for (const c of m.machine.cables) {
    if (c.kind === 'motor') continue;
    for (const k of c.cores) {
      if (DROP.test(k.wire)) continue;
      const to = c.kind === 'device' ? listPin.get(`${c.to}|${k.wire}`) ?? k.to : k.to;
      add(nk(k.from, k.wire), nk(to, k.wire), k.wire);
    }
  }
  for (const t of m.machine.jbs.flatMap((j) => j.terminals)) {
    const jm = /^JUMPER\s+(\S+)/.exec(t.incoming);
    if (jm) add(nk(t.label, t.wire), nk(jm[1], t.wire), t.wire, true);
  }
  const nodes = new Set(conds.flatMap((c) => [c.a, c.b]));
  const byRaw = new Map<string, string[]>();
  for (const n of nodes) (byRaw.get(rawOf(n)) ?? byRaw.set(rawOf(n), []).get(rawOf(n))!).push(n);
  // Strip jumpers / bus bars; a terminal carrying two wire numbers (a fused terminal) is a join.
  for (const t of m.strips.flatMap((st) => st.terminals)) {
    const j = /^(.*) \(jumper\)$/.exec(t.internal);
    if (j && !t.fuse) { const x = nk(j[1].trim(), t.wire), y = nk(t.label, t.wire); if (nodes.has(x) && nodes.has(y)) add(x, y, t.wire, true); }
  }
  for (const [, ns] of byRaw) for (let i = 1; i < ns.length; i++) add(ns[0], ns[i], wireOf(ns[i]), true);
  const pinNode = (tag: string, pin: string) => [...nodes].find((n) => rawOf(n) === `${tag}:${pin}`);
  // Contacts of non-PLC devices.
  const tags = new Set([...nodes].map((n) => rawOf(n)).filter((r) => r.includes(':')).map((r) => r.split(':')[0]));
  const contacts: Contact[] = [];
  const NO: [string, string][] = [['13', '14'], ['23', '24'], ['33', '34'], ['43', '44'], ['C', 'NO'], ['R1', 'R1O'], ['97', '98']];
  const NCP: [string, string][] = [['11', '12'], ['21', '22'], ['31', '32'], ['61', '62'], ['95', '96'], ['C', 'NC'], ['R1', 'R1C']];
  const gs: Gel[] = [];
  const coilTags = new Set<string>();
  const cat = new Map(m.rc.map((c) => [c.tag, c.category]));
  for (const tag of tags) {
    if (tag === plcTag || cat.get(tag) === 'plc' || cat.get(tag) === 'plcModule' || cat.get(tag) === 'powerSupply' || m.machine.jbs.some((j) => j.tag === tag)) continue;
    for (const [pairs, nc] of [[NO, false], [NCP, true]] as const) for (const [x, y] of pairs) {
      const a = pinNode(tag, x), b = pinNode(tag, y);
      if (a && b) contacts.push({ tag, a, b, nc, pins: `${x}-${y}` });
    }
    const a1 = pinNode(tag, 'A1'), a2 = pinNode(tag, 'A2');
    if (cat.get(tag) === 'solenoidValve') {
      const pins = [...nodes].filter((n) => rawOf(n).startsWith(`${tag}:`));
      const com = pins.find((n) => /2/.test(rawOf(n).split(':')[1]) && (/\+/.test(rawOf(n)) || pins.length === 2));
      if (com) for (const n of pins) if (n !== com && !/PE/.test(rawOf(n))) gs.push({ a: n, b: com, g: 1 / 60, tag, kind: 'coil' });
    } else if (a1 && a2) { gs.push({ a: a1, b: a2, g: 1 / 400, tag, kind: 'coil' }); coilTags.add(tag); }
    if (cat.get(tag) === 'pilotLight') { const ps = [...nodes].filter((n) => rawOf(n).startsWith(`${tag}:`)); if (ps.length >= 2 && !a1) gs.push({ a: ps[0], b: ps[1], g: 1 / 800, tag, kind: 'load' }); }
    const dcm = pinNode(tag, 'DCM');
    if (dcm) for (const n of [...nodes].filter((x) => /^.+:DI\d$/.test(rawOf(x)) && rawOf(x).startsWith(`${tag}:`))) gs.push({ a: n, b: dcm, g: 1 / 4700, tag, kind: 'load' });
  }
  // Sensors: device power BN–BU, output BK.
  const sensors: Sensor[] = [];
  for (const p of m.io) {
    if (!p.deviceTag || (p.deviceType !== 'sensor-pnp' && p.deviceType !== 'sensor-npn')) continue;
    const bn = pinNode(p.deviceTag, 'BN') ?? pinNode(p.deviceTag, '1'), bu = pinNode(p.deviceTag, 'BU') ?? pinNode(p.deviceTag, '3'), bk = pinNode(p.deviceTag, 'BK') ?? pinNode(p.deviceTag, '4');
    if (bn && bu && bk) { sensors.push({ tag: p.deviceTag, bn, bu, bk, npn: p.deviceType === 'sensor-npn' }); gs.push({ a: bn, b: bu, g: 1 / 100, tag: p.deviceTag, kind: 'power' }); }
  }
  // PLC: power, inputs to their common, outputs to their common / supply.
  const p24 = pinNode(plcTag, '24V'), p0 = pinNode(plcTag, '0V');
  if (p24 && p0) gs.push({ a: p24, b: p0, g: 1 / 200, tag: plcTag, kind: 'power' });
  const inputs = new Map<string, [string, string]>(), outputs = new Map<string, [string, string]>();
  for (const g of m.groups) {
    const com = g.type === 'input' ? pinNode(g.devTag, 'COM') : g.outputStyle === 'sinking' ? pinNode(g.devTag, 'C') : pinNode(g.devTag, '+V');
    for (const p of g.points) {
      const t = pinNode(plcTag, p.address);
      if (!t || !com) continue;
      if (g.type === 'input') { inputs.set(p.address, [t, com]); gs.push({ a: t, b: com, g: 1 / 4700, tag: p.address, kind: 'input' }); }
      else outputs.set(p.address, [t, com]);
    }
  }
  const ps = m.rc.find((c) => c.category === 'powerSupply')!.tag;
  const plus = pinNode(ps, '+V')!, minus = pinNode(ps, '-V')!;
  const gb = [...nodes].find((n) => rawOf(n) === 'GB1');
  return { conds, contacts, gs, sensors, plus, minus, ground: gb ?? minus, inputs, outputs, nodes, byRaw, coilTags };
}

// --- solver --------------------------------------------------------------------------------------------------
interface State {
  dut: string; dutOn: boolean; dutContact?: Contact;
  /** Output addresses commanded ON (and actually switching). */
  commanded: Set<string>;
  open?: Set<number>; openContact?: Contact; shorts?: [string, 24 | 0][]; lifted?: string; psuDead?: boolean;
  loadOpen?: string; inputDead?: string; dutStuck?: boolean;
}
interface Sol { v: (n: string) => number; inputOn: (addr: string) => boolean; loadOn: (tag: string, node?: string) => boolean }

function solveCircuit(c: Model, s: State): Sol {
  let coilOn = new Set<string>(), sensOn = new Set<string>();
  let V = new Map<string, number>();
  for (let it = 0; it < 12; it++) {
    const parent = new Map<string, string>();
    const find = (x: string): string => { let r = x; while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!; if (!parent.has(r)) parent.set(r, r); return r; };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    for (const n of c.nodes) find(n);
    for (const k of c.conds) {
      if (s.open?.has(k.id)) continue;
      if (s.lifted && (k.a === s.lifted || k.b === s.lifted)) continue;
      union(k.a, k.b);
    }
    for (const k of c.contacts) {
      if (k === s.openContact) continue;
      if (s.lifted && (k.a === s.lifted || k.b === s.lifted)) continue;
      let closed: boolean;
      if (k === s.dutContact || (k.tag === s.dut && !s.dutContact)) closed = k === s.dutContact ? s.dutOn : (k.nc ? !s.dutOn : s.dutOn);
      else if (c.coilTags.has(k.tag)) closed = coilOn.has(k.tag) !== k.nc;
      else if (/^(ES|GS)\d/.test(k.tag) || /^OL\d/.test(k.tag)) closed = k.nc;
      else closed = k.nc; // shelf state
      if (closed) union(k.a, k.b);
    }
    for (const sn of c.sensors) {
      const on = sn.tag === s.dut ? s.dutOn : false;
      if (on && sensOn.has(sn.tag)) union(sn.bk, sn.npn ? sn.bu : sn.bn);
    }
    for (const [addr, [t, com]] of c.outputs) if (s.commanded.has(addr)) union(t, com);
    const src = s.psuDead ? null : [find(c.plus), find(c.minus)] as const;
    for (const [n, to] of s.shorts ?? []) if (!s.psuDead) union(n, to === 24 ? c.plus : c.minus);
    // Nodal analysis on the supernodes; ground = the ground node; the supply as a voltage source.
    const gnd = find(c.ground);
    const supers = [...new Set([...c.nodes].map(find))].filter((x) => x !== gnd);
    const idx = new Map(supers.map((x, i) => [x, i]));
    const n = supers.length + (src ? 1 : 0);
    const A = Array.from({ length: n }, () => new Float64Array(n + 1));
    const stamp = (a: string, b: string, g: number) => {
      const ia = idx.get(find(a)), ib = idx.get(find(b));
      if (ia !== undefined) A[ia][ia] += g;
      if (ib !== undefined) A[ib][ib] += g;
      if (ia !== undefined && ib !== undefined) { A[ia][ib] -= g; A[ib][ia] -= g; }
    };
    for (let i = 0; i < supers.length; i++) A[i][i] += 1e-12;
    for (const e of c.gs) {
      if (e.tag === s.loadOpen && e.kind === 'coil') continue;
      if (e.kind === 'input' && e.tag === s.inputDead) continue;
      if (find(e.a) !== find(e.b)) stamp(e.a, e.b, e.g);
    }
    if (src) {
      const k = supers.length, [pp, mm] = src;
      const ip = idx.get(pp), im = idx.get(mm);
      if (pp !== mm) {
        if (ip !== undefined) { A[ip][k] += 1; A[k][ip] += 1; }
        if (im !== undefined) { A[im][k] -= 1; A[k][im] -= 1; }
        A[k][n] = 24;
      } else A[k][k] = 1;
    }
    // Gaussian elimination with partial pivoting.
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      [A[col], A[piv]] = [A[piv], A[col]];
      const d = A[col][col];
      if (Math.abs(d) < 1e-20) continue;
      for (let r = 0; r < n; r++) {
        if (r === col || A[r][col] === 0) continue;
        const f = A[r][col] / d;
        for (let k2 = col; k2 <= n; k2++) A[r][k2] -= f * A[col][k2];
      }
    }
    const val = new Map<string, number>([[gnd, 0]]);
    supers.forEach((x, i) => val.set(x, Math.abs(A[i][i]) > 1e-20 ? A[i][n] / A[i][i] : 0));
    V = new Map([...c.nodes].map((x) => [x, val.get(find(x)) ?? 0]));
    const nextCoil = new Set(c.gs.filter((e) => e.kind === 'coil' && c.coilTags.has(e.tag) && Math.abs((V.get(e.a) ?? 0) - (V.get(e.b) ?? 0)) > 18).map((e) => e.tag));
    const nextSens = new Set(c.sensors.filter((x) => Math.abs((V.get(x.bn) ?? 0) - (V.get(x.bu) ?? 0)) > 18).map((x) => x.tag));
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
    if (same(nextCoil, coilOn) && same(nextSens, sensOn) && it > 0) break;
    coilOn = nextCoil; sensOn = nextSens;
  }
  const v = (x: string) => V.get(x) ?? 0;
  return {
    v,
    inputOn: (addr) => { if (addr === s.inputDead) return false; const io = c.inputs.get(addr); return Boolean(io && Math.abs(v(io[0]) - v(io[1])) > 15); },
    loadOn: (tag, node) => c.gs.filter((e) => e.tag === tag && (e.kind === 'coil' || e.kind === 'load') && e.tag !== s.loadOpen && (!node || e.a === node || e.b === node)).some((e) => Math.abs(v(e.a) - v(e.b)) > 18),
  };
}

// --- faults --------------------------------------------------------------------------------------------------
type Expect = { kind: 'open'; wire: string; ends: string[] } | { kind: 'contact'; tag: string } | { kind: 'psu'; tag: string } | { kind: 'plc' } | { kind: 'device'; tag: string } | { kind: 'short'; wire: string };
interface Case { label: string; symptom: Symptom; state: Partial<State>; expect: Expect }

/** Conductors (and non-DUT contacts) from a node to a goal, breadth first; null when unreachable. */
function bfs(c: Model, from: string, goal: (n: string) => boolean, dut: string, stopAt: Set<string>): { conds: Cond[]; contacts: Contact[]; end: string } | null {
  const prev = new Map<string, { n: string; via: Cond | Contact }>();
  const seen = new Set([from]);
  let fr = [from];
  while (fr.length) {
    const nx: string[] = [];
    for (const n of fr) {
      if (n !== from && goal(n)) {
        const conds: Cond[] = [], contacts: Contact[] = [];
        for (let x = n; x !== from; x = prev.get(x)!.n) { const v = prev.get(x)!.via; if ('join' in v) conds.push(v); else contacts.push(v); }
        return { conds, contacts, end: n };
      }
      if (stopAt.has(n) && n !== from) continue;
      for (const k of c.conds) for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) if (x === n && !seen.has(y)) { seen.add(y); prev.set(y, { n, via: k }); nx.push(y); }
      for (const k of c.contacts) if (k.tag !== dut) for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) if (x === n && !seen.has(y)) { seen.add(y); prev.set(y, { n, via: k }); nx.push(y); }
    }
    fr = nx;
  }
  return null;
}

function casesFor(c: Model, p: WiringPath): { cases: Case[]; dutNode?: string; dutContact?: Contact; notes: string[] } {
  const notes: string[] = [];
  const out: Case[] = [];
  const dut = p.device;
  const dutNodes = new Set([...c.nodes].filter((n) => tagOfRaw(rawOf(n)).includes(dut)));
  const plcNode = (p.type === 'input' ? c.inputs : c.outputs).get(p.address)?.[0];
  if (!plcNode || !dutNodes.size) { notes.push(`${p.address}: no PLC terminal or device in the circuit`); return { cases: [], notes }; }
  const supply = new Set([c.plus, c.minus, c.ground]);
  const sig = bfs(c, plcNode, (n) => dutNodes.has(n), dut, supply);
  if (!sig) { notes.push(`${p.address}: no signal path to ${dut}`); return { cases: [], notes }; }
  const dutNode = sig.end;
  const opens = (r: { conds: Cond[]; contacts: Contact[] } | null, symptom: Symptom, why: string) => {
    if (!r) return;
    for (const k of r.conds) if (!k.join) out.push({ label: `${why}: open wire ${k.wire} ${k.ends.join(' – ')}`, symptom, state: { open: new Set([k.id]) }, expect: { kind: 'open', wire: k.wire, ends: k.ends.flatMap(tagOfRaw) } });
    for (const k of r.contacts) out.push({ label: `${why}: contact ${k.tag} ${k.pins} stuck open`, symptom, state: { openContact: k }, expect: { kind: 'contact', tag: k.tag } });
  };
  const toSupply = (from: string) => bfs(c, from, (n) => n === c.plus || n === c.minus, dut, new Set());
  const dutContact = c.contacts.find((k) => k.tag === dut && (k.a === dutNode || k.b === dutNode));
  const sensor = c.sensors.find((x) => x.tag === dut);
  if (p.type === 'input') {
    opens(sig, 'never-on', 'signal');
    if (sensor) { opens(toSupply(sensor.bn), 'never-on', 'sensor feed'); opens(toSupply(sensor.bu), 'never-on', 'sensor 0 V'); }
    else if (dutContact) { const other = dutContact.a === dutNode ? dutContact.b : dutContact.a; const r = toSupply(other); opens(r, 'never-on', r?.end === c.minus ? '0V feed (NPN common)' : 'contact feed'); }
    opens(toSupply(c.inputs.get(p.address)![1]), 'never-on', 'common');
    out.push({ label: 'device never switches', symptom: 'never-on', state: { dutStuck: true }, expect: { kind: 'device', tag: dut } });
    out.push({ label: 'PLC point dead', symptom: 'never-on', state: { inputDead: p.address }, expect: { kind: 'plc' } });
    for (const k of sig.conds) for (const n of [k.a, k.b]) if (n !== dutNode && !dutNodes.has(n)) out.push({ label: `short ${rawOf(n)}`, symptom: 'always-on', state: { shorts: [[n, 24]] }, expect: { kind: 'short', wire: wireOf(n) } });
    out.push({ label: 'device stuck ON', symptom: 'always-on', state: { dutStuck: true }, expect: { kind: 'device', tag: dut } });
  } else {
    opens(sig, 'output-dead', 'signal');
    const coil = c.gs.find((e) => e.tag === dut && (e.a === dutNode || e.b === dutNode));
    if (coil) opens(toSupply(coil.a === dutNode ? coil.b : coil.a), 'output-dead', 'load far side');
    opens(toSupply(c.outputs.get(p.address)![1]), 'output-dead', 'common / +V');
    out.push({ label: 'load open', symptom: 'output-dead', state: { loadOpen: dut }, expect: { kind: 'device', tag: dut } });
    out.push({ label: 'PLC point dead', symptom: 'output-dead', state: { commanded: new Set() }, expect: { kind: 'plc' } });
  }
  out.push({ label: 'PSU dead', symptom: p.type === 'input' ? 'never-on' : 'output-dead', state: { psuDead: true }, expect: { kind: 'psu', tag: rawOf(c.plus).split(':')[0] } });
  // Shorts: to 0 V when the input's common sits on 24 V (NPN group).
  const npn = (() => { const io = c.inputs.get(p.address); if (!io) return false; const sol = solveCircuit(c, { dut, dutOn: false, commanded: new Set() }); return sol.v(io[1]) > 18; })();
  for (const k of out) if (k.state.shorts) k.state.shorts = k.state.shorts.map(([n]) => [n, npn ? 0 : 24]);
  return { cases: out, dutNode, dutContact, notes };
}

// --- answering -----------------------------------------------------------------------------------------------
function resolve(c: Model, label: string, wire?: string): string | null | 'ground' {
  const l = label.trim();
  if (l === 'PE bar') return 'ground';
  for (const cand of [l, l.replace(/^(\S+)\s+(\S+)$/, '$1:$2'), l.replace(/^(\S+):(\S+)$/, '$1 $2'), l.replace(/^(\S+)\s+(\d+)$/, '$1-$2')]) {
    const ns = c.byRaw.get(cand);
    if (ns?.length) return ns.find((n) => wireOf(n) === wire) ?? ns[0];
  }
  return null;
}
const range = (yes: string): [number, number] => (/12–24/.test(yes) ? [10, 30] : /24 V/.test(yes) ? [19, 30] : /0 V/.test(yes) ? [0, 3] : [19, 30]);

function run(c: Model, p: WiringPath, cs: Case, dutContact: Contact | undefined, dutNode: string): { v: Verdict | null; fail?: string } {
  const always = cs.symptom === 'always-on';
  const dutOn = always ? Boolean(cs.state.dutStuck) : !cs.state.dutStuck;
  const commanded = cs.state.commanded ?? new Set(p.type === 'output' ? [p.address] : []);
  const st: State = { dut: p.device, dutOn, dutContact, commanded, ...cs.state };
  st.dutOn = dutOn;
  st.commanded = commanded;
  const sol = solveCircuit(c, st);
  // The symptom must be there.
  if (p.type === 'input') {
    if (always ? !sol.inputOn(p.address) : sol.inputOn(p.address)) return { v: null, fail: 'no symptom' };
  } else if (sol.loadOn(p.device, dutNode)) return { v: null, fail: 'no symptom' };
  let s = startSession(p, cs.symptom);
  for (let i = 0; i < 60 && currentStep(s); i++) {
    const step: Step = currentStep(s)!;
    let a: 'yes' | 'no';
    if (step.part === 'prepare') a = always ? (sol.inputOn(p.address) ? 'yes' : 'no') : 'yes';
    else if (step.part === 'isolate') a = solveCircuit(c, { ...st, lifted: dutNode }).inputOn(p.address) ? 'yes' : 'no';
    else {
      const h: PathHop | undefined = step.hop;
      const m = h?.measure;
      if (!m) return { v: null, fail: `step without a reading: ${step.say}` };
      const na = resolve(c, m.between[0], h?.wire), nb = resolve(c, m.between[1], h?.wire);
      if (!na || !nb) return { v: null, fail: `cannot resolve ${m.between.join(' ~ ')}` };
      const va = na === 'ground' ? sol.v(c.ground) : sol.v(na), vb = nb === 'ground' ? sol.v(c.ground) : sol.v(nb);
      const [lo, hi] = range(step.yes);
      const r = Math.abs(va - vb);
      a = r >= lo && r <= hi ? 'yes' : 'no';
    }
    s = answer(s, a);
  }
  return { v: s.verdict };
}

function scored(v: Verdict, e: Expect): boolean {
  const tags = v.hops.flatMap((h) => [h.tag, ...(h.node ? tagOfRaw(h.node.split('|')[0]) : [])]);
  switch (e.kind) {
    case 'psu': return v.hops.some((h) => h.kind === 'source' && h.tag === e.tag) && /No output/.test(v.text);
    case 'plc': return v.hops.some((h) => h.kind === 'plc') && !v.wire && !/open|short/i.test(v.text);
    case 'device': return v.hops.some((h) => h.tag === e.tag) && !v.wire;
    case 'contact': return tags.includes(e.tag);
    case 'short': return v.wire === e.wire && /short/i.test(v.text);
    case 'open': return v.wire === e.wire && e.ends.some((t) => tags.includes(t));
  }
}

// --- the sweep -----------------------------------------------------------------------------------------------
seedSampleProject();
const FIXTURES: [string, DrawingContext][] = [['CONV', collectProject().drawingCtx!], ['SEAL', sealingHead()], ['SEAL-NPN', sealingHead(false, true)], ['MIXED', sealingHeadMixed()]];
let total = 0, ok = 0;
const misses: string[] = [], notes: string[] = [];
const byClass = new Map<string, [number, number]>();
for (const [name, ctx] of FIXTURES) {
  const c = buildCircuitModel(buildModel(ctx));
  for (const p of wiringPaths(ctx).filter((x) => !x.analog && !x.noWire)) {
    const { cases, dutNode, dutContact, notes: n } = casesFor(c, p);
    notes.push(...n.map((x) => `${name} ${x}`));
    for (const cs of cases) {
      const r = run(c, p, cs, dutContact, dutNode!);
      if (r.fail === 'no symptom') continue;
      total++;
      const cls = cs.label.replace(/: .*$/, '').replace(/ \S+$/, (x) => (/^(short)/.test(cs.label) ? '' : x)).replace(/^short .*/, 'short');
      const k = byClass.get(cls) ?? [0, 0];
      const good = Boolean(r.v && !r.fail && scored(r.v, cs.expect));
      byClass.set(cls, [k[0] + (good ? 1 : 0), k[1] + 1]);
      if (good) ok++;
      else misses.push(`${name} ${p.address} ${cs.label}: ${r.fail ?? r.v?.text ?? 'no verdict'}`);
    }
  }
}
const pct = (ok / total) * 100;
console.log(`independent strict sweep: ${ok}/${total} = ${pct.toFixed(1)} %`);
for (const [k, [a, b]] of [...byClass].sort()) console.log(`  ${k.padEnd(28)} ${a}/${b}`);
for (const x of misses.slice(0, Number(process.env.SHOW ?? 25))) console.log(`  miss: ${x}`);
for (const x of notes.slice(0, 10)) console.log(`  note: ${x}`);
assert.ok(total > 500, `${total} cases`);
assert.ok(pct >= 97, `${pct.toFixed(1)} % found`);
console.log('\nindependent sweep passed');
