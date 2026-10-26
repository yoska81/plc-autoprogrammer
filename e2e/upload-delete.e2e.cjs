// An uploaded program can be removed: before "Use this program" (Remove this file), and after it (Delete this
// program: its program out and kept in History, the original and its file gone, the I/O list it filled in cleared when
// asked; Cancel changes nothing).
//   npm run dev -- --port 5223 &  ;  BASE_URL=http://localhost:5223 node e2e/upload-delete.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5223';
const FIXTURE = path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'capper.L5X');
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
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/upgrade');
  const state = () => page.evaluate(async () => ({
    rungs: (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder.rungs.length,
    versions: (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().versions.map((v) => v.label),
    io: (await appImport('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.length,
    original: Boolean((await appImport('/src/store/useDraftStore.ts')).useDraftStore.getState().drafts['upgrade.original']),
  }));

  // read, then removed before using it
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  await page.getByTestId('program-found').waitFor({ timeout: 10000 });
  await page.getByTestId('program-remove').click();
  check(await page.getByTestId('program-found').count() === 0 && (await state()).rungs === 0, 'Remove this file: the file read is dropped, nothing put in the project');

  // used, then deleted: Cancel first, then delete with its I/O list
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  await page.getByTestId('program-found').waitFor({ timeout: 10000 });
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 10000 });
  const used = await state();
  check(used.rungs > 0 && used.io > 0 && used.original, `used: ${used.rungs} rungs, ${used.io} I/O points`);
  await page.getByTestId('upload-delete').click();
  const confirm = page.getByTestId('upload-delete-confirm');
  check(/Delete capper\.L5X from this project\?/i.test(await confirm.innerText()) && /kept in History/.test(await confirm.innerText()), 'the confirm says what goes and what is kept');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  const after = await state();
  check(after.rungs === used.rungs && after.original && await page.getByTestId('upload-delete-confirm').count() === 0, 'Cancel: nothing deleted');
  await page.getByTestId('upload-delete').click();
  check(await page.getByTestId('upload-delete-io').isChecked(), 'its I/O list goes too, unless unticked');
  await page.getByTestId('upload-delete-yes').click();
  await page.getByTestId('program-file').waitFor({ state: 'attached', timeout: 5000 });
  const gone = await state();
  check(gone.rungs === 0 && gone.io === 0 && !gone.original, `deleted: no program, no I/O, no original (${JSON.stringify(gone)})`);
  check(gone.versions.some((v) => /Before clear/.test(v)), 'its program kept in History');

  // the I/O list kept when unticked
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  await page.getByTestId('program-found').waitFor({ timeout: 10000 });
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 10000 });
  await page.getByTestId('upload-delete').click();
  await page.getByTestId('upload-delete-io').uncheck();
  await page.getByTestId('upload-delete-yes').click();
  await page.getByTestId('program-file').waitFor({ state: 'attached', timeout: 5000 });
  const kept = await state();
  check(kept.rungs === 0 && kept.io === used.io && !kept.original, 'unticked: the I/O list stays');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `upload-delete e2e: ${fails.length} failed` : 'upload-delete e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
