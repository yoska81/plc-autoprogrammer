// Siemens programs go to TIA Portal as ladder: on the example project switched to an S7-1200, the Deliverables page
// offers the LAD blocks as one ZIP first (the SCL text stays as an option), and the ZIP holds the global DB, the
// block FCs, OB "Main", the SCL helpers and a README with the Version control interface steps.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/siemens-lad.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })).newPage();
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async () => {
    const [{ withIoRemap }, { useProjectStore }] = await Promise.all([import('/src/plc/core/ioChange.ts'), import('/src/store/useProjectStore.ts')]);
    withIoRemap(() => useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0'), 'PLC change');
  });
  await page.goto(BASE + '/export');
  const lad = page.getByRole('button', { name: /_TIA_LAD\.zip/ });
  await lad.waitFor();
  const labels = await page.getByRole('button').allInnerTexts();
  const iLad = labels.findIndex((t) => /_TIA_LAD\.zip/.test(t)), iScl = labels.findIndex((t) => /_s7\.scl/.test(t));
  check(iLad >= 0 && iScl > iLad, `the LAD ZIP first, the SCL text as an option (${labels.filter((t) => /TIA_LAD|_s7\.scl|\.sdf/.test(t)).join(' | ')})`);
  const [dl] = await Promise.all([page.waitForEvent('download'), lad.click()]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const versions = ['V16', 'V17', 'V18', 'V19', 'V20'];
  check(versions.every((v) => names.some((n) => n.endsWith(`_TIA_LAD/${v}/Machine_DB.xml`)) && names.some((n) => n.endsWith(`_TIA_LAD/${v}/Main.xml`))), `a folder per TIA Portal version with the DB and OB Main (${names.length} files)`);
  check(names.filter((n) => /\/V17\/.*\.xml$/.test(n)).length >= 4, 'one file per block');
  const main = await zip.file(names.find((n) => /\/V20\/Main\.xml$/.test(n))).async('string');
  check(/<Engineering version="V20" \/>/.test(main) && /<SW\.Blocks\.OB /.test(main) && /<ProgrammingLanguage>LAD<\/ProgrammingLanguage>/.test(main), 'OB Main in LAD, for V20 in the V20 folder');
  const top = await zip.file(names.find((n) => /_TIA_LAD\/README\.txt$/.test(n))).async('string');
  check(/folder of YOUR TIA Portal version/.test(top), 'the top README says which folder to take');
  const readme = await zip.file(names.find((n) => /\/V16\/README\.txt$/.test(n))).async('string');
  check(/Version control interface/.test(readme) && /PLC tags first/.test(readme) && /Openness/.test(readme), 'each version\'s README says how to get the blocks in');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`siemens-lad e2e: ${fails.length} failed`); process.exit(1); }
  console.log('siemens-lad e2e passed');
})();
