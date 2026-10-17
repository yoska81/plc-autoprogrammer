/**
 * Facts the "Improve design" tools compare: price, lead time, cost, part count, heat and enclosure size
 * of a design. Prices come from the app's one price source (src/electrical/pricing.ts: the user's price,
 * the sourcing record, the verified list price) — a part without one is "price to confirm", never
 * estimated. Lead time: the sourcing record's stock class when there is one, else the typical class for
 * the kind of part, labelled "typical".
 */
import { billOfMaterials, buildModel, panelLayout, type DrawingContext } from '../derive';
import { cabinetHeat } from '../thermal';
import { bomCost, type BomEdits } from '../pricing';
import { sourcingOf } from '../../sourcing/data';
import { getHmi } from '../../hmi/hmiCatalog';
import type { CatalogCategory, CatalogPart } from '../types';

export type LeadClass = 'stock' | 'short' | 'long';
export const LEAD_LABEL: Record<LeadClass, string> = { stock: 'In stock', short: '1-3 weeks', long: '4+ weeks' };
const LEAD_RANK: Record<LeadClass, number> = { stock: 0, short: 1, long: 2 };

// Typical availability by kind of part (distributor stock items vs. drives, panels and large enclosures).
const TYPICAL_LEAD: Partial<Record<CatalogCategory, LeadClass>> = {
  vfd: 'short', hmi: 'short', plc: 'short', plcModule: 'short', safetyRelay: 'short', enclosure: 'short', motorProtector: 'short',
};

/** Lead time of a part: the catalog's own statement when there is one, else the typical class. */
export function leadOf(part: CatalogPart | undefined): { cls: LeadClass; typical: boolean } {
  // The maker's / distributor's stock record when there is one (Sourcing page data).
  const rec = part ? sourcingOf(part.partNumber).lead : 'unknown';
  if (rec === 'stock' || rec === 'short') return { cls: rec, typical: false };
  if (rec === 'long' || rec === 'backorder') return { cls: 'long', typical: false };
  const stated = String(part?.ratings?.stock ?? part?.ratings?.leadTime ?? '').toLowerCase();
  if (/discontinued|long|week/.test(stated)) return { cls: /[4-9]\s*week|long/.test(stated) ? 'long' : 'short', typical: false };
  if (/stock/.test(stated)) return { cls: 'stock', typical: false };
  return { cls: (part && TYPICAL_LEAD[part.category]) ?? 'stock', typical: true };
}

export interface DesignFacts {
  /** Sum of the verified prices (selling units actually ordered: packs rounded up), USD. */
  cost: number;
  /** BOM lines without a price (not in `cost`), and their part numbers. */
  unpriced: number;
  unpricedParts: string[];
  /** Pieces in the BOM and distinct part numbers. */
  pieces: number;
  lines: number;
  enclosure: { partNumber?: string; text: string; areaIn2: number };
  heatW: number;
  /** Temperature rise without a fan, °C (null without an enclosure). */
  riseC: number | null;
  /** Slowest part to get, and which parts set it. */
  lead: LeadClass;
  leadParts: string[];
  leadTypical: boolean;
}

export function designFacts(ctx: DrawingContext, edits?: BomEdits): DesignFacts {
  let pieces = 0, lines = 0, lead: LeadClass = 'stock', leadTypical = false;
  let leadParts: string[] = [];
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) {
    if (l.note || !l.partNumber) continue;
    lines++;
    pieces += l.qty;
    const part = ctx.getPart(l.partNumber);
    const ld = part ? leadOf(part) : getHmi(l.partNumber) ? { cls: 'short' as LeadClass, typical: true } : { cls: 'stock' as LeadClass, typical: true };
    if (LEAD_RANK[ld.cls] > LEAD_RANK[lead]) { lead = ld.cls; leadParts = [l.partNumber]; leadTypical = ld.typical; }
    else if (ld.cls === lead && lead !== 'stock') { leadParts.push(l.partNumber); leadTypical ||= ld.typical; }
  }
  // Same total as the order list and the Sourcing page (one price source).
  const priced = bomCost(ctx, edits);
  const { total: cost, unpriced } = priced;
  const unpricedParts = priced.lines.filter((l) => l.extended === undefined).map((l) => l.partNumber);
  const L = panelLayout(ctx);
  const enc = buildModel(ctx).rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind === 'enclosure');
  const r = enc?.part?.ratings;
  const text = r ? `${r.heightIn} x ${r.widthIn} x ${r.depthIn} in` : `${Math.round(L.enclosure.h)} x ${Math.round(L.enclosure.w)} mm`;
  const hmi = ctx.hmiPartNumber ? getHmi(ctx.hmiPartNumber) : undefined;
  const heat = cabinetHeat(ctx.design.components, ctx.getPart, hmi ? { partNumber: hmi.partNumber, sizeIn: hmi.sizeIn } : undefined);
  return {
    cost, unpriced, unpricedParts, pieces, lines,
    enclosure: { partNumber: enc?.partNumber, text, areaIn2: (Number(r?.heightIn) || 0) * (Number(r?.widthIn) || 0) },
    heatW: Math.round(heat.watts * 10) / 10, riseC: heat.rise === null ? null : Math.round(heat.rise * 10) / 10,
    lead, leadParts, leadTypical,
  };
}

export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
