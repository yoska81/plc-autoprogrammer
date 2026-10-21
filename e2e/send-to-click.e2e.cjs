// "Send to CLICK" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.click; the real
// one is electron/clickBridge.cjs): hidden in the browser and for other PLCs; on a CLICK project it checks the PC,
// starts CLICK, writes the nickname CSV and runs the set-up plan (new project with the CPU, modules, nicknames)
// with live progress; Stop ends a run (said: nothing saved); "Record CLICK's windows" gives the file for support;
// no CLICK installed says how to get it. Real CLICK is tried by hand: tools/click-bridge/README.md.
//   npm run dev -- --port 5215 &  ;  BASE_URL=http://localhost:5215 node e2e/send-to-click.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5215';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__click = { calls: [], installed: true, stepMs: 60, resumed: false };
  const listeners = new Set();
  let stopped = false;
  const say = (text) => listeners.forEach((cb) => cb({ id: 1, text }));
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    click: {
      call: async (cmd, args = {}) => {
        const t = window.__click;
        t.calls.push({ cmd, args });
        if (cmd === 'stop') { stopped = true; return { stopping: true }; }
        if (cmd === 'resume') { t.resumed = true; return { resumed: true }; }
        await new Promise((r) => setTimeout(r, 100));
        if (cmd === 'detect') return t.installed ? { ready: true, installs: [{ name: 'CLICK Programming Software Ver. 3.71', version: '3.71', exe: 'C:\\AD\\CLICK.exe' }], running: false, steps: [] } : { ready: false, installs: [], running: false, steps: ['Install CLICK Programming Software from AutomationDirect (free download), then Check again.'] };
        if (cmd === 'start') return { version: '3.71', processId: 4242, windows: ['CLICK Programming Software - [Untitled]'], attached: false };
        if (cmd === 'writeFile') return { path: `C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\${args.name}` };
        if (cmd === 'dump') return { file: 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\click-controls-20261021.txt', lines: 120 };
        if (cmd === 'run') {
          stopped = false;
          for (let i = 0; i < args.steps.length; i++) {
            if (stopped) throw new Error(`Stopped at step ${i + 1}, as you asked. Nothing was saved: close CLICK without saving, or keep what was entered and save it yourself.`);
            const st = args.steps[i];
            if (st.do === 'waitUser') {
              t.resumed = false;
              say(`Your turn: ${st.text} Then press Continue.`);
              while (!t.resumed) { if (stopped) throw new Error(`Stopped at step ${i + 1}, as you asked. Nothing was saved.`); await new Promise((r) => setTimeout(r, 50)); }
              continue;
            }
            say(`${i + 1}/${args.steps.length} ${st.say ?? st.do}`);
            await new Promise((r) => setTimeout(r, t.stepMs));
          }
          return { steps: args.steps.length };
        }
        return null;
      },
      logPath: async () => 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\click-bridge.log',
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
    page.on('dialog', (d) => d.accept());
    await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(BASE + '/spec');
    await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
    await page.goto(BASE + '/spec');
    await page.locator('select[aria-label="Open project"]').selectOption('p_example');
    return page;
  };

  // In the browser: no button.
  let page = await open(false);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-click').count() === 0, 'browser: no Send to CLICK button');
  await page.context().close();

  // Desktop, the example (CLICK): the button; Send to TIA Portal is not there.
  page = await open(true);
  await page.goto(BASE + '/program');
  await page.getByTestId('send-to-click').waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-tia').count() === 0, 'desktop, CLICK: Send to CLICK, not Send to TIA Portal');

  // No CLICK installed: says how to get it, nothing else offered.
  await page.evaluate(() => { window.__click.installed = false; });
  await page.getByTestId('send-to-click').click();
  const dialog = page.getByRole('dialog', { name: 'Send to CLICK' });
  await dialog.getByTestId('click-steps').waitFor({ timeout: 5000 });
  check(/Install CLICK Programming Software from AutomationDirect/.test(await dialog.getByTestId('click-steps').innerText()) && await dialog.getByTestId('click-open').count() === 0, 'no CLICK: how to get it');

  // Installed: start CLICK, set up the project, with progress.
  await page.evaluate(() => { window.__click.installed = true; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('click-start').click();
  await dialog.getByTestId('click-started').waitFor({ timeout: 5000 });
  check(/CLICK 3\.71 started/.test(await dialog.getByTestId('click-started').innerText()), 'CLICK started');
  await dialog.getByTestId('click-setup-button').click();
  check(await dialog.getByRole('status').filter({ hasText: /\d+\/\d+ / }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'live progress per step');
  await dialog.getByTestId('click-done').waitFor({ timeout: 15000 });
  const calls = await page.evaluate(() => window.__click.calls);
  const csv = calls.find((c) => c.cmd === 'writeFile');
  const run = calls.find((c) => c.cmd === 'run');
  log('csv:', csv.args.name, csv.args.text.split('\n').length, 'lines; steps:', run.args.steps.length);
  check(/_nicknames\.csv$/.test(csv.args.name) && /X001/.test(csv.args.text), 'the nickname CSV written for the import');
  check(run.args.steps.some((s) => s.do === 'menu' && s.path.join('>') === 'File>New Project') && run.args.steps.some((s) => s.do === 'setText' && s.text === `C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\${csv.args.name}`), 'the set-up plan: new project, the CSV imported from where it was written');
  check(run.args.steps.some((s) => s.do === 'click' && /C0-1/.test(s.find?.name ?? '')), 'the project\'s CPU chosen');
  check(!run.args.steps.some((s) => /save/i.test(JSON.stringify(s.path ?? s.find ?? s.keys ?? ''))), 'no step saves');
  check(/save it there \(File › Save Project\)/.test(await dialog.getByTestId('click-done').innerText()), 'done: the user saves in CLICK');

  // Enter the rungs: in order; the rungs the app cannot enter are the user's turn (Continue).
  check(await dialog.getByTestId('click-rungs').count() === 1, 'step 4 after the set-up');
  await page.evaluate(() => { window.__click.stepMs = 1; });
  await dialog.getByTestId('click-rungs-button').click();
  let turns = 0;
  for (;;) {
    const r = await Promise.race([
      dialog.getByTestId('click-continue').waitFor({ timeout: 20000 }).then(() => 'turn'),
      dialog.getByTestId('click-done').waitFor({ timeout: 20000 }).then(() => 'done'),
    ]);
    if (r === 'done') break;
    turns++;
    if (turns === 1) check(/^Your turn: Type rung \d+/.test((await dialog.getByRole('status').innerText()).trim()), 'your turn: which rung to type');
    await dialog.getByTestId('click-continue').click();
    await dialog.getByTestId('click-continue').waitFor({ state: 'detached', timeout: 5000 });
  }
  const rungRun = (await page.evaluate(() => window.__click.calls)).filter((c) => c.cmd === 'run').at(-1);
  const rungNumbers = rungRun.args.steps.filter((x) => /^Rung \d+/.test(x.say ?? '')).map((x) => Number(/^Rung (\d+)/.exec(x.say)[1]));
  log('rungs:', rungNumbers.length, 'turns:', turns, '|', (await dialog.getByTestId('click-done').innerText()).slice(0, 120));
  // a rung handed to the user says its number twice (the new rung, then the user's turn)
  check(new Set(rungNumbers).size === 42 && rungNumbers.every((n, i) => i === 0 || n >= rungNumbers[i - 1]), 'every rung, in order');
  check(turns > 0 && new RegExp(`, ${turns} typed by you`).test(await dialog.getByTestId('click-done').innerText()), 'the user\'s turns counted in the result');
  check(!rungRun.args.steps.some((x) => /save/i.test(JSON.stringify(x.path ?? x.find ?? x.keys ?? ''))), 'no rung step saves');

  // Stop during a run.
  await page.evaluate(() => { window.__click.stepMs = 400; });
  await dialog.getByTestId('click-setup-button').click();
  // pressed while the run goes (after its first step)
  await dialog.getByRole('status').filter({ hasText: /^\s*1\/\d+ / }).waitFor({ timeout: 5000 });
  await dialog.getByTestId('click-stop').click();
  await dialog.getByRole('alert').waitFor({ timeout: 5000 });
  check(/Stopped at step \d+, as you asked\. Nothing was saved/.test(await dialog.getByRole('alert').innerText()), 'Stop: the run ends, nothing saved, said');
  // pressed before the run began (the nickname file still being written): CLICK is not touched
  const runs = await page.evaluate(() => window.__click.calls.filter((c) => c.cmd === 'run').length);
  await dialog.getByTestId('click-setup-button').click();
  await dialog.getByTestId('click-stop').click();
  await dialog.getByRole('alert').filter({ hasText: 'Stopped before CLICK was touched' }).waitFor({ timeout: 5000 });
  check(await page.evaluate(() => window.__click.calls.filter((c) => c.cmd === 'run').length) === runs, 'Stop before the run: no run started');
  check(await dialog.getByTestId('click-stop').count() === 0, 'the Stop button goes with the run');

  // Record CLICK's windows for support.
  await dialog.getByTestId('click-record').click();
  await dialog.getByText(/click-controls-20261021\.txt/).waitFor({ timeout: 5000 });
  check(/click-bridge\.log/.test(await dialog.innerText()), 'the log path for support');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A Siemens project: no Send to CLICK.
  await page.evaluate(async () => { const { useProjectStore } = await appImport('/src/store/useProjectStore.ts'); useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0'); });
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-click').count() === 0, 'desktop, Siemens: no Send to CLICK button');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-click e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-click e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
