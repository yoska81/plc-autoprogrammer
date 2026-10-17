// Generates every deliverable for the example project and the test variants through the running
// dev server (so browser-only parts — canvas pictures, svg2pdf drawings — are real).
// Usage: npm run dev -- --port 5204 &   then   node tools/gen-outputs.cjs [variant ...]
// Output: tools/out/<variant>/ (everything.zip unpacked into zip/, extra DXF options, data.json).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5204';
const OUT = path.join(__dirname, 'out');
const ALL = ['us480', 'ca600', 'us120', 'big', 'analog', 'rules', 'rules-big', 'rules-eu', 'rules-sealing', 'rules-sealing-long', 'rules-stress', 'rules-floor'];
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  let failed = false;
  for (const v of variants) {
    const t0 = Date.now();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + '/');
    await page.waitForLoadState('networkidle');
    const dir = path.join(OUT, v);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    try {
      const files = await page.evaluate(async (variant) => {
        const h = await import('/tools/harness/variants.ts');
        return h.build(variant);
      }, v);
      for (const [name, data] of Object.entries(files)) {
        const p = path.join(dir, name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, Buffer.from(data, 'base64'));
      }
      const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, 'everything.zip')));
      for (const [name, f] of Object.entries(zip.files)) {
        if (f.dir) continue;
        const p = path.join(dir, 'zip', name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, await f.async('nodebuffer'));
      }
      console.log(`${v}: ${Object.keys(files).length} files + ${Object.keys(zip.files).length} zip entries in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) {
      failed = true;
      console.log(`${v}: FAILED ${e}`);
    }
    if (errors.length) console.log(`${v}: browser errors:\n  ` + errors.slice(0, 10).join('\n  '));
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
