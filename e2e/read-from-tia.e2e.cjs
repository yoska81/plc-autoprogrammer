// "Read from TIA Portal" on the Upgrade page, with a fake desktop bridge in the page (window.isaDesktop.tia; the
// real one is electron/tiaBridge.cjs): hidden in the browser; finds the TIA Portals with a project open, reads the
// program (readBack: blocks as SimaticML and the PLC tags, built here from the example's LAD export) into the
// program import, and names the blocks TIA kept back; no TIA Portal with a project: said.
// Real TIA Portal is tried by hand: tools/tia-bridge/README.md.
//   npm run dev -- --port 5214 &  ;  BASE_URL=http://localhost:5214 node e2e/read-from-tia.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5214';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const FAKE = () => {
  window.__tia = { calls: [], portals: [], readBack: null };
  window.isaDesktop = {
    isDesktop: true, version: 'test', print: async () => ({ ok: true }),
    tia: {
      call: async (cmd, args = {}) => {
        window.__tia.calls.push({ cmd, args });
        await new Promise((r) => setTimeout(r, 150));
        if (cmd === 'detect') return { ready: true, installed: ['V19'], openness: [{ version: 'V19', assemblyVersion: '19.0.0.0', dll: 'x' }], inOpennessGroup: true, user: 'PC1\\tech', steps: [] };
        if (cmd === 'portals') return { version: 'V19', portals: window.__tia.portals };
        if (cmd === 'open') return { version: 'V19', project: window.__tia.portals.find((p) => p.processId === args.processId).project, plc: null };
        if (cmd === 'readBack') return window.__tia.readBack;
        throw new Error(`no ${cmd}`);
      },
      logPath: async () => 'C:\\logs\\tia-bridge.log',
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

  let page = await open(false);
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('program-file').waitFor({ state: 'attached', timeout: 15000 });
  check(await page.getByTestId('read-from-tia').count() === 0, 'browser: no Read from TIA Portal');
  await page.context().close();

  page = await open(true);
  // what TIA Portal would give for the example as a Siemens project: its LAD blocks and its PLC tags
  const made = await page.evaluate(async () => {
    const { useProjectStore } = await appImport('/src/store/useProjectStore.ts');
    useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
    const { collectProject } = await appImport('/src/deliverables/collect.ts');
    const { exportContext } = await appImport('/src/deliverables/exportContext.ts');
    const { buildTiaLad } = await appImport('/src/plc/core/profiles/siemensLad.ts');
    const { tiaTagRows } = await appImport('/src/plc/tia/tiaSend.ts');
    const p = collectProject();
    const x = buildTiaLad(p.ladder, exportContext(p), 'Machine', 'V19');
    return {
      rungs: p.ladder.rungs.length,
      blocks: x.files.filter((f) => f.name.endsWith('.xml')).map((f) => ({ name: f.name.replace(/\.xml$/, ''), xml: f.content })),
      tags: tiaTagRows(p).map((t) => ({ name: t.name, dataType: t.dataType, address: t.logicalAddress, comment: t.comment })),
    };
  });
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('read-from-tia').waitFor({ timeout: 15000 });
  // no TIA Portal with a project open
  await page.evaluate(() => { window.__tia.portals = [{ processId: 7, project: null }]; });
  await page.getByTestId('read-from-tia-find').click();
  await page.getByText('No TIA Portal with a project open').waitFor({ timeout: 5000 });
  check(true, 'no project open in TIA Portal: said');

  await page.evaluate((m) => {
    window.__tia.portals = [{ processId: 4242, project: 'D:\\Lines\\Conveyor cell\\Conveyor cell.ap19' }];
    window.__tia.readBack = { plc: { name: 'PLC_1', orderNumber: '6ES7 214-1AG40-0XB0', firmware: 'V4.6' }, blocks: m.blocks, failed: [{ name: 'Vendor_FB', error: 'know-how protected: TIA Portal does not give its content to other programs' }], tags: m.tags };
  }, made);
  await page.getByTestId('read-from-tia-find').click();
  await page.getByTestId('read-from-tia-read').waitFor({ timeout: 5000 });
  check(/Conveyor cell\.ap19/.test(await page.getByTestId('read-from-tia').innerText()), 'the TIA Portal with its project offered');
  await page.getByTestId('read-from-tia-read').click();
  await page.getByTestId('program-found').waitFor({ timeout: 60000 });
  const found = await page.getByTestId('program-found').innerText();
  log('found:', found.replace(/\s+/g, ' ').slice(0, 220));
  const calls = await page.evaluate(() => window.__tia.calls.map((c) => c.cmd));
  check(calls.includes('readBack') && calls[calls.indexOf('readBack') - 1] === 'open' && !calls.some((c) => /^(blocks|tags|plc|download|compile)$/.test(c)), 'read only: open, then readBack (nothing written to TIA Portal)');
  const converted = /(\d+) of (\d+) rungs converted/.exec(found);
  check(converted && Number(converted[2]) >= made.rungs && Number(converted[1]) >= made.rungs - 5, `the program read: ${converted?.[0]}`);
  check(/Start_Button|Start Button/.test(found) && /%IX?0\.1/.test(found), 'the I/O with the PLC tag addresses');
  check(/Vendor_FB: not read \(know-how protected/.test(await page.getByTestId('read-from-tia').innerText()), 'a block TIA kept back: named');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nread-from-tia e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nread-from-tia e2e: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
