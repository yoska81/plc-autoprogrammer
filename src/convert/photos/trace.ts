import type { CatalogCategory, CatalogPart, FieldDeviceType } from '../../electrical/types';
import type { Confidence } from '../../lib/ai/importAI';
import type { DrawnCircuit, PathContact, PathEl } from '../types';
import { itemCategory, itemPart, type ReviewItem } from './items';

/**
 * Wiring from wire numbers: a wire number read at two places (a PLC terminal and a contactor coil, a
 * terminal strip and a module input) is one wire between them, and two numbers read on one terminal
 * (a coil with two wires, a strip's feed-through: 1004 inside, F1004 outside) are one conductor. From
 * the photos' ferrule labels this gives the connections that are traceable; through the PLC's
 * terminals, the I/O list (each input / output with the panel device or strip point it is wired to);
 * on a machine without a PLC, the relay circuits (each coil with the contacts that switch it). Nothing
 * uncertain is decided silently: look-alike numbers ("2OO1" / "2001"), a wire reaching two PLC points
 * or two devices, an address guessed from a module's place on the rail, and what is wired to each
 * terminal strip in the field are asked on the Machine description page.
 */

export interface WireEnd { tag: string; terminal: string; category: CatalogCategory | 'strip'; wire: string }
export interface TracedWire {
  /** The wire number(s) on this conductor as read; two numbers that meet on a terminal joined with " / ". */
  wire: string;
  numbers: string[];
  ends: WireEnd[];
  /** Terminals where two wire numbers meet (one conductor there), e.g. "XT2:6". */
  joinedAt: string[];
}
/** Two wire numbers that differ only by a likely misreading (O / 0, I / 1, a space or a stray mark). */
export interface NearMatch { a: string; b: string; aAt: string[]; bAt: string[] }

export interface TracedIO {
  /** PLC address as read on the terminal (X1, %I0.3, Q0.1); for a module's numbered terminal, guessed from its slot. */
  address: string;
  type: 'input' | 'output';
  wire: string;
  /** The PLC or I/O module the point is on. */
  plcTag: string;
  /** The address was not printed: it is the module's slot (its place on the rail) and the terminal number. */
  guessed: boolean;
  /** The panel device at the other end, '' when the wire only reaches a terminal strip (field device) or the reading conflicts. */
  deviceTag: string;
  deviceType: FieldDeviceType;
  /** Terminal-strip point on the way out to the field, e.g. "TB1-3". */
  via: string;
  description: string;
  confidence: Confidence;
  /** Why the trace can't tell (the wire reaches two PLC points or two devices); null when it can. */
  conflict: string | null;
}

/** Same wire number however it was written ("1001", " 1001 "); "W1001" and "F1001" stay different. */
const normWire = (w: string) => w.trim().toUpperCase();
const normTerm = (t: string) => t.trim().toUpperCase();
const endKey = (e: { tag: string; terminal: string }) => `${e.tag}:${normTerm(e.terminal)}`;
const endText = (e: { tag: string; terminal: string }) => `${e.tag}:${e.terminal}`;
const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
/** A wire number with the usual misreadings taken out (O → 0, I → 1, spaces, a stray leading / trailing mark); '' without digits. */
const looseWire = (w: string) => {
  const s = normWire(w).replace(/\s+/g, '').replace(/^[^A-Z0-9+]+|[^A-Z0-9+]+$/g, '').replace(/O/g, '0').replace(/I/g, '1');
  return /\d/.test(s) ? s : '';
};

/** Every wire number read (confirmed or still pending items; rejected ones are not in the cabinet). */
function reads(items: ReviewItem[], tagOf: (it: ReviewItem) => string): { key: string; end: WireEnd }[] {
  const out: { key: string; end: WireEnd }[] = [];
  for (const it of items.filter((x) => x.status !== 'rejected')) {
    const tag = tagOf(it);
    const category = it.kind === 'strip' ? 'strip' : itemCategory(it);
    for (const w of it.kind === 'strip' ? it.strip!.terminals : it.device!.wires) {
      const key = normWire(w.wire);
      if (key) out.push({ key, end: { tag, terminal: w.terminal.trim(), category, wire: w.wire.trim() } });
    }
  }
  return out;
}

/**
 * Every conductor the wire numbers show, one-ended ones included (their other end is in the field or
 * not in the photos), and the look-alike numbers that may be one wire misread.
 */
export function traceNets(items: ReviewItem[], tagOf: (it: ReviewItem) => string): { nets: TracedWire[]; near: NearMatch[] } {
  const rs = reads(items, tagOf);
  const parent = new Map(rs.map((r) => [r.key, r.key]));
  const find = (k: string): string => { const p = parent.get(k)!; if (p === k) return k; const root = find(p); parent.set(k, root); return root; };
  const atTerminal = new Map<string, Set<string>>();
  for (const r of rs) atTerminal.set(endKey(r.end), (atTerminal.get(endKey(r.end)) ?? new Set<string>()).add(r.key));
  // two numbers on one terminal are one conductor
  for (const keys of atTerminal.values()) { const [first, ...rest] = [...keys]; for (const k of rest) parent.set(find(k), find(first)); }
  const nets = new Map<string, TracedWire>();
  const spelling = new Map<string, string>();
  for (const r of rs) {
    if (!spelling.has(r.key)) spelling.set(r.key, r.end.wire);
    const root = find(r.key);
    const n = nets.get(root) ?? { wire: '', numbers: [], ends: [], joinedAt: [] };
    if (!n.numbers.some((x) => normWire(x) === r.key)) n.numbers.push(spelling.get(r.key)!);
    if (!n.ends.some((e) => endKey(e) === endKey(r.end))) n.ends.push(r.end);
    if ((atTerminal.get(endKey(r.end))?.size ?? 0) > 1 && !n.joinedAt.includes(endText(r.end))) n.joinedAt.push(endText(r.end));
    nets.set(root, n);
  }
  const out = [...nets.values()].map((n) => { n.numbers.sort(byNumber); n.wire = n.numbers.join(' / '); return n; }).sort((a, b) => byNumber(a.wire, b.wire));
  // look-alike numbers on different conductors: asked, never merged
  const near: NearMatch[] = [];
  const keys = [...spelling.keys()];
  const at = (k: string) => [...new Set(rs.filter((r) => r.key === k).map((r) => endText(r.end)))];
  keys.forEach((a, i) => keys.slice(i + 1).forEach((b) => {
    if (looseWire(a) && looseWire(a) === looseWire(b) && find(a) !== find(b)) near.push({ a: spelling.get(a)!, b: spelling.get(b)!, aAt: at(a), bAt: at(b) });
  }));
  return { nets: out, near };
}

/** Every wire number seen at two or more places. */
export const traceWires = (items: ReviewItem[], tagOf: (it: ReviewItem) => string): TracedWire[] => traceNets(items, tagOf).nets.filter((n) => n.ends.length >= 2);

/** Wire numbers read at one place only: open ends (the other end is in the field or not in the photos). */
export const singleWires = (items: ReviewItem[], tagOf: (it: ReviewItem) => string): { wire: string; at: string }[] =>
  traceNets(items, tagOf).nets.filter((n) => n.ends.length === 1).map((n) => ({ wire: n.wire, at: endText(n.ends[0]) }));

/** Field device type of a panel device a PLC terminal drives or reads. */
function deviceTypeOf(cat: CatalogCategory | 'strip', terminal: string, type: 'input' | 'output'): FieldDeviceType {
  if (type === 'output') return cat === 'contactor' ? 'contactor-coil' : cat === 'relay' ? 'relay-coil' : cat === 'vfd' ? 'vfd-input' : cat === 'pilotLight' ? 'pilot-light' : cat === 'stackLight' ? 'stack-light' : 'other';
  if (cat === 'safetyRelay') return 'safety-relay-output';
  if (cat === 'pushbutton') return /NC|2$/i.test(terminal) ? 'pushbutton-nc' : 'pushbutton-no';
  if (cat === 'estop') return 'estop-contact';
  if (cat === 'selector') return 'selector';
  return 'other';
}

/** An address printed on a PLC terminal: X1 / Y2 (CLICK), I0.3 / Q0.1 / %IX0.3 (IEC), DI3 / DO1. */
const ADDR = /^%?(IX|QX|DI|DO|[XYIQ])\s*(\d+(?:\.\d+)?)$/;
const isPlc = (cat: CatalogCategory | 'strip') => cat === 'plc' || cat === 'plcModule';

/**
 * The PLC address of a terminal, as read (X1, I0.3, %Q0.1). A module's terminal that is only a
 * number (or a short X3 / Y3 that would repeat the CPU's) gets the address its slot would have
 * (CLICK: slot s point n = X/Y s0n), marked guessed: the slot is the module's place on the rail.
 * Null when the terminal is not an I/O point (power, common).
 */
export function plcAddress(terminal: string, cat: CatalogCategory, slot: number, moduleKind: 'input' | 'output' | null): { address: string; type: 'input' | 'output'; guessed: boolean } | null {
  if (!isPlc(cat)) return null;
  const t = terminal.trim().toUpperCase();
  const m = ADDR.exec(t);
  const typeOf = (p: string): 'input' | 'output' => (['X', 'I', 'IX', 'DI'].includes(p) ? 'input' : 'output');
  if (m && (cat === 'plc' || t.startsWith('%') || m[2].includes('.'))) return { address: t.replace(/\s+/g, ''), type: typeOf(m[1]), guessed: false };
  if (cat !== 'plcModule') return null;
  const kind = m ? typeOf(m[1]) : moduleKind;
  const n = m ? Number(m[2]) : /^\d{1,2}$/.test(t) ? Number(t) : NaN;
  if (!kind || !Number.isInteger(n) || n < 1) return null;
  return { address: `${kind === 'input' ? 'X' : 'Y'}${slot}${String(n).padStart(2, '0')}`, type: kind, guessed: true };
}

/** The I/O list the wire numbers show: one point per PLC terminal with a wire number. */
export function traceIO(items: ReviewItem[], nets: TracedWire[], tagOf: (it: ReviewItem) => string, getPart: (pn: string) => CatalogPart | undefined): TracedIO[] {
  const kept = items.filter((x) => x.status !== 'rejected' && x.kind === 'device');
  const modules = kept.filter((it) => itemCategory(it) === 'plcModule').sort((a, b) => a.device!.rail - b.device!.rail || a.device!.order - b.device!.order);
  const kindOf = (it: ReviewItem): 'input' | 'output' | null => {
    const r = getPart(itemPart(it))?.ratings as Record<string, unknown> | undefined;
    if (r?.inputs) return 'input';
    if (r?.outputs) return 'output';
    const d = `${it.device!.ratings} ${itemPart(it)}`;
    return /\binput|N[DA]\d/i.test(d) ? 'input' : /\boutput|T[DR]\d|RLY/i.test(d) ? 'output' : null;
  };
  const netOf = new Map<string, TracedWire>();
  for (const n of nets) for (const e of n.ends) netOf.set(endKey(e), n);
  // every PLC terminal that is an I/O point, first: a wire reaching two of them is a conflict
  const points = new Map<string, { address: string; type: 'input' | 'output'; guessed: boolean; tag: string; wire: string }>();
  for (const it of kept.filter((x) => isPlc(itemCategory(x)))) {
    const cat = itemCategory(it);
    const tag = tagOf(it);
    for (const w of it.device!.wires) {
      const a = plcAddress(w.terminal, cat, cat === 'plcModule' ? modules.indexOf(it) + 1 : 0, cat === 'plcModule' ? kindOf(it) : null);
      const k = endKey({ tag, terminal: w.terminal });
      if (a && !points.has(k)) points.set(k, { ...a, tag, wire: w.wire.trim() });
    }
  }
  const out: TracedIO[] = [];
  for (const [k, p] of points) {
    const net = netOf.get(k);
    const wire = net?.wire ?? p.wire;
    const others = (net?.ends ?? []).filter((e) => endKey(e) !== k);
    const otherIo = others.map((e) => points.get(endKey(e))?.address).filter((x): x is string => Boolean(x));
    const devs = others.filter((e) => e.category !== 'strip' && !isPlc(e.category));
    const devTags = [...new Set(devs.map((e) => e.tag))];
    const strip = others.find((e) => e.category === 'strip');
    const via = strip ? `${strip.tag}-${strip.terminal}` : '';
    const conflict = otherIo.length ? `wire ${wire} is read at both ${p.address} and ${otherIo.join(' and ')}`
      : devTags.length > 1 ? `wire ${wire} from ${p.address} is read at ${devTags.join(' and ')}` : null;
    const dev = !conflict && devTags.length === 1 ? devs[0] : undefined;
    const slot = p.guessed ? ' — address guessed from the module\'s slot' : '';
    out.push({
      address: p.address, type: p.type, wire, plcTag: p.tag, guessed: p.guessed, via, conflict,
      deviceTag: dev?.tag ?? '', deviceType: dev ? deviceTypeOf(dev.category, dev.terminal, p.type) : 'other',
      description: (conflict ? `${otherIo.length ? `Wire ${wire} — also read at ${otherIo.join(', ')}` : `${devTags.join(' or ')} (wire ${wire})`}: check on the cabinet`
        : dev ? `${dev.tag} ${p.type === 'output' && /coil|^A\d/i.test(dev.terminal) ? `${dev.category} coil` : dev.category} (wire ${wire})`
          : via ? `Field device on ${via} (wire ${wire})` : `Wire ${wire} — other end not visible`) + slot,
      confidence: conflict ? 'low' : dev ? (p.guessed ? 'medium' : 'high') : via ? 'medium' : 'low',
    });
  }
  return out.sort((x, y) => byNumber(x.address, y.address));
}

/* ---------------------------------------------- relay circuits (a machine without a PLC; the hardwired part of one with a PLC) */

const SUPPLY = /^(\+?24\s*V?(DC)?\s*\+S?|24\+S?|\+24\s*V?(DC)?|L\+|\+V|L\d?|P24)$/i;
const RETURN = /^(0\s*V(DC)?|M|N|-V|L-|24\s*V?-|-24\s*V?)$/i;
/** A supply or return rail (not a terminal that leaves for a field device). */
const isRail = (n: TracedWire) => n.numbers.some((x) => SUPPLY.test(x.trim()) || RETURN.test(x.trim()) || /^(PE|GND)$/i.test(x.trim()));
/** A VFD terminal that is a run / speed input. */
const DRIVE_INPUT = /^(MI\d+|DI\d+|S\d+|FWD|REV|FOR|STF|STR|RH|RM|RL|X\d+)$/i;
/** Two-digit contact terminals (IEC): x1-x2 / x5-x6 NC, x1-x4 / x3-x4 / x5-x8 / x7-x8 NO (95-96 NC, 97-98 NO). True: NC. */
function contactOf(a: string, b: string, cat: CatalogCategory): boolean | null {
  const pair = (u: number, v: number) => {
    const [x, y] = u < v ? [u, v] : [v, u];
    return (x === 1 && y === 2) || (x === 5 && y === 6) ? true : (x === 1 && y === 4) || (x === 3 && y === 4) || (x === 5 && y === 8) || (x === 7 && y === 8) ? false : null;
  };
  if (/^\d\d$/.test(a) && /^\d\d$/.test(b) && a[0] === b[0]) return pair(Number(a[1]), Number(b[1]));
  // single-digit blocks on buttons and switches (power poles on contactors and breakers are not control contacts)
  if (/^\d$/.test(a) && /^\d$/.test(b) && ['pushbutton', 'estop', 'selector'].includes(cat)) return pair(Number(a), Number(b));
  return null;
}
const isTimer = (it: ReviewItem) => /timer|time\s*delay|on-?delay|off-?delay|\bH3|\bKT\d/i.test(`${it.device!.ratings} ${itemPart(it)} ${it.device!.tag}`);
const contactKind = (it: ReviewItem): PathContact['kind'] => {
  const c = itemCategory(it);
  return c === 'pushbutton' ? 'pb' : c === 'estop' || c === 'safetyRelay' ? 'safety' : c === 'relay' ? (isTimer(it) ? 'timer' : 'relay') : c === 'contactor' ? 'relay'
    : c === 'overload' || c === 'motorProtector' ? 'ol' : c === 'selector' ? 'selector' : c === 'sensor' ? 'limit' : 'other';
};

interface Edge { a: TracedWire; b: TracedWire; c: PathContact }
type Coil = Extract<PathEl, { t: 'coil' }>;

/**
 * Paths of contacts from a supply rail to a coil's net, supply first; when none reaches a supply, the
 * dead ends, with the net each one stops at.
 */
function pathsTo(target: TracedWire, edges: Edge[], supply: Set<TracedWire>, ret: TracedWire | undefined): { paths: Edge[][]; reached: boolean; stop: TracedWire } {
  if (supply.has(target)) return { paths: [[]], reached: true, stop: target };
  const done: Edge[][] = [];
  const dead: { p: Edge[]; at: TracedWire }[] = [];
  const seen = new Set([target]);
  const acc: Edge[] = [];
  const walk = (net: TracedWire) => {
    if (done.length + dead.length > 16) return;
    if (supply.has(net)) { done.push([...acc].reverse()); return; }
    let moved = false;
    for (const e of edges) {
      if (e.a !== net && e.b !== net) continue;
      const o = e.a === net ? e.b : e.a;
      if (seen.has(o) || o === ret) continue;
      moved = true;
      seen.add(o); acc.push(e);
      walk(o);
      acc.pop(); seen.delete(o);
    }
    if (!moved && acc.length) dead.push({ p: [...acc].reverse(), at: net });
  };
  walk(target);
  if (done.length) return { paths: done, reached: true, stop: target };
  const longest = [...dead].sort((a, b) => b.p.length - a.p.length)[0];
  return { paths: longest ? [longest.p] : [], reached: false, stop: longest?.at ?? target };
}

/** Paths as one rung: the common contacts in series, the parts that differ as one parallel branch (start ∥ seal-in). */
function rung(paths: Edge[][]): PathEl[] {
  if (paths.length <= 1) return (paths[0] ?? []).map((e) => e.c);
  const p0 = paths[0];
  let pre = 0;
  while (paths.every((p) => p.length > pre && p[pre] === p0[pre])) pre++;
  let suf = 0;
  while (paths.every((p) => p.length - suf > pre && p[p.length - 1 - suf] === p0[p0.length - 1 - suf])) suf++;
  const mids: Edge[][] = [];
  for (const m of paths.map((p) => p.slice(pre, p.length - suf)).filter((x) => x.length)) if (!mids.some((x) => x.length === m.length && x.every((e, i) => e === m[i]))) mids.push(m);
  const middle: PathEl[] = mids.length > 1 ? [{ t: 'branch', paths: mids.map((m) => m.map((e) => e.c)) }] : (mids[0] ?? []).map((e) => e.c);
  return [...p0.slice(0, pre).map((e) => e.c), ...middle, ...p0.slice(p0.length - suf).map((e) => e.c)];
}

const contactText = (c: PathContact) => `${c.tag}${c.terms ? ` ${c.terms}` : ''} (${c.nc ? 'NC' : 'NO'})`;

/**
 * The relay circuits the wire numbers show: every coil (relay, contactor, timer), pilot light and drive
 * run input not driven by a PLC output, with the contacts between it and the supply rail (in series;
 * the start button and its seal-in as a parallel branch), in the drawings reader's circuit shape
 * (DrawnCircuit with its path), so a conversion that keeps the relay logic draws them as ladder rungs
 * (toRelayLogic). A coil whose contacts don't reach a supply in the photos is kept with low
 * confidence and asked.
 */
export function traceCircuits(items: ReviewItem[], nets: TracedWire[], tagOf: (it: ReviewItem) => string): { circuits: DrawnCircuit[]; questions: string[] } {
  const devices = items.filter((x) => x.status !== 'rejected' && x.kind === 'device');
  const netOf = new Map<string, TracedWire>();
  for (const n of nets) for (const e of n.ends) netOf.set(endKey(e), n);
  const plcIo = (n: TracedWire) => n.ends.some((e) => isPlc(e.category) && (ADDR.test(normTerm(e.terminal)) || /^\d{1,2}$/.test(e.terminal.trim())));
  const edges: Edge[] = [];
  const coils: { el: Coil; net: TracedWire; ret?: TracedWire }[] = [];
  for (const it of devices) {
    const tag = tagOf(it);
    const cat = itemCategory(it);
    const at = (t: string) => netOf.get(endKey({ tag, terminal: t }));
    const terms = [...new Set(it.device!.wires.map((w) => normTerm(w.terminal)))];
    terms.forEach((a, i) => terms.slice(i + 1).forEach((b) => {
      const nc = contactOf(a, b, cat);
      const [x, y] = Number(a) < Number(b) ? [a, b] : [b, a];
      const nx = at(x), ny = at(y);
      if (nc !== null && nx && ny && nx !== ny) edges.push({ a: nx, b: ny, c: { t: 'contact', tag, nc, terms: `${x}-${y}`, kind: contactKind(it) } });
    }));
    const a1 = at('A1');
    if ((cat === 'relay' || cat === 'contactor') && a1) {
      const kind: Coil['kind'] = cat === 'contactor' ? 'contactor' : !isTimer(it) ? 'relay' : /off-?\s*delay/i.test(`${it.device!.ratings} ${itemPart(it)}`) ? 'timer-off' : 'timer-on';
      coils.push({ el: { t: 'coil', tag, kind, preset: null, terms: null }, net: a1, ret: at('A2') });
    }
    const x1 = at('X1');
    if (cat === 'pilotLight' && x1) coils.push({ el: { t: 'coil', tag, kind: 'light', preset: null, terms: null }, net: x1, ret: at('X2') });
    if (cat === 'vfd') for (const t of terms.filter((x) => DRIVE_INPUT.test(x))) { const n = at(t); if (n) coils.push({ el: { t: 'coil', tag, kind: 'drive-input', preset: null, terms: t }, net: n }); }
  }
  // the return rail: where most coils end (else a 0V / N number); the supply: a +24 / L number, or a supply's or breaker's terminal
  const count = new Map<TracedWire, number>();
  for (const c of coils) if (c.ret) count.set(c.ret, (count.get(c.ret) ?? 0) + 1);
  const ret = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? nets.find((n) => n.numbers.some((x) => RETURN.test(x.trim())));
  const supply = new Set(nets.filter((n) => n !== ret && !n.numbers.some((x) => RETURN.test(x.trim()))
    && (n.numbers.some((x) => SUPPLY.test(x.trim())) || n.ends.some((e) => ['powerSupply', 'breaker', 'fuse', 'disconnect'].includes(e.category)))));
  const circuits: DrawnCircuit[] = [];
  const questions: string[] = [];
  for (const c of coils.filter((x) => !plcIo(x.net) && x.net !== ret)) {
    const { paths, reached, stop } = pathsTo(c.net, edges, supply, ret);
    // the start button first, the coil's own seal-in across it after
    const path: PathEl[] = [...rung(paths).map((e) => (e.t === 'branch' ? { ...e, paths: [...e.paths].sort((x, y) => Number(x.some((k) => k.tag === c.el.tag)) - Number(y.some((k) => k.tag === c.el.tag))) } : e)), c.el];
    const contacts = path.filter((e): e is PathContact => e.t === 'contact');
    const branch = path.find((e): e is Extract<PathEl, { t: 'branch' }> => e.t === 'branch');
    const all = [...contacts, ...(branch?.paths.flat() ?? [])];
    const seal = branch?.paths.flat().find((x) => x.tag === c.el.tag && !x.nc);
    const what = c.el.kind === 'drive-input' ? `run input ${c.el.terms}` : c.el.kind === 'light' ? 'pilot light' : `${c.el.kind === 'contactor' ? 'contactor' : c.el.kind.startsWith('timer') ? 'timer' : 'relay'} coil`;
    const id = `C${circuits.length + 1}`;
    circuits.push({
      id, output: c.el.tag,
      function: `${c.el.tag} ${what}, traced from the wire numbers in the photos (verify on the cabinet)`,
      kind: seal ? 'start-stop' : c.el.kind.startsWith('timer') ? 'timer' : all.some((x) => x.kind === 'relay' || x.kind === 'timer') ? 'interlock' : 'other',
      conditions: path.flatMap((e) => (e.t === 'contact' ? [contactText(e)] : e.t === 'branch' ? [e.paths.map((p) => p.map(contactText).join(' + ')).join(' ∥ ')] : [])),
      path, sealIn: seal ? `${seal.tag} ${seal.terms}` : null,
      devices: [...new Set([...all.map((x) => x.tag), c.el.tag])],
      setting: null, logicIn: 'relays', confidence: reached ? 'medium' : 'low',
      source: `wire ${c.net.wire} at ${c.el.tag} (photos)`,
    });
    if (!reached) {
      const out = stop.ends.find((e) => e.category === 'strip');
      questions.push(`Cabinet photos: ${c.el.tag} ${what} (${id}): ${paths.length ? `its contacts were traced back to wire ${stop.wire} only` : `no contact feeding wire ${c.net.wire} was read`}${out ? `, which leaves the cabinet on ${out.tag}-${out.terminal}` : ''} — what switches it?`);
    }
  }
  return { circuits, questions };
}

/* ---------------------------------------------- everything, with the questions */

export interface Trace {
  /** Every conductor, open ends included. */
  nets: TracedWire[];
  /** Conductors read at two or more places. */
  wires: TracedWire[];
  /** Wire numbers read at one place only. */
  single: { wire: string; at: string }[];
  near: NearMatch[];
  io: TracedIO[];
  circuits: DrawnCircuit[];
  /** For the Machine description page, each starting "Cabinet photos: ". */
  questions: string[];
}

/** "1–4, 7, 9–12" for terminal numbers; other names listed after. */
function ranges(terms: string[]): string {
  const nums = [...new Set(terms.filter((t) => /^\d+$/.test(t)).map(Number))].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i ? `${nums[i]}–${nums[j]}` : `${nums[i]}`);
    i = j;
  }
  return [...parts, ...terms.filter((t) => !/^\d+$/.test(t))].join(', ');
}

/** The whole trace: wires, I/O, relay circuits, and what to ask (grouped: one question per terminal strip). */
export function traceAll(items: ReviewItem[], tagOf: (it: ReviewItem) => string, getPart: (pn: string) => CatalogPart | undefined): Trace {
  const { nets, near } = traceNets(items, tagOf);
  const io = traceIO(items, nets, tagOf, getPart);
  const { circuits, questions: circuitQs } = traceCircuits(items, nets, tagOf);
  const q: string[] = near.map((m) => `Cabinet photos: wire "${m.a}" (at ${m.aAt.join(', ')}) and wire "${m.b}" (at ${m.bAt.join(', ')}) look alike — one wire misread, or two different wires?`);
  q.push(...io.filter((p) => p.conflict).map((p) => `Cabinet photos: ${p.conflict} — which is right?`));
  // per terminal strip: what is wired to its terminals outside the cabinet (supply rails left out)
  const ioOn = (n: TracedWire) => io.find((p) => n.ends.some((e) => e.tag === p.plcTag) && p.wire === n.wire);
  const strips = [...new Set(nets.flatMap((n) => n.ends.filter((e) => e.category === 'strip').map((e) => e.tag)))];
  for (const s of strips) {
    const pts = nets.filter((n) => !isRail(n)).flatMap((n) => n.ends.filter((e) => e.category === 'strip' && e.tag === s).map((e) => ({ e, n })))
      .sort((a, b) => byNumber(a.e.terminal, b.e.terminal));
    if (!pts.length) continue;
    const inside = (n: TracedWire) => {
      const p = ioOn(n);
      if (p) return `PLC ${p.type} ${p.address}`;
      const d = n.ends.find((x) => x.category !== 'strip');
      return d ? endText(d) : '';
    };
    const list = pts.length > 8 ? ranges(pts.map((p) => p.e.terminal))
      : pts.map(({ e, n }) => { const i = inside(n); return `${e.terminal} (wire ${n.wire}${i ? ` → ${i}` : ''})`; }).join(', ').replace(/, ([^,]*)$/, ' and $1');
    q.push(`Cabinet photos: ${s}: what is wired to terminal${pts.length > 1 ? 's' : ''} ${list} outside the cabinet?`);
  }
  // PLC points read at the PLC only
  const loose = io.filter((p) => !p.deviceTag && !p.via && !p.conflict);
  const many = loose.length > 1;
  if (loose.length) q.push(`Cabinet photos: the other end${many ? 's' : ''} of wire${many ? 's' : ''} ${loose.map((p) => `${p.wire} (PLC ${p.type} ${p.address})`).join(', ')} ${many ? 'are' : 'is'} not in the photos — where ${many ? 'do they' : 'does it'} go?`);
  // module addresses guessed from the rail
  for (const tag of [...new Set(io.filter((p) => p.guessed).map((p) => p.plcTag))]) {
    const pts = io.filter((p) => p.plcTag === tag && p.guessed).map((p) => p.address);
    const it = items.find((x) => x.kind === 'device' && tagOf(x) === tag);
    const pn = it ? itemPart(it) : '';
    q.push(`Cabinet photos: ${tag}${pn ? ` (${pn})` : ''} is taken as I/O slot ${pts[0].slice(1, -2)} from its place on the rail, so its points are numbered ${pts.length > 1 ? `${pts[0]}–${pts.at(-1)}` : pts[0]} — check the slot and the addresses in the PLC program.`);
  }
  q.push(...circuitQs);
  return { nets, wires: nets.filter((n) => n.ends.length >= 2), single: nets.filter((n) => n.ends.length === 1).map((n) => ({ wire: n.wire, at: endText(n.ends[0]) })), near, io, circuits, questions: q };
}
