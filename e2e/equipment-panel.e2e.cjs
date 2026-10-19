// Moving off an all-in-one PLC (Unitronics UniStream, screen built in) to a CLICK on the Equipment page: the
// built-in screen cannot stay, so the closest touch panel the CLICK can talk to is selected and the page says
// so (it no longer silently drops the HMI); a panel the new PLC can talk to is kept as it is.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/equipment-panel.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/equipment');
  await page.getByRole('radio', { name: 'Choose C0-10DD1E-D', exact: true }).waitFor({ timeout: 15000 });
  // Other brands' CPUs are collapsed under "Show N CPUs of other brands".
  const pick = async (id) => {
    const radio = page.getByRole('radio', { name: `Choose ${id}`, exact: true });
    if (!(await radio.count())) await page.getByRole('button', { name: /^Show \d+ CPUs of other brands$/ }).click();
    await radio.locator('xpath=ancestor::tr').click();
  };
  const selection = () => page.locator('aside').getByText(/^HMI$/).locator('xpath=following-sibling::dd').first().innerText();
  const note = page.getByTestId('panel-note');

  await pick('US5-B10-TR22');
  check((await selection()) === 'US5-B10-TR22', 'the UniStream brings its own screen');
  await pick('C0-10DD1E-D');
  const after = await selection();
  const text = (await note.count()) ? await note.innerText() : '';
  log(`After CLICK: HMI ${after} | ${text}`);
  check(after === 'CM5-T7W', 'the closest panel the CLICK can talk to is selected (same 800×480)');
  check(/built into that PLC, so it goes with it.*CM5-T7W.*selected instead/.test(text), 'the page says why the panel changed');

  // A panel the new PLC can talk to stays, with nothing to say.
  await pick('C0-11DD1E-D');
  check((await selection()) === 'CM5-T7W' && (await note.count()) === 0, 'a compatible panel is kept as it is');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('equipment-panel e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
