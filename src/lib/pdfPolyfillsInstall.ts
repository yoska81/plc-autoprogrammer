/** Installs pdf.js's polyfills when imported (imported first by pdfjsWorkerShim.ts). */
import { installPdfPolyfills } from './pdfPolyfills';

installPdfPolyfills();
