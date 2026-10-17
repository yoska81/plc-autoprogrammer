/**
 * pdf.js with its worker. In the browser and the Windows app the worker is its own file (a real Worker).
 * The claude.ai preview is a single page that cannot load a worker file, so there the worker code is
 * bundled and pdf.js runs it on the page ("fake worker" found on globalThis.pdfjsWorker), which needs no
 * extra file.
 */
import { IS_PREVIEW } from '../preview/mode';

/** pdf.js 5 calls Map / WeakMap getOrInsert(Computed) (a 2026 addition most browsers don't have yet). */
function polyfillGetOrInsert() {
  for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    const proto = C.prototype as unknown as {
      has(k: unknown): boolean; get(k: unknown): unknown; set(k: unknown, v: unknown): unknown;
      getOrInsert?: (k: unknown, v: unknown) => unknown; getOrInsertComputed?: (k: unknown, f: (k: unknown) => unknown) => unknown;
    };
    if (!proto.getOrInsert) Object.defineProperty(proto, 'getOrInsert', { configurable: true, writable: true, value(this: typeof proto, k: unknown, v: unknown) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
    if (!proto.getOrInsertComputed) Object.defineProperty(proto, 'getOrInsertComputed', { configurable: true, writable: true, value(this: typeof proto, k: unknown, f: (k: unknown) => unknown) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
  }
}

export async function loadPdfjs() {
  polyfillGetOrInsert();
  const pdfjs = await import('pdfjs-dist');
  if (IS_PREVIEW) {
    const g = globalThis as { pdfjsWorker?: unknown };
    if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  } else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  return pdfjs;
}
