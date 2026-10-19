// PLC setup never applies a CPU too small for the I/O list silently: choosing a brand or CPU adds the
// modules the list needs; a rack that cannot hold it shows the shortfall here and marks Equipment out of date.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/plc-fit.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/plc');
  await page.getByRole('button', { name: /CompactLogix 5380/ }).click();
  await page.locator('#cpu').selectOption('5069-L310ER');
  await page.waitForTimeout(300);
  const mods = await page.evaluate(async () => (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().modules);
  check(mods.length > 0, `choosing the CPU adds modules for the I/O list (${mods.join(', ')})`);
  check(await page.getByRole('alert').count() === 0, 'the rack holds the list: no warning');
  // Empty rack (as the old page left it): the shortfall shows here, and the Equipment stage is out of date.
  await page.evaluate(async () => (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().setModules([]));
  const alert = page.getByRole('alert');
  await alert.waitFor({ timeout: 5000 }).catch(() => {});
  check(/cannot hold the I\/O list/.test(await alert.textContent().catch(() => '') ?? ''), 'no modules: the page says the PLC cannot hold the I/O list');
  const stage = await page.evaluate(async () => (await appImport('/src/spec/useStages.ts')).stagesNow().equipment);
  check(stage.status === 'stale' && /cannot hold the I\/O list/.test(stage.reason ?? ''), `the Equipment stage is out of date (${stage.status})`);
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `plc-fit e2e: ${fails.length} failed` : 'plc-fit e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
