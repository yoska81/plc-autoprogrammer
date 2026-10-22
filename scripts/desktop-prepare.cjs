// Copies the pdf.js files the desktop print window needs into electron/vendor/pdfjs.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const out = path.join(__dirname, '..', 'electron', 'vendor', 'pdfjs');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(src, f), path.join(out, f));
console.log('pdf.js copied to', path.relative(process.cwd(), out));

// electron-updater as one file (electron/vendor/electron-updater.cjs): the installer ships no node_modules
// (package.json build.files), so the updater and its dependencies are bundled; 'electron' stays the app's own.
(async () => {
  const { build } = await import('rolldown');
  const file = path.join(__dirname, '..', 'electron', 'vendor', 'electron-updater.cjs');
  await build({
    input: require.resolve('electron-updater'),
    platform: 'node',
    external: ['electron'],
    logLevel: 'warn',
    output: { file, format: 'cjs', codeSplitting: false },
  });
  console.log('electron-updater bundled to', path.relative(process.cwd(), file));
})().catch((e) => { console.error(e); process.exit(1); });
