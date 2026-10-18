// The HMI element editor's PLC address field (QA): "GARBAGE!!", X099 (not in the I/O list) and DS9999 (not on
// this PLC) are flagged in plain words under the field; a valid address shows nothing. X1 hints X001, a button's
// interlock is checked too, and no element of the example's first screen is flagged.
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
  check(/Type X001/.test(await typed('X1')), 'X1 hints X001');
  // Every addressed element of the first screen, as generated: nothing flagged.
  const ids = await page.evaluate(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return d.screens[0].elements.filter((e) => e.address && e.kind !== 'indicator').map((e) => ({ id: e.id, kind: e.kind, interlock: e.interlock ?? null }));
  });
  let flagged = 0;
  for (const e of ids) {
    const b = await page.locator(`[data-testid="hmi-editor"] [data-el="${e.id}"]`).first().boundingBox();
    if (!b) continue;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(80);
    flagged += await page.getByTestId('address-problem').count() + await page.getByTestId('interlock-problem').count();
  }
  log(`${ids.length} addressed elements on the first screen, ${flagged} flagged`);
  check(ids.length > 0 && flagged === 0, 'the generated addresses are all accepted');
  const button = ids.find((e) => e.kind === 'button');
  if (button) {
    const b = await page.locator(`[data-testid="hmi-editor"] [data-el="${button.id}"]`).first().boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.getByLabel('Interlock bit').fill('DS1');
    await page.waitForTimeout(150);
    const msg = (await page.getByTestId('interlock-problem').count()) ? await page.getByTestId('interlock-problem').innerText() : '';
    log(`interlock DS1: ${msg}`);
    check(/needs a bit/.test(msg), 'a register as the interlock is flagged');
  } else check(false, 'a button on the first screen');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-address e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
