import type { AddressInfo, CpuModel, IecDataType, PlcProfile } from '../profile';
import type { IOPoint } from '../../../types/io';
import { CLICK_SIM, dataTypeOf as neutralDataType, parseAddress as neutralAddress } from './click';

/**
 * Yaskawa MP2000 / MP3000 (MPE720), read only: a program read from an MPE720 project (.YMW7) stays on its own
 * controller, with its own I/O registers (IB00000, OB00010, IW0010…), until the user chooses the PLC to move it to.
 * The app cannot write MPE720 files yet: no exporters, never picked on its own, not offered in the PLC picker.
 * Memory inside the program is the app's neutral memory (C, DS, T…; the original register names are the
 * nicknames), so the program page, the checker and the simulator work as on any PLC.
 */

/** IB / OB: word (4 hex digits) + bit (1 hex digit); IW / OW / IL / OL / IF / OF: word. 8000 and up: servo registers. */
const IO_BIT = /^([IO])B([0-9A-F]{4})([0-9A-F])$/;
const IO_WORD = /^([IO])([WLF])([0-9A-F]{4})$/;

export function parseAddress(raw: string): AddressInfo | null {
  const a = raw.trim().toUpperCase();
  const bit = IO_BIT.exec(a);
  if (bit) return { kind: bit[1] === 'I' ? 'input' : 'output', isBit: true };
  const word = IO_WORD.exec(a);
  if (word) return { kind: word[1] === 'I' ? 'input' : 'output', isBit: false };
  // The neutral memory the imported program uses; X / Y are CLICK terminals, not this PLC's.
  return /^[XY]\d/.test(a) ? null : neutralAddress(a);
}

const hex = (n: number, digits: number) => n.toString(16).toUpperCase().padStart(digits, '0');

/** Points the import did not place get the next free register: bits IB00000…, IB00001… (16 per word), words IW0010…. */
function autoAddresses(io: IOPoint[]): Map<string, string> {
  const taken = new Set(io.map((p) => p.plcAddress?.trim().toUpperCase()).filter(Boolean));
  const next = { IB: 0, OB: 0, IW: 0x10, OW: 0x10 };
  const out = new Map<string, string>();
  for (const p of io) {
    if (p.plcAddress?.trim()) continue;
    const key = `${p.type === 'input' ? 'I' : 'O'}${p.signal === 'analog' ? 'W' : 'B'}` as keyof typeof next;
    let a: string;
    do a = key.endsWith('B') ? `${key}${hex(next[key] >> 4, 4)}${hex(next[key]++ & 15, 1)}` : `${key}${hex(next[key]++, 4)}`;
    while (taken.has(a));
    taken.add(a);
    out.set(p.id, a);
  }
  return out;
}

function dataTypeOf(address: string): IecDataType | null {
  const a = address.trim().toUpperCase();
  if (IO_BIT.test(a)) return 'BOOL';
  const w = IO_WORD.exec(a);
  if (w) return w[2] === 'L' ? 'DINT' : w[2] === 'F' ? 'REAL' : 'INT';
  return parseAddress(a) ? neutralDataType(a) : null;
}

const READ_ONLY = 'read only: not programmable here yet';
/** The CPUs an MPE720 project names ("CPU-301(16axes)" → CPU-301); any other is the generic MP CPU. */
const cpu = (id: string, what: string): CpuModel => ({ id, label: `${id} — ${what} (${READ_ONLY})`, builtInInputs: 0, builtInOutputs: 0 });
export const YASKAWA_CPUS: CpuModel[] = [
  cpu('CPU-301', 'MP3300 CPU module'),
  cpu('CPU-302', 'MP3300 CPU module'),
  cpu('MP3300', 'MP3000 rack controller'),
  cpu('MP2310', 'MP2000 controller'),
  cpu('MP2300S', 'MP2000 controller'),
  cpu('MP2300', 'MP2000 controller'),
  cpu('CPU-201', 'MP2000 CPU module'),
  cpu('CPU-202', 'MP2000 CPU module'),
  cpu('MP-CPU', 'MP2000 / MP3000 controller'),
];

/** The CPU of the list an MPE720 controller name stands for ("CPU-301(16axes)" → CPU-301), else the generic one. */
export function yaskawaCpuOf(controller: string): CpuModel {
  const c = controller.toUpperCase().replace(/\s+/g, '');
  return YASKAWA_CPUS.find((x) => x.id !== 'MP-CPU' && (c === x.id || c.startsWith(`${x.id}(`) || c.startsWith(`${x.id}-`) || c.replace(/-/g, '').startsWith(x.id.replace(/-/g, '')))) ?? YASKAWA_CPUS[YASKAWA_CPUS.length - 1];
}

export const yaskawaProfile: PlcProfile = {
  id: 'yaskawa-mp',
  vendor: 'Yaskawa',
  name: 'MP2000 / MP3000 (MPE720)',
  language: 'ladder',
  available: false,
  readOnly: true,
  autoChoose: false,
  cpuModels: YASKAWA_CPUS,
  defaultCpuId: 'MP-CPU',
  autoAddresses,
  parseAddress,
  dataTypeOf,
  promptKnowledge: () => 'This program was read from a Yaskawa MPE720 project and stays on it read only: the app cannot write MPE720 files yet. Inputs and outputs keep their MP registers (IB00000 is input word 0000 bit 0, OB00010 output word 0001 bit 0, IW / OW words). Use the app\'s neutral memory inside the program (C bits, DS / DD / DF registers, T timers, CT counters), as the program already does.',
  simSemantics: CLICK_SIM,
  exporters: [],
};
