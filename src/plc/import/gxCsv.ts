/**
 * Mitsubishi GX Works2 / GX Works3 program exported as CSV (instruction list) plus the device comment CSV.
 * GX Works3 writes UTF-16 LE with BOM, tab-separated, every field in double quotes (GX Works2: the same,
 * or comma-separated): line 1 program name, line 2 "Module Type:…", line 3 the column names
 * ("Step No.", "Line Statement", "Instruction", "I/O(Device)", …), then one instruction per row; a row with
 * no step number carries more operands of the instruction above (MOV K500 / D0); a line statement starts
 * a new rung and is its comment. Device comments: "Device Name", "Comment" (often "Tag: description").
 *
 * The instruction list is run through a small stack machine (LD / AND / OR, ANB / ORB blocks, MPS / MRD /
 * MPP branches, INV) into outputs with their conditions. Instructions the ladder model has no form for are
 * kept as written (RAW, vendor 'mitsubishi-fx').
 */
import { and, el, not, or, toRungs, TRUE, FALSE, type Cond, type Driven } from './cond';
import { slug } from './l5x';
import type { CompareOp, LadderOutput } from '../core/ladder';
import type { ForeignProgram, ForeignRoutine, ForeignTag } from './types';

const VENDOR = 'mitsubishi-fx';

/** Text of a CSV file as the PLC software wrote it (UTF-16 LE / BE with BOM, or UTF-8). */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // UTF-16 without BOM: every other byte is 0 in ASCII text.
  if (bytes.length > 4 && bytes[1] === 0 && bytes[3] === 0) return new TextDecoder('utf-16le').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

/** Rows of a tab- (or comma-) separated file with "quoted" fields. */
export function gxRows(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = lines.slice(0, 5).some((l) => l.includes('\t')) ? '\t' : ',';
  return lines.map((l) => {
    const cells: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  });
}

export const isGxProgram = (text: string) => /Step No\.?/i.test(text.slice(0, 2000)) && /(Instruction|Command)/i.test(text.slice(0, 2000));
export const isGxComments = (text: string) => /Device Name/i.test(text.slice(0, 1000)) && /Comment/i.test(text.slice(0, 1000)) && !isGxProgram(text);

/** "X0" → { tag: "Start_PB", comment: "Start pushbutton (NO)" } from "Start_PB: Start pushbutton (NO)". */
export function gxComments(text: string): Map<string, { tag: string; comment: string }> {
  const out = new Map<string, { tag: string; comment: string }>();
  const rows = gxRows(text);
  const head = rows.findIndex((r) => r.some((c) => /^Device Name$/i.test(c)));
  const di = head >= 0 ? rows[head].findIndex((c) => /^Device Name$/i.test(c)) : 0;
  const ci = head >= 0 ? rows[head].findIndex((c) => /^Comment$/i.test(c)) : 1;
  for (const r of rows.slice(head + 1)) {
    const dev = (r[di] ?? '').toUpperCase(), c = r[ci] ?? '';
    if (!/^[A-Z]+\d/.test(dev) || !c) continue;
    const m = /^([A-Za-z_]\w*)\s*:\s*(.*)$/.exec(c);
    out.set(dev, m && isTagName(m[1]) ? { tag: m[1], comment: m[2] } : { tag: '', comment: c });
  }
  return out;
}

/** Words that start a plain comment ("Warning: cap chute low"), not tag names. */
const COMMON = new Set(['warning', 'note', 'notes', 'caution', 'attention', 'alarm', 'fault', 'error', 'info', 'check', 'spare', 'reserved', 'todo', 'see', 'step', 'input', 'output', 'used', 'unused', 'old', 'new']);

/** "Start_PB" is a tag name; "Warning" (a word), "X0" / "M100" (a device) are not. */
export function isTagName(s: string): boolean {
  if (COMMON.has(s.toLowerCase())) return false;
  if (/^(X|Y|M|L|B|F|D|W|R|T|ST|C|SM|SD|SB|SW|Z|V|U|K|H|E)\d+$/i.test(s)) return false;
  return /^[A-Za-z_]\w{1,39}$/.test(s);
}

interface Instr { step: string; comment: string; op: string; args: string[] }

function instructions(rows: string[][]): { name: string; module: string; list: Instr[] } {
  const head = rows.findIndex((r) => r.some((c) => /^Step No\.?$/i.test(c)));
  if (head < 0) throw new Error('No "Step No." column: export the program from GX Works as CSV (Project › Export to CSV / Instruction list).');
  const col = (re: RegExp) => rows[head].findIndex((c) => re.test(c));
  const si = col(/^Step No\.?$/i), li = col(/^Line Statement$/i), ii = col(/^(Instruction|Command)$/i), di = col(/^I\/O\s*\(Device\)$|^Device$/i);
  const name = rows.slice(0, head).map((r) => r[0]).find((c) => c && !/^Module Type/i.test(c)) ?? 'MAIN';
  const module = rows.slice(0, head).map((r) => r[0]).find((c) => /^Module Type/i.test(c))?.replace(/^Module Type\s*:\s*/i, '') ?? '';
  const list: Instr[] = [];
  for (const r of rows.slice(head + 1)) {
    const step = r[si] ?? '', op = (r[ii] ?? '').toUpperCase(), dev = r[di] ?? '', comment = li >= 0 ? r[li] ?? '' : '';
    if (!step && !op) { if (list.length && dev) list[list.length - 1].args.push(dev); continue; }
    list.push({ step, comment, op, args: dev ? dev.split(/\s+/) : [] });
  }
  return { name, module, list };
}

const CMP: Record<string, CompareOp> = { '=': '==', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };

/** "K500" → "500", "H1F" → "31", "E1.5" → "1.5", devices as they are. */
function value(a: string): string {
  if (/^K-?\d+$/i.test(a)) return a.slice(1);
  if (/^H[0-9A-F]+$/i.test(a)) return String(parseInt(a.slice(1), 16));
  if (/^E-?[\d.]+$/i.test(a)) return a.slice(1);
  return a;
}

export function readGxCsv(programText: string, commentText = ''): ForeignProgram {
  const { name, module, list } = instructions(gxRows(programText));
  const comments = commentText ? gxComments(commentText) : new Map<string, { tag: string; comment: string }>();
  const notes: string[] = [];
  // Device → name in the program (the tag from the comment when it is unique, else the device itself).
  const tagCount = new Map<string, number>();
  for (const c of comments.values()) if (c.tag) tagCount.set(c.tag.toLowerCase(), (tagCount.get(c.tag.toLowerCase()) ?? 0) + 1);
  const nameOf = (dev: string) => {
    const d = dev.toUpperCase();
    const c = comments.get(d);
    return c?.tag && tagCount.get(c.tag.toLowerCase()) === 1 ? c.tag : d;
  };
  const used = new Map<string, string>(); // device → name
  const n = (dev: string) => { const d = dev.toUpperCase(); const x = nameOf(d); used.set(d, x); return x; };

  const routine: ForeignRoutine = { name, language: 'il', rungs: [], untranslated: [], origin: { program: name, routine: name } };
  const coilSteps = new Map<string, string[]>(); // OUT device → rung start steps
  let driven: Driven[] = [];
  let rungStep = '', rungComment = '';
  let cur: Cond | null = null;
  let blocks: Cond[] = [];
  let mps: Cond[] = [];
  let afterOutput = false;
  let pulse = 0;

  const flush = () => {
    if (driven.length) {
      const { rungs, failed } = toRungs(driven, rungComment, `${slug(name)}_${rungStep || routine.rungs.length}`);
      routine.rungs.push(...rungs);
      for (const f of failed) routine.untranslated.push(`Step ${rungStep}: ${f.out.type} — condition too complex for a ladder rung`);
    }
    driven = []; cur = null; blocks = []; mps = []; afterOutput = false; rungComment = '';
  };
  const contact = (op: string, a: string): Cond => {
    const d = a.toUpperCase();
    if (d === 'SM400') return op.startsWith('LDI') || op.startsWith('ANI') || op.startsWith('ORI') ? FALSE : TRUE; // always ON
    if (d === 'SM401') return op.startsWith('LDI') || op.startsWith('ANI') || op.startsWith('ORI') ? TRUE : FALSE;
    // First scan, and the 1-second clock (the app's neutral SC7, exported per PLC).
    const addr = d === 'SM402' ? 'S:FS' : d === 'SM412' ? 'SC7' : n(d);
    if (/^(LDP|ANDP|ORP)$/.test(op)) return el({ type: 'RISE', address: addr });
    if (/^(LDF|ANDF|ORF)$/.test(op)) return el({ type: 'FALL', address: addr });
    return el({ type: /^(LDI|ANI|ORI)$/.test(op) ? 'NC' : 'NO', address: addr });
  };
  /** A value: constants as numbers; a timer / counter as its current value. */
  const operand = (a: string) => (/^[KHE]-?[\dA-F.]+$/i.test(a) ? value(a) : /^(T|ST|C)\d+$/i.test(a) ? `${n(a)}.ACC` : n(a));
  const out = (o: LadderOutput) => { driven.push({ cond: cur ?? TRUE, out: o }); afterOutput = true; };
  /** Pulse versions (…P): on the rising edge of the condition, through a one-shot helper bit. */
  const onRise = (o: LadderOutput) => {
    const helper = `${name}_Pulse_${++pulse}`;
    out({ type: 'OUT', address: helper });
    driven.push({ cond: el({ type: 'RISE', address: helper }), out: o });
  };
  const timerPreset = (dev: string, k: string) => {
    // FX5 / Q: T = 100 ms base (OUTH 10 ms); a constant K is in those units.
    const base = 100;
    if (/^K\d+$/i.test(k)) { const ms = Number(k.slice(1)) * base; return ms % 1000 === 0 ? { preset: String(ms / 1000), unit: 'sec' as const } : { preset: String(ms), unit: 'ms' as const }; }
    notes.push(`${dev}: the preset comes from ${k} in 0.1 s units; the app reads it as seconds. Check the value.`);
    return { preset: n(k), unit: 'sec' as const };
  };

  for (const ins of list) {
    const { op, args } = ins;
    if (ins.comment && ins.step) { if (driven.length || cur) flush(); rungComment = ins.comment; rungStep = ins.step; }
    if (op === 'END' || op === 'FEND') break;
    if (op === 'NOP') continue;
    const cmp = /^(LD|AND|OR)(<>|<=|>=|=|<|>)(D|E)?$/.exec(op);
    if (/^(LD|LDI|LDP|LDF)$/.test(op) || (cmp && cmp[1] === 'LD')) {
      if (afterOutput && !mps.length) flush();
      if (!rungStep || (!driven.length && !cur)) rungStep = ins.step || rungStep;
      if (cur) blocks.push(cur);
      cur = cmp ? el({ type: 'CMP', left: operand(args[0]), op: CMP[cmp[2]], right: operand(args[1]) }) : contact(op, args[0]);
      afterOutput = false;
      continue;
    }
    if (/^(AND|ANI|ANDP|ANDF)$/.test(op) || (cmp && cmp[1] === 'AND')) {
      const x = cmp ? el({ type: 'CMP', left: operand(args[0]), op: CMP[cmp[2]], right: operand(args[1]) }) : contact(op, args[0]);
      cur = cur ? and(cur, x) : x;
      continue;
    }
    if (/^(OR|ORI|ORP|ORF)$/.test(op) || (cmp && cmp[1] === 'OR')) {
      const x = cmp ? el({ type: 'CMP', left: operand(args[0]), op: CMP[cmp[2]], right: operand(args[1]) }) : contact(op, args[0]);
      cur = cur ? or(cur, x) : x;
      continue;
    }
    switch (op) {
      case 'ANB': { const a = blocks.pop(); cur = a && cur ? and(a, cur) : cur ?? a ?? TRUE; continue; }
      case 'ORB': { const a = blocks.pop(); cur = a && cur ? or(a, cur) : cur ?? a ?? TRUE; continue; }
      case 'MPS': mps.push(cur ?? TRUE); continue;
      case 'MRD': cur = mps[mps.length - 1] ?? cur; continue;
      case 'MPP': cur = mps.pop() ?? cur; continue;
      case 'INV': cur = not(cur ?? TRUE); continue;
      case 'OUT': case 'OUTH': {
        const dev = args[0].toUpperCase();
        if (/^(T|ST)\d+$/.test(dev) && args[1]) {
          const p = op === 'OUTH' && /^K\d+$/i.test(args[1]) ? { preset: String(Number(args[1].slice(1)) * 10), unit: 'ms' as const } : timerPreset(dev, args[1]);
          out({ type: 'TMR', address: n(dev), mode: 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: dev.startsWith('ST'), resetAddress: null });
        } else if (/^C\d+$/.test(dev) && args[1]) out({ type: 'CNT', address: n(dev), direction: 'UP', preset: operand(args[1]), resetAddress: null });
        else {
          coilSteps.set(dev, [...(coilSteps.get(dev) ?? []), rungStep]);
          out({ type: 'OUT', address: n(dev) });
        }
        continue;
      }
      case 'SET': out({ type: 'SET', address: n(args[0]) }); continue;
      case 'RST': out({ type: 'RST', address: n(args[0]) }); continue;
      case 'PLS': onRise({ type: 'OUT', address: n(args[0]) }); continue;
      case 'PLF': {
        const helper = `${name}_Pulse_${++pulse}`;
        out({ type: 'OUT', address: helper });
        driven.push({ cond: el({ type: 'FALL', address: helper }), out: { type: 'OUT', address: n(args[0]) } });
        continue;
      }
      case 'MOV': case 'DMOV': case 'EMOV': out({ type: 'COPY', source: operand(args[0]), dest: n(args[1]) }); continue;
      case 'MOVP': case 'DMOVP': onRise({ type: 'COPY', source: operand(args[0]), dest: n(args[1]) }); continue;
      case 'INC': case 'DINC': out({ type: 'MATH', dest: n(args[0]), expression: `${n(args[0])} + 1` }); continue;
      case 'INCP': case 'DINCP': onRise({ type: 'MATH', dest: n(args[0]), expression: `${n(args[0])} + 1` }); continue;
      case 'DEC': case 'DDEC': out({ type: 'MATH', dest: n(args[0]), expression: `${n(args[0])} - 1` }); continue;
      case 'DECP': case 'DDECP': onRise({ type: 'MATH', dest: n(args[0]), expression: `${n(args[0])} - 1` }); continue;
      case '+': case '-': case '*': case '/': case 'D+': case 'D-': case 'D*': case 'D/': {
        const o = op.replace(/^D/, '');
        const [a, b, d] = args.length >= 3 ? args : [args[1], args[0], args[1]]; // "+ s d" = d := d + s
        out({ type: 'MATH', dest: n(d), expression: `${operand(a)} ${o} ${operand(b)}` });
        continue;
      }
      default:
        // An instruction the ladder model has no form for: kept as written, in place.
        out({ type: 'RAW', vendor: VENDOR, text: [op, ...args].join(' ') });
    }
  }
  flush();

  for (const [dev, steps] of coilSteps) {
    if (steps.length < 2) continue;
    notes.push(`Double coil: ${nameOf(dev)} (${dev}) is switched by OUT in ${steps.length} rungs (steps ${steps.join(' and ')}); only the last one counts, so the earlier rung${steps.length > 2 ? 's have' : ' has'} no effect on the output.`);
  }
  const tags: ForeignTag[] = [];
  const devices = new Set([...used.keys(), ...comments.keys()]);
  for (const d of devices) {
    const m = /^([A-Z]+)(\d+)$/.exec(d);
    if (!m) continue;
    const c = comments.get(d);
    const pre = m[1];
    const dataType = pre === 'T' || pre === 'ST' ? 'TIMER' : pre === 'C' ? 'COUNTER' : pre === 'D' || pre === 'W' || pre === 'R' ? 'INT' : 'BOOL';
    if (!used.has(d) && pre !== 'X' && pre !== 'Y') continue;
    tags.push({ name: used.get(d) ?? nameOf(d), dataType, comment: c?.comment ?? '', address: d, ...(pre === 'X' ? { io: 'input' as const } : pre === 'Y' ? { io: 'output' as const } : {}) });
  }
  if (!commentText) notes.push('No device comment file: add the device comment CSV (GX Works: Device Comment › Export to CSV) so the I/O gets its names and descriptions.');
  return { format: 'mitsubishi-csv', vendor: 'Mitsubishi', controller: module, projectName: name, tags, routines: [routine], notes };
}

