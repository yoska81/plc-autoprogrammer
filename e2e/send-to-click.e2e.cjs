// "Send to CLICK" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.click; the real
// one is electron/clickBridge.cjs): hidden in the browser and for other PLCs; on a CLICK project ONE click opens
// CLICK, writes the nickname CSV, runs the set-up (new project with the CPU, the nicknames; CLICK 4's ways first)
// and enters every rung, with live progress, then says what is left (the modules, the rungs it cannot enter); a
// failure is one plain sentence with the log (Open log folder); Stop ends a run (said: nothing saved); under Support:
// the check of what CLICK has, the calibration, Record; no CLICK installed says how to get it.
// Real CLICK is tried by hand: tools/click-bridge/README.md.
//   npm run dev -- --port 5215 &  ;  BASE_URL=http://localhost:5215 node e2e/send-to-click.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5215';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__click = { calls: [], installed: true, stepMs: 60, resumed: false, failAt: 0, writeMs: 0, shownLog: false };
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
        if (cmd === 'folder') return { path: 'C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click' };
        if (cmd === 'readFile') { const f = (t.files ?? {})[args.name]; if (!f) throw new Error(`There is no ${args.name}: save it there from CLICK's dialog.`); return { name: args.name, base64: f, bytes: f.length }; }
        await new Promise((r) => setTimeout(r, 100));
        if (cmd === 'detect') return t.installed ? { ready: true, installs: [{ name: 'CLICK Programming Software Ver. 3.71', version: '3.71', exe: 'C:\\AD\\CLICK.exe' }], running: false, steps: [] } : { ready: false, installs: [], running: false, steps: ['Install CLICK Programming Software from AutomationDirect (free download), then Check again.'] };
        if (cmd === 'start') return { version: '3.71', processId: 4242, windows: ['CLICK Programming Software - [Untitled]'], attached: false };
        if (cmd === 'writeFile') { await new Promise((r) => setTimeout(r, t.writeMs)); return { path: `C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\${args.name}` }; }
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
            if (t.failAt && i + 1 === t.failAt && st.do === 'oneOf') throw new Error(`CLICK 3.71: could not find ${st.what} (tried: ${st.options.map((o) => o.label).join(', ')}). Nothing was saved.`);
            await new Promise((r) => setTimeout(r, t.stepMs));
          }
          return { steps: args.steps.length };
        }
        return null;
      },
      logPath: async () => 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\click-bridge.log',
      showLog: async () => { window.__click.shownLog = true; return true; },
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
  check(/Install CLICK Programming Software from AutomationDirect/.test(await dialog.getByTestId('click-steps').innerText()) && await dialog.getByTestId('click-send').count() === 0, 'no CLICK: how to get it');

  // Installed: ONE click puts the whole project in (CLICK opened, new project, CPU, nicknames, every rung).
  await page.evaluate(() => { window.__click.installed = true; window.__click.calls = []; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('click-send-all').waitFor({ timeout: 5000 });
  check(/CLICK Programming Software Ver\. 3\.71/.test(await dialog.getByTestId('click-found').innerText()), 'the CLICK found');
  check(await dialog.getByRole('button', { name: /^(Start CLICK|Use the open CLICK|Set up the project in CLICK|Enter the rungs in CLICK|Continue)$/ }).count() === 0, 'one button: no step buttons');
  await dialog.getByTestId('click-send-all').click();
  check(await dialog.getByRole('status').filter({ hasText: /\d+\/\d+ / }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'live progress per step');
  await dialog.getByTestId('click-done').or(dialog.getByTestId('click-failed')).waitFor({ timeout: 120000 });
  if (await dialog.getByTestId('click-failed').count()) log('failed instead:', await dialog.getByTestId('click-failed').innerText());
  const calls = await page.evaluate(() => window.__click.calls);
  const order = calls.map((c) => c.cmd).filter((c) => !/^(detect)$/.test(c));
  const csv = calls.find((c) => c.cmd === 'writeFile');
  const runs = calls.filter((c) => c.cmd === 'run');
  log('calls:', order.join(' '), '| setup steps:', runs[0].args.steps.length, '| rung steps:', runs[1].args.steps.length);
  check(order.join(' ') === 'start writeFile run run', 'one click: start CLICK, write the nicknames, the set-up, the rungs');
  check(/_nicknames\.csv$/.test(csv.args.name) && /X001/.test(csv.args.text), 'the nickname CSV written for the import');
  const flat = (steps) => steps.flatMap((x) => [x, ...flat((x.options ?? []).flatMap((o) => o.steps))]);
  const setup = flat(runs[0].args.steps);
  check(runs[0].args.steps.some((x) => x.do === 'oneOf' && x.what === 'New project' && x.options[0].label === 'Ctrl+N') && setup.some((x) => x.do === 'menu' && x.path.join('>') === 'File>New Project'), 'new project: Ctrl+N first (CLICK 4), the File menu kept (CLICK 3)');
  check(setup.some((x) => x.do === 'doubleClick' && x.find?.type === 'TreeItem' && /Address Picker/.test(x.find.name)) && setup.some((x) => x.do === 'setText' && x.text === `C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\${csv.args.name}`), 'the Address Picker from the Navigation tree, the CSV imported from where it was written');
  check(setup.some((x) => x.do === 'click' && /C0-1/.test(x.find?.name ?? '')), 'the project\'s CPU chosen');
  check(!setup.some((x) => x.do === 'waitGone' || x.do === 'waitUser') && !flat(runs[1].args.steps).some((x) => x.do === 'waitUser'), 'nothing stops for the user in the middle');
  check(![...setup, ...flat(runs[1].args.steps)].some((x) => /save/i.test(JSON.stringify(x.path ?? x.find ?? x.keys ?? ''))), 'no step saves');
  check(flat(runs[1].args.steps).some((x) => x.do === 'doubleClick' && /Contact \\\(NO\\\)/.test(x.find?.name ?? '')), 'the Instruction List entries by their CLICK 4 names');
  const done = await dialog.getByTestId('click-done').innerText();
  log('done:', done.replace(/\s+/g, ' ').slice(0, 300));
  check(/Done in CLICK 3\.71: a new project with the CPU C0-\S+, the nicknames imported, 39 of 42 rungs entered\./.test(done), 'done: what is in CLICK');
  check(/Still to do in CLICK:/.test(done) && /Type rung 13 from the entry sheet \(Load into PLC\) after rung 12/.test(done) && (done.match(/Type rung \d+/g) ?? []).length === 3, 'the rungs left for you, each with the rung it goes after');
  check(/save the project there \(Ctrl\+S\)/.test(done), 'done: the user saves in CLICK');

  // A failure: one plain sentence, the log for support with Open log folder.
  await page.evaluate(() => { window.__click.failAt = 2; window.__click.calls = []; });
  await dialog.getByTestId('click-send-all').click();
  await dialog.getByTestId('click-failed').waitFor({ timeout: 10000 });
  const failed = await dialog.getByTestId('click-failed').innerText();
  log('failed:', failed.replace(/\s+/g, ' '));
  check(/^CLICK 3\.71: could not find New project \(tried: Ctrl\+N, the File menu, the ribbon key tips \(Alt, F, N\)\)\. Nothing was saved\./.test(failed.trim()), 'failure: one plain sentence');
  check(/Send this log to support: C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\click-bridge\.log/.test(failed), 'the log to send, by its path');
  check((await page.evaluate(() => window.__click.calls)).filter((c) => c.cmd === 'start').length === 1, 'CLICK asked for again on each run (it may have been closed since)');
  await dialog.getByTestId('click-open-log').click();
  check(await page.evaluate(() => window.__click.shownLog === true), 'Open log folder shows the log');
  await page.evaluate(() => { window.__click.failAt = 0; });

  // Support: the check of what CLICK has (CLICK's nickname export and a printed ladder, a PDF of the example's
  // rungs with one address changed in one rung): the rung is named, the nicknames are all there.
  check(!(await dialog.getByTestId('click-support').evaluate((d) => d.open)), 'Support is folded away');
  await dialog.getByTestId('click-support').locator('summary').click();
  const made = await page.evaluate(async () => {
    const v = await appImport('/src/plc/click/clickVerify.ts');
    const { collectProject } = await appImport('/src/deliverables/collect.ts');
    const { clickNicknameCsv } = await appImport('/src/plc/core/clickExport.ts');
    const { hmiExtraTags } = await appImport('/src/deliverables/exportContext.ts');
    const p = collectProject();
    return { rungs: v.rungAddressesInOrder(p.ladder), csv: clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)) };
  });
  // a rung whose first address is used nowhere else, so the printout's change points at that rung only
  const uses = (a) => made.rungs.reduce((n, r) => n + r.addresses.filter((x) => x === a).length, 0);
  const changed = made.rungs.find((r) => r.addresses.length && uses(r.addresses[0]) === 1);
  const wrongAddress = changed.addresses[0];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // a wide rung goes on over several lines, as on paper (a line past the page edge is cut)
  const lines = ['Conveyor Cell  CLICK ladder  Page 1', ...made.rungs.flatMap((r) => {
    const a = r === changed ? ['C999', ...r.addresses.slice(1)] : r.addresses;
    return Array.from({ length: Math.max(1, Math.ceil(a.length / 8)) }, (_, k) => `${k ? '' : r.rung}   ${a.slice(k * 8, k * 8 + 8).join('   ')}`);
  }), 'END'];
  for (let i = 0; i < lines.length; i += 40) {
    const pg = pdf.addPage([612, 792]);
    lines.slice(i, i + 40).forEach((l, k) => pg.drawText(l, { x: 30, y: 760 - k * 18, size: 9, font }));
  }
  const pdfB64 = Buffer.from(await pdf.save()).toString('base64');
  await page.evaluate(([csvText, pdfData]) => { window.__click.files = { 'click_nicknames.csv': btoa(unescape(encodeURIComponent(csvText))), 'click_ladder.pdf': pdfData }; window.__click.calls = []; }, [made.csv, pdfB64]);
  await dialog.getByTestId('click-verify-button').click();
  await dialog.getByTestId('click-checked').waitFor({ timeout: 30000 });
  const report = await dialog.getByTestId('click-checked').innerText();
  log('check:', report.replace(/\s+/g, ' ').slice(0, 200));
  check(new RegExp(`${made.rungs.length - 1} of ${made.rungs.length} rungs match`).test(report) && new RegExp(`Rung ${changed.rung}: ${wrongAddress} not where it should be`).test(report), 'the changed rung named, with its address');
  check(/In CLICK but not in the project: C999/.test(report), 'the wrong address in CLICK named');
  check(/All \d+ nicknames are in CLICK/.test(report), 'nicknames all there');
  const vcalls = (await page.evaluate(() => window.__click.calls)).filter((c) => c.cmd === 'run');
  check(vcalls.length === 2 && vcalls.every((c) => !flat(c.args.steps).some((x) => /save/i.test(JSON.stringify(x.path ?? x.find ?? x.keys ?? '')))) && vcalls.every((c) => c.args.steps.some((x) => x.do === 'waitGone' && /press Save/.test(x.say))), 'the export and print plans leave Save to the user');
  check(flat(vcalls[1].args.steps).some((x) => x.do === 'keys' && x.keys === '^p'), 'print: Ctrl+P (CLICK 4), the File menu kept');

  // Support: the calibration, three sample rungs printed and read back, with its report.
  const samplePdf = async (change) => {
    const rows = await page.evaluate(async () => {
      const v = await appImport('/src/plc/click/clickVerify.ts');
      const c = await appImport('/src/plc/click/clickCalibrate.ts');
      return v.rungAddressesInOrder(c.CALIBRATION_PROGRAM);
    });
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const pg = doc.addPage([612, 792]);
    ['Untitled  CLICK ladder  Page 1', ...rows.map((r) => `${r.rung}   ${r.addresses.map((x, i) => (change && change.rung === r.rung && i === 0 ? change.to : x)).join('   ')}`), 'END'].forEach((l, k) => pg.drawText(l, { x: 30, y: 760 - k * 18, size: 9, font: f }));
    return Buffer.from(await doc.save()).toString('base64');
  };
  await page.evaluate((b) => { window.__click.files = { 'click_calibration.pdf': b }; window.__click.calls = []; }, await samplePdf());
  await dialog.getByTestId('click-calibrate-button').click();
  await dialog.getByTestId('click-calibrated').waitFor({ timeout: 20000 });
  const cal = await dialog.getByTestId('click-calibrated').innerText();
  const calCalls = await page.evaluate(() => window.__click.calls);
  log('calibration:', cal.replace(/\s+/g, ' ').slice(0, 160));
  check(/All 3 sample rungs are in CLICK as they should be: the rung entry fits your CLICK 3\.71/.test(cal), 'calibration: the sample rungs read back, it fits');
  const rep = calCalls.find((c) => c.cmd === 'writeFile' && c.args.name === 'click_calibration.txt');
  check(rep && /CLICK Programming Software: 3\.71/.test(rep.args.text) && /the keys fit this CLICK/.test(rep.args.text) && /click_calibration\.txt/.test(cal), 'calibration: the report written, its path shown');
  await page.evaluate((b) => { window.__click.files = { 'click_calibration.pdf': b }; }, await samplePdf({ rung: 1, to: 'X009' }));
  await dialog.getByTestId('click-calibrate-button').click();
  await dialog.getByTestId('click-calibrated').filter({ hasText: 'does not fit' }).waitFor({ timeout: 20000 });
  check(/2 of 3 sample rungs as they should be/.test(await dialog.getByTestId('click-calibrated').innerText()) && /Sample rung 1: X001 not where it should be/.test(await dialog.getByTestId('click-calibrated').innerText()), 'calibration: a wrong sample rung named, does not fit');

  // Stop during the one-click run.
  await page.evaluate(() => { window.__click.stepMs = 400; });
  await dialog.getByTestId('click-send-all').click();
  // (any step: each shows for stepMs only, and asking for CLICK first shifts when the first one shows)
  await dialog.getByRole('status').filter({ hasText: /^\s*\d+\/\d+ / }).waitFor({ timeout: 5000 });
  await dialog.getByTestId('click-stop').click();
  await dialog.getByTestId('click-failed').waitFor({ timeout: 5000 });
  check(/Stopped at step \d+, as you asked\. Nothing was saved/.test(await dialog.getByTestId('click-failed').innerText()), 'Stop: the run ends, nothing saved, said');
  // pressed before the run began (the nickname file still being written): CLICK is not touched
  const before = await page.evaluate(() => window.__click.calls.filter((c) => c.cmd === 'run').length);
  await page.evaluate(() => { window.__click.writeMs = 600; });
  await dialog.getByTestId('click-send-all').click();
  await dialog.getByTestId('click-stop').click();
  await dialog.getByTestId('click-failed').filter({ hasText: 'Stopped, as you asked' }).waitFor({ timeout: 5000 });
  check(await page.evaluate(() => window.__click.calls.filter((c) => c.cmd === 'run').length) === before, 'Stop before the run: no run started');
  check(await dialog.getByTestId('click-stop').count() === 0, 'the Stop button goes with the run');
  await page.evaluate(() => { window.__click.stepMs = 60; window.__click.writeMs = 0; });

  // Support: record CLICK's windows (the user opens the one to record first).
  check(/open the CLICK window you want recorded \(a dialog too\), then press Record/.test(await dialog.getByTestId('click-support').innerText()), 'Record says which window to open first');
  await dialog.getByTestId('click-record').click();
  await dialog.getByText(/click-controls-20261021\.txt/).waitFor({ timeout: 5000 });
  check(/click-bridge\.log/.test(await dialog.getByTestId('click-support').innerText()), 'the log path for support');
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
