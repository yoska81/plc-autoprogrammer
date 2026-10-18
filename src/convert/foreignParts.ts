/**
 * Ratings of IEC / Chinese parts that are not in the catalog, from their part numbers. Dev 1's
 * cross-reference data (FOREIGN_PARTS) comes first; otherwise the common families' part-number
 * patterns give the rating (CJX2-1210 → 12 A contactor, DZ47-63 C16 → 16 A curve C breaker…).
 * Only what the part number itself states; nothing is guessed.
 */
import type { DrawnRatings } from './types';

/** Known foreign parts by exact part number (filled with the cross-reference data). */
export const FOREIGN_PARTS: Record<string, Partial<DrawnRatings>> = {};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => Partial<DrawnRatings>][] = [
  // contactors: CHINT NXC-12 / CJX2-1210 / Delixi CDC6i-12 / Schneider LC1D12 / Siemens 3RT2016 (size only)
  [/^(?:CJX2[SI]?|CDC?J?X2|CJX1)-?(\d{2,3})(\d{2})\b/i, (m) => ({ amps: Number(m[1]), poles: 3 })],
  [/^NXC-?(\d{1,3})\b/i, (m) => ({ amps: Number(m[1]), poles: 3 })],
  [/^CDC6i?-?(\d{1,3})\b/i, (m) => ({ amps: Number(m[1]), poles: 3 })],
  [/^LC1D(\d{2,3})/i, (m) => ({ amps: Number(m[1]), poles: 3 })],
  // miniature breakers: DZ47-63 C16, NXB-63 3P C10, DZ47s-63/3P C20, CDB6i-63 2P D6
  [/^(?:DZ47[SL]?|NXB|CDB6i?|DZ158)-?\d+\D*?(?:(\d)P\D*)?([BCD])(\d{1,3})\b/i, (m) => ({ curve: m[2].toUpperCase(), amps: Number(m[3]), ...(m[1] ? { poles: Number(m[1]) } : {}) })],
  // thermal overloads: JR36-20 (range printed separately), NR2-25 with range 9-13A
  [/^(?:JR36|NR2|JRS1D?)-?\d+\D+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*A?\b/i, (m) => ({ minAmps: Number(m[1]), maxAmps: Number(m[2]) })],
  // motor protectors: NS2-25 / GV2ME10 (4-6.3A) / 3RV2011-1EA10 range printed separately
  [/^(?:NS2|GV2ME|GV2P)\D*\d*\D+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*A\b/i, (m) => ({ minAmps: Number(m[1]), maxAmps: Number(m[2]) })],
  // DIN-rail supplies: Mean Well DR-120-24 / NDR-240-24 / EDR-75-24 (watts, volts)
  [/^(?:NDR|EDR|DR|HDR|MDR)-(\d+)-(\d+)\b/i, (m) => ({ outputVolts: Number(m[2]), outputAmps: Math.round((Number(m[1]) / Number(m[2])) * 10) / 10 })],
];

/** Ratings a foreign part number states, or null. */
export function foreignRatings(partNumber: string): Partial<DrawnRatings> | null {
  const pn = partNumber.trim();
  if (FOREIGN_PARTS[pn]) return FOREIGN_PARTS[pn];
  for (const [re, fn] of PATTERNS) {
    const m = pn.match(re);
    if (m) return fn(m);
  }
  return null;
}
