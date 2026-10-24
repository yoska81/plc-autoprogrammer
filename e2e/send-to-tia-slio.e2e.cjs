// Send to TIA Portal for a Yaskawa System SLIO CPU 015PN (TIA Portal sets it up as a Siemens CPU 315-2 PN/DP V3.2,
// Yaskawa manual HB300 12.3), with the fake TIA bridge: the PLC added as 6ES7315-2EH14-0AB0 V3.2 (not the newest
// firmware), the SLIO modules left to Yaskawa's GSDML (said), the first-scan memory bit in the tags, the program as
// one S7-300 SCL source (no LAD, no TONR / R_TRIG / optimized blocks), compiled.
//   npm run dev -- --port 5222 &  ;  BASE_URL=http://localhost:5222 node e2e/send-to-tia-slio.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5222';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__tia = { calls: [] };
  const answer = (cmd, args) => {
    if (cmd === 'detect') return { ready: true, installed: ['V19'], openness: [{ version: 'V19', assemblyVersion: '19.0.0.0', dll: 'x' }], inOpennessGroup: true, user: 'PC1\\tech', steps: [] };
    if (cmd === 'portals') return { version: 'V19', portals: [] };
    if (cmd === 'open') return { version: 'V19', project: `C:\\TIA\\${args.name}\\${args.name}.ap19`, plc: null };
    if (cmd === 'firmware') return { orderNumber: args.orderNumber, versions: ['V3.2', 'V3.1', 'V2.6'].includes('V3.2') && args.orderNumber === '6ES7315-2EH14-0AB0' ? ['V3.2', 'V3.1'] : ['V4.6'] };
    if (cmd === 'plc') return { plc: { name: args.name, orderNumber: '6ES7 315-2EH14-0AB0', firmware: args.firmware }, added: true, problems: [] };
    if (cmd === 'tags') return { table: 'ISA Auto Programmer', created: args.tags.length, updated: 0, failed: [] };
    if (cmd === 'blocks') return { imported: args.files.length, failed: [] };
    if (cmd === 'compile') return { errors: 0, warnings: 0, messages: [] };
    return null;
  };
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    tia: {
      call: async (cmd, args = {}) => { window.__tia.calls.push({ cmd, args }); await new Promise((r) => setTimeout(r, 80)); return answer(cmd, args); },
      logPath: async () => 'C:\\logs\\tia-bridge.log',
      showLog: async () => true,
      onProgress: () => () => {},
    },
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await page.addInitScript(FAKE);
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async () => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    useProjectStore.getState().setPlc('siemens-s7', '015-CEFPR01');
    useProjectStore.setState({ modules: ['021-1BH00', '022-1BH00'] });
  });
  await page.goto(BASE + '/program');
  await page.getByTestId('send-to-tia').click();
  const dialog = page.getByRole('dialog', { name: 'Send to TIA Portal' });
  await dialog.getByTestId('tia-open-button').click();
  const fw = dialog.getByLabel('Firmware');
  await fw.waitFor({ timeout: 5000 });
  for (let i = 0; i < 50 && !(await fw.inputValue()); i++) await page.waitForTimeout(100);
  check(await fw.inputValue() === 'V3.2', `firmware: V3.2 as Yaskawa's manual says (${await fw.inputValue()})`);
  await dialog.getByTestId('tia-send-button').click();
  await dialog.getByTestId('tia-tags-done').waitFor({ timeout: 5000 });
  const calls = await page.evaluate(() => window.__tia.calls);
  const plc = calls.find((c) => c.cmd === 'plc').args;
  check(calls.find((c) => c.cmd === 'firmware').args.orderNumber === '6ES7315-2EH14-0AB0', 'the firmware list asked for the Siemens CPU TIA Portal sets it up as');
  check(plc.orderNumber === '6ES7315-2EH14-0AB0' && plc.firmware === 'V3.2' && plc.modules.length === 0, `the PLC: CPU 315-2 PN/DP V3.2, no Siemens modules (${JSON.stringify(plc)})`);
  const plcText = await dialog.getByTestId('tia-plc-done').innerText();
  check(/GSDML "SLIO System"/.test(plcText) && /021-1BH00/.test(plcText), 'the SLIO modules: Yaskawa\'s GSDML, said');
  const tags = calls.find((c) => c.cmd === 'tags').args.tags;
  check(tags.some((t) => t.name === 'ISA_Initialized' && t.logicalAddress === '%M100.0'), 'the first-scan memory bit in the tags');
  await dialog.getByTestId('tia-program-button').click();
  await dialog.getByTestId('tia-compiled').waitFor({ timeout: 10000 });
  const files = (await page.evaluate(() => window.__tia.calls)).find((c) => c.cmd === 'blocks').args.files;
  const scl = files[0]?.text ?? '';
  check(files.length === 1 && files[0].kind === 'scl' && files[0].name === 'Machine.scl', `the program as one SCL source (${files.map((f) => f.name)})`);
  check(/^FUNCTION_BLOCK "Machine"/.test(scl) && !/S7_Optimized_Access|TONR|R_TRIG|NORM_X|CTU_DINT|TON_TIME/.test(scl) && /"ISA_Initialized"/.test(scl), 'S7-300 SCL: standard blocks, S7-300 timers / counters, edges written out');
  const prog = await dialog.getByTestId('tia-program-done').innerText();
  check(/The program imported as SCL: all \d+ rungs/.test(prog) && /Compiled: no errors/.test(prog), 'imported and compiled, said');
  await page.screenshot({ path: __dirname + '/out-flow/send-to-tia-slio.png' });
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `send-to-tia-slio e2e: ${fails.length} failed` : 'send-to-tia-slio e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
