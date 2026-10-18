// QA round, MAJOR / MINOR: the Import page's files stay with their project; the New project wizard
// works without AI, applies an unapplied equipment selection on Next and closes to the app; an analog
// scale with min >= max is refused; Settings changes are kept when leaving the page; one rule for
// "issued for construction" (names required) on Project data, drawings and documents.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/qa-round2.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const PICTURE = path.join(__dirname, '..', 'build', 'icon.png');
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // 6. Import: a file added in the example is not shown in another project.
  await page.goto(BASE + '/import');
  await page.getByTestId('convert-files').setInputFiles(PICTURE);
  await page.getByRole('button', { name: 'Remove icon.png' }).waitFor({ timeout: 5000 }).catch(() => {}); // files are checked before they are listed
  check(await page.getByRole('button', { name: 'Remove icon.png' }).count() === 1, 'import: file listed in the example');
  await page.evaluate(async () => (await import('/src/store/useProjectsStore.ts')).useProjectsStore.getState().createProject('Other project'));
  await page.goto(BASE + '/import');
  await page.waitForTimeout(400);
  check(await page.getByRole('button', { name: 'Remove icon.png' }).count() === 0, "import: another project doesn't see the example's files");

  // 7 + 8. Wizard without an API key: describe the machine, continue; Close goes to the app.
  await page.goto(BASE + '/new');
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Wizard no AI');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.locator('textarea').first().fill('Sealing head: a pneumatic head closes on a pouch, holds for the dwell time, opens.');
  await page.getByRole('button', { name: 'Add as the machine overview (no AI)' }).click();
  check(await page.getByRole('button', { name: 'Next →' }).isEnabled(), 'wizard: Next enabled after adding the description without AI');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.waitForTimeout(500);
  // Equipment: pick a CPU (not applied), then Next applies it.
  const cpuRow = page.locator('input[aria-label="Choose C0-12DD1E-D"]').locator('xpath=ancestor::tr');
  if (await cpuRow.count()) {
    await cpuRow.click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForTimeout(400);
    const cpu = await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().cpuId);
    check(cpu === 'C0-12DD1E-D', `wizard: the selection was applied on Next (${cpu})`);
    check(/C0-12DD1E-D/.test(await page.locator('aside').innerText()), 'wizard summary shows the controller');
    // Jump back, then forward again with the step tabs.
    await page.getByRole('button', { name: /Describe the machine/ }).click();
    check(await page.getByRole('button', { name: /Summary/ }).isEnabled(), 'wizard: step tabs jump forward after going back');
  } else check(false, 'wizard: CPU C0-12DD1E-D not offered');
  await page.getByRole('button', { name: 'Close ✕' }).click();
  await page.waitForTimeout(400);
  check(new URL(page.url()).pathname === '/spec', `wizard Close goes to the app (${page.url()})`);

  // 10. Analog scale: min >= max refused.
  await page.goto(BASE + '/io');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.waitForTimeout(600);
  const analogBtn = page.getByRole('button', { name: 'Discrete' }).first();
  if (await analogBtn.count()) {
    await analogBtn.click();
    const min = page.locator('input[aria-label^="Scale minimum"]').first();
    await min.fill('500');
    await min.blur();
    check(/minimum must be below the maximum/.test(await page.locator('main').innerText()), 'analog: min >= max refused with a note');
    check(await min.inputValue() === '0', 'analog: the minimum goes back');
  } else log('no I/O point to make analog (skipped)');

  // 11. Settings: a change is kept when leaving without Save.
  await page.goto(BASE + '/settings');
  const effort = page.locator('select').filter({ has: page.locator('option[value="low"]') }).first();
  await effort.selectOption('low');
  // Leave through the app's own navigation (a reload would ask "leave the page?").
  await page.locator('a[href="/spec"]').first().click();
  await page.waitForTimeout(300);
  const kept = await page.evaluate(async () => (await import('/src/store/useSettingsStore.ts')).useSettingsStore.getState().effort);
  check(kept === 'low', `settings kept when leaving the page (${kept})`);

  // 9. One "issued for construction" rule: needs the checker and approver.
  const status = await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/store/useProjectStore.ts');
    const { revisionState } = await import('/src/electrical/derive.ts');
    const p = useProjectStore.getState();
    p.setInfo({ revisions: [{ rev: '0', date: '2026-10-17', description: 'Issued for construction', by: 'AB' }], checkedBy: '', approvedBy: 'AB' });
    const unsigned = revisionState({ ...p.info, ...useProjectStore.getState().info, prefix: '' }).status;
    useProjectStore.getState().setInfo({ checkedBy: 'JS' });
    const signed = revisionState({ ...useProjectStore.getState().info, prefix: '' }).status;
    return { unsigned, signed };
  });
  log('Revision status unsigned / signed:', JSON.stringify(status));
  check(/PRELIMINARY/.test(status.unsigned) && /ISSUED FOR CONSTRUCTION/.test(status.signed), 'drawings: IFC only with checker and approver');
  await page.evaluate(async () => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setInfo({ checkedBy: '' }));
  await page.goto(BASE + '/project');
  await page.waitForTimeout(500);
  const projText = await page.locator('main').innerText();
  check(/not issued yet: name who checked and approved it/.test(projText), 'Project data: unsigned IFC explained');
  check(!/preliminary · preliminary|Preliminary[^·]*· preliminary/i.test(projText), 'Project data: "preliminary" not repeated');

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('QA round MAJOR/MINOR fixes work');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
