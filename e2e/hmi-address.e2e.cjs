// The HMI element editor's PLC address field (QA): "GARBAGE!!", X099 (not in the I/O list) and DS9999 (not on
// this PLC) are flagged in plain words under the field; a valid address shows nothing.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-address.e2e.cjs
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
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/hmi');
  await page.getByRole('button', { name: 'Edit screen' }).click();
  const lamp = await page.evaluate(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return d.screens[0].elements.find((e) => e.kind === 'indicator' && e.address)?.id;
  });
  const box = await page.locator(`[data-testid="hmi-editor"] [data-el="${lamp}"]`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const field = page.getByLabel('PLC address');
  const problem = page.getByTestId('address-problem');
  const typed = async (a) => { await field.fill(a); await page.waitForTimeout(150); return (await problem.count()) ? await problem.innerText() : ''; };
  for (const [a, want] of [['GARBAGE!!', /not an address on CLICK/], ['X099', /X099 is not in the I\/O list/], ['DS9999', /not an address on CLICK/]]) {
    const msg = await typed(a);
    log(`${a}: ${msg}`);
    check(want.test(msg), `${a} is flagged`);
  }
  check((await typed('C1201')) === '', 'a valid bit shows nothing');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-address e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
