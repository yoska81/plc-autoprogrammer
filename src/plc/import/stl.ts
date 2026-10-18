/**
 * Siemens STL / AWL source (STEP 7 "Generate source", TIA Portal external source): blocks
 * (ORGANIZATION_BLOCK / FUNCTION_BLOCK / FUNCTION … BEGIN … END_…), networks (NETWORK / TITLE =), one
 * instruction per line. Each network is run through the RLO the way the CPU evaluates it:
 *   A / AN / O / ON / X / XN (and the German U / UN), O on its own line (OR of AND chains), A( … ) nesting,
 *   NOT, SET / CLR, FP / FN edges, = / S / R, L … T (copy), L … L … +I / -I / *I / /I … T (math),
 *   L … L … ==I / <>I / >I / >=I / <I / <=I (also R and D) compares, S5 timers SD / SF / SS (L S5T#…),
 *   counters CU / CD (a network that loads a counter, S C…, is kept whole).
 * A network with jumps, calls or anything else the ladder model has no form for is kept whole as written
 * (RAW, vendor 'siemens-stl'). Addresses: I / Q / M (E / A in German), "symbols", DB accesses as names.
 */
import { and, el, not, or, toRungs, TRUE, FALSE, type Cond, type Driven } from './cond';
import { slug } from './l5x';
import { iecIo } from './plcopen';
import { stVariables } from './stSource';
import type { CompareOp, LadderOutput, Rung } from '../core/ladder';
import type { ForeignProgram, ForeignRoutine, ForeignTag } from './types';

const VENDOR = 'siemens-stl';

export const isStlSource = (text: string) => /\bNETWORK\b/i.test(text) && /^\s*(A|AN|U|UN|O|ON)\s+\S/im.test(text) && /^\s*(=|S|R)\s+\S/im.test(text);

/** "I 0.0" / "E 0.0" / "%I0.0" → "%IX0.0"; "Q 4.1" / "A 4.1" → "%QX4.1"; "M 10.0" → "M10.0"; '"Start_PB"' → Start_PB. */
export function stlOperand(raw: string): string {
  const s = raw.trim().replace(/^#/, '');
  const q = /^"([^"]+)"(\..*)?$/.exec(s);
  if (q) return q[1] + (q[2] ?? '');
  const m = /^%?([IEQAM])\s*([BWD]?)\s*(\d+)(?:\.(\d))?$/i.exec(s);
  if (m) {
    const area = { I: 'I', E: 'I', Q: 'Q', A: 'Q', M: 'M' }[m[1].toUpperCase() as 'I'];
    if (area === 'M') return `M${m[2].toUpperCase()}${m[3]}${m[4] !== undefined ? `.${m[4]}` : ''}`;
    return m[4] !== undefined ? `%${area}X${m[3]}.${m[4]}` : `%${area}${m[2].toUpperCase() || 'W'}${m[3]}`;
  }
  return s.replace(/\s+/g, '');
}

const CMP: Record<string, CompareOp> = { '==': '==', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };

/** S5TIME constant → preset + unit: S5T#2S500MS → 2500 ms; S5T#3M → 3 min. */
function s5t(v: string): { preset: string; unit: 'ms' | 'sec' | 'min' } | null {
  const m = /^S5T(?:IME)?#((?:\d+H)?(?:\d+M(?!S))?(?:\d+S)?(?:\d+MS)?)$/i.exec(v.trim());
  if (!m) return null;
  const UNIT: Record<string, number> = { H: 3_600_000, M: 60_000, S: 1000, MS: 1 };
  let ms = 0;
  for (const t of m[1].toUpperCase().matchAll(/(\d+)(MS|H|M|S)/g)) ms += Number(t[1]) * UNIT[t[2]];
  if (ms % 60_000 === 0 && ms >= 60_000) return { preset: String(ms / 60_000), unit: 'min' };
  if (ms % 1000 === 0) return { preset: String(ms / 1000), unit: 'sec' };
  return { preset: String(ms), unit: 'ms' };
}

interface Level { orTerms: Cond[]; chain: Cond | null; op: string }

/** One network → outputs with their conditions; null = kept whole (something the ladder can't hold). */
export function convertStlNetwork(lines: string[]): Driven[] | null {
  const driven: Driven[] = [];
  const stack: Level[] = [];
  let lv: Level = { orTerms: [], chain: null, op: '' };
  let first = true; // the next logic instruction starts a new AND chain
  let fresh = true; // …and a new logic operation (start of the network, or after an assignment)
  const loads: string[] = [];
  let pendingMath: string | null = null;
  const rlo = (): Cond => (lv.orTerms.length ? or(...lv.orTerms, ...(lv.chain ? [lv.chain] : [])) : lv.chain ?? TRUE);
  const logic = (op: string, x: Cond) => {
    const v = op === 'AN' || op === 'ON' || op === 'XN' ? not(x) : x;
    // After an assignment the next logic instruction starts a new operation (first check).
    if (fresh) { lv = { orTerms: [], chain: v, op: lv.op }; first = false; fresh = false; return; }
    if (first) { lv.chain = v; first = false; return; }
    if (op === 'O' || op === 'ON') { if (lv.chain) lv.orTerms.push(lv.chain); lv.chain = v; return; }
    if (op === 'X' || op === 'XN') { const a = rlo(); lv = { orTerms: [], chain: or(and(a, not(v)), and(not(a), v)), op: lv.op }; return; }
    lv.chain = lv.chain ? and(lv.chain, v) : v;
  };

  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '').trim().replace(/;\s*$/, '');
    if (!line) continue;
    const m = /^(\)|[A-Z=+\-*/<>]+[A-Z]?\(?|=)\s*(.*)$/i.exec(line);
    if (!m) return null;
    let op = m[1].toUpperCase();
    const arg = m[2].trim();
    op = op === 'U' ? 'A' : op === 'UN' ? 'AN' : op === 'U(' ? 'A(' : op === 'UN(' ? 'AN(' : op;
    if (/^(A|AN|O|ON|X|XN)\($/.test(op) || (/^(A|AN|O|ON|X|XN)$/.test(op) && arg === '(')) {
      if (fresh) { lv = { orTerms: [], chain: null, op: lv.op }; fresh = false; }
      stack.push(lv);
      lv = { orTerms: [], chain: null, op: op.replace('(', '') };
      first = true;
      continue;
    }
    if (op === ')') {
      const inner = rlo();
      const outer = stack.pop();
      if (!outer) return null;
      const kind = lv.op;
      lv = outer;
      first = lv.chain === null && !lv.orTerms.length;
      logic(kind, inner);
      continue;
    }
    if (/^(A|AN|O|ON|X|XN)$/.test(op)) {
      if (op === 'O' && !arg) { if (lv.chain) lv.orTerms.push(lv.chain); lv.chain = null; first = true; continue; }
      const t = /^T\s*\d+$/i.test(arg) || /^C\s*\d+$/i.test(arg) ? arg.replace(/\s+/g, '').toUpperCase() : stlOperand(arg);
      logic(op, el({ type: 'NO', address: t }));
      continue;
    }
    switch (op) {
      case 'NOT': lv = { orTerms: [], chain: not(rlo()), op: lv.op }; continue;
      case 'SET': lv = { orTerms: [], chain: TRUE, op: lv.op }; first = false; fresh = false; continue;
      case 'CLR': lv = { orTerms: [], chain: FALSE, op: lv.op }; first = false; fresh = false; continue;
      case 'FP': case 'FN': {
        // Edge of the RLO so far: kept exact only when it is one contact.
        const c = rlo();
        if (c.k !== 'el' || c.el.type !== 'NO') return null;
        lv = { orTerms: [], chain: el({ type: op === 'FP' ? 'RISE' : 'FALL', address: c.el.address }), op: lv.op };
        continue;
      }
      case '=': case 'S': case 'R': {
        const t = arg.replace(/\s+/g, '').toUpperCase();
        const c = stack.length ? null : rlo();
        if (!c) return null;
        // S C1 loads the counter with a value (not a reset): no ladder form, the network is kept whole.
        if (op === 'S' && /^C\d+$/.test(t)) return null;
        const out: LadderOutput = op === '=' ? { type: 'OUT', address: stlOperand(arg) } : op === 'S' ? { type: 'SET', address: /^T\d+$/.test(t) ? t : stlOperand(arg) } : { type: 'RST', address: /^[TC]\d+$/.test(t) ? t : stlOperand(arg) };
        driven.push({ cond: c, out });
        first = true; fresh = true;
        continue;
      }
      case 'SD': case 'SF': case 'SS': {
        const p = s5t(loads[loads.length - 1] ?? '');
        if (!p) return null;
        driven.push({ cond: rlo(), out: { type: 'TMR', address: arg.replace(/\s+/g, '').toUpperCase(), mode: op === 'SF' ? 'OFF_DELAY' : 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: op === 'SS', resetAddress: null } });
        first = true; fresh = true;
        continue;
      }
      case 'CU': case 'CD': {
        const t = arg.replace(/\s+/g, '').toUpperCase();
        const existing = driven.find((d) => d.out.type === 'CNT' && d.out.address === t);
        if (existing) return null; // CU and CD on one counter: kept whole
        driven.push({ cond: rlo(), out: { type: 'CNT', address: t, direction: op === 'CD' ? 'DOWN' : 'UP', preset: '0', resetAddress: null } });
        first = true; fresh = true;
        continue;
      }
      case 'L': loads.push(/^(S5T|C)#|^[-\d.]/i.test(arg) ? arg : stlOperand(arg)); continue;
      case 'T': {
        // L … T …: unconditional copy (math when an arithmetic instruction came in between).
        const dest = stlOperand(arg);
        const src = pendingMath ?? (loads.length ? value(loads[loads.length - 1]) : null);
        if (!src) return null;
        driven.push({ cond: TRUE, out: pendingMath ? { type: 'MATH', dest, expression: pendingMath } : { type: 'COPY', source: src, dest } });
        pendingMath = null;
        continue;
      }
      default: {
        const cmp = /^(==|<>|>=|<=|>|<)([IDR])$/.exec(op);
        if (cmp && loads.length >= 2) {
          logic('A', el({ type: 'CMP', left: value(loads[loads.length - 2]), op: CMP[cmp[1]], right: value(loads[loads.length - 1]) }));
          continue;
        }
        const ar = /^([+\-*/])([IDR])$/.exec(op);
        if (ar && loads.length >= 2) { pendingMath = `${value(loads[loads.length - 2])} ${ar[1]} ${value(loads[loads.length - 1])}`; continue; }
        return null; // jumps, calls, accumulator tricks…: the whole network is kept
      }
    }
  }
  return driven;
}

const value = (v: string) => v.replace(/^[+]/, '').replace(/^L#/, '');

/** STL source → program (blocks → routines, networks → rungs). */
export function readStlSource(input: string): ForeignProgram {
  // Windows exports are CRLF: read as LF lines.
  const src = input.replace(/\r\n?/g, '\n');
  const text = src.replace(/\r\n?/g, '\n');
  const tags: ForeignTag[] = stVariables(text);
  const routines: ForeignRoutine[] = [];
  const notes: string[] = [];
  const BLOCK = /(ORGANIZATION_BLOCK|FUNCTION_BLOCK|FUNCTION)\s+("?)([^"\s:]+)\2[^\n]*\n([\s\S]*?)\n\s*END_(ORGANIZATION_BLOCK|FUNCTION_BLOCK|FUNCTION)/gi;
  const operands = new Set<string>();
  for (const b of text.matchAll(BLOCK)) {
    const name = b[3];
    const begin = /\bBEGIN\b/i.exec(b[4]);
    const body = begin ? b[4].slice(begin.index + 5) : b[4];
    const routine: ForeignRoutine = { name, language: 'il', rungs: [], untranslated: [], rungNumbers: {} };
    const nets = body.split(/^\s*NETWORK\s*$/im).slice(1);
    nets.forEach((net, i) => {
      const title = /^\s*TITLE\s*=\s*(.*)$/im.exec(net)?.[1]?.trim() ?? '';
      const lines = net.split('\n').filter((l) => !/^\s*(TITLE\s*=|\/\/)/i.test(l));
      const code = lines.map((l) => l.trim()).filter(Boolean);
      if (!code.length) return;
      const driven = convertStlNetwork(code);
      const id = `${slug(name)}_${i + 1}`;
      let rungs: Rung[] = [];
      if (driven) {
        const r = toRungs(driven, title, id);
        rungs = r.failed.length ? [] : r.rungs;
      }
      if (!rungs.length) rungs = [{ id, comment: title, branches: [], outputs: [{ type: 'RAW', vendor: VENDOR, text: code.join('\n') }] }];
      for (const g of rungs) { routine.rungs.push(g); routine.rungNumbers![g.id] = String(i + 1); }
      for (const g of rungs) for (const x of [...g.branches.flat(), ...g.outputs]) {
        if ('address' in x) operands.add(x.address);
        if (x.type === 'CMP') { operands.add(x.left); operands.add(x.right); }
      }
    });
    routines.push(routine);
  }
  // Operands with I / Q addresses are the I/O (the PLC tag table names them, when added).
  for (const o of operands) {
    if (!/^%[IQ]/.test(o) || tags.some((t) => t.name === o)) continue;
    tags.push({ name: o, dataType: /X/.test(o) ? 'BOOL' : 'INT', comment: '', address: o, ...iecIo(o) });
  }
  if (!tags.some((t) => t.io)) notes.push('The STL source names symbols but not their addresses: add the PLC tag table (PLC tags › Export) to know which are inputs and outputs.');
  return { format: 'siemens-stl', vendor: 'Siemens', controller: '', projectName: routines[0]?.name ?? 'Imported program', tags, routines, notes };
}
