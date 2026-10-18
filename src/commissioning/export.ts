import type { ProjectSnapshot } from '../deliverables/collect';
import { simpleDoc } from '../deliverables/programListingPdf';
import { makeTable, type DocRow } from '../deliverables/docs/table';
import { MUTED } from '../deliverables/docs/pdfWriter';
import { exportRows, progress, voidedText, type CommItem, type CommRecord } from './checklist';

const summary = (items: CommItem[], rec: CommRecord) => {
  const s = progress(items, rec.results);
  return `${s.done} of ${s.total} items done · ${s.pass} pass · ${s.fail} fail${rec.signoff ? ` · signed ${rec.signoff.date} by ${rec.signoff.name}` : ' · not signed'}`;
};

/** Commissioning checklist PDF: the items with their recorded results, then the sign-off (with the drawn signature). */
export async function commissioningPdf(p: ProjectSnapshot, items: CommItem[], rec: CommRecord): Promise<Blob> {
  return simpleDoc(p, 'Commissioning checklist', `${summary(items, rec)} · ${p.profile.name} ${p.cpu.id}`, (w) => {
    w.text('On site, for each item: do the procedure, check the expected result, then mark Pass, Fail or N/A with your initials and the date. Failed items go on the punch list with a note.', { size: 8, color: MUTED });
    const body: DocRow[] = [];
    let last = '';
    for (const r of exportRows(items, rec.results)) {
      if (r.section !== last) { body.push({ group: r.section }); last = r.section; }
      const [title, device, procedure, expected, result, note, by, date] = r.cells;
      body.push([title, device, procedure, expected, result || '[ ]', [note, by && `${by} ${date}`].filter(Boolean).join(' — ')]);
    }
    w.table(makeTable([['Item', 22], ['Device', 14], ['Procedure', 34], ['Expected result', 44], ['Result', 9, 'center'], ['Note / by, date', 26]], body, 7), { fontSize: 7 });
    w.h2('Sign-off', false);
    const s = rec.signoff;
    w.keyValue([['Name', s?.name ?? ''], ['Company', s?.company ?? ''], ['Signature', s?.signature ?? ''], ['Date', s?.date ?? '']]);
    if (s?.drawn) w.image(s.drawn, 'PNG', 600, 200, 25, 'Signature');
    if (rec.voided?.length) {
      w.h2('Voided sign-offs', false);
      w.text('Each was signed, then a failure was recorded after it, so it no longer covers the results.', { size: 8, color: MUTED });
      for (const v of rec.voided) w.text(voidedText(v, items), { size: 8 });
    }
  });
}

/** Commissioning checklist workbook: one row per item (Excel can filter by section / result). */
export async function commissioningXlsx(projectName: string, items: CommItem[], rec: CommRecord): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISA Auto Programmer';
  const ws = wb.addWorksheet('Commissioning', { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.addRow([`${projectName} — commissioning checklist`]).font = { bold: true, size: 13 };
  ws.addRow([summary(items, rec)]);
  const head = ws.addRow(['Section', 'Item', 'Device', 'Procedure', 'Expected result', 'Result', 'Note', 'By', 'Date']);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FE' } };
  for (const r of exportRows(items, rec.results)) {
    const row = ws.addRow([r.section, ...r.cells]);
    row.alignment = { wrapText: true, vertical: 'top' };
    if (r.cells[4] === 'FAIL') row.getCell(6).font = { bold: true, color: { argb: 'FFB00000' } };
  }
  ws.columns.forEach((c, i) => { c.width = [16, 32, 22, 45, 60, 9, 30, 14, 17][i]; });
  ws.addRow([]);
  const s = rec.signoff;
  ws.addRow(['Sign-off']).font = { bold: true };
  ws.addRow(['Name', s?.name ?? '']);
  ws.addRow(['Company', s?.company ?? '']);
  ws.addRow(['Signature', s?.signature ?? '']);
  ws.addRow(['Date', s?.date ?? '']);
  if (rec.voided?.length) {
    ws.addRow([]);
    ws.addRow(['Voided sign-offs']).font = { bold: true };
    for (const v of rec.voided) ws.addRow(['Voided', voidedText(v, items)]);
  }
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
