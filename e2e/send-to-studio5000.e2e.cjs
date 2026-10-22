// "Send to Studio 5000" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.studio5000;
// the real one is electron/studio5000Bridge.cjs): hidden in the browser and for other PLCs; on a Logix project it
// checks the PC (Logix Designer, the SDK, its Python); without the SDK it says what to install and opens the .L5X
// in Studio 5000; with it, the user's .ACD (picked) gets the program in its copy (data types, tags, MainProgram),
// then Open in Studio 5000; Stop; an error in one sentence with the log.
// Real Studio 5000 is tried by hand: tools/studio5000-bridge/README.md.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/send-to-studio5000.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const READY = { ready: true, logix: [{ name: 'Studio 5000 Logix Designer v36', version: '36.00.02' }], sdk: 'C:\\Users\\Public\\Documents\\Studio 5000\\Logix Designer SDK', python: "the SDK's virtual environment", projectsDir: 'C:\\Users\\tech\\Documents\\ISA Auto Programmer\\Studio 5000', steps: [] };
const NO_SDK = { ...READY, ready: false, sdk: null, python: null, steps: ["Rockwell's Logix Designer SDK is not installed (it comes with Studio 5000 Professional or the SDK toolkit). Install it, then Check again.", 'Until then: Open the .L5X in Studio 5000 (it makes a new project from it).'] };

const FAKE = () => {
  window.__s5 = { calls: [], detect: null, fail: null, importMs: 1500, picked: 'D:\\Lines\\Line.ACD', shownLog: false };
  const listeners = new Set();
  let stopped = false;
  const say = (text) => listeners.forEach((cb) => cb({ id: 1, text }));
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    studio5000: {
      call: async (cmd, args = {}) => {
        const t = window.__s5;
        t.calls.push({ cmd, args });
        if (cmd === 'stop') { stopped = true; return { stopping: true }; }
        if (cmd === 'import') stopped = false;
        await new Promise((r) => setTimeout(r, 100));
        if (t.fail) throw new Error(t.fail);
        if (cmd === 'detect') return t.detect;
        if (cmd === 'writeL5x') return { path: `C:\\Users\\tech\\Documents\\ISA Auto Programmer\\Studio 5000\\${args.name}.L5X` };
        if (cmd === 'open') return { opened: args.file };
        if (cmd === 'info') return { commPath: 'AB_ETH-1\\192.168.1.10\\Backplane\\0' };
        if (cmd === 'download') return { mode: args.runAfter ? 'run' : 'program', commPath: args.commPath };
        if (cmd === 'import') {
          for (let i = 0; i < 10; i++) {
            if (stopped) throw new Error('Stopped, as you asked. Your own Studio 5000 project was not changed.');
            say(i < 3 ? 'Copying Line.ACD to Line_ISA.ACD' : `Importing ${args.xpaths[i % args.xpaths.length]}`);
            await new Promise((r) => setTimeout(r, t.importMs / 10));
          }
          return { project: args.acd.replace(/\.ACD$/i, '_ISA.ACD'), imported: args.xpaths };
        }
        return null;
      },
      logPath: async () => 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\studio5000-bridge.log',
      showLog: async () => { window.__s5.shownLog = true; return true; },
      pickProject: async () => window.__s5.picked,
      onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    },
  };
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (desktop) => {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
    if (desktop) await page.addInitScript(FAKE);
    await useAppModules(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(BASE + '/spec');
    await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
    await page.goto(BASE + '/spec');
    await page.locator('select[aria-label="Open project"]').selectOption('p_example');
    return page;
  };
  const toLogix = (page) => page.evaluate(async () => { const { useProjectStore } = await appImport('/src/store/useProjectStore.ts'); useProjectStore.getState().setPlc('logix', '5069-L310ER'); });

  let page = await open(false);
  await toLogix(page);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-studio5000').count() === 0, 'browser: no Send to Studio 5000 button');
  await page.context().close();

  page = await open(true);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-studio5000').count() === 0, 'desktop, CLICK: no Send to Studio 5000 button');

  await toLogix(page);
  await page.goto(BASE + '/program');
  // no SDK: what to install, and the .L5X opened in Studio 5000 meanwhile
  await page.evaluate((d) => { window.__s5.detect = d; }, NO_SDK);
  await page.getByTestId('send-to-studio5000').click();
  const dialog = page.getByRole('dialog', { name: 'Send to Studio 5000' });
  await dialog.getByTestId('studio5000-steps').waitFor({ timeout: 5000 });
  const steps = await dialog.getByTestId('studio5000-steps').innerText();
  check(/Logix Designer SDK is not installed/.test(steps) && /Open the \.L5X in Studio 5000/.test(steps) && await dialog.getByTestId('studio5000-project').count() === 0, 'no SDK: said plainly, nothing else offered but the .L5X');
  check(/Studio 5000 Logix Designer v36 \(36\.00\.02\)/.test(await dialog.getByTestId('studio5000-check').innerText()), 'Logix Designer found');
  await dialog.getByTestId('studio5000-open-l5x').click();
  await page.waitForTimeout(500);
  let calls = await page.evaluate(() => window.__s5.calls);
  const w = calls.find((c) => c.cmd === 'writeL5x');
  check(w && /<RSLogix5000Content[\s\S]*<Program Name="MainProgram"/.test(w.args.text) && calls.some((c) => c.cmd === 'open' && /\.L5X$/.test(c.args.file)), 'the .L5X written and opened in Studio 5000');

  // the SDK: the user's project picked, the program in its copy
  await page.evaluate((d) => { window.__s5.detect = d; window.__s5.calls = []; }, READY);
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('studio5000-project').waitFor({ timeout: 5000 });
  check(await dialog.getByTestId('studio5000-send-button').isDisabled(), 'Put the program in: off until a project is chosen');
  await dialog.getByTestId('studio5000-pick').click();
  await dialog.getByTestId('studio5000-acd').waitFor({ timeout: 5000 });
  check(/D:\\Lines\\Line_ISA\.ACD/.test(await dialog.getByTestId('studio5000-project').innerText()), 'the copy next to the user\'s project, said');
  await dialog.getByTestId('studio5000-send-button').click();
  check(await dialog.getByRole('status').filter({ hasText: /Copying Line\.ACD/ }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'live progress');
  await dialog.getByTestId('studio5000-imported').waitFor({ timeout: 10000 });
  calls = await page.evaluate(() => window.__s5.calls);
  const imp = calls.find((c) => c.cmd === 'import');
  log('import:', JSON.stringify(imp.args));
  check(imp.args.acd === 'D:\\Lines\\Line.ACD' && /\.L5X$/.test(imp.args.l5x) && imp.args.xpaths.at(-1) === "Controller/Programs/Program[@Name='MainProgram']" && imp.args.xpaths.includes('Controller/Tags'), 'the user\'s ACD, the L5X, the parts to import');
  check(!calls.some((c) => c.cmd === 'download'), 'no download');
  const done = await dialog.getByTestId('studio5000-imported').innerText();
  check(/In D:\\Lines\\Line_ISA\.ACD: controller tags, MainProgram\./.test(done), 'what went in, in plain words');
  await dialog.getByTestId('studio5000-open').click();
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__s5.calls)).some((c) => c.cmd === 'open' && c.args.file === 'D:\\Lines\\Line_ISA.ACD'), 'Open in Studio 5000: the copy');

  // Download: only from the confirm screen, with the safety tick and leave for Program mode
  await dialog.getByTestId('studio5000-download-button').click();
  const confirm = dialog.getByTestId('studio5000-confirm');
  await confirm.waitFor({ timeout: 5000 });
  check(await dialog.getByLabel('Path to the controller').inputValue() === 'AB_ETH-1\\192.168.1.10\\Backplane\\0', 'the confirm has the project\'s path to the controller');
  check(!(await page.evaluate(() => window.__s5.calls)).some((c) => c.cmd === 'download'), 'nothing downloaded before the confirm');
  await dialog.getByTestId('studio5000-safe').check();
  check(await dialog.getByTestId('studio5000-download-now').isDisabled(), 'Download now off without leave for Program mode');
  await dialog.getByTestId('studio5000-program-allowed').check();
  await dialog.getByLabel('Path to the controller').fill('AB_ETH-1\\10.0.0.5\\Backplane\\0');
  await dialog.getByTestId('studio5000-download-now').click();
  await dialog.getByTestId('studio5000-downloaded').waitFor({ timeout: 10000 });
  let dl = (await page.evaluate(() => window.__s5.calls)).filter((c) => c.cmd === 'download');
  log('download:', JSON.stringify(dl[0].args));
  check(dl.length === 1 && dl[0].args.confirmed === true && dl[0].args.programAllowed === true && dl[0].args.runAfter === false && dl[0].args.project === 'D:\\Lines\\Line_ISA.ACD' && dl[0].args.commPath === 'AB_ETH-1\\10.0.0.5\\Backplane\\0', 'one download: the copy, the path, Program mode allowed, no Run');
  check(/the controller is in Program mode\. Put it in Run mode from Studio 5000/.test(await dialog.getByTestId('studio5000-downloaded').innerText()), 'left in Program mode, said');
  await dialog.getByTestId('studio5000-download-button').click();
  await confirm.waitFor({ timeout: 5000 });
  check(!(await dialog.getByTestId('studio5000-safe').isChecked()) && !(await dialog.getByTestId('studio5000-program-allowed').isChecked()), 'each confirm starts unticked');
  await dialog.getByTestId('studio5000-safe').check();
  await dialog.getByTestId('studio5000-program-allowed').check();
  await dialog.getByTestId('studio5000-run-after').check();
  await dialog.getByTestId('studio5000-download-now').click();
  await dialog.getByTestId('studio5000-downloaded').filter({ hasText: 'Run mode.' }).waitFor({ timeout: 10000 });
  dl = (await page.evaluate(() => window.__s5.calls)).filter((c) => c.cmd === 'download');
  check(dl.length === 2 && dl[1].args.runAfter === true, 'Run mode after, when ticked');
  await dialog.getByTestId('studio5000-download-button').click();
  await dialog.getByTestId('studio5000-safe').check();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  check(await dialog.getByTestId('studio5000-confirm').count() === 0 && (await page.evaluate(() => window.__s5.calls)).filter((c) => c.cmd === 'download').length === 2, 'Cancel: nothing downloaded');

  // Stop; an error in one sentence with the log
  await page.evaluate(() => { window.__s5.importMs = 3000; });
  await dialog.getByTestId('studio5000-send-button').click();
  await dialog.getByTestId('studio5000-stop').click();
  await dialog.getByTestId('studio5000-failed').waitFor({ timeout: 5000 });
  check(/^Stopped, as you asked\. Your own Studio 5000 project was not changed\./.test((await dialog.getByTestId('studio5000-failed').innerText()).trim()), 'Stop: the user\'s project not changed, said');
  await dialog.getByTestId('studio5000-failed').getByRole('button', { name: 'Open log folder' }).click();
  check(await page.evaluate(() => window.__s5.shownLog) && /studio5000-bridge\.log/.test(await dialog.getByTestId('studio5000-failed').innerText()), 'the log for support, Open log folder');
  await page.evaluate(() => { window.__s5.importMs = 1500; window.__s5.fail = 'Import failed: Controller/Tags not found'; });
  await dialog.getByTestId('studio5000-send-button').click();
  await dialog.getByTestId('studio5000-failed').filter({ hasText: 'Import failed' }).waitFor({ timeout: 5000 });
  check(true, 'the SDK\'s reason in one sentence');
  await dialog.getByRole('button', { name: 'Close' }).click();

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-studio5000 e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-studio5000 e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
