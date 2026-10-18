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
export function gxComments(input: string): Map<string, { tag: string; comment: string }> {
  const text = input.replace(/\r\n?/g, '\n');
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

export interface Instr { step: string; comment: string; op: string; args: string[] }

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

export function readGxCsv(programInput: string, commentText = ''): ForeignProgram {
  const programText = programInput.replace(/\r\n?/g, '\n');
  return runIl(instructions(gxRows(programText)), commentText ? gxComments(commentText) : null, {
    format: 'mitsubishi-csv', vendor: 'Mitsubishi', raw: VENDOR,
    noComments: 'No device comment file: add the device comment CSV (GX Works: Device Comment › Export to CSV) so the I/O gets its names and descriptions.',
  });
}

export interface IlBrand {
  format: ForeignProgram['format'];
  vendor: string;
  /** Vendor id of instructions kept as written (RAW). */
  raw: string;
  /** Note when there is no device comment file. */
  noComments: string;
}

/**
 * Instruction list (Mitsubishi / Delta / Inovance / Xinje, the same LD / AND / OR / ANB / ORB / MPS family)
 * → rungs. `comments`: device → tag name and comment.
 */
export function runIl(prog: { name: string; module: string; list: Instr[] }, commentsIn: Map<string, { tag: string; comment: string }> | null, brand: IlBrand): ForeignProgram {
  const { name, module, list } = prog;
  const comments = commentsIn ?? new Map<string, { tag: string; comment: string }>();
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
  // The rung's instructions as written; any one the reader doesn't know keeps the whole rung as written.
  let lines: string[] = [];
  let opaque = false;

  const flush = () => {
    const id = `${slug(name)}_${rungStep || routine.rungs.length}`;
    const whole = () => routine.rungs.push({ id, comment: rungComment, branches: [], outputs: [{ type: 'RAW', vendor: brand.raw, text: lines.join('\n') }] });
    if (opaque && lines.length) whole();
    else if (driven.length) {
      // A condition with more branches than a ladder rung holds: the whole rung kept as written.
      const { rungs, failed } = toRungs(driven, rungComment, id);
      if (failed.length && lines.length) whole();
      else {
        routine.rungs.push(...rungs);
        for (const f of failed) routine.untranslated.push(`Step ${rungStep}: ${f.out.type} — condition too complex for a ladder rung`);
      }
    }
    driven = []; cur = null; blocks = []; mps = []; afterOutput = false; rungComment = ''; lines = []; opaque = false;
  };
  /**
   * An LD after an output starts a new rung unless the instructions up to the next output combine it with
   * the condition before it (MPP … LD X2 OR X3 ANB … OUT: the ANB needs the condition MPP restored).
   */
  const continues = (from: number) => {
    let depth = 0;
    for (let j = from; j < list.length; j++) {
      const o = list[j].op;
      if (/^(LD|LDI|LDP|LDF)$/.test(o) || /^D?LD[DE]?(<>|<=|>=|=|<|>)(D|E)?$/.test(o)) depth++;
      else if (o === 'ANB' || o === 'ORB') { if (--depth <= 0) return true; }
      else if (!/^(AND|ANI|ANDP|ANDF|OR|ORI|ORP|ORF|MPS|MRD|MPP|INV)$/.test(o) && !/^D?(AND|OR)[DE]?(<>|<=|>=|=|<|>)(D|E)?$/.test(o)) return false;
    }
    return false;
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
  /**
   * Timer time base and retention by brand, series and timer number (the manuals' device tables):
   *   Delta DVP     T0–199 100 ms · T200–239 10 ms · T240–245 10 ms retentive · T246–249 1 ms retentive · T250–255 100 ms retentive
   *   FX1 / FX2 / FX3 and Inovance H1U–H3U (FX3U-compatible)
   *                 T0–199 100 ms · T200–245 10 ms · T246–249 1 ms retentive · T250–255 100 ms retentive · T256–511 1 ms
   *   Xinje XC / XD T0–99 100 ms · T100–199 100 ms retentive · T200–299 10 ms · T300–399 10 ms retentive · T400–499 1 ms · T500+ 1 ms retentive
   *   FX5 (iQ-F)    the instruction sets it: OUT 100 ms, OUTH 10 ms, OUTHS 1 ms; ST timers are retentive
   * A series the file does not name: 100 ms, with a note on each timer to confirm it.
   */
  const timerBases: string[] = [];
  const unsure: string[] = [];
  const fx5 = /FX5|iQ-?F/i.test(module);
  const fx3 = /FX[123]|FX3/i.test(module);
  const timerBase = (dev: string, op = 'OUT'): { ms: number; retentive: boolean } => {
    const k = Number(dev.replace(/\D/g, ''));
    const st = /^ST/i.test(dev);
    const v = brand.vendor;
    const R = (ms: number, retentive = false) => ({ ms, retentive });
    let r = R(100, st);
    if (op === 'OUTH' || op === 'TMRH') r = R(10, st);
    else if (op === 'OUTHS') r = R(1, st);
    else if (v === 'Xinje') r = k < 100 ? R(100) : k < 200 ? R(100, true) : k < 300 ? R(10) : k < 400 ? R(10, true) : k < 500 ? R(1) : R(1, true);
    else if (v === 'Delta') {
      if (k >= 256) unsure.push(dev);
      r = k < 200 ? R(100) : k < 240 ? R(10) : k < 246 ? R(10, true) : k < 250 ? R(1, true) : R(100, true);
    } else if (v === 'Inovance' || (v === 'Mitsubishi' && fx3 && !fx5)) r = k < 200 ? R(100) : k < 246 ? R(10) : k < 250 ? R(1, true) : k < 256 ? R(100, true) : R(1);
    else if (!(v === 'Mitsubishi' && fx5)) unsure.push(dev);
    if (r.ms !== 100 || r.retentive) timerBases.push(`${dev} ${r.ms} ms${r.retentive ? ', retentive' : ''}`);
    return r;
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
  const timerPreset = (dev: string, k: string, base: number) => {
    // A constant K counts in the timer's base (100 / 10 / 1 ms).
    if (/^K\d+$/i.test(k)) { const ms = Number(k.slice(1)) * base; return ms % 1000 === 0 ? { preset: String(ms / 1000), unit: 'sec' as const } : { preset: String(ms), unit: 'ms' as const }; }
    notes.push(`${dev}: the preset comes from ${k} in ${base} ms units; the app reads it as ${base === 1 ? 'ms' : 'seconds'}. Check the value.`);
    return { preset: n(k), unit: base === 1 ? 'ms' as const : 'sec' as const };
  };

  for (const [idx, ins] of list.entries()) {
    const { op, args } = ins;
    if (ins.comment && ins.step) { if (driven.length || cur || lines.length) flush(); rungComment = ins.comment; rungStep = ins.step; }
    if (op === 'END' || op === 'FEND') break;
    if (op === 'NOP') continue;
    // 16 / 32-bit and float compares: LD= / LDD= / DLD= / LD=D / LDE=.
    const cmp = /^D?(LD|AND|OR)[DE]?(<>|<=|>=|=|<|>)(D|E)?$/.exec(op);
    if (/^(LD|LDI|LDP|LDF)$/.test(op) || (cmp && cmp[1] === 'LD')) {
      if (afterOutput && !mps.length && !continues(idx)) flush();
    }
    lines.push([op, ...args].join(' '));
    if (/^(LD|LDI|LDP|LDF)$/.test(op) || (cmp && cmp[1] === 'LD')) {
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
      case 'OUT': case 'OUTH': case 'OUTHS': {
        const dev = args[0].toUpperCase();
        if (/^(T|ST)\d+$/.test(dev) && args[1]) {
          const b = timerBase(dev, op);
          const p = timerPreset(dev, args[1], b.ms);
          out({ type: 'TMR', address: n(dev), mode: 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: b.retentive, resetAddress: null });
        } else if (/^C\d+$/.test(dev) && args[1]) out({ type: 'CNT', address: n(dev), direction: 'UP', preset: operand(args[1]), resetAddress: null });
        else {
          coilSteps.set(dev, [...(coilSteps.get(dev) ?? []), rungStep]);
          out({ type: 'OUT', address: n(dev) });
        }
        continue;
      }
      case 'TMR': case 'TMRH': { // Delta: TMR T0 K50 (100 ms timers; TMRH 10 ms)
        const dev = args[0].toUpperCase();
        const b = timerBase(dev, op);
        const p = timerPreset(dev, args[1] ?? 'K0', b.ms);
        out({ type: 'TMR', address: n(dev), mode: 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: b.retentive, resetAddress: null });
        continue;
      }
      case 'CNT': out({ type: 'CNT', address: n(args[0]), direction: 'UP', preset: operand(args[1] ?? 'K0'), resetAddress: null }); continue;
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
        // An instruction the reader doesn't know: the whole rung is kept as written (nothing dropped or changed).
        opaque = true;
        afterOutput = true;
    }
  }
  flush();
  if (unsure.length) notes.push(`The file does not say which ${brand.vendor} series this is, so these timers were read as 100 ms timers: ${[...new Set(unsure)].join(', ')}. Confirm each timer's time base (it decides the delay) and change the preset if it differs.`);
  if (timerBases.length) notes.push(`Timer time bases (${brand.vendor}${module ? ` ${module}` : ''}): ${timerBases.join('; ')}. Presets were converted with them; check them against the PLC.`);

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
    // X / Y are octal on these PLCs: X8, X19 are not terminals (a typo in the export or the program).
    if ((pre === 'X' || pre === 'Y') && /[89]/.test(m[2])) {
      notes.push(`${d} is not a valid ${pre === 'X' ? 'input' : 'output'} address (X / Y are numbered in octal: …7, 10, 11…); it is treated as an internal bit. Check the program.`);
      tags.push({ name: used.get(d) ?? nameOf(d), dataType, comment: c?.comment ?? '', address: d });
      continue;
    }
    tags.push({ name: used.get(d) ?? nameOf(d), dataType, comment: c?.comment ?? '', address: d, ...(pre === 'X' ? { io: 'input' as const } : pre === 'Y' ? { io: 'output' as const } : {}) });
  }
  if (!commentsIn) notes.push(brand.noComments);
  return { format: brand.format, vendor: brand.vendor, controller: module, projectName: name, tags, routines: [routine], notes };
}


// ── Instruction list as text (Delta ISPSoft / WPLSoft, Inovance AutoShop, Xinje XDPPro, GX Developer) ──

const IL_OP = /^(LD|LDI|LDP|LDF|AND|ANI|ANDP|ANDF|OR|ORI|ORP|ORF|ANB|ORB|MPS|MRD|MPP|INV|OUT|SET|RST|PLS|PLF|TMR|CNT|MOV|END|NOP|LD[=<>]+|AND[=<>]+|OR[=<>]+)\b/i;

/** A plain-text instruction list: most lines are "[step] INSTRUCTION operands". */
export function isIlText(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*\d+\s+/, '').trim()).filter((l) => l && !/^(;|\/\/|\*|\(\*)/.test(l));
  if (lines.length < 3) return false;
  return lines.filter((l) => IL_OP.test(l)).length / lines.length >= 0.7 && lines.some((l) => /^(OUT|SET|TMR)\b/i.test(l));
}

/** Brand of an instruction-list text from its header / instructions. */
export function ilBrand(text: string): IlBrand {
  const head = text.slice(0, 3000);
  const note = (where: string) => `No device comment file: add the device comments (${where}) so the I/O gets its names and descriptions.`;
  if (/ISPSoft|WPLSoft|DIADesigner|\bDVP|\bAS\d{3}|Delta/i.test(head) || /^\s*(\d+\s+)?TMR\b/im.test(text)) return { format: 'il-text', vendor: 'Delta', raw: 'delta', noComments: note('ISPSoft: Device Comment › Export') };
  if (/AutoShop|Inovance|\bH[1-5]U\b|\bEasy\d/i.test(head)) return { format: 'il-text', vendor: 'Inovance', raw: 'inovance', noComments: note('AutoShop: Comment › Export') };
  if (/Xinje|XDPPro|XCPPro|\bX[CDL]\d\b/i.test(head)) return { format: 'il-text', vendor: 'Xinje', raw: 'xinje', noComments: note('XDPPro: Comment › Export') };
  return { format: 'il-text', vendor: 'Mitsubishi-style PLC', raw: VENDOR, noComments: note('the device comment list') };
}

/** Lines "[step] INSTR op op ; comment"; "; text" / "// text" / "* text" lines are the next rung's comment. */
export function ilInstructions(text: string): { name: string; module: string; list: Instr[] } {
  const list: Instr[] = [];
  let pending = '', step = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const c = /^(?:;|\/\/|\*|\(\*)\s*(.*?)\s*(?:\*\))?$/.exec(line);
    if (c) { pending = c[1]; continue; }
    const m = /^(?:(\d+)\s+)?([A-Z][A-Z0-9]*(?:[=<>]+[A-Z]?)?|[+\-*/])\s*(.*?)\s*(?:(?:;|\/\/)\s*(.*))?$/i.exec(line);
    if (!m) {
      // Not an instruction the pattern knows (LD&, LD|…): kept, so the rung it is in stays as written.
      const t = line.replace(/^\d+\s+/, '').split(/\s+/);
      list.push({ step: String(step++), comment: pending, op: t[0].toUpperCase(), args: t.slice(1) });
      pending = '';
      continue;
    }
    const st = m[1] ?? String(step);
    step = Number(st) + 1;
    list.push({ step: st, comment: pending, op: m[2].toUpperCase(), args: m[3] ? m[3].split(/[\s,]+/).filter(Boolean) : [] });
    pending = '';
  }
  return { name: 'MAIN', module: '', list };
}

/** Device comments as a list: "X0  Start_PB: Start pushbutton" (tab, comma or spaces); a header row is skipped. */
export function ilComments(input: string): Map<string, { tag: string; comment: string }> {
  const text = input.replace(/\r\n?/g, '\n');
  const out = new Map<string, { tag: string; comment: string }>();
  for (const r of gxRows(text.replace(/^([A-Z]+\d+)[ ]{2,}/gm, '$1\t'))) {
    const dev = (r[0] ?? '').toUpperCase();
    if (!/^[A-Z]{1,3}\d+$/.test(dev)) continue;
    const rest = r.slice(1).filter(Boolean);
    if (!rest.length) continue;
    // "Tag", "Comment" in two columns, or "Tag: comment" in one.
    if (rest.length >= 2 && isTagName(rest[0])) { out.set(dev, { tag: rest[0], comment: rest.slice(1).join(' ') }); continue; }
    const m = /^([A-Za-z_]\w*)\s*:\s*(.*)$/.exec(rest[0]);
    out.set(dev, m && isTagName(m[1]) ? { tag: m[1], comment: m[2] } : { tag: '', comment: rest.join(' ') });
  }
  return out;
}

export const isIlComments = (text: string) => !isIlText(text) && ilComments(text).size >= 2;

export function readIlText(programInput: string, commentText = ''): ForeignProgram {
  const programText = programInput.replace(/\r\n?/g, '\n');
  const brand = ilBrand(programText);
  const prog = ilInstructions(programText);
  const header = /(?:PLC|CPU|Model)\s*[:=]\s*(\S+)/i.exec(programText.slice(0, 2000));
  return runIl({ ...prog, module: header?.[1] ?? '' }, commentText ? ilComments(commentText) : null, brand);
}
