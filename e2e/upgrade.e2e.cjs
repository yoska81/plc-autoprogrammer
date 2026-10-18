// "Upgrade existing program", first slice: an exported Studio 5000 program (.L5X) of a bottle capper is
// read on /upgrade (what was found, what was not converted, I/O with how sure), a locked project file
// gets plain export steps, "Use this program" sets up PLC, I/O, program, description and questions;
// a rung changed in the editor shows in "Original vs now"; the download is an L5X with the original
// tag names; the original survives a reload.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/upgrade.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const OUT = path.join(__dirname, 'out-upgrade');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'capper.L5X');
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/upgrade');

  log('locked project file');
  const acd = path.join(OUT, 'Capper.ACD');
  fs.writeFileSync(acd, Buffer.from([0x00, 0x01, 0x02, 0xff, 0x10, 0x00, 0x00, 0x7f, 0x00, 0x00]));
  await page.getByTestId('program-file').setInputFiles(acd);
  const alert = page.getByRole('alert');
  await alert.waitFor({ timeout: 5000 });
  check(/L5X/.test(await alert.innerText()), 'a .ACD file gets plain steps to export an L5X');

  log('read the L5X');
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  const found = page.getByTestId('program-found');
  await found.waitFor({ timeout: 10000 });
  const text = await found.innerText();
  check(/19\s*of 20 rungs converted/.test(text), 'rungs converted shown');
  check(/1769-L33ER/.test(text), 'controller shown');
  check(/Start_PB/.test(text) && /Start pushbutton/.test(text), 'I/O with names and descriptions');
  check(/MSG/.test(text), 'the instruction that was not converted is listed');
  await page.screenshot({ path: path.join(OUT, '1-found.png'), fullPage: true });

  log('use it');
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 5000 });
  check((await page.getByTestId('upgrade-diff-summary').innerText()) === 'no rung changes', 'nothing changed yet');
  const state = await page.evaluate(async () => {
    const plc = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const io = (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO;
    const prog = (await import('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder;
    const spec = (await import('/src/store/useSpecStore.ts')).useSpecStore.getState();
    return { plcId: plc.plcId, modules: plc.modules, io: io.length, rungs: prog.rungs.length, overview: spec.sections.overview, operator: spec.sections.operator, questions: spec.questions };
  });
  check(state.plcId === 'logix' && state.modules.length > 0, `Logix PLC with modules (${state.plcId}, ${state.modules.join(' ')})`);
  check(state.io > 10 && state.rungs >= 19, `I/O list (${state.io}) and program (${state.rungs} rungs)`);
  check(/1769-L33ER/.test(state.overview) && /Start_PB/.test(state.operator), 'machine description written from the program');
  check(state.questions.some((q) => /MSG/.test(q)) && state.questions.some((q) => /problems/.test(q)), 'questions for the Machine description page');

  log('change a rung in the editor');
  await page.goto(BASE + '/program');
  const comment = page.locator('[data-rung-id] span[title]').first();
  await comment.waitFor({ timeout: 10000 });
  await comment.dblclick();
  await page.getByPlaceholder('Rung comment', { exact: true }).fill('Upgraded: start only with the guard closed');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  await page.goto(BASE + '/upgrade');
  await page.getByTestId('upgrade-original').waitFor({ timeout: 5000 });
  check((await page.getByTestId('upgrade-diff-summary').innerText()) === '1 changed', 'Original vs now: 1 changed');
  await page.screenshot({ path: path.join(OUT, '2-diff.png'), fullPage: true });

  log('download: written into the original file');
  const files = [];
  page.on('download', (d) => files.push(d));
  await page.getByTestId('upgrade-export').click();
  await page.getByTestId('upgrade-mode-patch').waitFor({ timeout: 5000 });
  check(/MainProgram \/ Modes/.test(await page.getByTestId('upgrade-mode-patch').innerText()), 'says which routine is rewritten');
  check(await page.getByTestId('upgrade-missing').count() === 0, 'nothing missing when written into the original');
  await page.getByTestId('upgrade-download').click();
  await page.waitForTimeout(1000);
  const l5x = files.find((d) => d.suggestedFilename() === 'capper_upgraded.L5X');
  check(Boolean(l5x), `the original file with the changes (${files.map((d) => d.suggestedFilename()).join(', ')})`);
  if (l5x) {
    const out = path.join(OUT, l5x.suggestedFilename());
    await l5x.saveAs(out);
    const x = fs.readFileSync(out, 'utf8');
    const orig = fs.readFileSync(FIXTURE, 'utf8');
    const cut = (t) => { const s0 = t.search(/<Routine\s[^>]*Name="Modes"/); return [t.slice(0, s0), t.slice(t.indexOf('</Routine>', s0))]; };
    const [a, b] = cut(orig), [c, d] = cut(x);
    check(a === c && b === d, 'everything outside the changed routine is byte-identical to the original');
    check(x.includes('Upgraded: start only with the guard closed'), 'the change is in the file');
    check(x.includes('MSG(Line_Msg)') && x.includes('<Module Name="DI_Slot1"'), 'the MSG and the module configuration are still there');
  }

  log('download for another PLC: what is missing is confirmed first');
  const cpuBefore = await page.evaluate(async () => { const s = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState(); const c = s.cpuId; s.setPlc('micro800', ''); return c; });
  await page.getByTestId('upgrade-export').click();
  await page.getByTestId('upgrade-missing').waitFor({ timeout: 5000 });
  check(/MSG\(Line_Msg\)/.test(await page.getByTestId('upgrade-missing').innerText()), 'the MSG is listed as missing on another PLC');
  check(await page.getByTestId('upgrade-download').isDisabled(), 'download waits for "I understand"');
  await page.getByTestId('upgrade-understood').check();
  check(!(await page.getByTestId('upgrade-download').isDisabled()), 'then it can be downloaded');
  await page.evaluate(async (c) => (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().setPlc('logix', c), cpuBefore);

  log('reload');
  await page.reload();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 5000 });
  check((await page.getByTestId('upgrade-diff-summary').innerText()) === '1 changed', 'the original is kept with the project');

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nupgrade e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
