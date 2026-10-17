import type { ProjectSnapshot } from './collect';
import { buildOrderList, money, PANEL_ORDER, SPARES_ORDER, unitPrice, userPriced, type OrderList } from './purchasing';
import { simpleDoc } from './programListingPdf';
import { docMeta } from './docs/meta';
import { makeTable, type DocRow } from './docs/table';
import { MUTED, RED, pdfSafe } from './docs/pdfWriter';

/** Price basis line shown wherever prices appear. */
export function priceBasis(ol: OrderList): string {
  const mine = userPriced(ol);
  const yours = mine ? ` ${mine} price${mine === 1 ? '' : 's'} entered by you ${mine === 1 ? 'is' : 'are'} included in the totals.` : '';
  return ol.priceDate
    ? `List prices as of ${ol.priceDate}, USD, excl. tax and shipping.${yours} Lines marked "price to confirm" have no price yet and are not in the totals.`
    : mine ? `Prices entered by you, USD.${yours} Lines marked "price to confirm" have no price yet and are not in the totals.`
      : 'No verified list prices yet: every line is "price to confirm". Quantities are exact; ask the supplier for a quote.';
}

/** One-page purchase summary: panel parts by supplier, then the recommended spares as a separate order. */
export async function buildPurchaseSummaryPdf(p: ProjectSnapshot, o: { labels: boolean; spares: boolean } = { labels: true, spares: true }): Promise<Blob> {
  const ol = buildOrderList(p, { ...PANEL_ORDER, labels: o.labels });
  const sp = o.spares ? buildOrderList(p, SPARES_ORDER) : null;
  const m = docMeta(p);
  const lines = (x: OrderList | null) => (x ? x.groups.reduce((s, g) => s + g.lines.length + 1, 0) : 0);
  const rowCount = lines(ol);
  // One page: single-line rows; smaller type and tighter rows for long lists.
  const fs = rowCount > 34 ? 5.6 : rowCount > 26 ? 6.2 : 6.8;
  const pad = rowCount > 34 ? 0.8 : rowCount > 26 ? 1.0 : 1.2;
  return simpleDoc(p, 'Purchase summary', `${lines(ol) - ol.groups.length} panel order lines${sp?.groups.length ? ` + ${lines(sp) - sp.groups.length} recommended spares (separate order)` : ''}`, (w) => {
    w.text([
      m.customer && `Customer: ${m.customer}`, m.projectNumber && `Job no.: ${m.projectNumber}`,
      `Revision ${m.rev.rev} — ${m.rev.description} (${m.rev.date})`,
    ].filter(Boolean).join('   ·   '), { size: 8.2, gap: 2 });
    const cols: [string, number, ('left' | 'center' | 'right')?][] = [['Part number', 18], ['Description', 64], ['Order', 7, 'center'], ['Unit', 11, 'center'], ['Unit price', 11, 'right'], ['Extended', 12, 'right']];
    const descW = (64 / cols.reduce((s, c) => s + c[1], 0)) * w.maxW - 3;
    w.doc.setFont('helvetica', 'normal');
    w.doc.setFontSize(fs);
    const fit = (t: string) => {
      let x = pdfSafe(t);
      if (w.doc.getTextWidth(x) <= descW) return x;
      while (x.length > 4 && w.doc.getTextWidth(`${x}...`) > descW) x = x.slice(0, -1);
      return `${x.trimEnd()}...`;
    };
    const rows: DocRow[] = [];
    const addGroups = (x: OrderList, suffix: string) => {
      for (const g of x.groups) {
        rows.push({ group: `${g.supplier}${suffix} — ${g.lines.length} lines${g.subtotal ? ` — subtotal ${money(g.subtotal)}` : ''}${g.unpriced ? ` (${g.unpriced} price to confirm)` : ''}` });
        for (const l of g.lines) {
          rows.push([
            l.partNumber, fit(l.description), String(l.orderQty),
            l.packQty > 1 ? `${l.source === 'labels' ? 'roll' : 'pack'} of ${l.packQty}` : 'each',
            unitPrice(l) !== undefined ? `${money(unitPrice(l)!)}${l.userPrice !== undefined ? '*' : ''}` : 'to confirm', l.extended !== undefined ? money(l.extended) : '—',
          ]);
        }
      }
    };
    addGroups(ol, '');
    w.table(makeTable(cols, rows), { fontSize: fs, pad });
    const unpriced = (x: OrderList | null) => (x?.unpriced ? ` + ${x.unpriced} price to confirm` : '');
    w.text(`Panel parts: ${money(ol.total)}${unpriced(ol)}${sp?.groups.length ? `      Recommended spares (separate order): ${money(sp.total)}${unpriced(sp)}` : ''}`, { size: 9.5, bold: true, gap: 0.8 });
    const notes = [
      ol.toSelect.length ? `STILL TO SELECT before ordering: ${ol.toSelect.join('; ')}.` : '',
      priceBasis(ol),
      userPriced(ol) ? '* = price entered by you.' : '',
      'Order quantities are in selling units (packs / rolls where sold that way). The order file holds the panel parts only; the spares have their own order file. Check stock and lead times before release.',
    ].filter(Boolean).join(' ');
    w.text(notes, { size: 6.4, color: ol.toSelect.length ? RED : MUTED, gap: 1.5 });
    if (sp?.groups.length) {
      // Spares in compact form: the detail is in the spares order file / Excel sheet.
      const items = sp.groups.flatMap((g) => g.lines.map((l) => `${l.partNumber} x${l.orderQty}${l.packQty > 1 ? ` (pack of ${l.packQty})` : ''}`));
      w.text(`Recommended spares — separate, optional order (spares order file), ${money(sp.total)}${unpriced(sp)}:`, { size: 7.4, bold: true, gap: 0.4 });
      w.text(items.join(' · '), { size: 6.4, gap: 0.5 });
    }
  });
}
