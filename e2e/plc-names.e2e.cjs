// The PLC's own tag names on the ladder (Dev 3's Siemens walk-through), on the example project:
//   - CLICK: the Program page shows the app operands (X001, C1) as before;
//   - Siemens S7 (chosen on the PLC page): the Program page and the Simulator show "E_Stop_OK_safety_relay" (with
//     %I0.0 and X001 in the small line), #Safety_OK, #FirstScan — the names of the exported SCL; the cross reference
//     lists the PLC names; the Simulator's I/O panel shows %I0.0 / %Q0.0, not X001 / Y001.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/plc-names.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await useAppModules(page);
  // A cold dev server compiles the app on the first load: allow it time (the waits below are for elements, not delays).
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  const ladderText = async () => { await page.waitForSelector('div.overflow-auto div[role="button"][title]'); return page.locator('div.overflow-auto').first().innerText(); };
  await page.goto(BASE + '/program');
  const click = await ladderText();
  check(/X001/.test(click) && !/#Safety_OK/.test(click), 'CLICK: the app operands, as before');

  await page.goto(BASE + '/plc');
  await page.getByTestId('plc-change').locator('summary').click(); // the PLC is chosen in Equipment; changed here behind this
  await page.getByRole('button', { name: /Siemens/ }).first().click();
  await page.goto(BASE + '/program');
  const s7 = await ladderText();
  check(/"E_Stop_OK_safety_relay"/.test(s7), 'Siemens: an input shown as its PLC tag "E_Stop_OK_safety_relay"');
  check(/%I0\.0/.test(s7) && /X001/.test(s7), 'with %I0.0 and the app operand X001 in the small line');
  check(/#Safety_OK/.test(s7), 'internal memory as a block member #Safety_OK');
  check(/#FirstScan/.test(s7), 'SC2 as #FirstScan');

  await page.getByRole('button', { name: 'Cross reference' }).click();
  const xref = page.locator('input[placeholder="Find address or name"]').locator('xpath=ancestor::div[1]/..');
  await page.locator('input[placeholder="Find address or name"]').fill('Safety_OK');
  check(/#Safety_OK/.test(await xref.innerText()), 'the cross reference lists #Safety_OK (and finds it by name)');

  await page.goto(BASE + '/simulate');
  await page.getByText('#Safety_OK').first().waitFor();
  const sim = await page.locator('body').innerText();
  check(/#Safety_OK/.test(sim) && /"E_Stop_OK_safety_relay"/.test(sim), 'the Simulator\'s live ladder shows the same names');
  const io = await page.locator('section', { has: page.locator('h4', { hasText: /^Inputs/ }) }).first().innerText();
  check(/%I0\.0/.test(io) && !/\bX001\b/.test(io), 'the I/O panel shows %I0.0, not X001');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`plc-names e2e: ${fails.length} failed`); process.exit(1); }
  console.log('plc-names e2e passed');
})();
