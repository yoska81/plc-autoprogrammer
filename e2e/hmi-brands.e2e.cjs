// The HMI designer with other makers' touch panels: an Allen-Bradley CompactLogix + PanelView and a
// Siemens S7-1200 + Siemens panel on the example project. Equipment choice, the HMI page (screens
// laid out at the panel's resolution, maker shown), the simulator's live HMI, and the deliverables
// (screen images, HMI tag list bound to the PLC's tag names, how-to naming the maker's software).
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-brands.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

// A panel without a confirmed resolution (Red Lion G09C1000) is listed but locked.
const CASES = [
  { name: 'Allen-Bradley', cpu: '5069-L306ER', platform: 'ab-compactlogix-5380', panel: '2711R-T7T', lockedIfNoRes: 'G09C1000', maker: 'Allen-Bradley', ioTag: /^Local:\d+:I\./, programFile: /\.L5X$/, viaUi: false },
  { name: 'Siemens', cpu: '6ES7214-1AG40-0XB0', platform: 'siemens-s7-1200', panel: '6AV2123-2GB03-0AX0', lockedIfNoRes: 'G09C1000', maker: 'Siemens', ioTag: /^%I\d+\.\d+$/, programFile: /\.scl$/, viaUi: true },
];

(async () => {
  const browser = await chromium.launch();
  for (const c of CASES) {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
    await useAppModules(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', (d) => d.accept());
    await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(BASE + '/spec');
    await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
    await page.goto(BASE + '/spec');
    await page.locator('select[aria-label="Open project"]').selectOption('p_example');

    // Equipment: the CPU, then the maker's panel from the HMI table.
    if (c.viaUi) {
      await page.goto(BASE + '/equipment');
      await page.locator(`input[aria-label="Choose ${c.cpu}"]`).locator('xpath=ancestor::tr').click();
    } else {
      // CompactLogix has no built-in I/O: apply it with the modules the platform suggests.
      await page.evaluate(async ({ cpu, platform }) => {
        const { platformById, suggestModules } = await appImport('/src/plc/core/platforms.ts');
        const { applyEquipment } = await appImport('/src/spec/equipment.ts');
        const need = { digitalInputs: 6, digitalOutputs: 3, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null };
        applyEquipment({ cpuId: cpu, modules: suggestModules(platformById(platform), cpu, need), hmiPartNumber: null }, null);
      }, { cpu: c.cpu, platform: c.platform });
      await page.goto(BASE + '/equipment');
    }
    await page.waitForTimeout(600);
    await page.getByLabel("Every maker's panels").check();
    // Search finds any maker's panel by part number, current or legacy (nothing is hidden for being old).
    await page.getByLabel('Search panels').fill('8102');
    check(await page.locator('input[aria-label="Choose MT8102iP1"]').count() === 1, `${c.name}: search "8102" finds the Weintek MT8102iP1`);
    check(await page.locator('input[aria-label="Choose MT8102iE1"]').count() === 1, `${c.name}: and the legacy MT8102iE1 (greyed, with its successor)`);
    await page.getByLabel('Search panels').fill('');
    const locked = page.locator('tr', { has: page.locator(`input[aria-label="Choose ${c.lockedIfNoRes}"]`) });
    if (await locked.count()) {
      const t = await locked.innerText();
      check(/Resolution not confirmed/.test(t), `${c.name}: ${c.lockedIfNoRes} (no confirmed resolution) is locked`);
    }
    const row = page.locator('tr', { has: page.locator(`input[aria-label="Choose ${c.panel}"]`) });
    const rowText = await row.innerText();
    check(/Yes/.test(rowText), `${c.name}: ${c.panel} fits the ${c.cpu} (${rowText.replace(/\s+/g, ' ')})`);
    const cmore = await page.locator('tr', { has: page.locator('input[aria-label="Choose CM5-T7W"]') }).innerText();
    check(/CLICK only/.test(cmore), `${c.name}: C-more is not offered for the ${c.cpu}`);
    await row.click();
    await page.getByRole('button', { name: 'Use this selection' }).first().click();
    await page.waitForTimeout(500);
    const applied = await page.evaluate(async () => (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState().hmiPartNumber);
    // The example's HMI, drawings and program were made for CLICK addresses: now out of date.
    const stale = await page.evaluate(async () => { const s = (await appImport('/src/spec/useStages.ts')).stagesNow(); return ['electrical', 'hmi', 'program'].map((k) => s[k].reason ?? 'ready'); });
    log(`${c.name}: after the PLC change: ${stale.join(' | ')}`);
    check(stale.every((r) => /PLC or its I\/O addresses changed/.test(r)), `${c.name}: electrical, HMI and program out of date after the PLC change`);
    check(applied === c.panel, `${c.name}: panel applied (${applied})`);

    // HMI page: screens at the panel's resolution, maker named.
    await page.goto(BASE + '/hmi');
    await page.waitForTimeout(1200);
    const body = await page.locator('main').innerText();
    check(body.includes(c.maker), `${c.name}: HMI page names the maker`);
    const vb = await page.locator('svg[aria-label^="HMI screen"]').first().getAttribute('viewBox');
    log(`${c.name}: HMI screen viewBox ${vb}`);
    check(vb === '0 0 800 480', `${c.name}: screens laid out at 800x480`);

    // Simulator: the live HMI runs against the program.
    await page.goto(BASE + '/simulate');
    await page.waitForTimeout(1500);
    check(await page.locator('svg[aria-label^="HMI screen"]').count() > 0, `${c.name}: live HMI in the simulator`);

    // Deliverables: tag list with the PLC's tag names, how-to naming the software, screen images.
    await page.goto(BASE + '/export');
    await page.waitForTimeout(800);
    check(await page.getByRole('button', { name: 'HMI tag list (CSV)' }).count() === 1, `${c.name}: HMI tag list button`);
    const out = await page.evaluate(async () => {
      const { collectProject } = await appImport('/src/deliverables/collect.ts');
      const { hmiTagCsv, hmiReadme } = await appImport('/src/deliverables/hmiTags.ts');
      const { buildHmiImages, programFiles } = await appImport('/src/deliverables/files.ts');
      const snap = collectProject();
      const imgs = await buildHmiImages(snap);
      // A physical input as the project addresses it now (CLICK-era X001 does not exist on a CompactLogix).
      const firstIn = snap.io.find((x) => x.type === 'input');
      return { csv: hmiTagCsv(snap), readme: hmiReadme(snap), images: imgs.length, files: programFiles(snap).map((f) => f.name), inAddr: snap.addresses.get(firstIn.id), inTag: (await appImport('/src/deliverables/plcTagNames.ts')).plcTagNameOf(snap)(snap.addresses.get(firstIn.id)).io };
    });
    const parseCsvLine = (l) => [...l.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
    const rows = out.csv.split('\r\n').slice(1).map(parseCsvLine);
    log(`${c.name}: tag list ${rows.length} rows; input ${out.inAddr} → ${out.inTag}; images ${out.images}; program ${out.files.join(', ')}`);
    check(rows.length > 10, `${c.name}: tag list has the HMI tags`);
    check(c.ioTag.test(out.inTag ?? ''), `${c.name}: input ${out.inAddr} bound to the PLC I/O (${out.inTag})`);
    // Internal HMI bits/registers: named as in the exported program (Dev 2's plcTagNames).
    const internal = rows.filter((r) => /^(C|DS|DF)\d+$/.test(r[1]));
    const unnamed = internal.filter((r) => !r[2] || /not in the program|pending/.test(r[2]));
    log(`${c.name}: e.g. ${internal.slice(0, 3).map((r) => `${r[1]} → ${r[2]} (${r[3]})`).join('; ')}`);
    check(internal.length > 5 && !unnamed.length, `${c.name}: every HMI bit/register has its PLC tag name (${unnamed.map((r) => r[1]).join(', ')})`);
    check(out.images >= 6, `${c.name}: screen images`);
    check(out.readme.includes(c.panel) && out.readme.includes('does not contain a project file'), `${c.name}: how-to names the panel and makes no project file`);
    check(out.files.some((f) => c.programFile.test(f)), `${c.name}: PLC program export`);
    log(`${c.name}: how-to: ${out.readme.split('\r\n')[2]}`);
    for (const e of errors) fails.push(`${c.name}: page error ${e.slice(0, 160)}`);
  }
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('Allen-Bradley and Siemens panels: designed, simulated and delivered');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
