/**
 * Unitronics Vision and Samba (VisiLogic).
 *
 * VisiLogic has no program import (no ladder text / XML; subroutine .vlx files are proprietary), so the export
 * is a net-by-net listing to enter in VisiLogic, with every neutral operand mapped onto a VisiLogic operand,
 * and the operand descriptions in the layout of VisiLogic's Excel import (Edit › Import Operand Descriptions:
 * sheet "Operands", header in row 2, column A "Address", one column per operand type — VisiLogic help
 * "Import-Export Operand Descriptions"). Facts used (VisiLogic help and the model tech specs):
 * - I / O bits I 0… / O 0…; local expansion I/O = 32 + module × 16 + point ("Configuring I/O Expansion
 *   Modules"); on-board and snap-in I/O are the low addresses from 0 (inferred: the help shows it only as a
 *   screenshot);
 * - MB bits, MI 16-bit, ML 32-bit, MF float; limits per model in LIMITS (tech specs);
 * - SB 1 always ON, SB 2 power-up (one scan), SB 3 1-second pulse (System Operands);
 * - timers TD on-delay / TA accumulating, 10 ms resolution, max 99:59:59.99, counting down from the preset
 *   (Timers); no off-delay timer: built from a TD and an MB here;
 * - counters C: Increment on the rising edge, the C bit turns ON at the preset, Reset coil clears it (Counters);
 * - analog inputs are linked to an MI in Hardware Configuration ("Configure an Analog Input").
 */
import type { CpuModel, ExportContext, ModuleSlot, PlcProfile, ProgramExporter } from '../profile';
import { elementAddresses, rawTodo, type CompareElement, type LadderElement, type LadderOutput, type LadderProgram } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses } from './click';
import { VISION_CPUS, cpuPart, pointOf, npnOutputsLast, unitronicsAnalogChannels, unitronicsParse } from './unitronics';
import { getPart } from '../../../electrical/catalog';

export type VisiType = 'MB' | 'MI' | 'ML' | 'MF' | 'T' | 'C';
export interface VisiLimits { MB: number; MI: number; ML: number; MF: number; T: number; C: number }

/** Operand counts from the tech specs (V130 / V350 -T38 & -TA24, V700, V1210, Samba -TA22); V1040 as Enhanced Vision (inferred). */
export function visiLimits(cpuId: string): VisiLimits {
  if (/^SM/.test(cpuId)) return { MB: 512, MI: 256, ML: 32, MF: 24, T: 32, C: 16 };
  if (/^V130/.test(cpuId)) return { MB: 4096, MI: 2048, ML: 256, MF: 24, T: 192, C: 24 };
  return { MB: 8192, MI: 4096, ML: 512, MF: 64, T: 384, C: 32 };
}

/** VisiLogic I/O operand of a neutral point: on-board / snap-in from 0, expansion modules at 32 + 16·module. */
export function visiIo(base: string, cpuId: string | undefined): string | null {
  const p = pointOf(base);
  if (!p) return null;
  const letter = p.isInput ? 'I' : 'O';
  const r = cpuPart(cpuId)?.ratings ?? {};
  const onBoard = Number(r.discreteInputs ?? 0) > 0 || Number(r.discreteOutputs ?? 0) > 0;
  if (p.slot === 0) return `${letter} ${p.index}`;
  // Slot 1 is the snap-in module on a CPU without on-board I/O.
  if (p.slot === 1 && !onBoard) return `${letter} ${p.index}`;
  const module = onBoard ? p.slot - 1 : p.slot - 2;
  return `${letter} ${32 + module * 16 + p.index}`;
}

export interface VisiOperand { operand: string; type: VisiType | 'I' | 'O' | 'SB'; index: number; name: string; comment: string }
export interface VisiMap {
  byBase: Map<string, VisiOperand>;
  /** Analog input DF → the MI the channel is linked to in Hardware Configuration. */
  analogRaw: Map<string, VisiOperand>;
  /** Off-delay timer T → helper MB that is its output. */
  offDelay: Map<string, VisiOperand>;
  errors: string[];
}

const OPERAND_RE = /\b(CTD|TXT|DS|DD|DH|DF|TD|SD|CT|SC|C|T|X|Y)(\d+)\b/gi;
const nkey = (a: string) => { const m = /^([A-Z]+)(\d+)$/.exec(a); return m ? [m[1], Number(m[2])] as const : [a, 0] as const; };

/** Every operand of the program (and the HMI's extra tags) mapped onto VisiLogic operands, in neutral order. */
export function visiOperands(program: LadderProgram, ctx: ExportContext): VisiMap {
  const cpuId = ctx.cpuId ?? VISION_CPUS[2].id;
  const lim = visiLimits(cpuId);
  const nick = new Map<string, { nickname: string; comment: string }>();
  for (const t of [...ctx.extraTags, ...program.tags]) nick.set(t.address.toUpperCase(), { nickname: t.nickname, comment: t.comment });
  const used = new Set<string>();
  const add = (raw: string) => {
    const a = raw.trim().toUpperCase();
    const m = /^(CTD|TD|DS|DD|DH|DF|CT|SC|C|T|X|Y)(\d+)$/.exec(a);
    if (!m) return;
    used.add(m[1] === 'TD' ? `T${m[2]}` : m[1] === 'CTD' ? `CT${m[2]}` : a);
  };
  const offDelayTimers = new Set<string>();
  for (const r of program.rungs) {
    for (const e of r.branches.flat()) for (const a of elementAddresses(e)) add(a);
    for (const o of r.outputs) {
      if (o.type === 'RAW') continue;
      if (o.type === 'COPY') { add(o.source); add(o.dest); continue; }
      if (o.type === 'MATH') { add(o.dest); for (const t of o.expression.match(OPERAND_RE) ?? []) add(t); continue; }
      add(o.address);
      if (o.type === 'TMR' || o.type === 'CNT') { add(o.preset); if (o.resetAddress) add(o.resetAddress); }
      if (o.type === 'TMR' && o.mode === 'OFF_DELAY') offDelayTimers.add(o.address.toUpperCase());
    }
  }
  for (const t of ctx.extraTags) add(t.address);
  const labels = ctx.labels;
  const out: VisiMap = { byBase: new Map(), analogRaw: new Map(), offDelay: new Map(), errors: [] };
  const next: Record<VisiType, number> = { MB: 0, MI: 0, ML: 0, MF: 0, T: 0, C: 0 };
  const take = (type: VisiType, name: string, comment: string): VisiOperand => {
    const index = next[type]++;
    return { operand: `${type} ${index}`, type, index, name, comment };
  };
  const nameOf = (a: string) => nick.get(a)?.nickname || labels.get(a) || a;
  const commentOf = (a: string) => [labels.get(a), nick.get(a)?.comment].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).join(' — ') || a;
  const TYPE: Record<string, VisiType> = { C: 'MB', DS: 'MI', DH: 'MI', DD: 'ML', DF: 'MF', T: 'T', CT: 'C' };
  const sorted = [...used].sort((a, b) => { const [pa, na] = nkey(a), [pb, nb] = nkey(b); return pa === pb ? na - nb : pa.localeCompare(pb); });
  for (const a of sorted) {
    const [p, n] = nkey(a);
    if (p === 'X' || p === 'Y') {
      const io = visiIo(a, cpuId);
      if (!io) { out.errors.push(`${a}: no VisiLogic I/O address.`); continue; }
      out.byBase.set(a, { operand: io, type: p === 'X' ? 'I' : 'O', index: Number(io.split(' ')[1]), name: nameOf(a), comment: commentOf(a) });
    } else if (p === 'SC') {
      const sb = n === 1 ? 1 : n === 2 ? 2 : n === 7 ? 3 : null;
      if (sb === null) out.errors.push(`${a}: no VisiLogic system bit for it (SC1 → SB 1, SC2 → SB 2, SC7 → SB 3 only).`);
      else out.byBase.set(a, { operand: `SB ${sb}`, type: 'SB', index: sb, name: ['', 'Always ON', 'Power-up (first scan)', '', '', '', '', '1-second pulse'][n], comment: '' });
    } else if (TYPE[p]) out.byBase.set(a, take(TYPE[p], nameOf(a), commentOf(a)));
  }
  // Analog inputs: the channel is linked to an MI; scaled into the program's MF.
  const analogIn = new Set(ctx.io.filter((x) => x.type === 'input' && x.signal === 'analog').map((x) => (ctx.addresses.get(x.id) ?? '').toUpperCase()));
  for (const [base, v] of out.byBase) if (analogIn.has(base)) out.analogRaw.set(base, take('MI', `${v.name}_raw`, `raw value of ${v.comment}`));
  for (const t of offDelayTimers) out.offDelay.set(t, take('MB', `${out.byBase.get(t)?.name ?? t}_Q`, `off-delay output of ${t}`));
  for (const k of Object.keys(next) as VisiType[]) if (next[k] > lim[k]) out.errors.push(`Uses ${next[k]} ${k} operands; the ${cpuId} has ${lim[k]} (${k} 0–${lim[k] - 1}).`);
  return out;
}

const UNIT_MS: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
const MAX_MS = ((99 * 60 + 59) * 60 + 59) * 1000 + 990;

/** 99:59:59.99 style preset (hh:mm:ss.hh, 10 ms resolution). */
export function visiTime(ms: number): string {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** The VisiLogic net listing. */
export function visiLogicListing(program: LadderProgram, ctx: ExportContext): string {
  const map = visiOperands(program, ctx);
  const units = new Map<string, number>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') units.set(o.address.toUpperCase(), UNIT_MS[o.unit] ?? 1000);
  const opd = (raw: string): string => {
    const a = raw.trim().toUpperCase();
    if (/^-?\d+(\.\d+)?$/.test(a)) return a;
    const td = /^TD(\d+)$/.exec(a), ctd = /^CTD(\d+)$/.exec(a);
    if (td) { const t = map.byBase.get(`T${td[1]}`); return t ? `${t.operand} elapsed (preset − current, 10 ms units)` : a; }
    if (ctd) { const c = map.byBase.get(`CT${ctd[1]}`); return c ? `${c.operand} current value` : a; }
    if (/^T\d+$/.test(a) && map.offDelay.has(a)) return `${map.offDelay.get(a)!.operand} (${map.offDelay.get(a)!.name})`;
    const v = map.byBase.get(a);
    return v ? `${v.operand}${v.name && v.name !== a ? ` (${v.name})` : ''}` : `${a} ?`;
  };
  const CMP: Record<CompareElement['op'], string> = { '==': 'Equal', '<>': 'Not equal', '>': 'Greater than', '>=': 'Greater or equal', '<': 'Less than', '<=': 'Less or equal' };
  const el = (e: LadderElement) => {
    if (e.type === 'CMP') return `[${CMP[e.op]}: ${opd(e.left)} , ${opd(e.right)}]`;
    if (e.type === 'RAW') return `[${e.vendor === 'unitronics-vision' ? e.text : rawTodo(e)}]`;
    const kind = e.type === 'NO' ? 'Direct contact' : e.type === 'NC' ? 'Inverted contact' : e.type === 'RISE' ? 'Positive transition contact' : 'Negative transition contact';
    return `[${kind} ${opd(e.address)}]`;
  };
  const cond = (branches: LadderElement[][]) => (branches.length ? branches.map((b) => (b.length ? b.map(el).join(' AND ') : 'always')).join('\n      OR ') : 'always');
  const preset = (o: Extract<LadderOutput, { type: 'TMR' }>) => {
    const unit = UNIT_MS[o.unit] ?? 1000;
    if (/^\d+(\.\d+)?$/.test(o.preset.trim())) {
      const ms = Number(o.preset) * unit;
      if (ms > MAX_MS) map.errors.push(`${o.address}: preset ${o.preset} ${o.unit} is over the VisiLogic maximum 99:59:59.99.`);
      return `preset ${visiTime(ms)}`;
    }
    return `preset from ${opd(o.preset)} × ${unit / 10} (10 ms units): Store Timer Preset before the coil`;
  };
  const lines: string[] = [];
  let net = 0;
  const blocks = program.blocks ?? [];
  const order = [...blocks.map((b) => ({ id: b.id, name: b.name })), { id: '', name: 'General' }];
  // Analog inputs: scale the linked MI into the program's MF first.
  const analog = ctx.io.filter((x) => x.type === 'input' && x.signal === 'analog' && x.analog);
  if (analog.length) {
    lines.push('--- Analog inputs (first nets) ---');
    for (const p of analog) {
      const base = (ctx.addresses.get(p.id) ?? '').toUpperCase(), raw = map.analogRaw.get(base), v = map.byBase.get(base);
      if (!raw || !v) continue;
      lines.push(`Net ${++net}: ${p.description}`, `  Condition: always`, `  → Linearization: ${raw.operand} (linked to the analog input in Hardware Configuration, ${p.analog!.range}) → ${v.operand} (${p.analog!.min}…${p.analog!.max} ${p.analog!.units}; raw range: see the controller's guide)`, '');
    }
  }
  for (const b of order) {
    const rungs = program.rungs.filter((r) => (b.id ? r.block === b.id : !r.block || !blocks.some((x) => x.id === r.block)));
    if (!rungs.length) continue;
    lines.push(`--- ${b.name} ---`);
    for (const r of rungs) {
      const c = cond(r.branches);
      const outs: string[] = [];
      const extra: string[][] = [];
      for (const o of r.outputs) {
        switch (o.type) {
          case 'OUT': outs.push(`Direct coil ${opd(o.address)}`); break;
          case 'SET': outs.push(`Set coil ${opd(o.address)}`); break;
          case 'RST': outs.push(`Reset coil ${opd(o.address)}`); break;
          case 'TMR': {
            const a = o.address.toUpperCase(), t = map.byBase.get(a);
            if (!t) break;
            if (o.mode === 'OFF_DELAY') {
              const q = map.offDelay.get(a)!;
              outs.push(`Set coil ${q.operand} (${q.name}, off-delay output)`);
              extra.push([`  Condition: Inverted contact (the condition above) AND [Direct contact ${q.operand}]`, `  → Timer coil ${t.operand} (TD, on-delay), ${preset(o)}`]);
              extra.push([`  Condition: [Direct contact ${t.operand}]`, `  → Reset coil ${q.operand}`]);
            } else {
              outs.push(`Timer coil ${t.operand} (${o.accumulate ? 'TA, accumulating' : 'TD, on-delay'}), ${preset(o)}`);
              if (o.accumulate && o.resetAddress) extra.push([`  Condition: [Direct contact ${opd(o.resetAddress)}]`, `  → Reset coil ${t.operand}`]);
            }
            break;
          }
          case 'CNT': {
            const ct = map.byBase.get(o.address.toUpperCase());
            if (!ct) break;
            const pv = /^\d+$/.test(o.preset.trim()) ? o.preset.trim() : opd(o.preset);
            outs.push(`${o.direction === 'DOWN' ? 'Decrement' : 'Increment'} ${ct.operand} (counts rising edges; counter preset ${pv})`);
            if (o.resetAddress) extra.push([`  Condition: [Direct contact ${opd(o.resetAddress)}]`, `  → Reset coil ${ct.operand}`]);
            break;
          }
          case 'COPY': outs.push(`Store: ${opd(o.dest)} ← ${opd(o.source)}`); break;
          case 'MATH': outs.push(`Math: ${opd(o.dest)} := ${o.expression.replace(OPERAND_RE, (t) => opd(t))} (build with Add / Sub / Mul / Div)`); break;
          case 'RAW': outs.push(o.vendor === 'unitronics-vision' ? o.text : rawTodo(o)); break;
        }
      }
      const main = ++net;
      lines.push(`Net ${main}${r.comment ? `: ${r.comment}` : ''}`, `  Condition: ${c}`, ...outs.map((x) => `  → ${x}`), '');
      for (const e of extra) lines.push(`Net ${++net} (with net ${main})`, ...e, '');
    }
  }
  const head = [
    ctx.header,
    'VisiLogic net listing: VisiLogic has no program import — enter each net in the Ladder editor. Operand descriptions: Edit › Import Operand Descriptions with the operands file (saved as .xls, sheet "Operands").',
    'Operands: every app operand is mapped below (I/O, MB bits, MI / ML integers, MF floats, T timers, C counters; SB 1 always ON, SB 2 power-up, SB 3 1-second pulse).',
    'Timers count down from the preset (10 ms resolution, max 99:59:59.99); the timer bit turns ON at 0.',
    ...map.errors.map((e) => `ERROR: ${e}`),
    '',
    '--- Operand map ---',
    ...[...map.byBase.entries()].map(([b, v]) => `${v.operand.padEnd(8)} ${b.padEnd(7)} ${v.name}`),
    ...[...map.analogRaw.values(), ...map.offDelay.values()].map((v) => `${v.operand.padEnd(8)} ${''.padEnd(7)} ${v.name}`),
    '',
  ];
  return [...head, ...lines].join('\r\n');
}

/** Operand descriptions in the layout of VisiLogic's Excel import (row 2 header; column A Address; one column per type). */
export function visiLogicOperandsCsv(program: LadderProgram, ctx: ExportContext): string {
  const map = visiOperands(program, ctx);
  const cols = ['MB', 'MI', 'ML', 'MF', 'T', 'C', 'I', 'O'] as const;
  const cells = new Map<string, string>();
  let max = -1;
  for (const v of [...map.byBase.values(), ...map.analogRaw.values(), ...map.offDelay.values()]) {
    if (!(cols as readonly string[]).includes(v.type)) continue;
    cells.set(`${v.type}:${v.index}`, v.name.replace(/\s+/g, '_').slice(0, 40));
    max = Math.max(max, v.index);
  }
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [q('Operands — open in Excel, save as .xls with this sheet named "Operands", then VisiLogic Edit › Import Operand Descriptions'), ['Address', ...cols].map(q).join(',')];
  for (let i = 0; i <= max; i++) if (cols.some((c) => cells.has(`${c}:${i}`))) rows.push([String(i), ...cols.map((c) => q(cells.get(`${c}:${i}`) ?? ''))].join(','));
  return rows.join('\r\n') + '\r\n';
}

const pad = (n: number) => String(n).padStart(2, '0');

const KNOWLEDGE = (c: CpuModel) => {
  const lim = visiLimits(c.id);
  const shared = String(getPart(c.id)?.ratings.analogSharedWith ?? '');
  return `Target: Unitronics ${c.label}, programmed in VisiLogic. Write the program in the app's neutral operands; the app maps them onto VisiLogic operands and writes a net listing:
- ${c.builtInInputs ? `On-board inputs X001–X0${pad(c.builtInInputs)} (I 0…) and outputs Y001–Y0${pad(c.builtInOutputs)} (O 0…)` : 'No on-board I/O: the snap-in module is slot 1 (X101… = I 0…)'}.${shared ? ` Inputs ${shared} double as the analog inputs: an analog channel in use takes that input.` : ''}
- C → MB, DS → MI, DD → ML, DF → MF, T → T (TD on-delay, TA accumulating; no off-delay timer — avoid OFF_DELAY), CT → C (Increment counts rising edges).
- This CPU has ${lim.T} timers, ${lim.C} counters, ${lim.MB} MB, ${lim.MI} MI, ${lim.MF} MF: keep the program within them.
- First scan SC2 → SB 2; SC1 → SB 1; SC7 → SB 3 (1-second pulse). No other SC bits or SD registers.`;
};

const EXPORTERS: ProgramExporter[] = [
  { id: 'visilogic-nets', label: 'Net listing to enter in VisiLogic (no program import exists)', fileName: (b) => `${b}_visilogic_nets.txt`, build: (p, c) => visiLogicListing(p, c) },
  { id: 'visilogic-operands', label: 'Operand descriptions (VisiLogic Excel import layout)', fileName: (b) => `${b}_visilogic_operands.csv`, build: (p, c) => visiLogicOperandsCsv(p, c) },
];

export const VISILOGIC_MNEMONICS: Record<string, string> = {
  NO: '-| |-', NC: '-|/|-', RISE: '-|P|-', FALL: '-|N|-', OUT: '-( )-', SET: '-(S)-', RST: '-(R)-',
  TMR_ON_DELAY: 'TD', TMR_OFF_DELAY: 'TD + MB', TMR_RTO: 'TA', CNT_UP: 'INC C', CNT_DOWN: 'DEC C',
  '==': '=', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=', COPY: 'STORE', MATH: 'MATH',
};

export const visionProfile: PlcProfile = {
  id: 'unitronics-vision',
  vendor: 'Unitronics',
  name: 'Vision / Samba (VisiLogic)',
  language: 'ladder',
  available: true,
  autoChoose: false,
  platformId: 'unitronics-vision',
  cpuModels: VISION_CPUS,
  defaultCpuId: 'V350-35-TR34',
  autoAddresses: (io, c, modules: ModuleSlot[]) => neutralAutoAddresses(io, c, modules, unitronicsAnalogChannels(c, modules), npnOutputsLast(c, modules)),
  parseAddress: unitronicsParse,
  promptKnowledge: KNOWLEDGE,
  checkRung: (rung) => {
    const issues: { severity: 'error' | 'warning'; message: string }[] = [];
    for (const e of rung.branches.flat()) for (const a of elementAddresses(e)) {
      if (/^SC\d+$/i.test(a) && !['SC1', 'SC2', 'SC7'].includes(a.toUpperCase())) issues.push({ severity: 'error', message: `${a}: no VisiLogic system bit for it (use SC1, SC2 or SC7 only).` });
    }
    for (const o of rung.outputs) {
      if (o.type === 'TMR' && /^\d+(\.\d+)?$/.test(o.preset.trim()) && Number(o.preset) * (UNIT_MS[o.unit] ?? 1000) > MAX_MS) issues.push({ severity: 'error', message: `${o.address}: VisiLogic timers go up to 99:59:59.99.` });
      if (o.type === 'TMR' && o.mode === 'OFF_DELAY') issues.push({ severity: 'warning', message: `${o.address}: VisiLogic has no off-delay timer; the listing builds it from a TD timer and an MB.` });
    }
    return issues;
  },
  dataTypeOf: neutralType,
  simSemantics: { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive },
  exporters: EXPORTERS,
  analogChannels: unitronicsAnalogChannels,
  mnemonics: VISILOGIC_MNEMONICS,
  ioTag: (a, _modules, cpuId) => visiIo(a, cpuId),
  importSteps: [
    'VisiLogic has no ladder or program import: enter each net from the net listing (or the printable ladder) in the Ladder editor. The operand map at the top says which VisiLogic operand each app address became.',
    'Open the operands CSV in Excel and save it as .xls with the sheet named "Operands" (header in row 2); then Edit › Import Operand Descriptions names every operand.',
    'In Hardware Configuration, set the snap-in / on-board I/O and link each analog input to the MI named in the listing; set the input jumpers (npn / pnp, analog) as the electrical drawings show.',
    'Download to the controller and test every step with the machine in a safe state.',
  ],
};
