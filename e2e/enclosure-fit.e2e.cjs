// Enclosure fit: a NEMA 4X design in a stainless enclosure too small for its parts shows the red banner on the
// Electrical page with the ways out (larger stainless, 4X fiberglass, relax to NEMA 12, split); choosing the
// larger stainless one swaps ENC1 / SP1 and the banner goes away. The Enclosure control: a bigger pick is kept with a
// note, a too-small pick is bumped with a note and stays recorded. Uses the example project (dev build).
//
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/enclosure-fit.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const OUT = __dirname + '/out-enclosure-fit/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await appImport('/src/preview/sampleProject.ts');
    const ps = await appImport('/src/store/useProjectsStore.ts');
    localStorage.clear();
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
    // NEMA 4X in the 16x12 stainless: far too small for the example's parts
    const { useElectricalStore } = await appImport('/src/store/useElectricalStore.ts');
    const el = useElectricalStore.getState();
    const d = el.design;
    el.setInputs({ ...el.inputs, enclosureRating: 'NEMA 4X' });
    el.setDesign({ ...d, inputs: { ...d.inputs, enclosureRating: 'NEMA 4X' }, components: d.components.map((c) => (c.tag === 'ENC1' ? { ...c, partNumber: 'SCE-16EL1206SSLP' } : c.tag === 'SP1' ? { ...c, partNumber: 'SCE-16P12' } : c)) }, 'generated', null);
  });
  await page.goto(BASE + '/electrical?tab=picture');
  const banner = page.getByTestId('enclosure-fit-banner');
  await banner.waitFor({ timeout: 20000 });
  const text = await banner.innerText();
  log('Banner:', text.replace(/\s+/g, ' ').slice(0, 300));
  check(/Parts don't fit the enclosure/.test(text), 'banner headline');
  check(await banner.getByRole('button', { name: /^Use a larger NEMA 4X/ }).count() === 1, 'larger stainless option');
  check(await banner.getByRole('button', { name: /^Relax to NEMA 12/ }).count() === 1, 'relax option');
  check(/Split into two enclosures/.test(text), 'split option');
  await page.screenshot({ path: OUT + '01-banner.png' });

  await banner.getByRole('button', { name: /^Use a larger NEMA 4X/ }).click();
  await banner.waitFor({ state: 'detached', timeout: 20000 });
  const enc = await page.evaluate(async () => {
    const { useElectricalStore } = await appImport('/src/store/useElectricalStore.ts');
    const { getPart } = await appImport('/src/electrical/catalog.ts');
    const c = useElectricalStore.getState().design.components.find((x) => x.tag === 'ENC1');
    return { pn: c.partNumber, material: getPart(c.partNumber)?.ratings.material };
  });
  log('Enclosure now:', enc.pn, enc.material);
  check(/stainless/.test(String(enc.material)) && enc.pn !== 'SCE-16EL1206SSLP', 'a larger stainless enclosure');
  await page.screenshot({ path: OUT + '02-fixed.png' });

  // The Enclosure control: the pick from the banner is the designer's choice now; pick a much bigger size -> kept,
  // with a "bigger than needed" note; pick the 16x12 -> bumped to the smallest that works, with a note.
  const control = page.getByTestId('enclosure-control');
  await control.waitFor();
  log('Enclosure control:', (await control.innerText()).replace(/\s+/g, ' ').slice(0, 200));
  const size = control.getByLabel('Enclosure size');
  const options = await size.locator('option').allInnerTexts();
  log('Size options:', options.length, '|', options.slice(0, 3).join(' | '));
  check(options.length > 10 && options.some((o) => /★ .* — recommended$/.test(o)), 'size list with the recommended one marked');
  await size.selectOption('SCE-48EL3612SSLP');
  await page.getByTestId('enclosure-note').filter({ hasText: 'bigger than needed' }).waitFor({ timeout: 20000 });
  check(/SCE-48EL3612SSLP/.test(await page.getByTestId('enclosure-current').innerText()), 'bigger pick kept');
  await page.screenshot({ path: OUT + '03-bigger.png' });
  await size.selectOption('SCE-16EL1206SSLP');
  await page.getByTestId('enclosure-note').filter({ hasText: 'was too small for the parts' }).waitFor({ timeout: 20000 });
  const cur = await page.getByTestId('enclosure-current').innerText();
  log('After a too-small pick:', cur, '|', await page.getByTestId('enclosure-note').innerText());
  check(!/SCE-16EL1206SSLP/.test(cur), 'too-small pick bumped');
  check(await page.getByTestId('enclosure-fit-banner').count() === 0, 'no fit banner after the bump');
  const pref = await page.evaluate(async () => (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState().inputs.enclosurePreference);
  check(pref === 'SCE-16EL1206SSLP', 'the pick stays recorded: ' + pref);
  await page.screenshot({ path: OUT + '04-too-small.png' });

  check(!errors.length, 'no browser errors: ' + errors.join(' | '));
  await browser.close();
  log('enclosure-fit E2E passed');
})().catch((e) => { console.error(e); process.exit(1); });
