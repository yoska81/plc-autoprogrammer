// Online page with a CLICK (fake Modbus TCP server on localhost, the desktop app's own Modbus client called from
// the page): Manual commands (hold-to-run HMI command bits: first press only confirms, ON while held, OFF on
// release / window blur / disconnect, interlock, every write logged), the honest "no forcing, no Run / Stop" note,
// and Follow this rung (live power flow per contact, stale once the PLC stops answering).
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/click-online.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const { fakeServer } = require('./fake-modbus.cjs');
const { createModbusClient } = require('../electron/modbus.cjs');
const OUT = __dirname + '/out-click-online/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };
const C = (n) => 16384 + n - 1;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());

  const plc = fakeServer();
  const port = await plc.listen();
  const mb = createModbusClient();
  await page.exposeFunction('__modbus', (method, args) => mb[method](...args));
  await ctx.addInitScript(() => {
    const call = (m) => (...a) => window.__modbus(m, a);
    window.isaDesktop = { ...(window.isaDesktop ?? {}), modbus: Object.fromEntries(['connect', 'disconnect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters', 'writeCoil', 'writeRegister'].map((m) => [m, call(m)])) };
  });

  // The example project (CLICK, conveyor with HMI jog buttons).
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/online?tab=commands');
  const panel = page.getByTestId('manual-commands');
  await panel.waitFor({ timeout: 15000 });
  check(/can.t force inputs or outputs over the network: use the CLICK programming software to force/.test(await panel.innerText()), 'honest: no forcing over the network');
  check(/There is no Run \/ Stop here/.test(await panel.innerText()) && await page.getByRole('button', { name: /^(Run|Stop PLC|Program mode)$/ }).count() === 0, 'no Run / Stop');
  const jog = panel.getByRole('button', { name: 'Hold Jog Conveyor' });
  check(await jog.isDisabled(), 'commands disabled while not connected');
  check(await panel.locator('[data-command="C1005"]').count() === 0, 'Manual-mode toggle (latching) not offered');
  check(await panel.locator('[data-command^="X"], [data-command^="Y"]').count() === 0, 'no X / Y commands');

  await page.getByLabel('PLC IP address').fill('127.0.0.1');
  await page.getByLabel('Modbus port').fill(String(port));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText(/Connected · \d+ reads/).waitFor({ timeout: 10000 });
  check(await jog.isDisabled(), 'commands disabled until "Allow writes"');
  page.once('dialog', (d) => d.accept());
  await page.getByLabel('Allow writes').check();
  await page.getByRole('alert').filter({ hasText: 'WRITES ENABLED' }).waitFor();
  check(await jog.isDisabled() && /Interlock C1204 .* is OFF/.test(await panel.locator('[data-command="C1006"]').innerText()), 'jog blocked while its interlock C1204 is OFF');
  plc.mem.coils[C(1204)] = 1;
  await page.waitForFunction(() => !document.querySelector('[aria-label="Hold Jog Conveyor"]')?.disabled, null, { timeout: 5000 });

  // First press: confirmation only, nothing written.
  const writes = () => plc.state.log.filter((l) => l.fc === 5).map((l) => `C${l.address - 16383}=${l.value ? 'ON' : 'OFF'}`);
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); void d.accept(); });
  await jog.click();
  await page.waitForTimeout(300);
  check(/Jog Conveyor/.test(asked) && writes().length === 0, 'first press asks to confirm and writes nothing');
  // Hold: ON while held, OFF on release.
  const box = await jog.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('[aria-label="Hold Jog Conveyor"]')?.getAttribute('aria-pressed') === 'true');
  await page.waitForTimeout(400);
  check(plc.mem.coils[C(1006)] === 1, 'held: C1006 ON in the PLC');
  check(await page.getByLabel('Command C1006 value').innerText() === 'ON', 'live value shows ON');
  await page.screenshot({ path: OUT + 'held.png' });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check(plc.mem.coils[C(1006)] === 0, 'released: C1006 OFF');
  const box2 = await jog.boundingBox();
  check(Math.abs(box2.y - box.y) < 1, 'the button stays under the finger (no layout shift)');
  // Held, then the window loses focus: OFF.
  await page.mouse.down();
  await page.waitForTimeout(300);
  check(plc.mem.coils[C(1006)] === 1, 'held again');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(300);
  check(plc.mem.coils[C(1006)] === 0, 'window blur: OFF');
  await page.mouse.up();
  // Held, then Disconnect (keyboard hold, the mouse is free): OFF before the connection closes.
  await jog.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(300);
  check(plc.mem.coils[C(1006)] === 1, 'held from the keyboard');
  log('PLC writes:', writes().join(' '));
  check(writes().join(' ') === 'C1006=ON C1006=OFF C1006=ON C1006=OFF C1006=ON', 'exactly ON / OFF pairs on the wire');
  const logText = await page.getByTestId('write-log').innerText();
  check((logText.match(/C1006 = ON \(held\)/g) ?? []).length === 3 && (logText.match(/C1006 = OFF \(released\)/g) ?? []).length === 2, 'every write in the log');

  // Follow this rung (the jog request) while the jog is still held.
  await page.getByRole('button', { name: 'Live ladder' }).click();
  check(plc.mem.coils[C(1006)] === 0, 'leaving the button (focus lost) released the keyboard hold');
  await page.keyboard.up(' ');
  plc.mem.coils[C(1006)] = 1;
  const follow = page.getByTestId('follow-rung');
  await follow.getByLabel('Follow this rung').selectOption('r_jog_req');
  await follow.getByText('Live', { exact: true }).waitFor({ timeout: 5000 });
  await page.waitForFunction(() => /power/.test(document.querySelector('[data-follow="C1204"]')?.textContent ?? ''), null, { timeout: 5000 });
  check(/ON/.test(await follow.locator('[data-follow="C1006"]').innerText()) && /closed/.test(await follow.locator('[data-follow="C1204"]').innerText()), 'rung contacts with live values');
  check(/rung true/.test(await follow.locator('[data-follow="C21"]').innerText()), 'coil: rung true');
  plc.mem.coils[C(1204)] = 0;
  await page.waitForFunction(() => /no power/.test(document.querySelector('[data-follow="C1204"]')?.textContent ?? ''), null, { timeout: 5000 });
  check(/open/.test(await follow.locator('[data-follow="C1204"]').innerText()) && /rung false/.test(await follow.locator('[data-follow="C21"]').innerText()), 'interlock open: no power past it');
  await follow.getByLabel('Read every').selectOption('250');
  await page.screenshot({ path: OUT + 'follow.png' });
  // The PLC stops answering: stale.
  plc.state.mode = 'silent';
  await follow.getByText(/^Stale:/).waitFor({ timeout: 8000 });
  check(true, 'stale when the PLC stops answering');
  await page.screenshot({ path: OUT + 'stale.png' });
  plc.state.mode = 'normal';

  await page.getByRole('button', { name: 'Disconnect' }).click().catch(() => {});
  await page.waitForTimeout(300);
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await mb.disconnect().catch(() => {});
  await plc.close();
  await browser.close();
  if (fails.length) { console.log(`FAIL: ${fails.length}`); process.exit(1); }
  console.log('click-online: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
