// "Teach the app MPE720" (Yaskawa): in the Send to PLC software window of a Yaskawa project, with a fake desktop
// bridge (window.isaDesktop.click; the real one runs tools/click-bridge's read-only learn command): each step
// recorded on Record, MPE720 not open said, the log folder offered for sending. Nothing but learn is called.
//   npm run dev -- --port 5221 &  ;  BASE_URL=http://localhost:5221 node e2e/learn-mpe720.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5221';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__learn = { calls: [], open: false, shownLog: false };
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    click: {
      call: async (cmd, args = {}) => {
        const t = window.__learn;
        t.calls.push({ cmd, args });
        await new Promise((r) => setTimeout(r, 80));
        if (cmd === 'learn') return {
          installed: [{ name: 'MPE720 Ver.7', version: '7.95', folder: 'C:\\YASKAWA\\MPE720' }],
          running: t.open ? [{ processId: 77, title: 'MPE720 Ver.7 - demo' }] : [],
          windows: t.open ? ['MPE720 Ver.7 - demo', 'H01'] : [],
          file: `C:\\logs\\learn-mpe720-${args.label}.txt`, shot: null,
        };
        return null;
      },
      logPath: async () => 'C:\\logs\\click-bridge.log',
      showLog: async () => { window.__learn.shownLog = true; return true; },
      onProgress: () => () => {},
    },
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.addInitScript(FAKE);
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async () => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    const { getProfile } = await appImport('/src/plc/core/profiles/index.ts');
    const prof = getProfile('yaskawa-mp');
    useProjectStore.getState().setPlc('yaskawa-mp', prof.defaultCpuId);
  });
  await page.goto(BASE + '/program');
  await page.getByTestId('send-to-plc').click();
  const panel = page.getByTestId('learn-mpe720');
  await panel.waitFor({ timeout: 10000 });
  check(/Teach the app MPE720/.test(await panel.innerText()) && /does not click, type or change anything/.test(await panel.innerText()), 'the panel says what it is and that it only looks');

  // MPE720 not open: said
  await page.getByTestId('learn-record-1 project open').click();
  await page.getByRole('alert').filter({ hasText: 'MPE720 is not open' }).waitFor({ timeout: 5000 });
  check(true, 'MPE720 not open: said');

  // open: each step recorded, the folder offered
  await page.evaluate(() => { window.__learn.open = true; });
  for (const l of ['1 project open', '2 ladder drawing']) {
    await page.getByTestId(`learn-record-${l}`).click();
    await page.getByTestId(`learn-done-${l}`).waitFor({ timeout: 5000 });
  }
  check(/2 windows/.test(await page.getByTestId('learn-done-2 ladder drawing').innerText()), 'a step recorded: its windows counted');
  check(/2 of 7 recorded/.test(await page.getByTestId('learn-send').innerText()), 'how many recorded, and what to send');
  await page.getByTestId('learn-send').getByRole('button', { name: 'Open log folder' }).click();
  const t = await page.evaluate(() => window.__learn);
  check(t.shownLog, 'the log folder opened');
  check(t.calls.every((c) => c.cmd === 'learn' && c.args.target === 'mpe720'), `only the read-only learn was called (${[...new Set(t.calls.map((c) => c.cmd))]})`);
  await page.screenshot({ path: __dirname + '/out-flow/learn-mpe720.png' });
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `learn-mpe720 e2e: ${fails.length} failed` : 'learn-mpe720 e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
