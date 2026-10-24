import type { LadderElement, LadderProgram } from '../plc/core/ladder';
import type { RungPower } from '../plc/sim/engine';

/**
 * Power flow of every rung from values read from a real PLC (no scan is
 * executed here: the PLC runs the program, this only shows where power
 * reaches with the current values). Edge contacts (RISE / FALL) cannot be
 * seen by polling, so they show the bit's present state.
 */

const isConst = (a: string) => /^-?\d+(\.\d+)?$/.test(a.trim());
const norm = (a: string) => a.trim().toUpperCase();

export function rungPowerFromValues(program: LadderProgram, bits: Map<string, boolean>, words: Map<string, number>): Map<string, RungPower> {
  const bit = (a: string) => bits.get(norm(a)) ?? false;
  const word = (a: string) => (isConst(a) ? Number(a) : words.get(norm(a)) ?? (bits.has(norm(a)) ? Number(bit(a)) : 0));
  const closed = (el: LadderElement): boolean => {
    if (el.type === 'CMP') {
      const l = word(el.left), r = word(el.right);
      switch (el.op) {
        case '==': return l === r;
        case '<>': return l !== r;
        case '>': return l > r;
        case '>=': return l >= r;
        case '<': return l < r;
        case '<=': return l <= r;
        default: return false;
      }
    }
    if (el.type === 'RAW') return false;
    return el.type === 'NC' ? !bit(el.address) : bit(el.address);
  };
  const out = new Map<string, RungPower>();
  for (const r of program.rungs) {
    const branches: boolean[][] = [];
    const cl: boolean[][] = [];
    let rungTrue = r.branches.length === 0;
    for (const br of r.branches) {
      let p = true;
      const pb: boolean[] = [], cb: boolean[] = [];
      for (const el of br) { const c = closed(el); p = p && c; cb.push(c); pb.push(p); }
      branches.push(pb);
      cl.push(cb);
      if (p) rungTrue = true;
    }
    out.set(r.id, { branches, closed: cl, rungTrue });
  }
  return out;
}
