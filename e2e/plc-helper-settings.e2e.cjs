// Settings › Send from the web page (src/plc/ui/PlcHelperCard.tsx), with a fake desktop bridge in the page
// (window.isaDesktop.claudeHelper; the real one is electron/claudeConfig.cjs): not in the browser; the Claude app
// missing said; Connect, then "close the Claude app and open it again"; Disconnect; another installation's entry;
// the settings file the app cannot change, in its words.
//   npm run dev -- --port 5218 &  ;  BASE_URL=http://localhost:5218 node e2e/plc-helper-settings.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5218';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__cfg = { claude: true, connected: false, current: false, file: 'C:\\Users\\tech\\AppData\\Roaming\\Claude\\claude_desktop_config.json', sets: [], error: null };
  const now = () => { const c = window.__cfg; return { claude: c.claude, connected: c.connected, current: c.current, file: c.file, ...(c.error ? { error: c.error } : {}) }; };
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    claudeHelper: {
      status: async () => now(),
      set: async (on) => { const c = window.__cfg; c.sets.push(on); if (!c.error && c.claude) { c.connected = on; c.current = on; } return now(); },
    },
  };
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (desktop, setup) => {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
    if (desktop) await page.addInitScript(FAKE);
    if (setup) await page.addInitScript(setup);
    await useAppModules(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(BASE + '/settings');
    await page.getByTestId('dwg-reader-settings').waitFor({ timeout: 30000 });
    return page;
  };

  let page = await open(false);
  check(await page.getByTestId('plc-helper-settings').count() === 0, 'browser: no card');
  await page.context().close();

  page = await open(true);
  const card = page.getByTestId('plc-helper-settings');
  await card.waitFor({ timeout: 5000 });
  check(await card.getByTestId('plc-helper-status').innerText() === 'Not connected.', 'not connected yet');
  await card.getByTestId('plc-helper-connect').click();
  await card.getByTestId('plc-helper-restart').waitFor({ timeout: 5000 });
  check(/^Connected: the Claude app can use the ISA PLC Helper\.$/.test(await card.getByTestId('plc-helper-status').innerText()) && await card.getByTestId('plc-helper-connect').count() === 0, 'Connect: connected, no Connect button left');
  check(await card.getByTestId('plc-helper-restart').innerText() === 'Close the Claude app and open it again to finish.', 'then: restart the Claude app');
  await card.getByTestId('plc-helper-disconnect').click();
  await card.getByTestId('plc-helper-connect').waitFor({ timeout: 5000 });
  check(await page.evaluate(() => window.__cfg.sets.join()) === 'true,false' && await card.getByTestId('plc-helper-status').innerText() === 'Not connected.', 'Disconnect');
  await page.context().close();

  page = await open(true, () => { queueMicrotask(() => { window.__cfg.claude = false; }); });
  await page.getByTestId('plc-helper-settings').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  check(await page.getByTestId('plc-helper-status').innerText() === 'The Claude desktop app is not installed on this PC.' && await page.getByTestId('plc-helper-connect').count() === 0, 'no Claude app: said, no button');
  await page.context().close();

  page = await open(true, () => { queueMicrotask(() => { Object.assign(window.__cfg, { connected: true, current: false }); }); });
  await page.waitForTimeout(300);
  check(/another installation of this app: connect again/.test(await page.getByTestId('plc-helper-status').innerText()) && await page.getByTestId('plc-helper-connect').count() === 1, 'another installation\'s entry: connect again');
  await page.context().close();

  page = await open(true, () => { queueMicrotask(() => { window.__cfg.error = 'The Claude app\'s settings file is not in a form the app can change safely: nothing was changed.'; }); });
  await page.waitForTimeout(300);
  check(/nothing was changed/.test(await page.getByTestId('plc-helper-status').innerText()), 'a settings file the app cannot change: said');
  await page.context().close();

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nplc-helper-settings e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nplc-helper-settings e2e: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
