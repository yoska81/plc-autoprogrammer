import { isAnalog, type IOPoint } from '../types/io';
import type { HmiElement } from './types';

const SCALED: HmiElement['kind'][] = ['bar', 'numeric', 'numeric-entry', 'trend'];

/**
 * When a bar graph, numeric display/entry or trend is bound to an analog I/O point, take the
 * point's engineering scale (e.g. 0–150 psi) — unless the element's scale was already set by hand
 * (anything other than the 0–100 default with no units).
 */
export function withAnalogScale(prev: HmiElement, next: HmiElement, io: IOPoint[], addresses: Map<string, string>): HmiElement {
  if (!SCALED.includes(next.kind) || !next.address || next.address === prev.address) return next;
  const p = io.find((x) => isAnalog(x) && x.analog && (addresses.get(x.id) ?? '').toUpperCase() === next.address!.toUpperCase());
  if (!p?.analog) return next;
  const untouched = (next.min === null || next.min === 0) && (next.max === null || next.max === 100) && !next.units;
  if (!untouched) return next;
  return { ...next, min: p.analog.min, max: p.analog.max, units: p.analog.units || null };
}
