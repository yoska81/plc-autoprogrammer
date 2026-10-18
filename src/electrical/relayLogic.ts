/**
 * Relay logic kept from a converted machine (DesignInputs.relayLogic) as an NFPA 79 ladder: rung numbers, a
 * wire number for every node, the device terminals each node joins, and the wire list. The ladder sheets
 * (drawings/sheets/LadderSheet.tsx) and the model's wire list (derive.ts) both read this, so they always agree.
 *
 * Wire numbers: rung n (1-based, drawing order) numbers its nodes 100 + n, then 100 + n + "A", "B"… left to
 * right (a branch's inner nodes included); the rails are 24+ / 0V (24 VDC) or X1 / X2 (120 VAC from the control
 * transformer). A rung ending in a drive input has no right-rail node: the drive's own common closes the circuit.
 */
import type { RelayCoil, RelayContact, RelayEl, RelayLogic, RelayRung } from './types';

export interface LadderEl {
  el: RelayContact | RelayCoil;
  /** Wire numbers on the element's left and right terminals. */
  wIn: string;
  wOut: string;
  /** Terminal names, left and right ("13", "14"; coils "A1", "A2"). */
  pins: [string, string];
}

export type LadderCol = { kind: 'el'; e: LadderEl } | { kind: 'branch'; paths: LadderEl[][]; wIn: string; wOut: string };

export interface LadderRung {
  rung: RelayRung;
  /** Rung number (1-based) — the base of its wire numbers. */
  n: number;
  /** Drawing rows the rung takes: 1 + the extra paths of its widest branch. */
  rows: number;
  cols: LadderCol[];
  /** The rung ends in a drive input (no right-rail connection). */
  driveEnd: boolean;
}

export interface LadderWire { wire: string; from: string; to: string; function: string }

export interface Ladder {
  rails: [string, string];
  rungs: LadderRung[];
  wires: LadderWire[];
  /** Coil tag → rung number; contacts per tag (for cross-references). */
  coilRung: Map<string, number>;
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Terminal names of a contact ("13-14" → ["13", "14"]) or a coil / load. */
export function relayPins(el: RelayContact | RelayCoil): [string, string] {
  if (el.t === 'contact') {
    const [a, b] = (el.terms ?? '').split(/\s*-\s*/);
    return [a || (el.nc ? '11' : '13'), b || (el.nc ? '12' : '14')];
  }
  if (el.kind === 'light') return ['X1', 'X2'];
  if (el.kind === 'drive-input') return [el.terms || 'IN', ''];
  return ['A1', 'A2'];
}

export function relayLadder(logic: RelayLogic): Ladder {
  const rails: [string, string] = logic.supply === '120VAC' ? ['X1', 'X2'] : ['24+', '0V'];
  const rungs: LadderRung[] = [];
  const nodes = new Map<string, { ends: string[]; fn: string }>();
  const join = (wire: string, end: string, fn: string) => {
    if (!wire || !end) return;
    const n = nodes.get(wire) ?? { ends: [], fn };
    if (!n.ends.includes(end)) n.ends.push(end);
    nodes.set(wire, n);
  };
  const coilRung = new Map<string, number>();

  logic.rungs.forEach((rung, i) => {
    const n = i + 1;
    const base = String(100 + n);
    let k = 0;
    const next = () => (k++ === 0 ? base : `${base}${LETTERS[(k - 2) % LETTERS.length]}`);
    const fn = rung.description || `Rung ${n}`;
    const path: RelayEl[] = rung.path;
    const last = path[path.length - 1];
    const driveEnd = last?.t === 'coil' && last.kind === 'drive-input';
    const cols: LadderCol[] = [];
    let cur = rails[0];
    const mk = (el: RelayContact | RelayCoil, wIn: string, wOut: string): LadderEl => {
      const pins = relayPins(el);
      join(wIn, `${el.tag}:${pins[0]}`, fn);
      if (pins[1]) join(wOut, `${el.tag}:${pins[1]}`, fn);
      return { el, wIn, wOut, pins };
    };
    path.forEach((el, j) => {
      const isLast = j === path.length - 1;
      const out = isLast ? (driveEnd ? '' : rails[1]) : next();
      if (el.t === 'branch') {
        const paths = el.paths.map((p) => {
          let w = cur;
          return p.map((c, q) => {
            const o = q === p.length - 1 ? out : next();
            const le = mk(c, w, o);
            w = o;
            return le;
          });
        });
        cols.push({ kind: 'branch', paths, wIn: cur, wOut: out });
      } else {
        if (el.t === 'coil' && el.kind !== 'drive-input') coilRung.set(el.tag, n);
        cols.push({ kind: 'el', e: mk(el, cur, out) });
      }
      cur = out;
    });
    const rows = Math.max(1, ...path.map((el) => (el.t === 'branch' ? el.paths.length : 1)));
    rungs.push({ rung, n, rows, cols, driveEnd });
  });

  // Wire list: each node from its rail terminal (TB1) through every device terminal it joins, in drawing order.
  const wires: LadderWire[] = [];
  for (const [wire, { ends, fn }] of nodes) {
    const chain = rails.includes(wire) ? [`TB1 ${wire}`, ...ends] : ends;
    for (let i = 1; i < chain.length; i++) wires.push({ wire, from: chain[i - 1], to: chain[i], function: fn });
  }
  return { rails, rungs, wires, coilRung };
}
