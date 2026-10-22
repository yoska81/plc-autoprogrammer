/**
 * "Send to CODESYS": the project's Structured Text as the objects of a CODESYS application, the way CODESYS keeps
 * them: each POU (PROGRAM, FUNCTION_BLOCK, FUNCTION) with its declaration (the header and its VAR sections) and
 * its implementation (the statements), each TYPE as a DUT, each VAR_GLOBAL as a GVL. The CODESYS bridge's script
 * (tools/codesys-bridge/scripts/isa_job.py) creates or replaces them through the CODESYS ScriptEngine
 * (create_pou / create_dut / create_gvl, textual_declaration / textual_implementation) and adds the main program
 * to the MainTask.
 */

export type CodesysKind = 'program' | 'function_block' | 'function' | 'dut' | 'gvl';

export interface CodesysObject {
  kind: CodesysKind;
  name: string;
  /** The declaration text (a POU's header and VAR sections; a DUT's TYPE … END_TYPE; a GVL's VAR_GLOBAL … END_VAR). */
  declaration: string;
  /** A POU's statements (empty for a DUT or a GVL). */
  implementation: string;
  /** A FUNCTION's return type. */
  returnType?: string;
}

export interface CodesysProgram {
  objects: CodesysObject[];
  /** The program the MainTask calls (the first PROGRAM). */
  main: string;
  /** What was left out, in plain words. */
  notes: string[];
}

const START = /^\s*(PROGRAM|FUNCTION_BLOCK|FUNCTION|TYPE|VAR_GLOBAL)\b(.*)$/i;
const END: Record<string, RegExp> = {
  PROGRAM: /^\s*END_PROGRAM\b/i, FUNCTION_BLOCK: /^\s*END_FUNCTION_BLOCK\b/i, FUNCTION: /^\s*END_FUNCTION\b/i,
  TYPE: /^\s*END_TYPE\b/i, VAR_GLOBAL: /^\s*END_VAR\b/i,
};
const VAR_START = /^\s*(VAR(_INPUT|_OUTPUT|_IN_OUT|_TEMP|_STAT|_INST|_EXTERNAL)?|VAR\s+(CONSTANT|RETAIN|PERSISTENT))\b/i;
const VAR_END = /^\s*END_VAR\b/i;
const blank = (l: string) => !l.trim() || /^\s*\/\//.test(l) || /^\s*\(\*.*\*\)\s*$/.test(l);

/** The ST text without a Markdown fence around it (an AI answer may keep one). */
const unfenced = (st: string) => st.replace(/^\s*```[\w-]*\s*\n/, '').replace(/\n\s*```\s*$/, '');

/** A POU's lines → declaration (header + VAR sections) and implementation (the rest, before its END_ line). */
function splitPou(lines: string[]): { declaration: string; implementation: string } {
  let i = 1, inVar = false, lastDecl = 0;
  for (; i < lines.length - 1; i++) {
    const l = lines[i];
    if (inVar) { if (VAR_END.test(l)) { inVar = false; lastDecl = i; } continue; }
    if (VAR_START.test(l)) { if (/\bEND_VAR\b/i.test(l.replace(VAR_START, ''))) lastDecl = i; else inVar = true; continue; }
    if (blank(l)) continue;
    break;
  }
  return {
    declaration: lines.slice(0, lastDecl + 1).join('\n').trimEnd(),
    implementation: lines.slice(lastDecl + 1, lines.length - 1).join('\n').replace(/^\s*\n/, '').trimEnd(),
  };
}

export function codesysProgram(st: string): CodesysProgram {
  const lines = unfenced(st).replace(/\r\n?/g, '\n').split('\n');
  const objects: CodesysObject[] = [];
  const notes: string[] = [];
  let gvls = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = START.exec(lines[i]);
    if (!m) continue;
    const key = m[1].toUpperCase();
    // the end may be on the same line (TYPE Mode : (Off, Auto); END_TYPE)
    const endOnLine = new RegExp(`\\b${key === 'VAR_GLOBAL' ? 'END_VAR' : `END_${key}`}\\b`, 'i').test(lines[i].slice(m[1].length + lines[i].indexOf(m[1])));
    let j = i;
    if (!endOnLine) { j = i + 1; while (j < lines.length && !END[key].test(lines[j])) j++; }
    if (j >= lines.length) { notes.push(`${key} at line ${i + 1} has no ${key === 'VAR_GLOBAL' ? 'END_VAR' : `END_${key}`}: left out.`); continue; }
    const part = lines.slice(i, j + 1);
    if (key === 'TYPE') {
      // TYPE Name : STRUCT … END_STRUCT; END_TYPE (one DUT per TYPE block, named by its first type)
      const name = /^\s*TYPE\s+(\w+)/i.exec(part.join('\n'))?.[1] ?? /^\s*(\w+)\s*:/m.exec(part.slice(1).join('\n'))?.[1];
      if (name) objects.push({ kind: 'dut', name, declaration: part.join('\n').trim(), implementation: '' });
      else notes.push(`TYPE at line ${i + 1} names no type: left out.`);
    } else if (key === 'VAR_GLOBAL') {
      objects.push({ kind: 'gvl', name: gvls++ ? `GVL_${gvls}` : 'GVL', declaration: part.join('\n').trim(), implementation: '' });
    } else {
      const name = /^\s*\w+\s+(\w+)/.exec(lines[i])?.[1];
      if (!name) { notes.push(`${key} at line ${i + 1} has no name: left out.`); i = j; continue; }
      const { declaration, implementation } = splitPou(part);
      const kind = key === 'PROGRAM' ? 'program' : key === 'FUNCTION_BLOCK' ? 'function_block' : 'function';
      const returnType = kind === 'function' ? /:\s*([\w.]+(?:\s*\(.*\))?)\s*$/.exec(lines[i].replace(/\(\*.*?\*\)|\/\/.*$/g, ''))?.[1] : undefined;
      objects.push({ kind, name, declaration, implementation, ...(returnType ? { returnType } : {}) });
    }
    i = j;
  }
  const main = objects.find((o) => o.kind === 'program')?.name ?? '';
  if (!main) notes.push('The program has no PROGRAM … END_PROGRAM: nothing for the MainTask to call.');
  return { objects, main, notes };
}
