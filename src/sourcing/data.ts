/**
 * Sourcing data of a catalog part: price, lead time / stock class, lifecycle and successor, and the
 * cross-brand equivalents a part can be swapped for. One adapter, so the Sourcing page, Optimise and
 * the Engineer review read it the same way. Only data the catalog holds (each with its date and
 * source) is shown; what is not known is "not known", never a guess.
 */
import { ALL_PARTS } from '../electrical/catalogs';
import { getPart } from '../electrical/catalog';
import { priceOf, type PartPrice } from '../electrical/prices';
import type { CatalogCategory, CatalogPart } from '../electrical/types';

/** How quickly a part can be had. */
export type LeadClass = 'stock' | 'short' | 'long' | 'backorder' | 'unknown';
export type Lifecycle = 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';

export interface Sourcing {
  price?: PartPrice;
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
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = { active: 'Active', nrnd: 'Not for new designs', eol: 'End of life', obsolete: 'Obsolete', unknown: 'Not known' };

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v)).trim();

function leadClass(text: string): LeadClass {
  const t = text.toLowerCase();
  if (!t) return 'unknown';
  if (/back.?order|out of stock|unavailable/.test(t)) return 'backorder';
  if (/in stock|stock|same day|ships today/.test(t)) return 'stock';
  if (/long|(\d{2,})\s*(weeks|wk)|months?/.test(t)) return 'long';
  if (/short|days?|1-?2\s*weeks?|week/.test(t)) return 'short';
  return (['stock', 'short', 'long', 'backorder'] as const).find((c) => t === c) ?? 'unknown';
}

function lifecycleOf(text: string): Lifecycle {
  const t = text.toLowerCase();
  if (!t) return 'unknown';
  if (/obsolete|discontinued|retired/.test(t)) return 'obsolete';
  if (/end.?of.?life|\beol\b|last.?time.?buy/.test(t)) return 'eol';
  if (/nrnd|not recommended|not for new/.test(t)) return 'nrnd';
  if (/active|current|production/.test(t)) return 'active';
  return 'unknown';
}

/** Sourcing data of one part number (from the catalog's ratings and the verified price list). */
export function sourcingOf(partNumber: string): Sourcing {
  const p = getPart(partNumber);
  const r = p?.ratings ?? {};
  const leadText = str(r.leadTime ?? r.lead ?? r.stock ?? r.availability);
  return {
    price: priceOf(partNumber),
    lead: leadClass(str(r.leadClass) || leadText),
    ...(leadText ? { leadText } : {}),
    lifecycle: lifecycleOf(str(r.lifecycle ?? r.status)),
    ...(str(r.successor) ? { successor: str(r.successor) } : {}),
    ...(str(r.checkedOn ?? r.sourcingDate) ? { checkedOn: str(r.checkedOn ?? r.sourcingDate) } : {}),
    ...(str(r.sourcingSource) ? { sourceUrl: str(r.sourcingSource) } : {}),
  };
}

/** Why a line needs attention: back-order, long lead, end of life (red = can't build as designed). */
export function sourcingFlags(s: Sourcing): { level: 'red' | 'orange'; text: string }[] {
  const out: { level: 'red' | 'orange'; text: string }[] = [];
  if (s.lead === 'backorder') out.push({ level: 'red', text: 'Back-order' });
  if (s.lifecycle === 'obsolete') out.push({ level: 'red', text: `Obsolete${s.successor ? ` (successor ${s.successor})` : ''}` });
  if (s.lifecycle === 'eol') out.push({ level: 'orange', text: `End of life${s.successor ? ` (successor ${s.successor})` : ''}` });
  if (s.lifecycle === 'nrnd') out.push({ level: 'orange', text: 'Not for new designs' });
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

/** Catalog parts of other brands that can replace this one (same function and ratings). */
export function equivalentsOf(partNumber: string): Equivalent[] {
  const p = getPart(partNumber);
  const rule = p && RULES[p.category];
  if (!p || !rule) return [];
  const r = p.ratings;
  const fits = (c: CatalogPart) => {
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
  return ALL_PARTS.filter(fits).map((c) => ({ part: c, differences: differencesOf(p, c), sourcing: sourcingOf(c.partNumber) }))
    .sort((a, b) => (a.sourcing.price?.price ?? Infinity) - (b.sourcing.price?.price ?? Infinity));
}

/** What changes when `to` replaces `from`. */
export function differencesOf(from: CatalogPart, to: CatalogPart): string[] {
  const out: string[] = [];
  const keys = [...new Set([...Object.keys(from.ratings), ...Object.keys(to.ratings)])]
    .filter((k) => !/source|datasheet|footprint|family|series|note|url/i.test(k));
  for (const k of keys) {
    const a = from.ratings[k], b = to.ratings[k];
    if (a !== undefined && b !== undefined && !same(a, b)) out.push(`${k}: ${a} → ${b}`);
  }
  if (from.widthMm && to.widthMm && to.widthMm !== from.widthMm) out.push(`width ${from.widthMm} → ${to.widthMm} mm${to.widthMm > from.widthMm ? ' (more rail space)' : ''}`);
  if (!to.verified) out.push(`ratings not fully verified${to.verify ? `: ${to.verify}` : ''}`);
  return out;
}
