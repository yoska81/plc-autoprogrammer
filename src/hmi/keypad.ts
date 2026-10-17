/**
 * Numeric entry on the live panel: what the operator typed on the keypad, checked against the
 * element's limits and the PLC register's type before it is written.
 */
import type { HmiElement } from './types';

/** Whole-number registers (DS 16-bit, DD 32-bit, DH hex) take no decimals; DF is a float. */
export function registerRange(address: string): { integer: boolean; min: number; max: number } {
  const a = address.trim().toUpperCase();
  if (/^DS\d/.test(a)) return { integer: true, min: -32768, max: 32767 };
  if (/^DD\d/.test(a)) return { integer: true, min: -2147483648, max: 2147483647 };
  if (/^DH\d/.test(a)) return { integer: true, min: 0, max: 65535 };
  return { integer: false, min: -3.4e38, max: 3.4e38 };
}

/** The value to write, or why it is refused (plain English). */
export function parseEntry(text: string, el: Pick<HmiElement, 'address' | 'min' | 'max' | 'units'>): { value: number } | { error: string } {
  const t = text.trim();
  if (!t || t === '-' || t === '.') return { error: 'Enter a value.' };
  const v = Number(t);
  if (!Number.isFinite(v)) return { error: `"${t}" is not a number.` };
  const reg = registerRange(el.address ?? '');
  if (reg.integer && !Number.isInteger(v)) return { error: 'Whole numbers only for this setpoint.' };
  const lo = el.min ?? reg.min, hi = el.max ?? reg.max;
  const u = el.units ? ` ${el.units}` : '';
  if (v < lo || v > hi) return { error: `Allowed: ${lo} to ${hi}${u}.` };
  return { value: v };
}
