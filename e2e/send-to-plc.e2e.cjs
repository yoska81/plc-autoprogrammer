// "Send to PLC software", the one button on the Program page (src/plc/ui/SendToPlc.tsx): in the desktop app it is
// the flow of the project's PLC (here CLICK, with a fake bridge in the page); where the app cannot send it says
// what to do instead: the web version, an older desktop app without that bridge, a brand with no way in
// (Micro800). Help › Test card: every brand, what to install, the clicks, the log to send.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/send-to-plc.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

/** A desktop app with the CLICK bridge only (an older one: no TIA, CODESYS or Studio 5000 bridge). */
const FAKE = () => {
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    onOpenFile: (cb) => { window.__openFile = cb; return () => { window.__openFile = null; }; },
    click: {
      call: async () => ({ ready: false, installs: [], running: false, steps: ['Install CLICK Programming Software from AutomationDirect.'] }),
      logPath: async () => 'C:\\logs\\click-bridge.log',
      showLog: async () => true,
      onProgress: () => () => undefined,
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
  const setPlc = (page, id, cpu) => page.evaluate(async ([i, c]) => { const { useProjectStore } = await appImport('/src/store/useProjectStore.ts'); useProjectStore.getState().setPlc(i, c); useProjectStore.setState({ modules: [] }); }, [id, cpu]);
  const advice = async (page) => {
    await page.goto(BASE + '/program');
    await page.getByTestId('send-to-plc').click();
    const dialog = page.getByRole('dialog', { name: 'Send to PLC software' });
    const text = await dialog.getByTestId('send-to-plc-advice').innerText();
    return { dialog, text };
  };

  // The web version, Siemens: one button; it says to use the desktop app, and Load into PLC meanwhile.
  let page = await open(false);
  await setPlc(page, 'siemens-s7', '6ES7214-1AG40-0XB0');
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: /Load into PLC/ }).waitFor({ timeout: 15000 });
  check(await page.getByRole('button', { name: 'Send to PLC software' }).count() === 1 && await page.getByTestId('send-to-tia').count() === 0, 'browser: one Send to PLC software button');
  let { dialog, text } = await advice(page);
  check(/^Sending to TIA Portal works in the ISA Auto Programmer desktop app for Windows/.test(text) && /Load into PLC/.test(text), 'browser: use the desktop app for Windows; Load into PLC meanwhile');
  await dialog.getByRole('link', { name: 'Test card' }).click();
  await page.getByTestId('test-card').waitFor({ timeout: 10000 });
  check(page.url().endsWith('/test-card'), 'the Test card link opens the Test card');
  await page.context().close();

  // The desktop app with the CLICK bridge: a CLICK project gets the CLICK flow, under the one name.
  page = await open(true);
  await page.goto(BASE + '/program');
  await page.getByTestId('send-to-click').waitFor({ timeout: 15000 });
  check(await page.getByTestId('send-to-click').innerText() === 'Send to PLC software' && await page.getByTestId('send-to-plc').count() === 0, 'desktop, CLICK: the CLICK flow, named Send to PLC software');
  await page.getByTestId('send-to-click').click();
  check(await page.getByRole('dialog', { name: 'Send to CLICK' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'it opens Send to CLICK');
  await page.getByRole('dialog', { name: 'Send to CLICK' }).getByRole('button', { name: 'Close' }).click();

  // That app has no Studio 5000 bridge: update the app.
  await setPlc(page, 'logix', '5069-L310ER');
  ({ dialog, text } = await advice(page));
  check(/cannot send to Studio 5000 yet: update ISA Auto Programmer/.test(text), 'an older desktop app without that bridge: update it');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Micro800: no way into Connected Components Workbench; Load into PLC instead.
  await setPlc(page, 'micro800', '2080-L50E-24QBB');
  ({ dialog, text } = await advice(page));
  check(/^Connected Components Workbench has no way for another program to put a program into it/.test(text) && /Press Load into PLC instead/.test(text), 'Micro800: said plainly, Load into PLC instead');
  await dialog.getByRole('button', { name: 'Close' }).click();
  check(await dialog.count() === 0, 'closes');

  // A project handed over from the web page (electron/sendWatch.cjs): opened on the Program page, to send.
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const { buildProjectFile } = await appImport('/src/project/projectFile.ts');
    const { blob } = await buildProjectFile();
    for (let t0 = Date.now(); !window.__openFile && Date.now() - t0 < 5000;) await new Promise((r) => setTimeout(r, 50));
    window.__openFile('Handed Over.isap', new Uint8Array(await blob.arrayBuffer()), '', 'program');
  });
  await page.waitForURL(/\/program$/, { timeout: 10000 });
  check(await page.getByText(/press Send to PLC software to send it/).first().isVisible().catch(() => false), 'handed over from the web page: opened on the Program page, "press Send to PLC software"');

  // Help › Test card: every brand; the four the app sends to with their log.
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByText('Test card (Send to PLC software)…').click();
  const card = page.getByTestId('test-card');
  await card.waitFor({ timeout: 10000 });
  const brands = await card.locator('section[data-brand]').evaluateAll((s) => s.map((x) => x.getAttribute('data-brand')));
  console.log('  brands:', brands.join(' | '));
  check(brands.length === 8 && ['Siemens', 'CLICK', 'CODESYS', 'ControlLogix', 'Micro800', 'UniStream', 'Vision', 'Yaskawa'].every((b) => brands.some((x) => x.includes(b))), 'Help › Test card: every brand');
  const all = await card.innerText();
  check(['tia-bridge.log', 'click-bridge.log', 'codesys-bridge.log', 'studio5000-bridge.log'].every((l) => all.includes(l)) && /Open log folder/.test(all) && /ISA Auto Programmer\\logs/.test(all), 'each log to send, where the logs are, Open log folder');
  check(/Siemens TIA Openness/.test(all) && /hands off the mouse and keyboard/.test(all), 'what to install and what to do, in plain words');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-plc e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-plc e2e: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
