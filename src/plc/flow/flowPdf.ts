/**
 * The program flow as a PDF, to show an outside programmer how the machine works: how to read the drawing, the
 * machine map (every function), then each function's diagram (steps, IF diamonds, arrows) drawn as vectors and split
 * over pages between boxes, followed by its ladder drawn rung by rung with the same logic in plain words; then the
 * I/O list, the alarms and faults, and what was changed since the last saved version.
 */
import type { jsPDF } from 'jspdf';
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../core/ladder';
import { ACCENT, BRAND, INK, MUTED, PdfWriter, pdfSafe, type RGB } from '../../deliverables/docs/pdfWriter';
import { rungWords, type FlowChange } from './flowEdit';
import { IO_H, type FlowDiagram, type FlowMap, type FlowNode, type NameOf } from './flowModel';

export interface FlowPdfInput {
  projectName: string;
  /** "AutomationDirect CLICK · C0-12DD1E-D". */
  plcName: string;
  program: LadderProgram;
  map: FlowMap;
  nameOf: NameOf;
  /** The I/O list: address, what it is, input or output. */
  io: { address: string; description: string; kind: string }[];
  /** What changed since the last saved version (none: the section is left out). */
  changes?: FlowChange[];
  /** "2026-10-24 14:05". */
  date?: string;
  /** Only these functions (diagram ids); all when not given. */
  only?: string[];
  /** Compressed page content (default; off only to read the text in a test). */
  compress?: boolean;
}

const ALARM = /\b(ALM|ALARM|FAULT|FLT)|alarm|fault/i;
const STEP_FILL: RGB = [220, 252, 231], STEP_LINE: RGB = [22, 101, 52];
const DEC_FILL: RGB = [254, 249, 195], DEC_LINE: RGB = [161, 98, 7];
const ACT_FILL: RGB = [224, 242, 254], ACT_LINE: RGB = [3, 105, 161];
const EDGE: RGB = [120, 132, 148];
const IN_FILL: RGB = [224, 242, 254], IN_INK: RGB = [3, 105, 161], OUT_FILL: RGB = [255, 237, 213], OUT_INK: RGB = [194, 65, 12];
const PX_MAX = 0.3; // mm per diagram unit at most (12 px text ≈ 10 pt)

/** A diagram's vertical bands, one per page: each ends between boxes (a box is never cut). */
export function bands(d: FlowDiagram, bandH: number): [number, number][] {
  const out: [number, number][] = [];
  let y0 = 0;
  while (y0 < d.h) {
    let y1 = Math.min(d.h, y0 + bandH);
    if (y1 < d.h) {
      // move the cut up above any box it would cross
      for (let moved = true; moved;) {
        moved = false;
        for (const n of d.nodes) {
          // a box with its comment beside it: neither cut
          const top = Math.min(n.y, n.note?.y ?? n.y), bottom = Math.max(n.y + n.h, n.note ? n.note.y + n.note.lines.length * 14 + 4 : 0);
          if (top - 8 < y1 && bottom + 8 > y1 && top - 8 > y0) { y1 = top - 8; moved = true; }
        }
      }
      if (y1 <= y0 + 20) y1 = Math.min(d.h, y0 + bandH); // a box taller than a page: cut it
    }
    out.push([y0, y1]);
    y0 = y1;
  }
  return out;
}

function arrowHead(doc: jsPDF, [x1, y1]: [number, number], [x2, y2]: [number, number], size: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (da: number): [number, number] => [x2 - size * Math.cos(a + da), y2 - size * Math.sin(a + da)];
  const [ax, ay] = p(0.45), [bx, by] = p(-0.45);
  doc.triangle(x2, y2, ax, ay, bx, by, 'F');
}

function drawNode(doc: jsPDF, n: FlowNode, X: (x: number) => number, Y: (y: number) => number, k: number): void {
  const x = X(n.x), y = Y(n.y), w = n.w * k, h = n.h * k;
  doc.setLineWidth(0.3);
  if (n.kind === 'decision') {
    doc.setFillColor(...DEC_FILL); doc.setDrawColor(...DEC_LINE);
    const e = 34 * k;
    doc.lines([[e, -h / 2], [w - 2 * e, 0], [e, h / 2], [-e, h / 2], [-(w - 2 * e), 0], [-e, -h / 2]], x, y + h / 2, [1, 1], 'FD', true);
  } else {
    const [fill, line] = n.kind === 'step' ? [STEP_FILL, STEP_LINE] : [ACT_FILL, ACT_LINE];
    doc.setFillColor(...fill); doc.setDrawColor(...line);
    if (n.kind === 'any') doc.setLineDashPattern([1.5, 1], 0);
    doc.roundedRect(x, y, w, h, (n.kind === 'step' ? 12 : 5) * k, (n.kind === 'step' ? 12 : 5) * k, 'FD');
    doc.setLineDashPattern([], 0);
  }
  const pad = (n.kind === 'decision' ? 38 : 12) * k;
  const maxW = w - 2 * pad + (n.kind === 'decision' ? 20 * k : 0);
  const fit = (t: string) => {
    let s = pdfSafe(t);
    while (s.length > 3 && doc.getTextWidth(s) > maxW) s = s.slice(0, -2);
    return s === pdfSafe(t) ? s : `${s.trimEnd()}…`;
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12 * k / 0.3528); doc.setTextColor(...(n.kind === 'step' ? STEP_LINE : INK));
  doc.text(fit(n.title), x + pad, y + 18 * k);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11 * k / 0.3528);
  n.lines.forEach((l, i) => {
    doc.setTextColor(...(l === '— OR —' ? MUTED : INK));
    doc.text(fit(l), x + pad, y + (36 + i * 15) * k);
  });
  // the real inputs it reads (blue) and the outputs it switches (orange), as on the screen
  n.io?.forEach((io, i) => {
    const ry = y + (34 + n.lines.length * 15 + 6 + i * IO_H) * k;
    const [fill, ink] = io.dir === 'in' ? [IN_FILL, IN_INK] : [OUT_FILL, OUT_INK];
    doc.setFillColor(...fill); doc.setDrawColor(...ink); doc.setLineWidth(0.15);
    doc.roundedRect(x + pad - 4 * k, ry, w - 2 * pad + 8 * k, (IO_H - 3) * k, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10 * k / 0.3528); doc.setTextColor(...ink);
    doc.text(fit(`${io.dir === 'in' ? 'IN' : 'OUT'} ${io.address} ${io.name} — ${io.what}`), x + pad, ry + 10.5 * k);
  });
}

/** A box's comment beside it, as // … (monospace, grey), with its dotted leader. */
function drawNote(doc: jsPDF, n: FlowNode, X: (x: number) => number, Y: (y: number) => number, k: number): void {
  if (!n.note) return;
  doc.setDrawColor(...EDGE); doc.setLineWidth(0.15); doc.setLineDashPattern([0.5, 0.8], 0);
  doc.line(X(n.note.ax), Y(n.y + 14), X(n.note.x - 6), Y(n.note.y + 6));
  doc.setLineDashPattern([], 0);
  doc.setFont('courier', 'normal'); doc.setFontSize(11 * k / 0.3528); doc.setTextColor(...MUTED);
  n.note.lines.forEach((l, i) => doc.text(pdfSafe(`// ${l}`), X(n.note!.x), Y(n.note!.y + 10 + i * 14)));
}

/** A function's diagram over as many pages as it needs, scaled to the page width. */
function drawDiagram(w: PdfWriter, d: FlowDiagram): void {
  const doc = w.doc;
  const k = Math.min(PX_MAX, w.maxW / d.w);
  const left = w.M + (w.maxW - d.w * k) / 2;
  const pageBand = (w.bottom - w.top - 4) / k;
  const first = (w.bottom - w.y - 4) / k;
  // the first band uses what is left of this page when there is room for a box
  let list = bands(d, pageBand);
  if (first > 140) {
    const head = bands(d, first)[0];
    list = [head, ...bands({ ...d, nodes: d.nodes.map((n) => ({ ...n, y: n.y - head[1] })), h: d.h - head[1] }, pageBand).map(([a, b]) => [a + head[1], b + head[1]] as [number, number])];
  } else w.newPage();
  list.forEach(([y0, y1], i) => {
    if (i > 0) w.newPage();
    const top = w.y;
    const X = (x: number) => left + x * k, Y = (y: number) => top + (y - y0) * k;
    doc.saveGraphicsState();
    doc.rect(left - 2, top - 1, d.w * k + 4, (y1 - y0) * k + 2, null);
    doc.clip(); doc.discardPath();
    doc.setDrawColor(...EDGE); doc.setFillColor(...EDGE);
    for (const e of d.edges) {
      if (!e.points.some(([, y]) => y >= y0 - 40 && y <= y1 + 40) && !(Math.min(...e.points.map((p) => p[1])) < y0 && Math.max(...e.points.map((p) => p[1])) > y1)) continue;
      doc.setLineWidth(0.25);
      if (e.back) doc.setLineDashPattern([1.2, 0.8], 0);
      for (let j = 1; j < e.points.length; j++) doc.line(X(e.points[j - 1][0]), Y(e.points[j - 1][1]), X(e.points[j][0]), Y(e.points[j][1]));
      doc.setLineDashPattern([], 0);
      const pts = e.points.map(([x, y]) => [X(x), Y(y)] as [number, number]);
      if (pts.length > 1) arrowHead(doc, pts[pts.length - 2], pts[pts.length - 1], 1.6);
      if (e.label && e.label !== 'NEXT') {
        const [lx, ly] = e.points[Math.min(1, e.points.length - 1)];
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10 * k / 0.3528); doc.setTextColor(...MUTED);
        doc.text(pdfSafe(e.label), X(lx) + 4 * k, Y(ly) - 4 * k);
      }
    }
    for (const n of d.nodes) if (n.y < y1 && n.y + n.h > y0) { drawNode(doc, n, X, Y, k); drawNote(doc, n, X, Y, k); }
    doc.restoreGraphicsState();
    w.y = top + (y1 - y0) * k + 3;
    if (list.length > 1) {
      w.font(7.5, false, MUTED);
      doc.text(pdfSafe(`${d.name} — diagram part ${i + 1} of ${list.length}${i < list.length - 1 ? ' (continued on the next page)' : ''}`), w.W / 2, Math.min(w.y + 1, w.bottom + 3), { align: 'center' });
      w.y += 4;
    }
  });
}

const CELL = 19, ROW = 10.5; // mm: a ladder symbol's cell (at most), a row

function elSymbol(doc: jsPDF, el: LadderElement, x: number, y: number, cell: number, nameOf: NameOf): void {
  const chars = Math.max(6, Math.floor(cell * 0.85));
  const mid = x + cell / 2;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3);
  doc.line(x, y, mid - 2.2, y); doc.line(mid + 2.2, y, x + cell, y);
  let top: string, bottom = '';
  if (el.type === 'CMP') {
    doc.rect(mid - 4.5, y - 2.4, 9, 4.8);
    doc.line(x, y, mid - 4.5, y); doc.line(mid + 4.5, y, x + cell, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.setTextColor(...INK);
    doc.text(pdfSafe(el.op), mid, y + 0.9, { align: 'center' });
    top = el.left; bottom = el.right;
  } else if (el.type === 'RAW') {
    doc.rect(mid - 6, y - 2.4, 12, 4.8);
    top = el.text.slice(0, 14);
  } else {
    doc.line(mid - 2.2, y - 2.2, mid - 2.2, y + 2.2); doc.line(mid + 2.2, y - 2.2, mid + 2.2, y + 2.2);
    if (el.type === 'NC') doc.line(mid - 1.8, y + 1.9, mid + 1.8, y - 1.9);
    if (el.type === 'RISE' || el.type === 'FALL') {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...INK);
      doc.text(el.type === 'RISE' ? '^' : 'v', mid, y + 1, { align: 'center' });
    }
    top = el.address; bottom = nameOf(el.address) !== el.address ? nameOf(el.address) : '';
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(...BRAND);
  doc.text(pdfSafe(top).slice(0, chars), mid, y - 3.2, { align: 'center' });
  if (bottom) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...MUTED);
    const s = pdfSafe(bottom);
    doc.text(s.length > chars + 2 ? `${s.slice(0, chars + 1)}…` : s, mid, y + 4.6, { align: 'center' });
  }
}

function outText(o: LadderOutput): [string, string] {
  switch (o.type) {
    case 'OUT': return ['( )', o.address];
    case 'SET': return ['(S)', o.address];
    case 'RST': return ['(R)', o.address];
    case 'TMR': return ['TMR', `${o.address} ${o.preset} ${o.unit}`];
    case 'CNT': return [o.direction === 'DOWN' ? 'CTD' : 'CTU', `${o.address} = ${o.preset}`];
    case 'COPY': return ['COPY', `${o.source} -> ${o.dest}`];
    case 'MATH': return ['MATH', `${o.dest} = ${o.expression}`];
    default: return ['RAW', o.text.slice(0, 18)];
  }
}

/** One rung drawn as ladder: left rail, each branch a row (OR), contacts in series (AND), outputs on the right. */
function drawRung(w: PdfWriter, r: Rung, n: number, p: { nameOf: NameOf }): void {
  const { nameOf } = p;
  const doc = w.doc;
  const rows = Math.max(1, r.branches.length, r.outputs.length);
  const outW = 40;
  const cols = Math.max(1, ...r.branches.map((b) => b.length));
  const cell = Math.min(CELL, (w.maxW - outW - 12) / cols);
  const words = rungWords(r, nameOf);
  const h = rows * ROW + 8;
  w.need(h + 8 + Math.min(words.length, 8) * 3.3);
  w.text(`Rung ${n}${r.comment ? ` — ${r.comment}` : ''}`, { size: 8.6, bold: true, gap: 0.6 });
  const x0 = w.M + 4, xr = w.W - w.M - 2, xo = xr - outW;
  const y0 = w.y + 5;
  doc.setDrawColor(...INK); doc.setLineWidth(0.5);
  doc.line(x0, w.y + 1, x0, w.y + rows * ROW + 1);
  doc.line(xr, w.y + 1, xr, w.y + rows * ROW + 1);
  doc.setLineWidth(0.3);
  const branches = r.branches.length ? r.branches : [[]];
  branches.forEach((br, i) => {
    const y = y0 + i * ROW;
    br.forEach((el, j) => elSymbol(doc, el, x0 + j * cell, y, cell, p.nameOf));
    doc.setDrawColor(...INK); doc.setLineWidth(0.3);
    const end = x0 + br.length * cell;
    doc.line(end, y, xo - 3, y);
    if (i > 0) doc.line(xo - 3, y0, xo - 3, y);
  });
  r.outputs.forEach((o, i) => {
    const y = y0 + i * ROW;
    const [sym, txt] = outText(o);
    doc.setDrawColor(...INK); doc.setLineWidth(0.3);
    doc.line(xo - 3, y, xo + 2, y);
    if (i > 0) doc.line(xo - 3, y0, xo - 3, y);
    const coil = o.type === 'OUT' || o.type === 'SET' || o.type === 'RST';
    if (coil) { doc.circle(xo + 5, y, 2.6); doc.line(xo + 7.6, y, xr, y); } else { doc.rect(xo + 2, y - 2.6, 11, 5.2); doc.line(xo + 13, y, xr, y); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4); doc.setTextColor(...INK);
    doc.text(coil ? sym.slice(1, 2).replace(' ', '') : sym, coil ? xo + 5 : xo + 7.5, y + 0.9, { align: 'center' });
    doc.setFontSize(5.8); doc.setTextColor(...BRAND);
    doc.text(pdfSafe(txt).slice(0, 26), xo + 15, y - 1.2);
    const addr = 'address' in o ? o.address : 'dest' in o ? o.dest : '';
    if (addr && nameOf(addr) !== addr) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...MUTED);
      doc.text(pdfSafe(nameOf(addr)).slice(0, 28), xo + 15, y + 2.6);
    }
  });
  w.y += rows * ROW + 3;
  // the same in plain words
  for (const l of words) w.text(l, { size: 7.4, indent: 6, gap: 0, color: l === 'IF' || l === 'THEN' || l === 'ALWAYS' ? BRAND : INK });
  w.y += 2.5;
}

/** How to read the drawing (first page). */
const LEGEND: [string, string][] = [
  ['Step (green, rounded)', 'A stage of the machine\'s cycle, by its number and name (the step register holds it). Inside: what the machine does in that step.'],
  ['Diamond (yellow)', 'An IF: the conditions to go on. In a step sequence: the way out of a step to the next one. Elsewhere: a rung\'s conditions.'],
  ['Box (blue)', 'THEN: what the PLC turns on, off, starts or sets when the IF before it is true.'],
  ['IN / OUT rows', 'Inside a box: the real inputs it reads (blue, with the state it needs) and the outputs it switches (orange, with what it does), by address and name.'],
  ['// text', 'Beside a box: the comment of its rungs, as a programmer writes it in the code.'],
  ['Dashed box', 'From any step: a way that leaves whichever step is running (a stop, a fault).'],
  ['Arrows', 'The order things happen. YES / NO on an arrow: which way the IF goes. Dashed arrows go back up (the cycle repeats).'],
  ['Ladder', 'After each diagram: the same rungs drawn as ladder. Symbols on a row are in series (AND); rows under each other are parallel (OR). Under each rung: the same logic in words.'],
];

export async function buildFlowPdf(p: FlowPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait', compress: p.compress !== false });
  const title = 'Program flow — how the machine works';
  doc.setProperties({ title: `${p.projectName} — ${title}`, creator: 'ISA Auto Programmer' });
  const w = new PdfWriter(doc);
  const numberOf = new Map(p.program.rungs.map((r, i) => [r.id, i + 1]));
  const rungsOf = (id: string) => p.program.rungs.filter((r) => (r.block ?? '') === id || (!id && !(p.program.blocks ?? []).some((b) => b.id === r.block)));

  w.font(17, true, BRAND);
  doc.text(pdfSafe(title), w.M, w.y + 6);
  w.y += 9;
  w.font(9.5, false, MUTED);
  doc.text(pdfSafe(`${p.projectName} · ${p.plcName} · ${p.program.rungs.length} rungs in ${p.map.diagrams.length} functions${p.date ? ` · ${p.date}` : ''}`), w.M, w.y + 3);
  w.y += 5;
  doc.setDrawColor(...BRAND); doc.setLineWidth(0.6); doc.line(w.M, w.y, w.W - w.M, w.y);
  doc.setFillColor(...ACCENT); doc.rect(w.M, w.y + 0.3, 24, 1.2, 'F');
  w.y += 6;
  w.para('This document shows the PLC program as flow diagrams, one per machine function, each followed by the same rungs drawn as ladder. It is made from the program itself: what is drawn is what the PLC runs.');

  w.h2('How to read the diagrams', false);
  w.table({ columns: [{ header: 'Symbol', width: 22 }, { header: 'Meaning', width: 80 }], rows: LEGEND }, { fontSize: 8, boldFirstCol: true });

  w.h2('Machine map: the functions', false);
  w.table({
    columns: [{ header: '#', width: 4 }, { header: 'Function', width: 22 }, { header: 'What it does', width: 40 }, { header: 'Rungs', width: 7 }, { header: 'Step sequence', width: 30 }],
    rows: p.map.diagrams.map((d, i) => [String(i + 1), d.name, d.description || '—', String(d.rungCount), d.register ? `${d.register}: steps ${d.nodes.filter((n) => n.kind === 'step').map((n) => n.step).join(', ')}` : '—']),
  }, { fontSize: 8 });

  for (const [i, d] of p.map.diagrams.entries()) {
    if (p.only && !p.only.includes(d.id)) continue;
    w.newPage();
    w.h2(`${i + 1}. ${d.name}`, false);
    w.text(`${d.rungCount} rung${d.rungCount === 1 ? '' : 's'}${d.register ? ` · step sequence in ${d.register}` : ''}${d.description ? ` · ${d.description}` : ''}`, { size: 8.5, color: MUTED });
    drawDiagram(w, d);
    w.need(60); // the heading with its first rung
    w.h3(`The ladder of ${d.name}`);
    for (const r of rungsOf(d.id)) drawRung(w, r, numberOf.get(r.id) ?? 0, p);
  }

  w.newPage();
  w.h2('I/O list', false);
  w.table({ columns: [{ header: 'Address', width: 12 }, { header: 'Input / output', width: 14 }, { header: 'What it is', width: 60 }], rows: p.io.map((x) => [x.address, x.kind, x.description]) }, { fontSize: 8 });

  // alarms and faults: the bits the program sets or turns on whose name says alarm / fault
  const alarms = new Map<string, number[]>();
  for (const r of p.program.rungs) for (const o of r.outputs) {
    if ((o.type === 'OUT' || o.type === 'SET') && ALARM.test(`${o.address} ${p.nameOf(o.address)}`)) alarms.set(o.address, [...(alarms.get(o.address) ?? []), numberOf.get(r.id) ?? 0]);
  }
  w.h2('Alarms and faults', false);
  if (!alarms.size) w.para('The program has no bits named as an alarm or fault.');
  else w.table({
    columns: [{ header: 'Bit', width: 12 }, { header: 'Name', width: 36 }, { header: 'Turned on by', width: 30 }, { header: 'Latched', width: 16 }],
    rows: [...alarms].map(([a, rungs]) => [a, p.nameOf(a), rungs.map((n) => `rung ${n}`).join(', '), p.program.rungs.some((r) => r.outputs.some((o) => o.type === 'SET' && o.address === a)) ? 'yes (until reset)' : 'no']),
  }, { fontSize: 8 });

  if (p.changes?.length) {
    w.h2('What was changed', false);
    w.para('Since the last saved version of the program, rung by rung (before -> after).');
    for (const c of p.changes) {
      w.need(14);
      w.text(`${c.kind === 'added' ? 'Added' : c.kind === 'removed' ? 'Removed' : 'Changed'}: ${c.title}`, { size: 8.8, bold: true, gap: 0.5 });
      if (c.before.length) w.text(`Before: ${c.before.join(' ').replace(/\s+/g, ' ')}`, { size: 7.6, indent: 4, color: MUTED, gap: 0.2 });
      if (c.after.length) w.text(`After: ${c.after.join(' ').replace(/\s+/g, ' ')}`, { size: 7.6, indent: 4, gap: 1.2 });
    }
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    w.font(8, false, INK);
    doc.text(pdfSafe(`${p.projectName} — ${title}`).slice(0, 90), w.W - w.M, 13, { align: 'right' });
    doc.setDrawColor(184, 192, 204); doc.setLineWidth(0.2);
    doc.line(w.M, 15, w.W - w.M, 15);
    doc.line(w.M, w.H - 14, w.W - w.M, w.H - 14);
    w.font(6.6, false, MUTED);
    doc.text('Made by ISA Auto Programmer from the PLC program', w.M, w.H - 9.5);
    w.font(8, true, INK);
    doc.text(`Page ${i} of ${n}`, w.W - w.M, w.H - 9.5, { align: 'right' });
  }
  return doc.output('blob');
}
