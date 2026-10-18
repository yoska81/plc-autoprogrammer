// Deleting an I/O point on the example project (side manager's QA, item 1 + D12): the trash button asks
// first and lists what uses the point; Delete re-addresses the points after it and the program follows them
// (the part counter is marked "?X004", not moved onto "Pusher extended"); Undo puts everything back.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/io-delete.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/io');
  await page.waitForTimeout(800);
  const counter = () => page.evaluate(async () => {
    const { useProgramStore } = await import('/src/store/useProgramStore.ts');
    return JSON.stringify(useProgramStore.getState().ladder.rungs.find((g) => /^Part counter/.test(g.comment))?.branches);
  });
  check(await counter() === '[[{"type":"NO","address":"X004"}]]', 'part counter on X004 (the photo-eye)');

  const row = page.locator('tr', { has: page.locator('input[aria-label="Description of I004"]') });
  await row.hover();
  await page.getByRole('button', { name: 'Delete I004' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete I004?' });
  check(await dialog.isVisible(), 'Delete asks first');
  check(/Part counter/.test(await dialog.innerText()), 'the confirmation lists the part counter rung');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  check(await page.locator('input[aria-label="Description of I004"]').count() === 1, 'Cancel keeps the point');

  await row.hover();
  await page.getByRole('button', { name: 'Delete I004' }).click();
  await page.getByRole('dialog', { name: 'Delete I004?' }).getByRole('button', { name: 'Delete' }).click();
  check(await page.locator('input[aria-label="Description of I004"]').count() === 0, 'Delete removes it');
  check(await counter() === '[[{"type":"NO","address":"?X004"}]]', 'the part counter is marked, not moved onto Pusher extended');
  const alert = page.getByRole('alert');
  check(/Deleted I004/.test(await alert.innerText()), 'a message says what changed');
  await alert.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(300);
  check(await page.locator('input[aria-label="Description of I004"]').count() === 1, 'Undo brings the point back');
  check(await counter() === '[[{"type":"NO","address":"X004"}]]', 'Undo restores the program');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`io-delete e2e: ${fails.length} failed`); process.exit(1); }
  console.log('io-delete e2e passed');
})();
