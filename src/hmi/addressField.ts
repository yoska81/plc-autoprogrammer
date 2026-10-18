/**
 * What is wrong with an address typed into an HMI element, in plain words, or null when it is fine. An input or
 * output (X / Y) must be in the project's I/O list (and a button cannot write an input); anything else must be
 * memory of this PLC of the right kind (src/plc/core/addressCheck.ts): a bit for buttons and lamps, a number for
 * values, entries, bars and trends, either for state displays and the header's mode.
 */
import type { PlcProfile } from '../plc/core/profile';
import { checkMemoryAddress } from '../plc/core/addressCheck';
import type { HmiElement } from './types';

const NUMBER: HmiElement['kind'][] = ['numeric', 'numeric-entry', 'bar', 'trend'];
const BIT: HmiElement['kind'][] = ['button', 'indicator'];

export function hmiAddressProblem(profile: PlcProfile, io: Set<string>, kind: HmiElement['kind'], raw: string | null | undefined): string | null {
  const a = (raw ?? '').trim().toUpperCase();
  if (!a) return null;
  if (/^[XY]\d+$/.test(a)) {
    if (!io.has(a)) return `${a} is not in the I/O list.`;
    if (kind === 'button' && a.startsWith('X')) return `${a} is an input: the PLC reads it from the wiring, a button cannot write it. Use a memory bit (e.g. C1001).`;
    if (NUMBER.includes(kind)) return `${a} is an on/off point; this shows a number.`;
    return null;
  }
  if (BIT.includes(kind)) { const r = checkMemoryAddress(profile, a, 'bit'); return r.ok ? null : r.reason; }
  if (NUMBER.includes(kind)) { const r = checkMemoryAddress(profile, a, 'number'); return r.ok ? null : r.reason; }
  const bit = checkMemoryAddress(profile, a, 'bit');
  if (bit.ok) return null;
  const num = checkMemoryAddress(profile, a, 'number');
  return num.ok ? null : bit.reason;
}
