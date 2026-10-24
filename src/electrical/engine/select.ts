/**
 * Catalog pickers for the rule-based engine. Candidates come from the project's preferred vendors
 * (partsFor, in preference order) and then AutomationDirect; a picker returns a real catalog part or
 * null — never an invented part number. Ratings are read through the same keys the catalog uses
 * (amps, hp480, minAmps/maxAmps, outputAmps, inputVolts, phases, coilVoltage …).
 */
import { ALL_PARTS, DEFAULT_PREFERENCE, partsFor, vendorById, type VendorPreference } from '../catalogs';
import type { CatalogCategory, CatalogPart, SupplyVoltage } from '../types';
import { SUPPLY_INFO } from '../../standards/regions';

export const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

export class Picker {
  private pref: VendorPreference;
  constructor(pref: VendorPreference = DEFAULT_PREFERENCE) { this.pref = pref; }

  /** Preferred-vendor parts of a category, then AutomationDirect's (deduplicated). */
  candidates(category: CatalogCategory): CatalogPart[] {
    const preferred = partsFor(category, this.pref).parts;
    const ad = (vendorById('automationdirect')?.parts ?? []).filter((p) => p.category === category);
    const seen = new Set<string>();
    return [...preferred, ...ad].filter((p) => (seen.has(p.partNumber) ? false : (seen.add(p.partNumber), true)));
  }

  /** First candidate (in preference order) that passes `ok`, smallest by `size` among the first vendor that has one. */
  pick(category: CatalogCategory, ok: (p: CatalogPart) => boolean = () => true, size: (p: CatalogPart) => number = () => 0): CatalogPart | null {
    const all = this.candidates(category).filter(ok);
    if (!all.length) return null;
    const firstVendor = all[0].vendor ?? 'automationdirect';
    return all.filter((p) => (p.vendor ?? 'automationdirect') === firstVendor).sort((a, b) => size(a) - size(b))[0];
  }

  /** A specific catalog part (AutomationDirect's when several catalogs list the number). */
  byNumber(pn: string): CatalogPart | null {
    const all = ALL_PARTS.filter((p) => p.partNumber === pn);
    return all.find((p) => (p.vendor ?? 'automationdirect') === 'automationdirect') ?? all[0] ?? null;
  }
}

/** Voltage key suffixes used by the catalog's HP ratings (hp200 / hp230 / hp480 / hp575 / hp1ph120 / hp1ph230). */
export function hpKeys(supply: SupplyVoltage): string[] {
  const v = SUPPLY_INFO[supply].volts;
  if (SUPPLY_INFO[supply].phases === 1) return v <= 130 ? ['hp1ph120', 'hp1ph'] : ['hp1ph230', 'hp1ph'];
  if (v >= 575) return ['hp575', 'hp600'];
  if (v >= 440) return ['hp480', 'hp460'];
  if (v >= 380) return ['hp480', 'hp400'];
  if (v >= 220) return ['hp230', 'hp240'];
  return ['hp200', 'hp208', 'hp230'];
}

/** A part's rated voltage (first number of `volts`), undefined when not stated. */
export function ratedVolts(p: CatalogPart): number | undefined {
  const s = String(p.ratings.volts ?? '');
  const m = /(\d{3})/.exec(s);
  return m ? Number(m[1]) : num(p.ratings.volts);
}

/** Does a part's voltage rating cover the supply? (480Y/277 breakers cover 400/230 Y and 480 V; 600 V parts cover all.) */
export function coversSupply(p: CatalogPart, supply: SupplyVoltage): boolean {
  const v = ratedVolts(p);
  if (v === undefined) return true;
  return v >= SUPPLY_INFO[supply].volts;
}
