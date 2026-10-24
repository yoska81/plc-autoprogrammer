import type { ProjectSnapshot } from './collect';
import { billOfMaterials } from '../electrical/derive';
import { getPart } from '../electrical/catalog';
import { supplierOfPart } from '../electrical/catalogs';
import { getHmi, hmiMakerOf } from '../hmi/hmiCatalog';
import { sparePartsTable } from './docs/maintenance';
import { isGroup } from './docs/table';
import type { PartPrice } from '../electrical/prices';
import { packOf, priceLine } from '../electrical/pricing';
import { listLabels } from '../electrical/labels/list';
import { labelSetupFor, sizeOf } from '../electrical/labels/setup';
import { supplyByPart } from '../electrical/labels/printers';
import { useProjectsStore } from '../store/useProjectsStore';
import { currentEdits, type BomEdit } from '../edits/useEditsStore';

/**
 * Purchasing: what to order, from whom, how many selling units, and what it
 * costs where a verified list price exists. Built from the BOM, optionally
 * the recommended spares and the label supplies chosen on the Labels tab.
 * Part numbers always come from the design; nothing is invented.
 */

export interface OrderLine {
  partNumber: string;
  manufacturer: string;
  description: string;
  supplier: string;
  /** Pieces the panel needs (BOM), spares and consumables, in pieces. */
  bomQty: number;
  spareQty: number;
  /** Pieces per selling unit (1 = sold each). */
  packQty: number;
  /** Selling units to order. */
  orderQty: number;
  tags: string[];
  /** Why the line is there: BOM, spares, label supplies. */
  source: string;
  price?: PartPrice;
  /** orderQty × price, when the price is verified. */
  extended?: number;
  /** Something to check before ordering. */
  note?: string;
  /** Part number the design produced: the key of the user's edits (stays when the user types another one). */
  generatedPartNumber: string;
  /** Unit price the user typed (used instead of a missing or different list price). */
  userPrice?: number;
  /** Fields the user typed over ("entered by you"), with the generated values to go back to. */
  edited?: { partNumber?: string; description?: string; orderQty?: number; price?: boolean };
}

export interface SupplierGroup {
  supplier: string;
  lines: OrderLine[];
  /** Sum of the verified extended prices. */
  subtotal: number;
  /** Lines without a verified price. */
  unpriced: number;
}

export interface OrderList {
  groups: SupplierGroup[];
  /** BOM items still to select (no part number yet). */
  toSelect: string[];
  total: number;
  unpriced: number;
  /** The panel parts alone (no label supplies): the figure Sourcing and Improve design show. */
  parts: { total: number; unpriced: number };
  /** Oldest price date used, for "list price as of …". */
  priceDate: string | null;
  currency: 'USD';
}

export interface OrderOptions {
  /** Add the recommended spares to the panel parts. */
  spares: boolean;
  labels: boolean;
  /** Only the recommended spares (a separate order). */
  sparesOnly?: boolean;
  /** The user's edits by generated part number (default: the open project's). */
  edits?: Record<string, BomEdit>;
}

/** What the order file and the summary hold by default: the panel parts and label supplies, no spares. */
export const PANEL_ORDER: OrderOptions = { spares: false, labels: true };
/** The recommended spares on their own. */
export const SPARES_ORDER: OrderOptions = { spares: true, labels: false, sparesOnly: true };

/** Supplier of a catalog part: the shop its product page is on. */
function supplierOf(partNumber: string): string {
  if (getHmi(partNumber) && !getHmi(partNumber)!.catalog) return 'AutomationDirect';
  return supplierOfPart(getPart(partNumber)) ?? 'Supplier to confirm';
}


export function buildOrderList(p: ProjectSnapshot, o: OrderOptions): OrderList {
  const lines = new Map<string, OrderLine>();
  const toSelect: string[] = [];
  const add = (pn: string, manufacturer: string, description: string, pieces: number, tags: string[], kind: 'bom' | 'spare') => {
    const cur = lines.get(pn);
    if (cur) {
      if (kind === 'bom') cur.bomQty += pieces; else cur.spareQty += pieces;
      cur.tags.push(...tags.filter((t) => !cur.tags.includes(t)));
      return;
    }
    lines.set(pn, {
      partNumber: pn, manufacturer, description: description.replace(/\s+—\s+\d+ required by terminal plan$/, ''),
      supplier: supplierOf(pn), bomQty: kind === 'bom' ? pieces : 0, spareQty: kind === 'spare' ? pieces : 0,
      packQty: packOf(pn), orderQty: 0, tags: [...tags], source: '', generatedPartNumber: pn,
    });
  };

  if (o.sparesOnly) {
    // Spares only: no panel parts, no label supplies.
  } else if (p.drawingCtx) {
    for (const g of billOfMaterials(p.drawingCtx)) for (const l of g.lines) {
      if (l.note || !l.partNumber) { toSelect.push(l.description); continue; }
      add(l.partNumber, l.manufacturer, l.description, l.qty, l.tags, 'bom');
    }
  } else if (p.hmi) {
    add(p.hmi.hmiPartNumber, hmiMakerOf(p.hmi.hmiPartNumber), getHmi(p.hmi.hmiPartNumber)?.description ?? 'Operator touch panel', 1, ['HMI1'], 'bom');
  }

  if (o.spares) {
    // Same recommendation as the maintenance chapter of the engineering package.
    for (const r of sparePartsTable(p).rows) {
      if (isGroup(r)) continue;
      const [pn, mfr, desc, , , spares] = r;
      const n = Number(spares);
      if (pn && n > 0) add(pn, mfr, desc, n, [], 'spare');
    }
  }

  const edits = o.edits ?? currentEdits().bom;
  const out: OrderLine[] = [...lines.values()].map((l) => {
    const pieces = l.bomQty + l.spareQty;
    const e = edits[l.partNumber];
    // One price source for every total (src/electrical/pricing.ts). A typed quantity is for the panel order; the spares order keeps its own.
    const pl = priceLine(l.partNumber, pieces, edits, !o.sparesOnly);
    const { partNumber, orderQty, generatedQty: genQty, price, userPrice } = pl;
    const source = [l.bomQty ? 'BOM' : '', l.spareQty ? 'spares' : ''].filter(Boolean).join(' + ');
    const edited = e ? {
      ...(partNumber !== l.partNumber ? { partNumber: l.partNumber } : {}),
      ...(e.description !== undefined ? { description: l.description } : {}),
      ...(orderQty !== genQty ? { orderQty: genQty } : {}),
      ...(userPrice !== undefined ? { price: true } : {}),
    } : undefined;
    return {
      ...l, partNumber, description: e?.description ?? l.description, orderQty, source, price, userPrice,
      extended: pl.extended,
      note: l.packQty > 1 ? `Sold in packs of ${l.packQty}: ${pieces} needed → ${genQty} pack${genQty > 1 ? 's' : ''}` : undefined,
      edited: edited && Object.keys(edited).length ? edited : undefined,
    };
  });

  // Label supplies chosen on the Labels tab (printer consumables).
  if (o.labels && !o.sparesOnly && p.drawingCtx) {
    const setup = labelSetupFor(useProjectsStore.getState().activeId);
    const sup = setup.supply ? supplyByPart(setup.supply) : undefined;
    if (sup) {
      const labels = listLabels(p.drawingCtx);
      const n = labels.reduce((s, l) => s + (setup.useCopies ? l.copies : 1), 0);
      const rolls = !sup.continuous && sup.perRoll ? Math.ceil(n / sup.perRoll) : 1;
      out.push({
        partNumber: sup.partNumber, manufacturer: sup.brand, description: `${sup.material}, ${sup.color}, ${sup.continuous ? `${sizeOf(setup).h} mm continuous` : `${sup.widthMm} x ${sup.heightMm} mm`}`,
        supplier: `${sup.brand} (label supplies)`, bomQty: n, spareQty: 0, packQty: sup.perRoll ?? 1, orderQty: rolls, tags: [], source: 'labels', generatedPartNumber: sup.partNumber,
        note: sup.continuous ? `${n} labels on continuous tape: check the cartridge length covers them` : sup.perRoll ? `${n} labels, ${sup.perRoll} per roll` : 'Check the quantity per roll',
      });
    }
  }

  const bySupplier = new Map<string, OrderLine[]>();
  for (const l of out) bySupplier.set(l.supplier, [...(bySupplier.get(l.supplier) ?? []), l]);
  const order = (s: string) => (s === 'AutomationDirect' ? 0 : s === 'Supplier to confirm' ? 2 : 1);
  const groups = [...bySupplier].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0])).map(([supplier, ls]) => ({
    supplier,
    lines: ls,
    subtotal: +ls.reduce((s, l) => s + (l.extended ?? 0), 0).toFixed(2),
    unpriced: ls.filter((l) => l.extended === undefined).length,
  }));
  const dates = out.filter((l) => l.userPrice === undefined).map((l) => l.price?.date).filter((d): d is string => Boolean(d)).sort();
  return {
    groups, toSelect,
    total: +groups.reduce((s, g) => s + g.subtotal, 0).toFixed(2),
    unpriced: groups.reduce((s, g) => s + g.unpriced, 0),
    parts: {
      total: +out.filter((l) => l.source !== 'labels').reduce((s, l) => s + (l.extended ?? 0), 0).toFixed(2),
      unpriced: out.filter((l) => l.source !== 'labels' && l.extended === undefined).length,
    },
    priceDate: dates[0] ?? null,
    currency: 'USD',
  };
}

/** Unit price used for the line: the user's, else the verified list price. */
export const unitPrice = (l: OrderLine): number | undefined => l.userPrice ?? l.price?.price;

/** Where the line's price comes from. */
export const priceSource = (l: OrderLine): string =>
  l.userPrice !== undefined ? 'entered by you' : l.price ? `${l.price.sourceUrl} (${l.price.date})` : '';

/** Lines with a price the user typed. */
export const userPriced = (ol: OrderList): number => ol.groups.reduce((n, g) => n + g.lines.filter((l) => l.userPrice !== undefined).length, 0);

export const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Order file for one supplier: one "PartNumber,Quantity" line per part, no
 * header — the format of AutomationDirect's cart "CSV Upload"
 * (https://www.automationdirect.com/help/csvupload). Quantities in selling units.
 */
export function supplierCsv(g: SupplierGroup): string {
  return g.lines.map((l) => `${l.partNumber},${l.orderQty}`).join('\r\n') + '\r\n';
}

/** The same lines for the cart's "Enter Items" paste box (part number and quantity separated by a comma). */
export function supplierText(g: SupplierGroup): string {
  return g.lines.map((l) => `${l.partNumber},${l.orderQty}`).join('\n');
}

/** AutomationDirect's paste box takes at most 4000 characters; longer lists go through the file upload. */
export const PASTE_LIMIT = 4000;

/** Full order list as CSV (all suppliers). */
export function orderListCsv(ol: OrderList): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Supplier', 'Part number', 'Manufacturer', 'Description', 'Needed (pcs)', 'Spares (pcs)', 'Pack', 'Order qty', 'Unit price', 'Extended', 'Price source', 'Note'].map(esc).join(',')];
  for (const g of ol.groups) for (const l of g.lines) {
    rows.push([g.supplier, l.partNumber, l.manufacturer, l.description, l.bomQty, l.spareQty, l.packQty > 1 ? `pack of ${l.packQty}` : 'each', l.orderQty,
      unitPrice(l)?.toFixed(2) ?? 'price to confirm', l.extended !== undefined ? l.extended.toFixed(2) : '', priceSource(l), l.note ?? ''].map(esc).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}
