/**
 * Neutral ladder → IEC 61131-3 Structured Text, shared by the ST-exporting profiles (Micro800 for
 * CCW, Siemens SCL for TIA Portal). One statement block per rung, in program order; the vendor
 * differences (I/O variables, how a variable is referenced, first-scan bit, timer / counter block
 * types and parameter names, TIME ↔ ms conversion) come from the dialect.
 */
import { rawTextNames, rawTodo, type CompareElement, type LadderElement, type LadderOutput, type LadderProgram } from '../ladder';
import type { ExportContext } from '../profile';
import { logixName } from './logixExport';

export interface StVariable { name: string; type: string; comment: string; io?: string; base: string }
export interface StProgram { body: string; variables: StVariable[]; warnings: string[] }

type BlockType = 'TON' | 'TOF' | 'RTO' | 'CTU' | 'CTD' | 'R_TRIG' | 'F_TRIG' | 'BOOL' | 'DINT' | 'REAL';

export interface StDialect {
  /** Second header line. */
  title: string;
  /** PLC profile id: RAW instructions imported from this PLC are written as they are. */
  vendor?: string;
  /**
   * How a kept (RAW) instruction of this PLC reads an analog channel: the raw word it used in the original
   * program (the app's own variable is scaled to engineering units). null = the variable itself.
   */
  rawWord?(base: string, ref: string): string | null;
  /** Vendor I/O variable / tag for a physical neutral address (name = the variable's name); null = not known (TODO line). */
  ioVar(base: string, name: string): string | null;
  ioTodo(base: string, name: string, isInput: boolean): string;
  /** How the program references one of its variables (Micro800: Name; SCL: #Name). */
  ref(name: string): string;
  /** Expression that is TRUE on the first scan. */
  firstScan: string;
  /** Vendor type name for each block / data type. */
  types: Record<BlockType, string>;
  params: { rtoReset: string; ctuReset: string; ctdLoad: string };
  msToTime(expr: string): string;
  timeToMs(expr: string): string;
  /** Statements before the inputs (e.g. first-scan flag). */
  prologue?: string[];
  /** Statements after the outputs. */
  epilogue?: string[];
  /**
   * No retentive timer block (UniLogic): an accumulating timer becomes a TON plus an accumulator (ms):
   * <T>_ACC keeps the time of earlier runs, <T>_ET = ACC + the running TON, <T> = done bit.
   */
  rtoEmulation?: boolean;
  /** Counter preset when it is not a constant (UniLogic CTU.PV is INT). */
  counterPv?(expr: string): string;
  /** Extra I/O statements once every variable is known (e.g. analog scaling); inputs go first, outputs last. */
  ioExtra?(vars: Map<string, StVariable>): { inputs: string[]; outputs: string[] };
  /** Only the rungs' statements (the code of an existing block is replaced): no header, I/O copy or clock. */
  rungsOnly?: boolean;
  /** Is this variable (neutral base) a TIME already (an original program's TIME preset)? Then it is the PT as it is. */
  isTime?(base: string): boolean;
}

const UNIT_MS: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
const NUM_RE = /^-?\d+(\.\d+)?$/;
const OPERAND_RE = /\b(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)\b/gi;

export function toIecSt(program: LadderProgram, ctx: ExportContext, d: StDialect): StProgram {
  const used = new Set<string>();
  const warnings: string[] = [];
  const vars = new Map<string, StVariable>();
  const nick = new Map<string, { nickname: string; comment: string }>();
  for (const t of [...ctx.extraTags, ...program.tags]) nick.set(t.address.toUpperCase(), { nickname: t.nickname, comment: t.comment });
  const timerUnit = new Map<string, number>();
  const blockType = new Map<string, BlockType>();
  for (const r of program.rungs) for (const o of r.outputs) {
    if (o.type === 'TMR') { timerUnit.set(o.address.toUpperCase(), UNIT_MS[o.unit] ?? 1000); blockType.set(o.address.toUpperCase(), o.accumulate ? 'RTO' : o.mode === 'OFF_DELAY' ? 'TOF' : 'TON'); }
    if (o.type === 'CNT') blockType.set(o.address.toUpperCase(), o.direction === 'DOWN' ? 'CTD' : 'CTU');
  }
  let edges = 0;
  let usesClock = false;
  const emulated = (a: string) => Boolean(d.rtoEmulation) && blockType.get(a) === 'RTO';

  /** Variable for a neutral base address; returns the reference used in code. */
  function v(base: string, type: BlockType): string {
    const have = vars.get(base);
    if (have) return d.ref(have.name);
    const n = nick.get(base), label = ctx.labels.get(base);
    const name = logixName(n?.nickname || label || (base === 'SC7' ? 'Clock_1s' : base), used, base);
    const io = d.ioVar(base, name);
    vars.set(base, { name, type: d.types[type], comment: [label, n?.comment].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).join(' — ') || base, base, ...(io ? { io } : {}) });
    return d.ref(name);
  }
  const refOf = (base: string) => d.ref(vars.get(base)!.name);
  function op(raw: string, value = false): string {
    const a = raw.trim().toUpperCase();
    if (NUM_RE.test(a)) return a;
    const m = /^(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)$/.exec(a);
    if (!m) { warnings.push(`Unknown operand "${raw}".`); return raw; }
    const [, p, n] = m;
    switch (p) {
      case 'X': case 'Y': case 'C': return v(a, 'BOOL');
      case 'T': return emulated(a) ? v(a, 'BOOL') : `${v(a, blockType.get(a) ?? 'TON')}.Q`;
      case 'TD': {
        if (emulated(`T${n}`)) { const et = v(`T${n}_ET`, 'DINT'), unit = timerUnit.get(`T${n}`) ?? 1000; return value && unit !== 1 ? `(${et} / ${unit})` : et; }
        const t = v(`T${n}`, blockType.get(`T${n}`) ?? 'TON'), unit = timerUnit.get(`T${n}`) ?? 1000;
        return value && unit !== 1 ? `(${d.timeToMs(`${t}.ET`)} / ${unit})` : d.timeToMs(`${t}.ET`);
      }
      case 'CT': return `${v(a, blockType.get(a) ?? 'CTU')}.Q`;
      case 'CTD': return `${v(`CT${n}`, blockType.get(`CT${n}`) ?? 'CTU')}.CV`;
      case 'DS': case 'DD': case 'DH': return v(a, 'DINT');
      case 'DF': return v(a, 'REAL');
      case 'SC':
        if (n === '1') return 'TRUE';
        if (n === '2') return d.firstScan;
        if (n === '7') { usesClock = true; return v('SC7', 'BOOL'); }
        warnings.push(`${a}: no equivalent on this PLC.`); return 'FALSE';
      default: warnings.push(`${a}: no equivalent on this PLC.`); return a;
    }
  }
  const CMP: Record<CompareElement['op'], string> = { '==': '=', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };

  // A kept instruction of this PLC names the program's tags by their original names: written as this export's variables.
  const byNick = new Map(program.tags.map((t) => [t.nickname.toLowerCase(), t.address]));
  const rawRefs = (text: string) => {
    let out = text;
    for (const { name, index } of rawTextNames(text).reverse()) {
      const a = byNick.get(name.toLowerCase());
      if (!a) continue;
      const ref = op(a, true);
      out = out.slice(0, index) + (d.rawWord?.(a.toUpperCase(), ref) ?? ref) + out.slice(index + name.length);
    }
    return out;
  };

  function rungSt(r: { comment: string; branches: LadderElement[][]; outputs: LadderOutput[] }): string[] {
    const pre: string[] = [];
    const el = (e: LadderElement): string => {
      if (e.type === 'CMP') return `(${op(e.left, true)} ${CMP[e.op]} ${op(e.right, true)})`;
      if (e.type === 'RAW') {
        if (e.vendor === d.vendor) return `(${rawRefs(e.text)})`;
        pre.push(`(* ${rawTodo(e).replace(/\*\)/g, '* )')} *)`);
        return 'FALSE';
      }
      const a = op(e.address);
      if (e.type === 'NO') return a;
      if (e.type === 'NC') return `NOT ${a}`;
      const inst = v(`${e.type === 'RISE' ? 'RT' : 'FT'}_${++edges}`, e.type === 'RISE' ? 'R_TRIG' : 'F_TRIG');
      pre.push(`${inst}(CLK := ${a});`);
      return `${inst}.Q`;
    };
    const cond = r.branches.length ? r.branches.map((b) => (b.length ? b.map(el).join(' AND ') : 'TRUE')).map((s, _i, all) => (all.length > 1 && s.includes(' AND ') ? `(${s})` : s)).join(' OR ') : 'TRUE';
    const out: string[] = [];
    // COPY / MATH execute only while the rung is true.
    const when = (stmt: string) => (cond === 'TRUE' ? stmt : `IF ${cond} THEN ${stmt} END_IF;`);
    for (const o of r.outputs) {
      switch (o.type) {
        case 'OUT': out.push(`${op(o.address)} := ${cond};`); break;
        case 'SET': out.push(`IF ${cond} THEN ${op(o.address)} := TRUE; END_IF;`); break;
        case 'RST': {
          const a = o.address.toUpperCase();
          if (/^(T|CT)\d+$/.test(a)) { out.push(`IF ${cond} THEN ${v(`${a}_RST`, 'BOOL')} := TRUE; END_IF;`); break; }
          out.push(`IF ${cond} THEN ${op(o.address)} := FALSE; END_IF;`); break;
        }
        case 'TMR': {
          const a = o.address.toUpperCase(), unit = UNIT_MS[o.unit] ?? 1000;
          if (emulated(a)) {
            const ms = NUM_RE.test(o.preset.trim()) ? String(Math.round(Number(o.preset) * unit)) : `${op(o.preset)} * ${unit}`;
            const done = v(a, 'BOOL'), ton = v(`${a}_TON`, 'TON'), acc = v(`${a}_ACC`, 'DINT'), last = v(`${a}_LAST`, 'DINT'), was = v(`${a}_WAS`, 'BOOL'), et = v(`${a}_ET`, 'DINT');
            const rst = o.resetAddress ? op(o.resetAddress) : 'FALSE';
            out.push(
              `${ton}(IN := (${cond}) AND NOT ${rst}, PT := ${d.msToTime(`${ms} - ${acc}`)});`,
              `IF ${rst} THEN ${acc} := 0; ELSIF NOT (${cond}) AND ${was} THEN ${acc} := ${acc} + ${last}; END_IF;`,
              `${last} := ${d.timeToMs(`${ton}.ET`)};`, `${was} := (${cond}) AND NOT ${rst};`,
              `${et} := ${acc} + ${last};`, `${done} := ${et} >= ${ms};`,
            );
            break;
          }
          const t = v(a, blockType.get(a)!);
          const pre = o.preset.trim().toUpperCase();
          const ptv = NUM_RE.test(pre) ? d.msToTime(String(Math.round(Number(o.preset) * unit))) : d.isTime?.(pre) ? op(o.preset) : d.msToTime(unit === 1 ? op(o.preset) : `${op(o.preset)} * ${unit}`);
          if (o.accumulate) out.push(`${t}(IN := ${cond}, ${d.params.rtoReset} := ${o.resetAddress ? op(o.resetAddress) : 'FALSE'}, PT := ${ptv});`);
          else out.push(`${t}(IN := ${cond}, PT := ${ptv});`);
          break;
        }
        case 'CNT': {
          const a = o.address.toUpperCase(), c = v(a, blockType.get(a)!);
          const pv = NUM_RE.test(o.preset.trim()) ? o.preset.trim() : d.counterPv ? d.counterPv(op(o.preset)) : op(o.preset);
          const rstVar = vars.has(`${a}_RST`) ? refOf(`${a}_RST`) : undefined;
          const rst = [o.resetAddress ? op(o.resetAddress) : '', rstVar ?? ''].filter(Boolean).join(' OR ') || 'FALSE';
          out.push(o.direction === 'DOWN' ? `${c}(CD := ${cond}, ${d.params.ctdLoad} := ${rst}, PV := ${pv});` : `${c}(CU := ${cond}, ${d.params.ctuReset} := ${rst}, PV := ${pv});`);
          if (rstVar) out.push(`${rstVar} := FALSE;`);
          break;
        }
        case 'COPY': out.push(when(`${op(o.dest)} := ${op(o.source, true)};`)); break;
        case 'MATH': out.push(when(`${op(o.dest)} := ${o.expression.replace(OPERAND_RE, (t) => op(t, true))};`)); break;
        case 'RAW': {
          const t = rawRefs(o.text.trim());
          out.push(o.vendor === d.vendor ? when(/;\s*$/.test(t) ? t : `${t};`) : `(* ${rawTodo(o).replace(/\*\)/g, '* )')} *)`);
          break;
        }
      }
    }
    return [...(r.comment ? [`(* ${r.comment.replace(/\*\)/g, '* )')} *)`] : []), ...pre, ...out];
  }

  // Counter/timer reset coils (RST T/CT) must exist before the block call that reads them: declare first.
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'RST' && /^(T|CT)\d+$/i.test(o.address)) v(`${o.address.toUpperCase()}_RST`, 'BOOL');

  const blocks = program.blocks ?? [];
  const sections: string[] = [];
  const order = [...blocks.map((b) => ({ id: b.id, name: b.name })), { id: '', name: 'General' }];
  for (const b of order) {
    const rungs = program.rungs.filter((r) => (b.id ? r.block === b.id : !r.block || !blocks.some((x) => x.id === r.block)));
    if (!rungs.length) continue;
    sections.push(`(* ===== ${b.name} ===== *)`, ...rungs.flatMap(rungSt), '');
  }
  if (d.rungsOnly) return { body: sections.filter((l) => !/^\(\* ===== .* ===== \*\)$/.test(l)).join('\n').trim(), variables: [...vars.values()], warnings };
  // HMI tags the ladder doesn't use are still declared, so the HMI can bind to them.
  for (const t of ctx.extraTags) op(t.address);
  // I/O copy at the start / end of the scan: named variables ↔ the PLC's I/O.
  const inputs: string[] = [], outputs: string[] = [];
  for (const [base, x] of vars) {
    if (!/^[XY]\d{3}$/.test(base)) continue;
    const isIn = base.startsWith('X');
    const ref = d.ref(x.name);
    if (x.io) (isIn ? inputs : outputs).push(isIn ? `${ref} := ${x.io};` : `${x.io} := ${ref};`);
    else (isIn ? inputs : outputs).push(d.ioTodo(base, ref, isIn));
  }
  const extra = d.ioExtra?.(vars);
  if (extra) { inputs.push(...extra.inputs); outputs.push(...extra.outputs); }
  const clock = usesClock ? [
    '(* 1-second clock: ON 0.5 s, OFF 0.5 s *)',
    `${v('CLOCK_TMR', 'TON')}(IN := NOT ${refOf('CLOCK_TMR')}.Q, PT := T#1s);`,
    `${refOf('SC7')} := ${d.timeToMs(`${refOf('CLOCK_TMR')}.ET`)} < 500;`, '',
  ] : [];
  const header = `(* ${ctx.header} *)\n(* ${d.title} *)`;
  const body = [header, '', ...(d.prologue ? [...d.prologue, ''] : []), '(* ===== Inputs ===== *)', ...inputs, '', ...clock, ...sections, '(* ===== Outputs ===== *)', ...outputs, ...(d.epilogue ? ['', ...d.epilogue] : []), ''].join('\n');
  return { body, variables: [...vars.values()], warnings };
}
