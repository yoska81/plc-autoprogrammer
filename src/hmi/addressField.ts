/**
 * What is wrong with an address typed into an HMI element, in plain words, or null when it is fine. The screens use
 * the app's addresses on every PLC (the export names them the PLC's way). An input or output (X / Y) must be in the
 * project's I/O list (and a button cannot write an input); anything else must be memory of this PLC of the right
 * kind (src/plc/core/addressCheck.ts): a bit for buttons and lamps, a number for values, entries, bars and trends,
 * either for state displays and the header's mode. Buttons and entries cannot write what the PLC sets itself.
 */
import { checkMemoryAddress, nativeName, rackTerminals, type Rack } from '../plc/core/addressCheck';
import type { HmiElement } from './types';

const NUMBER: HmiElement['kind'][] = ['numeric', 'numeric-entry', 'bar', 'trend'];
const BIT: HmiElement['kind'][] = ['button', 'indicator'];

/** X1 / X01 → X001 (inputs and outputs have three digits); C01 → C1 (memory has no leading zeros). */
function tidy(a: string): string | null {
  const m = /^([A-Z]+)(\d+)$/.exec(a);
  if (!m) return null;
  const n = String(Number(m[2]));
  const t = /^[XY]$/.test(m[1]) ? `${m[1]}${n.padStart(3, '0')}` : `${m[1]}${n}`;
  return t === a ? null : t;
}

export function hmiAddressProblem(rack: Rack, io: Set<string>, kind: HmiElement['kind'], raw: string | null | undefined): string | null {
  const { profile } = rack;
  // Generic Structured Text names points by the project's own ids: any name is an address there.
  if (profile.id === 'generic-st') return null;
  const typed = (raw ?? '').trim();
  const a = typed.toUpperCase();
  if (!a) return null;
  // The PLC's own name of one of its terminals (%I0.0, Local:1:I.Pt00.Data, _IO_EM_DI_00).
  const own = [...rackTerminals(rack, 'input'), ...rackTerminals(rack, 'output')].find((t) => nativeName(rack, t)?.toUpperCase() === a);
  if (own) return `${typed} is ${own} on the screens: type ${own}. The export names it ${typed} again.`;
  const fixed = tidy(a);
  if (/^[XY]\d+$/.test(a)) {
    if (!io.has(a)) return fixed && io.has(fixed) ? `Type ${fixed}: inputs and outputs have three digits.` : `${a} is not in the I/O list.`;
    if (kind === 'button' && a.startsWith('X')) return `${a} is an input: the PLC reads it from the wiring, a button cannot write it. Use a memory bit (e.g. C1001).`;
    if (NUMBER.includes(kind)) return `${a} is an on/off point; this shows a number.`;
    return null;
  }
  const info = profile.parseAddress(a);
  if (!info) {
    if (fixed && profile.parseAddress(fixed)) return `Type ${fixed}: memory addresses have no leading zeros.`;
    return `"${typed}" is not an address on ${profile.name}.${profile.id === 'click' ? '' : ` The screens use the app's addresses on every PLC (C1 for a bit, DS1 for a number, X001 / Y001 for I/O); the export gives them their ${profile.name} names.`}`;
  }
  if (info.kind === 'constant') return `${a} is a number, not an address. Type a register such as DS1, or a bit such as C1.`;
  // What the PLC sets itself (same rule as the program checker for system memory).
  if (kind === 'button' || kind === 'numeric-entry') {
    const what = kind === 'button' ? 'a button' : 'an entry';
    if (info.kind === 'system') return `${a} is system memory the PLC sets itself; ${what} cannot write it.`;
    if (info.kind === 'timer' || info.kind === 'counter') return `${a} is a ${info.kind}'s done bit; the ${info.kind} sets it, ${what} cannot.`;
    if (info.kind === 'timerValue' || info.kind === 'counterValue') return `${a} is a ${info.kind === 'timerValue' ? 'timer' : 'counter'}'s running value; the PLC overwrites it. Put a preset in a DS register instead.`;
  }
  if (BIT.includes(kind)) { const r = checkMemoryAddress(profile, a, 'bit'); return r.ok ? null : r.reason; }
  if (NUMBER.includes(kind)) { const r = checkMemoryAddress(profile, a, 'number'); return r.ok ? null : r.reason; }
  return null;
}
