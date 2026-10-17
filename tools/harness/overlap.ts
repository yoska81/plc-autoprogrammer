/**
 * Text overlap audit of the drawing set (tools/check_overlap.cjs): renders every sheet of a variant
 * like the PDF export does, takes the box of every text (getBBox mapped to sheet millimetres,
 * trimmed to the glyphs) and every stroked line, and reports text on text and lines running through
 * text.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import DrawingSet from '../../src/electrical/drawings/DrawingSet';
import { planDrawings } from '../../src/electrical/drawings/plan';
import { SHEET_H, SHEET_W } from '../../src/electrical/drawings/geometry';
import { collectProject } from '../../src/deliverables/collect';
import { setup } from './variants';

type Box = { x0: number; y0: number; x1: number; y1: number };
type Seg = [number, number, number, number];
export interface TextHit { a: string; b: string; area: number; at: [number, number] }
export interface LineHit { text: string; len: number; at: [number, number] }
export interface SheetReport { n: number; title: string; texts: number; tt: TextHit[]; tl: LineHit[] }

/** Ink part of a text box: the line box minus the space above the capitals and below the descenders. */
function inkBox(t: SVGTextElement, toRoot: DOMMatrix): { box: Box; vertical: boolean } {
  const b = t.getBBox();
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(toRoot));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const vertical = Math.abs(toRoot.b) > Math.abs(toRoot.a);
  // getBBox spans the font's full line height (~1.15 em); the glyphs sit in about its middle 70 %
  const trim = 0.15;
  if (vertical) { const d = (box.x1 - box.x0) * trim; box.x0 += d; box.x1 -= d; } else { const d = (box.y1 - box.y0) * trim; box.y0 += d; box.y1 -= d; }
  // and a hair off the ends (side bearings)
  const e = 0.1;
  if (vertical) { box.y0 += e; box.y1 -= e; } else { box.x0 += e; box.x1 -= e; }
  return { box, vertical };
}

const filled = (el: Element) => {
  const cs = getComputedStyle(el);
  return cs.fill !== 'none' && !/rgba\(\d+,\s*\d+,\s*\d+,\s*0\)/.test(cs.fill) && parseFloat(cs.fillOpacity || '1') > 0.5 && parseFloat(cs.opacity || '1') > 0.5;
};

const stroked = (el: Element) => {
  const cs = getComputedStyle(el);
  return cs.stroke !== 'none' && cs.stroke !== '' && parseFloat(cs.strokeWidth || '0') > 0 && cs.visibility !== 'hidden' && cs.strokeOpacity !== '0';
};

function segments(el: SVGGraphicsElement, toRoot: DOMMatrix): Seg[] {
  const P = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(toRoot);
  const line = (pts: DOMPoint[], closed: boolean): Seg[] => {
    const out: Seg[] = [];
    for (let i = 0; i < pts.length - 1; i++) out.push([pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y]);
    if (closed && pts.length > 2) out.push([pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y]);
    return out;
  };
  const tag = el.tagName.toLowerCase();
  if (tag === 'line') { const l = el as SVGLineElement; return line([P(l.x1.baseVal.value, l.y1.baseVal.value), P(l.x2.baseVal.value, l.y2.baseVal.value)], false); }
  if (tag === 'rect') { const r = el as SVGRectElement; const x = r.x.baseVal.value, y = r.y.baseVal.value, w = r.width.baseVal.value, h = r.height.baseVal.value; return line([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], true); }
  if (tag === 'polyline' || tag === 'polygon') { const pl = el as SVGPolylineElement; return line([...pl.points].map((p) => P(p.x, p.y)), tag === 'polygon'); }
  if (tag === 'path' || tag === 'circle' || tag === 'ellipse') {
    const g = el as SVGGeometryElement;
    const len = g.getTotalLength();
    if (!len) return [];
    const n = Math.min(400, Math.max(8, Math.ceil(len / 0.4)));
    const pts: DOMPoint[] = [];
    for (let i = 0; i <= n; i++) { const q = g.getPointAtLength((len * i) / n); pts.push(P(q.x, q.y)); }
    // a path with move-to gaps would draw false joins: drop segments much longer than the step
    return line(pts, false).filter(([a, b, c, d]) => Math.hypot(c - a, d - b) < (len / n) * 3);
  }
  return [];
}

/** Length of a segment inside a box (Liang–Barsky clip). */
function inside(s: Seg, b: Box): number {
  let [x0, y0, x1, y1] = s;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x0 - b.x0], [dx, b.x1 - x0], [-dy, y0 - b.y0], [dy, b.y1 - y0]] as [number, number][]) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
  }
  [x0, y0, x1, y1] = [s[0] + dx * t0, s[1] + dy * t0, s[0] + dx * t1, s[1] + dy * t1];
  return Math.hypot(x1 - x0, y1 - y0);
}

export async function measureOverlaps(variant: Parameters<typeof setup>[0], opts: { minArea?: number; minLen?: number } = {}): Promise<SheetReport[]> {
  const minArea = opts.minArea ?? 0.5, minLen = opts.minLen ?? 1.0;
  await setup(variant);
  const p = collectProject();
  if (!p.drawingCtx) return [];
  const plan = planDrawings(p.drawingCtx);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1700px;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(DrawingSet, { ctx: p.drawingCtx, printMode: true }));
  await new Promise((r) => setTimeout(r, 600));
  await document.fonts?.ready;
  const svgs = [...host.querySelectorAll<SVGSVGElement>(`svg[viewBox="0 0 ${SHEET_W} ${SHEET_H}"]`)];
  const out: SheetReport[] = [];
  svgs.forEach((svg, i) => {
    const rootInv = svg.getScreenCTM()!.inverse();
    const toRoot = (el: SVGGraphicsElement) => rootInv.multiply(el.getScreenCTM()!);
    const texts = [...svg.querySelectorAll<SVGTextElement>('text')].filter((t) => (t.textContent ?? '').trim()).map((t) => ({ t, s: t.textContent!.trim(), ...inkBox(t, toRoot(t)) }))
      .filter((x) => x.box.x1 > x.box.x0 && x.box.y1 > x.box.y0);
    // Lines in drawing order, and the filled shapes that may hide them (a line under a white device box is not seen).
    const segs: { s: Seg; order: number }[] = [];
    const fills: { box: Box; order: number }[] = [];
    let order = 0;
    const orderOf = new Map<Element, number>();
    for (const el of svg.querySelectorAll<SVGGraphicsElement>('line, rect, polyline, polygon, path, circle, ellipse, text')) {
      orderOf.set(el, order++);
      if (el.tagName.toLowerCase() === 'text' || el.closest('text, defs, clipPath, mask')) continue;
      const o = orderOf.get(el)!;
      if (stroked(el)) for (const s of segments(el, toRoot(el))) segs.push({ s, order: o });
      if (filled(el) && el.tagName.toLowerCase() !== 'line') {
        const b = el.getBBox(), m = toRoot(el);
        const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
        fills.push({ order: o, box: { x0: Math.min(...pts.map((q) => q.x)), y0: Math.min(...pts.map((q) => q.y)), x1: Math.max(...pts.map((q) => q.x)), y1: Math.max(...pts.map((q) => q.y)) } });
      }
    }
    const hidden = (lineOrder: number, b: Box) => fills.some((f) => f.order > lineOrder && f.box.x0 <= b.x0 + 0.05 && f.box.y0 <= b.y0 + 0.05 && f.box.x1 >= b.x1 - 0.05 && f.box.y1 >= b.y1 - 0.05);
    const tt: TextHit[] = [];
    for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
      const A = texts[a].box, B = texts[b].box;
      const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), h = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (w > 0 && h > 0 && w * h >= minArea) tt.push({ a: texts[a].s, b: texts[b].s, area: +(w * h).toFixed(2), at: [+Math.max(A.x0, B.x0).toFixed(1), +Math.max(A.y0, B.y0).toFixed(1)] });
    }
    const tl: LineHit[] = [];
    for (const x of texts) {
      let worst = 0;
      for (const { s, order: o } of segs) { const l = inside(s, x.box); if (l > worst && !hidden(o, x.box)) worst = l; }
      if (worst >= minLen) tl.push({ text: x.s, len: +worst.toFixed(2), at: [+x.box.x0.toFixed(1), +x.box.y0.toFixed(1)] });
    }
    const sh = plan.sheets[i];
    out.push({ n: sh?.n ?? i + 1, title: sh?.title ?? '', texts: texts.length, tt, tl });
  });
  root.unmount();
  host.remove();
  return out;
}
