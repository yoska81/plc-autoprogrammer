import type { OrderList } from './purchasing';
import { priceBasis } from './purchaseSummaryPdf';
import { hoursText, type BuildEstimate } from './buildTime';

/** Order list workbook: the panel order, the recommended spares and the shop build time on their own sheets when given. */
export async function orderListXlsx(ol: OrderList, projectName: string, spares: OrderList | null, build: BuildEstimate | null = null): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISA Auto Programmer';
  const ws = wb.addWorksheet('Order list', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.addRow([`${projectName} — order list`]).font = { bold: true, size: 13 };
  const head = ws.addRow(['Supplier', 'Part number', 'Manufacturer', 'Description', 'Needed (pcs)', 'Spares (pcs)', 'Unit', 'Order qty', 'Unit price (USD)', 'Extended (USD)', 'Price source', 'Note']);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FE' } };
  for (const g of ol.groups) {
    for (const l of g.lines) {
      ws.addRow([g.supplier, l.partNumber, l.manufacturer, l.description, l.bomQty, l.spareQty, l.packQty > 1 ? `pack of ${l.packQty}` : 'each', l.orderQty,
        l.price ? l.price.price : 'price to confirm', l.extended ?? null, l.price ? `${l.price.sourceUrl} (${l.price.date})` : '', l.note ?? '']);
    }
    const sub = ws.addRow(['', '', '', `Subtotal ${g.supplier}${g.unpriced ? ` (${g.unpriced} price to confirm)` : ''}`, null, null, '', null, null, g.subtotal]);
    sub.font = { bold: true };
  }
  const tot = ws.addRow(['', '', '', 'Total of verified prices', null, null, '', null, null, ol.total]);
  tot.font = { bold: true };
  ws.addRow([]);
  ws.addRow([priceBasis(ol)]);
  ws.columns.forEach((c, i) => { c.width = [18, 20, 16, 60, 11, 11, 13, 10, 15, 15, 50, 40][i]; });
  ws.getColumn(9).numFmt = '#,##0.00';
  ws.getColumn(10).numFmt = '#,##0.00';
  if (spares?.groups.length) {
    const sw = wb.addWorksheet('Recommended spares');
    sw.addRow([`${projectName} — recommended spares (separate, optional order)`]).font = { bold: true, size: 13 };
    sw.addRow(['Supplier', 'Part number', 'Manufacturer', 'Description', 'Spares (pcs)', 'Unit', 'Order qty', 'Unit price (USD)', 'Extended (USD)']).font = { bold: true };
    for (const g of spares.groups) for (const l of g.lines) sw.addRow([g.supplier, l.partNumber, l.manufacturer, l.description, l.spareQty, l.packQty > 1 ? `pack of ${l.packQty}` : 'each', l.orderQty, l.price ? l.price.price : 'price to confirm', l.extended ?? null]);
    sw.addRow(['', '', '', 'Total of verified prices', null, '', null, null, spares.total]).font = { bold: true };
    sw.columns.forEach((c, i) => { c.width = [18, 20, 16, 60, 11, 13, 10, 15, 15][i]; });
  }
  if (build) {
    const bw = wb.addWorksheet('Build time');
    bw.addRow([`${projectName} — shop build time (estimate)`]).font = { bold: true, size: 13 };
    bw.addRow(['Task', 'Item', 'Quantity', 'Rate', 'Unit', 'Hours', 'Counted from']).font = { bold: true };
    for (const t of build.byTask) {
      for (const l of build.lines.filter((x) => x.task === t.task)) bw.addRow([l.task, l.item, l.qty, l.rate, l.unit, Math.round(l.hours * 100) / 100, l.basis]);
      bw.addRow(['', `Subtotal ${t.task}`, null, null, '', Math.round(t.hours * 100) / 100]).font = { bold: true };
    }
    bw.addRow(['', 'Total build time', null, null, '', Math.round(build.totalHours * 100) / 100]).font = { bold: true };
    if (build.cost) bw.addRow(['', `Labour at $${build.hourlyRate}/h (USD)`, null, null, '', Math.round(build.cost * 100) / 100]).font = { bold: true };
    bw.addRow([]);
    bw.addRow([`Total ${hoursText(build.totalHours)}. Quantities from the design; rates are the shop's (Deliverables → Shop build time). Leaves out engineering, programming, purchasing and packing.`]);
    for (const n of build.notes) bw.addRow([n]);
    bw.columns.forEach((c, i) => { c.width = [26, 52, 10, 8, 16, 9, 44][i]; });
  }
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
