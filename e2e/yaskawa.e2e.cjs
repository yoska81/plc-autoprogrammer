// Yaskawa MPE720 project (.YMW7): the binary project file is read on /upgrade (controller, I/O with the
// project's comments, drawings decoded into rungs), "Use this program" loads it, and the rungs open in the
// ladder editor on /program: the drawing called with SEE in its place, unknown codes shown as boxes. The app cannot program a Yaskawa
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

  // With a synthetic Weintek EasyBuilder Pro panel project (two screens, Memobus addresses), as src/plc/import/mpe720.test.ts builds it.
  const MEMO = 'Memobus (Yaskawa MP Series Controllers)';
  const cs = (t) => [0xff, 0xfe, 0xff, t.length, ...[...t].flatMap((ch) => [ch.charCodeAt(0), 0])];
  const u32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
  const PANEL = path.join(OUT, 'panel.emtp');
  fs.writeFileSync(PANEL, Buffer.from([0xa9, 0, 0, 0, ...cs('5.07.01'), 0, 0, 0, 0, ...cs('Main'), ...u32(800), ...u32(480), ...u32(0), ...u32(0),
    ...cs('Alarms'), ...u32(800), ...u32(480), ...u32(0), ...u32(0), ...cs('Local HMI'), ...cs(MEMO), 0, 0, 0, 0, 0x00, 0x05, ...cs('0'), ...cs('237')]));
  await page.getByTestId('program-file').setInputFiles([FIXTURE, PANEL]);
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
  check(JSON.stringify(state.blocks) === JSON.stringify(['H01 Demo conveyor', 'H01.01 Demo sub', 'H01 Demo conveyor (after H01.01)']), `the called drawing at its SEE, then the rest of the caller (${state.blocks.join(', ')})`);

  await page.goto(BASE + '/program');
  await page.locator('[data-rung-id]').first().waitFor({ timeout: 10000 });
  const rungs = await page.locator('[data-rung-id]').count();
  check(rungs >= 10, `rungs open in the ladder editor (${rungs})`);
  const body = await page.locator('main').innerText();
  check(!/SEE H01\.01/.test(body), 'no SEE box: the called drawing is in its place');
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
  check(/These are the Yaskawa modules: DEMOIO\. They stay with the original\. Choose the new PLC and the app picks its modules\./.test(up), 'the modules notice says they stay with the original');
  check(/Servo axes \(1\)/.test(up), 'the servo axes as information');
  check(await page.getByTestId('upgrade-choose-plc').isVisible(), 'the "Move it to another PLC: choose one" step');
  // The remake: per PLC how much converts, before anything moves (the demo: 10 of 11 rungs, the unknown code kept).
  const remake = await page.getByTestId('upgrade-remake-siemens-s7').innerText();
  check(/Remake for Siemens S7-1200 \/ S7-1500/.test(remake) && /90% converts \(10 of 11 rungs\)/.test(remake) && /unknown instruction ×1/.test(remake) && !/SEE/.test(remake), `the remake line for Siemens (${remake.replace(/\s+/g, ' ')})`);
  check(await page.getByTestId('upgrade-remake').locator('li').count() >= 6, 'a remake line per PLC the app writes');
  check(await page.getByTestId('upgrade-export').count() === 0, 'no "Download for …" until a PLC is chosen');
  await page.screenshot({ path: path.join(OUT, '3-read-only.png'), fullPage: true });
  await noClick('/io');
  const shown = await page.evaluate(() => [...document.querySelectorAll('main input')].map((x) => x.value).join(' ') + document.querySelector('main').innerText);
  check(/IB00000/.test(shown) && /OB00000/.test(shown), 'the I/O list keeps the original registers');
  await noClick('/program');
  check(await page.locator('[data-rung-id]').count() >= 10, 'the program opens read only');
  check(await page.getByTestId('build-read-only').count() === 1 && !(await page.getByRole('button', { name: 'Build program from my project' }).count()), 'no "Build program" on the read-only PLC: choose the PLC first');
  await noClick('/simulate');
  await noClick('/hmi');
  // The Equipment page is a catalog of every brand: its panel table must not judge panels against a CLICK.
  await page.goto(BASE + '/equipment');
  await page.waitForFunction(() => window.__isaAppReady && /Choose the PLC first|Fits this machine/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 30000 });
  const eq = await page.locator('main').innerText();
  check(!/to CLICK|CLICK is not in|CLICK only/.test(eq), '/equipment: no panel judged against a CLICK');
  check(/Choose the PLC first: the MP-CPU is the machine's own controller/.test(eq), '/equipment: panels wait for the PLC to be chosen');
  // The brand rows follow the machine: its Yaskawa PLC and servo drives, its Weintek panel; never AutomationDirect for those.
  const brands = await page.locator('section[aria-label="Preferred brands"] select[aria-label^="Brand for"]').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.selectedOptions[0]?.textContent ?? '']));
  const row = (re) => brands.find(([label]) => re.test(label))?.[1] ?? '';
  check(/^Yaskawa/.test(row(/PLC/)), `/equipment: PLC and I/O brand is Yaskawa ("${row(/PLC/)}")`);
  check(/^Yaskawa/.test(row(/drive/i)), `/equipment: drives brand is Yaskawa ("${row(/drive/i)}")`);
  check(/^Weintek/.test(row(/HMI|panel \(HMI\)|Operator/i)), `/equipment: HMI brand is Weintek ("${row(/HMI|Operator/i)}")`);
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
