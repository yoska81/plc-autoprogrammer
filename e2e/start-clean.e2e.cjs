// A project copied from the example, with the user's own description: the leftover warnings show
// (program notes, electrical motors), "Start clean from my description" lists the example's parts,
// clears them (backup first) keeping the description and the I/O list, and offers to build again.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/start-clean.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };
const OWN = 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple.';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // The example itself: nothing to clean.
  await page.waitForTimeout(500);
  check(await page.getByTestId('start-clean').count() === 0, 'no banner on the example itself');

  // A copy of the example, then the user's own description and program notes copied along.
  await page.evaluate(async ({ own }) => {
    const ps = await import('/src/store/useProjectsStore.ts');
    const { data } = ps.activeProjectData();
    ps.addProjectFromData('Sealing Head', data);
    const { useSpecStore } = await import('/src/store/useSpecStore.ts');
    const { EMPTY_SECTIONS } = await import('/src/spec/types.ts');
    useSpecStore.getState().setSections({ ...EMPTY_SECTIONS, overview: own });
    (await import('/src/store/useProgramStore.ts')).useProgramStore.getState().setUserPrompt('Conveyor pusher: keep the pusher retracted while the conveyor runs; batch counter on the photo-eye.');
  }, { own: OWN });

  // The leftover warnings (Electrical motors, Program notes).
  await page.goto(BASE + '/electrical?tab=design');
  await page.waitForTimeout(1000);
  check(await page.getByTestId('leftover-motor').count() > 0, 'Electrical: leftover motor warning');
  await page.goto(BASE + '/program');
  await page.waitForTimeout(800);
  const describe = page.getByRole('button', { name: 'Describe' });
  if (await describe.count()) await describe.first().click();
  await page.waitForTimeout(300);
  check(await page.getByTestId('leftover-notes').count() > 0, 'Program: leftover notes warning');

  // The banner on the description page.
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(600);
  const banner = page.getByTestId('start-clean');
  const text = (await banner.innerText()).replace(/\s+/g, ' ');
  log('Banner:', text.slice(0, 260));
  for (const part of ['document control', 'Example Foods Inc.', '24-117', 'drawing prefix CNV', 'revision history', 'equipment suggestion', 'electrical design', 'HMI screens', 'PLC program', 'program notes']) check(text.includes(part), `banner names ${part}`);

  const before = await page.evaluate(async () => ({
    io: (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length,
    backups: Object.keys(localStorage).filter((k) => k.startsWith('plc-backup:')).length,
  }));
  await banner.getByRole('button', { name: 'Start clean from my description' }).click();
  await banner.getByLabel('Keep my I/O list').check();
  await banner.getByRole('button', { name: "Clear the example's parts" }).click();
  await page.waitForTimeout(500);

  const after = await page.evaluate(async () => {
    const io = (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length;
    const el = (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState();
    const hmi = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState();
    const prog = (await import('/src/store/useProgramStore.ts')).useProgramStore.getState();
    const proj = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const spec = (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().sections;
    const stages = (await import('/src/spec/useStages.ts')).stagesNow();
    const info = proj.info;
    return {
      io, design: Boolean(el.design), motors: el.inputs.motors.length, hmi: Boolean(hmi.design), rungs: prog.ladder.rungs.length, notes: prog.userPrompt,
      rec: Boolean(proj.recommendation), overview: spec.overview, backups: Object.keys(localStorage).filter((k) => k.startsWith('plc-backup:')).length,
      doc: { customer: info.customer, site: info.site, projectNumber: info.projectNumber, prefix: info.drawingPrefix, revisions: info.revisions.length },
      stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, v.status])),
    };
  });
  log('After:', JSON.stringify(after));
  check(after.io === before.io && after.io > 0, 'I/O list kept');
  check(after.overview === OWN, 'description kept');
  check(!after.design && !after.motors && !after.hmi && !after.rungs && !after.notes && !after.rec, "the example's outputs are cleared");
  check(!after.doc.customer && !after.doc.site && !after.doc.projectNumber && after.doc.prefix === 'SH' && after.doc.revisions === 0, `the example's document control is reset (prefix from the name, no revisions): ${JSON.stringify(after.doc)}`);
  const cover = await page.evaluate(async () => { const { currentRevision } = await import('/src/store/useProjectStore.ts'); return currentRevision((await import('/src/store/useProjectStore.ts')).useProjectStore.getState().info).rev; });
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

  await page.reload();
  await page.waitForTimeout(800);
  check(await page.getByTestId('start-clean').count() === 0, 'no banner after cleaning (reload)');
  await page.goto(BASE + '/electrical?tab=design');
  await page.waitForTimeout(800);
  check(await page.getByTestId('leftover-motor').count() === 0, 'no leftover motor warning after cleaning');

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('copied-from-example project cleaned; description and I/O kept');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
