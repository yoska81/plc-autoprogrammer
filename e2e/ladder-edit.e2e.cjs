// Building the ladder by hand on the Program page, with the always-visible "Edit ladder" bar:
// an empty program → three rungs drawn with the bar (contacts NO / NC, a branch, a coil, a timer), every address
// picked from the project's I/O list; one contact edited; one rung deleted; Delete removes a selected contact;
// undo / redo; the edits reach the cross reference and the exported program files. Then the same picker on a
// Siemens S7 project offers the S7's own addresses (%I0.0 …) and the TIA Portal export reads the picked input;
// last, an imported Studio 5000 program, once applied, is edited with the same tools.
//   npx vite --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/ladder-edit.e2e.cjs
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const OUT = __dirname + '/out-ladder-edit/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.locator('main h1, main h2').first().waitFor({ timeout: 15000 });
  // A copy of the example (its I/O list and CLICK PLC) with no program.
  await page.evaluate(async () => {
    const ps = await appImport('/src/store/useProjectsStore.ts');
    ps.addProjectFromData('Hand Ladder', ps.activeProjectData().data);
    (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().clearLadder();
  });
  const ladder = () => page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder);
  const addr = (e) => (e.type === 'CMP' ? e.left : e.type === 'COPY' || e.type === 'MATH' ? e.dest : e.address);

  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Start empty program' }).click();
  const bar = page.getByTestId('ladder-edit-bar');
  await bar.waitFor({ timeout: 10000 });
  check(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), '"Start empty program" is a hand edit: Undo takes it back');
  check(await bar.getByRole('button', { name: 'Add rung' }).isVisible(), 'the edit bar shows without clicking a rung first');
  const rungEls = page.locator('[data-rung-id]');
  const rung = (n) => rungEls.nth(n);
  // A rung is selected by its number (the gutter on the left).
  // (scrolled to the middle of the pane first: at its top edge the sticky edit bar covers it)
  const selectRung = async (n) => {
    await rung(n).evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'start' }));
    await rung(n).click({ position: { x: 20, y: 44 }, timeout: 8000 });
  };
  /** Click an item of rung n, pick an address from the I/O list (the option at `pick`, or one matching a pattern), close the editor. */
  const setAddress = async (n, sel, pick) => {
    await rung(n).locator(sel).getByRole('button').click();
    const picker = page.getByTestId('ladder-address-pick');
    await picker.waitFor({ timeout: 5000 });
    const options = (await picker.locator('option').allInnerTexts()).slice(1);
    const choice = typeof pick === 'number' ? options[pick] : options.find((o) => pick.test(o));
    if (!choice) throw new Error(`no address ${pick} in ${options.slice(0, 6).join(' | ')}`);
    // The program keeps the app's address (X001); the list shows the PLC's own name (%I0.0 on an S7).
    const value = await picker.locator('option', { hasText: choice }).first().getAttribute('value');
    await picker.selectOption({ label: choice });
    await page.getByRole('button', { name: 'Done' }).click();
    return value;
  };
  const pickerOptions = async (n, sel) => {
    await rung(n).locator(sel).getByRole('button').click();
    const opts = (await page.getByTestId('ladder-address-pick').locator('option').allInnerTexts()).slice(1);
    await page.keyboard.press('Escape');
    return opts;
  };

  // Rung 1: start (NO) and stop (NC) in series, a seal-in branch, the motor coil.
  await selectRung(0);
  const in1 = await setAddress(0, '[data-ladder-item="0.0"]', /^X0*1\b/);
  await bar.getByRole('button', { name: 'Contact (NC)' }).click();
  const in2 = await setAddress(0, '[data-ladder-item="0.1"]', /^X0*2\b/);
  await bar.getByRole('button', { name: 'Branch' }).click();
  await rung(0).locator('[data-ladder-output="0"]').getByRole('button').click();
  const coilChoices = (await page.getByTestId('ladder-address-pick').locator('option').allInnerTexts()).slice(1);
  check(coilChoices.length > 0 && !coilChoices.some((o) => /^X\d/.test(o)), `a coil is offered outputs and bits only (${coilChoices.length}, no X inputs)`);
  await page.keyboard.press('Escape');
  const out1 = await setAddress(0, '[data-ladder-output="0"]', /^Y/);
  await setAddress(0, '[data-ladder-item="1.0"]', new RegExp(`^${out1}\\b`));
  log('rung 1:', in1, in2, out1);
  // Rung 2: a contact and a timer.
  await bar.getByRole('button', { name: 'Add rung' }).click();
  await setAddress(1, '[data-ladder-item="0.0"]', /^X0*3\b/);
  await rung(1).locator('[data-ladder-output="0"]').getByRole('button').click();
  await page.getByRole('button', { name: 'Delete this output' }).click();
  await bar.getByRole('button', { name: 'Timer' }).click();
  await rung(1).locator('[data-ladder-output="0"]').getByRole('button').click();
  check(await page.getByTestId('ladder-address-pick').count() === 0, 'a timer is not offered the I/O list');
  await page.keyboard.press('Escape');
  // Rung 3: a contact and a coil.
  await bar.getByRole('button', { name: 'Add rung' }).click();
  await setAddress(2, '[data-ladder-item="0.0"]', /^X0*4\b/);
  const out3 = await setAddress(2, '[data-ladder-output="0"]', /^Y0*2\b/);
  let l = await ladder();
  log('built:', l.rungs.map((r) => `${r.branches.map((b) => b.map((e) => `${e.type} ${addr(e)}`).join(' & ')).join(' | ')} → ${r.outputs.map((o) => `${o.type} ${addr(o)}`).join(', ')}`).join('  ;  '));
  check(l.rungs.length === 3, `three rungs built by hand (${l.rungs.length})`);
  check(l.rungs[0].branches.length === 2 && l.rungs[0].branches[0].map((e) => e.type).join() === 'NO,NC', 'rung 1: NO + NC in series, a parallel branch');
  check(l.rungs[1].outputs.length === 1 && l.rungs[1].outputs[0].type === 'TMR', 'rung 2: the coil replaced by a timer');
  check(l.rungs[0].branches[0][0].address === in1 && l.rungs[0].outputs[0].address === out1, 'addresses picked from the I/O list');
  await page.screenshot({ path: OUT + 'built.png' });

  // Edit one contact: rung 1's start contact now reads X005.
  const edited = await setAddress(0, '[data-ladder-item="0.0"]', /^X0*5\b/);
  l = await ladder();
  check(l.rungs[0].branches[0][0].address === edited && edited !== in1, `contact edited ${in1} → ${edited}`);

  // Delete removes the selected contact; undo brings it back; redo removes it again.
  await selectRung(2);
  await bar.getByRole('button', { name: 'Contact (NO)' }).click();
  await rung(2).locator('[data-ladder-item="0.1"]').getByRole('button').click();
  await page.keyboard.press('Escape');
  check(await bar.getByRole('button', { name: 'Delete selected' }).isEnabled(), 'a clicked contact stays selected after its editor closes');
  await page.keyboard.press('Delete');
  check((await ladder()).rungs[2].branches[0].length === 1, 'the Delete key removes the selected contact');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  check((await ladder()).rungs[2].branches[0].length === 2, 'Undo brings it back');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  check((await ladder()).rungs[2].branches[0].length === 1, 'Redo removes it again');

  // The Delete key acts only on a selection the user can see.
  const n3 = async () => (await ladder()).rungs[2].branches[0].length;
  const item3 = (i) => rung(2).locator(`[data-ladder-item="0.${i}"]`).getByRole('button');
  await selectRung(2);
  await bar.getByRole('button', { name: 'Contact (NO)' }).click();
  await item3(1).click();
  await page.keyboard.press('Escape');
  await selectRung(1);
  await page.keyboard.press('Delete');
  check(await n3() === 2, 'Delete does nothing once another rung is selected');
  await item3(1).click();
  await page.keyboard.press('Escape');
  for (const k of ['Control+Delete', 'Shift+Delete', 'Alt+Delete']) await page.keyboard.press(k);
  check(await n3() === 2, 'Ctrl / Shift / Alt + Delete do not delete');
  await page.getByRole('button', { name: 'Zoom in' }).focus();
  await page.keyboard.press('Delete');
  check(await n3() === 2, 'Delete with the focus on a page button outside the ladder does nothing');
  // After an undo the place holds another item: the selection is gone, nothing else is deleted.
  await item3(0).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  check(await n3() === 1, 'Delete removes the selected first contact');
  await item3(0).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await selectRung(2);
  await page.keyboard.press('Delete');
  check(await n3() === 2, 'after Undo, Delete does not remove the contact now in the selected one\'s place');

  // Insert above, move, delete a rung.
  await selectRung(1);
  await bar.getByRole('button', { name: 'Insert rung above' }).click();
  check((await ladder()).rungs.length === 4, 'a rung inserted above the selected one');
  await bar.getByRole('button', { name: 'Delete rung' }).click();
  await selectRung(1);
  await bar.getByRole('button', { name: 'Delete rung' }).click();
  l = await ladder();
  check(l.rungs.length === 2 && l.rungs[1].outputs[0].address === out3, 'rung 2 (the timer) deleted, rung 3 moved up');
  await selectRung(1);
  await bar.getByRole('button', { name: 'Move up' }).click();
  check((await ladder()).rungs[0].outputs[0].address === out3, 'Move up');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();

  // History: a version before the first hand edit and before a rung was deleted.
  const versions = await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().versions.map((v) => v.label));
  check(versions.includes('Before hand edits') && versions.includes('Before deleting a rung'), `History has "Before hand edits" and "Before deleting a rung" (${versions.slice(0, 4).join(', ')})`);

  // While the AI works on the program, hand edits are paused (its result would replace them).
  await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().setIsGenerating(true));
  await page.getByText('Hand edits are paused').waitFor({ timeout: 5000 });
  check(await page.getByTestId('ladder-edit-bar').count() === 0, 'no edit bar while the AI is working');
  const beforeZ = JSON.stringify(await ladder());
  await selectRung(0);
  await page.keyboard.press('Control+z');
  check(JSON.stringify(await ladder()) === beforeZ, 'Ctrl+Z does nothing while the AI is working');
  await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().setIsGenerating(false));
  await bar.waitFor({ timeout: 5000 });

  // The cross reference sees the edit.
  await page.getByRole('button', { name: 'Cross reference' }).click();
  await page.waitForTimeout(300);
  const xref = await page.locator('main').innerText();
  check(xref.includes(edited), `the cross reference lists ${edited}`);
  await page.getByRole('button', { name: 'Close cross reference' }).click();

  // Export: the program files carry the hand-drawn program.
  await page.goto(BASE + '/export');
  await page.getByText('PLC program', { exact: true }).first().waitFor({ timeout: 15000 });
  const anyway = page.getByLabel('Export anyway');
  if (await anyway.count()) { log('export checker:', (await page.getByRole('alert').filter({ hasText: 'The checker finds' }).innerText()).replace(/\s+/g, ' ').slice(0, 200)); await anyway.check(); }
  await page.screenshot({ path: OUT + 'export.png', fullPage: true });
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /_program\.json$/ }).click()]);
  const json = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  check(json.rungs.length === 2 && json.rungs[0].branches[0][0].address === edited, 'the exported program has the 2 rungs and the edited contact');
  const [t] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /_rungs\.txt$/ }).click()]);
  check(fs.readFileSync(await t.path(), 'utf8').includes(edited), 'the CLICK rung listing has the edited contact');

  // Siemens: the picker offers the S7's own addresses and the edit lands in the program.
  // The example's points carry CLICK addresses of their own: cleared, so the S7 assigns %I / %Q.
  await page.evaluate(async () => {
    (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
    const { useIOStore } = await appImport('/src/store/useIOStore.ts');
    useIOStore.setState((s) => ({ projectIO: s.projectIO.map((p) => ({ ...p, plcAddress: undefined })) }));
  });
  await page.goto(BASE + '/program');
  await page.getByTestId('ladder-edit-bar').waitFor({ timeout: 10000 });
  log('after reload:', JSON.stringify(await page.evaluate(async () => ({ plc: (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().plcId, io: (await appImport('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.slice(0, 2).map((p) => p.plcAddress), tags: (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder.tags.slice(0, 2) }))));
  const s7 = await pickerOptions(0, '[data-ladder-item="0.0"]');
  log('S7 choices:', s7.slice(0, 4).join(' | '));
  check(s7.some((o) => /^%I0\.0\b/.test(o)) && s7.some((o) => /^%Q0\.0\b/.test(o)), 'Siemens: the I/O list in %I / %Q addresses');
  const s7addr = await setAddress(0, '[data-ladder-item="0.0"]', /^%I0\.1\b/);
  check((await ladder()).rungs[0].branches[0][0].address === s7addr, `Siemens: contact set to %I0.1 (${s7addr} in the program)`);
  // An S7 address typed by hand becomes the app's address of that terminal.
  await rung(0).locator('[data-ladder-item="0.0"]').getByRole('button').click();
  await page.getByRole('dialog').getByPlaceholder('X001').fill('%I0.2');
  await page.getByRole('button', { name: 'Done' }).click();
  check((await ladder()).rungs[0].branches[0][0].address === 'X003', `Siemens: "%I0.2" typed by hand is stored as X003 (${(await ladder()).rungs[0].branches[0][0].address})`);
  await page.screenshot({ path: OUT + 'siemens.png' });
  await page.goto(BASE + '/export');
  await page.getByText('PLC program', { exact: true }).first().waitFor({ timeout: 15000 });
  if (await page.getByLabel('Export anyway').count()) await page.getByLabel('Export anyway').check();
  const [scl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /_s7\.scl$/ }).click()]);
  const sclText = fs.readFileSync(await scl.path(), 'utf8');
  fs.writeFileSync(OUT + 'program_s7.scl', sclText);
  const [sdf] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /_PLCTags\.sdf$/ }).click()]);
  const tagLine = fs.readFileSync(await sdf.path(), 'utf8').split(/\r?\n/).find((x) => /%I0\.1\b/.test(x)) ?? '';
  const tag = (tagLine.match(/"([^"]+)"/) || [])[1] ?? '';
  log('S7 tag for %I0.1:', tagLine.trim().slice(0, 100));
  check(Boolean(tag) && new RegExp(`#${tag}\\b`).test(sclText.split('BEGIN').slice(1).join('BEGIN')), `Siemens: the TIA Portal source reads ${tag || 'the tag'} (%I0.1)`);

  // An imported program, once it is the project's: the same tools edit it (here an exported Studio 5000 program).
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('program-file').setInputFiles(__dirname + '/../src/plc/import/__fixtures__/capper.L5X');
  await page.getByTestId('program-found').waitFor({ timeout: 15000 });
  await page.getByTestId('program-apply').click();
  await page.waitForTimeout(1000);
  const before = await ladder();
  await page.goto(BASE + '/program');
  await page.getByTestId('ladder-edit-bar').waitFor({ timeout: 10000 });
  await selectRung(0);
  await page.getByTestId('ladder-edit-bar').getByRole('button', { name: 'Add rung' }).click();
  const picked = await setAddress(1, '[data-ladder-item="0.0"]', 0);
  const after = await ladder();
  log('imported program:', before.rungs.length, 'rungs →', after.rungs.length, '| new rung 2 reads', picked);
  check(after.rungs.length === before.rungs.length + 1 && addr(after.rungs[1].branches[0][0]) === picked, 'imported program: a rung added below rung 1 and its contact set from the list');
  check(JSON.stringify(after.rungs.filter((r) => r.id !== after.rungs[1].id)) === JSON.stringify(before.rungs), 'imported program: the other rungs are untouched');

  // A phone: with another pane shown, the hidden ladder does not take Delete.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/program');
  await page.locator('[data-phone-tabs] [role="tab"]').first().waitFor({ timeout: 10000 });
  const tabs = await page.locator('[data-phone-tabs] [role="tab"]').allInnerTexts();
  await page.locator('[data-phone-tabs] [role="tab"]', { hasText: /ladder|program/i }).first().click();
  await rung(1).locator('[data-ladder-item="0.0"]').getByRole('button').click();
  await page.keyboard.press('Escape');
  const phoneBefore = JSON.stringify(await ladder());
  await page.locator('[data-phone-tabs] [role="tab"]', { hasText: /blocks/i }).first().click();
  await page.keyboard.press('Delete');
  check(JSON.stringify(await ladder()) === phoneBefore, `phone: Delete does nothing while another pane (${tabs.find((t) => /blocks/i.test(t))}) is shown`);
  await page.setViewportSize({ width: 1440, height: 900 });

  log('Page errors:', errors.length ? errors : 'none');
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('ladder-edit e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
