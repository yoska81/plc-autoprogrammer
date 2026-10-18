/**
 * CLICK Programming Software address list (Address Picker › Export, the nickname CSV):
 * Address,Data Type,Nickname,Initial Value,Retentive,Address Comment. CLICK cannot export its ladder
 * as a file: the rungs come from a PDF printout of the program (read by the AI).
 */
import type { ForeignProgram, ForeignTag, ForeignType } from './types';

/** One CSV line → cells (quoted cells with "" escapes). */
export function csvCells(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const TYPE: Record<string, ForeignType> = { BIT: 'BOOL', INT: 'INT', INT2: 'DINT', FLOAT: 'REAL', HEX: 'INT', TXT: 'STRING' };

export function readClickCsv(input: string): ForeignProgram {
  // Windows exports are CRLF: read as LF lines.
  const src = input.replace(/\r\n?/g, '\n');
  const lines = src.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = csvCells(lines[0] ?? '').map((h) => h.toLowerCase());
  const col = (n: string) => head.findIndex((h) => h.replace(/[^a-z]/g, '') === n);
  const ia = col('address'), it = col('datatype'), inn = col('nickname'), ic = col('addresscomment');
  if (ia < 0 || inn < 0) throw new Error('This CSV is not a CLICK address list (needs Address and Nickname columns).');
  const tags: ForeignTag[] = [];
  for (const l of lines.slice(1)) {
    const c = csvCells(l);
    const address = (c[ia] ?? '').toUpperCase();
    if (!/^[A-Z]+\d+$/.test(address)) continue;
    const nickname = c[inn] || address;
    const comment = ic >= 0 ? c[ic] ?? '' : '';
    const io = /^X\d+$/.test(address) ? 'input' : /^Y\d+$/.test(address) ? 'output' : undefined;
    const t = TYPE[(c[it] ?? '').toUpperCase()] ?? (/^(X|Y|C|T|CT|SC)\d+$/.test(address) ? 'BOOL' : 'INT');
    tags.push({ name: nickname, dataType: /^T\d+$/.test(address) ? 'TIMER' : /^CT\d+$/.test(address) ? 'COUNTER' : t, comment, address, ...(io ? { io } : {}) });
  }
  return {
    format: 'click-csv', vendor: 'AutomationDirect', controller: 'CLICK', projectName: 'CLICK project', tags, routines: [],
    notes: ['CLICK cannot export its ladder as a file. Add a PDF printout of the program (CLICK software: File › Print, choose "Microsoft Print to PDF") to import the rungs too.'],
  };
}
