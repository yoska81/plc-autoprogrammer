import type { CatalogCategory, CatalogPart } from '../types';
import { FOREIGN_RAW } from './foreignPartsData';

/**
 * IEC / Chinese parts found on imported machines' drawings (foreignPartsData.ts), for "Convert existing
 * drawings". They are NOT catalog parts: nothing here is ever picked for a new design. Each record gives
 * what the maker's own datasheet states, in the converter's DrawnRatings units (src/convert/types.ts), so
 * the converter can match it to a UL catalog part by function and rating (foreignEquivalents in
 * ../foreign.ts). `ul` is the maker's own wording; an absent rating means the maker does not publish it.
 */

export interface ForeignDrawnRatings {
  /** Contactor AC-3 / breaker rated current, A. */
  amps?: number;
  poles?: number;
  /** Coil voltage as the converter writes it: '220VAC', '24VDC', '110-120VAC'. */
  coilVoltage?: string;
  /** Breaking capacity (Icn / Icu), kA. */
  kA?: number;
  /** Breaker trip curve: 'B' | 'C' | 'D'. */
  curve?: string;
  /** Overload / motor protector setting range, A. */
  minAmps?: number;
  maxAmps?: number;
  /** Drive / motor power, kW. */
  kw?: number;
  outputVolts?: number;
  outputAmps?: number;
}

export interface ForeignPart {
  maker: string;
  category: CatalogCategory;
  description: string;
  /** Maker page or PDF the values were read from. */
  url: string;
  /** UL status in the maker's words: 'UL 508', 'cULus', 'UL 1077', 'CCC, CE (no UL stated)'. */
  ul: string;
  drawn: ForeignDrawnRatings;
  /** The full record, with every rating the maker publishes (aux contacts, trip class, footprint …). */
  part: CatalogPart;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** The converter's ratings from a full record. */
export function drawnRatings(p: CatalogPart): ForeignDrawnRatings {
  const r = p.ratings;
  const d: ForeignDrawnRatings = {
    amps: ['contactor', 'breaker', 'relay'].includes(p.category) ? num(r.amps) : undefined,
    poles: num(r.poles),
    coilVoltage: typeof r.coilVoltage === 'string' ? r.coilVoltage : undefined,
    kA: num(r.interruptingKA),
    curve: typeof r.curve === 'string' ? r.curve : undefined,
    minAmps: num(r.minAmps),
    maxAmps: num(r.maxAmps),
    kw: num(r.kw) ?? (num(r.ratedWatts) !== undefined ? num(r.ratedWatts)! / 1000 : undefined),
    outputVolts: num(r.outputVolts),
    outputAmps: num(r.outputAmps),
  };
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as ForeignDrawnRatings;
}

/** Keyed by the exact maker part number. */
export const FOREIGN_PART_DATA: Record<string, ForeignPart> = Object.fromEntries(FOREIGN_RAW.map((p) => [p.partNumber, {
  maker: p.manufacturer,
  category: p.category,
  description: p.description,
  url: p.url,
  ul: String(p.ratings.ul ?? ''),
  drawn: drawnRatings(p),
  part: p,
}]));

// Spaces are print formatting: 'NXC-09  220V' and Rexroth's '4WE 6 E6X/EG24N9K4' find their records.
const norm = (s: string) => s.toUpperCase().replace(/[\s_]+/g, '');
const BY_NORM = new Map(Object.keys(FOREIGN_PART_DATA).map((pn) => [norm(pn), pn]));

/** A foreign part by its part number as printed (case and spaces ignored). */
export function foreignPart(partNumber: string): ForeignPart | undefined {
  const pn = BY_NORM.get(norm(partNumber));
  return pn ? FOREIGN_PART_DATA[pn] : undefined;
}
