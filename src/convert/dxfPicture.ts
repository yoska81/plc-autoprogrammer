import { sheetFrames, sheetNumber, type CadEntity, type DxfText } from './dxf';

/** Pictures of DXF sheets for the review (pure: also runs in the parse worker, src/workers/). */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One DXF sheet (inside its frame) as an SVG picture. */
export function dxfSheetSvg(entities: CadEntity[], frame: { x1: number; y1: number; x2: number; y2: number }): string {
  const w = frame.x2 - frame.x1, h = frame.y2 - frame.y1;
  const X = (x: number) => (x - frame.x1).toFixed(1), Y = (y: number) => (frame.y2 - y).toFixed(1);
  const inF = (x: number, y: number) => x >= frame.x1 - 0.5 && x <= frame.x2 + 0.5 && y >= frame.y1 - 0.5 && y <= frame.y2 + 0.5;
  const fs = (h / 70).toFixed(1);
  const out: string[] = [];
  for (const e of entities) {
    if (e.type === 'LINE' || e.type === 'LWPOLYLINE') {
      if (!e.points.some(([x, y]) => inF(x, y))) continue;
      const pts = [...e.points, ...(e.type === 'LWPOLYLINE' && e.closed ? [e.points[0]] : [])];
      out.push(`<polyline points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`);
    } else if (inF(e.x, e.y)) {
      out.push(`<text x="${X(e.x)}" y="${Y(e.y)}">${esc((e as DxfText).text)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="1200" height="${(1200 * h / w).toFixed(0)}"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="#333" stroke-width="${(w / 1200).toFixed(2)}">${out.filter((x) => x.startsWith('<poly')).join('')}</g><g font-size="${fs}" font-family="sans-serif" fill="#111">${out.filter((x) => x.startsWith('<text')).join('')}</g></svg>`;
}

/** The SVG of sheet n of a parsed DXF: the frame whose title block carries that number (else the n-th frame); a frameless drawing is sheet 1. */
export function dxfSheetPicture(ents: CadEntity[], sheet: number): string | null {
  const frames = sheetFrames(ents);
  const texts = ents.filter((e): e is DxfText => 'text' in e);
  const numbered = frames.map((fr, i) => ({ fr, n: sheetNumber(texts.filter((t) => t.x >= fr.x1 && t.x <= fr.x2 && t.y >= fr.y1 && t.y <= fr.y2))?.n ?? i + 1 }));
  const hit = numbered.find((x) => x.n === sheet) ?? (frames.length === 0 && sheet === 1 && ents.length ? { fr: bounds(ents) } : null);
  return hit ? dxfSheetSvg(ents, hit.fr) : null;
}

function bounds(ents: CadEntity[]) {
  const pts = ents.flatMap((e) => ('points' in e ? e.points : [[e.x, e.y] as [number, number]]));
  return { x1: Math.min(...pts.map((p) => p[0])), y1: Math.min(...pts.map((p) => p[1])), x2: Math.max(...pts.map((p) => p[0])), y2: Math.max(...pts.map((p) => p[1])) };
}
