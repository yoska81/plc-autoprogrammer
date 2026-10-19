// Yaskawa MPE720 project (.YMW7): the binary project file is read on /upgrade (controller, I/O with the
// project's comments, drawings decoded into rungs), "Use this program" loads it, and the rungs open in the
// ladder editor on /program, with SEE calls and unknown codes shown as boxes. The project is the synthetic
// src/plc/import/__fixtures__/demo_mp.YMW7 (tools/fixtures/make_ymw7_fixture.py).
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/yaskawa.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const path = require('node:path');
const fs = require('node:fs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const OUT = path.join(__dirname, 'out-yaskawa');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'demo_mp.YMW7');
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

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
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/upgrade');

  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  const found = page.getByTestId('program-found');
  await found.waitFor({ timeout: 15000 });
  const text = await found.innerText();
  check(/Yaskawa MPE720/.test(text), 'read as a Yaskawa MPE720 project');
  check(/CPU-DEMO/.test(text), 'controller shown');
  check(/Start button/.test(text) && /Run lamp/.test(text), 'I/O with the project\'s comments');
  await page.screenshot({ path: path.join(OUT, '1-found.png'), fullPage: true });

  await page.getByTestId('program-apply').click();
  await page.waitForTimeout(800);
  const state = await page.evaluate(async () => {
    const prog = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder;
    return { rungs: prog.rungs.length, blocks: (prog.blocks ?? []).map((b) => b.name) };
  });
  check(state.rungs >= 10, `program loaded (${state.rungs} rungs)`);
  check(state.blocks.some((b) => /H01 Demo conveyor/.test(b)) && state.blocks.some((b) => /H01\.01 Demo sub/.test(b)), 'one block per drawing');

  await page.goto(BASE + '/program');
  await page.locator('[data-rung-id]').first().waitFor({ timeout: 10000 });
  const rungs = await page.locator('[data-rung-id]').count();
  check(rungs >= 10, `rungs open in the ladder editor (${rungs})`);
  const body = await page.locator('main').innerText();
  check(/SEE H01\.01/.test(body), 'the SEE call is shown as a box');
  check(/Unknown instruction/.test(body), 'the unknown code is shown as a box');
  await page.screenshot({ path: path.join(OUT, '2-program.png'), fullPage: false });

  check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
  if (fails.length) { console.log(`FAILED ${fails.length}`); process.exit(1); }
  console.log('yaskawa e2e: all ok');
})().catch((e) => { console.error(e); process.exit(1); });
