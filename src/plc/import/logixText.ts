/**
 * Logix rung text ("neutral text" of .L5X / .L5K, Logix 5000 General Instructions Reference Manual
 * 1756-RM003): XIC(a)[XIO(b),XIC(c)]OTE(d); → outputs with their conditions. Operands stay the
 * program's names (Tag, Tag.DN, Local:1:I.Data.0, Arr[3], S:FS); convert.ts maps them.
 * Instructions the app's ladder model has no form for are returned as `untranslated`.
 */
import type { CompareOp, LadderOutput } from '../core/ladder';
import { and, el, FALSE, or, TRUE, type Cond, type Driven } from './cond';

type Item = { t: 'instr'; name: string; args: string[]; text: string } | { t: 'branch'; legs: Item[][] };

/** Split "a,b(c,d),e[1,2]" at top-level commas. */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}

/** Parse rung text into a sequence of instructions and branches. Throws on malformed text. */
export function parseRungText(text: string): Item[] {
  const s = text.trim().replace(/;\s*$/, '');
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function seq(stop: string[]): Item[] {
    const items: Item[] = [];
    for (;;) {
      ws();
      if (i >= s.length || stop.includes(s[i])) return items;
      if (s[i] === '[') {
        i++;
        const legs: Item[][] = [seq([',', ']'])];
        while (s[i] === ',') { i++; legs.push(seq([',', ']'])); }
        if (s[i] !== ']') throw new Error(`missing "]" in: ${text}`);
        i++;
        items.push({ t: 'branch', legs });
        continue;
      }
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      if (!m) throw new Error(`unexpected "${s[i]}" in: ${text}`);
      const name = m[0].toUpperCase();
      const start = i;
      i += m[0].length;
      ws();
      let args: string[] = [];
      if (s[i] === '(') {
        let depth = 0, j = i;
        for (; j < s.length; j++) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')' && --depth === 0) break;
        }
        if (j >= s.length) throw new Error(`missing ")" in: ${text}`);
        args = splitArgs(s.slice(i + 1, j));
        i = j + 1;
      } else {
        // Space-separated form (older exports): "XIC Tag" — operands until the next mnemonic.
        const rest = /^([^\s[\],;]+)/.exec(s.slice(i));
        if (rest && !/^(XIC|XIO|OTE|OTL|OTU)$/i.test(rest[1])) { args = [rest[1]]; i += rest[1].length; }
      }
      items.push({ t: 'instr', name, args, text: s.slice(start, i) });
    }
  }
  const out = seq([]);
  if (i < s.length) throw new Error(`unexpected "${s[i]}" in: ${text}`);
  return out;
}

const CMP: Record<string, CompareOp> = { EQU: '==', NEQ: '<>', GRT: '>', GEQ: '>=', LES: '<', LEQ: '<=' };
const NUM = /^[-+]?\d+(\.\d+)?$/;

/** Logix CMP expression "A>=B" → compare element when it is a single comparison. */
function cmpExpr(e: string): Cond | null {
  const m = /^(.+?)\s*(>=|<=|<>|=|>|<)\s*(.+)$/.exec(e.trim());
  if (!m) return null;
  const op = ({ '=': '==', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' } as const)[m[2] as '=' | '<>' | '>' | '>=' | '<' | '<='];
  if (/\b(AND|OR|NOT|XOR)\b/i.test(e)) return null;
  return el({ type: 'CMP', left: m[1].trim(), op, right: m[3].trim() });
}

/** Timer preset in ms → value + unit for the app's TMR. */
export function msPreset(ms: string): { preset: string; unit: 'ms' | 'sec' | 'min' } {
  if (!NUM.test(ms)) return { preset: ms, unit: 'ms' };
  const n = Number(ms);
  if (n >= 60_000 && n % 60_000 === 0) return { preset: String(n / 60_000), unit: 'min' };
  if (n % 1000 === 0) return { preset: String(n / 1000), unit: 'sec' };
  return { preset: String(n), unit: 'ms' };
}

export interface RungResult { driven: Driven[]; untranslated: string[] }

/** Convert one Logix rung to outputs with their conditions. */
export function convertLogixRung(text: string): RungResult {
  const driven: Driven[] = [];
  const untranslated: string[] = [];
  const items = parseRungText(text);

  const output = (cin: Cond, o: LadderOutput) => driven.push({ cond: cin, out: o });

  function walk(items: Item[], cin: Cond): Cond {
    let c = cin;
    for (const [k, it] of items.entries()) {
      if (it.t === 'branch') {
        c = or(...it.legs.map((leg) => walk(leg, c)));
        continue;
      }
      const a = it.args;
      switch (it.name) {
        case 'XIC': c = and(c, el({ type: 'NO', address: a[0] })); break;
        case 'XIO': c = and(c, el({ type: 'NC', address: a[0] })); break;
        case 'AFI': c = FALSE; break;
        case 'NOP': break;
        case 'ONS': {
          // XIC(x)ONS(store) = rising edge of x; only when the last element is one contact.
          const last = c.k === 'el' ? c : c.k === 'and' ? c.xs[c.xs.length - 1] : null;
          if (last?.k === 'el' && (last.el.type === 'NO' || last.el.type === 'NC')) {
            const edge = el({ type: last.el.type === 'NO' ? 'RISE' : 'FALL', address: last.el.address });
            c = c.k === 'and' ? and(...c.xs.slice(0, -1), edge) : edge;
          } else untranslated.push(it.text);
          break;
        }
        case 'EQU': case 'NEQ': case 'GRT': case 'GEQ': case 'LES': case 'LEQ':
          c = and(c, el({ type: 'CMP', left: a[0], op: CMP[it.name], right: a[1] }));
          break;
        case 'CMP': {
          const x = cmpExpr(a[0] ?? '');
          if (x) c = and(c, x); else untranslated.push(it.text);
          break;
        }
        case 'LIM': {
          // LIM(Low, Test, High): Low <= Test <= High (the usual case, Low <= High).
          c = and(c, el({ type: 'CMP', left: a[1], op: '>=', right: a[0] }), el({ type: 'CMP', left: a[1], op: '<=', right: a[2] }));
          break;
        }
        case 'OTE': output(c, { type: 'OUT', address: a[0] }); break;
        case 'OTL': output(c, { type: 'SET', address: a[0] }); break;
        case 'OTU': output(c, { type: 'RST', address: a[0] }); break;
        case 'RES': output(c, { type: 'RST', address: a[0] }); break;
        case 'TON': case 'TOF': case 'RTO': {
          const p = msPreset(a[1] ?? '0');
          output(c, { type: 'TMR', address: a[0], mode: it.name === 'TOF' ? 'OFF_DELAY' : 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: it.name === 'RTO', resetAddress: null });
          break;
        }
        case 'CTU': case 'CTD':
          output(c, { type: 'CNT', address: a[0], direction: it.name === 'CTD' ? 'DOWN' : 'UP', preset: a[1] ?? '0', resetAddress: null });
          break;
        case 'MOV': output(c, { type: 'COPY', source: a[0], dest: a[1] }); break;
        case 'CLR': output(c, { type: 'COPY', source: '0', dest: a[0] }); break;
        case 'CPT': output(c, { type: 'MATH', dest: a[0], expression: a[1] }); break;
        case 'ADD': case 'SUB': case 'MUL': case 'DIV': {
          const op = { ADD: '+', SUB: '-', MUL: '*', DIV: '/' }[it.name];
          output(c, { type: 'MATH', dest: a[2], expression: `${a[0]} ${op} ${a[1]}` });
          break;
        }
        default:
          // Kept as it was (RAW): with more instructions after it, it is a condition; at the end, an output.
          if (k < items.length - 1) c = and(c, el({ type: 'RAW', vendor: 'logix', text: it.text }));
          else output(c, { type: 'RAW', vendor: 'logix', text: it.text });
      }
    }
    return c;
  }
  walk(items, TRUE);
  return { driven, untranslated };
}
