/**
 * MPE720 (Ver.6 / Ver.7) register comments and variables as CSV, the files MPE720 imports from the Register List
 * (global registers: one file) and from each drawing's local registers (one file per drawing, named after it).
 * One row per register: A = register, B = comment, C = variable name, D = structure (empty), e.g.
 *   MB000001,Run Switch,,
 * Registers keep the form the MPE720 project itself uses (IB00000, MW00010, DW00001), as read by
 * src/plc/import/mpe720.ts. The program's other memory has no MPE720 register yet (the per-project memory layout
 * of the Yaskawa profile places it) and is listed apart, never given a made-up register.
 */
import type { LadderProgram } from './ladder';
import type { IOPoint } from '../../types/io';

/** A global register: I/O (IB / IW / IL / IF, OB…), M and S registers. */
const GLOBAL = /^[IOMS][BWLF][0-9A-F]{4,7}$/;
/** A drawing's local register as the import names it: drawing, then the D register ("H01_02_DW00001"). */
const LOCAL = /^([AHIL](?:\d\d)?(?:_\d\d)*)_(D[BWLF][0-9A-F]{4,7})$/;

export interface Mpe720Csv {
  /** The global registers' file. */
  global: string;
  /** Local registers by drawing ("H01", "H01.02"): one file each. */
  locals: Record<string, string>;
  /** Registers written (global + local). */
  count: number;
  /** Program memory with no MPE720 register yet (app address and name). */
  unplaced: { address: string; name: string }[];
}

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const row = (register: string, comment: string, variable = '') => [register, comment, variable, ''].map(cell).join(',');
/** "H01_02" → "H01.02" (the drawing as MPE720 shows it). */
const drawing = (prefix: string) => prefix.replace(/_/g, '.');

/**
 * The comment rows of a project kept on its MPE720 registers: the I/O points (their register is their address,
 * their comment the I/O description) and the program's tags whose name is an MPE720 register (the import keeps the
 * original register as the nickname, its comment as the comment).
 */
export function mpe720CommentCsv(program: LadderProgram, io: IOPoint[], addresses: Map<string, string>): Mpe720Csv {
  const global = new Map<string, string>();
  const locals = new Map<string, Map<string, string>>();
  const unplaced: { address: string; name: string }[] = [];
  for (const p of io) {
    const a = (addresses.get(p.id) ?? '').trim().toUpperCase();
    if (GLOBAL.test(a) && p.description.trim()) global.set(a, p.description.trim());
  }
  for (const t of program.tags) {
    const name = t.nickname.trim().toUpperCase();
    const comment = t.comment.replace(/^Original:[^—]*—\s*/, '').trim();
    const local = LOCAL.exec(name);
    if (local) {
      if (!comment) continue;
      const d = drawing(local[1]);
      if (!locals.has(d)) locals.set(d, new Map());
      locals.get(d)!.set(local[2], comment);
    } else if (GLOBAL.test(name)) {
      if (comment && !global.has(name)) global.set(name, comment);
    } else if (comment || t.nickname) unplaced.push({ address: t.address, name: t.nickname || comment });
  }
  const file = (m: Map<string, string>) => [...m].sort(([a], [b]) => a.localeCompare(b)).map(([r, c]) => row(r, c)).join('\r\n') + (m.size ? '\r\n' : '');
  return {
    global: file(global),
    locals: Object.fromEntries([...locals].sort(([a], [b]) => a.localeCompare(b)).map(([d, m]) => [d, file(m)])),
    count: global.size + [...locals.values()].reduce((n, m) => n + m.size, 0),
    unplaced,
  };
}
