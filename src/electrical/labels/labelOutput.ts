import type { jsPDF } from 'jspdf';
import { LABEL_KINDS, labelText, type Label } from '../labels';
import { pdfSafe } from '../../deliverables/docs/pdfWriter';
import { expandCopies, layoutLabel, PT, type LabelLayout, type Measure } from './layout';
import { fmtSize, sizeOf, type LabelSetup } from './setup';

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
    const r = Math.min(1.2, Math.min(lay.w, lay.h) * 0.08);
    doc.roundedRect(ox + 0.35, oy + 0.35, lay.w - 0.7, lay.h - 0.7, r, r, 'S');
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

const orient = (w: number, h: number) => (w > h ? 'landscape' : 'portrait');

/** One PDF page per printed label, each page exactly the label size. */
export async function labelPrinterPdf(labels: Label[], setup: LabelSetup, title = 'Labels'): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const items = expandCopies(labels.map(printable), setup.useCopies);
  if (!items.length) throw new Error('No labels selected.');
  let doc: jsPDF | null = null;
  let measure: Measure | null = null;
  for (const l of items) {
    if (!doc) {
      // Measure with a scratch document first so the first page gets the right size.
      const scratch = new jsPDF({ unit: 'mm' });
      const lay0 = layoutLabel(l, setup, pdfMeasure(scratch));
      doc = new jsPDF({ unit: 'mm', format: [lay0.w, lay0.h], orientation: orient(lay0.w, lay0.h) });
      doc.setProperties({ title, subject: `Label printer file, ${fmtSize(lay0.w, lay0.h, setup.units)}`, creator: 'ISA Auto Programmer' });
      measure = pdfMeasure(doc);
      drawLabel(doc, layoutLabel(l, setup, measure), 0, 0, setup.border, measure);
      continue;
    }
    const lay = layoutLabel(l, setup, measure!);
    doc.addPage([lay.w, lay.h], orient(lay.w, lay.h));
    drawLabel(doc, lay, 0, 0, setup.border, measure!);
  }
  return doc!.output('blob');
}

export const PAPER = { letter: { w: 215.9, h: 279.4, name: 'Letter' }, a4: { w: 210, h: 297, name: 'A4' } } as const;

/** Labels placed on Letter / A4 sheets with cut lines, for sheet stock or proofing. */
export async function labelSheetPdf(labels: Label[], setup: LabelSetup, projectName: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const paper = PAPER[setup.paper];
  const doc = new jsPDF({ unit: 'mm', format: setup.paper, orientation: 'portrait' });
  doc.setProperties({ title: `${projectName} labels`, creator: 'ISA Auto Programmer' });
  const measure = pdfMeasure(doc);
  const items = expandCopies(labels.map(printable), setup.useCopies).map((l) => layoutLabel(l, setup, measure));
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
  pages.forEach((pg, i) => {
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
  });
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
    if (setup.rowPerCopy) for (let i = 0; i < l.copies; i++) ws.addRow({ ...row, copies: 1 });
    else ws.addRow({ ...row, copies: l.copies });
  }
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5FFC4' } };
  ws.autoFilter = { from: 'A1', to: 'F1' };
  const info = wb.addWorksheet('How to import');
  const size = sizeOf(setup);
  info.columns = [{ width: 28 }, { width: 90 }];
  [
    ['Project', projectName],
    ['Label stock', size.tape && !setup.tapeLength ? `${size.h} mm continuous tape` : fmtSize(size.w, size.h, setup.units)],
    ['Content', setup.content === 'code' ? 'Number only (column "Number")' : 'Number + description (columns "Number" and "Description", or "Text")'],
    ['Rows', setup.rowPerCopy ? 'One row per printed label' : 'One row per label; print the "Copies" count of each'],
    ['Brady Workstation', 'Data → Import data → choose this file, sheet "Labels"; link the text object to "Number" (and "Description").'],
    ['Brother P-touch Editor', 'File → Database → Connect → this file; drag "Number" / "Description" onto the label layout; set copies from "Copies".'],
    ['Weidmüller M-Print PRO', 'Import → Excel; map "Number" to the marker text.'],
    ['Phoenix Contact PROJECT complete', 'Import → Excel / CSV; map "Number" to the marking text.'],
  ].forEach((r) => info.addRow(r));
  info.getColumn(1).font = { bold: true };
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
