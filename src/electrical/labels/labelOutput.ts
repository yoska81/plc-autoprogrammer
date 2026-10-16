import type { jsPDF } from 'jspdf';
import { LABEL_KINDS, labelText, type Label } from '../labels';
import { pdfSafe } from '../../deliverables/docs/pdfWriter';
import { expandCopies, layoutLabel, PT, type LabelLayout, type Measure } from './layout';
import { fmtSize, rollOf, sizeOf, type LabelSetup } from './setup';

/**
 * Label outputs: a PDF for label printers (one page per label, page size =
 * label size, so any printer driver prints it 1:1), a sheet PDF on Letter /
 * A4 for sheet stock or proofing, and CSV / Excel for label-printer software.
 */

/** Text the built-in PDF fonts can draw; used for the preview too so both match. */
export const printable = (l: Label): Label => ({ ...l, code: pdfSafe(l.code), description: pdfSafe(l.description) });

function pdfMeasure(doc: jsPDF): Measure {
  const cache = new Map<string, number>();
  return (text, sizePt, bold) => {
    const k = `${bold ? 'b' : 'n'}${text}`;
    let per = cache.get(k);
    if (per === undefined) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      per = doc.getStringUnitWidth(text);
      cache.set(k, per);
    }
    return per * sizePt * PT;
  };
}

/** Draw one label with its top-left corner at (ox, oy). */
function drawLabel(doc: jsPDF, lay: LabelLayout, ox: number, oy: number, border: boolean, measure: Measure) {
  if (border) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    // Round joins: the closing segment of jsPDF's rounded rect is almost zero length and
    // a miter join turns it into a small spike at the top-left corner.
    doc.setLineJoin('round');
    doc.setLineCap('round');
    const b = lay.printable ?? { x: 0, y: 0, w: lay.w, h: lay.h };
    const r = Math.min(1.2, Math.min(b.w, b.h) * 0.08);
    doc.roundedRect(ox + b.x + 0.35, oy + b.y + 0.35, b.w - 0.7, b.h - 0.7, r, r, 'S');
  }
  doc.setTextColor(0, 0, 0);
  for (const run of lay.runs) {
    doc.setFont('helvetica', run.bold ? 'bold' : 'normal');
    doc.setFontSize(run.size);
    const left = run.align === 'center' ? run.x - measure(run.text, run.size, run.bold) / 2 : run.x;
    if (lay.rotate) doc.text(run.text, ox + run.y, oy + lay.h - left, { angle: 90, baseline: 'alphabetic' });
    else doc.text(run.text, ox + left, oy + run.y, { baseline: 'alphabetic' });
  }
}

/** Progress of a long build: `done` of `total` steps. */
export type Progress = (done: number, total: number) => void;

/** Work in chunks so the page stays responsive on big projects. */
const CHUNK = 250;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function layoutAll(items: Label[], setup: LabelSetup, measure: Measure, onProgress?: Progress): Promise<LabelLayout[]> {
  const out: LabelLayout[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push(layoutLabel(items[i], setup, measure));
    // Layout is the first half of the work, drawing the second.
    if (i % CHUNK === CHUNK - 1) { onProgress?.(i + 1, items.length * 2); await tick(); }
  }
  return out;
}

const orient = (w: number, h: number) => (w > h ? 'landscape' : 'portrait');

/**
 * Label-printer PDF. Default: one page per label, page = label size. With
 * "match the roll" (supplies with confirmed liner data): one page per liner
 * row, page width = liner width, N labels across at their real positions.
 */
export async function labelPrinterPdf(labels: Label[], setup: LabelSetup, title = 'Labels', onProgress?: Progress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const items = expandCopies(labels.map(printable), setup.useCopies);
  if (!items.length) throw new Error('No labels selected.');
  const measure = pdfMeasure(new jsPDF({ unit: 'mm' }));
  const lays = await layoutAll(items, setup, measure, onProgress);
  const roll = setup.pageLayout === 'roll' ? rollOf(setup) : null;
  const pages: { w: number; h: number; at: { lay: LabelLayout; x: number }[] }[] = [];
  if (roll) {
    for (let i = 0; i < lays.length; i += roll.across) {
      const row = lays.slice(i, i + roll.across);
      pages.push({ w: roll.widthMm, h: row[0].h, at: row.map((lay, k) => ({ lay, x: roll.marginMm + k * (lay.w + roll.gapMm) })) });
    }
  } else for (const lay of lays) pages.push({ w: lay.w, h: lay.h, at: [{ lay, x: 0 }] });
  const doc = new jsPDF({ unit: 'mm', format: [pages[0].w, pages[0].h], orientation: orient(pages[0].w, pages[0].h) });
  doc.setProperties({ title, subject: `Label printer file, ${roll ? `${roll.across} across, liner ${roll.widthMm} mm` : fmtSize(pages[0].w, pages[0].h, setup.units)}`, creator: 'ISA Auto Programmer' });
  const m = pdfMeasure(doc);
  for (const [i, pg] of pages.entries()) {
    if (i > 0) doc.addPage([pg.w, pg.h], orient(pg.w, pg.h));
    for (const a of pg.at) drawLabel(doc, a.lay, a.x, 0, setup.border, m);
    if (i % CHUNK === CHUNK - 1) { onProgress?.(items.length * (1 + (i + 1) / pages.length), items.length * 2); await tick(); }
  }
  onProgress?.(1, 1);
  return doc.output('blob');
}

export const PAPER = { letter: { w: 215.9, h: 279.4, name: 'Letter' }, a4: { w: 210, h: 297, name: 'A4' } } as const;

/** Labels placed on Letter / A4 sheets with cut lines, for sheet stock or proofing. */
export async function labelSheetPdf(labels: Label[], setup: LabelSetup, projectName: string, onProgress?: Progress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const paper = PAPER[setup.paper];
  const doc = new jsPDF({ unit: 'mm', format: setup.paper, orientation: 'portrait' });
  doc.setProperties({ title: `${projectName} labels`, creator: 'ISA Auto Programmer' });
  const measure = pdfMeasure(doc);
  const items = await layoutAll(expandCopies(labels.map(printable), setup.useCopies), setup, measure, onProgress);
  if (!items.length) throw new Error('No labels selected.');
  const M = 10, top = 17, gap = 2;
  const pages: { lay: LabelLayout; x: number; y: number }[][] = [[]];
  let x = M, y = top, rowH = 0;
  for (const lay of items) {
    if (x + lay.w > paper.w - M + 0.01 && x > M) { x = M; y += rowH + gap; rowH = 0; }
    if (y + lay.h > paper.h - M + 0.01 && y > top) { pages.push([]); x = M; y = top; rowH = 0; }
    pages[pages.length - 1].push({ lay, x, y });
    x += lay.w + gap;
    rowH = Math.max(rowH, lay.h);
  }
  const size = sizeOf(setup);
  const sizeText = size.tape && !setup.tapeLength ? `${size.h} mm tape` : fmtSize(size.w, size.h, setup.units);
  for (const [i, pg] of pages.entries()) {
    if (i > 0) doc.addPage(setup.paper, 'portrait');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 35, 39);
    doc.text(pdfSafe(`${projectName} — labels`), M, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 112, 124);
    doc.text(pdfSafe(`${sizeText} · ${setup.content === 'code' ? 'number only' : 'number + description'} · ${items.length} labels · page ${i + 1} of ${pages.length}`), paper.w - M, 10, { align: 'right' });
    doc.text('Cut on the grey lines. Print at 100 % (actual size, no "fit to page").', M, 13.5);
    for (const it of pg) {
      doc.setDrawColor(190, 196, 204);
      doc.setLineWidth(0.1);
      doc.rect(it.x, it.y, it.lay.w, it.lay.h, 'S');
      drawLabel(doc, it.lay, it.x, it.y, setup.border, measure);
    }
    if (i % 5 === 4) { onProgress?.(items.length * (1 + (i + 1) / pages.length), items.length * 2); await tick(); }
  }
  onProgress?.(1, 1);
  return doc.output('blob');
}

const kindTitle = (l: Label) => LABEL_KINDS.find((k) => k.kind === l.kind)?.title ?? l.kind;

/** Excel for label software import: one row per label (with a copies column) or one row per copy. */
export async function labelsXlsx(labels: Label[], setup: LabelSetup, projectName: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISA Auto Programmer';
  const ws = wb.addWorksheet('Labels', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Number', key: 'code', width: 14 },
    { header: 'Description', key: 'desc', width: 46 },
    { header: 'Text', key: 'text', width: 56 },
    { header: 'Copies', key: 'copies', width: 8 },
    { header: 'Type', key: 'kind', width: 20 },
    { header: 'Group', key: 'group', width: 16 },
  ];
  for (const l of labels) {
    const t = labelText(l, setup.content);
    const row = { code: t.main, desc: t.side || l.description, text: t.side ? `${t.main} ${t.side}` : t.main, kind: kindTitle(l), group: l.group };
    const n = Math.max(0, Math.round(Number(l.copies) || 0));
    if (setup.rowPerCopy) for (let i = 0; i < n; i++) ws.addRow({ ...row, copies: 1 });
    else ws.addRow({ ...row, copies: n });
  }
  // Copies is a number (label software maps it to a print quantity).
  ws.getColumn('copies').numFmt = '0';
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5FFC4' } };
  ws.autoFilter = { from: 'A1', to: 'F1' };
  const info = wb.addWorksheet('How to import');
  const size = sizeOf(setup);
  const two = setup.content !== 'code';
  info.columns = [{ width: 30 }, { width: 100 }];
  const rows: string[][] = [
    ['Project', projectName],
    ['Label printer / supply', setup.supply ? size.use : 'Generic size (no printer supply chosen)'],
    ['Label stock', size.tape && !setup.tapeLength ? `${size.h} mm continuous tape` : fmtSize(size.w, size.h, setup.units)],
    ['Content', two ? 'Number + description (columns "Number" and "Description", or "Text" for both in one field)' : 'Number only (column "Number")'],
    ['Rows', setup.rowPerCopy ? 'One row per printed label (every copy has its own row)' : 'One row per label, with a "Copies" column'],
    [],
    ['BRADY WORKSTATION', 'Step by step (Custom Designer)'],
    ['Before you start', setup.rowPerCopy
      ? 'This file has one row per printed label, which is what Brady Workstation expects: every row becomes one label.'
      : 'Brady Workstation prints one label per row and does not read the "Copies" column. In ISA Auto Programmer tick "one row per printed label" and export the Excel file again, so every copy has its own row.'],
    ['Step 1', `Open Brady Workstation and start Custom Designer. Create a new label file for your printer and choose the label ${setup.supply ? `part number ${setup.supply}` : 'that is loaded in the printer'}.`],
    ['Step 2', 'Click the "Excel Import" icon, then "Select Excel File", and choose this file.'],
    ['Step 3', 'Tick "Use first row as header" (the first row holds the column names Number, Description, Text...). If you are asked for a sheet, choose "Labels".'],
    ['Step 4', two
      ? 'Drag the "Number" field onto the label and make it large and bold; drag "Description" beside it in a smaller font. (Or drag the single "Text" field.)'
      : 'Drag the "Number" field onto the label and size it to fill the label.'],
    ['Step 5', 'Check a few labels in the preview, then print. Every row of the "Labels" sheet becomes one label.'],
    ['When the design changes', 'Export the Excel file again from ISA Auto Programmer with the same file name and click "Check for updates" in Custom Designer: the labels refresh without opening the label file again.'],
    ['Tips', 'Text that should be the same on every label (e.g. a logo) can be set to "Show On Every Label". Import into a barcode, or from a CSV file, needs Brady Workstation "Advanced Import".'],
    ['Brady help pages', 'https://support.bradyid.com/articles/en_US/Knowledge/How-to-Import-Excel-Data-into-a-Label-File-in-Custom-Designer  ·  https://support.bradyid.com/articles/en_US/Knowledge/How-to-format-Excel-files-for-importing-into-Brady-software'],
    [],
    ['OTHER LABEL SOFTWARE', ''],
    ['Brother P-touch Editor', 'Connect this workbook as a database and place the "Number" / "Description" fields on the label layout.'],
    ['Weidmüller M-Print PRO', 'Import the workbook (or the CSV) and map "Number" to the marker text.'],
    ['Phoenix Contact PROJECT complete', 'Import the workbook (or the CSV) and map "Number" to the marking text.'],
  ];
  rows.forEach((r) => info.addRow(r));
  info.getColumn(1).font = { bold: true };
  info.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  info.eachRow((row) => {
    if (/^(BRADY WORKSTATION|OTHER LABEL SOFTWARE)$/.test(String(row.getCell(1).value ?? ''))) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5FFC4' } };
    }
  });
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
