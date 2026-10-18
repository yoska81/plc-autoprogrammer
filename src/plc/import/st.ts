/**
 * IEC 61131-3 Structured Text (Logix ST routines, PLCopen ST bodies, Siemens SCL, Micro800 / CODESYS
 * ST) → ladder rungs. The subset real machine programs are mostly made of:
 *   x := <boolean>;            → OUT x (inside IF: SET / RST)
 *   x := TRUE / FALSE;         → SET / RST
 *   n := <number or formula>;  → COPY / MATH
 *   IF … ELSIF … ELSE … END_IF; CASE step OF 10: … 20, 30: … 40..50: … ELSE … END_CASE;
 *   Tmr(IN := …, PT := T#5S);  "Tmr".TON(…)  (TON / TOF), Cnt(CU := …, R := …, PV := 10) (CTU / CTD),
 *   Trig(CLK := x) then Trig.Q (R_TRIG / F_TRIG → edge contacts).
 * Everything else (loops, other function blocks, pointer access) is returned untranslated with its text.
 */
import type { CompareOp, LadderOutput, Rung } from '../core/ladder';
import { and, el, FALSE, not, or, toRungs, TRUE, type Cond, type Driven } from './cond';
import { msPreset } from './logixText';

type Tok = { t: 'id' | 'num' | 'time' | 'str' | 'op' | 'kw'; v: string; pos: number };

const KW = new Set(['IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'OF', 'END_CASE', 'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT', 'RETURN', 'EXIT', 'AND', 'OR', 'XOR', 'NOT', 'MOD', 'TRUE', 'FALSE']);

/** "T#1m30s500ms" → milliseconds. */
export function timeMs(lit: string): number | null {
  const body = lit.replace(/^(T|TIME|LT|LTIME)#/i, '').replace(/_/g, '');
  const re = /(-?\d+(?:\.\d+)?)(d|h|ms|m|s|us|ns)/gi;
  let ms = 0, any = false, m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    any = true;
    const n = Number(m[1]);
    ms += n * ({ d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000, ms: 1, us: 0.001, ns: 0.000001 } as Record<string, number>)[m[2].toLowerCase()];
  }
  return any ? Math.round(ms) : null;
}

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('(*', i)) { const e = src.indexOf('*)', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (src.startsWith('//', i)) { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^(?:T|TIME|LT|LTIME)#[\d_.a-z]+/i.exec(rest))) { out.push({ t: 'time', v: m[0], pos: i }); i += m[0].length; continue; }
    if ((m = /^(?:\d+#[0-9A-Fa-f_]+|\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?)/.exec(rest))) { out.push({ t: 'num', v: m[0], pos: i }); i += m[0].length; continue; }
    if ((m = /^"([^"]*)"/.exec(rest))) { out.push({ t: 'id', v: m[1], pos: i }); i += m[0].length; continue; }
    if ((m = /^'([^']*)'/.exec(rest))) { out.push({ t: 'str', v: m[1], pos: i }); i += m[0].length; continue; }
    if ((m = /^%[A-Za-z]+[\d.]+/.exec(rest))) { out.push({ t: 'id', v: m[0], pos: i }); i += m[0].length; continue; }
    if ((m = /^#?[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
      const w = m[0].replace(/^#/, '');
      out.push({ t: KW.has(w.toUpperCase()) && !m[0].startsWith('#') ? 'kw' : 'id', v: KW.has(w.toUpperCase()) && !m[0].startsWith('#') ? w.toUpperCase() : w, pos: i });
      i += m[0].length;
      continue;
    }
    if ((m = /^(:=|=>|<>|<=|>=|\.\.|[-+*/()<>=,;:.[\]&^])/.exec(rest))) { out.push({ t: 'op', v: m[0], pos: i }); i += m[0].length; continue; }
    out.push({ t: 'op', v: c, pos: i }); i++;
  }
  return out;
}

type E =
  | { t: 'lit'; v: string; kind: 'bool' | 'num' }
  | { t: 'var'; name: string }
  | { t: 'un'; op: 'NOT' | '-'; x: E }
  | { t: 'bin'; op: string; a: E; b: E }
  | { t: 'call'; name: string; args: E[] };

class Parser {
  i = 0;
  toks: Tok[];
  src: string;
  constructor(toks: Tok[], src: string) { this.toks = toks; this.src = src; }
  peek(o = 0) { return this.toks[this.i + o]; }
  is(v: string, o = 0) { const t = this.peek(o); return !!t && (t.t === 'op' || t.t === 'kw') && t.v === v; }
  eat(v: string) { if (!this.is(v)) throw new Error(`expected "${v}" near "${this.near()}"`); return this.toks[this.i++]; }
  near() { const t = this.peek(); return t ? this.src.slice(t.pos, t.pos + 30) : 'end'; }

  expr(): E { return this.or(); }
  or(): E { let a = this.xor(); while (this.is('OR')) { this.i++; a = { t: 'bin', op: 'OR', a, b: this.xor() }; } return a; }
  xor(): E { let a = this.and(); while (this.is('XOR')) { this.i++; a = { t: 'bin', op: 'XOR', a, b: this.and() }; } return a; }
  and(): E { let a = this.cmp(); while (this.is('AND') || this.is('&')) { this.i++; a = { t: 'bin', op: 'AND', a, b: this.cmp() }; } return a; }
  cmp(): E {
    let a = this.add();
    while (['=', '<>', '<', '>', '<=', '>='].some((o) => this.is(o))) { const op = this.toks[this.i++].v; a = { t: 'bin', op, a, b: this.add() }; }
    return a;
  }
  add(): E { let a = this.mul(); while (this.is('+') || this.is('-')) { const op = this.toks[this.i++].v; a = { t: 'bin', op, a, b: this.mul() }; } return a; }
  mul(): E { let a = this.unary(); while (this.is('*') || this.is('/') || this.is('MOD')) { const op = this.toks[this.i++].v; a = { t: 'bin', op, a, b: this.unary() }; } return a; }
  unary(): E {
    if (this.is('NOT')) { this.i++; return { t: 'un', op: 'NOT', x: this.unary() }; }
    if (this.is('-')) { this.i++; return { t: 'un', op: '-', x: this.unary() }; }
    return this.primary();
  }
  primary(): E {
    const t = this.peek();
    if (!t) throw new Error('unexpected end');
    if (this.is('(')) { this.i++; const e = this.expr(); this.eat(')'); return e; }
    if (t.t === 'kw' && (t.v === 'TRUE' || t.v === 'FALSE')) { this.i++; return { t: 'lit', v: t.v, kind: 'bool' }; }
    if (t.t === 'num') { this.i++; return { t: 'lit', v: radix(t.v), kind: 'num' }; }
    if (t.t === 'time') { this.i++; const ms = timeMs(t.v); return { t: 'lit', v: ms === null ? t.v : String(ms), kind: 'num' }; }
    if (t.t === 'id') {
      const name = this.name();
      if (this.is('(')) {
        this.i++;
        const args: E[] = [];
        if (!this.is(')')) { do { if (this.peek()?.t === 'id' && (this.is(':=', 1) || this.is('=>', 1))) this.i += 2; args.push(this.expr()); } while (this.is(',') && ++this.i); }
        this.eat(')');
        return { t: 'call', name, args };
      }
      return { t: 'var', name };
    }
    throw new Error(`unexpected "${t.v}" near "${this.near()}"`);
  }
  /** a.b.c, a[1], "DB".x, %I0.0 */
  name(): string {
    let n = this.toks[this.i++].v;
    for (;;) {
      if (this.is('.') && this.peek(1)?.t === 'id') { this.i++; n += `.${this.toks[this.i++].v}`; continue; }
      if (this.is('.') && this.peek(1)?.t === 'num' && /^\d+$/.test(this.peek(1)!.v)) { this.i++; n += `.${this.toks[this.i++].v}`; continue; }
      if (this.is('[')) {
        const start = this.i;
        let depth = 0;
        do { if (this.is('[')) depth++; if (this.is(']')) depth--; this.i++; } while (depth > 0 && this.i < this.toks.length);
        n += this.toks.slice(start, this.i).map((x) => x.v).join('');
        continue;
      }
      return n;
    }
  }
}

const radix = (v: string) => { const m = /^(\d+)#([0-9A-Fa-f_]+)$/.exec(v); return m ? String(parseInt(m[2].replace(/_/g, ''), Number(m[1]))) : v.replace(/_/g, ''); };

const CMP_OP: Record<string, CompareOp> = { '=': '==', '<>': '<>', '<': '<', '>': '>', '<=': '<=', '>=': '>=' };

export interface StOptions {
  /** Declared types by lower-case name (BOOL, INT, REAL, TON, TOF, CTU, CTD, R_TRIG, F_TRIG …). */
  types?: Map<string, string>;
}

export function convertSt(src: string, idBase: string, opts: StOptions = {}): { rungs: Rung[]; untranslated: string[] } {
  const types = opts.types ?? new Map<string, string>();
  const untranslated: string[] = [];
  const driven: Driven[] = [];
  const edges = new Map<string, Cond>(); // R_TRIG / F_TRIG instance → its edge contact
  let p: Parser;
  try { p = new Parser(tokenize(src), src); } catch (e) { return { rungs: [], untranslated: [`${src.slice(0, 200)} (${e instanceof Error ? e.message : e})`] }; }

  const typeOf = (name: string) => types.get(name.toLowerCase())?.toUpperCase() ?? '';
  const isBoolVar = (name: string) => typeOf(name) === 'BOOL' || /\.(Q|DN|EN|TT|CU|CD|OV|UN)$/i.test(name) || /^%[IQM]X?\d+\.\d+$/i.test(name);

  /** Boolean expression → condition; null = not a boolean expression the ladder can draw. */
  function cond(e: E): Cond | null {
    switch (e.t) {
      case 'lit': return e.kind === 'bool' ? (e.v === 'TRUE' ? TRUE : FALSE) : null;
      case 'var': {
        const edge = /\.Q$/i.test(e.name) ? edges.get(e.name.slice(0, -2).toLowerCase()) : undefined;
        return edge ?? el({ type: 'NO', address: e.name });
      }
      case 'un': { if (e.op !== 'NOT') return null; const x = cond(e.x); return x && not(x); }
      case 'bin': {
        if (e.op === 'AND' || e.op === 'OR' || e.op === 'XOR') {
          const a = cond(e.a), b = cond(e.b);
          if (!a || !b) return null;
          if (e.op === 'AND') return and(a, b);
          if (e.op === 'OR') return or(a, b);
          return or(and(a, not(b)), and(not(a), b));
        }
        if (CMP_OP[e.op]) {
          const l = num(e.a), r = num(e.b);
          return l !== null && r !== null ? el({ type: 'CMP', left: l, op: CMP_OP[e.op], right: r }) : null;
        }
        return null;
      }
      case 'call': return null;
    }
  }
  /** Numeric expression → text with the program's names; null = not numeric. */
  function num(e: E): string | null {
    switch (e.t) {
      case 'lit': return e.kind === 'num' ? e.v : null;
      case 'var': return e.name;
      case 'un': { if (e.op !== '-') return null; const x = num(e.x); return x === null ? null : `-${paren(e.x, x)}`; }
      case 'bin': {
        if (!['+', '-', '*', '/', 'MOD'].includes(e.op)) return null;
        const a = num(e.a), b = num(e.b);
        return a === null || b === null ? null : `${paren(e.a, a)} ${e.op === 'MOD' ? 'MOD' : e.op} ${paren(e.b, b)}`;
      }
      case 'call': {
        // Type conversions (INT_TO_REAL(x), REAL_TO_INT(x), DINT(x)) keep the value.
        if (/_TO_|^(INT|DINT|REAL|LREAL|UINT|UDINT|WORD|DWORD)$/i.test(e.name) && e.args.length === 1) return num(e.args[0]);
        return null;
      }
    }
  }
  const paren = (e: E, s: string) => (e.t === 'bin' ? `(${s})` : s);
  const isBoolExpr = (e: E): boolean => (e.t === 'lit' ? e.kind === 'bool' : e.t === 'var' ? isBoolVar(e.name) : e.t === 'un' ? e.op === 'NOT' : e.t === 'bin' ? ['AND', 'OR', 'XOR', '=', '<>', '<', '>', '<=', '>='].includes(e.op) : false);

  const out = (c: Cond, o: LadderOutput) => driven.push({ cond: c, out: o });

  function assign(target: string, e: E, c: Cond, top: boolean, text: string) {
    const boolTarget = isBoolVar(target) || isBoolExpr(e);
    // BOOL := 1 / 0 (allowed in Logix and CODESYS ST).
    if (boolTarget && e.t === 'lit' && e.kind === 'num' && (e.v === '1' || e.v === '0')) e = { t: 'lit', v: e.v === '1' ? 'TRUE' : 'FALSE', kind: 'bool' };
    if (boolTarget) {
      if (e.t === 'lit' && e.kind === 'bool') {
        out(top ? TRUE : c, { type: e.v === 'TRUE' ? 'SET' : 'RST', address: target });
        return;
      }
      const x = cond(e);
      if (!x) { untranslated.push(text); return; }
      if (top) out(x, { type: 'OUT', address: target });
      else { out(and(c, x), { type: 'SET', address: target }); out(and(c, not(x)), { type: 'RST', address: target }); }
      return;
    }
    const v = num(e);
    if (v === null) { untranslated.push(text); return; }
    if (e.t === 'lit' || e.t === 'var') out(c, { type: 'COPY', source: v, dest: target });
    else out(c, { type: 'MATH', dest: target, expression: v });
  }

  function fbCall(inst: string, kind: string, params: Map<string, E>, c: Cond, text: string) {
    const b = (k: string) => { const e = params.get(k); return e ? cond(e) : TRUE; };
    if (kind === 'TON' || kind === 'TOF') {
      const pt = params.get('PT');
      const ptv = pt ? num(pt) : '0';
      const inp = b('IN');
      if (!inp || ptv === null) { untranslated.push(text); return; }
      const pre = /^\d+$/.test(ptv) ? msPreset(ptv) : { preset: ptv, unit: 'ms' as const };
      out(and(c, inp), { type: 'TMR', address: inst, mode: kind === 'TOF' ? 'OFF_DELAY' : 'ON_DELAY', preset: pre.preset, unit: pre.unit, accumulate: false, resetAddress: null });
      return;
    }
    if (kind === 'CTU' || kind === 'CTD') {
      const trig = b(kind === 'CTU' ? 'CU' : 'CD');
      const pv = params.get('PV');
      const pvv = pv ? num(pv) : '0';
      const r = params.get(kind === 'CTU' ? 'R' : 'LD') ?? (kind === 'CTU' ? params.get('RESET') : params.get('LOAD'));
      if (!trig || pvv === null) { untranslated.push(text); return; }
      const rv = r && r.t === 'var' ? r.name : null;
      out(and(c, trig), { type: 'CNT', address: inst, direction: kind === 'CTD' ? 'DOWN' : 'UP', preset: pvv, resetAddress: rv });
      if (r && !rv) { const rc = cond(r); if (rc) out(and(c, rc), { type: 'RST', address: inst }); }
      return;
    }
    if (kind === 'R_TRIG' || kind === 'F_TRIG') {
      const clk = params.get('CLK');
      if (clk?.t === 'var') { edges.set(inst.toLowerCase(), el({ type: kind === 'R_TRIG' ? 'RISE' : 'FALL', address: clk.name })); return; }
      untranslated.push(text);
      return;
    }
    untranslated.push(text);
  }

  const stmtText = (from: number) => src.slice(p.toks[from].pos, (p.peek()?.pos ?? src.length)).trim();

  /** Statements until one of the stop keywords. `c` = condition of the enclosing IF/CASE (TRUE at top). */
  function block(c: Cond, top: boolean, stop: string[]) {
    while (p.peek() && !stop.some((s) => p.is(s))) statement(c, top);
  }

  function skipTo(end: string) {
    let depth = 0;
    const open: Record<string, string> = { END_IF: 'IF', END_CASE: 'CASE', END_FOR: 'FOR', END_WHILE: 'WHILE', END_REPEAT: 'REPEAT' };
    while (p.peek()) {
      if (p.is(open[end])) depth++;
      if (p.is(end)) { if (depth === 0) { p.i++; if (p.is(';')) p.i++; return; } depth--; }
      p.i++;
    }
  }

  function statement(c: Cond, top: boolean) {
    const start = p.i;
    try {
      if (p.is(';')) { p.i++; return; }
      if (p.is('IF')) {
        p.i++;
        let rest = TRUE;
        let g = p.expr();
        p.eat('THEN');
        for (;;) {
          const gc = cond(g);
          if (!gc) { untranslated.push(`IF ${src.slice(p.toks[start].pos, p.toks[p.i - 1].pos)}… (condition not converted)`); skipTo('END_IF'); return; }
          block(and(c, rest, gc), false, ['ELSIF', 'ELSE', 'END_IF']);
          rest = and(rest, not(gc));
          if (p.is('ELSIF')) { p.i++; g = p.expr(); p.eat('THEN'); continue; }
          if (p.is('ELSE')) { p.i++; block(and(c, rest), false, ['END_IF']); }
          p.eat('END_IF');
          if (p.is(';')) p.i++;
          return;
        }
      }
      if (p.is('CASE')) {
        p.i++;
        const sel = num(p.expr());
        p.eat('OF');
        if (sel === null) { untranslated.push(stmtText(start)); skipTo('END_CASE'); return; }
        let rest = TRUE;
        while (!p.is('END_CASE') && !p.is('ELSE') && p.peek()) {
          const labels: Cond[] = [];
          do {
            if (p.is(',')) p.i++;
            const a = num(p.expr());
            if (p.is('..')) { p.i++; const b = num(p.expr()); labels.push(and(el({ type: 'CMP', left: sel, op: '>=', right: a! }), el({ type: 'CMP', left: sel, op: '<=', right: b! }))); }
            else labels.push(el({ type: 'CMP', left: sel, op: '==', right: a! }));
          } while (p.is(','));
          p.eat(':');
          const lc = or(...labels);
          // Statements of this label: until the next "<label>:" or ELSE / END_CASE.
          while (p.peek() && !p.is('END_CASE') && !p.is('ELSE') && !isLabel()) statement(and(c, lc), false);
          rest = and(rest, not(lc));
        }
        if (p.is('ELSE')) { p.i++; block(and(c, rest), false, ['END_CASE']); }
        p.eat('END_CASE');
        if (p.is(';')) p.i++;
        return;
      }
      if (p.is('FOR') || p.is('WHILE') || p.is('REPEAT')) {
        const end = `END_${p.peek()!.v}`;
        skipTo(end);
        untranslated.push(stmtText(start));
        return;
      }
      if (p.is('RETURN') || p.is('EXIT')) { p.i++; if (p.is(';')) p.i++; untranslated.push(stmtText(start)); return; }
      if (p.peek()?.t === 'id') {
        const name = p.name();
        if (p.is(':=')) {
          p.i++;
          const e = p.expr();
          const text = src.slice(p.toks[start].pos, p.peek()?.pos ?? src.length).trim();
          if (p.is(';')) p.i++;
          assign(name, e, c, top && c.k === 'true', text);
          return;
        }
        if (p.is('(')) {
          // Function block call: Inst(IN := …) or "Inst".TON(…) / Inst.TON(…) (Siemens multi-instance).
          p.i++;
          const params = new Map<string, E>();
          while (!p.is(')') && p.peek()) {
            if (p.peek()?.t === 'id' && (p.is(':=', 1) || p.is('=>', 1))) {
              const k = p.toks[p.i].v.toUpperCase();
              const arrow = p.is('=>', 1);
              p.i += 2;
              const e = p.expr();
              if (!arrow) params.set(k, e);
            } else p.expr();
            if (p.is(',')) p.i++;
          }
          p.eat(')');
          const text = src.slice(p.toks[start].pos, p.peek()?.pos ?? src.length).trim();
          if (p.is(';')) p.i++;
          const m = /^(.*)\.(TON|TOF|TP|CTU|CTD|CTUD|R_TRIG|F_TRIG)$/i.exec(name);
          const inst = m ? m[1] : name;
          const kind = (m ? m[2] : typeOf(name)).toUpperCase().replace(/^IEC_/, '').replace(/_TIME$/, '');
          fbCall(inst, kind, params, c, text);
          return;
        }
      }
      // Anything else: skip to the end of the statement.
      while (p.peek() && !p.is(';')) p.i++;
      if (p.is(';')) p.i++;
      untranslated.push(stmtText(start) || src.slice(p.toks[start]?.pos ?? 0).slice(0, 120));
    } catch (e) {
      // Resynchronise at the next ";".
      while (p.peek() && !p.is(';')) p.i++;
      if (p.is(';')) p.i++;
      untranslated.push(`${src.slice(p.toks[start]?.pos ?? 0, p.peek()?.pos ?? src.length).trim().slice(0, 160)} (${e instanceof Error ? e.message : e})`);
    }
  }
  /** At "<number or name>[, …]:" (a CASE label, not "x := …"). */
  function isLabel(): boolean {
    let j = p.i;
    while (j < p.toks.length) {
      const t = p.toks[j];
      if (t.t === 'op' && t.v === ':') return true;
      if (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === ',' || t.v === '..' || t.v === '-'))) { j++; continue; }
      return false;
    }
    return false;
  }

  block(TRUE, true, []);
  const { rungs, failed } = toRungs(driven, '', idBase);
  for (const f of failed) untranslated.push(`${f.out.type} ${'address' in f.out ? f.out.address : 'dest' in f.out ? f.out.dest : ''}: condition too complex for a ladder rung`);
  return { rungs: rungs.map((r, i) => ({ ...r, id: `${idBase}_st${i + 1}` })), untranslated };
}
