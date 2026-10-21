// "Reorganize program" on the Program page: the example's changes listed with a checkbox each (removals of
// registers and never-true rungs off by default), checked in the simulator, proposed, approved; History has the old one.
// On a 4,000-rung program the check runs in a worker, shows its progress and stops on Cancel.
//   npm run dev -- --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/tidy-reorganize.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
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
  const before = await page.evaluate(async () => {
    (await appImport('/src/store/useSettingsStore.ts')).useSettingsStore.setState({ anthropicApiKey: '' });
    const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    return { ladder: st.ladder, versions: st.versions.length };
  });
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Change', exact: true }).first().click();
  await page.getByRole('button', { name: 'Reorganize program…' }).click();
  const panel = page.getByRole('group', { name: 'Reorganize' });
  await panel.waitFor({ timeout: 10000 });
  check(await panel.getByRole('checkbox').count() === 8, 'each change has its own checkbox (the example has one long rung to split)');
  check(!(await panel.getByLabel(/Split \d+ long rung/).isChecked().catch(() => true)), 'splitting long rungs is off by default');
  check(!(await panel.getByLabel(/registers or retentive memory/).isChecked().catch(() => true)) && !(await panel.getByLabel(/can never be true/).isChecked().catch(() => true)), 'registers and never-true removals are off by default');
  await panel.getByRole('button', { name: 'Check and propose' }).click();
  const approve = page.getByRole('button', { name: 'Approve', exact: true });
  await approve.waitFor({ timeout: 60000 });
  check(await page.getByText(/Same behaviour in \d+ test sequences \([^)]*0 differences/).count() > 0, 'the proposal says what the simulator check found');
  await approve.click();
  const after = await page.evaluate(async () => {
    const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    return { ladder: st.ladder, versions: st.versions.length };
  });
  const outs = (l) => l.rungs.flatMap((r) => r.outputs.map((o) => o.address || o.dest || '')).filter(Boolean).sort().join();
  check(outs(after.ladder) === outs(before.ladder), 'every output instruction is still there (no removal by default here)');
  check((after.ladder.blocks || []).length >= 3 && after.ladder.rungs.every((r) => r.comment.trim()), 'grouped by function, every rung commented');
  check(after.versions === before.versions + 1, 'the program before it is in History');

  // A synthetic 4,000-rung program: the check runs in a worker; the job bar counts the sequences, the page stays
  // responsive, and Cancel stops it with nothing proposed.
  await page.evaluate(async () => {
    const { l5x } = await appImport('/src/plc/import/__fixtures__/bigPrograms.ts');
    const { importProgramFiles } = await appImport('/src/plc/import/index.ts');
    const { applyUpgrade } = await appImport('/src/plc/import/ui/applyUpgrade.ts');
    applyUpgrade(importProgramFiles([{ name: 'big.L5X', text: l5x(80, 120) }]).program);
  });
  const big = await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder.rungs.length);
  check(big === 4000, `the synthetic program has ${big} rungs`);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Change', exact: true }).first().click();
  await page.getByRole('button', { name: 'Reorganize program…' }).click();
  await panel.waitFor({ timeout: 30000 });
  await panel.getByRole('button', { name: 'Check and propose' }).click();
  await page.getByText(/checking in the simulator, sequence \d+ of \d+/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const t0 = Date.now();
  await page.evaluate(() => 1);
  const lag = Date.now() - t0;
  check(lag < 500, `the page answers while the check runs (${lag} ms)`);
  const progress = await page.getByText(/checking in the simulator, sequence \d+ of \d+/).first().textContent();
  console.log(`    ${progress.replace(/.*(sequence \d+ of \d+).*/, '$1')} after ~2 s`);
  await page.getByRole('button', { name: 'Cancel Reorganize program' }).first().click();
  await page.waitForTimeout(1000);
  check(await page.getByText(/checking in the simulator/).count() === 0, 'Cancel stops the check');
  check(await page.getByRole('button', { name: 'Approve', exact: true }).count() === 0, 'nothing proposed after Cancel');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('tidy-reorganize e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
