// Copies the pdf.js files the desktop print window needs into electron/vendor/pdfjs.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const out = path.join(__dirname, '..', 'electron', 'vendor', 'pdfjs');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(src, f), path.join(out, f));
console.log('pdf.js copied to', path.relative(process.cwd(), out));
