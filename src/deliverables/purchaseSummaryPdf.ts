import type { ProjectSnapshot } from './collect';
import { buildOrderList, money, type OrderList, type OrderOptions } from './purchasing';
import { simpleDoc } from './programListingPdf';
import { docMeta } from './docs/meta';
import { makeTable, type DocRow } from './docs/table';
import { MUTED, RED, pdfSafe } from './docs/pdfWriter';

/** Price basis line shown wherever prices appear. */
export function priceBasis(ol: OrderList): string {
  return ol.priceDate
    ? `List prices as of ${ol.priceDate}, USD, excl. tax and shipping. Lines marked "price to confirm" have no verified price and are not in the totals.`
    : 'No verified list prices yet: every line is "price to confirm". Quantities are exact; ask the supplier for a quote.';
}

/** One-page purchase summary: project, revision, what to order from whom, totals and notes. */
export async function buildPurchaseSummaryPdf(p: ProjectSnapshot, o: OrderOptions = { spares: true, labels: true }): Promise<Blob> {
  const ol = buildOrderList(p, o);
  const m = docMeta(p);
  const lineCount = ol.groups.reduce((s, g) => s + g.lines.length, 0) + ol.groups.length;
  // One page: single-line rows, smaller type for long lists.
  const fs = lineCount > 34 ? 5.3 : lineCount > 26 ? 6.2 : 6.8;
  return simpleDoc(p, 'Purchase summary', `${lineCount - ol.groups.length} order lines · ${ol.groups.length} supplier${ol.groups.length === 1 ? '' : 's'}${o.spares ? ' · recommended spares included' : ''}`, (w) => {
    w.text([
      m.customer && `Customer: ${m.customer}`, m.projectNumber && `Job no.: ${m.projectNumber}`,
      `Revision ${m.rev.rev} — ${m.rev.description} (${m.rev.date})`,
    ].filter(Boolean).join('   ·   '), { size: 8.2, gap: 2.5 });
    const cols: [string, number, ('left' | 'center' | 'right')?][] = [['Part number', 18], ['Description', 58], ['Need', 7, 'center'], ['Spares', 7, 'center'], ['Order', 7, 'center'], ['Unit', 11, 'center'], ['Unit price', 11, 'right'], ['Extended', 12, 'right']];
    const descW = (58 / cols.reduce((s, c) => s + c[1], 0)) * w.maxW - 3;
    w.doc.setFont('helvetica', 'normal');
    w.doc.setFontSize(fs);
    const fit = (t: string) => {
      let x = pdfSafe(t);
      if (w.doc.getTextWidth(x) <= descW) return x;
      while (x.length > 4 && w.doc.getTextWidth(`${x}...`) > descW) x = x.slice(0, -1);
      return `${x.trimEnd()}...`;
    };
    const rows: DocRow[] = [];
    for (const g of ol.groups) {
      rows.push({ group: `${g.supplier} — ${g.lines.length} lines${g.subtotal ? ` — subtotal ${money(g.subtotal)}` : ''}${g.unpriced ? ` (${g.unpriced} price to confirm)` : ''}` });
      for (const l of g.lines) {
        rows.push([
          l.partNumber, fit(l.description), l.bomQty ? String(l.bomQty) : '', l.spareQty ? String(l.spareQty) : '', String(l.orderQty),
          l.packQty > 1 ? `${l.source === 'labels' ? 'roll' : 'pack'} of ${l.packQty}` : 'each',
          l.price ? money(l.price.price) : 'to confirm', l.extended !== undefined ? money(l.extended) : '—',
        ]);
      }
    }
    w.table(makeTable(cols, rows), { fontSize: fs });
    w.text(`Total of verified prices: ${money(ol.total)}${ol.unpriced ? ` + ${ol.unpriced} line${ol.unpriced === 1 ? '' : 's'} with price to confirm` : ''}`, { size: 10, bold: true, gap: 1 });
    if (ol.toSelect.length) w.text(`Still to select before ordering: ${ol.toSelect.join('; ')}.`, { size: 7, color: RED, gap: 0.6 });
    w.text(`${priceBasis(ol)} "Need" and "Spares" are pieces; "Order" is in selling units (packs / rolls where sold that way). Check stock and lead times with the supplier before release.`, { size: 6.6, color: MUTED });
  });
}
