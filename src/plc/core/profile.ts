import type { AnalogRange, IOPoint } from '../../types/io';
import type { LadderProgram, Rung } from './ladder';

export type ProgramLanguage = 'ladder' | 'st';

/** What kind of memory an address refers to, for validation and display. */
export type AddressKind =
  | 'input' | 'output' | 'bit' | 'system' | 'timer' | 'counter'
  | 'register' | 'timerValue' | 'counterValue' | 'constant';

export interface AddressInfo {
  kind: AddressKind;
  /** Bit-type memory can be used on contacts/coils. */
  isBit: boolean;
}

/** Discrete points of one expansion module, in slot order (slot 1 = first). */
export interface ModuleSlot {
  partNumber: string;
  inputs: number;
  outputs: number;
  /** Analog channels (0 for discrete modules). */
  analogInputs?: number;
  analogOutputs?: number;
}

/** One physical analog channel of the PLC (CPU built-in or an expansion module). */
export interface AnalogChannel {
  kind: 'input' | 'output';
  /** 0 = CPU built-in, 1… = expansion slot. */
  slot: number;
  /** Channel number on that CPU / module, from 1. */
  channel: number;
  /** Part number of the CPU or module. */
  partNumber: string;
  /** Human label, e.g. "CPU AD1" or "Slot 2 CH3". */
  label: string;
  /** Signal ranges this channel accepts. */
  ranges: AnalogRange[];
  /** Terminal(s) a field device connects to, e.g. ["AD1I"] or ["CH3", "0V"]. */
  terminals: string[];
  /** Register that holds the scaled value in the program, e.g. "DF3". */
  address: string;
  /** Digital input (neutral X address) whose terminal this analog input uses; not a digital input while the channel is used. */
  sharesInput?: string;
}

export interface CpuModel {
  id: string;
  label: string;
  builtInInputs: number;
  builtInOutputs: number;
  notes?: string;
  /** Hardware platform of this CPU when it differs within one profile (Micro820 vs Micro850). */
  platformId?: string;
}

/**
 * IEC 61131-3 data type of an operand. Vendor-neutral: profiles map their own
 * memory (CLICK DS = INT, Logix DINT tags, Siemens %MW ...) onto these.
 */
export type IecDataType = 'BOOL' | 'INT' | 'DINT' | 'REAL' | 'WORD' | 'STRING' | 'TON' | 'TOF' | 'RTO' | 'CTU' | 'CTD';

/** How the PLC's scan behaves, so the simulator can follow the target instead of CLICK only. */
export interface SimSemantics {
  /** System bit that is always ON (CLICK SC1). */
  alwaysOn: string | null;
  /** System bit that is ON for the first scan only (CLICK SC2). */
  firstScan: string | null;
  /** System bit toggling with a 1 s period: ON for 0.5 s, OFF for 0.5 s (CLICK SC7). */
  clock1s: string | null;
  /** Memory that survives a power cycle by default. */
  retentive(address: string): boolean;
}

/** Context an exporter gets besides the program. */
export interface ExportContext {
  io: IOPoint[];
  /** I/O point id -> PLC address. */
  addresses: Map<string, string>;
  /** Address -> I/O description. */
  labels: Map<string, string>;
  /** Free text heading the file (project, PLC, date). */
  header: string;
  /** Additional nicknames (e.g. HMI tags) to include. */
  extraTags: { address: string; nickname: string; comment: string }[];
  /** Selected CPU id and expansion modules (tag-based exporters build the I/O configuration from them). */
  cpuId?: string;
  modules?: ModuleSlot[];
  /** Project name (controller / program names). */
  projectName?: string;
  /** Export time stamp (fixed in tests). */
  now?: Date;
}

/** One file the vendor's software can import or the engineer types in from. */
export interface ProgramExporter {
  id: string;
  label: string;
  fileName(base: string): string;
  build(program: LadderProgram, ctx: ExportContext): string;
}

export interface PlcProfile {
  id: string;
  vendor: string;
  name: string;
  language: ProgramLanguage;
  /** Shown in the PLC picker; profiles not yet built are listed but disabled. */
  available: boolean;
  cpuModels: CpuModel[];
  defaultCpuId: string;
  /** Physical address a project I/O point gets on this PLC (by order). */
  autoAddresses(io: IOPoint[], cpu: CpuModel, modules: ModuleSlot[]): Map<string, string>;
  /** Parse an address; null = not valid on this PLC. */
  parseAddress(address: string): AddressInfo | null;
  /** PLC-specific knowledge the AI must follow, added to the system prompt. */
  promptKnowledge(cpu: CpuModel): string;
  /** PLC-specific rules beyond address checks. */
  checkRung?(rung: Rung, ctx?: { ioAddresses?: Set<string> }): { severity: 'error' | 'warning'; message: string }[];
  /** IEC data type of an address (null = not valid / constant). Foundation for vendor-neutral tags. */
  dataTypeOf?(address: string): IecDataType | null;
  /** Scan semantics for the simulator. */
  simSemantics?: SimSemantics;
  /** Program files this PLC's software can import (or that are typed in from). */
  exporters?: ProgramExporter[];
  /** Analog channels of the CPU + modules, in addressing order (empty = no analog). */
  analogChannels?(cpu: CpuModel, modules: ModuleSlot[]): AnalogChannel[];
  /** Hardware platform (src/plc/core/platforms.ts, Dev 1): CPUs, modules, limits, protocols. */
  platformId?: string;
  /** false = never picked by the equipment AI on its own (the user selects it). Default true. */
  autoChoose?: boolean;
  /** Vendor instruction names for the app's elements (keys: NO, NC, RISE, FALL, OUT, SET, RST, TMR_ON_DELAY, TMR_OFF_DELAY, TMR_RTO, CNT_UP, CNT_DOWN, compare ops, COPY, MATH). */
  mnemonics?: Record<string, string>;
  /** Vendor I/O tag of a physical neutral address (Logix: Local:1:I.Pt00.Data), for display and export. */
  ioTag?(address: string, modules: ModuleSlot[], cpuId?: string): string | null;
  /** How the engineer gets the exported files into the PLC software (shown with the downloads). */
  importSteps?: string[];
}

/** Effective PLC address of each I/O point: manual override, else auto. */
export function resolveAddresses(profile: PlcProfile, cpu: CpuModel, io: IOPoint[], modules: ModuleSlot[] = []): Map<string, string> {
  const auto = profile.autoAddresses(io, cpu, modules);
  const out = new Map<string, string>();
  for (const p of io) out.set(p.id, p.plcAddress?.trim() || auto.get(p.id) || '');
  return out;
}
