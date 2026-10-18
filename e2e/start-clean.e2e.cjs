// A project copied from the example, with the user's own description: the leftover warnings show
// (program notes, electrical motors), "Start clean from my description" lists the example's parts,
// clears them (backup first) keeping the description and the I/O list, and offers to build again.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/start-clean.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };
const OWN = 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple.';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
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

  // The example itself: nothing to clean (the page has loaded once its title is there).
  await page.locator('main h1, main h2').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  check(await page.getByTestId('start-clean').count() === 0, 'no banner on the example itself');

  // A copy of the example, then the user's own description and program notes copied along.
  await page.evaluate(async ({ own }) => {
    const ps = await appImport('/src/store/useProjectsStore.ts');
    const { data } = ps.activeProjectData();
    ps.addProjectFromData('Sealing Head', data);
    const { useSpecStore } = await appImport('/src/store/useSpecStore.ts');
    const { EMPTY_SECTIONS } = await appImport('/src/spec/types.ts');
    useSpecStore.getState().setSections({ ...EMPTY_SECTIONS, overview: own });
    (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().setUserPrompt('Conveyor pusher: keep the pusher retracted while the conveyor runs; batch counter on the photo-eye.');
  }, { own: OWN });

  // The leftover warnings (Electrical motors, Program notes).
  await page.goto(BASE + '/electrical?tab=design');
  // Wait for the state, not a fixed time (flaky under load).
  await page.getByTestId('leftover-motor').first().waitFor({ timeout: 15000 }).catch(() => {});
  check(await page.getByTestId('leftover-motor').count() > 0, 'Electrical: leftover motor warning');
  await page.goto(BASE + '/program');
  await page.waitForTimeout(800);
  const describe = page.getByRole('button', { name: 'Build', exact: true });
  if (await describe.count()) await describe.first().click();
  await page.getByTestId('leftover-notes').first().waitFor({ timeout: 15000 }).catch(() => {});
  check(await page.getByTestId('leftover-notes').count() > 0, 'Program: leftover notes warning');

  // The Sealing Head case: the user rewrote the overview; the other sections are still the example's.
  await page.evaluate(async ({ own }) => {
    const { useSpecStore } = await appImport('/src/store/useSpecStore.ts');
    const { SPEC } = await appImport('/src/preview/sampleProject.ts');
    useSpecStore.getState().setSections({ ...SPEC, overview: own });
  }, { own: OWN });

  // The banner on the description page.
  await page.goto(BASE + '/spec');
  const banner = page.getByTestId('start-clean');
  await banner.waitFor({ timeout: 15000 });
  const text = (await banner.innerText()).replace(/\s+/g, ' ');
  log('Banner:', text.slice(0, 260));
  for (const part of ['description sections still the example', 'sequence of operation', "the example's I/O list (9 conveyor points)", 'document control', 'Example Foods Inc.', '24-117', 'drawing prefix CNV', 'revision history', 'equipment suggestion', 'electrical design', 'HMI screens', 'PLC program']) check(text.includes(part), `banner names ${part}`);

  const before = await page.evaluate(async () => ({
    io: (await appImport('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length,
    backups: Object.keys(localStorage).filter((k) => k.startsWith('plc-backup:')).length,
  }));
  // Reload: the banner is still there while the leftovers remain.
  await page.reload();
  await page.getByTestId('start-clean').waitFor({ timeout: 15000 }).catch(() => {});
  check(await page.getByTestId('start-clean').count() === 1, 'banner still shown after a reload');
  await banner.getByRole('button', { name: 'Start clean from my description' }).click();
  check(await banner.getByLabel('Make it again from the description').isChecked(), "the example's I/O is made again by default");
  check(await banner.getByLabel("Empty the description sections that are still the example's text").isChecked(), 'example sections emptied by default');
  await banner.getByRole('button', { name: "Clear the example's parts" }).click();
  await page.waitForTimeout(500);

  const after = await page.evaluate(async () => {
    const io = (await appImport('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length;
    const el = (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState();
    const hmi = (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState();
    const prog = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    const proj = (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const spec = (await appImport('/src/store/useSpecStore.ts')).useSpecStore.getState().sections;
    const stages = (await appImport('/src/spec/useStages.ts')).stagesNow();
    const info = proj.info;
    const filled = Object.entries(spec).filter(([k, v]) => k !== 'qa' && String(v).trim()).map(([k]) => k);
    return {
      io, design: Boolean(el.design), motors: el.inputs.motors.length, hmi: Boolean(hmi.design), rungs: prog.ladder.rungs.length, notes: prog.userPrompt,
      rec: Boolean(proj.recommendation), overview: spec.overview, backups: Object.keys(localStorage).filter((k) => k.startsWith('plc-backup:')).length,
      filled,
      doc: { customer: info.customer, site: info.site, projectNumber: info.projectNumber, prefix: info.drawingPrefix, revisions: info.revisions.length },
      stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, v.status])),
    };
  });
  log('After:', JSON.stringify(after));
  check(after.io === 0 && before.io === 9, `the example's I/O list cleared to be made again (${before.io} → ${after.io})`);
  check(after.filled.join() === 'overview', `only the user's overview is left in the description (${after.filled.join()})`);
  check(after.overview === OWN, 'description kept');
  check(!after.design && !after.motors && !after.hmi && !after.rungs && !after.notes && !after.rec, "the example's outputs are cleared");
  check(!after.doc.customer && !after.doc.site && !after.doc.projectNumber && after.doc.prefix === 'SH' && after.doc.revisions === 0, `the example's document control is reset (prefix from the name, no revisions): ${JSON.stringify(after.doc)}`);
  const cover = await page.evaluate(async () => { const { currentRevision } = await appImport('/src/store/useProjectStore.ts'); return currentRevision((await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().info).rev; });
  check(cover === 'A', 'starts at Rev A');
  check(after.backups === before.backups + 1, 'a backup was taken first');
  check(after.stages.electrical === 'empty' && after.stages.hmi === 'empty' && after.stages.program === 'empty', 'electrical, HMI and program are to do');
  const done = (await page.getByTestId('start-clean').innerText()).replace(/\s+/g, ' ');
  check(/Cleared/.test(done) && /Build everything from my description/.test(done), 'offers to build everything again');
  // Project data (the title-block fields every drawing and the machine spec use).
  await page.goto(BASE + '/project');
  await page.waitForTimeout(800);
  const fields = (await page.locator('main input').evaluateAll((els) => els.map((e) => e.value))).join(' | ').toUpperCase();
  check(!/EXAMPLE FOODS|LINE 3|24-117|\bCNV\b/.test(fields), `Project data no longer holds the example's customer, site, job or prefix: ${fields.slice(0, 200)}`);
  check(/\bSH\b/.test(fields), 'drawing prefix from the project name (SH)');

  // The banner stays (with the build offer) across pages and reloads until closed.
  await page.goto(BASE + '/io');
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(600);
  check(/Build everything from my description/.test(await page.getByTestId('start-clean').innerText()), 'build offer kept across pages');

  // Build everything: the AI fails (bad request) → the Update dialog shows it, the banner names what was not built.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('plc-settings-store') || '{"state":{},"version":4}');
    s.state = { ...s.state, provider: 'anthropic', anthropicApiKey: 'sk-ant-test' };
    localStorage.setItem('plc-settings-store', JSON.stringify(s));
  });
  await page.route('https://api.anthropic.com/**', (r) => r.fulfill({ status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'test: bad request' } }) }));
  await page.reload();
  await page.waitForTimeout(800);
  await page.getByTestId('start-clean').getByRole('button', { name: 'Build everything from my description' }).click();
  await page.getByText('Building the project from your description').waitFor({ timeout: 10000 });
  await page.getByTestId('start-clean').filter({ hasText: /Not built|Nothing was built|Built from/ }).waitFor({ timeout: 60000 });
  const built = (await page.getByTestId('start-clean').innerText()).replace(/\s+/g, ' ');
  log('After the build:', built.slice(0, 200));
  check(/Not built: Equipment/.test(built), 'failed stage named with its error');
  check(!/\bio done\b|\bequipment failed\b/.test(built), 'no internal stage ids');
  check(/Try again/.test(built), 'offers to try again');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForTimeout(800);
  check(/Not built/.test(await page.getByTestId('start-clean').innerText()), 'build outcome kept after a reload');
  await page.getByTestId('start-clean').getByRole('button', { name: 'Close' }).click();
  check(await page.getByTestId('start-clean').count() === 0, 'no banner once closed and cleaned');
  await page.goto(BASE + '/electrical?tab=design');
  await page.waitForTimeout(800);
  check(await page.getByTestId('leftover-motor').count() === 0, 'no leftover motor warning after cleaning');

  // The other ways a project becomes a copy of the example: the example edited in place (detached into
  // its own project by the next seeding) and the example saved as a .isap file and opened again.
  for (const how of ['edited example', '.isap reopened']) {
    await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
    await page.goto(BASE + '/spec');
    await page.locator('select[aria-label="Open project"]').selectOption('p_example');
    await page.evaluate(async ({ how, own }) => {
      const ps = await appImport('/src/store/useProjectsStore.ts');
      const { useSpecStore } = await appImport('/src/store/useSpecStore.ts');
      if (how === '.isap reopened') {
        const pf = await appImport('/src/project/projectFile.ts');
        await pf.openProjectFile((await pf.buildProjectFile()).blob);
      }
      ps.useProjectsStore.getState().renameActive('Sealing Head');
      useSpecStore.getState().setSections({ ...useSpecStore.getState().sections, overview: own });
      if (how === 'edited example') (await appImport('/src/preview/sampleProject.ts')).seedSampleProject();
    }, { how, own: OWN });
    await page.goto(BASE + '/spec');
    await page.waitForTimeout(800);
    const b = page.getByTestId('start-clean');
    const active = await page.evaluate(async () => (await appImport('/src/store/useProjectsStore.ts')).useProjectsStore.getState().activeId);
    check(active !== 'p_example', `${how}: a project of its own (${active})`);
    check(/document control/.test(await b.innerText().catch(() => '')), `${how}: banner lists the document control`);
    await b.getByRole('button', { name: 'Start clean from my description' }).click();
    await b.getByRole('button', { name: "Clear the example's parts" }).click();
    await page.reload();
    await page.waitForTimeout(800);
    const doc = await page.evaluate(async () => { const i = (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState().info; return { c: i.customer, s: i.site, n: i.projectNumber, p: i.drawingPrefix, by: i.preparedBy, r: i.revisions.length }; });
    log(`${how}: document control after Start clean and a reload: ${JSON.stringify(doc)}`);
    check(!doc.c && !doc.s && !doc.n && doc.p === 'SH' && !doc.by && doc.r === 0, `${how}: document control reset`);
  }

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('copied-from-example project cleaned: overview kept, example sections, I/O and document control cleared; build outcome reported');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
