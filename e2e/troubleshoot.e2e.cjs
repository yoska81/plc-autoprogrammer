// Troubleshooter practice mode in the simulator: break a wire of the design and the PLC sees what a real
// fault would do (short to 24 V → input ON, open → input OFF / load dead), a hidden fault, repair.
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/troubleshoot.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
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
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `${fails.length} problem(s)` : 'troubleshoot e2e OK');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
