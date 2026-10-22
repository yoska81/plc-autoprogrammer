// "Send to CODESYS" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.codesys; the
// real one is electron/codesysBridge.cjs): hidden in the browser and for other PLCs; on a Structured Text project
// it checks the PC, offers a new project or the user's own (picked in the Open dialog, never changed), sends the
// program as CODESYS objects (POUs, DUTs, GVLs, the main program for the MainTask), shows the build's errors with
// their object and line, opens the result in CODESYS; Stop; an error in one sentence with the log.
// Real CODESYS is tried by hand: tools/codesys-bridge/README.md.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/send-to-codesys.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__cs = { calls: [], installed: true, fail: null, buildMs: 1500, picked: 'D:\\Lines\\Line.project', shownLog: false, result: null };
  const listeners = new Set();
  let stopped = false;
  const say = (text) => listeners.forEach((cb) => cb({ id: 1, text }));
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    codesys: {
      call: async (cmd, args = {}) => {
        const t = window.__cs;
        t.calls.push({ cmd, args });
        if (cmd === 'stop') { stopped = true; return { stopping: true }; }
        if (cmd === 'build') stopped = false;
        await new Promise((r) => setTimeout(r, 100));
        if (t.fail) throw new Error(t.fail);
        if (cmd === 'detect') return t.installed ? { ready: true, installs: [{ name: 'CODESYS V3.5 SP19 Patch 2', version: '3.5.19.20', exe: 'C:\\x\\CODESYS.exe', profile: 'CODESYS V3.5 SP19 Patch 2' }], projectsDir: 'C:\\Users\\tech\\Documents\\ISA Auto Programmer\\CODESYS', steps: [] } : { ready: false, installs: [], projectsDir: '', steps: ['Install the CODESYS Development System (free from the CODESYS Store), then Check again.'] };
        if (cmd === 'build') {
          for (let i = 0; i < 10; i++) {
            if (stopped) throw new Error('Stopped, as you asked: CODESYS was closed. Your own project was not changed.');
            say(i < 5 ? `Writing ${args.objects[i % args.objects.length].name}` : 'Building');
            await new Promise((r) => setTimeout(r, t.buildMs / 10));
          }
          return t.result ?? { project: args.project ? args.project.replace(/\.project$/, '_ISA.project') : `C:\\Users\\tech\\Documents\\ISA Auto Programmer\\CODESYS\\${args.name}\\${args.name}.project`, objects: args.objects.map((o) => ({ name: o.name, kind: o.kind, action: 'created' })), errors: 0, warnings: 0, messages: [], notes: [] };
        }
        if (cmd === 'open') return { opened: args.project };
        return null;
      },
      logPath: async () => 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\codesys-bridge.log',
      showLog: async () => { window.__cs.shownLog = true; return true; },
      pickProject: async () => window.__cs.picked,
      onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    },
  };
};

const ST = `TYPE Mode : (Off, Auto); END_TYPE
VAR_GLOBAL
  Start_PB : BOOL;
END_VAR
FUNCTION_BLOCK SealIn
VAR_INPUT s, r : BOOL; END_VAR
VAR_OUTPUT q : BOOL; END_VAR
q := (s OR q) AND NOT r;
END_FUNCTION_BLOCK
PROGRAM Main
VAR m : SealIn; END_VAR
m(s := Start_PB, r := FALSE);
END_PROGRAM`;

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
  const toSt = (page) => page.evaluate(async (st) => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    useProjectStore.getState().setPlc('generic-st', 'generic');
    useProgramStore.getState().updateCode(st);
  }, ST);

  // In the browser: no button.
  let page = await open(false);
  await toSt(page);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-codesys').count() === 0, 'browser: no Send to CODESYS button');
  await page.context().close();

  // Desktop, the example on CLICK: no button.
  page = await open(true);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-codesys').count() === 0, 'desktop, CLICK: no Send to CODESYS button');

  // Desktop, Structured Text.
  await toSt(page);
  await page.goto(BASE + '/program');
  await page.evaluate(() => { window.__cs.installed = false; });
  await page.getByTestId('send-to-codesys').click();
  const dialog = page.getByRole('dialog', { name: 'Send to CODESYS' });
  await dialog.getByTestId('codesys-steps').waitFor({ timeout: 5000 });
  check(/Install the CODESYS Development System/.test(await dialog.getByTestId('codesys-steps').innerText()) && await dialog.getByTestId('codesys-send').count() === 0, 'no CODESYS: how to get it');
  await page.evaluate(() => { window.__cs.installed = true; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('codesys-send').waitFor({ timeout: 5000 });
  check(/CODESYS V3\.5 SP19 Patch 2 \(3\.5\.19\.20\)/.test(await dialog.getByTestId('codesys-check').innerText()), 'the CODESYS found');
  const sendText = await dialog.getByTestId('codesys-send').innerText();
  check(/4 objects \(Mode, GVL, SealIn, Main\); Main goes into the MainTask/.test(sendText), 'the program as CODESYS objects, the main program for the MainTask');

  // a new project
  await dialog.getByTestId('codesys-send-button').click();
  check(await dialog.getByRole('status').filter({ hasText: /Writing Mode/ }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'live progress');
  await dialog.getByTestId('codesys-built').waitFor({ timeout: 10000 });
  let b = (await page.evaluate(() => window.__cs.calls)).find((c) => c.cmd === 'build');
  log('build:', JSON.stringify({ ...b.args, objects: b.args.objects.map((o) => `${o.kind}:${o.name}`) }));
  check(b.args.project === undefined && b.args.name === 'Conveyor_Cell_example' && b.args.main === 'Main', 'a new project named after the project');
  check(b.args.objects.find((o) => o.name === 'SealIn').implementation === 'q := (s OR q) AND NOT r;' && b.args.objects.find((o) => o.name === 'Main').declaration.startsWith('PROGRAM Main'), 'each POU with its declaration and implementation');
  check(/Conveyor_Cell_example\.project: 4 created, 0 replaced/.test(await dialog.getByTestId('codesys-built').innerText()) && /Built: no errors/.test(await dialog.getByTestId('codesys-built').innerText()), 'built, said');
  await dialog.getByTestId('codesys-open').click();
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__cs.calls)).some((c) => c.cmd === 'open' && /Conveyor_Cell_example\.project$/.test(c.args.project)), 'Open in CODESYS: the project built');

  // the user's project (picked), with build errors
  await page.evaluate(() => { window.__cs.calls = []; window.__cs.result = { project: 'D:\\Lines\\Line_ISA.project', objects: [{ name: 'Mode', kind: 'dut', action: 'replaced' }, { name: 'Main', kind: 'program', action: 'created' }], errors: 1, warnings: 1, messages: [{ severity: 'error', text: "Identifier 'Start_PB2' not defined", object: 'Main', line: 2 }, { severity: 'warning', text: 'Unused variable r', object: 'SealIn', line: null }], notes: ['The project has no MainTask: call Main from a task of yours in CODESYS.'] }; });
  await dialog.getByTestId('codesys-pick').click();
  await dialog.getByText('D:\\Lines\\Line.project').waitFor({ timeout: 5000 });
  check(await dialog.getByRole('radio', { name: /My project D:\\Lines\\Line\.project/ }).isChecked() && /Close it in CODESYS first/.test(await dialog.innerText()), 'the user\'s project picked, chosen, and the note to close it in CODESYS');
  await dialog.getByTestId('codesys-send-button').click();
  await dialog.getByTestId('codesys-built').filter({ hasText: 'Line_ISA' }).waitFor({ timeout: 10000 });
  b = (await page.evaluate(() => window.__cs.calls)).find((c) => c.cmd === 'build');
  check(b.args.project === 'D:\\Lines\\Line.project', 'the user\'s project sent (the bridge makes its copy)');
  const builtText = await dialog.getByTestId('codesys-built').innerText();
  log('built:', builtText.replace(/\s+/g, ' ').slice(0, 260));
  check(/1 created, 1 replaced/.test(builtText) && /Built with 1 error and 1 warning/.test(builtText), 'counts of objects and messages');
  check(/Main, line 2: Identifier 'Start_PB2' not defined/.test(builtText) && /SealIn: Unused variable r/.test(builtText), 'each message with its object and line');
  check(/no MainTask: call Main from a task of yours/.test(builtText), 'the MainTask note');
  await page.evaluate(() => { window.__cs.result = null; });

  // Stop while it builds; an error in one sentence with the log
  await page.evaluate(() => { window.__cs.buildMs = 3000; });
  await dialog.getByTestId('codesys-send-button').click();
  await dialog.getByTestId('codesys-stop').click();
  await dialog.getByTestId('codesys-failed').waitFor({ timeout: 5000 });
  check(/^Stopped, as you asked: CODESYS was closed\. Your own project was not changed\./.test((await dialog.getByTestId('codesys-failed').innerText()).trim()), 'Stop: CODESYS closed, the user\'s project not changed, said');
  check(/codesys-bridge\.log/.test(await dialog.getByTestId('codesys-failed').innerText()), 'the log for support');
  await dialog.getByTestId('codesys-failed').getByRole('button', { name: 'Open folder' }).click();
  check(await page.evaluate(() => window.__cs.shownLog), 'Open folder shows the log');
  await page.evaluate(() => { window.__cs.buildMs = 1500; window.__cs.fail = 'The CODESYS project has no application: open it in CODESYS, add one under the PLC, and try again.'; });
  await dialog.getByTestId('codesys-send-button').click();
  await dialog.getByTestId('codesys-failed').filter({ hasText: 'no application' }).waitFor({ timeout: 5000 });
  check(true, 'CODESYS\'s error in one sentence');
  await dialog.getByRole('button', { name: 'Close' }).click();

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-codesys e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-codesys e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
