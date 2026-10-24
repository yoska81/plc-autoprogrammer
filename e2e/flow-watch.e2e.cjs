// Program flow, Watch the real PLC: the app's own Modbus client against a fake CLICK (Modbus TCP on localhost), the
// example with a 4-step cycle. The machine's values set in the fake PLC's memory as a running machine sets them: the
// diagram follows the step, a step that acts too long turns red with the reason, an alarm the PLC holds is red; the
// app only reads (no write request reaches the PLC); leaving the page closes the connection.
//   npm run dev -- --port 5218 &  ;  BASE_URL=http://localhost:5218 node e2e/flow-watch.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const { fakeServer } = require('./fake-modbus.cjs');
const { createModbusClient } = require('../electron/modbus.cjs');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = __dirname + '/out-flow/';
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };
const TABLE = { coil: 'coils', discrete: 'discrete', holding: 'holding', input: 'input' };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 920 } });
  const page = await ctx.newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());

  const plc = fakeServer();
  const port = await plc.listen();
  const mb = createModbusClient();
  await page.exposeFunction('__modbus', (method, args) => mb[method](...args));
  await ctx.addInitScript(() => {
    const call = (m) => (...a) => window.__modbus(m, a);
    window.isaDesktop = { ...(window.isaDesktop ?? {}), modbus: Object.fromEntries(['connect', 'disconnect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters', 'writeCoil', 'writeRegister'].map((m) => [m, call(m)])) };
  });

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async (port) => {
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const { useOnlineStore } = await appImport('/src/online/useOnline.ts');
    useOnlineStore.getState().setSettings({ host: '127.0.0.1', port, pollMs: 250 });
    const NO = (a) => ({ type: 'NO', address: a }), NC = (a) => ({ type: 'NC', address: a });
    const AT = (n) => ({ type: 'CMP', left: 'DS1150', op: '==', right: String(n) });
    const GO = (n) => ({ type: 'COPY', source: String(n), dest: 'DS1150' });
    const cycle = [
      { id: 'q0', block: 'cycle', comment: 'Cycle not running: step 0 (idle)', branches: [[NC('C2')]], outputs: [GO(0)] },
      { id: 'q1', block: 'cycle', comment: 'Cycle start: step 10 — Wait for part', branches: [[NO('C2'), AT(0)]], outputs: [GO(10)] },
      { id: 'q4', block: 'cycle', comment: 'Step 30 — Return: done when X006 ON → step 10', branches: [[NO('C2'), AT(30), NO('X006')]], outputs: [GO(10)] },
      { id: 'q3', block: 'cycle', comment: 'Step 20 — Push: done when X005 ON → step 30', branches: [[NO('C2'), AT(20), NO('X005')]], outputs: [GO(30)] },
      { id: 'q2', block: 'cycle', comment: 'Step 10 — Wait for part: done when X004 ON → step 20', branches: [[NO('C2'), AT(10), NO('X004')]], outputs: [GO(20)] },
      { id: 'q5', block: 'cycle', comment: 'Push request: in step 20', branches: [[AT(20)]], outputs: [{ type: 'OUT', address: 'C3' }] },
    ];
    const s = useProgramStore.getState();
    s.editLadder({ ...s.ladder, rungs: [...s.ladder.rungs.filter((r) => r.block !== 'cycle' && !/^Automatic push request/.test(r.comment)), ...cycle], blocks: [...(s.ladder.blocks ?? []), { id: 'cycle', name: 'Automatic cycle', description: 'Step sequence' }] });
  }, port);
  // the machine's memory, as the running PLC holds it
  const refs = await page.evaluate(async () => {
    const { clickModbus } = await appImport('/src/online/clickModbus.ts');
    return Object.fromEntries(['C1', 'C2', 'C3', 'X001', 'X004', 'X005', 'X006', 'DS1150', 'C1101'].map((a) => [a, clickModbus(a)]));
  });
  const set = (a, v) => { const r = refs[a]; plc.mem[TABLE[r.table]][r.register] = typeof v === 'boolean' ? (v ? 1 : 0) : v; };
  set('X001', true); set('C1', true); set('C2', true); set('X006', true); set('DS1150', 10);

  await page.goto(BASE + '/flow');
  const canvas = page.getByTestId('flow-canvas');
  await canvas.waitFor();
  await page.getByTestId('flow-mode-watch').click();
  check(/Connect \(read only\)/.test(await page.getByTestId('flow-watch').innerText()), 'Watch: connect, read only');
  await page.getByRole('button', { name: 'Connect (read only)' }).click();
  await page.getByText(/Watching 127\.0\.0\.1 · read only/).waitFor({ timeout: 10000 });
  await page.getByTestId('flow-stuck').fill('1');
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();
  await page.waitForTimeout(800);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:10"]').textContent()), 'the PLC in step 10: step 10 NOW');
  check(/WAITING/.test(await canvas.locator('[data-node*=":dec:10:"]').textContent()), 'waiting for the part');

  // the PLC moves to step 20 and the pusher does not come out
  set('DS1150', 20); set('C3', true); set('X006', false);
  await page.waitForTimeout(800);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:20"]').textContent()), 'the PLC in step 20: the diagram follows');
  await page.waitForTimeout(1500);
  const d20 = canvas.locator('[data-node*=":dec:20:"]');
  check(/STUCK/.test(await d20.textContent()), 'stuck in step 20 (read from the PLC): red');
  await d20.click();
  check(/Stuck [\d.]+ s in step 20 for: Pusher extended ON/.test(await page.getByTestId('flow-why').innerText()), 'the reason, from the PLC\'s values');
  await page.screenshot({ path: OUT + 'w1-watch-stuck.png' });

  // the PLC latches its pusher-fault alarm
  set('C1101', true); set('C2', false); set('DS1150', 0);
  await page.waitForTimeout(900);
  check(await page.getByTestId('flow-functions').getByRole('button', { name: /Alarms/ }).locator('.bg-red-500').count() === 1, 'the PLC\'s alarm: Alarms red');
  check(/NOW/.test(await canvas.locator('[data-node$=":step:0"]').textContent()), 'the cycle stopped: step 0');

  // read only: no write request ever reached the PLC
  const writes = plc.state.log.filter((x) => x.fc === 5 || x.fc === 6 || x.fc === 15 || x.fc === 16);
  check(writes.length === 0 && plc.state.log.length > 5, `read only: ${plc.state.log.length} reads, ${writes.length} writes`);

  // leaving the page closes the connection
  await page.goto(BASE + '/program');
  await page.waitForTimeout(600);
  check(await page.evaluate(async () => (await appImport('/src/online/useOnline.ts')).useOnlineStore.getState().status) === 'disconnected', 'leaving the page: disconnected');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  await plc.close();
  if (fails.length) { console.log(`\nflow-watch e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nflow-watch e2e: all passed');
})();
