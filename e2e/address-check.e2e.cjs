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
  check(/"zz99" is not an address on AutomationDirect CLICK/.test(await alertText()), 'zz99: not an address, said under the field');
  check(await field.inputValue() === 'zz99' && await saved() === '', 'zz99 stays in the field and is not saved');
  await type('Y001');
  check(/Y001 is an output, and this point is an input/.test(await alertText()), 'Y001 on an input: refused');
  await type('X801');
  check(/no module in slot 8/.test(await alertText()), 'X801 with no module in slot 8: refused');
  // Refused for a module that is not there; checked again once the module is added.
  await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setModules([]));
  await type('X101');
  check(/no module in slot 1/.test(await alertText()), 'X101 with no module: refused');
  await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setModules(['C0-16ND3']));
  await page.waitForTimeout(300);
  check(!(await alertText()), 'module added: the refusal goes away');
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

  // D16: no CPU chosen and more points than terminals: said on the I/O list, never silent.
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/store/useProjectStore.ts');
    useProjectStore.setState({ plcId: 'click', cpuId: '', modules: [] });
    const { useIOStore } = await import('/src/store/useIOStore.ts');
    useIOStore.getState().importPoints(Array.from({ length: 160 }, (_, i) => ({ description: `Sensor ${i + 1}`, type: 'input', category: 'Product Detection' })), false);
  });
  await page.goto(BASE + '/io');
  const status = page.getByRole('status').filter({ hasText: /No PLC CPU is chosen yet/ });
  await status.waitFor({ timeout: 10000 }).catch(() => {});
  const txt = await status.innerText().catch(() => '');
  console.log('  ·', txt.replace(/\s+/g, ' ').slice(0, 300));
  check(/No PLC CPU is chosen yet/.test(txt), 'no CPU: said');
  check(/a preview on 16-point modules that do not exist yet/.test(txt), 'addresses on modules nobody chose: said');
  check(/\d+ of \d+ points have no address/.test(txt), 'points with no terminal: counted and said');

  // D14: a brand this tool cannot program gets the comparison card with plain words; Siemens gets none.
  await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setInfo({ vendors: { plc: ['mitsubishi'] }, plcChosen: true }));
  await page.goto(BASE + '/equipment');
  const card = page.locator('section[aria-label="Preferred PLC brands for this machine"]');
  await card.waitFor({ timeout: 10000 }).catch(() => {});
  const mitsu = await card.innerText().catch(() => '');
  check(/this tool cannot program this brand yet, so its CPUs cannot be chosen/.test(mitsu) && !/Use this CPU/.test(mitsu), 'Mitsubishi card: says why its CPUs cannot be chosen, no Use button');
  await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setInfo({ vendors: { plc: ['siemens'] }, plcChosen: true }));
  await page.waitForTimeout(500);
  const use = card.getByRole('button', { name: 'Use this CPU' }).first();
  check(await use.count() === 1 && !/cannot program/.test(await card.innerText()), 'Siemens card: its CPUs can be chosen ("Use this CPU")');
  await use.click();
  check(/6ES7/.test(await page.getByText(/^Your equipment selection \(/).innerText().catch(() => '')), 'Use this CPU: the Siemens CPU becomes the selection to apply');

  // Across brands with a panel that cannot talk to the new PLC: the panel is swapped for the closest one that can, and said.
  await page.evaluate(async () => {
    const { applyEquipment } = await import('/src/spec/equipment.ts');
    applyEquipment({ cpuId: 'C0-12DD1E-D', modules: [], hmiPartNumber: 'CM5-T7W' }, null);
  });
  await page.goto(BASE + '/equipment');
  await card.getByRole('button', { name: 'Use this CPU' }).first().click();
  const sel = await page.getByText(/^Your equipment selection \(/).innerText().catch(() => '');
  const note = await page.getByText(/The CM5-T7W cannot talk to the 6ES7/).innerText().catch(() => '');
  console.log('  ·', sel.replace(/\s+/g, ' ').slice(0, 120), '|', note.slice(0, 160));
  check(/6ES7/.test(sel) && !/CM5-T7W/.test(sel) && /is selected instead/.test(note), 'cross-brand pick: the C-more panel is swapped for one that talks to the S7, with a note');

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `address-check e2e: ${fails.length} failed` : 'address-check e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
