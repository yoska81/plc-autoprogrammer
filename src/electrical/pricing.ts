/**
 * The one price source of the app. Every total — order list, Sourcing, Improve design (compare,
 * cost-down, spares) — prices a line here, so they agree to the cent:
 *
 *   1. a unit price the user typed on the order list (edits store, keyed by the generated part number);
 *   2. else the list price of the part (number the user typed, else the design's): the maker's /
 *      distributor's page record (sourcing data), the verified PRICES, or the catalog's own list price
 *      (src/electrical/sourcing.ts decides which one wins);
 *   3. else "price to confirm" — never estimated.
 *
 * Prices are per selling unit; parts sold in packs are ordered in whole packs. Totals are USD; a price
 * in another currency is "to confirm" in a USD total (never converted).
 */
import { getPart } from './catalog';
import { sourcingOf } from './sourcing';
import type { PartPrice } from './prices';
import { billOfMaterials, type DrawingContext } from './derive';
import { currentEdits, type BomEdit } from '../edits/useEditsStore';

export type BomEdits = Record<string, BomEdit>;

/** The open project's order-list edits. */
export const projectEdits = (): BomEdits => currentEdits().bom;

/** List price per selling unit (USD), when one is known. */
export function listPrice(partNumber: string): PartPrice | undefined {
  const s = sourcingOf(partNumber);
  if (s.listPrice === undefined || (s.currency && s.currency !== 'USD')) return undefined;
  return { price: s.listPrice, currency: 'USD', unit: s.priceUnit ?? 'each', date: s.checked ?? '', sourceUrl: s.priceSource ?? '' };
}

/** Pieces per selling unit: the catalog's pack size, else the "pack of N" of the price. */
export function packOf(partNumber: string): number {
  const n = Number(getPart(partNumber)?.ratings?.packQty);
  if (Number.isFinite(n) && n > 1) return n;
  const m = /pack of (\d+)/i.exec(listPrice(partNumber)?.unit ?? '');
  return m ? Number(m[1]) : 1;
}

export interface PricedLine {
  /** Part number ordered (the user's when typed). */
  partNumber: string;
  /** Selling units: the user's quantity when typed (panel order), else the pieces in whole packs. */
  orderQty: number;
  /** Selling units the design needs. */
  generatedQty: number;
  packQty: number;
  /** Verified list price of the ordered part. */
  price?: PartPrice;
  /** Unit price the user typed. */
  userPrice?: number;
  /** orderQty × unit price; undefined = price to confirm. */
  extended?: number;
}

/**
 * Price `pieces` of a design part. `useQty`: the user's typed quantity replaces the computed one
 * (the panel order; a spares order keeps its own quantity).
 */
export function priceLine(generatedPartNumber: string, pieces: number, edits: BomEdits = projectEdits(), useQty = true): PricedLine {
  const e = edits[generatedPartNumber];
  const partNumber = e?.partNumber?.trim() || generatedPartNumber;
  const packQty = packOf(generatedPartNumber);
  const generatedQty = Math.ceil(pieces / packQty);
  const orderQty = useQty && e?.qty !== undefined && e.qty >= 0 ? e.qty : generatedQty;
  const userPrice = e?.price !== undefined && e.price >= 0 ? e.price : undefined;
  const price = listPrice(partNumber);
  const unit = userPrice ?? price?.price;
  return { partNumber, orderQty, generatedQty, packQty, price, userPrice, extended: unit === undefined ? undefined : +(unit * orderQty).toFixed(2) };
}

/** Price of one piece (a pack price divided by its pack size), for savings and spares. */
export function piecePrice(partNumber: string, edits: BomEdits = projectEdits()): number | undefined {
  const l = priceLine(partNumber, 1, edits, false);
  const unit = l.userPrice ?? l.price?.price;
  return unit === undefined ? undefined : unit / l.packQty;
}

export interface BomCost {
  /** Sum of the priced lines, USD. */
  total: number;
  /** Lines with no price (to confirm). */
  unpriced: number;
  lines: (PricedLine & { generatedPartNumber: string; pieces: number })[];
}

/** Cost of the panel parts (the BOM lines with a part number), as the order list prices them. */
export function bomCost(ctx: DrawingContext, edits: BomEdits = projectEdits()): BomCost {
  const lines: BomCost['lines'] = [];
  const byPn = new Map<string, number>();
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) {
    if (l.note || !l.partNumber) continue;
    byPn.set(l.partNumber, (byPn.get(l.partNumber) ?? 0) + l.qty);
  }
  for (const [pn, pieces] of byPn) lines.push({ ...priceLine(pn, pieces, edits), generatedPartNumber: pn, pieces });
  return {
    total: +lines.reduce((s, l) => s + (l.extended ?? 0), 0).toFixed(2),
    unpriced: lines.filter((l) => l.extended === undefined).length,
    lines,
  };
}
