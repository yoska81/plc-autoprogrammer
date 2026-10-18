/**
 * A picture of the place a reading came from, next to each review item: the sheet its "source" names
 * ("sheet 3, column 4", "page 2", "第3页"), cut to the column when one is given. Drawn from the files
 * still open in this session (they are not kept with the project): a PDF page through pdf.js, a DXF sheet
 * from its border frame, or the n-th image.
 */
import { create } from 'zustand';
import { useProjectsStore } from '../store/useProjectsStore';
import { loadPdfjs } from '../lib/pdfjs';
import { parseDxfEntities, sheetFrames, sheetNumber, type CadEntity, type DxfText } from './dxf';

/** Files chosen for upload, per project and in memory only: they never follow the user into another project. */
export const useUploadFiles = create<{ byProject: Record<string, File[]>; set: (projectId: string, files: File[]) => void }>((set) => ({
  byProject: {},
  set: (projectId, files) => set((s) => ({ byProject: { ...s.byProject, [projectId]: files } })),
}));
export const NO_FILES: File[] = [];
export const useProjectUploads = () => {
  const projectId = useProjectsStore((s) => s.activeId);
  return useUploadFiles((s) => (projectId ? s.byProject[projectId] : undefined)) ?? NO_FILES;
};

export interface SourceRef { sheet: number; column: number | null }

/** The sheet (page) and column a source names, or null when it names no sheet (e.g. "parts list, row 5"). */
export function parseSource(source: string): SourceRef | null {
  const sheet = source.match(/(?:sheet|page|sh\.?|p\.)\s*(\d+)/i) ?? source.match(/第\s*(\d+)\s*页/) ?? source.match(/\/(\d+)\.\d+/);
  if (!sheet) return null;
  const col = source.match(/col(?:umn)?\.?\s*(\d+)/i) ?? source.match(/\/\d+\.(\d+)/);
  return { sheet: Number(sheet[1]), column: col ? Number(col[1]) : null };
}

/** Left and right edge (0–1) of a column's strip: the column with half a column either side; 8 columns unless the drawing has more. */
export function columnCrop(column: number | null): { left: number; right: number } | null {
  if (!column) return null;
  const cols = Math.max(8, column);
  return { left: Math.max(0, (column - 1.5) / cols), right: Math.min(1, (column + 0.5) / cols) };
}

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

const cache = new Map<string, Promise<string | null>>();

/** A picture of sheet n from the uploaded files (data URL), or null when no file has it. */
export function sheetPicture(files: File[], sheet: number): Promise<string | null> {
  const key = `${files.map((f) => `${f.name}:${f.size}`).join('|')}#${sheet}`;
  if (!cache.has(key)) cache.set(key, findSheet(files, sheet).catch(() => null));
  return cache.get(key)!;
}

async function findSheet(files: File[], sheet: number): Promise<string | null> {
  // a CAD sheet that carries this number in its title block
  for (const f of files.filter((x) => /\.dxf$/i.test(x.name))) {
    const ents = parseDxfEntities(await f.text());
    const frames = sheetFrames(ents);
    const texts = ents.filter((e): e is DxfText => 'text' in e);
    const numbered = frames.map((fr, i) => ({ fr, n: sheetNumber(texts.filter((t) => t.x >= fr.x1 && t.x <= fr.x2 && t.y >= fr.y1 && t.y <= fr.y2))?.n ?? i + 1 }));
    const hit = numbered.find((x) => x.n === sheet) ?? (frames.length === 0 && sheet === 1 ? { fr: bounds(ents) } : null);
    if (hit) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dxfSheetSvg(ents, hit.fr))}`;
  }
  // a PDF with that many pages
  for (const f of files.filter((x) => /\.pdf$/i.test(x.name) || x.type === 'application/pdf')) {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    if (doc.numPages < sheet) continue;
    const page = await doc.getPage(sheet);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1200 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    return canvas.toDataURL('image/png');
  }
  // the n-th picture
  const images = files.filter((x) => x.type.startsWith('image/'));
  const img = images[sheet - 1];
  return img ? URL.createObjectURL(img) : null;
}

function bounds(ents: CadEntity[]) {
  const pts = ents.flatMap((e) => ('points' in e ? e.points : [[e.x, e.y] as [number, number]]));
  return { x1: Math.min(...pts.map((p) => p[0])), y1: Math.min(...pts.map((p) => p[1])), x2: Math.max(...pts.map((p) => p[0])), y2: Math.max(...pts.map((p) => p[1])) };
}
