import type { ProjectSnapshot } from './collect';
import { describeElement, describeOutput } from '../plc/core/clickExport';
import { blockTable, checkerTable, programInfo, tagTable } from './docs/program';
import { docMeta } from './docs/meta';
import { ACCENT, BRAND, INK, MUTED, PdfWriter, pdfSafe } from './docs/pdfWriter';
import { projectPlcNames } from './plcTagNames';
import { withPlcNamesAndIo } from '../plc/core/plcNames';

/**
 * Small controlled documents (Letter portrait) for the full package: a title
 * block on page 1, running header and "page i of n" footer. Used for the PLC
 * program listing, the I/O list, the BOM and the label list.
 */
export async function simpleDoc(p: ProjectSnapshot, title: string, subtitle: string, body: (w: PdfWriter) => void): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  doc.setProperties({ title: `${p.projectName} — ${title}`, creator: 'ISA Auto Programmer' });
  const w = new PdfWriter(doc);
  const m = docMeta(p);
  w.font(17, true, BRAND);
  doc.text(pdfSafe(title), w.M, w.y + 6);
  w.y += 9;
  w.font(9.5, false, MUTED);
  doc.text(pdfSafe(subtitle), w.M, w.y + 3);
  w.y += 5;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(w.M, w.y, w.W - w.M, w.y);
  doc.setFillColor(...ACCENT);
  doc.rect(w.M, w.y + 0.3, 24, 1.2, 'F');
  w.y += 6;
  body(w);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    w.font(8, true, BRAND);
    if (m.company) doc.text(pdfSafe(m.company), w.M, 13);
    w.font(8, false, INK);
    doc.text(pdfSafe(`${p.projectName} — ${title}`).slice(0, 90), w.W - w.M, 13, { align: 'right' });
    doc.setDrawColor(184, 192, 204);
    doc.setLineWidth(0.2);
    doc.line(w.M, 15, w.W - w.M, 15);
    doc.line(w.M, w.H - 14, w.W - w.M, w.H - 14);
    w.font(6.6, false, MUTED);
    doc.text(pdfSafe(`${m.status} · Rev ${m.rev.rev}`), w.M, w.H - 9.5);
    w.font(8, true, INK);
    doc.text(`Page ${i} of ${n}`, w.W - w.M, w.H - 9.5, { align: 'right' });
  }
  return doc.output('blob');
}

/** The PLC program in readable form: blocks, every rung with its comment and logic, tag table and checker result. */
export async function buildProgramListingPdf(p: ProjectSnapshot): Promise<Blob | null> {
  const ladder = p.profile.language === 'ladder';
  if (ladder ? !p.ladder.rungs.length : !p.stCode?.trim()) return null;
  return simpleDoc(p, 'PLC program listing', `${p.profile.vendor} ${p.profile.name} ${p.cpu.id} · ${ladder ? `${p.ladder.rungs.length} rungs, ${(p.ladder.blocks ?? []).length} blocks` : 'Structured Text'}`, (w) => {
    if (!ladder) {
      w.h2('Program source', false);
      const doc = w.doc;
      const lines = (p.stCode ?? '').replace(/\t/g, '  ').split('\n');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.6);
      lines.forEach((l, i) => {
        w.need(3.4);
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(...MUTED);
        doc.text(String(i + 1).padStart(4, ' '), w.M, w.y + 2.6);
        doc.setTextColor(...INK);
        for (const part of w.doc.splitTextToSize(pdfSafe(l || ' '), w.maxW - 12) as string[]) {
          w.need(3.4);
          doc.text(part, w.M + 12, w.y + 2.6);
          w.y += 3.3;
        }
      });
      return;
    }
    const info = programInfo(p);
    const label = (a: string) => (info.name(a) ? ` (${info.name(a)})` : '');
    // Siemens / Logix: every operand by its PLC tag name (and I/O address), as in the exported program.
    const names = projectPlcNames(p);
    const named = (t: string) => withPlcNamesAndIo(t, names);
    w.h2('Program blocks', false);
    w.table(blockTable(p), { fontSize: 8 });
    w.para(names
      ? `Each rung below lists its contacts in the order they are drawn, the outputs, and the same logic in plain words. Operands are shown by their ${p.profile.name} tag names (I/O with its address), followed by their description.`
      : 'Each rung below lists its contacts in the order they are drawn, the outputs, and the same logic in plain words. Addresses are followed by their nickname or I/O description.');

    const blocks = [...(p.ladder.blocks ?? [])];
    const order = [...blocks.map((b) => b.id), ''];
    const inBlock = (id: string) => p.ladder.rungs.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => (id ? r.block === id : !r.block || !blocks.some((b) => b.id === r.block)));
    for (const id of order) {
      const rungs = inBlock(id);
      if (!rungs.length) continue;
      const b = blocks.find((x) => x.id === id);
      w.h2(b ? `Block: ${b.name}` : 'General', false);
      if (b?.description) w.text(b.description, { size: 8.5, color: MUTED });
      for (const { r, n } of rungs) {
        w.need(16);
        w.text(`Rung ${n}${r.comment ? ` — ${r.comment}` : ''}`, { size: 9.8, bold: true, gap: 0.8 });
        const lines: string[] = [];
        if (!r.branches.length) lines.push('Conditions: none (always true)');
        r.branches.forEach((br, j) => {
          const prefix = r.branches.length > 1 ? `Branch ${j + 1} (OR): ` : 'In series: ';
          lines.push(prefix + (br.length ? br.map((el) => describeElement(el, label)).join('  ->  ') : 'wire'));
        });
        for (const o of r.outputs) lines.push(`Output: ${describeOutput(o, label)}`);
        for (const l of lines) w.text(named(l), { size: 8.3, indent: 4, gap: 0.4 });
        const words = info.conditionText(r) && named(info.conditionText(r));
        if (words) w.text(`In words: ${words}.`, { size: 8, indent: 4, color: MUTED, gap: 2.2 });
        else w.y += 1.8;
      }
    }
    w.h2(`End of program (rung ${p.ladder.rungs.length + 1}: unconditional END)`, false);
    w.newPage();
    w.h2('Tag table (memory map)', false);
    w.table(tagTable(p, info), { fontSize: 7.2 });
    w.h2('Program check', false);
    if (p.issues.length) w.table(checkerTable(p), { fontSize: 7.6 });
    else w.para('The program checker found no errors or warnings.');
  });
}
