// "Send to PLC software" on the web page (the claude.ai preview, VITE_PREVIEW=1) through the ISA PLC Helper
// (src/desktop/plcHelper.ts), with a fake `window.claude` runtime: without the helper (a browser tab, or not
// installed) the press says what to do in one plain sentence with the install link; with it, the same press opens
// the project's flow, whose commands run on the helper (look for detect, status polled, progress shown), and Stop
// goes to the helper. A brand with no flow keeps its own advice and never looks for the helper.
//   VITE_PREVIEW=1 npx vite --config vite.preview.config.ts --port 5217 &  ;  BASE_URL=http://localhost:5217 node e2e/send-to-plc-helper.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5217';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

/** The artifact runtime: mcp reaches the helper only when window.__helper is on (else server_not_connected). */
const FAKE = () => {
  window.__helper = false;
  window.__calls = [];
  const jobs = new Map();
  let next = 1;
  const mcp = {
    callTool: async (server, tool, input = {}) => {
      window.__calls.push({ server, tool, input });
      await new Promise((r) => setTimeout(r, 30));
      if (!window.__helper || server !== 'host:isa_plc_helper') throw { code: 'server_not_connected', message: 'no host bridge' };
      if (tool === 'about') return { payload: { helper: 'ISA PLC Helper', version: 'test' } };
      if (tool === 'start' || tool === 'look') {
        const job = { cmd: input.cmd, polls: 0, lines: [] };
        jobs.set(next, job);
        return { payload: { job: next++ } };
      }
      if (tool === 'status') {
        const j = jobs.get(input.job);
        j.polls++;
        if (j.cmd === 'detect') {
          if (j.polls === 1) { j.lines.push('Looking for CLICK Programming Software…'); return { payload: { state: 'running', progress: j.lines.slice(input.from), next: j.lines.length } }; }
          return { payload: { state: 'done', progress: [], next: j.lines.length, result: { ready: false, installs: [], running: false, steps: ['Install CLICK Programming Software from AutomationDirect.'] } } };
        }
        return { payload: { state: 'failed', progress: [], next: 0, error: 'Not in this test.' } };
      }
      if (tool === 'logPath') return { payload: { path: 'C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\logs\\click-bridge.log' } };
      if (tool === 'stop') return { payload: { stopping: false } };
      throw { code: 'tool_error', message: 'unknown tool' };
    },
  };
  window.claude = { use: async (name) => (name === 'mcp' ? mcp : null) };
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await page.addInitScript(FAKE);
  await useAppModules(page);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/#/program');
  const button = page.getByTestId('send-to-plc');
  await button.waitFor({ timeout: 30000 });
  check(await page.evaluate(() => window.__calls.length) === 0, 'nothing asked of the helper before the press');

  // No helper: one plain sentence and the install link.
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Send to PLC software' });
  await dialog.waitFor({ timeout: 5000 });
  const text = await dialog.getByTestId('send-to-plc-advice').innerText();
  check(text === 'To send from this page, open it in the Claude desktop app, or install the ISA PLC Helper once.', `no helper: the plain sentence (${text})`);
  check(/releases/.test(await dialog.getByTestId('send-to-plc-helper-download').getAttribute('href')), 'the install link');
  const calls = await page.evaluate(() => window.__calls);
  check(calls.length === 1 && calls[0].server === 'host:isa_plc_helper' && calls[0].tool === 'about', 'the press asked the helper once (about)');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The helper answers: the same press opens the CLICK flow, which runs on the helper.
  await page.evaluate(() => { window.__helper = true; window.__calls = []; });
  await button.click();
  const click = page.getByRole('dialog', { name: 'Send to CLICK' });
  check(await click.waitFor({ timeout: 5000 }).then(() => true, () => false), 'with the helper: the press opens Send to CLICK');
  await click.getByTestId('click-steps').waitFor({ timeout: 5000 });
  check(/Install CLICK Programming Software from AutomationDirect/.test(await click.getByTestId('click-steps').innerText()), 'the check ran on the helper: what this PC lacks');
  const used = await page.evaluate(() => window.__calls.map((c) => `${c.tool}${c.input.cmd ? ':' + c.input.cmd : ''}`));
  check(used[0] === 'about' && used.includes('look:detect') && used.filter((u) => u === 'status').length >= 2 && !used.includes('start:detect'), `detect is a read-only look, polled (${used.join(' ')})`);
  check(await page.getByTestId('send-to-plc').count() === 0 && await page.getByTestId('send-to-click').innerText() === 'Send to PLC software', 'from now on the flow\'s own button, same name');
  await click.getByRole('button', { name: 'Close' }).click();

  // A brand with no flow: its advice, the helper not asked.
  await page.evaluate(async () => { const { useProjectStore } = await appImport('/src/store/useProjectStore.ts'); useProjectStore.getState().setPlc('micro800', '2080-L50E-24QBB'); window.__calls = []; });
  await page.getByTestId('send-to-plc').click();
  const advice = await page.getByRole('dialog', { name: 'Send to PLC software' }).getByTestId('send-to-plc-advice').innerText();
  check(/^Connected Components Workbench has no way/.test(advice) && await page.getByTestId('send-to-plc-helper-download').count() === 0 && await page.evaluate(() => window.__calls.length) === 0, 'Micro800: its own advice, no helper asked');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nsend-to-plc-helper e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nsend-to-plc-helper e2e: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
