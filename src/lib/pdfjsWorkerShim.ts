/** pdf.js's worker with the polyfills it needs installed first, in the worker's own global scope (imports run in order). */
import './pdfPolyfillsInstall';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
