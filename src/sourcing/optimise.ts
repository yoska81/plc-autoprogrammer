/**
 * Optimise: for each BOM line, the current part and its cross-brand equivalents are scored against the
 * user's goals (lead time, price, quality, one brand); where another part scores clearly better it is
 * proposed, with the saving, the lead-time gain and the risks. The user accepts each line.
 */
import { getPart } from '../electrical/catalog';
import { differencesOf, equivalentsOf, sourcingOf, LEAD_LABEL, type LeadClass, type Sourcing } from './data';
import type { CatalogPart } from '../electrical/types';

export interface Goals { lead: number; price: number; quality: number; oneBrand: number }
export const DEFAULT_GOALS: Goals = { lead: 2, price: 2, quality: 2, oneBrand: 0 };

export interface Proposal {
  from: string;
  to: string;
  qty: number;
  manufacturer: string;
  /** Total saving for the line (positive = cheaper), null when a price is not known. */
  saving: number | null;
  /** Currency of the saving. */
  currency: 'USD' | 'EUR';
  /** "Long lead → In stock", null when the lead time does not improve. */
  leadGain: string | null;
  risks: string[];
}

const LEAD_RANK: Record<LeadClass, number> = { stock: 0, short: 1, unknown: 1.5, long: 2.5, backorder: 4 };

function quality(p: CatalogPart, s: Sourcing): number {
  let q = p.verified ? 1 : 0.4;
  if (s.lifecycle === 'obsolete') q -= 1;
  else if (s.lifecycle === 'eol') q -= 0.6;
  else if (s.lifecycle === 'nrnd') q -= 0.3;
  return q;
}

/** Score of a candidate (higher is better), relative to the current part. */
function score(c: CatalogPart, s: Sourcing, cur: { part: CatalogPart; s: Sourcing }, g: Goals, brand: string | null): number {
  const priceTerm = s.price && cur.s.price && s.price.currency === cur.s.price.currency ? (cur.s.price.price - s.price.price) / Math.max(1, cur.s.price.price) : 0;
  const leadTerm = (LEAD_RANK[cur.s.lead] - LEAD_RANK[s.lead]) / 4;
  const qualityTerm = quality(c, s) - quality(cur.part, cur.s);
  const brandTerm = brand ? (c.manufacturer === brand ? 1 : 0) - (cur.part.manufacturer === brand ? 1 : 0) : 0;
  return g.price * priceTerm + g.lead * leadTerm + g.quality * qualityTerm + g.oneBrand * brandTerm;
}

/** Proposals for the BOM lines (part number and quantity), best change per line. */
export function optimise(lines: { partNumber: string; qty: number }[], goals: Goals): Proposal[] {
  // "One brand": the brand most of the BOM already is.
  const count = new Map<string, number>();
  for (const l of lines) { const m = getPart(l.partNumber)?.manufacturer; if (m) count.set(m, (count.get(m) ?? 0) + l.qty); }
  const brand = goals.oneBrand > 0 ? [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
  const out: Proposal[] = [];
  for (const l of lines) {
    const part = getPart(l.partNumber);
    if (!part) continue;
    const cur = { part, s: sourcingOf(l.partNumber) };
    // Cross-brand equivalents (they include the "one brand" brand's part when it has one).
    const cands = equivalentsOf(l.partNumber).map((e) => ({ part: e.part, s: e.sourcing }));
    let best: { part: CatalogPart; s: Sourcing; v: number } | null = null;
    for (const c of cands) {
      const v = score(c.part, c.s, cur, goals, brand);
      if (v > 0.05 && (!best || v > best.v)) best = { ...c, v };
    }
    if (!best) continue;
    const saving = best.s.price && cur.s.price && best.s.price.currency === cur.s.price.currency ? Math.round((cur.s.price.price - best.s.price.price) * l.qty * 100) / 100 : null;
    const leadGain = LEAD_RANK[best.s.lead] < LEAD_RANK[cur.s.lead] ? `${LEAD_LABEL[cur.s.lead]} → ${LEAD_LABEL[best.s.lead]}` : null;
    const risks = differencesOf(part, best.part);
    if (!best.s.price) risks.push('price not known');
    else if (cur.s.price && best.s.price.currency !== cur.s.price.currency) risks.push(`prices in different currencies (${cur.s.price.currency} / ${best.s.price.currency}): compare them yourself`);
    if (best.s.lead === 'unknown') risks.push('availability not known: run a live check');
    out.push({ from: l.partNumber, to: best.part.partNumber, qty: l.qty, manufacturer: best.part.manufacturer, saving, currency: cur.s.price?.currency ?? 'USD', leadGain, risks });
  }
  return out;
}
