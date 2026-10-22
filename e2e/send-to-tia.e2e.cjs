// "Send to TIA Portal" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.tia;
// the real one is electron/tiaBridge.cjs): hidden in the browser and for CLICK; on a Siemens project it checks the
// PC with live progress and says what to fix (Openness group); when ready, opens TIA Portal (a new project, or the
// running one with its project), offers the CPU's firmware (newest first) and adds the PLC, its modules and the PLC
// tags, with what TIA refused; a project with another PLC is not touched; a bridge error in plain words.
// Real TIA Portal is tried by hand: tools/tia-bridge/README.md.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/send-to-tia.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

/** The fake bridge: window.__tia.detect is what the PC has, window.__tia.fail an error to throw; calls are logged. */
const FAKE = () => {
  window.__tia = { calls: [], detect: null, fail: null, portals: [], plcInProject: null, compile: null, download: null };
  const listeners = new Set();
  const answer = (cmd, args) => {
    const t = window.__tia;
    if (cmd === 'detect') return t.detect;
    if (cmd === 'portals') return { version: 'V19', portals: t.portals };
    if (cmd === 'open') {
      if (args.processId) { const x = t.portals.find((q) => q.processId === args.processId); return { version: 'V19', project: x.project, plc: t.plcInProject }; }
      return { version: 'V19', project: `C:\\Users\\tech\\Documents\\ISA Auto Programmer\\TIA\\${args.name}\\${args.name}.ap19`, plc: null };
    }
    if (cmd === 'firmware') return { orderNumber: args.orderNumber, versions: ['V4.6', 'V4.5', 'V4.4'] };
    if (cmd === 'plc') return { plc: { name: args.name, orderNumber: '6ES7 214-1AG40-0XB0', firmware: args.firmware }, added: true, problems: [] };
    if (cmd === 'blocks') return { imported: args.files.length, failed: [] };
    if (cmd === 'downloadTargets') return { plc: { name: 'PLC_1', orderNumber: '6ES7 214-1AG40-0XB0', firmware: 'V4.4' }, address: '192.168.0.1', interfaces: [{ name: 'Intel(R) Ethernet Connection I219-LM', number: 1, targets: ['1 X1'] }, { name: 'Realtek USB GbE', number: 1, targets: ['1 X1'] }] };
    if (cmd === 'download') return t.download ?? { state: 'success', errors: 0, warnings: 0, messages: [], answers: ['StopModules: StopAll', 'StartModules: StartModule'] };
    if (cmd === 'compile') return t.compile ?? { errors: 0, warnings: 0, messages: [] };
    if (cmd === 'tags') return { table: 'ISA Auto Programmer', created: args.tags.length - 1, updated: 0, failed: [{ name: args.tags[0].name, error: 'The address is outside the CPU\'s range.' }] };
    return null;
  };
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    tia: {
      call: async (cmd, args = {}) => {
        window.__tia.calls.push({ cmd, args });
        await new Promise((r) => setTimeout(r, 100));
        listeners.forEach((cb) => cb({ id: 1, text: cmd === 'detect' ? 'Looking for TIA Portal and TIA Openness…' : `Working on ${cmd}…` }));
        await new Promise((r) => setTimeout(r, 300));
        if (window.__tia.fail) throw new Error(window.__tia.fail);
        return answer(cmd, args);
      },
      logPath: async () => 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\tia-bridge.log',
      onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    },
  };
};

const NOT_IN_GROUP = { ready: false, installed: ['V19'], openness: [{ version: 'V19', assemblyVersion: '19.0.0.0', dll: 'x' }], inOpennessGroup: false, user: 'PC1\\tech', steps: ['Your Windows user (PC1\\tech) is not in the "Siemens TIA Openness" group, so TIA Portal does not let other programs control it.', 'Add it (needs an administrator): …', 'Then sign out of Windows and sign in again (the group counts from the next sign-in).'] };
const READY = { ...NOT_IN_GROUP, ready: true, inOpennessGroup: true, steps: [] };

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

  // In the browser: no button (a web page cannot start TIA Portal).
  let page = await open(false);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-tia').count() === 0, 'browser: no Send to TIA Portal button');
  await page.context().close();

  // Desktop app, CLICK project: no button either.
  page = await open(true);
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-tia').count() === 0, 'desktop, CLICK: no Send to TIA Portal button');

  // Desktop app, Siemens S7-1200.
  await page.evaluate(async () => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
    useProjectStore.setState({ modules: [] });
  });
  await page.goto(BASE + '/program');
  await page.evaluate((d) => { window.__tia.detect = d; }, NOT_IN_GROUP);
  await page.getByTestId('send-to-tia').click();
  const dialog = page.getByRole('dialog', { name: 'Send to TIA Portal' });
  check(await dialog.getByRole('status').filter({ hasText: 'Looking for TIA Portal' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'live progress while checking');
  await dialog.getByTestId('tia-steps').waitFor({ timeout: 5000 });
  const steps = await dialog.getByTestId('tia-steps').innerText();
  log('steps:', steps.replace(/\s+/g, ' ').slice(0, 160));
  check(/TIA Portal V19/.test(await dialog.innerText()) && /not in the "Siemens TIA Openness" group/.test(steps) && /sign out of Windows/.test(steps), 'not in the Openness group: the steps say what to do');
  check(/tia-bridge\.log/.test(await dialog.innerText()), 'the log path for support');

  // Ready: TIA Portal is not running → start it with a new project, newest firmware, PLC and tags.
  await page.evaluate((d) => { window.__tia.detect = d; window.__tia.portals = []; }, READY);
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('tia-open').waitFor({ timeout: 5000 });
  check(/Start TIA Portal V19 with a new project "Conveyor/.test(await dialog.getByTestId('tia-open').innerText()), 'ready: start TIA Portal with a new project named after the project');
  await dialog.getByTestId('tia-open-button').click();
  await dialog.getByTestId('tia-opened').waitFor({ timeout: 5000 });
  check(/ISA Auto Programmer\\TIA\\Conveyor/.test(await dialog.getByTestId('tia-opened').innerText()), 'opened: the new project\'s path');
  const fw = dialog.getByLabel('Firmware');
  await fw.waitFor({ timeout: 5000 });
  check(await fw.inputValue() === 'V4.6' && /V4\.6 \(newest\)/.test(await fw.innerText()), 'firmware: the newest by default');
  await fw.selectOption('V4.4');
  await dialog.getByTestId('tia-send-button').click();
  await dialog.getByTestId('tia-tags-done').waitFor({ timeout: 5000 });
  const calls = await page.evaluate(() => window.__tia.calls);
  const plcCall = calls.find((c) => c.cmd === 'plc');
  const tagsCall = calls.find((c) => c.cmd === 'tags');
  log('plc:', JSON.stringify(plcCall.args), '| tags:', tagsCall.args.tags.length);
  check(plcCall.args.orderNumber === '6ES7214-1AG40-0XB0' && plcCall.args.firmware === 'V4.4', 'the PLC with the chosen firmware');
  check(tagsCall.args.tags.length > 5 && tagsCall.args.tags.every((t) => t.name && t.dataType && /^%[IQM]/.test(t.logicalAddress)), 'the PLC tags with their addresses');
  check(/Added the PLC PLC_1 \(6ES7 214-1AG40-0XB0, firmware V4\.4\)/.test(await dialog.getByTestId('tia-plc-done').innerText()), 'PLC added, said');
  const tagsText = await dialog.getByTestId('tia-tags-done').innerText();
  check(new RegExp(`${tagsCall.args.tags.length - 1} new, 0 updated, 1 not written`).test(tagsText) && /outside the CPU's range/.test(tagsText), 'tags: counts and what TIA refused');

  // The program: the LAD blocks for V19 in import order, then a compile; a message leads back to its rung.
  await dialog.getByTestId('tia-program-button').click();
  await dialog.getByTestId('tia-compiled').waitFor({ timeout: 10000 });
  const blocksCall = (await page.evaluate(() => window.__tia.calls)).find((c) => c.cmd === 'blocks');
  const fileNames = blocksCall.args.files.map((f) => f.name);
  log('blocks:', fileNames.join(', '));
  check(fileNames[0] === 'Machine_DB.xml' && fileNames[1] === 'Machine_tia_helpers.scl' && fileNames[fileNames.length - 1] === 'Main.xml', 'blocks in import order: DB, SCL helpers, FCs, OB 1');
  check(blocksCall.args.files.filter((f) => f.kind === 'xml').every((f) => /<Engineering version="V19"/.test(f.text)) && blocksCall.args.files.find((f) => f.kind === 'scl'), 'SimaticML for the open TIA Portal (V19), the helpers as SCL');
  const progText = await dialog.getByTestId('tia-program-done').innerText();
  check(new RegExp(`All ${fileNames.length} block files imported: \\d+ of \\d+ rungs as ladder networks`).test(progText) && /Compiled: no errors/.test(progText), 'imported and compiled, said');

  // Download: only from the confirm screen, with the safety tick; nothing goes before "Download … now".
  await dialog.getByTestId('tia-download-button').click();
  const confirm = dialog.getByTestId('tia-confirm');
  await confirm.waitFor({ timeout: 5000 });
  const confirmText = await confirm.innerText();
  check(/Download to PLC_1 \(6ES7 214-1AG40-0XB0, firmware V4\.4\) at 192\.168\.0\.1\?/.test(confirmText), 'confirm screen: which PLC, at which address');
  check(!(await page.evaluate(() => window.__tia.calls)).some((c) => c.cmd === 'download'), 'nothing downloaded before the confirm');
  check(await dialog.getByTestId('tia-download-now').isDisabled(), 'Download now stays off until the machine is said to be safe');
  await dialog.getByLabel('Network card').selectOption({ label: 'Realtek USB GbE' });
  await dialog.getByTestId('tia-safe').check();
  await dialog.getByTestId('tia-stop-allowed').check();
  await dialog.getByTestId('tia-start-after').check();
  await dialog.getByLabel('PLC password').fill('s3cret');
  await dialog.getByTestId('tia-download-now').click();
  await dialog.getByTestId('tia-downloaded').waitFor({ timeout: 5000 });
  const dl = (await page.evaluate(() => window.__tia.calls)).filter((c) => c.cmd === 'download');
  log('download:', JSON.stringify({ ...dl[0].args, password: dl[0].args.password ? '***' : undefined }));
  check(dl.length === 1 && dl[0].args.confirmed === true && dl[0].args.pcInterface === 'Realtek USB GbE' && dl[0].args.target === '1 X1' && dl[0].args.stopAllowed === true && dl[0].args.startAfter === true && dl[0].args.password === 's3cret', 'one download, with the confirm and the user\'s choices');
  check(/Downloaded\./.test(await dialog.getByTestId('tia-downloaded').innerText()) && /StopModules: StopAll/.test(await dialog.getByTestId('tia-downloaded').innerText()), 'downloaded, with what TIA Portal asked');
  check(await dialog.getByTestId('tia-confirm').count() === 0, 'the confirm screen closes after the download');
  // TIA asks something the app does not answer: stopped, nothing changed, said
  await page.evaluate(() => { window.__tia.download = { state: 'refused', errors: 0, warnings: 0, messages: ['TIA Portal asked something the app does not answer (CheckBeforeDownload: Differences in the hardware). Download from TIA Portal itself (Online › Download to device), where the question is shown in full.'], answers: [] }; });
  await dialog.getByTestId('tia-download-button').click();
  await dialog.getByTestId('tia-confirm').waitFor({ timeout: 5000 });
  check(!(await dialog.getByTestId('tia-safe').isChecked()) && !(await dialog.getByTestId('tia-stop-allowed').isChecked()) && await dialog.getByLabel('PLC password').inputValue() === '', 'each confirm starts unticked, no password kept');
  await dialog.getByTestId('tia-safe').check();
  await dialog.getByTestId('tia-download-now').click();
  await dialog.getByTestId('tia-downloaded').filter({ hasText: 'Not downloaded' }).waitFor({ timeout: 5000 });
  check(/nothing was changed in the PLC/.test(await dialog.getByTestId('tia-downloaded').innerText()) && /Download from TIA Portal itself/.test(await dialog.getByTestId('tia-downloaded').innerText()), 'a question the app does not answer: not downloaded, said');
  // Cancel: no download
  const before = (await page.evaluate(() => window.__tia.calls)).filter((c) => c.cmd === 'download').length;
  await dialog.getByTestId('tia-download-button').click();
  await dialog.getByTestId('tia-confirm').waitFor({ timeout: 5000 });
  await dialog.getByTestId('tia-safe').check();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  check(await dialog.getByTestId('tia-confirm').count() === 0 && (await page.evaluate(() => window.__tia.calls)).filter((c) => c.cmd === 'download').length === before, 'Cancel: nothing downloaded');

  const fc = fileNames.find((n) => !/^(Machine_DB|Main)\.xml$|\.scl$/.test(n)).replace(/\.xml$/, '');
  const rung2 = await page.evaluate(async (block) => {
    const { collectProject } = await appImport('/src/deliverables/collect.ts');
    const { tiaBlocks } = await appImport('/src/plc/tia/tiaSend.ts');
    return tiaBlocks(collectProject(), 'V19').rungOf(block, 2);
  }, fc);
  await page.evaluate((block) => { window.__tia.compile = { errors: 1, warnings: 1, messages: [
    { severity: 'error', path: `PLC_1 > Program blocks > ${block} > Network 2`, text: 'Tag "Spare_9" not defined.', block, network: 2 },
    { severity: 'warning', path: 'PLC_1 > Program blocks > Main (OB1)', text: 'The block has no comment.', block: 'Main', network: null },
  ] }; }, fc);
  await dialog.getByTestId('tia-program-button').click();
  await dialog.getByTestId('tia-compiled').filter({ hasText: '1 error' }).waitFor({ timeout: 10000 });
  const compiled = await dialog.getByTestId('tia-compiled').innerText();
  log('compiled:', compiled.replace(/\s+/g, ' ').slice(0, 200));
  check(/Compiled with 1 error and 1 warning: fix them before a download/.test(compiled), 'compile errors counted');
  check(/Fix the compile errors first/.test(await dialog.getByTestId('tia-download').innerText()) && await dialog.getByTestId('tia-download-button').count() === 0, 'no download while the compile has errors');
  check(new RegExp(`Rung ${rung2} \\(${fc}, network 2\\): Tag "Spare_9" not defined`).test(compiled) && /Main: The block has no comment/.test(compiled), 'each message with its rung');

  // A running TIA Portal whose project has another PLC: offered, opened, and not touched.
  await page.evaluate(() => { window.__tia.portals = [{ processId: 4242, project: 'D:\\Line\\Line.ap19' }]; window.__tia.plcInProject = { name: 'PLC_9', orderNumber: '6ES7 215-1AG40-0XB0', firmware: 'V4.5' }; window.__tia.calls = []; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('tia-open').waitFor({ timeout: 5000 });
  check(await dialog.getByRole('radio', { name: /The TIA Portal that is open with D:\\Line\\Line\.ap19/ }).isChecked(), 'the running TIA Portal is offered first');
  await dialog.getByTestId('tia-open-button').click();
  await dialog.getByTestId('tia-send').waitFor({ timeout: 5000 });
  check(/already has another PLC \(6ES7 215-1AG40-0XB0\)/.test(await dialog.getByTestId('tia-send').innerText()) && await dialog.getByTestId('tia-send-button').count() === 0, 'another PLC in the project: said, nothing sent');
  check((await page.evaluate(() => window.__tia.calls)).find((c) => c.cmd === 'open').args.processId === 4242, 'attached to the running one');

  await page.evaluate(() => { window.__tia.fail = 'The TIA Portal bridge stopped (exit code 3). Try again; the log is at C:\\logs\\tia-bridge.log.'; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByRole('alert').waitFor({ timeout: 5000 });
  check(/bridge stopped \(exit code 3\)/.test(await dialog.getByRole('alert').innerText()), 'a bridge error in plain words');
  check(/tia-bridge\.log/.test(await dialog.innerText()), 'the log path for support');
  await dialog.getByRole('button', { name: 'Close' }).click();
  check(await dialog.count() === 0, 'closes');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-tia e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-tia e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
