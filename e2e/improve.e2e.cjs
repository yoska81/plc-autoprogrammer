// Electrical → Improve design on the example project (dev build): cost-down (accept a line, checks re-run),
// what-if compare (480 V vs 240 V, NEMA 12 vs 4X, apply an option), the standard-panel library (save a panel
// and a motor starter, export / delete / import the file, add the starter, start a new project from the panel)
// and the spare-parts list (Excel + PDF here and on the Deliverables page). Page or console errors fail the run.
//
//   npx vite --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/improve.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-improve/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined)); // a prompt keeps its suggested text
  const store = (expr) => page.evaluate(`(async () => { const { useElectricalStore: E } = await import('/src/store/useElectricalStore.ts'); return ${expr}; })()`);
  const download = async (click, name) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), click()]);
    const file = OUT + (name ?? dl.suggestedFilename());
    await dl.saveAs(file);
    return file;
  };

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await import('/src/preview/sampleProject.ts');
    const ps = await import('/src/store/useProjectsStore.ts');
    localStorage.clear();
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
  });
  // 0. One price source: Sourcing, the order list and Compare ("As it is now") show the same total.
  const money = (t) => (/\$[\d,]+\.\d\d/.exec(t) || [''])[0];
  await page.goto(BASE + '/sourcing');
  const tSourcing = money(await page.getByTestId('sourcing-total').innerText());
  await page.goto(BASE + '/export');
  const tOrder = money(await page.getByTestId('order-total').innerText());
  await page.goto(BASE + '/electrical?tab=improve');
  const wi0 = page.getByRole('region', { name: 'Compare options' });
  await wi0.getByLabel('NEMA 1', { exact: true }).check();
  await wi0.getByRole('button', { name: 'Compare' }).click();
  await wi0.getByTestId('what-if-table').waitFor({ timeout: 30000 });
  const tCompare = money(await wi0.getByTestId('what-if-table').locator('tbody tr').first().locator('td').first().innerText());
  log('Totals: Sourcing', tSourcing, '| order list', tOrder, '| Compare', tCompare);
  check(tSourcing && tSourcing === tOrder && tOrder === tCompare, 'the same total on Sourcing, the order list and Compare');

  // Oversize the motor contactor and the power supply (as an edited design would be).
  await store(`(() => { const s = E.getState(); s.setDesign({ ...s.design, components: s.design.components.map((c) => c.tag === 'K1' ? { ...c, partNumber: 'SC-E04PG-24VDC' } : c.tag === 'PS1' ? { ...c, partNumber: 'PSR-24-240-3' } : c) }, 'generated', null); })()`);
  await page.goto(BASE + '/electrical?tab=improve');

  // 1. Cost-down
  const cd = page.getByRole('region', { name: 'Save money' });
  await cd.waitFor();
  const lines = cd.getByTestId('cost-down-line');
  check(await lines.count() >= 2, 'cost-down lines for K1 and PS1');
  const k1 = lines.filter({ hasText: 'K1 · Motor M1 contactor' });
  log('K1 line:', (await k1.innerText()).replace(/\s+/g, ' ').slice(0, 160));
  check(/saves \$31\.50/.test(await k1.innerText()), 'K1 saving shown');
  await k1.getByRole('button', { name: 'Accept K1' }).click();
  const status = await cd.getByRole('status').innerText();
  log('After accept:', status);
  check(/Checked again: 1 more/.test(status), 'checks re-run after accepting');
  check(await store(`E.getState().design.components.find((c) => c.tag === 'K1').partNumber`) === 'SC-E02PG-24VDC', 'K1 changed in the design');
  await page.screenshot({ path: OUT + '1-cost-down.png', fullPage: true });

  // 2. What-if compare
  const wi = page.getByRole('region', { name: 'Compare options' });
  await wi.getByLabel('NEMA 1', { exact: true }).uncheck();
  await wi.getByLabel('240 V 3-phase').check();
  await wi.getByLabel('NEMA 4X').check();
  await wi.getByRole('button', { name: 'Compare' }).click();
  const table = wi.getByTestId('what-if-table');
  await table.waitFor({ timeout: 30000 });
  const heads = await table.locator('thead th').allInnerTexts();
  log('Compared:', heads.filter(Boolean).join(' | '));
  check(heads.filter(Boolean).length === 4 && heads.includes('Redesigned by the rules, no change'), 'now (edited design), the rules design and two options side by side');
  const diff4x = await table.locator('tbody tr').filter({ hasText: 'Differences' }).locator('td').last().innerText();
  log('NEMA 4X:', diff4x);
  check(!/^Saves/.test(diff4x), 'no saving claimed for a stainless enclosure without a price');
  for (const r of ['Cost', 'Enclosure', 'Heat inside', 'Lead time', 'Parts']) check(await table.getByText(r, { exact: false }).count() > 0, `row ${r}`);
  await page.screenshot({ path: OUT + '2-what-if.png', fullPage: true });
  await table.getByRole('button', { name: 'Apply this option' }).last().click();
  check(await store(`E.getState().design.inputs.enclosureRating`) === 'NEMA 4X', 'option applied: NEMA 4X design');

  // 3. Library
  const lib = page.getByRole('region', { name: 'Panel library' });
  await lib.getByLabel('Library name').fill('Conveyor standard');
  await lib.getByRole('button', { name: 'Save to library' }).click();
  await lib.getByLabel('What to save').selectOption('motor-starter');
  await lib.getByLabel('Library name').fill('1 HP starter');
  await lib.getByRole('button', { name: 'Save to library' }).click();
  const list = lib.getByTestId('library-list').locator('li');
  check(await list.count() === 2, 'two library items');
  const libFile = await download(() => lib.getByRole('button', { name: 'Export library file' }).click());
  const json = JSON.parse(fs.readFileSync(libFile, 'utf8'));
  check(json.format === 'isa-panel-library' && json.items.length === 2, 'library file');
  await lib.getByRole('button', { name: 'Delete 1 HP starter' }).click();
  check(await list.count() === 1, 'deleted');
  await lib.getByLabel('Library file').setInputFiles(libFile);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="library-list"] li').length === 2);
  await list.filter({ hasText: '1 HP starter' }).getByRole('button', { name: 'Add to this design' }).click();
  check(await store(`E.getState().design.components.some((c) => c.motorTag === 'M2' && c.tag === 'K2')`), 'starter added as M2 / K2');
  await page.screenshot({ path: OUT + '3-library.png', fullPage: true });

  // 4. Spare parts
  const sp = page.getByRole('region', { name: 'Spare parts' });
  const rows = await sp.getByTestId('spares-table').locator('tbody tr').count();
  log('Spare lines:', rows);
  check(rows >= 8, 'spare parts listed');
  const xlsx = await download(() => sp.getByRole('button', { name: 'Excel' }).click());
  check(fs.readFileSync(xlsx).subarray(0, 2).toString() === 'PK', 'spares workbook');
  const pdf = await download(() => sp.getByRole('button', { name: 'PDF' }).click());
  check(fs.readFileSync(pdf).subarray(0, 5).toString() === '%PDF-', 'spares PDF');

  // Deliverables page has them too.
  await page.goto(BASE + '/export');
  const x2 = await download(() => page.getByRole('button', { name: 'Spare parts (Excel)' }).click(), 'deliverables_spares.xlsx');
  check(fs.statSync(x2).size > 4000, 'spares workbook from Deliverables');

  // 5. New project from the saved panel (prompt accepted with its default name).
  await page.goto(BASE + '/electrical?tab=improve');
  await page.getByRole('region', { name: 'Panel library' }).getByRole('button', { name: 'Start a new project from it' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('plc-projects') || '{}').state?.projects?.length === 2);
  const n = await store(`E.getState().design.components.length`);
  log('New project parts:', n);
  check(n > 20, 'new project has the saved design');
  check(await page.evaluate(async () => (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length) === 9, 'and its I/O list');

  check(!errors.length, 'no page errors: ' + errors.join(' | '));
  log('improve e2e passed');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
