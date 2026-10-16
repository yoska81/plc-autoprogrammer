import type { AddressInfo, AddressKind, CpuModel, PlcProfile } from '../profile';
import type { IOPoint } from '../../types/io';
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

/** Fill CPU built-in points first, then expansion slots 1..8 (16 points assumed per module). */
function* ioAddresses(letter: 'X' | 'Y', builtIn: number) {
  for (let p = 1; p <= builtIn; p++) yield `${letter}0${String(p).padStart(2, '0')}`;
  for (let slot = 1; slot <= 8; slot++) {
    for (let p = 1; p <= 16; p++) yield `${letter}${slot}${String(p).padStart(2, '0')}`;
  }
}

function autoAddresses(io: IOPoint[], cpu: CpuModel): Map<string, string> {
  const out = new Map<string, string>();
  // Manually-addressed points keep their address; skip it in the auto sequence.
  const taken = new Set(io.map((p) => p.plcAddress?.trim().toUpperCase()).filter(Boolean));
  const gens = { input: ioAddresses('X', cpu.builtInInputs), output: ioAddresses('Y', cpu.builtInOutputs) };
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
};
