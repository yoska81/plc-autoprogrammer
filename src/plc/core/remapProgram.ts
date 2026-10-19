/**
 * The program after an I/O list change (ioRemap.ts): every operand that names an I/O point follows its point to
 * its new address, in one pass. An operand on a deleted point's address is marked "?X003". It is not left on
 * X003, which another point may now have, and the checker reports it as an error until someone picks its
 * new input / output.
 */
import type { LadderElement, LadderOutput, LadderProgram } from './ladder';
import { remapAddress, remapIsEmpty, type IoRemap } from './ioRemap';

/** Marks an operand whose I/O point was deleted: "?X003". */
export const DELETED_MARK = '?';
export const isDeletedOperand = (a: string) => a.trim().startsWith(DELETED_MARK);
export const deletedAddress = (a: string) => a.trim().slice(DELETED_MARK.length);

export interface ProgramRemap {
  program: LadderProgram;
  /** Operands moved to their point's new address. */
  moved: number;
  /** Rungs (by id) that read or write a deleted point, and those points' old addresses. */
  deleted: { rungId: string; address: string }[];
  /** Rungs with a kept vendor instruction (RAW) whose text names a moved or deleted address: not rewritten, to check by hand. */
  raw: string[];
}

/** Rewrite the program's I/O operands through the remap (rungs, motion, the cycle's waits; tags of deleted points are dropped). */
export function remapProgram(program: LadderProgram, r: IoRemap): ProgramRemap {
  if (remapIsEmpty(r)) return { program, moved: 0, deleted: [], raw: [] };
  let moved = 0;
  const deleted: { rungId: string; address: string }[] = [];
  let rungId = '';
  const op = (a: string): string => {
    const k = a.trim().toUpperCase();
    const to = remapAddress(a, r);
    if (to !== a) { moved++; return to; }
    if (r.gone.has(k)) { if (rungId) deleted.push({ rungId, address: k }); return `${DELETED_MARK}${k}`; }
    return a;
  };
  const opN = (a: string | null) => (a == null ? a : op(a));
  // A MATH formula names its operands inline ("DS1 + X001"): each I/O name is looked up once.
  const expr = (e: string) => e.replace(/\b[XY]\d+\b/gi, (m) => op(m));
  const el = (e: LadderElement): LadderElement => (e.type === 'CMP' ? { ...e, left: op(e.left), right: op(e.right) } : e.type === 'RAW' ? e : { ...e, address: op(e.address) });
  const out = (o: LadderOutput): LadderOutput => {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': return { ...o, address: op(o.address) };
      case 'TMR': return { ...o, address: op(o.address), preset: op(o.preset), resetAddress: opN(o.resetAddress) };
      case 'CNT': return { ...o, address: op(o.address), preset: op(o.preset), resetAddress: opN(o.resetAddress) };
      case 'COPY': return { ...o, source: op(o.source), dest: op(o.dest) };
      case 'MATH': return { ...o, dest: op(o.dest), expression: expr(o.expression) };
      case 'RAW': return o;
    }
  };
  // A kept vendor instruction's text is the vendor's own: it is not rewritten, only reported.
  const touched = (t: string) => (t.match(/\b[XY]\d+\b/gi) ?? []).some((a) => r.moved.has(a.toUpperCase()) || r.gone.has(a.toUpperCase()));
  const raw = program.rungs.filter((g) => [...g.branches.flat(), ...g.outputs].some((x) => x.type === 'RAW' && touched(x.text))).map((g) => g.id);
  const rungs = program.rungs.map((g) => { rungId = g.id; return { ...g, branches: g.branches.map((b) => b.map(el)), outputs: g.outputs.map(out) }; });
  rungId = '';
  const m = program.motion;
  const motion = m && {
    axes: m.axes.map((a) => ({ ...a, pulse: op(a.pulse), direction: op(a.direction), ...(a.limitPos ? { limitPos: op(a.limitPos) } : {}), ...(a.limitNeg ? { limitNeg: op(a.limitNeg) } : {}) })),
    instructions: m.instructions.map((i) => (i.homeSwitch ? { ...i, homeSwitch: op(i.homeSwitch) } : i)),
    counters: m.counters.map((c) => ({ ...c, channels: c.channels.map(op) })),
  };
  const sequence = program.sequence && { ...program.sequence, steps: program.sequence.steps.map((s) => ({ ...s, waitFor: s.waitFor.map((w) => (w.input ? { ...w, input: op(w.input) } : w)) })) };
  const tags = program.tags.filter((t) => !r.gone.has(t.address.trim().toUpperCase())).map((t) => ({ ...t, address: remapAddress(t.address, r) }));
  return { program: { ...program, rungs, tags, ...(motion ? { motion } : {}), ...(sequence ? { sequence } : {}) }, moved, deleted, raw };
}
