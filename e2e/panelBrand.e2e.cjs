// Electrical page: a Siemens PLC with AutomationDirect panel parts gets the offer "Use Siemens for panel parts too"
// (never applied on its own). One click sets the panel-parts brand and re-picks the parts from Siemens; "No thanks"
// is remembered. Page or console errors fail the run.
//
//   npx vite --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/panelBrand.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules, waitApp } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const dialogs = [];
  let answer = true;
  page.on('dialog', (d) => { dialogs.push(d.message()); return answer ? d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined) : d.dismiss(); });
  const vendorsOf = (cats) => page.evaluate(async (cats) => {
    const { useElectricalStore: E } = await appImport('/src/store/useElectricalStore.ts');
    const { getPart } = await appImport('/src/electrical/catalog.ts');
    return E.getState().design.components.map((c) => getPart(c.partNumber)).filter((p) => p && cats.includes(p.category)).map((p) => `${p.category}:${p.vendor}`);
  }, cats);

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await appImport('/src/preview/sampleProject.ts');
    const ps = await appImport('/src/store/useProjectsStore.ts');
    localStorage.clear();
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
    // the customer's PLC is a Siemens S7-1200; nobody chose a brand for the panel parts
    (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
  });
  await page.goto(BASE + '/electrical?tab=design');
  const offer = page.getByTestId('panel-brand-offer');
  await offer.waitFor({ timeout: 30000 });
  log('Offer:', (await offer.innerText()).replace(/\s+/g, ' ').slice(0, 220));
  check(/The PLC is Siemens/.test(await offer.innerText()), 'says why');
  const before = await vendorsOf(['pushbutton', 'contactor']);
  check(before.every((v) => v.endsWith(':automationdirect')), `AutomationDirect panel parts before (${before.join(', ')})`);

  // With a design in place it asks first; Cancel changes nothing.
  answer = false;
  await offer.getByRole('button', { name: 'Use Siemens for panel parts too' }).click();
  check(/redesign the panel/.test(dialogs.at(-1) ?? '') && /by hand/.test(dialogs.at(-1) ?? ''), 'asks before replacing the design');
  check(await page.evaluate(async () => (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().info.vendors?.panel) === undefined, 'Cancel: brand not changed');
  check((await vendorsOf(['contactor'])).every((v) => v.endsWith(':automationdirect')), 'Cancel: design not changed');
  answer = true;
  await offer.getByRole('button', { name: 'Use Siemens for panel parts too' }).click();
  await waitApp(page, async () => {
    const { useElectricalStore: E } = await appImport('/src/store/useElectricalStore.ts');
    const { getPart } = await appImport('/src/electrical/catalog.ts');
    const s = E.getState();
    return !s.isGenerating && s.design.components.some((c) => getPart(c.partNumber)?.category === 'pushbutton' && getPart(c.partNumber)?.vendor === 'siemens');
  }, { timeout: 60000 });
  const after = await vendorsOf(['pushbutton', 'contactor']);
  log('After:', after.join(', '));
  check(after.filter((v) => v.startsWith('contactor:')).every((v) => v.endsWith(':siemens')), 'contactors from Siemens');
  // Start / stop: Siemens green 1 NO / red 1 NC once the engine reads Siemens' '1 NO' contacts (engine devices.ts).
  log(after.some((v) => v === 'pushbutton:siemens') ? 'Start / stop pushbuttons from Siemens' : 'NOTE: start / stop pushbuttons still AutomationDirect (engine contact match)');
  // Siemens has only green 1 NO / red 1 NC buttons in the catalog: the other colours stay AutomationDirect.
  const leftover = await page.evaluate(async () => {
    const { useElectricalStore: E } = await appImport('/src/store/useElectricalStore.ts');
    const { getPart } = await appImport('/src/electrical/catalog.ts');
    return E.getState().design.components.map((c) => getPart(c.partNumber)).filter((p) => p?.category === 'pushbutton' && p.vendor !== 'siemens').map((p) => String(p.ratings.color));
  });
  log('Pushbuttons Siemens does not have:', leftover.join(', ') || 'none');
  if (after.some((v) => v === 'pushbutton:siemens')) check(leftover.every((c) => c !== 'green' && c !== 'red'), 'only colours Siemens lacks stay AutomationDirect');
  check(await page.getByTestId('panel-brand-offer').count() === 0, 'offer gone once the brand is chosen');
  check(await page.evaluate(async () => (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().info.vendors?.panel?.[0]) === 'siemens', 'panel brand saved');
  check(/Panel parts: Siemens/.test(await page.locator('header').first().innerText()), 'header names the panel brand');

  // "No thanks" is remembered for the project.
  await page.evaluate(async () => {
    const { useProjectStore: P } = await appImport('/src/store/useProjectStore.ts');
    const v = { ...P.getState().info.vendors }; delete v.panel;
    P.getState().setInfo({ vendors: v });
  });
  await offer.waitFor();
  await offer.getByRole('button', { name: 'No thanks' }).click();
  check(await page.getByTestId('panel-brand-offer').count() === 0, 'dismissed');
  await page.reload();
  await page.getByRole('heading', { name: /Electrical Design/ }).waitFor();
  check(await page.getByTestId('panel-brand-offer').count() === 0, 'still dismissed after a reload');

  check(!errors.length, 'no page errors: ' + errors.join(' | '));
  log('panel brand e2e passed');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
