/**
 * Parts catalog used by the electrical design, BOM, drawings and purchasing.
 * The data lives per vendor in ./catalogs (AutomationDirect, Allen-Bradley,
 * Siemens, ...); this module is the lookup used everywhere.
 *
 * - getPart / CATALOG: every vendor (a design may hold parts of any brand).
 * - partsIn(category, pref): what the project may choose from — by default
 *   AutomationDirect only, as before multi-vendor support.
 */
import type { CatalogCategory, CatalogPart } from './types';
import { ALL_PARTS, DEFAULT_PREFERENCE, partsFor, type VendorPreference } from './catalogs';

export const CATALOG: CatalogPart[] = ALL_PARTS;

const BY_PART_NUMBER = new Map<string, CatalogPart>(
  CATALOG.map((p) => [p.partNumber.toUpperCase(), p]),
);

/** Look up a catalog part by its exact part number (case-insensitive), any vendor. */
export function getPart(partNumber: string): CatalogPart | undefined {
  return BY_PART_NUMBER.get(partNumber.trim().toUpperCase());
}

/** Catalog parts in one category from the preferred vendors (AutomationDirect by default), in catalog order. */
export function partsIn(category: CatalogCategory, pref: VendorPreference = DEFAULT_PREFERENCE): CatalogPart[] {
  return partsFor(category, pref).parts;
}
