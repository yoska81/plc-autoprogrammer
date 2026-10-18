// I/O list address field: a typed address is checked against the PLC (one check, src/plc/core/addressCheck.ts).
// "zz99", an output address on an input, or a terminal on a slot with no module stay in the field with the reason
// and are not saved; a good address is saved; on an S7 the PLC's own form (%I0.1) is accepted.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/address-check.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  // A CLICK CPU (the modules "No touch panel" adds for the door devices; never 8 of them).
  const first = await page.evaluate(async () => {
    const { applyEquipment } = await import('/src/spec/equipment.ts');
    applyEquipment({ cpuId: 'C0-12DD1E-D', modules: [], hmiPartNumber: null }, null);
    const io = (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO;
    return io.find((p) => p.type === 'input' && p.signal !== 'analog').id;
  });
  await page.goto(BASE + '/io');
  const field = page.locator(`input[aria-label="PLC address for ${first}"]`);
  await field.waitFor();
  check((await page.locator('th').allInnerTexts()).filter((t) => /address$/i.test(t)).length === 1, 'CLICK: one address column (its addresses are its own)');
  const saved = () => page.evaluate(async (id) => (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.find((p) => p.id === id).plcAddress ?? '', first);
  const type = async (text) => { await field.fill(text); await field.press('Enter'); await page.waitForTimeout(150); };
  const alertText = () => page.getByRole('alert').filter({ hasText: /address|input|output|module|CPU/ }).first().innerText().catch(() => '');

  await type('zz99');
  check(/"zz99" is not an address on CLICK/.test(await alertText()), 'zz99: not an address, said under the field');
  check(await field.inputValue() === 'zz99' && await saved() === '', 'zz99 stays in the field and is not saved');
  await type('Y001');
  check(/Y001 is an output, and this point is an input/.test(await alertText()), 'Y001 on an input: refused');
  await type('X801');
  check(/no module in slot 8/.test(await alertText()), 'X801 with no module in slot 8: refused');
  await type('x002');
  check(await saved() === 'X002' && !(await alertText()), 'x002: saved as X002, no message');
  await type('');
  check(await saved() === '', 'cleared: back to automatic');

  // An S7: the PLC's own address is accepted and stored as the app's terminal.
  await page.evaluate(async () => {
    const { applyEquipment } = await import('/src/spec/equipment.ts');
    applyEquipment({ cpuId: '6ES7214-1AG40-0XB0', modules: [], hmiPartNumber: null }, null);
  });
  await page.goto(BASE + '/io');
  // The brand's own address is shown next to the app's (A3).
  await field.waitFor();
  check((await page.locator('th').allInnerTexts()).includes('Siemens address'), 'Siemens address column shown');
  check(/%I0\.0/.test(await page.locator('tr', { has: field }).innerText()), 'first input shows %I0.0');
  await type('%I0.1');
  check(await saved() === 'X002', `%I0.1 on an S7: saved as X002 (${await saved()})`);
  await type('%Q0.0');
  check(/%Q0.0 is an output, and this point is an input/.test(await alertText()), '%Q0.0 on an input: refused');

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `address-check e2e: ${fails.length} failed` : 'address-check e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
