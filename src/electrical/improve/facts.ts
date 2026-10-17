/**
 * Facts the "Improve design" tools compare: price, lead time, cost, part count, heat and enclosure size
 * of a design. Prices are the verified list prices (src/electrical/prices.ts) — a part without one is
 * counted as "price to confirm", never estimated. Lead time: what the catalog states for the part when it
 * does (ratings.leadTime / ratings.stock), else the typical class for the kind of part, labelled "typical".
 * When the sourcing layer lands (price, stock and lifecycle per part) this file is the one place to read it.
 */
import { billOfMaterials, buildModel, panelLayout, type DrawingContext } from '../derive';
import { cabinetHeat } from '../thermal';
import { priceOf } from '../prices';
import { getHmi } from '../../hmi/hmiCatalog';
import type { CatalogCategory, CatalogPart } from '../types';

export type LeadClass = 'stock' | 'short' | 'long';
export const LEAD_LABEL: Record<LeadClass, string> = { stock: 'In stock', short: '1-3 weeks', long: '4+ weeks' };
const LEAD_RANK: Record<LeadClass, number> = { stock: 0, short: 1, long: 2 };

// Typical availability by kind of part (distributor stock items vs. drives, panels and large enclosures).
const TYPICAL_LEAD: Partial<Record<CatalogCategory, LeadClass>> = {
  vfd: 'short', hmi: 'short', plc: 'short', plcModule: 'short', safetyRelay: 'short', enclosure: 'short', motorProtector: 'short',
};

/** Unit price of one piece (pack prices divided by the pack size), when a verified price exists. */
export function piecePrice(partNumber: string, part?: CatalogPart): number | undefined {
  const p = priceOf(partNumber);
  if (!p) return undefined;
  const pack = Number(part?.ratings?.packQty) || Number(/pack of (\d+)/i.exec(p.unit)?.[1]) || 1;
  return p.price / pack;
}

/** Lead time of a part: the catalog's own statement when there is one, else the typical class. */
export function leadOf(part: CatalogPart | undefined): { cls: LeadClass; typical: boolean } {
  const stated = String(part?.ratings?.stock ?? part?.ratings?.leadTime ?? '').toLowerCase();
  if (/discontinued|long|week/.test(stated)) return { cls: /[4-9]\s*week|long/.test(stated) ? 'long' : 'short', typical: false };
  if (/stock/.test(stated)) return { cls: 'stock', typical: false };
  return { cls: (part && TYPICAL_LEAD[part.category]) ?? 'stock', typical: true };
}

export interface DesignFacts {
  /** Sum of the verified prices (selling units actually ordered: packs rounded up), USD. */
  cost: number;
  /** BOM lines without a verified price (not in `cost`). */
  unpriced: number;
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

export function designFacts(ctx: DrawingContext): DesignFacts {
  let cost = 0, unpriced = 0, pieces = 0, lines = 0, lead: LeadClass = 'stock', leadTypical = false;
  let leadParts: string[] = [];
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) {
    if (l.note || !l.partNumber) continue;
    lines++;
    pieces += l.qty;
    const part = ctx.getPart(l.partNumber);
    const pr = priceOf(l.partNumber);
    if (pr) {
      const pack = Number(part?.ratings?.packQty) || Number(/pack of (\d+)/i.exec(pr.unit)?.[1]) || 1;
      cost += Math.ceil(l.qty / pack) * pr.price;
    } else unpriced++;
    const ld = part ? leadOf(part) : getHmi(l.partNumber) ? { cls: 'short' as LeadClass, typical: true } : { cls: 'stock' as LeadClass, typical: true };
    if (LEAD_RANK[ld.cls] > LEAD_RANK[lead]) { lead = ld.cls; leadParts = [l.partNumber]; leadTypical = ld.typical; }
    else if (ld.cls === lead && lead !== 'stock') { leadParts.push(l.partNumber); leadTypical ||= ld.typical; }
  }
  const L = panelLayout(ctx);
  const enc = buildModel(ctx).rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind === 'enclosure');
  const r = enc?.part?.ratings;
  const text = r ? `${r.heightIn} x ${r.widthIn} x ${r.depthIn} in` : `${Math.round(L.enclosure.h)} x ${Math.round(L.enclosure.w)} mm`;
  const hmi = ctx.hmiPartNumber ? getHmi(ctx.hmiPartNumber) : undefined;
  const heat = cabinetHeat(ctx.design.components, ctx.getPart, hmi ? { partNumber: hmi.partNumber, sizeIn: hmi.sizeIn } : undefined);
  return {
    cost: Math.round(cost * 100) / 100, unpriced, pieces, lines,
    enclosure: { partNumber: enc?.partNumber, text, areaIn2: (Number(r?.heightIn) || 0) * (Number(r?.widthIn) || 0) },
    heatW: Math.round(heat.watts * 10) / 10, riseC: heat.rise === null ? null : Math.round(heat.rise * 10) / 10,
    lead, leadParts, leadTypical,
  };
}

export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
