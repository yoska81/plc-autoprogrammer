// "Redesign screens" on the example adds HMI tags the program does not implement yet: the HMI and Program
// pages say so (the program exports are blocked by the checker), and one click rebuilds the program around its
// cycle so every HMI tag is implemented: no checker errors, the banner is gone.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/program-for-hmi.e2e.cjs
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
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  const checker = () => page.evaluate(async () => (await appImport('/src/deliverables/collect.ts')).collectProject().issues.filter((i) => i.severity === 'error').map((i) => i.message));
  const banner = page.getByTestId('program-out-of-step');

  await page.goto(BASE + '/hmi');
  check((await banner.count()) === 0 && (await checker()).length === 0, 'the example: program and screens in step, no banner');
  await page.getByRole('button', { name: /Redesign screens/ }).first().click();
  await page.getByText(/^Rule-based HMI for/).first().waitFor({ timeout: 20000 });
  await banner.waitFor({ timeout: 5000 }).catch(() => {});
  const text = (await banner.count()) ? await banner.innerText() : '';
  const errs = await checker();
  log(`After Redesign: ${errs.length} checker error(s) | ${text.replace(/\s+/g, ' ')}`);
  check(errs.length > 0 && /does not implement yet/.test(text), 'the HMI page says the program does not implement the new tags');
  await page.goto(BASE + '/program');
  await banner.waitFor({ timeout: 10000 }).catch(() => {});
  check((await banner.count()) === 1, 'so does the Program page');
  await banner.getByRole('button', { name: 'Rebuild program' }).click();
  await banner.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  const after = await checker();
  log(`After Rebuild program: ${after.length} checker error(s)`);
  check(after.length === 0 && (await banner.count()) === 0, 'one click: every HMI tag implemented, no checker errors, no banner');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('program-for-hmi e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
