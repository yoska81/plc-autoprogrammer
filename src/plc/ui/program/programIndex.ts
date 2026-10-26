/**
 * Program indexes for the Program page: block membership, checker status per
 * block and the cross reference (every rung that reads or writes an address).
 */
import type { LadderProgram, Rung } from '../../core/ladder';
import type { ValidationIssue } from '../../core/validate';

export const GENERAL = '';

export type UseKind = 'read' | 'write';

export interface XrefUse {
  rungId: string;
  /** 1-based rung number in the whole program. */
  number: number;
  block: string;
  kind: UseKind;
  /** Instruction, e.g. "NO contact", "OUT coil", "Timer preset". */
  how: string;
}

const isConst = (a: string) => /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(a.trim());
const norm = (a: string) => a.trim().toUpperCase();
const mathVars = (expr: string) => expr.toUpperCase().match(/[A-Z]+\d+/g)?.filter((a) => a !== 'MOD') ?? [];

const blockIds = new WeakMap<LadderProgram, Set<string>>();

export function blockOf(program: LadderProgram, r: Rung): string {
  // the program's block ids, once per program (called for every rung of programs with thousands of blocks)
  let ids = blockIds.get(program);
  if (!ids) { ids = new Set((program.blocks ?? []).map((b) => b.id)); blockIds.set(program, ids); }
  return r.block && ids.has(r.block) ? r.block : GENERAL;
}

/** Every address use in one rung. */
export function rungUses(r: Rung): { address: string; kind: UseKind; how: string }[] {
  const out: { address: string; kind: UseKind; how: string }[] = [];
  const add = (a: string | null | undefined, kind: UseKind, how: string) => {
    if (!a || !a.trim() || isConst(a)) return;
    out.push({ address: norm(a), kind, how });
  };
  const CONTACT: Record<string, string> = { NO: 'NO contact', NC: 'NC contact', RISE: 'Rising edge', FALL: 'Falling edge' };
  for (const br of r.branches) for (const el of br) {
    if (el.type === 'CMP') { add(el.left, 'read', `Compare ${el.op}`); add(el.right, 'read', `Compare ${el.op}`); }
    else if (el.type !== 'RAW') add(el.address, 'read', CONTACT[el.type]);
  }
  for (const o of r.outputs) {
    switch (o.type) {
      case 'OUT': add(o.address, 'write', 'OUT coil'); break;
      case 'SET': add(o.address, 'write', 'SET coil'); break;
      case 'RST': add(o.address, 'write', 'RST coil'); break;
      case 'TMR': {
        add(o.address, 'write', 'Timer');
        const n = norm(o.address).replace(/^T/, '');
        if (/^\d+$/.test(n)) add(`TD${n}`, 'write', 'Timer value');
        add(o.preset, 'read', 'Timer preset');
        add(o.resetAddress, 'read', 'Timer reset');
        break;
      }
      case 'CNT': {
        add(o.address, 'write', 'Counter');
        const n = norm(o.address).replace(/^CT/, '');
        if (/^\d+$/.test(n)) add(`CTD${n}`, 'write', 'Counter value');
        add(o.preset, 'read', 'Counter preset');
        add(o.resetAddress, 'read', 'Counter reset');
        break;
      }
      case 'COPY': add(o.source, 'read', 'COPY source'); add(o.dest, 'write', 'COPY destination'); break;
      case 'MATH': for (const v of mathVars(o.expression)) add(v, 'read', 'MATH operand'); add(o.dest, 'write', 'MATH result'); break;
    }
  }
  return out;
}

/** Address -> uses, in program order. */
export function crossReference(program: LadderProgram): Map<string, XrefUse[]> {
  const map = new Map<string, XrefUse[]>();
  program.rungs.forEach((r, i) => {
    const block = blockOf(program, r);
    const seen = new Set<string>();
    for (const u of rungUses(r)) {
      const key = `${u.address}|${u.kind}|${u.how}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!map.has(u.address)) map.set(u.address, []);
      map.get(u.address)!.push({ rungId: r.id, number: i + 1, block, kind: u.kind, how: u.how });
    }
  });
  return map;
}

export interface BlockStatus { errors: number; warnings: number }

/** Checker issues per block id (and per rung id). */
export function issueStatus(program: LadderProgram, issues: ValidationIssue[]) {
  const byRung = new Map<string, BlockStatus>();
  const byBlock = new Map<string, BlockStatus>();
  const bump = (m: Map<string, BlockStatus>, k: string, sev: ValidationIssue['severity']) => {
    const s = m.get(k) ?? { errors: 0, warnings: 0 };
    if (sev === 'error') s.errors++; else s.warnings++;
    m.set(k, s);
  };
  const rungById = new Map(program.rungs.map((r) => [r.id, r]));
  for (const i of issues) {
    const r = i.rungId ? rungById.get(i.rungId) : undefined;
    if (!r) continue;
    bump(byRung, r.id, i.severity);
    bump(byBlock, blockOf(program, r), i.severity);
  }
  return { byRung, byBlock };
}

export function naturalAddress(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
