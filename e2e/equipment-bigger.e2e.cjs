// A machine no CLICK can hold (130 inputs, 120 outputs), no brand asked for: Equipment says it needs a bigger PLC
// and offers the brands; Siemens sets the brand and asks the AI again, which now gets Siemens CPUs to choose from.
//   npm run dev -- --port 5226 &  ;  BASE_URL=http://localhost:5226 node e2e/equipment-bigger.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5226';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };
const sysText = (s) => (Array.isArray(s) ? s.map((b) => b.text).join('\n') : s);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const prompts = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    prompts.push(sysText(JSON.parse(route.request().postData()).system));
    await route.fulfill({ status: 500, body: '{}' });
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const mod = await appImport('/src/preview/sampleProject.ts');
    const ps = await appImport('/src/store/useProjectsStore.ts');
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o', showExperimental: true }, version: 2 }));
    mod.seedSampleProject();
    ps.useProjectsStore.getState().openProject(mod.EXAMPLE_ID);
  });
  await page.reload();
  await page.evaluate(async () => {
    const { useIOStore } = await appImport('/src/store/useIOStore.ts');
    const pts = [...Array.from({ length: 130 }, (_, i) => ({ description: `Sensor ${i + 1}`, type: 'input', category: 'Sensors' })), ...Array.from({ length: 120 }, (_, i) => ({ description: `Valve ${i + 1}`, type: 'output', category: 'Valves' }))];
    useIOStore.getState().importPoints(pts, true);
  });
  await page.goto(BASE + '/equipment');
  const card = page.getByTestId('equipment-bigger');
  await card.waitFor({ timeout: 10000 });
  check(/needs a bigger PLC than a CLICK/.test(await card.innerText()) && /130 inputs, 120 outputs/.test(await card.innerText()), 'a machine no CLICK holds: said, with its I/O');
  await page.getByTestId('equipment-bigger-siemens').click();
  await page.waitForTimeout(1500);
  const brand = await page.evaluate(async () => (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().info);
  check(JSON.stringify(brand.vendors?.plc) === '["siemens"]' && brand.plcChosen, 'Siemens set as the PLC brand');
  check(prompts.length > 0 && /Available PLCs \(Siemens/.test(prompts[prompts.length - 1]) && !/CLICK CPUs take up to 8/.test(prompts[prompts.length - 1]), 'the AI asked again, with Siemens CPUs to choose from');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `equipment-bigger e2e: ${fails.length} failed` : 'equipment-bigger e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
