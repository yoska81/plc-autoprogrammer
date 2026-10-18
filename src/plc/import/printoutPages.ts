/**
 * The pages of a printout as images: PDF pages rendered with pdf.js, photos / screenshots downscaled. The
 * AI reads them in batches (a large PDF would exceed what one request can take) and the review shows the
 * page each rung was read from. Browser only.
 */
import { loadPdfjs } from '../../lib/pdfjs';

export interface PrintoutPage {
  /** 1-based, across the files in order. */
  number: number;
  file: string;
  /** JPEG, base64 (no data: prefix). */
  data: string;
}

/** Most pages read from one printout (a few hundred rungs); split bigger programs into parts. */
export const MAX_PAGES = 120;
/** Pages per AI request. */
export const PAGES_PER_REQUEST = 20;
const MAX_EDGE = 1800;

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<string> {
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image conversion failed'))), 'image/jpeg', 0.85));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function printoutPages(files: File[], onProgress?: (done: number) => void): Promise<PrintoutPage[]> {
  const pages: PrintoutPage[] = [];
  for (const file of files) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      if (pages.length + doc.numPages > MAX_PAGES) throw new Error(`The printout has ${pages.length + doc.numPages} pages; the app reads up to ${MAX_PAGES} at a time. Print the program in parts (a few routines per PDF) and read them one after the other.`);
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(3, MAX_EDGE / Math.max(base.width, base.height)) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        pages.push({ number: pages.length + 1, file: file.name, data: await canvasJpeg(canvas) });
        onProgress?.(pages.length);
      }
    } else if (file.type.startsWith('image/')) {
      if (pages.length + 1 > MAX_PAGES) throw new Error(`More than ${MAX_PAGES} pages: read the program in parts.`);
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      pages.push({ number: pages.length + 1, file: file.name, data: await canvasJpeg(canvas) });
      onProgress?.(pages.length);
    } else throw new Error(`${file.name}: choose PDF or image files.`);
  }
  return pages;
}
