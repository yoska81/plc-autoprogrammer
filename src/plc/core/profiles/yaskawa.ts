/**
 * Yaskawa MP2000 / MP3000 machine controllers (MPE720 Ver.7 ladder).
 *
 * The app's program stays in its neutral memory (X / Y / C / DS / DD / DF / T / CT …, what the rules engine,
 * the simulator, the drawings and the HMI all work on). Everything the user sees and every exported file
 * names the MP registers in MPE720's own forms (the same forms the .YMW7 reader writes, import/mpe720.ts):
 *   I / O registers   4 hex digits: IW0010; a bit adds one hex digit: IB00000 = IW0000 bit 0, OB0001F
 *   M registers       5 decimal digits: MW01000, ML06000 (2 words), MF08500 (2 words); bits MB000000 =
 *                     MW00000 bit 0, MB01234A = MW01234 bit 10 (the bit digit is hex)
 *   system            SB000004 (always ON, as the reader reads it from a real project)
 *   constants         #00100
 * I / O: each module's points from its leading input / output register. Without catalog data the modules are
 * numbered consecutively in slot order, 16 points per word: that is marked "assumed" (check the module
 * configuration in MPE720).
 * Memory: each neutral area sits in its own MW range (the layout). A new project uses the defaults; a program
 * imported from MPE720 keeps its own registers (TagDefinition.native) and the app's areas are moved into MW
 * ranges it does not use (allocateMemory), stored with the project so they never move by themselves.
 */
import type { AnalogChannel, CpuModel, ExportContext, ModuleSlot, PlcProfile } from '../profile';
import type { LadderProgram, TagDefinition } from '../ladder';
import { rungAddresses, type Rung } from '../ladder';
import { clickRetentive, dataTypeOf as neutralType, neutralAutoAddresses, parseAddress } from './click';
import { getPart } from '../../../electrical/catalog';

export const YASKAWA_PROFILE_ID = 'yaskawa-mp';

/** The hardware family (the panels' driver lists name these): MP2000 or MP3000. */
export type YaskawaFamily = 'yaskawa-mp2000' | 'yaskawa-mp3000';

const cpu = (id: string, family: YaskawaFamily, inputs: number, outputs: number, label: string, axes: number) => ({ id, label, builtInInputs: inputs, builtInOutputs: outputs, family, axes });

/**
 * CPUs (ids to be matched with Dev 4's catalog part numbers). The MP3000 CPUs have no discrete I/O of their own.
 * No platformId yet: the platforms (yaskawa-mp2000 / yaskawa-mp3000, src/plc/core/platforms.ts) come with the
 * catalog's CPU and LIO parts; until then the CPU fit is the generic one.
 */
export const YASKAWA_CPUS = [
  cpu('JAPMC-CP3301-1-E', 'yaskawa-mp3000', 0, 0, 'JAPMC-CP3301-1-E — MP3000 CPU-301, 16 axes (I/O on LIO modules)', 16),
  cpu('JAPMC-CP3302-1-E', 'yaskawa-mp3000', 0, 0, 'JAPMC-CP3302-1-E — MP3000 CPU-302, 32 axes (I/O on LIO modules)', 32),
  cpu('JAPMC-CP3201-E', 'yaskawa-mp3000', 0, 0, 'JAPMC-CP3201-E — MP3300 CPU-201, 16 axes (I/O on LIO modules)', 16),
  cpu('JAPMC-CP3202-E', 'yaskawa-mp3000', 0, 0, 'JAPMC-CP3202-E — MP3300 CPU-202, 32 axes (I/O on LIO modules)', 32),
  cpu('JEPMC-MP2300-E', 'yaskawa-mp2000', 8, 4, 'JEPMC-MP2300-E — MP2300 basic module, 8 DI / 4 DO, 16 axes', 16),
  cpu('JEPMC-MP2310-E', 'yaskawa-mp2000', 0, 0, 'JEPMC-MP2310-E — MP2310 basic module, 16 axes (I/O on LIO modules)', 16),
];

const cpuOf = (cpuId?: string): CpuModel => YASKAWA_CPUS.find((c) => c.id === cpuId) ?? YASKAWA_CPUS[0];

/** The family of a Yaskawa CPU (null for other CPUs). */
export const yaskawaFamily = (cpuId: string): YaskawaFamily | null => YASKAWA_CPUS.find((c) => c.id === cpuId)?.family ?? null;

// ── MPE720 register forms ──

const hex = (n: number, digits: number) => n.toString(16).toUpperCase().padStart(digits, '0');
const dec = (n: number) => String(n).padStart(5, '0');

/** An MP register in MPE720's form: area I / O (hex words) or M (decimal words), width B (with the bit) / W / L / F. */
export function mpRegister(area: 'I' | 'O' | 'M', width: 'B' | 'W' | 'L' | 'F', word: number, bit = 0): string {
  const w = area === 'M' ? dec(word) : hex(word, 4);
  return `${area}${width}${w}${width === 'B' ? hex(bit, 1) : ''}`;
}

/** The MW words an M register occupies (MB012340 → [1234]; ML06000 → [6000, 6001]); null when it is not an M register. */
export function mWords(register: string): number[] | null {
  const m = /^M([BWLF])(\d{5})([0-9A-F])?$/i.exec(register.trim());
  if (!m) return null;
  const w = Number(m[2]);
  return m[1] === 'L' || m[1] === 'F' ? [w, w + 1] : [w];
}

// ── I / O ──

interface Lead { input: number; output: number; assumed: boolean }

/** Leading input / output register of each module: from the catalog (ratings.leadInputRegister / leadOutputRegister, hex), else consecutive by slot. */
export function ioLeads(c: CpuModel, modules: ModuleSlot[]): Lead[] {
  // Built-in I/O (MP2300) takes the first words.
  let nextIn = Math.ceil(c.builtInInputs / 16), nextOut = Math.ceil(c.builtInOutputs / 16);
  return modules.map((m) => {
    const r = getPart(m.partNumber)?.ratings ?? {};
    const li = r.leadInputRegister != null ? parseInt(String(r.leadInputRegister), 16) : NaN;
    const lo = r.leadOutputRegister != null ? parseInt(String(r.leadOutputRegister), 16) : NaN;
    const lead: Lead = { input: isNaN(li) ? nextIn : li, output: isNaN(lo) ? nextOut : lo, assumed: isNaN(li) || isNaN(lo) };
    nextIn = lead.input + Math.ceil(m.inputs / 16) + (m.analogInputs ?? 0);
    nextOut = lead.output + Math.ceil(m.outputs / 16) + (m.analogOutputs ?? 0);
    return lead;
  });
}

/** Analog channels: one IW / OW word each, after the module's discrete words (DF registers in the program, raw counts). */
export function yaskawaAnalogChannels(_c: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 0;
  modules.forEach((m, k) => {
    for (let i = 0; i < (m.analogInputs ?? 0); i++) out.push({ kind: 'input', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Module ${k + 1} CH${i + 1}`, ranges: ['4-20mA', '0-10V'], terminals: [`CH${i + 1}`], address: `DF${++df}` });
    for (let i = 0; i < (m.analogOutputs ?? 0); i++) out.push({ kind: 'output', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Module ${k + 1} CH${i + 1}`, ranges: ['4-20mA', '0-10V'], terminals: [`CH${i + 1}`], address: `DF${++df}` });
  });
  return out;
}

/** The MP I / O register of a neutral physical point (X101 → IB00000 on a first LIO at IW0000); null when the rack has no such point. */
export function yaskawaIo(address: string, c: CpuModel, modules: ModuleSlot[]): { register: string; assumed: boolean } | null {
  const a = address.trim().toUpperCase();
  const io = /^([XY])(\d)(\d\d)$/.exec(a);
  if (io) {
    const input = io[1] === 'X', slot = Number(io[2]), n = Number(io[3]) - 1;
    if (slot === 0) {
      if (n >= (input ? c.builtInInputs : c.builtInOutputs)) return null;
      return { register: mpRegister(input ? 'I' : 'O', 'B', n >> 4, n & 15), assumed: true };
    }
    const m = modules[slot - 1];
    if (!m || n >= (input ? m.inputs : m.outputs)) return null;
    const lead = ioLeads(c, modules)[slot - 1];
    return { register: mpRegister(input ? 'I' : 'O', 'B', (input ? lead.input : lead.output) + (n >> 4), n & 15), assumed: lead.assumed };
  }
  const ch = yaskawaAnalogChannels(c, modules).find((x) => x.address === a);
  if (!ch) return null;
  const m = modules[ch.slot - 1];
  const lead = ioLeads(c, modules)[ch.slot - 1];
  const word = ch.kind === 'input' ? lead.input + Math.ceil(m.inputs / 16) + ch.channel - 1 : lead.output + Math.ceil(m.outputs / 16) + ch.channel - 1;
  return { register: mpRegister(ch.kind === 'input' ? 'I' : 'O', 'W', word), assumed: lead.assumed };
}

// ── Memory layout ──

/** MW word base of each neutral memory area in this project. */
export interface MemoryLayout { C: number; DS: number; DD: number; DH: number; DF: number; T: number; CT: number; TD: number; CTD: number }

/** Words each area needs for the neutral range (C1–C2000 = 125 words of 16 bits, DD = 2 words each …). */
const AREA_WORDS: MemoryLayout = { C: 125, DS: 4500, DD: 2000, DH: 500, DF: 1000, T: 32, CT: 16, TD: 500, CTD: 500 };
const AREAS = Object.keys(AREA_WORDS) as (keyof MemoryLayout)[];

/** A new project's layout. */
export const DEFAULT_MEMORY: MemoryLayout = { C: 0, DS: 1000, DD: 6000, DH: 8000, DF: 8500, T: 9500, CT: 9600, TD: 9700, CTD: 10200 };

/** The MW words an imported program's own registers use (tags with an M register as `native`). */
export function nativeWords(tags: TagDefinition[]): Set<number> {
  const out = new Set<number>();
  for (const t of tags) for (const w of (t.native ? mWords(t.native) : null) ?? []) out.add(w);
  return out;
}

/**
 * The layout for a program with registers of its own: each area keeps its default range when that is free, else
 * goes to the first free range (from MW10000, in steps of 1000 words) that no imported register and no other area uses.
 */
export function allocateMemory(used: Set<number>): MemoryLayout {
  const taken = new Set(used);
  const free = (base: number, size: number) => { for (let w = base; w < base + size; w++) if (taken.has(w)) return false; return base + size <= 65535; };
  const out = { ...DEFAULT_MEMORY };
  for (const k of AREAS) {
    let base = DEFAULT_MEMORY[k];
    if (!free(base, AREA_WORDS[k])) { base = 10000; while (!free(base, AREA_WORDS[k])) base += 1000; }
    out[k] = base;
    for (let w = base; w < base + AREA_WORDS[k]; w++) taken.add(w);
  }
  return out;
}

/** The MP register of a neutral memory operand (C1 → MB000000, DS1 → MW01000, TD3 → MW09702 …); null for what MP has no register for. */
export function yaskawaMemory(address: string, layout: MemoryLayout = DEFAULT_MEMORY): string | null {
  const m = /^(CTD|CT|TD|DS|DD|DH|DF|SC|C|T)(\d+)$/.exec(address.trim().toUpperCase());
  if (!m) return null;
  const n = Number(m[2]) - 1;
  if (n < 0) return null;
  const k = m[1];
  switch (k) {
    case 'C': case 'T': case 'CT': return mpRegister('M', 'B', layout[k] + (n >> 4), n & 15);
    case 'DS': case 'DH': case 'TD': return mpRegister('M', 'W', layout[k] + n);
    case 'DD': case 'CTD': return mpRegister('M', 'L', layout[k] + 2 * n);
    case 'DF': return mpRegister('M', 'F', layout.DF + 2 * n);
    case 'SC': return n === 0 ? 'SB000004' : null; // always ON; first scan / clock are not confirmed (flagged by the checker)
  }
  return null;
}

/** The MP register of any app operand: an imported register as it was, I / O by module, memory by the layout. */
export function yaskawaName(address: string, ctx: { cpuId?: string; modules?: ModuleSlot[]; tags?: TagDefinition[]; layout?: MemoryLayout }): string | null {
  const a = address.trim().toUpperCase();
  if (/^-?\d+(\.\d+)?$/.test(a)) return `#${a}`;
  const native = ctx.tags?.find((t) => t.address.toUpperCase() === a)?.native;
  if (native) return native;
  return yaskawaIo(a, cpuOf(ctx.cpuId), ctx.modules ?? [])?.register ?? yaskawaMemory(a, ctx.layout);
}

/** The operands of one rung, a MATH expression's included. */
function operandsOfRung(r: Rung): string[] {
  const exprs = r.outputs.flatMap((o) => (o.type === 'MATH' ? [o.expression] : []));
  return [...rungAddresses(r), ...exprs.flatMap((x) => x.match(/\b[A-Z]{1,3}\d+\b/gi) ?? [])].map((a) => a.trim().toUpperCase()).filter(Boolean);
}

/** Every operand the program uses (contacts, coils, boxes, expressions). */
function operandsOf(program: LadderProgram): Set<string> {
  const out = new Set<string>();
  for (const r of program.rungs) for (const a of operandsOfRung(r)) out.add(a);
  return out;
}

/** What an M register occupies: one bit of a word (MB) or whole words (MW / ML / MF). */
function cells(register: string): { word: number; bit: number | null }[] {
  const ws = mWords(register) ?? [];
  const bit = /^MB\d{5}([0-9A-F])$/i.exec(register)?.[1];
  return ws.map((word) => ({ word, bit: bit != null ? parseInt(bit, 16) : null }));
}

/**
 * Memory the app's operands would share with the program's own registers or with each other (an imported program
 * keeps MB001000 … as they are): each is an error. A bit clashes with the same bit or with a word holding it; a
 * word with any use of that word. Also an operand past its area (it would run into the next one).
 */
export function memoryOverlaps(program: LadderProgram, layout: MemoryLayout = DEFAULT_MEMORY): string[] {
  const natives = new Set(program.tags.filter((t) => t.native).map((t) => t.address.toUpperCase()));
  // word → who uses it: whole word, or bit → who
  const byWord = new Map<number, { whole?: string; bits: Map<number, string> }>();
  const clash = (word: number, bit: number | null, who: string): string | null => {
    const u = byWord.get(word) ?? { bits: new Map<number, string>() };
    byWord.set(word, u);
    const other = u.whole ?? (bit == null ? [...u.bits.values()][0] : u.bits.get(bit));
    if (bit == null) u.whole ??= who; else if (!u.bits.has(bit)) u.bits.set(bit, who);
    return other && other !== who ? other : null;
  };
  for (const t of program.tags) if (t.native) for (const c of cells(t.native)) clash(c.word, c.bit, `the program's ${t.native}${t.nickname ? ` (${t.nickname})` : ''}`);
  const issues: string[] = [];
  for (const a of [...operandsOf(program)].sort()) {
    if (natives.has(a)) continue;
    const m = /^(CTD|CT|TD|DS|DD|DH|DF|C|T)(\d+)$/.exec(a);
    if (!m) continue;
    const k = m[1] as keyof MemoryLayout, n = Number(m[2]) - 1;
    const words = k === 'C' || k === 'T' || k === 'CT' ? (n >> 4) + 1 : k === 'DD' || k === 'DF' || k === 'CTD' ? 2 * n + 2 : n + 1;
    if (words > AREA_WORDS[k]) { issues.push(`${a} is past the ${k} area of this Yaskawa project (${AREA_WORDS[k]} words from MW${dec(layout[k])}).`); continue; }
    const reg = yaskawaMemory(a, layout);
    if (!reg) continue;
    for (const c of cells(reg)) {
      const other = clash(c.word, c.bit, `${a} (${reg})`);
      if (other) issues.push(`${a} is ${reg} in this project, which ${other} already uses: move the app's memory to free registers or use the program's own register.`);
    }
  }
  return [...new Set(issues)];
}

const KNOWLEDGE = (c: CpuModel) => `Target: Yaskawa ${c.label}, programmed in MPE720 Ver.7 ladder. Write the program in the app's neutral operands; the app shows and exports them as MP registers:
- I/O is on LIO modules (X1xx / Y1xx… = module in slot order, 16 points per word): X101 = IB00000 on the first module${c.builtInInputs ? `; the built-in points are X001–X0${String(c.builtInInputs).padStart(2, '0')} / Y001–Y0${String(c.builtInOutputs).padStart(2, '0')}` : ''}.
- Internal bits C → MB, registers DS / DH → MW, DD → ML, DF → MF; timers T (done bit) with TD (count register), counters CT with CTD.
- Servo axes are MECHATROLINK network axes (motion registers, not pulse outputs): never use pulse / direction outputs for them.
- SC1 = SB000004 (always ON). No other SC / SD bits: build a first-scan or clock bit in the program.`;

export const yaskawaProfile: PlcProfile = {
  id: YASKAWA_PROFILE_ID,
  vendor: 'Yaskawa',
  name: 'MP3000 / MP2000 (MPE720)',
  language: 'ladder',
  available: true,
  autoChoose: false,
  cpuModels: YASKAWA_CPUS,
  defaultCpuId: YASKAWA_CPUS[0].id,
  autoAddresses: (io, c, modules) => neutralAutoAddresses(io, c, modules, yaskawaAnalogChannels(c, modules)),
  parseAddress,
  promptKnowledge: KNOWLEDGE,
  checkRung: (rung) => {
    const issues: { severity: 'error' | 'warning'; message: string }[] = [];
    for (const a of operandsOfRung(rung)) {
      if (/^SC\d+$/.test(a) && a !== 'SC1') issues.push({ severity: 'error', message: `${a}: no confirmed MP system register for it (only SC1 = SB000004, always ON). Build a first-scan or clock bit in the program.` });
      if (/^(SD|TXT)\d+$/.test(a)) issues.push({ severity: 'error', message: `${a}: the Yaskawa profile has no register for it.` });
    }
    return issues;
  },
  dataTypeOf: (a) => neutralType(a),
  simSemantics: { alwaysOn: 'SC1', firstScan: null, clock1s: null, retentive: clickRetentive },
  analogChannels: yaskawaAnalogChannels,
  // I / O only (memory needs the project's layout: see yaskawaName and the PLC names lookup).
  ioTag: (a, modules, cpuId) => yaskawaIo(a, cpuOf(cpuId), modules)?.register ?? null,
};

/** The layout an export context carries (a new project's defaults when it has none). */
export const layoutOf = (ctx: Pick<ExportContext, 'yaskawaMemory'>): MemoryLayout => ctx.yaskawaMemory ?? DEFAULT_MEMORY;
