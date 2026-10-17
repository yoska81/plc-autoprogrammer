import type JSZip from 'jszip';
import type { PDFDict, PDFRef } from 'pdf-lib';
import type { ProjectSnapshot } from './collect';
import { buildEngineeringPdf } from './engineering';
import { buildDrawingsPdf, buildHmiImages, buildHmiPdf } from './files';
import { buildProgramListingPdf, simpleDoc } from './programListingPdf';
import { docMeta } from './docs/meta';
import { ioListTable } from './docs/fds';
import { bomTable } from './docs/manual';
import { makeTable } from './docs/table';
import { ACCENT, BRAND, INK, MUTED, pdfSafe } from './docs/pdfWriter';
import { LABEL_KINDS, labelsCsv } from '../electrical/labels';
import { listLabels } from '../electrical/labels/list';
import { labelPrinterPdf, labelSheetPdf, labelsXlsx } from '../electrical/labels/labelOutput';
import { labelSetupFor } from '../electrical/labels/setup';
import { useProjectsStore } from '../store/useProjectsStore';
import { buildPurchaseSummaryPdf } from './purchaseSummaryPdf';
import { buildOrderList, orderListCsv, PANEL_ORDER, SPARES_ORDER, supplierCsv } from './purchasing';

/**
 * The whole project as one printable PDF: cover, contents with page numbers,
 * then every document of the package in order. Each part keeps its own page
 * numbering; a package page number is stamped at the foot of every page and
 * each part has a PDF bookmark.
 */

export interface PackagePart {
  title: string;
  description: string;
  pdf: Blob;
  /** Child bookmarks: page offsets inside the part. */
  children?: { title: string; page: number }[];
}

/** Parts already built elsewhere (the ZIP builds them anyway), to avoid building twice. */
export interface Prebuilt {
  engineering?: Blob;
  drawings?: Blob | null;
  hmiPdf?: Blob | null;
}

export type Progress = (step: string, done: number, total: number) => void;

/** I/O list, BOM and label list as small documents. */
const ioListPdf = (p: ProjectSnapshot) =>
  simpleDoc(p, 'I/O list', `${p.io.length} points · ${p.profile.name} ${p.cpu.id}`, (w) => w.table(ioListTable(p), { fontSize: 7.4 }));

const bomPdf = (p: ProjectSnapshot) =>
  simpleDoc(p, 'Bill of materials', 'Control panel parts, grouped by category', (w) => w.table(bomTable(p), { fontSize: 7.2 }));

const labelListPdf = (p: ProjectSnapshot) => {
  const labels = listLabels(p.drawingCtx!);
  const total = labels.reduce((s, l) => s + l.copies, 0);
  return simpleDoc(p, 'Label list', `${labels.length} different labels, ${total} to print`, (w) => {
    w.para('Every marker and tag the panel and the machine need. Print them from Electrical design → Labels (label printer PDF, sheet PDF, CSV or Excel for the printer software).');
    for (const k of LABEL_KINDS) {
      const ls = labels.filter((l) => l.kind === k.kind);
      if (!ls.length) continue;
      w.h2(`${k.title} (${ls.length})`, false);
      w.table(makeTable([['Number', 16], ['Description', 64], ['Group', 18], ['Copies', 8, 'center']], ls.map((l) => [l.code, l.description, l.group, String(l.copies)])), { fontSize: 7.4 });
    }
  });
};

/** Build every part of the package. */
export async function buildPackageParts(p: ProjectSnapshot, onProgress?: Progress, pre: Prebuilt = {}): Promise<PackagePart[]> {
  const steps: { title: string; description: string; run: () => Promise<Blob | null>; children?: () => { title: string; page: number }[] }[] = [
    { title: 'Engineering package', description: 'Design basis, functional specification, calculations, safety, PLC and HMI description, FAT / SAT, operator manual, maintenance', run: async () => pre.engineering ?? buildEngineeringPdf(p, p.equipment) },
  ];
  if (p.drawingCtx) {
    // The machining sheets are printed once, inside the drawing set; the machine shop's own PDF (same sheets)
    // ships in the ZIP next to the 1:1 DXFs.
    const sheets = docMeta(p).drawings?.sheets ?? [];
    const drill = sheets.filter((s) => /DRILLING|CUTOUTS/i.test(s.title)).map((s) => s.no);
    steps.push({
      title: 'Electrical drawings',
      description: `Schematics, panel layout, terminal plans, wire and cable lists (ANSI B)${drill.length ? `; machining sheets ${drill[0]}${drill.length > 1 ? ` to ${drill[drill.length - 1]}` : ''} (back panel drilling, door and wall cutouts, cut from the 1:1 DXFs in the ZIP)` : ''}`,
      run: async () => (pre.drawings !== undefined ? pre.drawings : buildDrawingsPdf(p)),
      children: () => sheets.map((s, i) => ({ title: `${s.no} ${s.title}`, page: i })),
    });
  }
  if (p.hmi) {
    steps.push({
      title: 'HMI screens', description: `${p.hmi.screens.length} operator screens, ${p.hmi.hmiPartNumber}`,
      run: async () => (pre.hmiPdf !== undefined ? pre.hmiPdf : buildHmiPdf(p, await buildHmiImages(p))),
      children: () => p.hmi!.screens.map((s, i) => ({ title: s.name, page: i })),
    });
  }
  steps.push({ title: 'PLC program listing', description: 'Program blocks, every rung with comments and logic in words, tag table', run: () => buildProgramListingPdf(p) });
  steps.push({ title: 'I/O list', description: `${p.io.length} I/O points with addresses, devices and terminals`, run: () => (p.io.length ? ioListPdf(p) : Promise.resolve(null)) });
  if (p.drawingCtx) {
    steps.push({ title: 'Bill of materials', description: 'Parts list with part numbers and tags', run: () => bomPdf(p) });
    steps.push({ title: 'Purchase summary', description: 'What to order from each supplier, order quantities, verified list prices and totals', run: () => buildPurchaseSummaryPdf(p) });
    steps.push({ title: 'Label list', description: 'Wire, terminal, device, cable and door labels', run: () => labelListPdf(p) });
  }
  const parts: PackagePart[] = [];
  for (const [i, s] of steps.entries()) {
    onProgress?.(s.title, i, steps.length + 1);
    const pdf = await s.run();
    if (pdf) parts.push({ title: s.title, description: s.description, pdf, children: s.children?.() });
  }
  return parts;
}

/** Cover and contents (jsPDF), sized to `contentsPages` pages after the cover. */
async function frontMatter(p: ProjectSnapshot, parts: { title: string; description: string; start: number; pages: number }[], total: number): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const m = docMeta(p);
  const W = 215.9, H = 279.4, M = 18;
  const txt = (t: string, x: number, y: number, size: number, bold = false, color: [number, number, number] = INK, align: 'left' | 'right' | 'center' = 'left') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(pdfSafe(t), x, y, { align });
  };
  // Cover
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 34, W, 2.2, 'F');
  if (m.company) txt(m.company, M, 15, 15, true, [255, 255, 255]);
  txt('CONTROLS ENGINEERING', M, m.company ? 22 : 15, 8.5, false, [214, 218, 190]);
  txt('COMPLETE PROJECT PACKAGE', M, 80, 11, true, MUTED);
  const name = doc.setFont('helvetica', 'bold').setFontSize(26).splitTextToSize(pdfSafe(p.projectName), W - 2 * M) as string[];
  name.forEach((l, i) => txt(l, M, 94 + i * 11, 26, true, BRAND));
  let y = 98 + name.length * 11;
  txt(`${p.profile.vendor} ${p.profile.name} ${p.cpu.id}${p.hmi ? ` · HMI ${p.hmi.hmiPartNumber}` : ''}`, M, y, 11, false, INK);
  y += 14;
  const rows: [string, string][] = [
    ['Customer', m.customer], ['Site', m.site], ['Project number', m.projectNumber],
    ['Revision', `${m.rev.rev} — ${m.rev.description}`], ['Date', m.rev.date], ['Status', m.status],
    ['Prepared by', m.preparedBy], ['Checked by', m.checkedBy], ['Approved by', m.approvedBy],
    ['Pages', String(total)],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    txt(k, M, y, 9.5, true, MUTED);
    const lines = doc.setFont('helvetica', 'normal').setFontSize(9.5).splitTextToSize(pdfSafe(v), W - M - (M + 42)) as string[];
    lines.forEach((l, i) => txt(l, M + 42, y + i * 4.4, 9.5, false, k === 'Status' && !m.approved ? [176, 0, 0] : INK));
    y += 6.2 + (lines.length - 1) * 4.4;
  }
  txt('This package contains every document of the project in one file. Each document keeps its own page numbers;', M, H - 30, 8, false, MUTED);
  txt('the package page number is printed at the foot of every page.', M, H - 26, 8, false, MUTED);

  // Contents
  doc.addPage('letter', 'portrait');
  txt('Contents', M, 32, 17, true, BRAND);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(M, 36, W - M, 36);
  doc.setFillColor(...ACCENT);
  doc.rect(M, 36.3, 24, 1.2, 'F');
  y = 48;
  txt('Part', M, y, 8, true, MUTED);
  txt('Pages', W - M - 22, y, 8, true, MUTED, 'right');
  txt('Page', W - M, y, 8, true, MUTED, 'right');
  y += 7;
  parts.forEach((pt, i) => {
    txt(`${i + 1}.  ${pt.title}`, M, y, 11, true, INK);
    txt(String(pt.pages), W - M - 22, y, 10, false, MUTED, 'right');
    txt(String(pt.start), W - M, y, 11, true, INK, 'right');
    const d = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(pdfSafe(pt.description), W - 2 * M - 40) as string[];
    d.slice(0, 2).forEach((l, k) => txt(l, M + 7, y + 4.8 + k * 3.8, 8.5, false, MUTED));
    y += 8 + Math.min(2, d.length) * 3.8;
    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.2);
    doc.line(M, y - 3, W - M, y - 3);
  });
  return doc.output('arraybuffer');
}

/** The whole package as one PDF with contents, bookmarks and package page numbers. */
export async function buildFullPackagePdf(p: ProjectSnapshot, onProgress?: Progress, pre: Prebuilt = {}): Promise<Blob> {
  const parts = await buildPackageParts(p, onProgress, pre);
  onProgress?.('Merging', parts.length, parts.length + 1);
  const { PDFDocument, PDFName, PDFHexString, StandardFonts, rgb } = await import('pdf-lib');
  const loaded = await Promise.all(parts.map(async (pt) => PDFDocument.load(await pt.pdf.arrayBuffer())));
  const FRONT = 2;
  let next = FRONT + 1;
  const index = parts.map((pt, i) => {
    const pages = loaded[i].getPageCount();
    const r = { title: pt.title, description: pt.description, start: next, pages };
    next += pages;
    return r;
  });
  const total = next - 1;
  const out = await PDFDocument.create();
  out.setTitle(`${p.projectName} — complete project package`);
  out.setCreator('ISA Auto Programmer');
  out.setProducer('ISA Auto Programmer');
  const front = await PDFDocument.load(await frontMatter(p, index, total));
  for (const pg of await out.copyPages(front, front.getPageIndices())) out.addPage(pg);
  for (const doc of loaded) for (const pg of await out.copyPages(doc, doc.getPageIndices())) out.addPage(pg);

  // Package page numbers at the foot of every page.
  const font = await out.embedFont(StandardFonts.Helvetica);
  const name = pdfSafe(p.projectName).slice(0, 60);
  out.getPages().forEach((pg, i) => {
    const t = `${name} — complete package — page ${i + 1} of ${total}`;
    const size = 6.5;
    const w = font.widthOfTextAtSize(t, size);
    const { width } = pg.getSize();
    pg.drawRectangle({ x: (width - w) / 2 - 2, y: 3, width: w + 4, height: size + 2.5, color: rgb(1, 1, 1) });
    pg.drawText(t, { x: (width - w) / 2, y: 4.6, size, font, color: rgb(0.39, 0.44, 0.49) });
  });

  // Bookmarks: cover, contents, each part (with its sheets / screens).
  const ctx = out.context;
  const pages = out.getPages();
  const outlineRef = ctx.nextRef();
  type Node = { title: string; page: number; kids: Node[] };
  const tree: Node[] = [
    { title: 'Cover', page: 0, kids: [] },
    { title: 'Contents', page: 1, kids: [] },
    ...index.map((ix, i) => ({
      title: `${i + 1}. ${ix.title}`, page: ix.start - 1,
      kids: (parts[i].children ?? []).filter((c) => c.page < ix.pages).map((c) => ({ title: c.title, page: ix.start - 1 + c.page, kids: [] })),
    })),
  ];
  const build = (nodes: Node[], parent: PDFRef): { first: PDFRef; last: PDFRef; count: number } => {
    const refs = nodes.map(() => ctx.nextRef());
    const count = nodes.length;
    nodes.forEach((n, i) => {
      const dict = ctx.obj({}) as PDFDict;
      dict.set(PDFName.of('Title'), PDFHexString.fromText(pdfSafe(n.title)));
      dict.set(PDFName.of('Parent'), parent);
      dict.set(PDFName.of('Dest'), ctx.obj([pages[n.page].ref, 'Fit']));
      if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1]);
      if (i < nodes.length - 1) dict.set(PDFName.of('Next'), refs[i + 1]);
      if (n.kids.length) {
        const k = build(n.kids, refs[i]);
        dict.set(PDFName.of('First'), k.first);
        dict.set(PDFName.of('Last'), k.last);
        dict.set(PDFName.of('Count'), ctx.obj(-k.count)); // collapsed
      }
      ctx.assign(refs[i], dict);
    });
    return { first: refs[0], last: refs[refs.length - 1], count };
  };
  const top = build(tree, outlineRef);
  ctx.assign(outlineRef, ctx.obj({ Type: 'Outlines', First: top.first, Last: top.last, Count: top.count }));
  out.catalog.set(PDFName.of('Outlines'), outlineRef);
  out.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  onProgress?.('Done', parts.length + 1, parts.length + 1);
  return new Blob([await out.save() as BlobPart], { type: 'application/pdf' });
}

/** Label files with the user's saved label setup. */
export async function labelFiles(p: ProjectSnapshot): Promise<{ name: string; data: Blob | string }[]> {
  if (!p.drawingCtx) return [];
  const labels = listLabels(p.drawingCtx);
  if (!labels.length) return [];
  const setup = labelSetupFor(useProjectsStore.getState().activeId);
  return [
    { name: `${p.fileBase}_labels.csv`, data: labelsCsv(labels, setup.content, setup.rowPerCopy) },
    { name: `${p.fileBase}_labels.xlsx`, data: await labelsXlsx(labels, setup, p.projectName) },
    { name: `${p.fileBase}_labels_label_printer.pdf`, data: await labelPrinterPdf(labels, setup, `${p.projectName} labels`) },
    { name: `${p.fileBase}_labels_sheet.pdf`, data: await labelSheetPdf(labels, setup, p.projectName) },
  ];
}

/** Add the full package PDF and the label files to the deliverables ZIP. */
export async function addPackageToZip(zip: JSZip, p: ProjectSnapshot, pre: Prebuilt, onProgress?: (step: string) => void): Promise<void> {
  onProgress?.('Labels');
  for (const f of await labelFiles(p)) zip.file(`labels/${f.name}`, f.data);
  if (p.drawingCtx || p.hmi) {
    onProgress?.('Purchasing');
    zip.file(`purchasing/${p.fileBase}_purchase_summary.pdf`, await buildPurchaseSummaryPdf(p));
    // The order files are the panel parts only; the recommended spares are a separate, clearly named order.
    const slug = (s: string) => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    const ol = buildOrderList(p, PANEL_ORDER);
    zip.file(`purchasing/${p.fileBase}_order_list.csv`, orderListCsv(ol));
    for (const g of ol.groups) zip.file(`purchasing/${p.fileBase}_order_${slug(g.supplier)}.csv`, supplierCsv(g));
    const sp = buildOrderList(p, SPARES_ORDER);
    const { orderListXlsx } = await import('./orderListXlsx');
    zip.file(`purchasing/${p.fileBase}_order_list.xlsx`, await orderListXlsx(ol, p.projectName, sp.groups.length ? sp : null));
    if (sp.groups.length) {
      zip.file(`purchasing/${p.fileBase}_spares_order_list.csv`, orderListCsv(sp));
      for (const g of sp.groups) zip.file(`purchasing/${p.fileBase}_${slug(g.supplier)}_spares_order.csv`, supplierCsv(g));
    }
  }
  if (Object.values(p.checkout ?? {}).some((c) => c.verified || c.note)) {
    const { buildCheckoutPdf } = await import('../online/checkoutPdf');
    zip.file(`commissioning/${p.fileBase}_IO_checkout.pdf`, await buildCheckoutPdf(p, p.checkout));
  }
  onProgress?.('Full package PDF');
  zip.file(`${p.fileBase}_full_package.pdf`, await buildFullPackagePdf(p, undefined, pre));
}
