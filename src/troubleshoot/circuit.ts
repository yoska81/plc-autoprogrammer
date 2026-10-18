/**
 * The real conductors of a design, for fault finding: the wire list with every place a wire lands (strip
 * terminals, terminal-strip jumpers, junction-box terminals and their jumpers, the cores of the trunk and the
 * device cables, fused terminals), plus what joins pins inside a device (contacts) and what the devices do
 * (loads, sensor and PLC outputs). A wire-list entry like "TB2-4 → PE1:BN" is expanded into the places it
 * really passes: TB2-4 → W002 core 2 → JB1:2 → W003 core 1 → PE1:BN.
 *
 * Two uses: walking a chain place by place to its power supply (each step names the exact conductor), and a
 * small solver that works out the voltage at every place with one conductor broken, for the practice meter
 * and the fault-sweep tests.
 */
import type { ElectricalModel } from '../electrical/derive';

export type LinkKind = 'wire' | 'jumper' | 'fuse' | 'contact';

export interface Link {
  id: string;
  kind: LinkKind;
  a: string;
  b: string;
  /** Wire number (wire / jumper / fuse), the device tag (contact). */
  wire?: string;
  tag?: string;
  /** Cable and core when the conductor is a cable core ("W003", "1", "BN"). */
  cable?: string;
  core?: string;
  color?: string;
  /** Contact: closed when the device is ON ('on'), OFF ('off'). */
  closedWhen?: 'on' | 'off';
  /** In plain words: "wire 24+ (cable W003, core 1 BN)". */
  text: string;
}

export interface Element {
  /** load: draws current between a and b; switch: joins a and b when `when` holds. */
  kind: 'load' | 'switch';
  tag: string;
  a: string;
  b: string;
  /** For a switch: the device and the state it closes in; `powered` = also needs 24 V across `pa`–`pb`. */
  closedWhen?: 'on' | 'off';
  powered?: [string, string];
  /** PLC input: the address it reads. */
  input?: string;
}

export interface Circuit {
  links: Link[];
  elements: Element[];
  /** Node → links touching it. */
  at: Map<string, Link[]>;
  /** Positive and negative output of the 24 V supplies. */
  plus: string[];
  minus: string[];
  /** Device tag → the field device of a PLC point drawn as a junction-box end ("JB1 (SOL1)" → SOL1 pins). */
  label: (node: string) => string;
}

const NC = /^(1|11|21|31|41|51|61|71|81|95|R\dC|NC|RB)$/i;
const CONTACT_CATS = new Set(['relay', 'safetyRelay', 'contactor', 'overload', 'breaker', 'fuse', 'motorProtector', 'disconnect']);
const SENSOR3 = new Set(['sensor-pnp', 'sensor-npn']);

/** Contact pairs of a device: 13-14, 23-24, 95-96, A1-A2 excluded, R1-R1O / R1-R1C, C-NO / C-NC. */
function contactPairs(pins: string[]): [string, string][] {
  const set = new Set(pins.map((p) => p.toUpperCase()));
  const out: [string, string][] = [];
  for (const p of set) {
    let m = /^(\d)(\d)$/.exec(p);
    if (m && Number(m[2]) % 2 === 1 && set.has(`${m[1]}${Number(m[2]) + 1}`)) out.push([p, `${m[1]}${Number(m[2]) + 1}`]);
    m = /^R(\d)$/.exec(p);
    if (m) for (const s of ['O', 'C']) if (set.has(`R${m[1]}${s}`)) out.push([p, `R${m[1]}${s}`]);
    if (p === 'C') for (const s of ['NO', 'NC']) if (set.has(s)) out.push([p, s]);
    m = /^([LT])(\d)$/.exec(p);
    if (m && m[1] === 'L' && set.has(`T${m[2]}`)) out.push([p, `T${m[2]}`]);
  }
  return out;
}

/** Build the conductors and elements of a design. */
export function buildCircuit(m: ElectricalModel, wires: ElectricalModel['wires'] = m.wires, opts: { cables?: boolean } = {}): Circuit {
  // An imported wire list has its own wire numbers: the design's cables and junction boxes do not apply to it.
  const useCables = opts.cables ?? wires === m.wires;
  const links: Link[] = [];
  const add = (l: Omit<Link, 'id'>) => { if (l.a && l.b && l.a !== l.b) links.push({ ...l, id: `L${links.length}` }); };
  const terms = m.strips.flatMap((s) => s.terminals);
  const fused = new Map(terms.filter((t) => t.fuse).map((t) => [t.label, t]));
  const ioByTag = new Map(m.io.filter((p) => p.deviceTag).map((p) => [p.deviceTag!, p]));
  const plcTags = new Set([m.plcTag, ...m.rc.filter((c) => c.category === 'plc' || c.category === 'plcModule').map((c) => c.tag)]);
  // A fused terminal carries two wire numbers: the feed side keeps its name, the fused side gets its own.
  const nodeOf = (raw: string, wire: string) => {
    const f = fused.get(raw.trim());
    return f && f.wire === wire ? `${raw.trim()} (fused side)` : raw.trim();
  };
  // Field devices reached through cables: their cable cores replace the collapsed wire-list entries.
  const devCables = useCables ? m.machine.cables.filter((c) => c.kind === 'device') : [];
  const trunks = useCables ? m.machine.cables.filter((c) => c.kind === 'trunk') : [];
  const viaCable = new Set(devCables.map((c) => c.to));
  const jbOf = (raw: string) => /^(\S+)\s+\((.+)\)$/.exec(raw.trim());
  const tagOf = (raw: string) => (jbOf(raw)?.[2] ?? raw.split(':')[0]).trim();
  const isJbBus = (raw: string) => useCables && m.machine.jbs.some((j) => raw.trim().startsWith(`${j.tag} `));
  // Device pin per wire, from the wire list ("PE1" + "24+" → "PE1:BN").
  const devPin = new Map<string, string>();
  for (const w of wires) for (const e of [w.from, w.to]) if (/^[^\s:]+:[^\s]+$/.test(e.trim()) && viaCable.has(tagOf(e))) devPin.set(`${tagOf(e)}|${w.wire}`, e.trim());
  for (const w of wires) {
    const collapsed = useCables && [w.from, w.to].some((e) => (viaCable.has(tagOf(e)) && !plcTags.has(tagOf(e))) || jbOf(e) || isJbBus(e));
    if (collapsed) continue;
    add({ kind: 'wire', a: nodeOf(w.from, w.wire), b: nodeOf(w.to, w.wire), wire: w.wire, color: w.color, text: `wire ${w.wire}` });
  }
  // Trunk cores: cabinet terminal → junction-box terminal.
  for (const c of trunks) for (const k of c.cores) {
    if (k.wire === 'PE') continue;
    add({ kind: 'wire', a: k.from, b: k.to, wire: k.wire, cable: c.tag, core: k.core, color: k.color, text: `wire ${k.wire} (cable ${c.tag}, core ${k.core}${k.color ? ` ${k.color}` : ''})` });
  }
  // Device cable cores: junction-box terminal → device pin (named as in the wire list when it is there).
  for (const c of devCables) for (const k of c.cores) {
    if (k.wire === 'PE') continue;
    const pin = devPin.get(`${c.to}|${k.wire}`) ?? k.to;
    add({ kind: 'wire', a: k.from, b: pin, wire: k.wire, cable: c.tag, core: k.core, color: k.color, text: `wire ${k.wire} (cable ${c.tag}, core ${k.core}${k.color ? ` ${k.color}` : ''})` });
  }
  // Junction-box jumpers ("JUMPER JB1:2") and terminal-strip jumpers ("TB1 24+ (jumper)").
  for (const j of useCables ? m.machine.jbs : []) for (const t of j.terminals) {
    const jm = /^JUMPER\s+(\S+)/.exec(t.incoming);
    if (jm) add({ kind: 'jumper', a: t.label, b: jm[1], wire: t.wire, text: `the jumper ${jm[1]} → ${t.label} (wire ${t.wire})` });
  }
  for (const t of terms) {
    const jm = /^(.*) \(jumper\)$/.exec(t.internal);
    if (!jm) continue;
    const from = jm[1].trim();
    if (t.fuse) add({ kind: 'jumper', a: from, b: t.label, wire: t.wire, text: `the jumper ${from} → ${t.label}` });
    else add({ kind: 'jumper', a: from, b: t.label, wire: t.wire, text: `the jumper ${from} → ${t.label} (wire ${t.wire})` });
  }
  // Fuses in fused terminals.
  for (const t of fused.values()) add({ kind: 'fuse', a: t.label, b: `${t.label} (fused side)`, wire: t.wire, tag: t.label, text: `the ${t.fuse} fuse in ${t.label}` });
  // Contacts inside devices (relays, safety relays, contactors, overloads, breakers; pushbuttons and drive relays).
  const pinsOf = new Map<string, Set<string>>();
  for (const l of links) for (const n of [l.a, l.b]) { const i = n.indexOf(':'); if (i > 0 && !/\s/.test(n.slice(0, i))) (pinsOf.get(n.slice(0, i)) ?? pinsOf.set(n.slice(0, i), new Set()).get(n.slice(0, i))!).add(n.slice(i + 1)); }
  const elements: Element[] = [];
  for (const [tag, pins] of pinsOf) {
    if (plcTags.has(tag)) continue;
    const cat = m.rc.find((c) => c.tag === tag)?.category ?? '';
    const io = ioByTag.get(tag);
    const field = io && !SENSOR3.has(io.deviceType) && io.type === 'input';
    if (!CONTACT_CATS.has(cat) && !field && !/^(VFD|DRV)/.test(tag)) continue;
    for (const [a, b] of contactPairs([...pins])) {
      // Open or closed by the device's state when solving (a field input's own contact included).
      const closedWhen = NC.test(b) || NC.test(a) ? 'off' : 'on';
      add({ kind: 'contact', a: `${tag}:${a}`, b: `${tag}:${b}`, tag, closedWhen, text: `contact ${tag} ${a}-${b}` });
    }
    // Coils draw current.
    if (pins.has('A1') && pins.has('A2')) elements.push({ kind: 'load', tag, a: `${tag}:A1`, b: `${tag}:A2` });
  }
  // Field devices: sensors (power + output), solenoids / lamps (loads).
  for (const p of m.io) {
    const tag = p.deviceTag;
    if (!tag) continue;
    const nodes = [...new Set(links.flatMap((l) => [l.a, l.b]).filter((n) => n.startsWith(`${tag}:`)))];
    const pin = (re: RegExp) => nodes.find((n) => re.test(n.slice(tag.length + 1)));
    if (SENSOR3.has(p.deviceType)) {
      const bn = pin(/^(BN|1)$/), bu = pin(/^(BU|3)$/), bk = pin(/^(BK|4)$/);
      if (bn && bu) elements.push({ kind: 'load', tag, a: bn, b: bu });
      if (bn && bu && bk) elements.push({ kind: 'switch', tag, a: p.deviceType === 'sensor-pnp' ? bn : bu, b: bk, closedWhen: 'on', powered: [bn, bu] });
    } else if (p.type === 'output' && nodes.length >= 2) {
      // Each coil from its own terminal to the common one (a double solenoid: A1 and B1 to A2+B2): the
      // common is on 0 V for a sourcing load, on 24 V for a sinking one.
      const wiresAt = (n: string) => links.filter((l) => l.a === n || l.b === n).map((l) => l.wire ?? '');
      const common = nodes.find((n) => wiresAt(n).some((w) => /^0 ?V$|^M$|^COM$/i.test(w))) ?? nodes.find((n) => wiresAt(n).some((w) => /^(24\+|\+24|L\+)/.test(w))) ?? nodes[nodes.length - 1];
      for (const n of nodes) if (n !== common && !wiresAt(n).every((w) => w === 'PE') && !elements.some((e) => e.kind === 'load' && e.a === n && e.b === common)) elements.push({ kind: 'load', tag, a: n, b: common });
    }
  }
  // PLC: inputs draw current to their group common; outputs switch to their common / from their supply.
  for (const g of m.groups) {
    const com = `${g.devTag}:${g.type === 'input' ? 'COM' : 'C'}`;
    for (const p of g.points) {
      const t = `${m.plcTag}:${p.address}`;
      if (g.type === 'input') elements.push({ kind: 'load', tag: p.address, a: t, b: com, input: p.address });
      else if (g.outputStyle === 'sinking') elements.push({ kind: 'switch', tag: p.address, a: t, b: com, closedWhen: 'on' });
      else elements.push({ kind: 'switch', tag: p.address, a: `${g.devTag}:+V`, b: t, closedWhen: 'on' });
    }
  }
  const at = new Map<string, Link[]>();
  for (const l of links) for (const n of [l.a, l.b]) (at.get(n) ?? at.set(n, []).get(n)!).push(l);
  const ps = m.rc.filter((c) => c.category === 'powerSupply').map((c) => c.tag);
  const plus = ps.map((t) => `${t}:+V`).filter((n) => at.has(n));
  const minus = ps.map((t) => `${t}:-V`).filter((n) => at.has(n));
  return { links, elements, at, plus, minus, label: (n) => n };
}

/**
 * The places from `start` to the nearest of `goal`, through conductors and contacts (not through loads or
 * PLC switches), with the link that reaches each place. Shortest path; null when there is none.
 */
export function walk(c: Circuit, start: string, goal: (n: string) => boolean, avoid: Set<string> = new Set()): { node: string; link?: Link }[] | null {
  const prev = new Map<string, { from: string; link: Link }>();
  const seen = new Set([start]);
  let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const n of frontier) {
      if (goal(n) && n !== start) {
        const out: { node: string; link?: Link }[] = [];
        for (let x = n; x !== start; x = prev.get(x)!.from) out.unshift({ node: x, link: prev.get(x)!.link });
        return [{ node: start }, ...out];
      }
      for (const l of c.at.get(n) ?? []) {
        const o = l.a === n ? l.b : l.a;
        if (seen.has(o) || avoid.has(o)) continue;
        seen.add(o);
        prev.set(o, { from: n, link: l });
        next.push(o);
      }
    }
    frontier = next;
  }
  return null;
}

/** State for the solver: which devices are ON, which links are broken, which nodes are shorted. */
export interface SolveState {
  on: (tag: string) => boolean;
  broken?: Set<string>;
  /** Node → 24 or 0: a short to 24 V / 0 V at that place. */
  shorted?: Map<string, 24 | 0>;
  /** Nodes cut off from everything (a wire taken off a device). */
  lifted?: Set<string>;
}

export interface Solution {
  /** Voltage of a place against the 0 V of the supply; undefined = not connected to anything. */
  v: (node: string) => number | undefined;
  /** Meter reading between two places (a floating lead reads 0). */
  read: (a: string, b: string) => number;
  /** PLC input address → ON. */
  inputOn: (address: string) => boolean;
  /** A load has its 24 V across it (the coil on `node` when given). */
  loadPowered: (tag: string, node?: string) => boolean;
}

/**
 * The machine running normally: safety relays and relays ON, overloads not tripped (their tripped contact
 * open), breakers and disconnects ON; the devices named in `active` are operated.
 */
export function healthy(m: ElectricalModel, active: Record<string, boolean> = {}): (tag: string) => boolean {
  const cat = new Map(m.rc.map((c) => [c.tag, c.category]));
  const onByDefault = new Set(['safetyRelay', 'relay', 'contactor', 'breaker', 'disconnect', 'fuse', 'motorProtector']);
  return (tag) => (tag in active ? active[tag] : onByDefault.has(cat.get(tag) ?? ''));
}

/** Work out the voltages (24 V / 0 V / pulled up or down through a load / floating). */
export function solve(c: Circuit, s: SolveState): Solution {
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!; if (!parent.has(r)) parent.set(r, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const run = (closed: Element[]) => {
    parent.clear();
    for (const l of c.links) {
      if (s.broken?.has(l.id)) continue;
      if (s.lifted?.has(l.a) || s.lifted?.has(l.b)) continue;
      if (l.kind === 'contact' && (l.closedWhen === 'on') !== s.on(l.tag!)) continue;
      union(l.a, l.b);
    }
    for (const e of closed) union(e.a, e.b);
    const fixed = new Map<string, number>();
    for (const n of c.plus) fixed.set(find(n), 24);
    for (const n of c.minus) { const r = find(n); fixed.set(r, fixed.get(r) === 24 ? 12 : 0); }
    for (const [n, v] of s.shorted ?? []) fixed.set(find(n), v);
    // Floating groups take the voltage of what their loads pull them to (a high-impedance meter).
    const loads = c.elements.filter((e) => e.kind === 'load');
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      const pull = new Map<string, Set<number>>();
      for (const e of loads) {
        const ra = find(e.a), rb = find(e.b);
        if (ra === rb) continue;
        if (fixed.has(rb) && !fixed.has(ra)) (pull.get(ra) ?? pull.set(ra, new Set()).get(ra)!).add(fixed.get(rb)!);
        if (fixed.has(ra) && !fixed.has(rb)) (pull.get(rb) ?? pull.set(rb, new Set()).get(rb)!).add(fixed.get(ra)!);
      }
      for (const [r, vs] of pull) { if (fixed.has(r)) continue; fixed.set(r, vs.size === 1 ? [...vs][0] : 12); changed = true; }
      if (!changed) break;
    }
    return (n: string) => (s.lifted?.has(n) ? undefined : fixed.get(find(n)));
  };
  // Switches close in their state; a sensor output also needs its supply, so solve twice.
  const sw = c.elements.filter((e) => e.kind === 'switch' && (e.closedWhen === 'on') === s.on(e.tag));
  let v = run(sw.filter((e) => !e.powered));
  const powered = sw.filter((e) => e.powered && (v(e.powered[0]) ?? -99) - (v(e.powered[1]) ?? 99) > 18);
  v = run([...sw.filter((e) => !e.powered), ...powered]);
  const read = (a: string, b: string) => { const va = v(a), vb = v(b); return va === undefined || vb === undefined ? 0 : va - vb; };
  return {
    v, read,
    inputOn: (address) => c.elements.filter((e) => e.input === address).some((e) => Math.abs(read(e.a, e.b)) > 18),
    loadPowered: (tag, node) => c.elements.filter((e) => e.kind === 'load' && e.tag === tag && (!node || e.a === node || e.b === node)).some((e) => Math.abs(read(e.a, e.b)) > 18),
  };
}
