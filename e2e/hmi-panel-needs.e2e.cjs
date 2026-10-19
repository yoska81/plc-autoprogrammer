// HMI picker: a panel that reaches the PLC through an interface module says so next to it ("PLC needs: CM 1243-5
// DP master …" for a PROFIBUS KTP400 on an S7-1200), and a PanelView 5310 on a CompactLogix names the firmware
// it needs. An Ethernet panel says nothing more.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-panel-needs.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  const rowNote = async (pn) => {
    await page.getByLabel('Search panels').fill(pn);
    const row = page.locator('tr', { has: page.getByLabel(`Choose ${pn}`) }).first();
    await row.waitFor({ timeout: 15000 });
    return { text: (await row.innerText()).replace(/\s+/g, ' '), note: (await row.getByTestId('panel-plc-needs').count()) ? await row.getByTestId('panel-plc-needs').innerText() : '' };
  };
  const onPlc = async (plcId, cpuId) => {
    await page.evaluate(async ([plcId, cpuId]) => {
      const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
      useProjectStore.getState().setPlc(plcId, cpuId);
      useProjectStore.setState({ modules: [] });
    }, [plcId, cpuId]);
    await page.goto(BASE + '/equipment');
    await page.getByLabel('Search panels').waitFor({ timeout: 15000 });
  };

  await onPlc('siemens-s7', '6ES7214-1AG40-0XB0');
  const ktp = await rowNote('6AV2123-2GA03-0AX0');
  log('KTP400 PROFIBUS on S7-1200:', ktp.text);
  check(/^PLC needs: CM 1243-5 DP master \(6GK7243-5DX30-0XE0\)$/.test(ktp.note), 'the PROFIBUS panel names the CM 1243-5 it needs');
  const eth = await rowNote('6AV2123-2GB03-0AX0');
  check(/Yes/.test(eth.text) && eth.note === '', 'the PROFINET panel needs nothing more');

  await onPlc('logix', '1769-L33ER');
  const pv = await rowNote('2713P-T7WD1');
  log('PanelView 5310 on 1769-L33ER:', pv.text);
  check(pv.note === 'Needs Logix controller firmware V27 or later', 'the PanelView 5310 names the firmware it needs');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('hmi-panel-needs e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
