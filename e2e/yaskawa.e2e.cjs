// Yaskawa MPE720 project (.YMW7): the binary project file is read on /upgrade (controller, I/O with the
// project's comments, drawings decoded into rungs), "Use this program" loads it, and the rungs open in the
// ladder editor on /program, with SEE calls and unknown codes shown as boxes. The app cannot program a Yaskawa
// yet: the project stays on the machine's own controller, read only (no CLICK in its place), until a PLC is
// chosen; choosing a Siemens S7-1200 then moves it. The project is the synthetic src/plc/import/__fixtures__/demo_mp.YMW7 (tools/fixtures/make_ymw7_fixture.py).
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

  // Read only on the machine's own controller: no CLICK anywhere until a PLC is chosen.
  const noClick = async (where) => {
    await page.goto(BASE + where);
    await page.waitForFunction(() => window.__isaAppReady && (document.querySelector('main')?.innerText.length ?? 0) > 80, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    // Not the project's PLC: the Import page's list of the file formats it reads (CLICK CSV), and the PLCs offered
    // in "Move it to another PLC: choose one".
    const choices = page.getByTestId('upgrade-choose-plc');
    const offered = (await choices.count()) ? await choices.innerText() : '';
    const t = (await page.locator('body').innerText()).replace(/Can be read:[\s\S]*?print them to PDF\./, '').replace(offered, '');
    const hit = /AutomationDirect|CLICK/.exec(t);
    check(!hit, `${where}: no AutomationDirect / CLICK${hit ? ` (found "${t.slice(Math.max(0, hit.index - 60), hit.index + 30).replace(/\s+/g, ' ')}")` : ''}`);
    return t;
  };
  const up = await noClick('/upgrade');
  check(/on the machine's Yaskawa CPU-DEMO\(4axes\) \(read only: not programmable here yet\)/.test(up), 'shown on the machine\'s Yaskawa controller, read only');
  check(/These are the Yaskawa modules: DEMOCPU, DEMOIO\. They stay with the original\. Choose the new PLC and the app picks its modules\./.test(up), 'the modules notice says they stay with the original');
  check(/Servo axes \(1\)/.test(up), 'the servo axes as information');
  check(await page.getByTestId('upgrade-choose-plc').isVisible(), 'the "Move it to another PLC: choose one" step');
  check(await page.getByTestId('upgrade-export').count() === 0, 'no "Download for …" until a PLC is chosen');
  await page.screenshot({ path: path.join(OUT, '3-read-only.png'), fullPage: true });
  await noClick('/io');
  const shown = await page.evaluate(() => [...document.querySelectorAll('main input')].map((x) => x.value).join(' ') + document.querySelector('main').innerText);
  check(/IB00000/.test(shown) && /OB00000/.test(shown), 'the I/O list keeps the original registers');
  await noClick('/program');
  check(await page.locator('[data-rung-id]').count() >= 10, 'the program opens read only');
  await noClick('/simulate');
  await noClick('/hmi');
  await noClick('/export');
  check(await page.getByTestId('export-read-only').isVisible(), 'the deliverables say a PLC is needed for the program files');

  // Choosing Siemens S7-1200: the project moves, the I/O gets S7 addresses and the download is for it.
  await page.goto(BASE + '/upgrade');
  await page.getByTestId('upgrade-move-siemens-s7').click();
  await page.waitForTimeout(800);
  const moved = await page.evaluate(async () => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    const { useIOStore } = await appImport('/src/store/useIOStore.ts');
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const { plcId, cpuId } = useProjectStore.getState();
    return { plcId, cpuId, manual: useIOStore.getState().projectIO.map((p) => p.plcAddress ?? ''), ladder: JSON.stringify(useProgramStore.getState().ladder.rungs) };
  });
  check(moved.plcId === 'siemens-s7' && /1200|121\d|^6ES721/.test(moved.cpuId), `moved to a Siemens S7-1200 (${moved.plcId} ${moved.cpuId})`);
  check(moved.manual.every((a) => !/^[IO][BW]/.test(a)), 'no Yaskawa registers left as I/O addresses');
  check(!/"[IO]B0000\d"/.test(moved.ladder), 'the program follows the new I/O addresses');
  const after = await page.getByTestId('upgrade-original').innerText();
  check(/now on Siemens/.test(after) && /moved from the machine's Yaskawa CPU-DEMO/.test(after), 'says it moved from the Yaskawa controller');
  await page.getByTestId('upgrade-export').click();
  await page.getByTestId('upgrade-prepared').waitFor({ timeout: 10000 });
  check(/Siemens/.test(await page.getByTestId('upgrade-prepared').innerText()), 'the download is for the Siemens PLC');
  await page.screenshot({ path: path.join(OUT, '4-moved.png'), fullPage: true });

  check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
  if (fails.length) { console.log(`FAILED ${fails.length}`); process.exit(1); }
  console.log('yaskawa e2e: all ok');
})().catch((e) => { console.error(e); process.exit(1); });
