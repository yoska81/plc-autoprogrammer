// HMI page on a Siemens project: the tag and alarm lists give the PLC's own address (%I0.0 / %Q0.0 for I/O,
// "Machine_DB".… for memory) with the app's address small below it, and the Diagnostics screen names the I/O
// the S7 way (%I0.0 …). CLICK stays as it is (X001, C1001).
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-native-address.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // CLICK: the app's addresses, as before.
  await page.goto(BASE + '/hmi');
  await page.locator('th', { hasText: /^Address$/i }).first().waitFor({ timeout: 15000 });
  const clickCells = await page.locator('table tbody tr td:first-child').allInnerTexts();
  log('CLICK first cells:', clickCells.slice(0, 4).join(' | '));
  check(clickCells.some((c) => /^X0\d\d$/.test(c.trim())) || clickCells.some((c) => /^C1\d{3}$/.test(c.trim())), 'CLICK keeps X001 / C1001');

  // Siemens S7-1200: switch the PLC, then build the program and redesign the screens for it.
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/store/useProjectStore.ts');
    useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
    useProjectStore.setState({ modules: [] });
  });
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Build', exact: true }).click().catch(() => {});
  await page.getByRole('button', { name: 'Build program from my project' }).click();
  await page.waitForTimeout(2500);
  await page.goto(BASE + '/hmi');
  await page.getByRole('button', { name: 'Redesign screens' }).click();
  await page.waitForFunction(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return Boolean(d?.screens.some((s) => s.elements.some((e) => /%I0\.0/.test(e.label ?? ''))));
  }, null, { timeout: 30000 }).catch(() => {});
  await page.locator('th', { hasText: /^Siemens address$/i }).first().waitFor({ timeout: 15000 });
  const cells = await page.locator('table tbody tr td:first-child').allInnerTexts();
  log('Siemens cells:', cells.map((c) => c.replace(/\n/g, ' / ')).join(' | '));
  check(cells.some((c) => /^"Machine_DB"\.\S+\n.*C1\d{3}/.test(c)), 'an HMI bit reads "Machine_DB".…, with C1… below');
  check(!cells.some((c) => /^(X|Y|C|DS)\d+$/.test(c.trim())), 'no row shows only an app address');

  // Diagnostics screen: lamps and group titles in S7 addresses.
  const diag = await page.evaluate(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    const s = d.screens.find((x) => /diag/i.test(x.name) || /diag/i.test(x.id));
    return s ? s.elements.map((e) => e.label).filter(Boolean) : [];
  });
  log('Diagnostics labels:', diag.join(' | '));
  check(diag.some((l) => /^Inputs \(CPU\)\s+%I0\.0–%I\d+\.\d/.test(l)), 'the inputs group title gives the S7 range');
  check(diag.some((l) => /^%I0\.0 /.test(l)) && !diag.some((l) => /^X0\d\d /.test(l)), 'input lamps are named %I0.0 …');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-native-address e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
