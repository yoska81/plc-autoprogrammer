/**
 * Relay logic kept from a converted machine (DesignInputs.relayLogic) as an NFPA 79 ladder: nets, wire numbers,
 * the device terminals each net joins, open questions, and the line layout of every rung. The ladder sheets
 * (drawings/sheets/LadderSheet.tsx), the drawing plan's cross-references and the model's wire list all read this,
 * so they always agree.
 *
 * - One terminal = one net = one wire number. A rung that repeats the start of an earlier rung (the line-running
 *   lamp behind the whole line-run chain, the cut watchdog behind the cut command) starts at that rung's node
 *   instead of drawing the contacts again. A contact terminal still claimed by two different nets is drawn with
 *   "?" terminals and becomes a question (the original drawing must use a second contact).
 * - Terminals are only the ones read; a missing one is "?" and a question.
 * - Every relay / timer used by a contact has its coil drawn: a coil the reading missed gets a rung whose
 *   switching contact is "?" and a question.
 * - A rung ending in a drive input switches that input to the drive's input common (DCM on the GS drives),
 *   not to +24V: the drive's inputs are sinking.
 * - Wire numbers: the net's first rung n numbers it 100 + n, then 100 + n + "A", "B"…; the rails are 24+ / 0V
 *   (24 VDC) or X1 / X2 (120 VAC from the control transformer).
 */
import type { RelayCoil, RelayContact, RelayEl, RelayLogic, RelayRung } from './types';

export interface LadderEl {
  el: RelayContact | RelayCoil;
  /** Wire numbers on the element's left and right terminals ('' = none: the drive input's far side). */
  wIn: string;
  wOut: string;
  /** Terminal names, left and right ("13", "14"; coils "A1", "A2"; "?" = not read). */
  pins: [string, string];
  /** Row of the rung the element is drawn on (0 = the rung's first row). */
  row: number;
}

export type LadderCol = { kind: 'el'; e: LadderEl } | { kind: 'branch'; paths: LadderEl[][]; wIn: string; wOut: string };

/** One drawn line of a rung: its columns (the load is the last column of the last line). */
export interface LadderLine { cols: LadderCol[]; row: number; rows: number }

export interface LadderRung {
  rung: RelayRung;
  /** Rung number (1-based). */
  n: number;
  /** Where the rung starts: the left rail, or a node of an earlier rung (shared contacts) / a drive's input common. */
  start: { kind: 'rail' } | { kind: 'node'; wire: string; label: string };
  cols: LadderCol[];
  lines: LadderLine[];
  /** Drawing rows the rung takes (its lines, each as tall as its widest branch). */
  rows: number;
  /** The rung ends in a drive input (no right-rail connection). */
  driveEnd: boolean;
  /** A rung added for a coil the reading missed. */
  placeholder?: boolean;
}

export interface LadderWire { wire: string; from: string; to: string; function: string }

export interface Ladder {
  rails: [string, string];
  rungs: LadderRung[];
  wires: LadderWire[];
  /** What the drawings cannot know: terminals not read, contacts used twice, coils not read. */
  questions: string[];
}

/** Width model shared by the layout here and LadderSheet: mm per element, room per line before the load. */
export const LADDER = { unit: 27, lead: 9, avail: 212 };

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Terminal names: only what was read ("13-14" → 13 / 14, "DO1" → DO1 / ?), else "?". */
export function relayPins(el: RelayContact | RelayCoil): [string, string] {
  const t = (el.terms ?? '').trim();
  if (el.t === 'coil') {
    if (el.kind === 'drive-input') return [t || '?', ''];
    if (el.kind === 'light') return ['X1', 'X2'];
    if (t) return [t, '?'];
    return ['A1', 'A2'];
  }
  if (!t) return ['?', '?'];
  const parts = t.split(/\s*-\s*/).filter(Boolean);
  return [parts[0] ?? '?', parts[1] ?? '?'];
}

const key = (el: RelayEl): string => (el.t === 'branch' ? `[${el.paths.map((p) => p.map(key).join('>')).join('|')}]` : el.t === 'contact' ? `${el.tag}/${el.terms ?? ''}/${el.nc ? 'nc' : 'no'}` : `coil:${el.tag}`);
const colWidth = (el: RelayEl) => (el.t === 'branch' ? Math.max(...el.paths.map((p) => p.length)) * LADDER.unit + LADDER.lead : LADDER.unit);

/** The drive's input common (sinking inputs): DCM on AutomationDirect GS drives, else COM. */
function driveCommon(logic: RelayLogic, tag: string): string {
  const pn = logic.devices?.find((d) => d.tag === tag)?.partNumber ?? '';
  return /^GS\d/i.test(pn) || /^GS\d/i.test(tag) ? 'DCM' : 'COM';
}

export function relayLadder(logic: RelayLogic): Ladder {
  const rails: [string, string] = logic.supply === '120VAC' ? ['X1', 'X2'] : ['24+', '0V'];
  const questions: string[] = [];
  // ---- coils the reading missed: a rung with a "?" contact for each relay / timer used only by its contacts
  const coils = new Set(logic.rungs.flatMap((r) => r.path.filter((e): e is RelayCoil => e.t === 'coil').map((e) => e.tag)));
  const flat = (p: RelayEl[]): (RelayContact | RelayCoil)[] => p.flatMap((e) => (e.t === 'branch' ? e.paths.flat() : [e]));
  const missing = [...new Set(logic.rungs.flatMap((r) => flat(r.path)).filter((e): e is RelayContact => e.t === 'contact' && (e.kind === 'relay' || e.kind === 'timer') && !coils.has(e.tag)).map((e) => `${e.tag}|${e.kind}`))];
  const rungs: (RelayRung & { placeholder?: boolean })[] = [...logic.rungs, ...missing.map((m) => {
    const [tag, kind] = m.split('|');
    questions.push(`${tag}: its contacts are used but its coil was not read — what switches ${tag}? (drawn with a "?" contact)`);
    return { id: `coil:${tag}`, description: `${tag} COIL — SOURCE NOT READ, CONFIRM`, path: [{ t: 'contact', tag: '?', nc: false, kind: 'other' }, { t: 'coil', tag, kind: kind === 'timer' ? 'timer-on' : 'relay' }] as RelayEl[], placeholder: true };
  })];

  // ---- nets: rails, shared starts, then each rung's own nodes; a terminal joins exactly one net
  const nets = new Map<string, { ends: string[]; fn: string; rung: number }>();
  const termNet = new Map<string, string>();
  const join = (net: string, end: string, fn: string, rung: number) => {
    const n = nets.get(net) ?? { ends: [], fn, rung };
    if (!n.ends.includes(end)) n.ends.push(end);
    nets.set(net, n);
  };
  const seen: { path: RelayEl[]; nodes: string[] }[] = [];
  const unread = new Set<string>();
  const out: LadderRung[] = [];

  rungs.forEach((rung, i) => {
    const n = i + 1;
    const fn = rung.description || `Rung ${n}`;
    let k = 0;
    const base = String(100 + n);
    const fresh = () => (k++ === 0 ? base : `${base}${LETTERS[(k - 2) % LETTERS.length]}`);
    const last = rung.path[rung.path.length - 1];
    const driveEnd = last?.t === 'coil' && last.kind === 'drive-input';
    // the longest leading run of columns (before the load) an earlier rung already drew: start at its node
    let skip = 0;
    let srcNodes: string[] = [];
    let startWire = rails[0];
    let start: LadderRung['start'] = { kind: 'rail' };
    if (driveEnd) {
      const com = `${last.tag}:${driveCommon(logic, last.tag)}`;
      startWire = termNet.get(com) ?? fresh();
      termNet.set(com, startWire);
      join(startWire, com, `${last.tag} input common`, n);
      start = { kind: 'node', wire: startWire, label: `${last.tag} ${driveCommon(logic, last.tag)}` };
    } else {
      for (const s of seen) {
        let m = 0;
        while (m < rung.path.length - 1 && m < s.path.length - 1 && key(rung.path[m]) === key(s.path[m])) m++;
        if (m > skip) { skip = m; startWire = s.nodes[m - 1]; srcNodes = s.nodes; }
      }
      if (skip) start = { kind: 'node', wire: startWire, label: '' };
    }
    const nodes: string[] = [];
    const mk = (el: RelayContact | RelayCoil, wIn: string, wOut: string): LadderEl => {
      let pins = relayPins(el);
      if (pins.includes('?') && el.tag !== '?') unread.add(`${el.tag}${el.terms ? ` (${el.terms})` : ''}`);
      // a terminal already in another net: this use needs another contact of the device
      const clash = el.t === 'contact' && pins.some((p, j) => p !== '?' && termNet.has(`${el.tag}:${p}`) && termNet.get(`${el.tag}:${p}`) !== [wIn, wOut][j]);
      if (clash) {
        questions.push(`${el.tag} ${el.terms}: the same contact is used again in rung ${n} (${fn}) — the original must use a second contact of ${el.tag}; read its terminal numbers.`);
        pins = ['?', '?'];
      }
      pins.forEach((p, j) => {
        const w = [wIn, wOut][j];
        if (!w || !p) return;
        // the "?" contact of a coil the reading missed: its net still reaches the wire list, from the unknown source
        if (el.tag === '?') { if (j === 1) join(w, '? (SOURCE NOT READ)', fn, n); return; }
        const end = `${el.tag}:${p}`;
        if (p !== '?') termNet.set(end, w);
        join(w, end, fn, n);
      });
      return { el, wIn, wOut, pins, row: 0 };
    };
    const cols: LadderCol[] = [];
    let cur = startWire;
    rung.path.slice(skip).forEach((el, j, arr) => {
      const isLast = j === arr.length - 1;
      const o = isLast ? (driveEnd ? '' : rails[1]) : fresh();
      if (el.t === 'branch') {
        const paths = el.paths.map((p) => {
          let w = cur;
          return p.map((c, q) => { const ow = q === p.length - 1 ? o : fresh(); const le = mk(c, w, ow); w = ow; return le; });
        });
        cols.push({ kind: 'branch', paths, wIn: cur, wOut: o });
      } else cols.push({ kind: 'el', e: mk(el, cur, o) });
      cur = o;
      nodes.push(o);
    });
    // the shared prefix keeps the earlier rung's nodes, so a later rung can share a longer prefix through this one
    seen.push({ path: rung.path, nodes: [...srcNodes.slice(0, skip), ...nodes] });
    // ---- lines: columns before the load fill a line up to LADDER.avail, the load ends the last line
    const loadCol = cols[cols.length - 1];
    const loadIsEl = loadCol?.kind === 'el' && loadCol.e.el.t === 'coil';
    const series = loadIsEl ? cols.slice(0, -1) : cols;
    const lines: LadderLine[] = [];
    let line: LadderCol[] = [];
    let w = 0;
    for (const c of series) {
      const cw = colWidth(c.kind === 'el' ? c.e.el : { t: 'branch', paths: c.paths.map((p) => p.map((x) => x.el as RelayContact)) });
      if (line.length && w + cw > LADDER.avail) { lines.push({ cols: line, row: 0, rows: 1 }); line = []; w = 0; }
      line.push(c);
      w += cw;
    }
    if (loadIsEl) line.push(loadCol);
    lines.push({ cols: line, row: 0, rows: 1 });
    let row = 0;
    for (const l of lines) {
      l.row = row;
      l.rows = Math.max(1, ...l.cols.map((c) => (c.kind === 'branch' ? c.paths.length : 1)));
      for (const c of l.cols) {
        if (c.kind === 'el') c.e.row = row;
        else c.paths.forEach((p, q) => p.forEach((x) => { x.row = row + q; }));
      }
      row += l.rows;
    }
    out.push({ rung, n, start, cols, lines, rows: row, driveEnd, ...(rung.placeholder ? { placeholder: true } : {}) });
  });
  if (unread.size) questions.push(`Terminal numbers not read for ${[...unread].join(', ')} — read them from the old drawing or the new part's contact blocks ("?" on the ladder).`);

  // ---- wire list: each net from its rail terminal (TB1) through every device terminal it joins
  const wires: LadderWire[] = [];
  for (const [wire, { ends, fn }] of nets) {
    const chain = rails.includes(wire) ? [`TB1 ${wire}`, ...ends] : ends;
    for (let i = 1; i < chain.length; i++) wires.push({ wire, from: chain[i - 1], to: chain[i], function: fn });
  }
  return { rails, rungs: out, wires, questions };
}

/** Coil voltage a rung's rail needs, and whether a part's coil rating matches it. */
export function coilMatchesRail(supply: RelayLogic['supply'], rating: string): boolean {
  const r = rating.replace(/\s/g, '').toUpperCase();
  if (!r) return true;
  return supply === '24VDC' ? /24V?(AC\/)?(V?DC|ACDC)|24VDC|24V$/.test(r) || r === '24' : /(110|115|120|12[0-5])V?AC/.test(r);
}
