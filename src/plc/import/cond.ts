/**
 * Rung conditions as a tree (series = AND, parallel = OR) and their conversion to the app's rung
 * shape: parallel branches (OR) of series elements (AND). Shared by every reader: ladder text, the
 * graphical ladder of XML formats, instruction lists and Structured Text all build a Cond.
 */
import type { LadderElement, LadderOutput, Rung } from '../core/ladder';

export type Cond =
  | { k: 'true' }
  | { k: 'false' }
  | { k: 'el'; el: LadderElement }
  | { k: 'and'; xs: Cond[] }
  | { k: 'or'; xs: Cond[] }
  | { k: 'not'; x: Cond };

export const TRUE: Cond = { k: 'true' };
export const FALSE: Cond = { k: 'false' };
export const el = (e: LadderElement): Cond => ({ k: 'el', el: e });

const key = (c: Cond): string => JSON.stringify(c);
export const sameCond = (a: Cond, b: Cond) => key(a) === key(b);

export function and(...xs: Cond[]): Cond {
  const out: Cond[] = [];
  for (const x of xs) {
    if (x.k === 'false') return FALSE;
    if (x.k === 'true') continue;
    if (x.k === 'and') out.push(...x.xs); else out.push(x);
  }
  if (!out.length) return TRUE;
  return out.length === 1 ? out[0] : { k: 'and', xs: out };
}

export function or(...xs: Cond[]): Cond {
  const out: Cond[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    if (x.k === 'true') return TRUE;
    if (x.k === 'false') continue;
    for (const y of x.k === 'or' ? x.xs : [x]) {
      const k = key(y);
      if (!seen.has(k)) { seen.add(k); out.push(y); }
    }
  }
  if (!out.length) return FALSE;
  return out.length === 1 ? out[0] : { k: 'or', xs: out };
}

const NEG_OP = { '==': '<>', '<>': '==', '>': '<=', '>=': '<', '<': '>=', '<=': '>' } as const;

export function not(c: Cond): Cond {
  switch (c.k) {
    case 'true': return FALSE;
    case 'false': return TRUE;
    case 'not': return c.x;
    case 'and': return or(...c.xs.map(not));
    case 'or': return and(...c.xs.map(not));
    case 'el': {
      const e = c.el;
      if (e.type === 'NO') return el({ type: 'NC', address: e.address });
      if (e.type === 'NC') return el({ type: 'NO', address: e.address });
      if (e.type === 'CMP') return el({ ...e, op: NEG_OP[e.op] });
      return { k: 'not', x: c }; // NOT of an edge: no ladder form
    }
  }
}

/** Most parallel branches a rung may get when a condition is multiplied out. */
export const MAX_BRANCHES = 24;

/**
 * Condition → parallel branches of series elements (OR of ANDs). null = cannot be drawn
 * (a NOT of an edge, or more than MAX_BRANCHES branches); [] = never true; [[]] = always true.
 */
export function toBranches(c: Cond): LadderElement[][] | null {
  switch (c.k) {
    case 'true': return [[]];
    case 'false': return [];
    case 'el': return [[c.el]];
    case 'not': return null;
    case 'or': {
      const out: LadderElement[][] = [];
      for (const x of c.xs) {
        const b = toBranches(x);
        if (!b) return null;
        out.push(...b);
        if (out.length > MAX_BRANCHES) return null;
      }
      return dedupe(out);
    }
    case 'and': {
      let acc: LadderElement[][] = [[]];
      for (const x of c.xs) {
        const b = toBranches(x);
        if (!b) return null;
        const next: LadderElement[][] = [];
        for (const p of acc) for (const q of b) next.push([...p, ...q]);
        if (next.length > MAX_BRANCHES) return null;
        acc = next;
      }
      return dedupe(acc);
    }
  }
}

function dedupe(bs: LadderElement[][]): LadderElement[][] {
  const seen = new Set<string>();
  const out: LadderElement[][] = [];
  for (const b of bs) {
    const k = JSON.stringify(b);
    if (!seen.has(k)) { seen.add(k); out.push(b); }
  }
  // An always-true path makes the whole rung always true.
  return out.some((b) => !b.length) ? [[]] : out;
}

/** One output with the condition that drives it, in program order. */
export interface Driven { cond: Cond; out: LadderOutput }

/**
 * Outputs → rungs: consecutive outputs with the same condition share one rung. Returns the rungs and
 * the conditions that could not be drawn (their outputs are left out and reported by the caller).
 */
export function toRungs(driven: Driven[], comment: string, idBase: string): { rungs: Rung[]; failed: Driven[] } {
  const rungs: Rung[] = [];
  const failed: Driven[] = [];
  let cur: { cond: Cond; outs: LadderOutput[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const branches = toBranches(cur.cond);
    if (!branches) failed.push(...cur.outs.map((out) => ({ cond: cur!.cond, out })));
    else if (branches.length) {
      rungs.push({
        id: `${idBase}${rungs.length ? `_${rungs.length + 1}` : ''}`,
        comment: rungs.length ? '' : comment,
        branches: branches.length === 1 && !branches[0].length ? [] : branches,
        outputs: cur.outs,
      });
    }
    cur = null;
  };
  for (const d of driven) {
    if (cur && sameCond(cur.cond, d.cond)) cur.outs.push(d.out);
    else { flush(); cur = { cond: d.cond, outs: [d.out] }; }
  }
  flush();
  return { rungs, failed };
}
