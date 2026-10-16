import type { AddressInfo, AddressKind, CpuModel, IecDataType, ModuleSlot, PlcProfile, ProgramExporter, SimSemantics } from '../profile';
import { clickNicknameCsv, clickRungListing } from '../clickExport';
import type { IOPoint } from '../../../types/io';
import type { Rung } from '../ladder';
import { CLICK_CPUS, CLICK_KNOWLEDGE } from './clickData';

/**
 * AutomationDirect CLICK / CLICK PLUS.
 * Memory map: https://cdn.automationdirect.com/static/helpfiles/click/Content/195.htm
 */

interface RangeSpec { prefix: string; max: number; kind: AddressKind; isBit: boolean }

// Longest prefixes first so "CTD" isn't read as "CT" + "D".
const RANGES: RangeSpec[] = [
  { prefix: 'CTD', max: 250, kind: 'counterValue', isBit: false },
  { prefix: 'TXT', max: 1000, kind: 'register', isBit: false },
  { prefix: 'CT', max: 250, kind: 'counter', isBit: true },
  { prefix: 'SC', max: 1000, kind: 'system', isBit: true },
  { prefix: 'SD', max: 1000, kind: 'system', isBit: false },
  { prefix: 'DS', max: 4500, kind: 'register', isBit: false },
  { prefix: 'DD', max: 1000, kind: 'register', isBit: false },
  { prefix: 'DH', max: 500, kind: 'register', isBit: false },
  { prefix: 'DF', max: 500, kind: 'register', isBit: false },
  { prefix: 'TD', max: 500, kind: 'timerValue', isBit: false },
  { prefix: 'C', max: 2000, kind: 'bit', isBit: true },
  { prefix: 'T', max: 500, kind: 'timer', isBit: true },
];

// X/Y: slot digit (0 = CPU, 1-8 = expansion module) + point 01-16.
const IO_RE = /^([XY])([0-8])(0[1-9]|1[0-6])$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function parseAddress(raw: string): AddressInfo | null {
  const a = raw.trim().toUpperCase();
  if (NUMBER_RE.test(a)) return { kind: 'constant', isBit: false };
  const io = IO_RE.exec(a);
  if (io) return { kind: io[1] === 'X' ? 'input' : 'output', isBit: true };
  for (const r of RANGES) {
    if (!a.startsWith(r.prefix)) continue;
    const num = a.slice(r.prefix.length);
    if (!/^[1-9]\d*$/.test(num)) return null; // CLICK addresses have no leading zeros
    return Number(num) <= r.max ? { kind: r.kind, isBit: r.isBit } : null;
  }
  return null;
}

/**
 * Fill CPU built-in points first, then expansion slots 1..8 using each
 * module's real point count. With no modules chosen yet, assume 16-point
 * modules so addresses can still be previewed.
 */
function* ioAddresses(letter: 'X' | 'Y', builtIn: number, modules: ModuleSlot[]) {
  for (let p = 1; p <= builtIn; p++) yield `${letter}0${String(p).padStart(2, '0')}`;
  for (let slot = 1; slot <= 8; slot++) {
    const m = modules[slot - 1];
    const count = modules.length ? (m ? (letter === 'X' ? m.inputs : m.outputs) : 0) : 16;
    for (let p = 1; p <= count; p++) yield `${letter}${slot}${String(p).padStart(2, '0')}`;
  }
}

function autoAddresses(io: IOPoint[], cpu: CpuModel, modules: ModuleSlot[]): Map<string, string> {
  const out = new Map<string, string>();
  // Manually-addressed points keep their address; skip it in the auto sequence.
  const taken = new Set(io.map((p) => p.plcAddress?.trim().toUpperCase()).filter(Boolean));
  const gens = { input: ioAddresses('X', cpu.builtInInputs, modules), output: ioAddresses('Y', cpu.builtInOutputs, modules) };
  for (const p of io) {
    if (p.plcAddress?.trim()) continue;
    const gen = gens[p.type];
    let next = gen.next();
    while (!next.done && taken.has(next.value)) next = gen.next();
    if (!next.done) out.set(p.id, next.value);
  }
  return out;
}

function checkRung(rung: Rung) {
  const issues: { severity: 'error' | 'warning'; message: string }[] = [];
  for (const o of rung.outputs) {
    if (o.type === 'TMR') {
      if (o.accumulate && o.mode !== 'ON_DELAY') {
        issues.push({ severity: 'error', message: `${o.address}: CLICK only allows a retentive (accumulating) timer in ON-delay mode.` });
      }
      const kind = parseAddress(o.preset)?.kind;
      if (kind !== 'constant' && !o.preset.toUpperCase().startsWith('DS')) {
        issues.push({ severity: 'error', message: `${o.address}: CLICK timer setpoint must be a constant or a DS register.` });
      }
    }
    if (o.type === 'CNT') {
      const p = o.preset.toUpperCase();
      if (parseAddress(p)?.kind !== 'constant' && !p.startsWith('DS') && !p.startsWith('DD')) {
        issues.push({ severity: 'error', message: `${o.address}: CLICK counter setpoint must be a constant or a DS/DD register.` });
      }
    }
  }
  return issues;
}

/** CLICK memory as IEC data types (DS 16-bit INT, DD 32-bit DINT, DH hex WORD, DF REAL, TD INT, CTD DINT). */
function dataTypeOf(address: string): IecDataType | null {
  const a = address.trim().toUpperCase();
  const info = parseAddress(a);
  if (!info || info.kind === 'constant') return null;
  if (info.isBit) return info.kind === 'timer' ? 'TON' : info.kind === 'counter' ? 'CTU' : 'BOOL';
  if (a.startsWith('TXT')) return 'STRING';
  if (a.startsWith('CTD') || a.startsWith('DD')) return 'DINT';
  if (a.startsWith('DH')) return 'WORD';
  if (a.startsWith('DF')) return 'REAL';
  return 'INT'; // DS, TD, SD
}

/** CLICK default retentive memory: data registers and counters keep their value through a power cycle. */
export function clickRetentive(address: string): boolean {
  return /^(DS|DD|DH|DF|CTD|CT)\d+$/.test(address);
}

export const CLICK_SIM: SimSemantics = { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7', retentive: clickRetentive };

const CLICK_EXPORTERS: ProgramExporter[] = [
  { id: 'click-rungs', label: 'Rung listing (enter in CLICK Programming Software)', fileName: (b) => `${b}_rungs.txt`, build: (p, c) => clickRungListing(p, c.labels, c.header) },
  { id: 'click-nicknames', label: 'Nickname CSV (CLICK Address Picker / C-more tag import)', fileName: (b) => `${b}_nicknames.csv`, build: (p, c) => clickNicknameCsv(p, c.io, c.addresses, c.extraTags) },
];

export const clickProfile: PlcProfile = {
  id: 'click',
  vendor: 'AutomationDirect',
  name: 'CLICK',
  language: 'ladder',
  available: true,
  cpuModels: CLICK_CPUS,
  defaultCpuId: CLICK_CPUS[0].id,
  autoAddresses,
  parseAddress,
  promptKnowledge: (cpu) => CLICK_KNOWLEDGE(cpu),
  checkRung,
  dataTypeOf,
  simSemantics: CLICK_SIM,
  exporters: CLICK_EXPORTERS,
};
