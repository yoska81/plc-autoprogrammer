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
import { elementAddresses, type Rung } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses, parseAddress } from './click';
import { buildL5x, logixIoMapping } from './l5x';

export const LOGIX_CPUS: CpuModel[] = [
  { id: '5069-L306ER', label: '5069-L306ER — CompactLogix 5380, Ethernet, up to 8 local modules', builtInInputs: 0, builtInOutputs: 0, notes: 'I/O comes from Compact 5000 (5069) modules in slots 1…8.' },
  { id: '5069-L310ER', label: '5069-L310ER — CompactLogix 5380, Ethernet, up to 8 local modules', builtInInputs: 0, builtInOutputs: 0, notes: 'I/O comes from Compact 5000 (5069) modules in slots 1…8.' },
  { id: '5069-L320ER', label: '5069-L320ER — CompactLogix 5380, Ethernet, up to 16 local modules (8 used by the app)', builtInInputs: 0, builtInOutputs: 0, notes: 'The app addresses modules in slots 1…8.' },
  // CompactLogix 5370 (1769): the CPU named in an upgraded .L5X; 1769 I/O addressing (Local:n:I.Data) is handled with the 1769 modules.
  { id: '1769-L30ER', label: '1769-L30ER — CompactLogix 5370 L3 controller, Ethernet, up to 8 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 8 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 16 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L30ERM', label: '1769-L30ERM — CompactLogix 5370 L3 motion controller, Ethernet, up to 8 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 8 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 16 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L30ER-NSE', label: '1769-L30ER-NSE — CompactLogix 5370 L3 controller, Ethernet, up to 8 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 8 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 16 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L33ER', label: '1769-L33ER — CompactLogix 5370 L3 controller, Ethernet, up to 16 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 16 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 32 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L33ERM', label: '1769-L33ERM — CompactLogix 5370 L3 motion controller, Ethernet, up to 16 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 16 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 32 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L36ERM', label: '1769-L36ERM — CompactLogix 5370 L3 motion controller, Ethernet, up to 30 local I/O modules', builtInInputs: 0, builtInOutputs: 0, notes: 'No embedded I/O: all local I/O comes from up to 30 1769 Compact I/O modules (up to 3 banks, powered by a 1769-PA2/PB2/PA4/PB4 supply, right end cap required), plus distributed EtherNet/IP I/O (up to 48 nodes).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L16ER-BB1B', label: '1769-L16ER-BB1B — CompactLogix 5370 L1 controller, Ethernet, up to 6 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sinking inputs and 16 x 24V DC sourcing outputs; local expansion is 1734 POINT I/O (up to 6 modules, not 1769 Compact I/O), within the 1 A POINTBus and 3 A field-power budget. Check in Studio 5000 (I/O Configuration) that the embedded I/O is Local:1 as the app writes it; the app does not address the 1734 POINT I/O expansion.' , platformId: 'ab-compactlogix-5370-l1' },
  { id: '1769-L18ER-BB1B', label: '1769-L18ER-BB1B — CompactLogix 5370 L1 controller, Ethernet, up to 8 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sinking inputs and 16 x 24V DC sourcing outputs; local expansion is 1734 POINT I/O (up to 8 modules, not 1769 Compact I/O), within the 1 A POINTBus and 3 A field-power budget. Check in Studio 5000 (I/O Configuration) that the embedded I/O is Local:1 as the app writes it; the app does not address the 1734 POINT I/O expansion.' , platformId: 'ab-compactlogix-5370-l1' },
  { id: '1769-L18ERM-BB1B', label: '1769-L18ERM-BB1B — CompactLogix 5370 L1 motion controller, Ethernet, up to 8 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sinking inputs and 16 x 24V DC sourcing outputs; local expansion is 1734 POINT I/O (up to 8 modules, not 1769 Compact I/O), within the 1 A POINTBus and 3 A field-power budget. Check in Studio 5000 (I/O Configuration) that the embedded I/O is Local:1 as the app writes it; the app does not address the 1734 POINT I/O expansion.' , platformId: 'ab-compactlogix-5370-l1' },
  { id: '1769-L24ER-QB1B', label: '1769-L24ER-QB1B — CompactLogix 5370 L2 controller, Ethernet, up to 4 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sink/source inputs and 16 x 24V DC sourcing outputs; up to 4 more 1769 Compact I/O modules mount to the right of the embedded I/O, powered by the controller\'s built-in 24V DC supply, with a 1769-ECR end cap. Check in Studio 5000 (I/O Configuration) the slot numbers the app gives the expansion modules after the embedded I/O, and the embedded analog tag names (Ch<n>Data).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L24ER-QBFC1B', label: '1769-L24ER-QBFC1B — CompactLogix 5370 L2 controller, Ethernet, up to 4 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sink/source inputs and 16 x 24V DC sourcing outputs plus 4 analog inputs, 2 analog outputs and 4 high-speed counters; up to 4 more 1769 Compact I/O modules mount to the right of the embedded I/O, powered by the controller\'s built-in 24V DC supply, with a 1769-ECR end cap. Check in Studio 5000 (I/O Configuration) the slot numbers the app gives the expansion modules after the embedded I/O, and the embedded analog tag names (Ch<n>Data).' , platformId: 'ab-compactlogix-5370' },
  { id: '1769-L27ERM-QBFC1B', label: '1769-L27ERM-QBFC1B — CompactLogix 5370 L2 motion controller, Ethernet, up to 4 local I/O modules', builtInInputs: 16, builtInOutputs: 16, notes: 'Embedded 16 x 24V DC sink/source inputs and 16 x 24V DC sourcing outputs plus 4 analog inputs, 2 analog outputs and 4 high-speed counters; up to 4 more 1769 Compact I/O modules mount to the right of the embedded I/O, powered by the controller\'s built-in 24V DC supply, with a 1769-ECR end cap. Check in Studio 5000 (I/O Configuration) the slot numbers the app gives the expansion modules after the embedded I/O, and the embedded analog tag names (Ch<n>Data).' , platformId: 'ab-compactlogix-5370' },
];

const pt = (n: number) => String(n).padStart(2, '0');

/** CompactLogix 5370 (1769): module tags are Local:<slot>:I.Data.<bit> (a DINT per module) and Local:<slot>:I.Ch<n>Data. */
const is1769 = (id: string | undefined) => /^1769-/i.test(id ?? '');
/**
 * Slot of the first expansion module (1769-UM021: Controller Organizer). An L2 controller's embedded I/O takes the
 * first slots: discrete in slot 1, and on a -QBFC1B the analog in slot 2 and the counters in slot 3; an L3 has none.
 * An L1 expands with 1734 POINT I/O, never 1769 modules (see l1).
 */
const firstSlot = (cpuId: string | undefined) => (/^1769-L2\d.*QBFC/i.test(cpuId ?? '') ? 4 : /^1769-L(1|2)\d/i.test(cpuId ?? '') ? 2 : 1);
/** 1769-L1 (L16 / L18): local expansion is 1734 POINT I/O, which the app does not address. */
const l1 = (cpuId: string | undefined) => /^1769-L1\d/i.test(cpuId ?? '');
const embeddedAnalog = (cpu: CpuModel) => (/^1769-L2\d.*QBFC/i.test(cpu.id) ? { ai: 4, ao: 2 } : { ai: 0, ao: 0 });

/** Analog channels: a 1769-L2…QBFC1B's embedded analog first, then the modules in slot order; inputs before outputs in a module. */
export function logixAnalogChannels(cpu: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 0;
  const ranges: AnalogRange[] = ['4-20mA', '0-20mA', '0-10V', '0-5V'];
  const on = embeddedAnalog(cpu);
  for (let c = 0; c < on.ai; c++) out.push({ kind: 'input', slot: 0, channel: c + 1, partNumber: cpu.id, label: `Embedded analog Ch${c}`, ranges: ['4-20mA', '0-20mA', '0-10V'], terminals: [`IN${c}`], address: `DF${++df}` });
  for (let c = 0; c < on.ao; c++) out.push({ kind: 'output', slot: 0, channel: c + 1, partNumber: cpu.id, label: `Embedded analog out Ch${c}`, ranges: ['4-20mA', '0-20mA', '0-10V'], terminals: [`OUT${c}`], address: `DF${++df}` });
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
export function logixIoTag(address: string, modules: ModuleSlot[], cpuId?: string): string | null {
  const a = address.toUpperCase();
  const cpu = LOGIX_CPUS.find((c) => c.id === cpuId) ?? LOGIX_CPUS[0];
  const io = /^([XY])(\d)(\d\d)$/.exec(a);
  if (io) {
    const dir = io[1] === 'X' ? 'I' : 'O', slot = Number(io[2]), n = Number(io[3]) - 1;
    // A 1769-L1 / L2's embedded discrete I/O (X001…): Local:1:I.Data.0…
    if (slot === 0) return is1769(cpu.id) && cpu.builtInInputs + cpu.builtInOutputs > 0 ? `Local:1:${dir}.Data.${n}` : null;
    // An L1 takes no 1769 modules: its expansion (1734 POINT I/O) is not addressed here.
    if (l1(cpu.id)) return null;
    if (is1769(modules[slot - 1]?.partNumber) || (is1769(cpu.id) && !modules[slot - 1])) return `Local:${slot - 1 + firstSlot(cpu.id)}:${dir}.Data.${n}`;
    return `Local:${slot}:${dir}.Pt${pt(n)}.Data`;
  }
  const ch = logixAnalogChannels(cpu, modules).find((c) => c.address === a);
  if (!ch) return null;
  const dir = ch.kind === 'input' ? 'I' : 'O';
  // Embedded analog (QBFC1B, slot 2): the manual gives its data as words 0–3; the member names follow the 1769 analog
  // modules (Ch<n>Data), to check against a Studio 5000 export.
  if (ch.slot === 0) return `Local:2:${dir}.Ch${ch.channel - 1}Data`;
  if (l1(cpu.id)) return null;
  if (is1769(ch.partNumber)) return `Local:${ch.slot - 1 + firstSlot(cpu.id)}:${dir}.Ch${ch.channel - 1}Data`;
  return `Local:${ch.slot}:${dir}.Ch${pt(ch.channel - 1)}.Data`;
}

/** Instruction names Studio 5000 shows for the app's ladder elements (1756-RM003). */
export const LOGIX_MNEMONICS: Record<string, string> = {
  NO: 'XIC', NC: 'XIO', RISE: 'XIC+ONS', FALL: 'XIO+ONS', OUT: 'OTE', SET: 'OTL', RST: 'OTU',
  TMR_ON_DELAY: 'TON', TMR_OFF_DELAY: 'TOF', TMR_RTO: 'RTO', CNT_UP: 'CTU', CNT_DOWN: 'CTD',
  '==': 'EQU', '<>': 'NEQ', '>': 'GRT', '>=': 'GEQ', '<': 'LES', '<=': 'LEQ', COPY: 'MOV', MATH: 'CPT',
};

const LOGIX_KNOWLEDGE = (cpu: CpuModel) => `Target: Allen-Bradley ${cpu.label}, programmed in Studio 5000 Logix Designer. Write the program in the app's neutral operands; the app exports them as Logix tags (L5X):
${is1769(cpu.id)
    ? `- ${cpu.builtInInputs ? `Embedded inputs X001–X0${pt(cpu.builtInInputs)} and outputs Y001–Y0${pt(cpu.builtInOutputs)} (Local:1:I.Data.0… / O.Data.0…); module` : 'The controller has no embedded I/O, so there is no X0xx/Y0xx. Module'} inputs X101… and outputs Y101… (first digit = 1769 Compact I/O module in order, then point 01…). They become alias tags for Local:<slot>:I.Data.<bit> / O.Data.<bit> (analog Local:<slot>:I.Ch<n>Data), named from the I/O description.`
    : '- Inputs X101–X816 and outputs Y101–Y816 (first digit = 5069 module slot 1–8, then point 01–16; the controller has no built-in I/O, so there is no X0xx/Y0xx). They become alias tags for Local:<slot>:I.PtNN.Data / O.PtNN.Data, named from the I/O description.'}
- Internal bits C1… → BOOL tags; timers T1… → TIMER tags (the done bit T1 is T1.DN, TD1 is the accumulated value); counters CT1… → COUNTER tags (CTD1 = .ACC); DS / DD registers → DINT tags; DF registers → REAL tags. Name every operand you use in "tags" with a Logix-legal nickname (letters, digits and single underscores, starting with a letter, at most 40 characters) — the nickname becomes the tag name.
${is1769(cpu.id)
    ? '- Analog channels are DF registers holding the 1769 module\'s Ch<n>Data: raw counts unless the module is configured for engineering-unit scaling. Scale them in the program (or say the module must be configured) before comparing them with setpoints.'
    : '- Analog channels are DF registers that already hold engineering units (the 5069 analog module scales them: LowEngineering / HighEngineering in its configuration).'}
- First scan: SC2 (exported as S:FS). SC1 (always on) is dropped from the rung; SC7 (1 s clock) is exported as a generated 1-second clock. Do not use other SC bits or SD registers — Logix has no equivalent.
- Contacts NO / NC / RISE / FALL (exported XIC / XIO / XIC+ONS / XIO+ONS), compares (EQU NEQ GRT GEQ LES LEQ), coils OUT / SET / RST (OTE / OTL / OTU), timers (TON / TOF, retentive = RTO with a reset rung), counters (CTU / CTD with a reset rung), COPY (MOV), MATH (CPT). Timer presets are exported in milliseconds.`;

function checkRung(rung: Rung, ctx?: { ioAddresses?: Set<string> }) {
  const issues: { severity: 'error' | 'warning'; message: string }[] = [];
  const all = [...rung.branches.flat().flatMap((e) => (elementAddresses(e)))];
  for (const a of all) {
    const u = a.toUpperCase();
    if (/^SC\d+$/.test(u) && !['SC1', 'SC2', 'SC7'].includes(u)) issues.push({ severity: 'error', message: `${a}: Logix has no equivalent system bit (use SC1, SC2 or SC7 only).` });
    if (/^SD\d+$/.test(u)) issues.push({ severity: 'error', message: `${a}: Logix has no CLICK system registers.` });
    // Embedded I/O (X0xx) only on a controller that has it (1769-L1 / L2): the I/O list assigns it then.
    if (/^[XY]0\d\d$/.test(u) && !(ctx?.ioAddresses?.has(u))) issues.push({ severity: 'error', message: `${a}: this CompactLogix has no embedded I/O at ${a} — use a module slot (X1xx…).` });
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
  platformId: 'ab-compactlogix-5380',
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
