/**
 * Sourcing data of a catalog part: price, lead time / stock class, lifecycle and successor, and the
 * cross-brand equivalents a part can be swapped for. One adapter, so the Sourcing page, Optimise and
 * the Engineer review read it the same way. Only data the catalog holds (each with its date and
 * source) is shown; what is not known is "not known", never a guess.
 */
import { ALL_PARTS } from '../electrical/catalogs';
import { getPart } from '../electrical/catalog';
import { differences, equivalents, functionKey } from '../electrical/crossref';
import { sourcingOf as recordOf, type Sourcing as SourcingRecord } from '../electrical/sourcing';
import type { CatalogCategory, CatalogPart } from '../electrical/types';

/** How quickly a part can be had. */
export type LeadClass = 'stock' | 'short' | 'long' | 'backorder' | 'unknown';
export type Lifecycle = 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';

/** A list price as the maker or distributor states it. */
export interface Price {
  price: number;
  currency: 'USD' | 'EUR';
  /** Selling unit, e.g. "each", "pack of 10". */
  unit: string;
  /** Date the price was read (YYYY-MM-DD). */
  date: string;
  sourceUrl?: string;
}

export interface Sourcing {
  price?: Price;
  lead: LeadClass;
  /** Lead time as the source states it ("2-3 weeks"), when known. */
  leadText?: string;
  lifecycle: Lifecycle;
  /** Replacement the manufacturer names for an end-of-life part. */
  successor?: string;
  /** Date the availability / lifecycle was read (YYYY-MM-DD). */
  checkedOn?: string;
  sourceUrl?: string;
}

export const LEAD_LABEL: Record<LeadClass, string> = { stock: 'In stock', short: 'Short lead', long: 'Long lead', backorder: 'Back-order', unknown: 'Not known' };
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = { active: 'Active', nrnd: 'Phase-out announced', eol: 'End of life', obsolete: 'Discontinued', unknown: 'Not known' };

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v)).trim();

const LEAD: Record<NonNullable<SourcingRecord['stock']>, LeadClass> = { stock: 'stock', short: 'short', long: 'long', discontinued: 'backorder' };
const LIFE: Record<NonNullable<SourcingRecord['lifecycle']>, Lifecycle> = { active: 'active', mature: 'nrnd', 'end-of-life': 'eol' };

/** Sourcing data of one part number: the sourcing records (src/electrical/sourcing.ts) and the panel ratings (HMI lifecycle). */
export function sourcingOf(partNumber: string): Sourcing {
  const rec = recordOf(partNumber);
  const r = getPart(partNumber)?.ratings ?? {};
  // HMI panels carry lifecycle 'legacy' / successor in their ratings.
  const life: Lifecycle = rec.stock === 'discontinued' ? 'obsolete'
    : rec.lifecycle ? LIFE[rec.lifecycle]
    : str(r.lifecycle) === 'legacy' ? 'nrnd' : str(r.lifecycle) === 'active' ? 'active' : 'unknown';
  const successor = rec.successor ?? (str(r.successor) || undefined);
  return {
    ...(rec.listPrice !== undefined ? { price: { price: rec.listPrice, currency: rec.currency ?? 'USD', unit: rec.priceUnit ?? 'each', date: rec.checked ?? '', sourceUrl: rec.priceSource } } : {}),
    lead: rec.stock ? LEAD[rec.stock] : 'unknown',
    ...(rec.leadTime ? { leadText: rec.leadTime } : {}),
    lifecycle: life,
    ...(successor ? { successor } : {}),
    ...(rec.checked ? { checkedOn: rec.checked } : {}),
    ...(rec.lifecycleSource || str(r.lifecycleSource) ? { sourceUrl: rec.lifecycleSource ?? str(r.lifecycleSource) } : {}),
  };
}

/** Why a line needs attention: back-order, long lead, end of life (red = can't build as designed). */
export function sourcingFlags(s: Sourcing): { level: 'red' | 'orange'; text: string }[] {
  const out: { level: 'red' | 'orange'; text: string }[] = [];
  if (s.lead === 'backorder' && s.lifecycle !== 'obsolete') out.push({ level: 'red', text: 'Back-order' });
  if (s.lifecycle === 'obsolete') out.push({ level: 'red', text: `Discontinued${s.successor ? ` (successor ${s.successor})` : ''}` });
  if (s.lifecycle === 'eol') out.push({ level: 'orange', text: `End of life${s.successor ? ` (successor ${s.successor})` : ''}` });
  if (s.lifecycle === 'nrnd') out.push({ level: 'orange', text: `Phase-out announced${s.successor ? ` (successor ${s.successor})` : ''}` });
  if (s.lead === 'long') out.push({ level: 'orange', text: `Long lead${s.leadText ? `: ${s.leadText}` : ''}` });
  return out;
}

// --- cross-brand equivalents -------------------------------------------------------------------

type Rule = { eq?: string[]; atLeast?: string[]; covers?: [string, string] };
/** What must match for a part of another brand to be a drop-in replacement, per category. */
const RULES: Partial<Record<CatalogCategory, Rule>> = {
  breaker: { eq: ['amps', 'poles', 'curve'], atLeast: ['interruptingKA'] },
  fuse: { eq: ['amps', 'fuseClass'], atLeast: ['volts'] },
  contactor: { eq: ['poles', 'coilVoltage'], atLeast: ['amps'] },
  // Overloads mount on their own maker's contactors ("forUse"): only one for the same contactors replaces it.
  overload: { eq: ['forUse'], covers: ['minAmps', 'maxAmps'] },
  motorProtector: { eq: ['poles'], covers: ['minAmps', 'maxAmps'] },
  powerSupply: { eq: ['outputVolts', 'phases'], atLeast: ['outputAmps'] },
  relay: { eq: ['controlVolts'], atLeast: ['amps', 'poles'] },
  safetyRelay: { eq: ['coilVoltage'], atLeast: ['safetyOutputs'] },
  vfd: { eq: ['inputPhases'], atLeast: ['outputAmps'] },
  pushbutton: { eq: ['color', 'size'] },
  estop: { eq: ['size'] },
  selector: { eq: ['positions', 'size'] },
  pilotLight: { eq: ['color', 'volts', 'size'] },
  sensor: { eq: ['type', 'output'] },
  terminal: { atLeast: ['amps'] },
};

const num = (v: unknown) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : NaN; };
const same = (a: unknown, b: unknown) => str(a).toLowerCase() === str(b).toLowerCase();

/** A replacement candidate and how it differs. */
export interface Equivalent {
  part: CatalogPart;
  /** Plain-English differences (ratings, footprint, verification). */
  differences: string[];
  sourcing: Sourcing;
}

/**
 * Catalog parts of other brands that can replace this one: the cross reference (src/electrical/crossref.ts)
 * where it covers the part, else the rules above. Overloads also need the same contactors ("forUse").
 */
export function equivalentsOf(partNumber: string): Equivalent[] {
  const p = getPart(partNumber);
  if (!p) return [];
  const rule = RULES[p.category];
  const r = p.ratings;
  const fits = (c: CatalogPart) => {
    if (!rule) return false;
    if (c.partNumber === p.partNumber || c.category !== p.category || same(c.manufacturer, p.manufacturer)) return false;
    for (const k of rule.eq ?? []) if (r[k] !== undefined && !same(c.ratings[k], r[k])) return false;
    for (const k of rule.atLeast ?? []) if (r[k] !== undefined && !(num(c.ratings[k]) >= num(r[k]))) return false;
    if (rule.covers) {
      const [lo, hi] = rule.covers;
      const mid = (num(r[lo]) + num(r[hi])) / 2;
      if (!(num(c.ratings[lo]) <= mid && mid <= num(c.ratings[hi]))) return false;
    }
    return true;
  };
  const found = functionKey(p)
    ? equivalents(p, ALL_PARTS).filter((e) => p.category !== 'overload' || r.forUse === undefined || same(e.part.ratings.forUse, r.forUse)).map((e) => e.part)
    : ALL_PARTS.filter(fits);
  return found.map((c) => ({ part: c, differences: differencesOf(p, c), sourcing: sourcingOf(c.partNumber) }))
    .sort((a, b) => (a.sourcing.price?.price ?? Infinity) - (b.sourcing.price?.price ?? Infinity));
}

/** What changes when `to` replaces `from` (empty = drop-in). */
export function differencesOf(from: CatalogPart, to: CatalogPart): string[] {
  const out = differences(from, to);
  if (!to.verified) out.push(`ratings not fully verified${to.verify ? `: ${to.verify}` : ''}`);
  return out;
}
