import type { ProjectSnapshot } from './collect';
import { simpleDoc } from './programListingPdf';
import { makeTable } from './docs/table';
import { MUTED } from './docs/pdfWriter';
import { money } from './purchasing';
import { CRITICALITY_LABEL, FAILURE_LABEL, leadText, spareParts, SPARES_BASIS, type SpareList } from '../electrical/improve/spares';

/** Spare parts list (criticality, failure rate, quantity, price) as files for the maintenance team. */

const totalText = (s: SpareList) => `${money(s.total)}${s.unpriced ? ` + ${s.unpriced} line${s.unpriced > 1 ? 's' : ''} price to confirm` : ''}`;

export async function sparePartsXlsx(s: SpareList, projectName: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISA Auto Programmer';
  const ws = wb.addWorksheet('Spare parts', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.addRow([`${projectName} — recommended spare parts`]).font = { bold: true, size: 13 };
  const head = ws.addRow(['Part number', 'Manufacturer', 'Description', 'Tags', 'Qty installed', 'Criticality', 'Failure rate', 'Recommended spares', 'Unit price (USD)', 'Extended (USD)', 'Availability', 'Why']);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FE' } };
  for (const l of s.lines) {
    ws.addRow([l.partNumber, l.manufacturer, l.description, l.tags.join(', '), l.installed, CRITICALITY_LABEL[l.criticality], FAILURE_LABEL[l.failure], l.qty,
      l.unitPrice ?? 'price to confirm', l.extended ?? null, leadText(l.lead), l.why]);
  }
  ws.addRow(['', '', 'Total of verified prices', '', null, '', '', null, null, s.total]).font = { bold: true };
  ws.addRow([]);
  ws.addRow([SPARES_BASIS]);
  ws.columns.forEach((c, i) => { c.width = [20, 16, 56, 18, 12, 20, 22, 12, 15, 15, 14, 46][i]; });
  ws.getColumn(9).numFmt = '#,##0.00';
  ws.getColumn(10).numFmt = '#,##0.00';
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function sparePartsPdf(p: ProjectSnapshot): Promise<Blob | null> {
  if (!p.drawingCtx) return null;
  const s = spareParts(p.drawingCtx);
  return simpleDoc(p, 'Recommended spare parts', `${s.lines.length} lines — ${totalText(s)}`, (w) => {
    const rows = s.lines.map((l) => [l.partNumber, l.description, l.tags.join(', '), String(l.installed), l.criticality, l.failure, String(l.qty), l.extended !== undefined ? money(l.extended) : 'to confirm']);
    w.table(makeTable([['Part number', 18], ['Description', 46], ['Tags', 14], ['Installed', 8, 'center'], ['Class', 6, 'center'], ['Fails', 9, 'center'], ['Spares', 7, 'center'], ['Extended', 12, 'right']], rows), { fontSize: 6.8 });
    w.text(`Spares total: ${totalText(s)}`, { size: 9.5, bold: true, gap: 1 });
    w.text(SPARES_BASIS, { size: 6.6, color: MUTED, gap: 1 });
  });
}
