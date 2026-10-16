import type { IOPoint } from '../types/io';
import type { Rung } from './ladder';

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
}

export interface CpuModel {
  id: string;
  label: string;
  builtInInputs: number;
  builtInOutputs: number;
  notes?: string;
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
  checkRung?(rung: Rung): { severity: 'error' | 'warning'; message: string }[];
}

/** Effective PLC address of each I/O point: manual override, else auto. */
export function resolveAddresses(profile: PlcProfile, cpu: CpuModel, io: IOPoint[], modules: ModuleSlot[] = []): Map<string, string> {
  const auto = profile.autoAddresses(io, cpu, modules);
  const out = new Map<string, string>();
  for (const p of io) out.set(p.id, p.plcAddress?.trim() || auto.get(p.id) || '');
  return out;
}
