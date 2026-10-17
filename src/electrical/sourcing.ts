import { getPart } from './catalog';
import { priceOf } from './prices';
import { SOURCING_DATA } from './sourcingData';

/**
 * Sourcing layer: what the maker or its official distributor publicly states
 * about price, availability and lifecycle, per part, with where and when it was
 * read. Nothing is estimated: a missing field means "not published".
 */

export type StockClass = 'stock' | 'short' | 'long' | 'discontinued';
export type Lifecycle = 'active' | 'mature' | 'end-of-life';

export interface SourcingRecord {
  listPrice?: number;
  currency?: 'USD' | 'EUR';
  /** Selling unit, e.g. "each", "pack of 10". */
  priceUnit?: string;
  priceSource?: string;
  stock?: StockClass;
  /** The page's own words, e.g. "In stock", "Ships in 2-3 weeks". */
  leadTime?: string;
  lifecycle?: Lifecycle;
  /** Successor part number named by the maker. */
  successor?: string;
  lifecycleSource?: string;
  /** Date the page was read (YYYY-MM-DD). */
  checked: string;
}

export interface Sourcing extends Partial<SourcingRecord> {
  partNumber: string;
  manufacturer?: string;
}

export const STOCK_LABEL: Record<StockClass, string> = { stock: 'In stock', short: 'Short lead time', long: 'Long lead time', discontinued: 'Discontinued' };
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = { active: 'Active', mature: 'Mature (phase-out announced)', 'end-of-life': 'End of life' };

/** Sourcing facts for one part (catalog manufacturer + recorded data; verified prices as fallback). */
export function sourcingOf(partNumber: string): Sourcing {
  const rec = SOURCING_DATA[partNumber];
  const price = priceOf(partNumber);
  const part = getPart(partNumber);
  return {
    partNumber,
    manufacturer: part?.manufacturer,
    ...(price ? { listPrice: price.price, currency: price.currency, priceUnit: price.unit, priceSource: price.sourceUrl, checked: price.date } : {}),
    ...rec,
  };
}

/** Parts that should not go into a new design: end of life or discontinued. */
export const isObsolete = (s: Sourcing) => s.lifecycle === 'end-of-life' || s.stock === 'discontinued';
