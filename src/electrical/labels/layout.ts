import { labelText, type Label } from '../labels';
import { sizeOf, type LabelSetup } from './setup';

/**
 * Lays out the text of one label in millimetres. The same layout drives the
 * on-screen preview (SVG) and the PDFs, so what is shown is what prints.
 * The number is bold and as large as the label allows; the description is
 * smaller, beside it, wrapped to at most two lines.
 */

/** mm per typographic point. */
export const PT = 25.4 / 72;

/** Width in mm of `text` set in Helvetica at `sizePt`. */
export type Measure = (text: string, sizePt: number, bold: boolean) => number;

export interface TextRun {
  text: string;
  /** Left edge (align 'left') or centre (align 'center'), local mm. */
  x: number;
  /** Baseline, local mm. */
  y: number;
  size: number;
  bold: boolean;
  align: 'left' | 'center';
}

export interface LabelLayout {
  /** Page (label) size in mm. */
  w: number;
  h: number;
  /** Text is turned 90° (reads bottom to top); runs are in the rotated box (width h, height w). */
  rotate: boolean;
  runs: TextRun[];
}

const MIN_PT = 3.5;
const CAP = 0.72; // Helvetica cap height / em
const LINE = 1.12;

const margin = (lw: number, lh: number, tape: boolean) =>
  tape ? Math.max(2, lh * 0.22) : Math.min(2.5, Math.max(0.6, Math.min(lw, lh) * 0.1));

/** Baselines of n lines centred on the box by cap height (so digits and capitals look centred). */
function baselines(n: number, size: number, y0: number, h: number): number[] {
  const lh = size * PT * LINE, cap = size * PT * CAP;
  const first = y0 + (h - ((n - 1) * lh + cap)) / 2 + cap;
  return Array.from({ length: n }, (_, i) => first + i * lh);
}

/** Greedy word wrap; a word longer than the line is broken. The last allowed line is cut with "…". */
export function wrap(text: string, maxW: number, size: number, bold: boolean, measure: Measure, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const push = (l: string) => lines.push(l);
  for (let word of words) {
    while (measure(word, size, bold) > maxW && word.length > 1) {
      // Break an over-long word at the most characters that fit.
      let n = word.length - 1;
      while (n > 1 && measure(word.slice(0, n), size, bold) > maxW) n--;
      if (cur) { push(cur); cur = ''; }
      push(word.slice(0, n));
      word = word.slice(n);
    }
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next, size, bold) > maxW) { push(cur); cur = word; } else cur = next;
  }
  if (cur) push(cur);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = `${out[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;
  while (last.length > 1 && measure(`${last}…`, size, bold) > maxW) last = last.slice(0, -1).trimEnd();
  out[maxLines - 1] = `${last}…`;
  return out;
}

/** Split into two lines at the space that gives the narrowest block. */
function balanced(text: string, size: number, bold: boolean, measure: Measure): [string, string] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(measure(a, size, bold), measure(b, size, bold));
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return best;
}

/** Main text alone, centred: one line, or two when that prints noticeably larger. */
function layoutMain(main: string, x0: number, y0: number, w: number, h: number, measure: Measure, maxPt = Infinity): TextRun[] {
  const per = Math.max(0.01, measure(main, 1, true));
  const s1 = Math.max(MIN_PT, Math.min(maxPt, (h * 0.78) / PT, w / per));
  const two = balanced(main, 1, true, measure);
  if (two) {
    const pw = Math.max(measure(two[0], 1, true), measure(two[1], 1, true));
    const s2 = Math.min(maxPt, h / (2 * LINE * PT) * 0.95, w / pw);
    if (s2 > s1 * 1.15) {
      const ys = baselines(2, s2, y0, h);
      return two.map((t, i) => ({ text: t, x: x0 + w / 2, y: ys[i], size: s2, bold: true, align: 'center' as const }));
    }
  }
  return [{ text: main, x: x0 + w / 2, y: y0 + h / 2 + (s1 * PT * CAP) / 2, size: s1, bold: true, align: 'center' }];
}

/** Description lines (≤ 2) at the largest size that fits the box, left aligned and centred vertically. */
function layoutSide(side: string, x0: number, y0: number, w: number, h: number, maxPt: number, measure: Measure): TextRun[] {
  const one = Math.min(maxPt, (h * 0.78) / PT, w / Math.max(0.01, measure(side, 1, false)));
  let size = MIN_PT;
  let lines: string[] = [];
  for (let s = Math.min(maxPt, h / (2 * LINE * PT)); s >= MIN_PT; s -= 0.25) {
    const l = wrap(side, w, s, false, measure, 3);
    if (l.length <= 2) { size = s; lines = l; break; }
  }
  if (one >= MIN_PT && one >= size * 0.92) { size = one; lines = [side]; }
  if (!lines.length) { size = MIN_PT; lines = wrap(side, w, MIN_PT, false, measure, 2); }
  const ys = baselines(lines.length, size, y0, h);
  return lines.map((t, i) => ({ text: t, x: x0, y: ys[i], size, bold: false, align: 'left' as const }));
}

function beside(main: string, side: string, lw: number, ih: number, m: number, frac: number, measure: Measure, sideMax: number) {
  const iw = lw - 2 * m;
  const gap = Math.max(0.8, Math.min(2, ih * 0.15));
  const per = Math.max(0.01, measure(main, 1, true));
  const sMain = Math.max(MIN_PT, Math.min((ih * 0.78) / PT, (iw * frac - gap / 2) / per));
  const mainW = Math.min(iw * frac, measure(main, sMain, true));
  const dx = m + mainW + gap;
  const sideRuns = layoutSide(side, dx, m, lw - m - dx, ih, Math.min(sideMax, Math.max(MIN_PT, sMain * 0.75)), measure);
  const runs: TextRun[] = [{ text: main, x: m + mainW / 2, y: m + ih / 2 + (sMain * PT * CAP) / 2, size: sMain, bold: true, align: 'center' }, ...sideRuns];
  // The number does not fit its share even at the smallest size: unusable split.
  const fits = measure(main, sMain, true) <= iw * frac + 0.05;
  return { runs, sMain: fits ? sMain : 0, sSide: sideRuns[0]?.size ?? MIN_PT };
}

/** Number on top, description centred under it (tall labels such as tags and legend plates). */
function stacked(main: string, side: string, lw: number, ih: number, m: number, measure: Measure, sideMax: number) {
  const iw = lw - 2 * m;
  const gap = Math.max(0.6, ih * 0.06);
  const mainH = (ih - gap) * 0.55;
  const top = layoutMain(main, m, m, iw, mainH, measure);
  const sMain = top[0].size;
  const sideRuns = layoutSide(side, m, m + mainH + gap, iw, ih - mainH - gap, Math.min(sideMax, sMain * 0.75), measure)
    .map((r) => ({ ...r, x: m + iw / 2, align: 'center' as const }));
  return { runs: [...top, ...sideRuns], sMain, sSide: sideRuns[0]?.size ?? MIN_PT };
}

/**
 * Number and description in the box. Tries several splits of the width (and a
 * stacked layout on tall labels) and keeps the one where both the number and
 * the description print largest.
 */
function layoutBox(main: string, side: string, lw: number, lh: number, m: number, measure: Measure, mainFrac?: number): TextRun[] {
  const iw = lw - 2 * m, ih = lh - 2 * m;
  if (!side) return layoutMain(main, m, m, iw, ih, measure);
  const sideMax = ((ih * 0.78) / PT) * 0.62;
  if (mainFrac !== undefined) return beside(main, side, lw, ih, m, mainFrac, measure, Math.max(sideMax, MIN_PT)).runs;
  const score = (c: { sMain: number; sSide: number }) => Math.min(c.sMain, c.sSide / 0.6) + c.sMain * 0.02;
  let best = beside(main, side, lw, ih, m, 0.5, measure, sideMax);
  for (let f = 0.2; f <= 0.751; f += 0.05) {
    const c = beside(main, side, lw, ih, m, f, measure, sideMax);
    if (score(c) > score(best)) best = c;
  }
  if (ih >= 7 && lw / lh < 4.5) {
    const c = stacked(main, side, lw, ih, m, measure, sideMax * 1.6);
    if (score(c) * 0.9 > score(best)) best = c;
  }
  // No room for a description beside a long number: print the number alone.
  return best.sMain > 0 ? best.runs : layoutMain(main, m, m, iw, ih, measure);
}

/** Layout of one label for the chosen stock and content. */
export function layoutLabel(label: Label, setup: LabelSetup, measure: Measure): LabelLayout {
  const size = sizeOf(setup);
  const { main, side } = labelText(label, setup.content);
  const tape = Boolean(size.tape) && !setup.tapeLength;
  if (tape) {
    // Continuous tape: text fills the tape width; the length follows the text.
    const lh = size.h;
    const m = margin(100, lh, true);
    const ih = lh - 2 * m;
    const sMain = (ih * 0.78) / PT;
    const mainW = measure(main, sMain, true);
    let lw = mainW + 2 * m;
    let frac: number | undefined;
    if (side) {
      const gap = Math.max(0.8, Math.min(2, ih * 0.15));
      const sSide = Math.min(sMain * 0.62, (ih * 0.78) / PT);
      let sideW = measure(side, sSide, false);
      if (sideW > 70) sideW = Math.max(...wrap(side, sideW / 2 * 1.08, Math.min(sSide, ih / (2 * LINE * PT)), false, measure, 2).map((t) => measure(t, Math.min(sSide, ih / (2 * LINE * PT)), false)));
      lw = mainW + gap + sideW + 2 * m;
      frac = (mainW + gap / 2) / (lw - 2 * m);
    }
    lw = Math.max(15, Math.ceil(lw + 1));
    return { w: lw, h: lh, rotate: false, runs: layoutBox(main, side, lw, lh, m, measure, frac) };
  }
  const w = size.w, h = size.h;
  const rotate = setup.orientation === 'vertical';
  const lw = rotate ? h : w, lhh = rotate ? w : h;
  return { w, h, rotate, runs: layoutBox(main, side, lw, lhh, margin(lw, lhh, false), measure) };
}

/** Labels repeated by their copies count when the setup asks for it. */
export function expandCopies<T extends { copies: number }>(labels: T[], useCopies: boolean): T[] {
  return useCopies ? labels.flatMap((l) => Array.from({ length: Math.max(1, l.copies) }, () => l)) : labels;
}

/** Measure with a canvas (browser preview). */
export function canvasMeasure(): Measure {
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const cache = new Map<string, number>();
  return (text, sizePt, bold) => {
    const k = `${bold ? 'b' : 'n'}${text}`;
    let per = cache.get(k);
    if (per === undefined) {
      if (ctx) {
        ctx.font = `${bold ? 'bold ' : ''}100px Helvetica, Arial, sans-serif`;
        per = ctx.measureText(text).width / 100; // width in ems
      } else per = text.length * 0.55;
      cache.set(k, per);
    }
    return per * sizePt * PT;
  };
}
