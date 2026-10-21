// "Send to TIA Portal" on the Program page, with a fake desktop bridge in the page (window.isaDesktop.tia;
// the real one is electron/tiaBridge.cjs): hidden in the browser and for CLICK; on a Siemens project it checks the
// PC with live progress and says what to fix (Openness group), or that the PC is ready; a bridge error in plain
// words. Real TIA Portal is tried by hand: tools/tia-bridge/README.md.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/send-to-tia.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

/** The fake bridge: window.__tia.detect is what the PC has, window.__tia.fail an error to throw; calls are logged. */
const FAKE = () => {
  window.__tia = { calls: [], detect: null, fail: null };
  const listeners = new Set();
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    tia: {
      call: async (cmd, args) => {
        window.__tia.calls.push(cmd);
        await new Promise((r) => setTimeout(r, 100));
        listeners.forEach((cb) => cb({ id: 1, text: 'Looking for TIA Portal and TIA Openness…' }));
        await new Promise((r) => setTimeout(r, 600));
        if (window.__tia.fail) throw new Error(window.__tia.fail);
        return cmd === 'detect' ? window.__tia.detect : null;
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

  await page.evaluate((d) => { window.__tia.detect = d; }, READY);
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByTestId('tia-ready').waitFor({ timeout: 5000 });
  check(/This PC is ready/.test(await dialog.getByTestId('tia-ready').innerText()), 'check again: ready');

  await page.evaluate(() => { window.__tia.fail = 'The TIA Portal bridge stopped (exit code 3). Try again; the log is at C:\\logs\\tia-bridge.log.'; });
  await dialog.getByRole('button', { name: 'Check again' }).click();
  await dialog.getByRole('alert').waitFor({ timeout: 5000 });
  check(/bridge stopped \(exit code 3\)/.test(await dialog.getByRole('alert').innerText()), 'a bridge error in plain words');
  check((await page.evaluate(() => window.__tia.calls)).every((c) => c === 'detect'), 'only detect was asked');
  await dialog.getByRole('button', { name: 'Close' }).click();
  check(await dialog.count() === 0, 'closes');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-tia e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-tia e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
