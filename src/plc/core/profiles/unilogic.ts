/**
 * Unitronics UniStream (UniLogic).
 *
 * UniLogic has no ladder import of any kind (no text, XML or PLCopen); the one text import is Structured
 * Text: Solution Explorer › right-click a Ladder module › "Import ST Code From File" (.st) or "… From
 * Clipboard". It creates the ST functions, the global tags, structs and enums of the file (UniLogic help
 * "UniLogic AI"; release notes 1.42.220 / 1.42.285, 2026). So the export is:
 * - one .st file: the global tags (VAR_GLOBAL / VAR_GLOBAL RETAIN) and ST FUNCTION Machine_Logic holding the
 *   whole program, called from the Main ladder every scan. Facts used (UniLogic help, ST Language Reference /
 *   IEC Function Blocks): types BOOL, INT, DINT, REAL, TIME (T#5s; stored as ms); IEC blocks TON / TOF / CTU /
 *   CTD / R_TRIG / F_TRIG declared as instances, CTU / CTD PV and CV are INT; no retentive timer block (an
 *   accumulating timer is built from a TON and an accumulator); conversions TO_INT / TO_DINT; identifiers
 *   letters, digits and underscores. All tags are global because function locals are limited (256 bytes,
 *   UDFB topic) and cannot be retained.
 *   Inferred, not published: the exact grammar UniLogic expects for globals in an imported file (it is in the
 *   instruction file UniLogic writes locally) — the file uses standard IEC VAR_GLOBAL; check the import log.
 * - an I/O link list: UniLogic I/O are per-module structs bound in Hardware Configuration, not addresses,
 *   and imported ST "declares all I/O tags by name and type only" (UniLogic help) — the list says which
 *   module channel each I/O tag is linked to. UniLogic's tag Excel import takes only files exported from
 *   UniLogic (column layout not published), so no tag spreadsheet is written.
 */
import type { CpuModel, ExportContext, PlcProfile, ProgramExporter } from '../profile';
import { elementAddresses, type LadderProgram } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses } from './click';
import { toIecSt, type StDialect, type StProgram } from './iecSt';
import { UNISTREAM_CPUS, pointOf, npnOutputsLast, unitronicsAnalogChannels, unitronicsParse } from './unitronics';

const pad = (n: number) => String(n).padStart(2, '0');

/** UniLogic dialect: plain global tag names, IEC blocks, first scan from an Initialized flag. */
export const UNILOGIC_ST: StDialect = {
  vendor: 'unitronics-unistream',
  title: 'UniLogic: right-click a Ladder module › Import ST Code From File; call Machine_Logic from the Main ladder; link the I/O tags in Hardware Configuration (I/O link list).',
  // I/O are tags the engineer links to the module channel: no copy statement, the tag is the I/O.
  ioVar: () => null,
  ioTodo: () => '',
  ref: (n) => n,
  firstScan: 'FirstScan',
  types: { TON: 'TON', TOF: 'TOF', RTO: 'TON', CTU: 'CTU', CTD: 'CTD', R_TRIG: 'R_TRIG', F_TRIG: 'F_TRIG', BOOL: 'BOOL', DINT: 'DINT', REAL: 'REAL' },
  params: { rtoReset: 'R', ctuReset: 'R', ctdLoad: 'LD' },
  msToTime: (e) => (/^\d+$/.test(e) ? `T#${e}ms` : `TO_TIME(${e})`),
  timeToMs: (e) => `TO_DINT(${e})`,
  rtoEmulation: true,
  counterPv: (e) => `TO_INT(${e})`,
  prologue: ['(* First scan after every start *)', 'FirstScan := NOT Initialized;', 'Initialized := TRUE;'],
};

/** Setpoints, counters, run hours keep their value through a power cycle (CLICK keeps DS / DD / DF / CT retentive). */
const RETAIN_RE = /^(DS|DD|DH|DF|CT|CTD)\d+$|^T\d+_ACC$/i;

export interface UniLogicExport { st: string; program: StProgram }

export function buildUniLogicSt(program: LadderProgram, ctx: ExportContext): UniLogicExport {
  const st = toIecSt(program, ctx, UNILOGIC_ST);
  const line = (v: { name: string; type: string; comment: string }) => `   ${v.name} : ${v.type};   (* ${v.comment.replace(/[\r\n]+/g, ' ').replace(/\*\)/g, '* )')} *)`;
  const plain = st.variables.filter((v) => !RETAIN_RE.test(v.base));
  const retain = st.variables.filter((v) => RETAIN_RE.test(v.base));
  // Drop the I/O section headers the generator writes (no copy statements here: the tags are the I/O).
  const body = st.body.split('\n').filter((l) => l !== '(* ===== Inputs ===== *)' && l !== '(* ===== Outputs ===== *)').join('\n').replace(/\n{3,}/g, '\n\n');
  const [h1, h2, ...rest] = body.split('\n');
  const indent = (s: string) => (s ? `   ${s}` : s);
  const out = `${h1}
${h2}
(* I/O tags (names from the I/O list) are declared by name and type only: link each one to its module channel in Hardware Configuration. *)

VAR_GLOBAL
   Initialized : BOOL;   (* set after the first scan *)
   FirstScan : BOOL;   (* TRUE on the first scan after a start *)
${plain.map(line).join('\n')}
END_VAR
${retain.length ? `\nVAR_GLOBAL RETAIN\n${retain.map(line).join('\n')}\nEND_VAR\n` : ''}
FUNCTION Machine_Logic : BOOL
VAR_EXTERNAL
   Initialized : BOOL;
   FirstScan : BOOL;
${st.variables.map((v) => `   ${v.name} : ${v.type};`).join('\n')}
END_VAR
${rest.map(indent).join('\n').replace(/\s+$/, '')}
   Machine_Logic := TRUE;
END_FUNCTION
`;
  return { st: out, program: st };
}

/** Where each I/O tag is linked in Hardware Configuration: CPU on-board point or module channel. */
export function uniLogicIoLinks(program: LadderProgram, ctx: ExportContext): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const { program: st } = buildUniLogicSt(program, ctx);
  const modules = ctx.modules ?? [];
  const cpu = UNISTREAM_CPUS.find((c) => c.id === ctx.cpuId) ?? UNISTREAM_CPUS[1];
  const analog = new Map(unitronicsAnalogChannels(cpu, modules).map((c) => [c.address, c]));
  const ioPoint = new Map(ctx.io.map((p) => [(ctx.addresses.get(p.id) ?? '').toUpperCase(), p]));
  const rows = [['Tag', 'Type', 'Direction', 'Linked to (Hardware Configuration)', 'Terminal', 'Description', 'Note'].map(q).join(',')];
  for (const v of st.variables) {
    const pt = pointOf(v.base);
    const ch = analog.get(v.base);
    if (!pt && !(ch && ioPoint.has(v.base))) continue;
    const desc = ioPoint.get(v.base)?.description ?? v.comment;
    if (pt) {
      const where = pt.slot === 0 ? `${cpu.id} on-board ${pt.isInput ? 'input' : 'output'} ${pt.index}` : `Slot ${pt.slot} ${modules[pt.slot - 1]?.partNumber ?? 'module'} ${pt.isInput ? 'input' : 'output'} ${pt.index}`;
      rows.push([v.name, v.type, pt.isInput ? 'Input' : 'Output', where, `${pt.isInput ? 'I' : 'O'}${pt.index}`, desc, ''].map(q).join(','));
    } else if (ch) {
      const a = ioPoint.get(v.base)?.analog;
      rows.push([v.name, v.type, ch.kind === 'input' ? 'Analog input' : 'Analog output', ch.slot === 0 ? `${cpu.id} on-board ${ch.terminals[0]}` : `Slot ${ch.slot} ${ch.partNumber} ${ch.terminals[0]}`, ch.terminals[0], desc,
        a ? `Set the channel to ${a.range} and its scaling so the tag reads ${a.min}…${a.max} ${a.units} (raw range: see the module's guide)` : ''].map(q).join(','));
    }
  }
  return rows.join('\r\n') + '\r\n';
}

const KNOWLEDGE = (c: CpuModel) => `Target: Unitronics ${c.label}, programmed in UniLogic. Write the program in the app's neutral operands; the app exports a UniLogic Structured Text file (global tags + ST function Machine_Logic) and an I/O link list:
- ${c.builtInInputs ? `On-board inputs X001–X0${pad(c.builtInInputs)} and outputs Y001–Y0${pad(c.builtInOutputs)}` : 'No on-board I/O'}; Uni-I/O module points X1xx / Y1xx… (first digit = module in order). They become global tags named from the I/O description.
- C → BOOL, T → TON / TOF instances (T1 = .Q, TD1 = elapsed ms), accumulating timers are emulated, CT → CTU / CTD (PV and CV are INT: keep counts under 32767), DS / DD → DINT, DF → REAL. Name every operand in "tags" with a nickname (letters, digits, single underscores) — it becomes the tag name.
- Analog channels are DF registers in engineering units (scaled in the channel's Hardware Configuration).
- First scan SC2 → FirstScan (generated); SC1 → TRUE; SC7 → generated 1-second clock. No other SC bits or SD registers.`;

const EXPORTERS: ProgramExporter[] = [
  { id: 'unilogic-st', label: 'Structured Text for UniLogic (Import ST Code From File)', fileName: (b) => `${b}_unilogic.st`, build: (p, c) => buildUniLogicSt(p, c).st },
  { id: 'unilogic-io', label: 'I/O link list (Hardware Configuration)', fileName: (b) => `${b}_unilogic_io_links.csv`, build: (p, c) => uniLogicIoLinks(p, c) },
];

export const UNILOGIC_MNEMONICS: Record<string, string> = {
  NO: '-| |-', NC: '-|/|-', RISE: 'R_TRIG', FALL: 'F_TRIG', OUT: '-( )-', SET: '-(S)-', RST: '-(R)-',
  TMR_ON_DELAY: 'TON', TMR_OFF_DELAY: 'TOF', TMR_RTO: 'TON + accumulator', CNT_UP: 'CTU', CNT_DOWN: 'CTD',
  '==': '=', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=', COPY: ':=', MATH: ':=',
};

export const unistreamProfile: PlcProfile = {
  id: 'unitronics-unistream',
  vendor: 'Unitronics',
  name: 'UniStream (UniLogic)',
  language: 'ladder',
  available: true,
  autoChoose: false,
  platformId: 'unitronics-unistream',
  cpuModels: UNISTREAM_CPUS,
  defaultCpuId: 'US7-B10-TR22',
  autoAddresses: (io, c, modules) => neutralAutoAddresses(io, c, modules, unitronicsAnalogChannels(c, modules), npnOutputsLast(c, modules)),
  parseAddress: unitronicsParse,
  promptKnowledge: KNOWLEDGE,
  checkRung: (rung) => {
    const issues: { severity: 'error' | 'warning'; message: string }[] = [];
    for (const e of rung.branches.flat()) for (const a of elementAddresses(e)) {
      if (/^SC\d+$/i.test(a) && !['SC1', 'SC2', 'SC7'].includes(a.toUpperCase())) issues.push({ severity: 'error', message: `${a}: UniLogic has no equivalent system bit here (use SC1, SC2 or SC7 only).` });
    }
    for (const o of rung.outputs) if (o.type === 'CNT' && /^\d+$/.test(o.preset.trim()) && Number(o.preset) > 32767) issues.push({ severity: 'error', message: `${o.address}: UniLogic CTU / CTD presets are INT (at most 32767).` });
    return issues;
  },
  dataTypeOf: (a) => { const t = neutralType(a); return t === 'INT' || t === 'WORD' ? 'DINT' : t; },
  simSemantics: { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive },
  exporters: EXPORTERS,
  analogChannels: unitronicsAnalogChannels,
  mnemonics: UNILOGIC_MNEMONICS,
  ioTag: (a, modules) => { const p = pointOf(a); return p ? (p.slot === 0 ? `on-board ${p.isInput ? 'I' : 'O'}${p.index}` : `slot ${p.slot} ${modules[p.slot - 1]?.partNumber ?? ''} ${p.isInput ? 'I' : 'O'}${p.index}`.replace(/\s+/g, ' ')) : null; },
  importSteps: [
    'In UniLogic, right-click a Ladder module in Solution Explorer › Import ST Code From File, and pick the _unilogic.st file: it creates the global tags and the ST function Machine_Logic. UniLogic has no ladder import; this ST file is the only program import it offers.',
    'Call Machine_Logic from the Main ladder function on an unconditional rung, so it runs every scan.',
    'In Hardware Configuration, link each I/O tag to the module channel in the I/O link list (imported ST names I/O by name only), and set the analog channels\' range and scaling.',
    'The global-tag grammar of an imported file is not published by Unitronics (this file uses standard IEC VAR_GLOBAL): check the import messages and the TODO tab, then build, download and test every step with the machine in a safe state.',
  ],
};
