/**
 * Structured Text source files: IEC / CODESYS / Micro800 (PROGRAM … VAR … END_VAR … END_PROGRAM,
 * FUNCTION_BLOCK …) and Siemens SCL sources (FUNCTION_BLOCK "Name" … VAR_INPUT … BEGIN … END_FUNCTION_BLOCK,
 * ORGANIZATION_BLOCK, DATA_BLOCK). Variables: Name [AT %IX0.0] : TYPE [:= init]; (* comment *) // comment.
 */
import { convertSt } from './st';
import { iecIo } from './plcopen';
import { slug } from './l5x';
import type { ForeignProgram, ForeignRoutine, ForeignTag, ForeignType } from './types';

const POU = /(PROGRAM|FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\s+("?)([^"\s:]+)\2[^\n]*\n([\s\S]*?)\n\s*END_(PROGRAM|FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)/gi;

export function stType(raw: string): ForeignType {
  const u = raw.trim().replace(/^"|"$/g, '').toUpperCase();
  if (u === 'BOOL') return 'BOOL';
  if (/^(SINT|INT|USINT|UINT|BYTE|WORD)$/.test(u)) return 'INT';
  if (/^(DINT|UDINT|DWORD|LINT|TIME)$/.test(u)) return 'DINT';
  if (/^(REAL|LREAL)$/.test(u)) return 'REAL';
  if (/^(TON|TOF|TP|TON_TIME|TOF_TIME|IEC_TIMER)$/.test(u)) return 'TIMER';
  if (/^(CTU|CTD|CTUD|CTU_INT|IEC_COUNTER)$/.test(u)) return 'COUNTER';
  if (/^STRING/.test(u)) return 'STRING';
  return 'OTHER';
}

/** Variables of every VAR… END_VAR section. A comment on the line of a declaration belongs to it. */
export function stVariables(text: string): ForeignTag[] {
  const out: ForeignTag[] = [];
  for (const sec of text.matchAll(/\bVAR(?:_INPUT|_OUTPUT|_IN_OUT|_GLOBAL|_TEMP|_STAT|_EXTERNAL)?\b(?:\s+(?:CONSTANT|RETAIN|PERSISTENT))*([\s\S]*?)\bEND_VAR\b/gi)) {
    // Attributes ({ … ; … }) may contain ";": drop them first.
    const body = sec[1].replace(/\{[^}]*\}/g, '');
    let decl = '';
    for (const line of body.split('\n')) {
      const comment = (/\(\*([\s\S]*?)\*\)/.exec(line)?.[1] ?? /\/\/([^\n]*)/.exec(line)?.[1] ?? '').trim();
      decl += ' ' + line.replace(/\(\*[\s\S]*?\*\)/g, '').replace(/\/\/[^\n]*/g, '');
      if (!decl.includes(';')) continue;
      for (const d of decl.split(';').slice(0, -1)) {
        const m = /^\s*("?)([A-Za-z_][\w]*)\1\s*(?:AT\s+(%[A-Za-z]+[\d.]+))?\s*:\s*([^:=]+?)\s*(?::=.*)?$/is.exec(d);
        if (!m) continue;
        const address = m[3];
        out.push({ name: m[2], dataType: stType(m[4]), rawType: m[4].replace(/^"|"$/g, ''), comment, ...(address ? { address } : {}), ...iecIo(address) });
      }
      decl = decl.slice(decl.lastIndexOf(';') + 1);
    }
  }
  return out;
}

export function readStSource(src: string, siemens: boolean): ForeignProgram {
  const text = src.replace(/\r\n?/g, '\n');
  const tags = stVariables(text);
  const routines: ForeignRoutine[] = [];
  const notes: string[] = [];
  const types = new Map(tags.map((t) => [t.name.toLowerCase(), t.rawType || t.dataType]));
  const pous = [...text.matchAll(POU)];
  const bodies = pous.length ? pous.map((m) => ({ name: m[3], body: m[4] })) : [{ name: 'Main', body: text }];
  for (const p of bodies) {
    // Code: after BEGIN (SCL) or after the last END_VAR.
    let code = p.body;
    const begin = /\bBEGIN\b/i.exec(code);
    if (begin) code = code.slice(begin.index + 5);
    else { const lastVar = code.toUpperCase().lastIndexOf('END_VAR'); if (lastVar >= 0) code = code.slice(lastVar + 7); }
    code = code.replace(/^\s*(TITLE|VERSION|AUTHOR|FAMILY|NAME)\s*[:=][^\n]*$/gim, '').replace(/^\s*\{[^}]*\}\s*$/gm, '');
    const st = convertSt(code, slug(p.name), { types });
    routines.push({ name: p.name, language: 'st', rungs: st.rungs, untranslated: st.untranslated });
  }
  if (siemens && !tags.some((t) => t.io)) notes.push('The SCL source names the PLC tags but not their addresses: add the PLC tag table (TIA Portal: PLC tags › Export) to know which tags are inputs and outputs.');
  return { format: siemens ? 'siemens-scl' : 'st', vendor: siemens ? 'Siemens' : 'IEC 61131-3', controller: '', projectName: bodies[0]?.name ?? 'Imported program', tags, routines, notes };
}
