/**
 * Allen-Bradley Micro820 / Micro850 (Connected Components Workbench).
 *
 * CCW has no documented program import (no L5X; PLCopen XML is not offered for Micro800), so the export
 * is IEC 61131-3 Structured Text for one CCW ST program plus the variable list to enter in the
 * program's variable grid. Facts used (Rockwell Micro800 manuals):
 * - embedded I/O variables `_IO_EM_DI_nn` / `_IO_EM_DO_nn` (2080-UM002, PTO wiring tables and
 *   variable examples); plug-in analog `_IO_P1_AI_nn` (2080-UM004 plug-in modules);
 * - first scan `_SYSVA_FIRST_SCAN` (2080-UM002 Table 37, firmware rev 2+);
 * - function blocks (2080-RM001M, May 2025): TON / TOF (IN, PT: TIME → Q, ET), RTO (IN, RST, PT → Q, ET),
 *   CTU (CU, RESET, PV → Q, CV), CTD (CD, LOAD, PV → Q, CV), R_TRIG / F_TRIG (CLK → Q);
 *   ANY_TO_DINT, ANY_TO_TIME (a number converts as milliseconds: ANY_TO_TIME(1256.3) = t#1s256ms).
 * Expansion I/O (2085) variable names are not in those manuals: points on expansion modules are
 * exported as named variables with a TODO line to map them in CCW.
 */
import type { CpuModel, ExportContext, PlcProfile, ProgramExporter } from '../profile';
import type { CompareElement, LadderElement, LadderOutput, LadderProgram } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses, parseAddress } from './click';
import { logixName } from './logixExport';

const cpu = (id: string, series: 'Micro820' | 'Micro850', inputs: number, outputs: number, out: string): CpuModel => ({
  id, label: `${id} — ${series}, ${inputs} DC in / ${outputs} ${out} out, Ethernet`, builtInInputs: inputs, builtInOutputs: outputs,
  platformId: series === 'Micro820' ? 'ab-micro820' : 'ab-micro850',
  notes: series === 'Micro820' ? 'No expansion I/O modules (plug-in slots only).' : 'Up to 4 × 2085 expansion modules plus plug-ins.',
});

export const MICRO800_CPUS: CpuModel[] = [
  cpu('2080-L20E-20QBB', 'Micro820', 12, 7, 'DC sourcing'),
  cpu('2080-L20E-20QWB', 'Micro820', 12, 7, 'relay'),
  cpu('2080-L50E-24QBB', 'Micro850', 14, 10, 'DC sourcing'),
  cpu('2080-L50E-24QWB', 'Micro850', 14, 10, 'relay'),
  cpu('2080-L50E-48QBB', 'Micro850', 28, 20, 'DC sourcing'),
];

const pt = (n: number) => String(n).padStart(2, '0');

/** Micro800 I/O variable for a neutral address; null = not embedded / plug-in (name not documented). */
export function micro800IoVar(address: string): string | null {
  const m = /^([XY])0(\d\d)$/.exec(address.toUpperCase());
  return m ? `_IO_EM_${m[1] === 'X' ? 'DI' : 'DO'}_${pt(Number(m[2]) - 1)}` : null;
}

const UNIT_MS: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
const NUM_RE = /^-?\d+(\.\d+)?$/;
const OPERAND_RE = /\b(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)\b/gi;

export interface StVariable { name: string; type: string; comment: string; io?: string }
export interface StProgram { body: string; variables: StVariable[]; warnings: string[] }

/** Neutral ladder → Micro800 Structured Text (one statement block per rung, in program order). */
export function toMicro800St(program: LadderProgram, ctx: ExportContext): StProgram {
  const used = new Set<string>();
  const warnings: string[] = [];
  const vars = new Map<string, StVariable>();
  const nick = new Map<string, { nickname: string; comment: string }>();
  for (const t of [...ctx.extraTags, ...program.tags]) nick.set(t.address.toUpperCase(), { nickname: t.nickname, comment: t.comment });
  const timerUnit = new Map<string, number>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') timerUnit.set(o.address.toUpperCase(), UNIT_MS[o.unit] ?? 1000);
  const timerType = new Map<string, string>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') timerType.set(o.address.toUpperCase(), o.accumulate ? 'RTO' : o.mode === 'OFF_DELAY' ? 'TOF' : 'TON');
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'CNT') timerType.set(o.address.toUpperCase(), o.direction === 'DOWN' ? 'CTD' : 'CTU');
  let edges = 0;
  let usesClock = false;

  function v(base: string, type: string): string {
    const have = vars.get(base);
    if (have) return have.name;
    const n = nick.get(base), label = ctx.labels.get(base);
    const io = micro800IoVar(base);
    const name = logixName(n?.nickname || label || (base === 'SC7' ? 'Clock_1s' : base), used, base);
    vars.set(base, { name, type, comment: [label, n?.comment].filter(Boolean).join(' — ') || base, ...(io ? { io } : {}) });
    return name;
  }
  function op(raw: string, value = false): string {
    const a = raw.trim().toUpperCase();
    if (NUM_RE.test(a)) return a;
    const m = /^(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)$/.exec(a);
    if (!m) { warnings.push(`Unknown operand "${raw}".`); return raw; }
    const [, p, n] = m;
    switch (p) {
      case 'X': case 'Y': case 'C': return v(a, 'BOOL');
      case 'T': return `${v(a, timerType.get(a) ?? 'TON')}.Q`;
      case 'TD': {
        const t = v(`T${n}`, timerType.get(`T${n}`) ?? 'TON'), unit = timerUnit.get(`T${n}`) ?? 1000;
        return value && unit !== 1 ? `(ANY_TO_DINT(${t}.ET) / ${unit})` : `ANY_TO_DINT(${t}.ET)`;
      }
      case 'CT': return `${v(a, timerType.get(a) ?? 'CTU')}.Q`;
      case 'CTD': return `${v(`CT${n}`, timerType.get(`CT${n}`) ?? 'CTU')}.CV`;
      case 'DS': case 'DD': case 'DH': return v(a, 'DINT');
      case 'DF': return v(a, 'REAL');
      case 'SC':
        if (n === '1') return 'TRUE';
        if (n === '2') return '_SYSVA_FIRST_SCAN';
        if (n === '7') { usesClock = true; return v('SC7', 'BOOL'); }
        warnings.push(`${a}: no Micro800 equivalent.`); return 'FALSE';
      default: warnings.push(`${a}: no Micro800 equivalent.`); return a;
    }
  }
  const CMP: Record<CompareElement['op'], string> = { '==': '=', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=' };

  function rungSt(r: { comment: string; branches: LadderElement[][]; outputs: LadderOutput[] }): string[] {
    const pre: string[] = [];
    const el = (e: LadderElement): string => {
      if (e.type === 'CMP') return `(${op(e.left, true)} ${CMP[e.op]} ${op(e.right, true)})`;
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
          const a = o.address.toUpperCase(), t = v(a, timerType.get(a)!), unit = UNIT_MS[o.unit] ?? 1000;
          const ptv = NUM_RE.test(o.preset.trim()) ? `ANY_TO_TIME(${Math.round(Number(o.preset) * unit)})` : `ANY_TO_TIME(${op(o.preset)} * ${unit})`;
          if (o.accumulate) out.push(`${t}(IN := ${cond}, RST := ${o.resetAddress ? op(o.resetAddress) : 'FALSE'}, PT := ${ptv});`);
          else out.push(`${t}(IN := ${cond}, PT := ${ptv});`);
          break;
        }
        case 'CNT': {
          const a = o.address.toUpperCase(), c = v(a, timerType.get(a)!);
          const pv = NUM_RE.test(o.preset.trim()) ? o.preset.trim() : op(o.preset);
          const rstVar = vars.get(`${a}_RST`)?.name;
          const rst = [o.resetAddress ? op(o.resetAddress) : '', rstVar ?? ''].filter(Boolean).join(' OR ') || 'FALSE';
          out.push(o.direction === 'DOWN' ? `${c}(CD := ${cond}, LOAD := ${rst}, PV := ${pv});` : `${c}(CU := ${cond}, RESET := ${rst}, PV := ${pv});`);
          if (rstVar) out.push(`${rstVar} := FALSE;`);
          break;
        }
        case 'COPY': out.push(when(`${op(o.dest)} := ${op(o.source, true)};`)); break;
        case 'MATH': out.push(when(`${op(o.dest)} := ${o.expression.replace(OPERAND_RE, (t) => op(t, true))};`)); break;
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
  // I/O copy at the start / end of the scan: named variables ↔ Micro800 I/O variables.
  const inputs: string[] = [], outputs: string[] = [];
  for (const [base, x] of vars) {
    if (!/^[XY]\d{3}$/.test(base)) continue;
    const isIn = base.startsWith('X');
    if (x.io) (isIn ? inputs : outputs).push(isIn ? `${x.name} := ${x.io};` : `${x.io} := ${x.name};`);
    else (isIn ? inputs : outputs).push(`(* TODO map ${base} (expansion slot ${base[1]}, point ${pt(Number(base.slice(2)) - 1)}) in CCW: ${isIn ? `${x.name} := <expansion input>;` : `<expansion output> := ${x.name};`} *)`);
  }
  const clock = usesClock ? [
    '(* 1-second clock: ON 0.5 s, OFF 0.5 s *)',
    `${v('CLOCK_TMR', 'TON')}(IN := NOT ${vars.get('CLOCK_TMR')!.name}.Q, PT := T#1s);`,
    `${vars.get('SC7')!.name} := ANY_TO_DINT(${vars.get('CLOCK_TMR')!.name}.ET) < 500;`, '',
  ] : [];
  const header = `(* ${ctx.header} *)\n(* Micro800 Structured Text for one CCW program; declare the variables listed in the variable file. *)`;
  const body = [header, '', '(* ===== Inputs ===== *)', ...inputs, '', ...clock, ...sections, '(* ===== Outputs ===== *)', ...outputs, ''].join('\n');
  return { body, variables: [...vars.values()], warnings };
}

/** Variable list for the CCW variable grid (CCW's own CSV import format is not documented). */
export function micro800VariablesCsv(program: LadderProgram, ctx: ExportContext): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const st = toMicro800St(program, ctx);
  return ['Name,Data Type,Comment,Micro800 I/O variable', ...st.variables.map((x) => [x.name, x.type, x.comment, x.io ?? ''].map(q).join(','))].join('\r\n') + '\r\n';
}

const MICRO800_KNOWLEDGE = (c: CpuModel) => `Target: Allen-Bradley ${c.label}, programmed in Connected Components Workbench. Write the program in the app's neutral operands; the app exports Micro800 Structured Text:
- Embedded inputs X001–X0${pt(c.builtInInputs)} and outputs Y001–Y0${pt(c.builtInOutputs)} become _IO_EM_DI_00… / _IO_EM_DO_00… (copied to named variables at the start / end of the scan). Expansion points X1xx… need mapping in CCW.
- C → BOOL, T → TON/TOF/RTO instances (T1 = .Q, TD1 = elapsed time), CT → CTU/CTD instances (CTD1 = .CV), DS/DD → DINT, DF → REAL. Give every operand a nickname in "tags" (letters, digits, single underscores) — it becomes the variable name.
- First scan SC2 → _SYSVA_FIRST_SCAN; SC1 → TRUE; SC7 → generated 1-second clock. No other SC bits or SD registers.
- RISE / FALL contacts become R_TRIG / F_TRIG instances; timer presets are exported in milliseconds through ANY_TO_TIME.`;

const MICRO800_EXPORTERS: ProgramExporter[] = [
  { id: 'micro800-st', label: 'Structured Text for a CCW program (paste into an ST program)', fileName: (b) => `${b}_micro800.st`, build: (p, c) => toMicro800St(p, c).body },
  { id: 'micro800-vars', label: 'Variable list for the CCW variable grid', fileName: (b) => `${b}_micro800_variables.csv`, build: (p, c) => micro800VariablesCsv(p, c) },
];

export const MICRO800_MNEMONICS: Record<string, string> = {
  NO: '-| |-', NC: '-|/|-', RISE: 'R_TRIG', FALL: 'F_TRIG', OUT: '-( )-', SET: '-(S)-', RST: '-(R)-',
  TMR_ON_DELAY: 'TON', TMR_OFF_DELAY: 'TOF', TMR_RTO: 'RTO', CNT_UP: 'CTU', CNT_DOWN: 'CTD',
  '==': 'EQ', '<>': 'NE', '>': 'GT', '>=': 'GE', '<': 'LT', '<=': 'LE', COPY: 'MOV', MATH: 'ST :=',
};

export const micro800Profile: PlcProfile = {
  id: 'micro800',
  vendor: 'Allen-Bradley',
  name: 'Micro820 / Micro850',
  language: 'ladder',
  available: true,
  autoChoose: false,
  platformId: 'ab-micro850',
  cpuModels: MICRO800_CPUS,
  defaultCpuId: '2080-L50E-24QBB',
  autoAddresses: (io, c, modules) => neutralAutoAddresses(io, c, modules, []),
  parseAddress,
  promptKnowledge: MICRO800_KNOWLEDGE,
  checkRung: (rung) => {
    const issues: { severity: 'error' | 'warning'; message: string }[] = [];
    for (const e of rung.branches.flat()) {
      const as = e.type === 'CMP' ? [e.left, e.right] : [e.address];
      for (const a of as) if (/^SC\d+$/i.test(a) && !['SC1', 'SC2', 'SC7'].includes(a.toUpperCase())) issues.push({ severity: 'error', message: `${a}: Micro800 has no equivalent system bit (use SC1, SC2 or SC7 only).` });
    }
    return issues;
  },
  dataTypeOf: (a) => { const t = neutralType(a); return t === 'INT' || t === 'WORD' ? 'DINT' : t; },
  simSemantics: { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive },
  exporters: MICRO800_EXPORTERS,
  mnemonics: MICRO800_MNEMONICS,
  ioTag: (a) => micro800IoVar(a),
};
