import type { jsPDF } from 'jspdf';
import { isGroup, type DocTable } from './table';

/**
 * Small layout engine on top of jsPDF for controlled engineering documents:
 * Letter portrait, running header / footer, numbered headings collected for
 * the table of contents, and tables with wrapped cells, shaded header rows
 * repeated on every page and rows split across pages when needed.
 */

export type RGB = [number, number, number];
/** Graphite: headings, rules, title text. */
export const BRAND: RGB = [36, 39, 11];
/** Lime brand accent — small accents only, never text on white. */
export const ACCENT: RGB = [234, 255, 70];
/** Light lime: table header fill (dark text). */
export const HEAD_FILL: RGB = [245, 255, 196];
/** Neutral tint for call-outs. */
export const INFO_FILL: RGB = [248, 250, 236];
export const WARN_FILL: RGB = [253, 236, 236];
export const INK: RGB = [30, 35, 39];
export const MUTED: RGB = [100, 112, 124];
export const RED: RGB = [176, 0, 0];
const GROUP_FILL: RGB = [236, 238, 226];
const ZEBRA: RGB = [248, 249, 244];
const RULE: RGB = [184, 192, 204];

const PT = 0.3528; // mm per point

/** The built-in PDF fonts cover WinAnsi only; swap the symbols they can't draw. */
export function pdfSafe(t: string): string {
  return t
    .replace(/☐/g, '[ ]').replace(/[✓✔]/g, 'OK').replace(/→/g, '->').replace(/←/g, '<-').replace(/≈/g, '~')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '<>').replace(/Ω/g, ' ohm').replace(/√/g, 'sqrt').replace(/[‑−]/g, '-')
    .replace(/\t/g, ' ')
    .replace(/[^\x20-\xff\n—–’‘“”•…]/g, '?');
}

export interface Heading { level: 1 | 2; title: string; page: number }

export interface TableOpts { fontSize?: number; zebra?: boolean; headerless?: boolean; boldFirstCol?: boolean }

export class PdfWriter {
  readonly doc: jsPDF;
  readonly W = 215.9;
  readonly H = 279.4;
  readonly M = 18;
  readonly top = 27;
  readonly bottom = 279.4 - 18;
  y = 27;
  headings: Heading[] = [];

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  get maxW(): number { return this.W - 2 * this.M; }
  get page(): number { return this.doc.getNumberOfPages(); }

  newPage(): void {
    this.doc.addPage('letter', 'portrait');
    this.y = this.top;
  }

  need(h: number): void {
    if (this.y + h > this.bottom) this.newPage();
  }

  font(size: number, bold = false, color: RGB = INK): void {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  lineH(size: number): number { return size * PT * 1.22; }

  split(t: string, w: number): string[] {
    return this.doc.splitTextToSize(pdfSafe(t), w) as string[];
  }

  text(raw: string, o: { size?: number; bold?: boolean; color?: RGB; indent?: number; gap?: number; width?: number } = {}): void {
    const size = o.size ?? 9.5;
    this.font(size, o.bold, o.color);
    const x = this.M + (o.indent ?? 0);
    const lh = this.lineH(size);
    for (const line of this.split(raw, o.width ?? this.maxW - (o.indent ?? 0))) {
      this.need(lh);
      this.doc.text(line, x, this.y + size * PT * 0.8);
      this.y += lh;
    }
    this.y += o.gap ?? 1.6;
  }

  /** Numbered chapter: starts a new page. */
  h1(title: string, newPage = true): void {
    if (newPage && this.y > this.top + 0.1) this.newPage();
    this.need(16);
    this.headings.push({ level: 1, title, page: this.page });
    this.font(15, true, BRAND);
    this.doc.text(pdfSafe(title), this.M, this.y + 5);
    this.y += 7.5;
    this.doc.setDrawColor(...BRAND);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.M, this.y, this.W - this.M, this.y);
    this.doc.setFillColor(...ACCENT);
    this.doc.rect(this.M, this.y + 0.3, 24, 1.2, 'F');
    this.y += 4;
  }

  h2(title: string, toc = true): void {
    this.need(30);
    this.y += 1.5;
    if (toc) this.headings.push({ level: 2, title, page: this.page });
    this.font(11.5, true, BRAND);
    this.doc.text(pdfSafe(title), this.M, this.y + 4);
    this.y += 6.5;
  }

  h3(title: string): void {
    this.need(22);
    this.y += 0.5;
    this.font(9.8, true, INK);
    this.doc.text(pdfSafe(title), this.M, this.y + 3.4);
    this.y += 5;
  }

  para(t: string): void { this.text(t, { size: 9.5 }); }

  bullets(items: string[], o: { numbered?: boolean; size?: number } = {}): void {
    const size = o.size ?? 9.3;
    items.forEach((it, i) => {
      const mark = o.numbered ? `${i + 1}.` : '•';
      this.font(size);
      const lines = this.split(it, this.maxW - 7);
      const lh = this.lineH(size);
      lines.forEach((l, k) => {
        this.need(lh);
        if (k === 0) this.doc.text(mark, this.M + 1.5, this.y + size * PT * 0.8);
        this.doc.text(l, this.M + 7, this.y + size * PT * 0.8);
        this.y += lh;
      });
      this.y += 0.9;
    });
    this.y += 1;
  }

  /** Bordered call-out box (status, results, warnings). */
  callout(t: string, color: RGB = BRAND, fill: RGB = INFO_FILL): void {
    const size = 9;
    this.font(size, true, color);
    const lines = this.split(t, this.maxW - 8);
    const lh = this.lineH(size);
    const h = lines.length * lh + 4;
    this.need(h + 2);
    this.doc.setFillColor(...fill);
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(0.4);
    this.doc.rect(this.M, this.y, this.maxW, h, 'FD');
    this.doc.setFillColor(...color);
    this.doc.rect(this.M, this.y, 1.6, h, 'F');
    lines.forEach((l, i) => this.doc.text(l, this.M + 5, this.y + 2 + i * lh + size * PT * 0.8));
    this.y += h + 3;
  }

  image(dataUrl: string, fmt: 'JPEG' | 'PNG', pxW: number, pxH: number, maxH: number, caption?: string): void {
    const h = Math.min(maxH, (this.maxW * pxH) / pxW);
    const w = (h * pxW) / pxH;
    this.need(h + (caption ? 7 : 3));
    this.doc.setDrawColor(...RULE);
    this.doc.setLineWidth(0.2);
    const x = this.M + (this.maxW - w) / 2;
    this.doc.addImage(dataUrl, fmt, x, this.y, w, h, undefined, 'FAST');
    this.doc.rect(x, this.y, w, h);
    this.y += h + 1.5;
    if (caption) { this.font(8, false, MUTED); this.doc.text(pdfSafe(caption), this.W / 2, this.y + 2.8, { align: 'center' }); this.y += 5; }
    this.y += 1.5;
  }

  table(t: DocTable, o: TableOpts = {}): void {
    const doc = this.doc;
    const fs = o.fontSize ?? 7.6;
    const pad = 1.3;
    const lh = this.lineH(fs);
    const widths = this.columnWidths(t, fs, pad);
    const xs = widths.map((_, i) => this.M + widths.slice(0, i).reduce((s, w) => s + w, 0));
    if (!t.rows.length) {
      this.text('(none)', { size: 8.5, color: MUTED });
      return;
    }
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    const headLines = t.columns.map((c, i) => this.split(c.header, widths[i] - 2 * pad));
    const headH = Math.max(...headLines.map((l) => l.length)) * lh + 2 * pad;
    const drawHeader = () => {
      if (o.headerless) return;
      doc.setFillColor(...HEAD_FILL);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.15);
      doc.rect(this.M, this.y, this.maxW, headH, 'FD');
      doc.setDrawColor(...BRAND);
      doc.setLineWidth(0.35);
      doc.line(this.M, this.y + headH, this.M + this.maxW, this.y + headH);
      this.font(fs, true, BRAND);
      headLines.forEach((ls, i) => ls.forEach((l, k) => this.cellText(l, xs[i], widths[i], pad, this.y + pad + k * lh + fs * PT * 0.8, t.columns[i].align)));
      this.y += headH;
    };
    this.need(headH + lh * 2 + 2 * pad);
    drawHeader();
    let zebra = false;
    for (const row of t.rows) {
      if (isGroup(row)) {
        this.font(fs + 0.4, true, BRAND);
        const ls = this.split(row.group, this.maxW - 2 * pad);
        const h = ls.length * lh + 2 * pad;
        if (this.y + h + lh + 2 * pad > this.bottom) { this.newPage(); drawHeader(); }
        doc.setFillColor(...GROUP_FILL);
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.15);
        doc.rect(this.M, this.y, this.maxW, h, 'FD');
        this.font(fs + 0.4, true, BRAND);
        ls.forEach((l, k) => doc.text(l, this.M + pad, this.y + pad + k * lh + fs * PT * 0.8));
        this.y += h;
        zebra = false;
        continue;
      }
      const cells = t.columns.map((_, i) => {
        this.font(fs, o.boldFirstCol && i === 0);
        return this.split(row[i] ?? '', widths[i] - 2 * pad);
      });
      const maxLines = Math.max(1, ...cells.map((c) => c.length));
      let start = 0;
      for (;;) {
        const remaining = maxLines - start;
        const fullH = Math.max(remaining * lh + 2 * pad, start === 0 ? t.minRowMm ?? 0 : 0);
        if (this.y + fullH <= this.bottom) {
          this.drawRow(cells, start, maxLines, fullH, xs, widths, pad, lh, fs, t, o, zebra);
          this.y += fullH;
          break;
        }
        const fit = Math.floor((this.bottom - this.y - 2 * pad) / lh);
        const freshAvail = this.bottom - this.top - headH;
        if (fit < 3 || (start === 0 && fullH <= freshAvail)) { this.newPage(); drawHeader(); continue; }
        const h = fit * lh + 2 * pad;
        this.drawRow(cells, start, start + fit, h, xs, widths, pad, lh, fs, t, o, zebra);
        start += fit;
        this.newPage();
        drawHeader();
      }
      zebra = !zebra;
    }
    this.y += 3;
  }

  /** Proportional widths, widened so the longest word of each column fits (no mid-word breaks). */
  private columnWidths(t: DocTable, fs: number, pad: number): number[] {
    const total = t.columns.reduce((s, c) => s + c.width, 0);
    const base = t.columns.map((c) => (c.width / total) * this.maxW);
    const word = (s: string, bold: boolean) => {
      this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      this.doc.setFontSize(fs);
      return Math.max(0, ...pdfSafe(s).split(/\s+/).map((w) => this.doc.getTextWidth(w)));
    };
    const min = t.columns.map((c, i) => {
      let w = t.columns.length > 1 ? word(c.header, true) : 0;
      for (const r of t.rows) if (!isGroup(r)) w = Math.max(w, word(r[i] ?? '', false));
      return Math.min(w + 2 * pad + 0.6, this.maxW * 0.35);
    });
    if (min.reduce((s, w) => s + w, 0) > this.maxW) return base;
    const out = [...base];
    for (let iter = 0; iter < 5; iter++) {
      const short = out.map((w, i) => Math.max(0, min[i] - w));
      const need = short.reduce((s, x) => s + x, 0);
      if (need < 0.01) break;
      const slack = out.map((w, i) => (short[i] > 0 ? 0 : Math.max(0, w - min[i])));
      const totalSlack = slack.reduce((s, x) => s + x, 0);
      if (totalSlack <= 0) break;
      const take = Math.min(1, need / totalSlack);
      for (let i = 0; i < out.length; i++) out[i] = short[i] > 0 ? min[i] : out[i] - slack[i] * take;
    }
    return out;
  }

  private cellText(l: string, x: number, w: number, pad: number, y: number, align?: 'left' | 'center' | 'right') {
    if (align === 'center') this.doc.text(l, x + w / 2, y, { align: 'center' });
    else if (align === 'right') this.doc.text(l, x + w - pad, y, { align: 'right' });
    else this.doc.text(l, x + pad, y);
  }

  private drawRow(cells: string[][], from: number, to: number, h: number, xs: number[], widths: number[], pad: number, lh: number, fs: number, t: DocTable, o: TableOpts, zebra: boolean) {
    const doc = this.doc;
    if (o.zebra !== false && zebra) { doc.setFillColor(...ZEBRA); doc.rect(this.M, this.y, this.maxW, h, 'F'); }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    cells.forEach((ls, i) => {
      doc.rect(xs[i], this.y, widths[i], h);
      this.font(fs, o.boldFirstCol && i === 0, /^(CHECK|UNKNOWN|NOT (IN|ASSIGNED|SELECTED|DEFINED)|EXCEEDS|TO BE PROVIDED)/.test(ls[0] ?? '') ? RED : INK);
      ls.slice(from, to).forEach((l, k) => this.cellText(l, xs[i], widths[i], pad, this.y + pad + k * lh + fs * PT * 0.8, t.columns[i].align));
    });
  }

  /** Two-column key/value table without a header row. */
  keyValue(rows: [string, string][], keyWidth = 30): void {
    this.table({ columns: [{ header: '', width: keyWidth }, { header: '', width: 100 - keyWidth }], rows: rows.map(([k, v]) => [k, v]) }, { headerless: true, boldFirstCol: true, fontSize: 8.5, zebra: false });
  }
}
