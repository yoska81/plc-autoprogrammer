// Troubleshooter practice mode in the simulator: break a wire of the design and the PLC sees what a real
// fault would do (short to 24 V → input ON, open → input OFF / load dead), a hidden fault, repair.
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/troubleshoot.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const { fakeServer } = require('./fake-modbus.cjs');
const { createModbusClient } = require('../electron/modbus.cjs');
const OUT = __dirname + '/out-troubleshoot/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/simulate');
  const bar = page.getByLabel('Practice wiring fault');
  await bar.waitFor({ timeout: 15000 });
  const lit = (a) => page.evaluate((a) => {
    const row = [...document.querySelectorAll('span.font-mono.w-11')].find((s) => s.textContent.trim() === a)?.parentElement;
    return Boolean(row?.querySelector('span.rounded-full')?.className.match(/bg-(brand|emerald|violet)-500/));
  }, a);
  const before = await lit('X005');
  await bar.getByLabel('Wire to break').selectOption('X005');
  await bar.getByLabel('Fault').selectOption('short-24V');
  await bar.getByRole('button', { name: 'Break this wire' }).click();
  await page.waitForTimeout(300);
  check(/wire X005 shorted to 24 V/.test(await bar.innerText()), 'fault shown');
  check(await lit('X005'), 'X005 reads ON with its wire shorted to 24 V');
  await page.screenshot({ path: OUT + 'short.png' });
  await bar.getByRole('button', { name: 'Repair the wire' }).click();
  await page.waitForTimeout(300);
  check(await lit('X005') === before, 'X005 back to its real value after the repair');
  await bar.getByRole('button', { name: 'Hidden fault (find it)' }).click();
  check(/hidden wiring fault is active/.test(await bar.innerText()), 'hidden fault banner');
  check(!/Fault: wire/.test(await bar.innerText()), 'the wire is not shown');
  await bar.getByRole('button', { name: 'Reveal' }).click();
  check(/Fault: wire /.test(await bar.innerText()), 'revealed');
  log('Revealed:', (await bar.innerText()).replace(/\s+/g, ' ').slice(0, 160));
  await bar.getByRole('button', { name: 'Repair the wire' }).click();

  // Guided fault finding on the Online page, phone-sized screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/online');
  await page.getByRole('button', { name: 'Fault finding' }).click();
  await page.getByRole('button', { name: 'Full screen' }).click();
  const panel = page.getByLabel('Fault finding');
  await panel.getByLabel('Point to troubleshoot').selectOption('X004');
  await panel.getByRole('button', { name: 'X004 never comes ON' }).click();
  await panel.getByRole('button', { name: 'Ready' }).click();
  check(/Go to PLC terminal X004/.test(await panel.innerText()), 'first step at the PLC terminal');
  check(/Do you read 24 VDC\?/.test(await panel.innerText()), 'expected reading asked');
  await page.waitForTimeout(500);
  check(await panel.locator('rect[data-ts-mark]').count() > 0, 'the wire is marked on the sheet thumbnail');
  await page.screenshot({ path: OUT + 'phone_step.png', fullPage: true });
  await panel.getByRole('button', { name: 'No', exact: true }).click();
  check(/Terminal strip TB2, terminal 1/.test(await panel.innerText()), 'next step at TB2-1');
  await panel.getByRole('button', { name: 'No', exact: true }).click();
  await panel.getByRole('button', { name: /^Yes/ }).click();
  const verdict = await panel.getByRole('status').innerText();
  log('Verdict:', verdict.replace(/\s+/g, ' ').slice(0, 200));
  check(/Open connection on wire X004 between Terminal strip TB2, terminal 1 and PE1/.test(verdict), 'verdict names the open conductor');
  await page.screenshot({ path: OUT + 'phone_verdict.png', fullPage: true });
  await page.getByRole('button', { name: 'Back to the page' }).click();

  // Live: a wiggle test answered by the PLC (fake Modbus CLICK toggles X004 while "wiggled").
  await page.setViewportSize({ width: 1500, height: 950 });
  const plc = fakeServer();
  const port = await plc.listen();
  const mb = createModbusClient();
  await page.exposeFunction('__modbus', (method, args) => mb[method](...args));
  await page.addInitScript(() => {
    const call = (m) => (...a) => window.__modbus(m, a);
    window.isaDesktop = { ...(window.isaDesktop ?? {}), modbus: Object.fromEntries(['connect', 'disconnect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters', 'writeCoil', 'writeRegister'].map((m) => [m, call(m)])) };
  });
  await page.goto(BASE + '/online');
  await page.getByLabel('PLC IP address').fill('127.0.0.1');
  await page.getByLabel('Modbus port').fill(String(port));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText(/Connected · \d+ reads/).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Fault finding' }).click();
  await panel.getByLabel('Point to troubleshoot').selectOption('X004');
  await panel.getByRole('button', { name: 'X004 flickers / drops out' }).click();
  await panel.getByRole('button', { name: 'Ready' }).click();
  check(await panel.getByLabel('Live value').count() === 1, 'live value shown while connected');
  await panel.getByRole('button', { name: /Watch X004 for 10 s/ }).click();
  // X004 = discrete input 4 (Modbus 100004 → offset 3): toggle it a few times during the watch.
  for (let i = 0; i < 6; i++) { plc.mem.discrete[3] = i % 2 ? 0 : 1; await page.waitForTimeout(900); }
  await page.waitForTimeout(5000);
  const v2 = await panel.getByRole('status').innerText().catch(() => '');
  log('Wiggle verdict:', v2.replace(/\s+/g, ' ').slice(0, 160));
  check(/Loose connection at Terminal strip TB2, terminal 1/.test(v2), 'the PLC watch found the loose connection');
  await page.getByRole('button', { name: 'Disconnect' }).click().catch(() => {});
  await mb.disconnect(); await plc.close();

  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `${fails.length} problem(s)` : 'troubleshoot e2e OK');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
