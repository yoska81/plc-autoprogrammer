// CAD exports from the Electrical page: "Save as AutoCAD (DXF)" and "Save as EPLAN" download zips with the
// drawing sheets as DXF (layers, ISA_DEVICE / ISA_WIRENO blocks) and the EPLAN import package (AML, lists, README).
// Uses the example project (dev build).
//
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/cad-export.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const OUT = __dirname + '/out-cad-export/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await import('/src/preview/sampleProject.ts');
    const ps = await import('/src/store/useProjectsStore.ts');
    localStorage.clear();
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
  });
  await page.goto(BASE + '/electrical?tab=cabinet');

  const save = async (name) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name }).click()]);
    const file = OUT + dl.suggestedFilename();
    await dl.saveAs(file);
    return { name: dl.suggestedFilename(), zip: await JSZip.loadAsync(fs.readFileSync(file)) };
  };

  const ac = await save('Save as AutoCAD (DXF)');
  const acFiles = Object.keys(ac.zip.files).filter((n) => !ac.zip.files[n].dir);
  const dxfs = acFiles.filter((n) => /^dxf\/.*\.dxf$/.test(n));
  log('AutoCAD:', ac.name, dxfs.length, 'DXF sheets;', acFiles.filter((n) => !n.startsWith('dxf/')).join(', '));
  check(/_autocad_dxf\.zip$/.test(ac.name), 'AutoCAD zip name');
  check(dxfs.length >= 10 && acFiles.includes('README.txt'), 'DXF sheets + README');
  const control = await ac.zip.file(dxfs.find((n) => /control|schematic/i.test(n)) ?? dxfs[2]).async('string');
  for (const s of ['AC1021', 'ISA_DEVICE', 'ISA_WIRENO', 'TAG1', 'WIRENO', 'BORDER', 'SYMS', 'TAGS']) check(control.includes(s), `DXF has ${s}`);

  const ep = await save('Save as EPLAN');
  const epFiles = Object.keys(ep.zip.files).filter((n) => !ep.zip.files[n].dir);
  log('EPLAN:', ep.name, epFiles.filter((n) => !n.startsWith('dxf/')).join(', '));
  check(/_eplan_import\.zip$/.test(ep.name), 'EPLAN zip name');
  for (const f of ['plc_assignment_list.csv', 'parts_eplan.xml', 'device_list.csv', 'terminal_plan.csv', 'cable_schedule.csv', 'connection_list.csv', 'README.txt']) check(epFiles.includes(f), f);
  const aml = epFiles.find((n) => n.endsWith('.aml'));
  check(!!aml, '.aml file');
  const xml = await ep.zip.file(aml).async('string');
  check(/<CAEXFile SchemaVersion="3\.0"/.test(xml) && /AutomationProjectConfigurationRoleClassLib\/TagTable/.test(xml), 'CAEX 3.0 AR APC');
  check(epFiles.filter((n) => n.startsWith('dxf/')).length === dxfs.length, 'same DXF sheets');
  check(/cannot be written/.test(await ep.zip.file('README.txt').async('string')), 'README is honest about native EPLAN files');

  check(!errors.length, 'no browser errors: ' + errors.join(' | '));
  await browser.close();
  log('cad-export E2E passed');
})().catch((e) => { console.error(e); process.exit(1); });
