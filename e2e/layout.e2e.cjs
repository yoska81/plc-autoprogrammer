// Machine layout: set the scale, place the cabinet, a motor and two cylinders, draw a cable tray,
// see the routed lengths in the cable schedule, accept the junction box and manifold suggestions,
// and find the manifold in the BOM as "part to be selected". Uses the example project (dev build).
//
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/layout.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-layout/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await import('/src/preview/sampleProject.ts');
    const ps = await import('/src/store/useProjectsStore.ts');
    localStorage.clear();
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
  });
  await page.goto(BASE + '/electrical?tab=layout');
  const canvas = page.getByTestId('layout-canvas');
  await canvas.waitFor();

  /** Click at layout (canvas) units. */
  const at = async (x, y, opts) => {
    const p = await canvas.evaluate((svg, [x, y]) => { const q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [x, y]);
    await page.mouse.click(p[0], p[1], opts);
  };
  const cables = async () => Object.fromEntries((await page.getByTestId('layout-cables').locator('tbody tr').evaluateAll((rows) => rows.map((r) => [...r.cells].map((c) => c.textContent))))
    .map((c) => [c[2], c[3]]));

  // 1. scale: 1000 units = 10 m
  await page.getByRole('button', { name: 'Set scale' }).click();
  await at(100, 900); await at(1100, 900);
  await page.getByLabel('Scale distance').fill('10');
  await page.getByLabel('Scale unit').selectOption('m');
  await page.getByRole('button', { name: 'Apply' }).click();
  const scale = await page.getByTestId('layout-scale').innerText();
  log('Scale:', scale);
  check(/10 m = 1000 units/.test(scale) && /16\.0 m × 10\.0 m/.test(scale), 'scale set (sheet 16 x 10 m)');

  // 2. place cabinet, motor and the two cylinder valves
  const placeTag = async (label, x, y) => { await page.getByTestId('layout-palette').getByRole('button', { name: new RegExp(`^${label}\\b`) }).click(); await at(x, y); };
  await placeTag('Cabinet', 100, 800);
  await placeTag('M1', 700, 600);
  await placeTag('SOL1', 1300, 600);
  await placeTag('SOL2', 1350, 650);
  check(await canvas.locator('[data-tag="SOL2"]').count() === 1, 'SOL2 placed');

  // 3. a cable tray along y = 700
  await page.getByRole('button', { name: 'Draw route' }).click();
  await at(100, 700); await at(1400, 700);
  await page.getByRole('button', { name: 'Finish route' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  let c = await cables();
  log('Lengths:', JSON.stringify(c));
  // M1: cabinet (1,8) -> tray y=7 (1 m) -> x 1..7 (6 m) -> drop to (7,6) (1 m) = 8 m; +10 % + 2 x 1 m = 10.8 m
  check(c.M1 === '10.8 m (35 ft)', 'motor cable routed length with service allowance');
  check(c.SOL1 === 'BY SITE', 'device cables wait for JB1');

  // 4. suggestions: place JB1 at its devices, then the manifold
  const sug = page.getByTestId('layout-suggestions');
  const jb = sug.locator('[data-suggestion="jb-move"]').first();
  await jb.waitFor();
  log('JB suggestion:', (await jb.innerText()).split('\n')[0]);
  await jb.getByRole('button', { name: 'Accept' }).click();
  const mf = sug.locator('[data-suggestion="manifold"]').first();
  await mf.waitFor();
  const mfText = await mf.innerText();
  log('Manifold suggestion:', mfText.split('\n')[0]);
  check(/SOL1, SOL2/.test(mfText) && /part to be selected/.test(mfText), 'manifold suggestion for SOL1 + SOL2');
  await mf.getByRole('button', { name: 'Accept' }).click();
  check(await canvas.locator('[data-tag="MV1"]').count() === 1, 'manifold MV1 on the layout');
  c = await cables();
  log('Lengths after JB1 + MV1:', JSON.stringify(c));
  check(c.SOL1 !== 'BY SITE' && c.SOL1 === c.SOL2 && c.JB1 !== 'BY SITE', 'valve cables to the manifold, trunk to JB1');
  check(await page.getByTestId('layout-cable-totals').locator('tbody tr').count() >= 2, 'cable totals per type');
  await page.screenshot({ path: OUT + '01_layout.png' });

  // 5. cable schedule CSV carries the lengths; the BOM lists the manifold without a part number
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Cable schedule CSV' }).click()]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  check(csvText.includes('10.8 m (35 ft)'), 'cable schedule CSV has the routed length');
  const [bom] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'BOM CSV' }).click()]);
  const bomText = fs.readFileSync(await bom.path(), 'utf8');
  check(/Valve manifold MV1: 2 stations.*part to be selected/.test(bomText), 'BOM lists the manifold as part to be selected');

  // 6. persisted per project: reload keeps it
  await page.reload();
  await canvas.waitFor();
  check(await canvas.locator('[data-tag="MV1"]').count() === 1 && (await cables()).M1 === '10.8 m (35 ft)', 'layout kept after reload');

  // 7. the drawing set has a machine layout sheet
  await page.goto(BASE + '/electrical?tab=machine');
  const sheetItem = page.locator('nav[aria-label="Drawing sheets"]').getByRole('button', { name: /MACHINE LAYOUT/ });
  await sheetItem.waitFor();
  await sheetItem.click();
  await page.getByText(/MACHINE LAYOUT — CABINET, JUNCTION BOXES/).first().waitFor();
  await page.screenshot({ path: OUT + '02_machine_sheets.png' });

  check(!errors.length, 'no page errors: ' + errors.join(' | '));
  log('OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
