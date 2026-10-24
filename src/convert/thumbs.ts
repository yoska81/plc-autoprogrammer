/**
 * A picture of the place a reading came from, next to each review item: the sheet its "source" names
 * ("sheet 3, column 4", "page 2", "第3页"), cut to the column when one is given. Drawn from the files
 * still open in this session (they are not kept with the project): a PDF page through pdf.js, a DXF sheet
 * from its border frame, or the n-th image.
 */
import { create } from 'zustand';
import { useProjectsStore } from '../store/useProjectsStore';
import { loadPdfjs } from '../lib/pdfjs';
import { dxfSheet } from '../lib/parseWorker';
export { dxfSheetSvg } from './dxfPicture';

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

const cache = new Map<string, Promise<string | null>>();
// an opened PDF per file: every sheet picture of it reuses the document
const pdfDocs = new Map<string, Promise<{ numPages: number; getPage: (n: number) => Promise<PdfPage> }>>();
type PdfPage = { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } };
function pdfDoc(f: File) {
  const key = `${f.name}|${f.size}|${f.lastModified}`;
  if (!pdfDocs.has(key)) pdfDocs.set(key, (async () => (await loadPdfjs()).getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise as unknown as Promise<{ numPages: number; getPage: (n: number) => Promise<PdfPage> }>)());
  return pdfDocs.get(key)!;
}

/** A picture of sheet n from the uploaded files (data URL), or null when no file has it. */
export function sheetPicture(files: File[], sheet: number): Promise<string | null> {
  const key = `${files.map((f) => `${f.name}:${f.size}`).join('|')}#${sheet}`;
  if (!cache.has(key)) cache.set(key, findSheet(files, sheet).catch(() => null));
  return cache.get(key)!;
}

async function findSheet(files: File[], sheet: number): Promise<string | null> {
  // a CAD sheet that carries this number in its title block (parsed once per file, off the main thread)
  for (const f of files.filter((x) => /\.dxf$/i.test(x.name))) {
    const svg = await dxfSheet(f, sheet);
    if (svg) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  // a PDF with that many pages
  for (const f of files.filter((x) => /\.pdf$/i.test(x.name) || x.type === 'application/pdf')) {
    const doc = await pdfDoc(f);
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
