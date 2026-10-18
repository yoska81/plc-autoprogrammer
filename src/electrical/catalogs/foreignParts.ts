import type { CatalogCategory } from '../types';

/**
 * IEC / Chinese parts found on imported machines' drawings (CHINT, Delixi, Schneider IEC-only, Siemens 5SY,
 * ABB S200, Mean Well …), for "Convert existing drawings". They are NOT catalog parts: nothing here is ever
 * picked for a new design. Each record gives what the maker's own datasheet states, in the converter's
 * DrawnRatings units (src/convert/types.ts), so the converter can match it to a UL catalog part by function
 * and rating. `ul` is the maker's own wording; an empty rating means the maker does not publish it.
 */

export interface ForeignDrawnRatings {
  /** Contactor AC-3 / breaker rated current, A. */
  amps?: number;
  poles?: number;
  /** Coil voltage as the converter writes it: '220VAC', '24VDC', '110VAC', '380VAC'. */
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
  /** UL status in the maker's words: 'UL 508', 'cULus', 'UL 1077', 'CCC/CE only (no UL)'. */
  ul: string;
  drawn: ForeignDrawnRatings;
}

/** Keyed by the exact maker part number. */
export const FOREIGN_PART_DATA: Record<string, ForeignPart> = {
};
