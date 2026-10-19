// A machine without a touch panel (equipment chosen with "No touch panel") on the example project,
// whose screens for the earlier panel are still in the store: the HMI page shows a clear "no touch
// panel" state with the operator station and no screens; the simulator shows no HMI; the Export
// page has no HMI files; the engineering package and the Excel report describe the operator station.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-no-panel.e2e.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const JSZip = require(path.join(__dirname, '..', 'node_modules', 'jszip'));
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-hmi-no-panel');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // "No touch panel" chosen: the panel is cleared, the screens made for it stay in the store.
  const screensBefore = await page.evaluate(async () => {
    const { useStageStore } = await appImport('/src/store/useStageStore.ts');
    const { useSpecStore } = await appImport('/src/store/useSpecStore.ts');
    const { setProjectPanel } = await appImport('/src/hmi/retarget.ts');
    const { useHmiStore } = await appImport('/src/store/useHmiStore.ts');
    if (!useStageStore.getState().sources.equipment) useStageStore.getState().markGenerated('equipment', { specFp: '', spec: useSpecStore.getState().sections });
    setProjectPanel('');
    return useHmiStore.getState().design.screens.length;
  });

  // HMI page: the "no touch panel" state, the operator station, the earlier screens not shown.
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(800);
  const note = page.getByTestId('no-hmi');
  check(await note.isVisible(), 'HMI page: "This machine has no touch panel"');
  const stationRows = await page.getByTestId('operator-station').locator('tr').count();
  log(`Operator station on the HMI page: ${stationRows} devices`);
  check(stationRows >= 3, `operator station listed (${stationRows} devices)`);
  check(/kept but not used or exported/.test(await page.getByTestId('hmi-leftover').innerText()), `the ${screensBefore} earlier screens are reported as unused`);
  check(await page.locator('svg[aria-label^="HMI screen:"]').count() === 0, 'no HMI screens drawn');
  check(await page.getByRole('button', { name: /Design the HMI screens|Redesign screens|Update screens/ }).count() === 0, 'no screen design buttons');
  await page.screenshot({ path: path.join(OUT, '01_hmi_page.png') });

  // Simulator: no HMI pane.
  await page.goto(BASE + '/simulate');
  await page.waitForTimeout(800);
  check(await page.getByRole('heading', { name: 'HMI (live)' }).count() === 0, 'simulator: no live HMI');

  // Export page: no HMI files; the engineering package and the Excel report describe the operator station.
  await page.goto(BASE + '/export');
  await page.waitForTimeout(500);
  check(await page.getByTestId('export-no-hmi').waitFor({ timeout: 15000 }).then(() => true, () => false), 'Export: "no touch panel, so there are no HMI files"');
  check(await page.getByRole('button', { name: 'HMI screens PDF', exact: true }).count() === 0, 'Export: no HMI screens PDF button');
  const [eng] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.getByRole('button', { name: 'Engineering package', exact: true }).click()]);
  const engPath = path.join(OUT, eng.suggestedFilename());
  await eng.saveAs(engPath);
  const pdfText = await page.evaluate(async (b64) => {
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs').catch(() => null);
    if (!pdfjs) return null;
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
    let t = '';
    for (let i = 1; i <= doc.numPages; i++) t += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + '\n';
    return t;
  }, fs.readFileSync(engPath).toString('base64'));
  const raw = pdfText ?? fs.readFileSync(engPath, 'latin1');
  check(/Operator station/.test(raw), 'engineering package: "Operator station" chapter');
  check(!/HMI description/.test(raw) && !/HMI screens/.test(raw), 'engineering package: no HMI chapter or screens');
  log(`Engineering package: ${(fs.statSync(engPath).size / 1024).toFixed(0)} KB${pdfText ? '' : ' (text checked in the raw file)'}`);

  const [xl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.getByRole('button', { name: 'Excel report', exact: true }).click()]);
  const xlPath = path.join(OUT, xl.suggestedFilename());
  await xl.saveAs(xlPath);
  const sheets = Object.keys((await JSZip.loadAsync(fs.readFileSync(xlPath))).files).filter((n) => /^xl\/worksheets\/sheet/.test(n)).length;
  const wbXml = await (await JSZip.loadAsync(fs.readFileSync(xlPath))).file('xl/workbook.xml').async('string');
  const names = [...wbXml.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
  log(`Excel report: ${sheets} sheets: ${names.join(', ')}`);
  check(names.includes('Operator Station'), 'Excel: "Operator Station" sheet');
  check(!names.some((n) => /^HMI /.test(n)), 'Excel: no HMI sheets');

  // "Remove them" drops the earlier screens; "Add a touch panel after all" opens the panel chooser.
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Remove them' }).click();
  check(await page.evaluate(async () => (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState().design) === null, 'earlier screens removed');
  check(await page.getByTestId('hmi-leftover').count() === 0, 'no leftover note after removing');
  await page.getByRole('button', { name: /Add a touch panel after all/ }).click();
  check(await page.getByRole('heading', { name: 'Which HMI are you using?' }).isVisible(), 'panel chooser opens');

  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
  console.log('hmi-no-panel e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
