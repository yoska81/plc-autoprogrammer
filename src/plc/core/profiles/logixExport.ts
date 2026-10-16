/**
 * Logix export: the app's neutral program → Logix tags + rung neutral text → Studio 5000 .L5X.
 *
 * Rung text and instruction operands follow the Logix 5000 General Instructions Reference Manual
 * (1756-RM003): XIC / XIO / OTE / OTL / OTU / ONS, TON / TOF / RTO (Timer, Preset ms, Accum), RES,
 * CTU / CTD (Counter, Preset, Accum), EQU / NEQ / GRT / GEQ / LES / LEQ (Source A, Source B), CMP
 * (expression), MOV (Source, Dest), CPT (Dest, Expression), JSR (Routine, 0), AFI, branches
 * `[a,b]`. File structure follows the Logix 5000 Controllers Import/Export Reference Manual
 * (1756-RM084 / RM014D, ch. 1 and 9): RSLogix5000Content › Controller › Tags / Programs /
 * Routines / RLLContent / Rung › Text CDATA, Tasks › ScheduledPrograms.
 */
import type { CompareElement, LadderElement, LadderOutput, LadderProgram, Rung } from '../ladder';
import type { ExportContext, ModuleSlot } from '../profile';

export type LogixType = 'BOOL' | 'DINT' | 'REAL' | 'TIMER' | 'COUNTER';
export interface LogixTag { name: string; dataType: LogixType; aliasFor?: string; description: string }
export interface LogixRung { comment: string; text: string }
export interface LogixRoutine { name: string; rungs: LogixRung[] }
export interface LogixProgram { tags: LogixTag[]; routines: LogixRoutine[]; warnings: string[] }

const UNIT_MS: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
const OPERAND_RE = /\b(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)\b/gi;
const NUM_RE = /^-?\d+(\.\d+)?$/;
/** Names of tags the exporter adds itself. */
const GENERATED: Record<string, string> = { SC7: 'Clock_1s', CLOCK_TMR: 'Clock_1s_Tmr' };

/** Logix tag names: letters, digits, single underscores; start with a letter or underscore; at most 40 characters. */
export function logixName(text: string, used: Set<string>, fallback: string): string {
  let base = text.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = fallback;
  if (/^\d/.test(base)) base = `T_${base}`;
  base = base.slice(0, 40).replace(/_+$/, '');
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 40 - String(i).length - 1).replace(/_+$/, '')}_${i}`;
  used.add(name.toLowerCase());
  return name;
}

interface IoTagOf { (address: string, modules: ModuleSlot[]): string | null }

/** Build the Logix tag set and rung text for a neutral program. */
export function toLogix(program: LadderProgram, ctx: ExportContext, ioTag: IoTagOf): LogixProgram {
  const modules = ctx.modules ?? [];
  const used = new Set<string>(['s', 'local']);
  const warnings: string[] = [];
  const tags = new Map<string, LogixTag>(); // key: neutral base address (T1 for T1/TD1, CT1 for CT1/CTD1)
  const nick = new Map<string, { nickname: string; comment: string }>();
  for (const t of [...ctx.extraTags, ...program.tags]) nick.set(t.address.toUpperCase(), { nickname: t.nickname, comment: t.comment });
  const timerUnit = new Map<string, number>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') timerUnit.set(o.address.toUpperCase(), UNIT_MS[o.unit] ?? 1000);

  let usesClock = false;
  let ons = 0;

  function tagFor(base: string, dataType: LogixType): LogixTag {
    const have = tags.get(base);
    if (have) return have;
    const n = nick.get(base);
    const label = ctx.labels.get(base);
    const alias = dataType === 'BOOL' || dataType === 'REAL' ? ioTag(base, modules) : null;
    const tag: LogixTag = {
      name: logixName(n?.nickname || label || GENERATED[base] || base, used, base),
      dataType, description: [label, n?.comment].filter(Boolean).join(' — ') || base,
      ...(alias ? { aliasFor: alias } : {}),
    };
    if (alias && !label && !n) warnings.push(`${base}: I/O point without a description; tag named ${tag.name}.`);
    tags.set(base, tag);
    return tag;
  }

  /** Logix operand for a neutral address (constants pass through). `value` = the numeric value (TD scaled to its unit). */
  function operand(raw: string, value = false): string {
    const a = raw.trim().toUpperCase();
    if (NUM_RE.test(a)) return a;
    const m = /^(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)$/.exec(a);
    if (!m) { warnings.push(`Unknown operand "${raw}".`); return raw; }
    const [, p, n] = m;
    switch (p) {
      case 'X': case 'Y': case 'C': return tagFor(a, 'BOOL').name;
      case 'T': return `${tagFor(a, 'TIMER').name}.DN`;
      case 'TD': {
        const t = tagFor(`T${n}`, 'TIMER').name;
        const unit = timerUnit.get(`T${n}`) ?? 1000;
        return value && unit !== 1 ? `(${t}.ACC/${unit})` : `${t}.ACC`;
      }
      case 'CT': return `${tagFor(a, 'COUNTER').name}.DN`;
      case 'CTD': return `${tagFor(`CT${n}`, 'COUNTER').name}.ACC`;
      case 'DS': case 'DD': case 'DH': return tagFor(a, 'DINT').name;
      case 'DF': return tagFor(a, 'REAL').name;
      case 'SC':
        if (n === '2') return 'S:FS';
        if (n === '7') { usesClock = true; return tagFor('SC7', 'BOOL').name; }
        warnings.push(`${a}: no Logix equivalent.`);
        return a;
      default:
        warnings.push(`${a}: no Logix equivalent.`);
        return a;
    }
  }
  const isExpr = (s: string) => /[()/*+-]/.test(s) && !NUM_RE.test(s);
  const expr = (e: string) => e.replace(OPERAND_RE, (t) => operand(t, true));

  const CMP_INSTR: Record<CompareElement['op'], string> = { '==': 'EQU', '<>': 'NEQ', '>': 'GRT', '>=': 'GEQ', '<': 'LES', '<=': 'LEQ' };
  const CMP_EXPR: Record<CompareElement['op'], string> = { '==': '=', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };

  /** Text for one element; '' = always true, null = always false. */
  function element(el: LadderElement): string | null {
    if (el.type === 'CMP') {
      const l = operand(el.left, true), r = operand(el.right, true);
      return isExpr(l) || isExpr(r) ? `CMP(${l}${CMP_EXPR[el.op]}${r})` : `${CMP_INSTR[el.op]}(${l},${r})`;
    }
    const a = el.address.trim().toUpperCase();
    if (a === 'SC1') return el.type === 'NO' || el.type === 'RISE' ? '' : null; // always on
    const op = operand(a);
    const store = () => tagFor(`ONS_${++ons}`, 'BOOL').name;
    switch (el.type) {
      case 'NO': return `XIC(${op})`;
      case 'NC': return `XIO(${op})`;
      case 'RISE': return `XIC(${op})ONS(${store()})`;
      case 'FALL': return `XIO(${op})ONS(${store()})`;
    }
  }

  /** Rung conditions; null = never true (AFI). */
  function conditions(branches: LadderElement[][]): string | null {
    if (!branches.length) return '';
    const paths: string[] = [];
    for (const b of branches) {
      const parts = b.map(element);
      if (parts.some((x) => x === null)) continue;
      const s = parts.join('');
      if (!s) return ''; // one path always true
      paths.push(s);
    }
    if (!paths.length) return null;
    return paths.length === 1 ? paths[0] : `[${paths.join(',')}]`;
  }

  const pre: LogixRung[] = []; // rungs emitted before the current one (presets from registers)
  const post: LogixRung[] = []; // reset rungs after the current one

  function output(o: LadderOutput): string {
    switch (o.type) {
      case 'OUT': return `OTE(${operand(o.address)})`;
      case 'SET': return `OTL(${operand(o.address)})`;
      case 'RST': {
        const a = o.address.toUpperCase();
        if (/^(T|CT)\d+$/.test(a)) return `RES(${tagFor(a, a.startsWith('T') ? 'TIMER' : 'COUNTER').name})`;
        return `OTU(${operand(o.address)})`;
      }
      case 'TMR': {
        const t = tagFor(o.address.toUpperCase(), 'TIMER').name;
        const unit = UNIT_MS[o.unit] ?? 1000;
        let preset = '0';
        if (NUM_RE.test(o.preset.trim())) preset = String(Math.round(Number(o.preset) * unit));
        else pre.push({ comment: `${t} preset from ${o.preset} (${o.unit} → ms)`, text: `CPT(${t}.PRE,${operand(o.preset)}*${unit});` });
        const instr = o.accumulate ? 'RTO' : o.mode === 'OFF_DELAY' ? 'TOF' : 'TON';
        if (o.accumulate && o.resetAddress) post.push({ comment: `Reset ${t}`, text: `${element({ type: 'NO', address: o.resetAddress }) ?? 'AFI()'}RES(${t});` });
        return `${instr}(${t},${preset},0)`;
      }
      case 'CNT': {
        const c = tagFor(o.address.toUpperCase(), 'COUNTER').name;
        let preset = '0';
        if (NUM_RE.test(o.preset.trim())) preset = o.preset.trim();
        else pre.push({ comment: `${c} preset from ${o.preset}`, text: `MOV(${operand(o.preset)},${c}.PRE);` });
        if (o.resetAddress) post.push({ comment: `Reset ${c}`, text: `${element({ type: 'NO', address: o.resetAddress }) ?? 'AFI()'}RES(${c});` });
        return `${o.direction === 'DOWN' ? 'CTD' : 'CTU'}(${c},${preset},0)`;
      }
      case 'COPY': {
        const src = operand(o.source, true), dst = operand(o.dest);
        return isExpr(src) ? `CPT(${dst},${src})` : `MOV(${src},${dst})`;
      }
      case 'MATH': return `CPT(${operand(o.dest)},${expr(o.expression)})`;
    }
  }

  function rungText(r: Rung): LogixRung[] {
    pre.length = 0; post.length = 0;
    const cond = conditions(r.branches);
    const outs = r.outputs.map(output);
    const body = outs.length === 1 ? outs[0] : `[${outs.join(',')}]`;
    const main: LogixRung = { comment: r.comment, text: `${cond === null ? 'AFI()' : cond}${body};` };
    return [...pre, main, ...post];
  }

  // Routines: one per block, in program order; rungs without a block go to "General".
  const blocks = program.blocks?.length ? program.blocks : [];
  const order = [...blocks.map((b) => ({ id: b.id, name: b.name, desc: b.description })), { id: '', name: 'General', desc: '' }];
  const routineUsed = new Set<string>(['mainroutine']);
  const routines: LogixRoutine[] = [];
  for (const b of order) {
    const rungs = program.rungs.filter((r) => (b.id ? r.block === b.id : !r.block || !blocks.some((x) => x.id === r.block)));
    if (!rungs.length) continue;
    routines.push({ name: logixName(b.name, routineUsed, 'Routine'), rungs: rungs.flatMap(rungText) });
  }
  const main: LogixRung[] = [];
  if (usesClock) {
    const clk = tagFor('SC7', 'BOOL').name;
    const tmr = tagFor('CLOCK_TMR', 'TIMER').name;
    main.push({ comment: '1-second clock (CLICK SC7): ON 0.5 s, OFF 0.5 s', text: `XIO(${tmr}.DN)TON(${tmr},1000,0);` });
    main.push({ comment: '', text: `LES(${tmr}.ACC,500)OTE(${clk});` });
  }
  for (const r of routines) main.push({ comment: '', text: `JSR(${r.name},0);` });
  return { tags: [...tags.values()], routines: [{ name: 'MainRoutine', rungs: main }, ...routines], warnings };
}

