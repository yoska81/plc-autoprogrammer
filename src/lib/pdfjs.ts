// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the declaration must also reach the tools/ type check, which does not include src/lib/*.d.ts
/// <reference path="./pdfjsWorker.d.ts" />
/**
 * pdf.js with its worker. In the browser and the Windows app the worker is its own file (a real Worker).
 * The worker starts from pdfjsWorkerShim.ts, which installs pdf.js's polyfills in the worker first.
 * The claude.ai preview is a single page that cannot load a worker file, so there the worker code is
 * bundled and pdf.js runs it on the page ("fake worker" found on globalThis.pdfjsWorker), which needs no
 * extra file.
 */
import { IS_PREVIEW } from '../preview/mode';
import { installPdfPolyfills } from './pdfPolyfills';

export async function loadPdfjs() {
  installPdfPolyfills();
  const pdfjs = await import('pdfjs-dist');
  if (IS_PREVIEW) {
    const g = globalThis as { pdfjsWorker?: unknown };
    if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  } else if (!pdfjs.GlobalWorkerOptions.workerPort && typeof Worker !== 'undefined') {
    // the worker through a shim that installs the same polyfills in the worker first
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdfjsWorkerShim.ts', import.meta.url), { type: 'module' });
  }
  return pdfjs;
}
