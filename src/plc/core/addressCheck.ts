/**
 * One check for an address typed by the user (I/O list, HMI tag field): is it an address of this PLC, of the
 * right kind for the point, and on a terminal the CPU and modules really have. The PLC's own form is accepted
 * too (%I0.0, Local:1:I.Pt00.Data, _IO_EM_DI_00) and turned into the app's address of that terminal.
 */
import type { AddressInfo, CpuModel, ModuleSlot, PlcProfile } from './profile';
import { platformOf } from './fit';

export type AddressCheck = { ok: true; address: string } | { ok: false; reason: string };

export interface Rack { profile: PlcProfile; cpu: CpuModel; modules: ModuleSlot[] }

/** Terminals of one kind the CPU and modules have, in addressing order (X001…, X101…). */
export function rackTerminals(rack: Rack, type: 'input' | 'output'): string[] {
  const letter = type === 'input' ? 'X' : 'Y';
  const counts = [type === 'input' ? rack.cpu.builtInInputs : rack.cpu.builtInOutputs, ...rack.modules.map((m) => (type === 'input' ? m.inputs : m.outputs))];
  const out: string[] = [];
  counts.forEach((n, slot) => { for (let p = 1; p <= Math.min(n, 99) && slot < 10; p++) out.push(`${letter}${slot}${String(p).padStart(2, '0')}`); });
  return out;
}

/** The PLC numbers its I/O as the app's terminals (X001…, Y001…); generic Structured Text does not. */
const usesTerminals = (rack: Rack) => rack.profile.id !== 'generic-st' && [...rack.profile.autoAddresses([{ id: 'p', description: '', type: 'input', category: 'Station 1' }], rack.cpu, rack.modules).values()].every((a) => !a || /^[XY]\d{3}$/.test(a));
/** The PLC by its platform name ("CompactLogix 5370 (1769 L2 / L3)" on a 1769 CPU), else the profile's. */
const plcName = (rack: Rack) => platformOf(rack.cpu.id)?.name ?? `${rack.profile.vendor} ${rack.profile.name}`;

const analogOf = (rack: Rack, type: 'input' | 'output') => (rack.profile.analogChannels?.(rack.cpu, rack.modules) ?? []).filter((c) => c.kind === type);

/** The PLC's own name of an app address, when the PLC names it differently (%I0.0 for X001 on an S7). */
export function nativeName(rack: Rack, address: string): string | null {
  const t = rack.profile.ioTag?.(address, rack.modules, rack.cpu.id) ?? null;
  return t && t.toUpperCase() !== address.toUpperCase() ? t : null;
}

const KIND_WORD: Partial<Record<AddressInfo['kind'], string>> = { input: 'an input', output: 'an output', constant: 'a number', bit: 'an internal bit', register: 'a number register', timer: 'a timer', counter: 'a counter', timerValue: 'a timer value', counterValue: 'a counter value', system: 'a system address' };

/** Check an address typed for an I/O point. Empty = automatic (always ok). */
export function checkIOAddress(rack: Rack, point: { type: 'input' | 'output'; signal?: string }, raw: string): AddressCheck {
  const typed = raw.trim();
  if (!typed) return { ok: true, address: '' };
  const up = typed.toUpperCase();
  // A PLC whose I/O is not the app's X / Y terminals (generic Structured Text): the address is the user's.
  if (!usesTerminals(rack)) return { ok: true, address: typed };
  const analog = point.signal === 'analog';
  const channels = analogOf(rack, point.type).map((c) => c.address);
  const terminals = analog ? channels : rackTerminals(rack, point.type);
  // The PLC's own form of any of the rack's terminals (an input's %I0.0 typed on an output is then said to be an input).
  const every = [...rackTerminals(rack, 'input'), ...rackTerminals(rack, 'output'), ...analogOf(rack, 'input').map((c) => c.address), ...analogOf(rack, 'output').map((c) => c.address)];
  const address = every.find((a) => nativeName(rack, a)?.toUpperCase() === up) ?? up;
  const word = point.type === 'input' ? 'input' : 'output';
  const first = terminals[0];
  // Said in the PLC's own form when it has one (%Q0.0 on an S7), else the app's (Y001).
  const example = first ? ` This PLC's first ${analog ? `analog ${word} channel` : word} is ${nativeName(rack, first) ?? first}.` : '';
  // A terminal the CPU and modules have is valid whatever its number (a 32-point module's X117…X132, a Micro850's
  // X017…X028): the rack is checked first, the PLC's general address rules only for the messages.
  if (terminals.includes(address)) return { ok: true, address };
  const other = analog ? [] : rackTerminals(rack, point.type === 'input' ? 'output' : 'input');
  if (other.includes(address)) return { ok: false, reason: `${up} is ${point.type === 'input' ? 'an output' : 'an input'}, and this point is ${word === 'input' ? 'an input' : 'an output'}.${example}` };
  const info = rack.profile.parseAddress(address) ?? (/^[XY]\d{3}$/.test(address) ? { kind: address[0] === 'X' ? 'input' as const : 'output' as const, isBit: true } : null);
  if (!info) return { ok: false, reason: `"${typed}" is not an address on ${plcName(rack)}.${example}` };
  if (analog) {
    if (terminals.includes(address)) return { ok: true, address };
    if (!channels.length) return { ok: false, reason: `This PLC has no analog ${word} channel. Add an analog module on the Equipment page.` };
    return { ok: false, reason: `An analog ${word} goes on an analog ${word} channel, and ${up} is not one.${example}` };
  }
  if (info.kind !== point.type) return { ok: false, reason: `${up} is ${KIND_WORD[info.kind] ?? 'another kind of address'}, and this point is ${word === 'input' ? 'an input' : 'an output'}.${example}` };
  if (terminals.includes(address)) return { ok: true, address };
  const slot = Number(address[1]);
  const where = slot === 0 ? `the CPU has ${point.type === 'input' ? rack.cpu.builtInInputs : rack.cpu.builtInOutputs} built-in ${word}s`
    : slot > rack.modules.length ? `there is no module in slot ${slot}${rack.modules.length ? ` (the PLC has ${rack.modules.length})` : ''}`
      : `the module in slot ${slot} has ${point.type === 'input' ? rack.modules[slot - 1].inputs : rack.modules[slot - 1].outputs} ${word}s`;
  return { ok: false, reason: `${up} is not on this PLC: ${where}. Add the module on the Equipment page, or use another address.${example}` };
}

/** Check an internal address typed for an HMI tag or a rung: valid on the PLC, and a bit or a number as asked. */
export function checkMemoryAddress(profile: PlcProfile, raw: string, want: 'bit' | 'number'): AddressCheck {
  const typed = raw.trim();
  if (!typed) return { ok: false, reason: 'Type an address.' };
  const up = typed.toUpperCase();
  const info = profile.parseAddress(up);
  if (!info || info.kind === 'constant') return { ok: false, reason: `"${typed}" is not an address on ${profile.name}.` };
  if (want === 'bit' && !info.isBit) return { ok: false, reason: `${up} is ${KIND_WORD[info.kind] ?? 'a number'}; this needs a bit (on/off).` };
  if (want === 'number' && info.isBit) return { ok: false, reason: `${up} is ${KIND_WORD[info.kind] ?? 'a bit'}; this needs a number register.` };
  return { ok: true, address: up };
}
