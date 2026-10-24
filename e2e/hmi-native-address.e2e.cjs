// HMI page on a Siemens project: the tag and alarm lists give the PLC's own address (%I0.0 / %Q0.0 for I/O,
// "Machine_DB".… for memory) with the app's address small below it, and the Diagnostics screen names the I/O
// the S7 way (%I0.0 …). CLICK stays as it is (X001, C1001).
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-native-address.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
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
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
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
    const d = (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return Boolean(d?.screens.some((s) => s.elements.some((e) => /Siemens/.test(e.label ?? ''))));
  }, null, { timeout: 30000 }).catch(() => {});
  await page.locator('th', { hasText: /^Siemens address$/i }).first().waitFor({ timeout: 15000 });
  const cells = await page.locator('table tbody tr td:first-child').allInnerTexts();
  log('Siemens cells:', cells.map((c) => c.replace(/\n/g, ' / ')).join(' | '));
  check(cells.some((c) => /^"Machine_DB"\.\S+\n.*C1\d{3}/.test(c)), 'an HMI bit reads "Machine_DB".…, with C1… below');
  check(!cells.some((c) => /^(X|Y|C|DS)\d+$/.test(c.trim())), 'no row shows only an app address');

  // Diagnostics screen: drawn with S7 addresses; the saved design keeps the app's (so a PLC change never leaves them stale).
  const shown = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check(/Inputs \(CPU\) %I0\.0–%I0\.5/.test(shown), 'the inputs group title gives the S7 range');
  check(/%I0\.0 E-Stop OK/i.test(shown) && /%Q0\.0 /.test(shown) && !/X001 E-Stop OK/i.test(shown), 'input and output lamps are drawn %I0.0 … / %Q0.0 …');
  const saved = await page.evaluate(async () => {
    const d = (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return d.screens.flatMap((s) => s.elements.map((e) => e.label)).filter((l) => /^(X|%I)\S+ E-Stop/i.test(l ?? ''));
  });
  check(saved.length > 0 && saved.every((l) => /^X001 /.test(l)), `the saved design keeps X001 (${saved.join(', ')})`);
  // Back to CLICK without redesigning: the same screens are drawn with X001 again.
  await page.evaluate(async () => { (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().setPlc('click', 'C0-10DD1E-D'); });
  await page.waitForTimeout(800);
  const back = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check(/X001 E-Stop OK/i.test(back) && !/%I0\.0/.test(back), 'on CLICK the same screens read X001 again');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-native-address e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
