/**
 * Siemens S7-1200 / S7-1200 G2 / S7-1500 + ET 200SP (TIA Portal).
 *
 * Export = an SCL external source file (FB "Machine" with the whole program as multi-instance code, its
 * instance DB and OB "Main") plus the PLC tag table as .sdf. TIA Portal imports both:
 * - external source: Project tree › External source files › Add new external file, then
 *   "Generate blocks from source" (TIA Portal help "Inserting external source files" / "Generating blocks
 *   from external source files", V20/V21); encoding UTF-8 with BOM; OBs need
 *   { S7_Optimized_Access := 'TRUE' } (OBs default to standard access); DATA_BLOCK / ORGANIZATION_BLOCK
 *   syntax per the help's S7-1200 source example ("Disabling SNMP").
 * - tag table: PLC tags › Import (.sdf, quoted comma-separated: Name, Address, Data type, Accessible,
 *   Visible, Retain, Comment, Value, Writable — help "Format of the export file (*.sdf)").
 * SCL facts from the S7-1200 System Manual V4.6 (A5E02486680-AP): global tags "Name", locals #Name,
 * multi-instance timers TON_TIME / TOF_TIME / TONR_TIME called #T(IN :=, PT :=) with TONR reset R, counters
 * CTU_DINT (CU, R, PV) / CTD_DINT (CD, LD, PV), R_TRIG / F_TRIG (CLK), TIME stored as DInt ms, analog nominal
 * range 0…27648 scaled with NORM_X / SCALE_X (pp.92, 178–212, 268).
 * Inferred (not in a Siemens text): the FUNCTION_BLOCK and instance DATA_BLOCK source layout (same pattern
 * as the documented DATA_BLOCK / OB), and the default I/O addresses of signal modules (S7-1200 SM slot n at
 * byte 8 + 4·(n−2), analog at IW96 + 16·(n−2), onboard AI at IW64; ET 200SP / S7-1500 packed from 0) —
 * every module tag is marked "check against Device configuration".
 */
import type { AnalogChannel, CpuModel, ExportContext, ModuleSlot, PlcProfile, ProgramExporter } from '../profile';
import type { AnalogRange } from '../../../types/io';
import { elementAddresses, isBlockRaw, type LadderOutput, type LadderProgram } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses, parseAddress } from './click';
import { toIecSt, type StDialect, type StProgram, type StVariable } from './iecSt';
import { logixName } from './logixExport';
import { getPart } from '../../../electrical/catalog';
import { outsideUserText } from '../userText';

type Family = 'S7-1200' | 'S7-1500';

const cpu = (id: string, platformId: string, inputs: number, outputs: number, label: string): CpuModel => ({ id, label, builtInInputs: inputs, builtInOutputs: outputs, platformId });

export const SIEMENS_CPUS: CpuModel[] = [
  cpu('6ES7212-1AE40-0XB0', 'siemens-s7-1200', 8, 6, '6ES7212-1AE40-0XB0 — S7-1200 CPU 1212C DC/DC/DC, 8 DI / 6 DQ / 2 AI'),
  cpu('6ES7214-1AG40-0XB0', 'siemens-s7-1200', 14, 10, '6ES7214-1AG40-0XB0 — S7-1200 CPU 1214C DC/DC/DC, 14 DI / 10 DQ / 2 AI'),
  cpu('6ES7215-1AG40-0XB0', 'siemens-s7-1200', 14, 10, '6ES7215-1AG40-0XB0 — S7-1200 CPU 1215C DC/DC/DC, 14 DI / 10 DQ / 2 AI / 2 AO'),
  cpu('6ES7212-1AG50-0XB0', 'siemens-s7-1200-g2', 8, 6, '6ES7212-1AG50-0XB0 — S7-1200 G2 CPU 1212C DC/DC/DC, 8 DI / 6 DQ'),
  cpu('6ES7214-1AH50-0XB0', 'siemens-s7-1200-g2', 14, 10, '6ES7214-1AH50-0XB0 — S7-1200 G2 CPU 1214C DC/DC/DC, 14 DI / 10 DQ'),
  cpu('6ES7511-1AL03-0AB0', 'siemens-s7-1500', 0, 0, '6ES7511-1AL03-0AB0 — S7-1500 CPU 1511-1 PN (I/O on ET 200SP)'),
  cpu('6ES7513-1AM03-0AB0', 'siemens-s7-1500', 0, 0, '6ES7513-1AM03-0AB0 — S7-1500 CPU 1513-1 PN (I/O on ET 200SP)'),
];

const familyOf = (c: CpuModel | undefined): Family => (c?.platformId === 'siemens-s7-1500' ? 'S7-1500' : 'S7-1200');
const cpuAnalog = (c: CpuModel) => { const r = getPart(c.id)?.ratings ?? {}; return { ai: Number(r.analogInputs ?? 0), ao: Number(r.analogOutputs ?? 0) }; };

/** Analog channels: CPU onboard first, then modules in slot order (inputs before outputs). */
export function siemensAnalogChannels(c: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 0;
  const ranges: AnalogRange[] = ['4-20mA', '0-20mA', '0-10V'];
  const on = cpuAnalog(c);
  for (let i = 0; i < on.ai; i++) out.push({ kind: 'input', slot: 0, channel: i + 1, partNumber: c.id, label: `CPU AI${i}`, ranges: ['0-10V'], terminals: [`AI${i}`], address: `DF${++df}` });
  for (let i = 0; i < on.ao; i++) out.push({ kind: 'output', slot: 0, channel: i + 1, partNumber: c.id, label: `CPU AQ${i}`, ranges: ['0-20mA'], terminals: [`AQ${i}`], address: `DF${++df}` });
  modules.forEach((m, k) => {
    for (let i = 0; i < (m.analogInputs ?? 0); i++) out.push({ kind: 'input', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Module ${k + 1} AI${i}`, ranges, terminals: [`AI${i}`], address: `DF${++df}` });
    for (let i = 0; i < (m.analogOutputs ?? 0); i++) out.push({ kind: 'output', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Module ${k + 1} AQ${i}`, ranges, terminals: [`AQ${i}`], address: `DF${++df}` });
  });
  return out;
}

/**
 * S7 address of a neutral physical point. Onboard (X0nn/Y0nn) = %I/%Q from byte 0 (built-in DQ from Q0.0,
 * S7-1200 manual p.439). Module points and analog words follow the default layout described in the header
 * (inferred): `inferred` is true for those.
 */
export function siemensAddress(base: string, c: CpuModel, modules: ModuleSlot[]): { address: string; inferred: boolean } | null {
  const fam = familyOf(c);
  const a = base.toUpperCase();
  const bit = (byte: number, n: number) => `${byte + (n >> 3)}.${n & 7}`;
  const io = /^([XY])(\d)(\d\d)$/.exec(a);
  if (io) {
    const isIn = io[1] === 'X', slot = Number(io[2]), n = Number(io[3]) - 1;
    const area = isIn ? 'I' : 'Q';
    if (slot === 0) return { address: `%${area}${bit(0, n)}`, inferred: false };
    if (fam === 'S7-1200') return { address: `%${area}${bit(8 + 4 * (slot - 1), n)}`, inferred: true };
    // S7-1500 / ET 200SP: modules packed from byte 0 in slot order, ceil(points / 8) bytes each.
    let byte = 0;
    for (let k = 0; k < slot - 1; k++) byte += Math.ceil((isIn ? modules[k]?.inputs ?? 0 : modules[k]?.outputs ?? 0) / 8);
    return { address: `%${area}${bit(byte, n)}`, inferred: true };
  }
  const ch = siemensAnalogChannels(c, modules).find((x) => x.address === a);
  if (!ch) return null;
  const area = ch.kind === 'input' ? 'IW' : 'QW';
  if (ch.slot === 0) return { address: `%${area}${64 + 2 * (ch.channel - 1)}`, inferred: true };
  if (fam === 'S7-1200') return { address: `%${area}${96 + 16 * (ch.slot - 1) + 2 * (ch.channel - 1)}`, inferred: true };
  // S7-1500: analog words after the digital bytes of the same direction, 2 bytes per channel.
  let byte = 0;
  for (let k = 0; k < modules.length; k++) {
    const m = modules[k];
    if (ch.kind === 'input') byte += Math.ceil((m.inputs ?? 0) / 8); else byte += Math.ceil((m.outputs ?? 0) / 8);
  }
  for (let k = 0; k < ch.slot - 1; k++) byte += 2 * (ch.kind === 'input' ? modules[k].analogInputs ?? 0 : modules[k].analogOutputs ?? 0);
  if (byte % 2) byte++;
  return { address: `%${area}${byte + 2 * (ch.channel - 1)}`, inferred: true };
}

export interface SiemensTag { name: string; address: string; type: 'Bool' | 'Int'; comment: string; inferred: boolean }

/** SCL instruction and type names (also used to write changes into an original SCL source, import/stPatch.ts). */
export const SCL_BLOCKS: Pick<StDialect, 'types' | 'params' | 'msToTime' | 'timeToMs'> = {
  types: { TON: 'TON_TIME', TOF: 'TOF_TIME', RTO: 'TONR_TIME', CTU: 'CTU_DINT', CTD: 'CTD_DINT', R_TRIG: 'R_TRIG', F_TRIG: 'F_TRIG', BOOL: 'Bool', DINT: 'DInt', REAL: 'Real' },
  params: { rtoReset: 'R', ctuReset: 'R', ctdLoad: 'LD' },
  msToTime: (e) => (/^\d+$/.test(e) ? `T#${e}ms` : `DINT_TO_TIME(${e})`),
  timeToMs: (e) => `TIME_TO_DINT(${e})`,
};

/** SCL dialect: FB statics referenced as #Name, PLC tags "Name", analog raw words scaled with NORM_X / SCALE_X. */
function sclDialect(ctx: ExportContext, c: CpuModel, tags: SiemensTag[]): StDialect {
  const modules = ctx.modules ?? [];
  const analog = new Map(ctx.io.filter((p) => p.signal === 'analog' && p.analog).map((p) => [ctx.addresses.get(p.id)?.toUpperCase() ?? '', p]));
  return {
    vendor: 'siemens-s7',
    title: 'TIA Portal SCL external source: External source files › Add new external file, then "Generate blocks from source".',
    ioVar: (base, name) => {
      const s = siemensAddress(base, c, modules);
      if (!s || !/^[XY]/.test(base)) return null;
      tags.push({ name, address: s.address, type: 'Bool', comment: ctx.labels.get(base) ?? `${base.startsWith('X') ? 'Input' : 'Output'} ${s.address}`, inferred: s.inferred });
      return `"${name}"`;
    },
    ioTodo: (_base, name) => `(* TODO ${name}: no address on this CPU *)`,
    // A register the project gives no name: named by its type, never by the CLICK register ("DS1119").
    unnamed: (base) => {
      const m = /^(X|Y|C|T|CT|DS|DD|DH|DF|TXT|SD)(\d+)$/.exec(base);
      const kind: Record<string, string> = { X: 'Input', Y: 'Output', C: 'Flag', T: 'Timer', CT: 'Counter', DS: 'Int', DD: 'DInt', DH: 'Word', DF: 'Real', TXT: 'Text', SD: 'System' };
      return m ? { name: `${kind[m[1]]}_${m[2]}`, comment: 'no name in the project' } : undefined;
    },
    // Kept SCL of the original program reads / writes the channel's raw word (Int 0…27648), as it did.
    rawWord: (base, ref) => (analog.has(base) ? `"${ref.replace(/^#/, '')}_raw"` : null),
    ref: (n) => `#${n}`,
    firstScan: '#FirstScan',
    ...SCL_BLOCKS,
    prologue: ['(* First scan after every start (non-retentive statics restart at FALSE) *)', '#FirstScan := NOT #Initialized;', '#Initialized := TRUE;'],
    ioExtra: (vars: Map<string, StVariable>) => {
      const inputs: string[] = [], outputs: string[] = [];
      for (const [base, v] of vars) {
        const p = analog.get(base);
        if (!p || !p.analog) continue;
        const s = siemensAddress(base, c, modules);
        if (!s) continue;
        const raw = `${v.name}_raw`;
        tags.push({ name: raw, address: s.address, type: 'Int', comment: `${p.description} (${p.analog.range}, raw 0…27648 = ${p.analog.min}…${p.analog.max} ${p.analog.units})`, inferred: s.inferred });
        const lo = p.analog.min.toFixed(1), hi = p.analog.max.toFixed(1);
        if (p.type === 'input') inputs.push(`#${v.name} := SCALE_X(MIN := ${lo}, VALUE := NORM_X(MIN := 0, VALUE := "${raw}", MAX := 27648), MAX := ${hi});`);
        else outputs.push(`"${raw}" := REAL_TO_INT(SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := ${lo}, VALUE := #${v.name}, MAX := ${hi}), MAX := 27648.0));`);
      }
      return { inputs, outputs };
    },
  };
}

/**
 * A comment in the program's own names: the app's operands an HMI description quotes ("Safety OK (X001)", "within
 * DS1001 seconds", "Reset (C1003)") become the SCL names a TIA user sees — PLC tags "Safety_OK", statics
 * #SP_Head_Timeout, timer / counter values #Tmr.ET / #Cnt.CV. Operands the program does not have are left as they are.
 */
export function sclComment(text: string, variables: StVariable[], users: string[] = []): string {
  const ref = new Map<string, string>();
  for (const v of variables) ref.set(v.base.toUpperCase(), v.io ?? `#${v.name}`);
  return outsideUserText(text, users, (m) => {
    const [, p, n] = /^([A-Z]+)(\d+)$/.exec(m) ?? [];
    if (p === 'TD') { const t = ref.get(`T${n}`); return t ? `${t}.ET` : m; }
    if (p === 'CTD') { const c = ref.get(`CT${n}`); return c ? `${c}.CV` : m; }
    return ref.get(m) ?? m;
  });
}

/** TIA Portal reads external sources as UTF-8 only with a byte-order mark. */
const BOM = '\uFEFF';

export interface SclExport { scl: string; tags: SiemensTag[]; st: StProgram }

/** The SCL external source (UTF-8 with BOM) and the PLC tags it uses. */
export function buildScl(program: LadderProgram, ctx: ExportContext): SclExport {
  const c = SIEMENS_CPUS.find((x) => x.id === ctx.cpuId) ?? SIEMENS_CPUS[1];
  const tags: SiemensTag[] = [];
  // Whole SCL blocks kept from an imported program (an FC the ladder model can't hold) go in as blocks of their own.
  const blocks: string[] = [];
  const own = (x: LadderOutput) => x.type === 'RAW' && x.vendor === 'siemens-s7' && isBlockRaw(x);
  for (const r of program.rungs) for (const o of r.outputs) if (own(o) && o.type === 'RAW') blocks.push(o.text.trim());
  const rest: LadderProgram = { ...program, rungs: program.rungs.map((r) => ({ ...r, outputs: r.outputs.filter((o) => !own(o)) })).filter((r) => r.outputs.length) };
  const st = toIecSt(rest, ctx, sclDialect(ctx, c, tags));
  // Setpoints, counters and run hours survive a power cycle (CLICK keeps DS / DD / DH / DF registers and
  // counters retentive): those statics are RETAIN in the optimized instance DB, the rest are not.
  const RETAIN_RE = /^(DS|DD|DH|DF|CT|CTD)\d+$/i;
  // The user's own texts a comment quotes (I/O descriptions, tag comments, rung comments) keep their words.
  // Comments the app or its AI wrote (tag and rung comments) speak the program's names; the user's own I/O
  // descriptions and kept code of another PLC stay as written.
  const users = [...ctx.io.map((x) => x.description), ctx.header, ...program.rungs.flatMap((r) => r.outputs.flatMap((o) => (o.type === 'RAW' ? [o.text] : [])))]
    .map((t) => t.trim()).filter((t) => t && !/^[A-Z]+\d+$/i.test(t)).sort((a, b) => b.length - a.length);
  const line = (v: StVariable) => `      ${v.name} : ${v.type};   // ${(v.comment === v.base ? v.comment : sclComment(v.comment, st.variables, users)).replace(/[\r\n]+/g, ' ')}`;
  const decl = [
    '      Initialized : Bool;   // set after the first scan',
    '      FirstScan : Bool;   // TRUE on the first scan after a start',
    ...st.variables.filter((v) => !RETAIN_RE.test(v.base)).map(line),
  ];
  const retain = st.variables.filter((v) => RETAIN_RE.test(v.base)).map(line);
  const indent = (s: string) => (s ? `   ${s}` : s);
  // Rung comments in the program's own names too ("preset is the HMI setpoint #SP_Push_Time", not DS1001).
  const body = st.body.replace(/\(\* ([\s\S]*?) \*\)/g, (_m, t: string) => `(* ${sclComment(t, st.variables, users)} *)`).split('\n').map(indent).join('\n');
  const scl = `${BOM}${blocks.map((b) => `${b}\n\n`).join('')}FUNCTION_BLOCK "Machine"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR
${decl.join('\n')}
   END_VAR
${retain.length ? `   VAR RETAIN\n${retain.join('\n')}\n   END_VAR\n` : ''}
BEGIN
${body}
END_FUNCTION_BLOCK

DATA_BLOCK "Machine_DB"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
"Machine"

BEGIN
END_DATA_BLOCK

ORGANIZATION_BLOCK "Main"
TITLE = "Main Program Sweep (Cycle)"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
BEGIN
   "Machine_DB"();
END_ORGANIZATION_BLOCK
`;
  return { scl, tags, st };
}

/**
 * Tags for the wired I/O points the program does not use (yet): TIA users expect every terminal of the I/O list in
 * the tag table, with its description. Named like the program's tags; said in the comment.
 */
export function unusedIoTags(program: LadderProgram, ctx: ExportContext): SiemensTag[] {
  const c = SIEMENS_CPUS.find((x) => x.id === ctx.cpuId) ?? SIEMENS_CPUS[1];
  const modules = ctx.modules ?? [];
  const have = buildScl(program, ctx).tags;
  const at = new Set(have.map((t) => t.address));
  const used = new Set(have.map((t) => t.name.toLowerCase()));
  const out: SiemensTag[] = [];
  for (const p of ctx.io) {
    const base = ctx.addresses.get(p.id)?.toUpperCase() ?? '';
    const s = base ? siemensAddress(base, c, modules) : null;
    if (!s || at.has(s.address)) continue;
    const analog = p.signal === 'analog';
    // The name as written (with _raw for an analog word) is the one reserved: no two tags share a name.
    const name = logixName(analog ? `${p.description || base}_raw` : p.description || base, used, base);
    at.add(s.address);
    out.push({ name, address: s.address, type: analog ? 'Int' : 'Bool', comment: `${p.description || base} (not used by the program yet)`, inferred: s.inferred });
  }
  return out;
}

/** PLC tag table for TIA Portal import (.sdf). Module tags whose address is inferred say so in the comment. */
export function siemensTagsSdf(program: LadderProgram, ctx: ExportContext): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const tags = [...buildScl(program, ctx).tags, ...unusedIoTags(program, ctx)];
  return tags.map((t) => [t.name, t.address, t.type, 'True', 'True', 'False', t.inferred ? `${t.comment} — check against Device configuration` : t.comment, '', 'True'].map(q).join(',')).join('\r\n') + '\r\n';
}

const KNOWLEDGE = (c: CpuModel) => `Target: Siemens ${c.label}, programmed in TIA Portal. Write the program in the app's neutral operands; the app exports an SCL source (FB "Machine", its instance DB, OB "Main") and the PLC tag table:
- ${c.builtInInputs ? `Onboard inputs X001–X0${String(c.builtInInputs).padStart(2, '0')} (%I0.0…) and outputs Y001–Y0${String(c.builtInOutputs).padStart(2, '0')} (%Q0.0…)` : 'No onboard I/O'}; module points X1xx / Y1xx… (first digit = module in order). They become PLC tags named from the I/O description.
- Internal bits C → Bool statics, T → TON_TIME / TOF_TIME / TONR_TIME instances (T1 = .Q, TD1 = elapsed time), CT → CTU_DINT / CTD_DINT (CTD1 = .CV), DS / DD → DInt, DF → Real. Name every operand in "tags" with a nickname (letters, digits, single underscores) — it becomes the variable name.
- Analog channels are DF registers in engineering units: the export scales the raw word (0…27648) with NORM_X / SCALE_X, so the program never sees raw counts.
- First scan SC2 → #FirstScan (generated); SC1 → TRUE; SC7 → generated 1-second clock. No other SC bits or SD registers.`;

const EXPORTERS: ProgramExporter[] = [
  { id: 'siemens-scl', label: 'SCL external source for TIA Portal (Generate blocks from source)', fileName: (b) => `${b}_s7.scl`, build: (p, c) => buildScl(p, c).scl },
  { id: 'siemens-tags', label: 'PLC tag table (TIA Portal PLC tags › Import, .sdf)', fileName: (b) => `${b}_PLCTags.sdf`, build: (p, c) => siemensTagsSdf(p, c) },
];

export const SIEMENS_MNEMONICS: Record<string, string> = {
  NO: '-| |-', NC: '-|/|-', RISE: 'R_TRIG', FALL: 'F_TRIG', OUT: '-( )-', SET: '-(S)-', RST: '-(R)-',
  TMR_ON_DELAY: 'TON', TMR_OFF_DELAY: 'TOF', TMR_RTO: 'TONR', CNT_UP: 'CTU', CNT_DOWN: 'CTD',
  '==': 'CMP ==', '<>': 'CMP <>', '>': 'CMP >', '>=': 'CMP >=', '<': 'CMP <', '<=': 'CMP <=', COPY: 'MOVE', MATH: 'CALCULATE',
};

export const siemensProfile: PlcProfile = {
  id: 'siemens-s7',
  vendor: 'Siemens',
  name: 'S7-1200 / S7-1500',
  language: 'ladder',
  available: true,
  autoChoose: false,
  platformId: 'siemens-s7-1200',
  cpuModels: SIEMENS_CPUS,
  defaultCpuId: '6ES7214-1AG40-0XB0',
  autoAddresses: (io, c, modules) => neutralAutoAddresses(io, c, modules, siemensAnalogChannels(c, modules)),
  parseAddress,
  promptKnowledge: KNOWLEDGE,
  checkRung: (rung) => {
    const issues: { severity: 'error' | 'warning'; message: string }[] = [];
    for (const e of rung.branches.flat()) for (const a of elementAddresses(e)) {
      if (/^SC\d+$/i.test(a) && !['SC1', 'SC2', 'SC7'].includes(a.toUpperCase())) issues.push({ severity: 'error', message: `${a}: S7 has no equivalent system bit (use SC1, SC2 or SC7 only).` });
    }
    return issues;
  },
  dataTypeOf: (a) => { const t = neutralType(a); return t === 'INT' || t === 'WORD' ? 'DINT' : t; },
  simSemantics: { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive },
  exporters: EXPORTERS,
  analogChannels: siemensAnalogChannels,
  mnemonics: SIEMENS_MNEMONICS,
  // The project's own CPU (an S7-1500 numbers module bytes differently from an S7-1200).
  ioTag: (a, modules, cpuId) => siemensAddress(a, SIEMENS_CPUS.find((c) => c.id === cpuId) ?? SIEMENS_CPUS[1], modules)?.address ?? null,
};
