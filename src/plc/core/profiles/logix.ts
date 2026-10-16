/**
 * Allen-Bradley CompactLogix 5380 (Studio 5000 Logix Designer).
 *
 * Logix has no physical memory addresses: every operand is a tag. The app keeps its neutral memory
 * (X/Y by slot, C, T/TD, CT/CTD, DS/DD/DF — the same operand kinds the simulator and checker use) and
 * this profile maps it onto Logix tags at export (logixExport.ts) and in the program view:
 * - X / Y points → alias tags for the Compact 5000 I/O module points, `Local:<slot>:I.PtNN.Data` /
 *   `Local:<slot>:O.PtNN.Data` (5069-UM004H, App. B "Tag Name Conventions"); the controller is slot 0,
 *   the first 5069 module slot 1.
 * - analog channels → `Local:<slot>:I.ChNN.Data` / `O.ChNN.Data` (REAL), scaled to engineering units in
 *   the module configuration (C.ChNN.LowEngineering / HighEngineering; 5069-UM005).
 * - C → BOOL, T → TIMER (.DN / .ACC in ms), CT → COUNTER (.DN / .ACC), DS / DD → DINT, DF → REAL.
 * CPU part numbers are the ones in the Allen-Bradley equipment catalog.
 */
import type { AnalogChannel, CpuModel, ModuleSlot, PlcProfile, ProgramExporter, SimSemantics } from '../profile';
import type { AnalogRange } from '../../../types/io';
import type { Rung } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses, parseAddress } from './click';
import { buildL5x, logixIoMapping } from './l5x';

export const LOGIX_CPUS: CpuModel[] = [
  { id: '5069-L306ER', label: '5069-L306ER — CompactLogix 5380, Ethernet, up to 8 local modules', builtInInputs: 0, builtInOutputs: 0, notes: 'I/O comes from Compact 5000 (5069) modules in slots 1…8.' },
  { id: '5069-L310ER', label: '5069-L310ER — CompactLogix 5380, Ethernet, up to 8 local modules', builtInInputs: 0, builtInOutputs: 0, notes: 'I/O comes from Compact 5000 (5069) modules in slots 1…8.' },
  { id: '5069-L320ER', label: '5069-L320ER — CompactLogix 5380, Ethernet, up to 16 local modules (8 used by the app)', builtInInputs: 0, builtInOutputs: 0, notes: 'The app addresses modules in slots 1…8.' },
];

const pt = (n: number) => String(n).padStart(2, '0');

/** Analog channels of the 5069 modules, in slot order; inputs before outputs in a module. */
export function logixAnalogChannels(_cpu: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 0;
  const ranges: AnalogRange[] = ['4-20mA', '0-20mA', '0-10V', '0-5V'];
  modules.forEach((m, i) => {
    const slot = i + 1;
    for (let c = 0; c < (m.analogInputs ?? 0); c++) out.push({ kind: 'input', slot, channel: c + 1, partNumber: m.partNumber, label: `Slot ${slot} Ch${pt(c)}`, ranges, terminals: [`Ch${pt(c)}`], address: `DF${++df}` });
    for (let c = 0; c < (m.analogOutputs ?? 0); c++) out.push({ kind: 'output', slot, channel: c + 1, partNumber: m.partNumber, label: `Slot ${slot} Ch${pt(c)}`, ranges: ['4-20mA', '0-20mA', '0-10V'], terminals: [`Ch${pt(c)}`], address: `DF${++df}` });
  });
  return out;
}

/**
 * Logix module tag for a neutral I/O address: X203 → Local:2:I.Pt02.Data, Y101 → Local:1:O.Pt00.Data,
 * DF (analog channel) → Local:<slot>:I.ChNN.Data. Null when the address is not physical I/O.
 */
export function logixIoTag(address: string, modules: ModuleSlot[]): string | null {
  const a = address.toUpperCase();
  const io = /^([XY])([1-8])(\d\d)$/.exec(a);
  if (io) return `Local:${io[2]}:${io[1] === 'X' ? 'I' : 'O'}.Pt${pt(Number(io[3]) - 1)}.Data`;
  const ch = logixAnalogChannels(LOGIX_CPUS[0], modules).find((c) => c.address === a);
  return ch ? `Local:${ch.slot}:${ch.kind === 'input' ? 'I' : 'O'}.Ch${pt(ch.channel - 1)}.Data` : null;
}

/** Instruction names Studio 5000 shows for the app's ladder elements (1756-RM003). */
export const LOGIX_MNEMONICS: Record<string, string> = {
  NO: 'XIC', NC: 'XIO', RISE: 'XIC+ONS', FALL: 'XIO+ONS', OUT: 'OTE', SET: 'OTL', RST: 'OTU',
  TMR_ON_DELAY: 'TON', TMR_OFF_DELAY: 'TOF', TMR_RTO: 'RTO', CNT_UP: 'CTU', CNT_DOWN: 'CTD',
  '==': 'EQU', '<>': 'NEQ', '>': 'GRT', '>=': 'GEQ', '<': 'LES', '<=': 'LEQ', COPY: 'MOV', MATH: 'CPT',
};

const LOGIX_KNOWLEDGE = (cpu: CpuModel) => `Target: Allen-Bradley ${cpu.label}, programmed in Studio 5000 Logix Designer. Write the program in the app's neutral operands; the app exports them as Logix tags (L5X):
- Inputs X101–X816 and outputs Y101–Y816 (first digit = 5069 module slot 1–8, then point 01–16; the controller has no built-in I/O, so there is no X0xx/Y0xx). They become alias tags for Local:<slot>:I.PtNN.Data / O.PtNN.Data, named from the I/O description.
- Internal bits C1… → BOOL tags; timers T1… → TIMER tags (the done bit T1 is T1.DN, TD1 is the accumulated value); counters CT1… → COUNTER tags (CTD1 = .ACC); DS / DD registers → DINT tags; DF registers → REAL tags. Name every operand you use in "tags" with a Logix-legal nickname (letters, digits and single underscores, starting with a letter, at most 40 characters) — the nickname becomes the tag name.
- Analog channels are DF registers that already hold engineering units (the 5069 analog module scales them: LowEngineering / HighEngineering in its configuration).
- First scan: SC2 (exported as S:FS). SC1 (always on) is dropped from the rung; SC7 (1 s clock) is exported as a generated 1-second clock. Do not use other SC bits or SD registers — Logix has no equivalent.
- Contacts NO / NC / RISE / FALL (exported XIC / XIO / XIC+ONS / XIO+ONS), compares (EQU NEQ GRT GEQ LES LEQ), coils OUT / SET / RST (OTE / OTL / OTU), timers (TON / TOF, retentive = RTO with a reset rung), counters (CTU / CTD with a reset rung), COPY (MOV), MATH (CPT). Timer presets are exported in milliseconds.`;

function checkRung(rung: Rung) {
  const issues: { severity: 'error' | 'warning'; message: string }[] = [];
  const all = [...rung.branches.flat().flatMap((e) => (e.type === 'CMP' ? [e.left, e.right] : [e.address]))];
  for (const a of all) {
    const u = a.toUpperCase();
    if (/^SC\d+$/.test(u) && !['SC1', 'SC2', 'SC7'].includes(u)) issues.push({ severity: 'error', message: `${a}: Logix has no equivalent system bit (use SC1, SC2 or SC7 only).` });
    if (/^SD\d+$/.test(u)) issues.push({ severity: 'error', message: `${a}: Logix has no CLICK system registers.` });
    if (/^[XY]0\d\d$/.test(u)) issues.push({ severity: 'error', message: `${a}: CompactLogix 5380 has no built-in I/O — use a module slot (X1xx…).` });
  }
  for (const o of rung.outputs) {
    if (o.type === 'TMR' && o.accumulate && o.mode !== 'ON_DELAY') issues.push({ severity: 'error', message: `${o.address}: a retentive timer (RTO) is on-delay only.` });
  }
  return issues;
}

const LOGIX_SIM: SimSemantics = { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive };

const LOGIX_EXPORTERS: ProgramExporter[] = [
  { id: 'logix-l5x', label: 'Studio 5000 project (.L5X, File > Open/Import)', fileName: (b) => `${b}.L5X`, build: (p, c) => buildL5x(p, c) },
  { id: 'logix-io', label: 'I/O mapping for the 5069 modules (alias tag CSV + IO rungs)', fileName: (b) => `${b}_logix_io.csv`, build: (p, c) => logixIoMapping(p, c) },
];

export const logixProfile: PlcProfile = {
  id: 'logix',
  vendor: 'Allen-Bradley',
  name: 'CompactLogix 5380',
  language: 'ladder',
  available: true,
  autoChoose: false,
  cpuModels: LOGIX_CPUS,
  defaultCpuId: '5069-L310ER',
  autoAddresses: (io, cpu, modules) => neutralAutoAddresses(io, cpu, modules, logixAnalogChannels(cpu, modules)),
  parseAddress,
  promptKnowledge: LOGIX_KNOWLEDGE,
  checkRung,
  // Logix integers are DINT (32-bit) — the neutral DS registers export as DINT.
  dataTypeOf: (a) => { const t = neutralType(a); return t === 'INT' || t === 'WORD' ? 'DINT' : t; },
  simSemantics: LOGIX_SIM,
  exporters: LOGIX_EXPORTERS,
  analogChannels: logixAnalogChannels,
  mnemonics: LOGIX_MNEMONICS,
  ioTag: logixIoTag,
};
