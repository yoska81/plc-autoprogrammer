// Changing the touch panel on the HMI page: the screens are scaled to the new panel, and the HMI stage
// says they were laid out for the old one (Redesign screens lays them out for the new one) instead of
// "ready"; going back to the first panel restores its screens exactly, no layout problems left.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-panel-switch.e2e.cjs
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
  const state = () => page.evaluate(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    const { getHmi } = await import('/src/hmi/hmiCatalog.ts');
    const { checkDesign } = await import('/src/hmi/layout.ts');
    const { stagesNow } = await import('/src/spec/useStages.ts');
    const m = getHmi(d.hmiPartNumber);
    return { pn: d.hmiPartNumber, issues: checkDesign(d, m.widthPx, m.heightPx).filter((i) => i.severity === 'error').length, stage: stagesNow().hmi, screens: JSON.stringify(d.screens) };
  });
  const switchTo = async (pn) => {
    await page.getByRole('button', { name: 'Change HMI', exact: true }).click();
    await page.locator('button', { has: page.locator('div', { hasText: new RegExp(`^${pn}$`) }) }).first().click();
    await page.waitForTimeout(400);
  };
  const first = await state();
  log(`Start: ${first.pn}, ${first.issues} layout errors, stage ${first.stage.status}`);
  await switchTo('CM5-T4W');
  const small = await state();
  log(`On CM5-T4W: ${small.issues} layout errors, stage ${small.stage.status}: ${small.stage.reason}`);
  check(small.pn === 'CM5-T4W' && small.stage.status === 'stale' && /touch panel changed/.test(small.stage.reason ?? ''), 'a smaller panel puts the HMI stage out of date, saying why');
  check((await page.getByText(/touch panel changed/).count()) > 0, 'the HMI page says so');
  await switchTo(first.pn);
  const back = await state();
  log(`Back on ${back.pn}: ${back.issues} layout errors, stage ${back.stage.status}`);
  check(back.screens === first.screens, 'back on the first panel: the screens exactly as they were');
  check(back.issues === first.issues && back.stage.status === first.stage.status, 'and no layout problems left over, stage as before');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-panel-switch e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
