/**
 * Vendor-neutral tag table: every operand of a program as a symbol with an
 * IEC 61131-3 data type. First step of the multi-vendor plan
 * (docs/architecture/multi-vendor.md §3.1): exporters for tag-based PLCs
 * (Logix, Siemens, CODESYS) start from this instead of CLICK addresses.
 */
import { rungAddresses, type LadderProgram } from './ladder';
import type { IecDataType, PlcProfile } from './profile';

export interface NeutralTag {
  /** IEC identifier: letters, digits, underscores, not starting with a digit. */
  symbol: string;
  dataType: IecDataType;
  /** Address on the current PLC (CLICK: X001, DS1001 ...). */
  address: string;
  retentive: boolean;
  comment: string;
  /** Physical I/O point. */
  io: boolean;
}

const isConst = (a: string) => /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(a.trim());
const mathVars = (expr: string) => expr.toUpperCase().match(/[A-Z]+\d+/g)?.filter((a) => a !== 'MOD') ?? [];

/** A valid IEC identifier from free text, unique (case-insensitive) within `used`. */
export function iecSymbol(text: string, used: Set<string>): string {
  let base = text.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'Tag';
  if (/^\d/.test(base)) base = `T_${base}`.slice(0, 32);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 32 - String(i).length - 1)}_${i}`;
  used.add(name.toLowerCase());
  return name;
}

/**
 * Every address the program uses (plus `ioLabels` points), with a symbol from
 * the nickname, else the I/O description, else the address itself.
 * Needs `profile.dataTypeOf`; addresses it rejects are skipped.
 */
export function tagTable(program: LadderProgram, profile: PlcProfile, ioLabels: Map<string, string> = new Map()): NeutralTag[] {
  if (!profile.dataTypeOf) return [];
  const addrs = new Set<string>();
  for (const r of program.rungs) {
    for (const a of rungAddresses(r)) if (a && !isConst(a)) addrs.add(a.trim().toUpperCase());
    for (const o of r.outputs) if (o.type === 'MATH') for (const v of mathVars(o.expression)) addrs.add(v);
  }
  for (const a of ioLabels.keys()) addrs.add(a.toUpperCase());
  const nick = new Map(program.tags.map((t) => [t.address.trim().toUpperCase(), t]));
  const used = new Set<string>();
  const out: NeutralTag[] = [];
  for (const address of [...addrs].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const dataType = profile.dataTypeOf(address);
    if (!dataType) continue;
    const kind = profile.parseAddress(address)?.kind;
    const t = nick.get(address);
    const io = kind === 'input' || kind === 'output';
    out.push({
      symbol: iecSymbol(t?.nickname || ioLabels.get(address) || address, used),
      dataType,
      address,
      retentive: profile.simSemantics?.retentive(address) ?? false,
      comment: t?.comment || ioLabels.get(address) || '',
      io,
    });
  }
  return out;
}
