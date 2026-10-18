/**
 * Siemens TIA Portal PLC tag table, as exported for the SCL / PLCopen import: CSV (Name, Path, Data Type,
 * Logical Address, Comment …; comma or semicolon) or the .sdf (no header: "Name","%I0.0","Bool",…,"Comment").
 * Gives each tag its address (so the importer knows the inputs and outputs) and its comment.
 */
import { gxRows } from './gxCsv';
import { iecIo } from './plcopen';
import type { ForeignProgram } from './types';

export interface SiemensTag { name: string; address: string; type: string; comment: string }

const isAddress = (s: string) => /^%?[IQM][XBWD]?\d+(\.\d)?$/i.test(s.replace(/\s+/g, ''));

export function readSiemensTags(text: string): SiemensTag[] {
  const t = text.replace(/^\uFEFF/, '');
  const rows = t.includes(';') && !t.split(/\r?\n/)[0].includes(',') ? gxRows(t.replace(/;/g, ',')) : gxRows(t);
  const head = rows.findIndex((r) => r.some((c) => /^Name$/i.test(c)) && r.some((c) => /Address/i.test(c)));
  if (head >= 0) {
    const col = (re: RegExp) => rows[head].findIndex((c) => re.test(c));
    const ni = col(/^Name$/i), ai = col(/Address/i), ti = col(/Data ?Type/i), ci = col(/^Comment$/i);
    return rows.slice(head + 1).filter((r) => r[ni] && isAddress(r[ai] ?? '')).map((r) => ({ name: r[ni], address: norm(r[ai]), type: r[ti] ?? '', comment: ci >= 0 ? r[ci] ?? '' : '' }));
  }
  // .sdf: Name, Address, Type, then flags, Comment as the 7th field.
  return rows.filter((r) => r[0] && isAddress(r[1] ?? '')).map((r) => ({ name: r[0], address: norm(r[1]), type: r[2] ?? '', comment: r[6] ?? '' }));
}

/** "%IW96" stays, "I0.0" → "%IX0.0" (iecIo reads the %-form). */
function norm(a: string): string {
  const s = a.replace(/\s+/g, '').toUpperCase();
  const p = s.startsWith('%') ? s : `%${s}`;
  return /^%[IQM]\d/.test(p) ? p.replace(/^%([IQM])/, '%$1X') : p;
}

export const isSiemensTagTable = (text: string) => readSiemensTags(text).length > 0 && !/<|BEGIN|END_/.test(text.slice(0, 2000));

/** Addresses and comments from the tag table onto the program's tags (and the tags the program uses but doesn't declare). */
export function mergeSiemensTags(fp: ForeignProgram, table: SiemensTag[]): void {
  const byName = new Map(table.map((t) => [t.name.toLowerCase(), t]));
  for (const tag of fp.tags) {
    const t = byName.get(tag.name.toLowerCase());
    if (!t) continue;
    tag.address = t.address;
    Object.assign(tag, iecIo(t.address));
    if (t.comment && !tag.comment) tag.comment = t.comment;
    byName.delete(tag.name.toLowerCase());
  }
  // Tags only in the table (the SCL names them as "Tag"): added with their type.
  for (const t of byName.values()) {
    const u = t.type.toUpperCase();
    fp.tags.push({ name: t.name, dataType: u === 'BOOL' ? 'BOOL' : /INT|WORD|BYTE/.test(u) && !/DINT|DWORD/.test(u) ? 'INT' : /DINT|DWORD|TIME/.test(u) ? 'DINT' : /REAL/.test(u) ? 'REAL' : 'OTHER', rawType: t.type, comment: t.comment, address: t.address, ...iecIo(t.address) });
  }
  fp.notes = fp.notes.filter((n) => !/add the PLC tag table/.test(n));
  fp.notes.push(`PLC tag table: ${table.length} tags with their addresses.`);
}
