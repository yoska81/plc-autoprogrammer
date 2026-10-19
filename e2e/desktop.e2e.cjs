// Desktop (Electron) app: launches the built app, checks the window, that projects survive a restart,
// that saving goes through the native Save dialog, and that printing lays the PDF out at its real size.
//
//   npm run build:desktop
//   xvfb-run -a node e2e/desktop.e2e.cjs        # Linux without a display
const { _electron: electron } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out-desktop');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'isa-desktop-'));
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

/** A generated L5X (no customer data): `programs` stations of 50 rungs, too big for localStorage once imported. */
function bigL5x(programs) {
  const io = 512;
  const tags = Array.from({ length: io }, (_, i) => `<Tag Name="In_${i}" TagType="Alias" AliasFor="Local:${(i >> 4) + 1}:I.Data.${i % 16}"/><Tag Name="Out_${i}" TagType="Alias" AliasFor="Local:${(io >> 4) + (i >> 4) + 1}:O.Data.${i % 16}"/>`).join('');
  const mods = Array.from({ length: (io >> 4) * 2 }, (_, s) => `<Module Name="M${s}" CatalogNumber="${s < io >> 4 ? '1769-IQ16/A' : '1769-OB16/A'}" ParentModule="Local"><Ports><Port Id="1" Address="${s + 1}" Type="Compact" Upstream="true"/></Ports></Module>`).join('');
  const progs = Array.from({ length: programs }, (_, p) => `<Program Name="Station_${p}" MainRoutineName="Main"><Tags/><Routines><Routine Name="Main" Type="RLL"><RLLContent>${Array.from({ length: 50 }, (_, r) => `<Rung Number="${r}" Type="N"><Comment><![CDATA[Station ${p} step ${r}]]></Comment><Text><![CDATA[XIC(In_${(p * 7 + r) % io})XIO(In_${(p + r + 1) % io})OTE(Out_${(p * 5 + r) % io});]]></Text></Rung>`).join('')}</RLLContent></Routine></Routines></Program>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<RSLogix5000Content SchemaRevision="1.0" TargetName="Big" TargetType="Controller"><Controller Use="Target" Name="Big" ProcessorType="1769-L33ER"><Modules><Module Name="Local" CatalogNumber="1769-L33ER" ParentModule="Local"/>${mods}</Modules><Tags>${tags}</Tags><Programs>${progs}</Programs></Controller></RSLogix5000Content>`;
}

const launch = (env = {}) => electron.launch({
  executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
  args: [ROOT, '--no-sandbox'],
  env: { ...process.env, ISA_USER_DATA: PROFILE, ...env },
});

// Close the app. A project opened from an .isap has unsaved changes: answer the app's
// "Close without saving" prompt and the page's beforeunload (nothing can be clicked headless).
async function closeApp(app, win) {
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  win.on('dialog', (d) => d.accept().catch(() => {}));
  await app.close();
}

(async () => {
  const errors = [];
  // ── First run ──
  let app = await launch();
  let win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  const title = await win.title();
  const bridge = await win.evaluate(() => ({ isDesktop: window.isaDesktop?.isDesktop, version: window.isaDesktop?.version, keys: Object.keys(window.isaDesktop ?? {}), node: typeof require !== 'undefined' || typeof process !== 'undefined' }));
  const status = await win.locator('div.h-6').last().innerText();
  log('Window title:', title, '| url', win.url(), '| bridge', JSON.stringify(bridge), '| status bar', status.replace(/\s+/g, ' '));
  check(win.url().startsWith('app://isa/'), 'app served from app://isa');
  check(bridge.isDesktop && bridge.keys.includes('print') && bridge.keys.includes('saveFile') && bridge.keys.includes('listPrinters'), 'desktop bridge exposed');
  check(!bridge.node, 'no Node in the page');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check(bridge.version === pkg.version && status.includes(`v${pkg.version}`), 'version from package.json');
  await win.screenshot({ path: path.join(OUT, '01_main_window.png') });

  // Create a project through the wizard; it must survive a restart.
  await win.getByRole('button', { name: 'New project' }).first().click();
  await win.getByPlaceholder('e.g. Line 3 case packer').fill('Desktop Test Cell');
  await win.getByRole('button', { name: 'Next →' }).click();
  await win.getByRole('button', { name: 'Close ✕' }).click();
  await win.waitForTimeout(500);
  const projects1 = await win.locator('select[aria-label="Open project"] option').allInnerTexts();
  log('Projects before restart:', projects1.join(' | '));

  // Native Save dialog (stubbed in the main process: no dialog can be clicked headless).
  const savePath = path.join(OUT, 'saved_io_list.csv');
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, savePath);
  const saved = await win.evaluate(async () => window.isaDesktop.saveFile('io_list.csv', new TextEncoder().encode('Tag,Address\nI001,X001\n')));
  log('saveFile:', JSON.stringify(saved), '| file', fs.existsSync(savePath) ? fs.readFileSync(savePath, 'utf8').split('\n')[1] : 'missing');
  check(saved.ok && fs.readFileSync(savePath, 'utf8').includes('I001,X001'), 'file saved through the Save dialog');
  // Through the app's own Deliverables button (saveBlob → bridge).
  const csvPath = path.join(OUT, 'from_button.csv');
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, csvPath);
  await win.locator('nav a', { hasText: 'Deliverables' }).click();
  await win.getByRole('button', { name: 'Excel report', exact: true }).click();
  // the exact path: "The file could not be saved: …" also contains "saved:"
  await win.getByRole('alert').filter({ hasText: `Saved: ${csvPath}` }).waitFor({ timeout: 60000 });
  log('Excel report via Save dialog:', fs.statSync(csvPath).size, 'bytes,', (await win.getByRole('alert').innerText()).split('\n')[0]);
  // Cabinet pictures and HMI screen images (example project): one Save dialog each, a ZIP of real PNGs.
  const JSZip = require('jszip');
  // The example project, opened the way Explorer opens an .isap (double-click → isa:open-file).
  const isap = path.join(__dirname, 'fixtures', 'example.isap');
  await app.evaluate(({ BrowserWindow }, [f, bytes]) => BrowserWindow.getAllWindows()[0].webContents.send('isa:open-file', 'example.isap', new Uint8Array(bytes), f), [isap, [...fs.readFileSync(isap)]]);
  await win.waitForFunction(() => /example/i.test(document.querySelector('select[aria-label="Open project"] option:checked')?.textContent ?? ''), null, { timeout: 30000 });
  await win.waitForTimeout(1500);
  const opened = (await win.locator('select[aria-label="Open project"] option').allInnerTexts()).filter((t) => /example/i.test(t));
  check(opened.length === 1, `one .isap open makes one project (${opened.join(' | ')})`);
  await win.locator('nav a', { hasText: 'Deliverables' }).click();
  for (const [name, file, min] of [['Cabinet pictures (ZIP)', 'cabinet_pictures.zip', 2], ['Screen images (ZIP)', 'hmi_screens.zip', 1]]) {
    const zp = path.join(OUT, file);
    await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); }, zp);
    await win.getByRole('button', { name, exact: true }).click();
    await win.getByRole('alert').filter({ hasText: `Saved: ${zp}` }).waitFor({ timeout: 120000 });
    const zip = await JSZip.loadAsync(fs.readFileSync(zp));
    const pngs = Object.keys(zip.files).filter((f) => f.endsWith('.png'));
    for (const f of pngs) check((await zip.file(f).async('nodebuffer')).subarray(1, 4).toString() === 'PNG', `${name}: ${f} is a PNG`);
    check(pngs.length >= min, `${name}: ${pngs.length} PNGs`);
    log(`${name} via Save dialog:`, pngs.join(', '));
  }
  await win.locator('select[aria-label="Open project"]').selectOption({ label: 'Desktop Test Cell' });
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  const cancelled = await win.evaluate(async () => window.isaDesktop.saveFile('x.pdf', new Uint8Array([1])));
  check(cancelled.cancelled === true, 'cancel reported');

  // Connect to PLC: Modbus TCP through the bridge (main process) to a fake PLC.
  const { fakeServer } = require('./fake-modbus.cjs');
  const plc = fakeServer();
  const mbPort = await plc.listen();
  plc.mem.coils[16384] = 1; plc.mem.holding[0] = 1234; plc.state.refuse.add(16400);
  const mb = await win.evaluate(async (port) => {
    const m = window.isaDesktop.modbus;
    const statuses = [];
    const off = m.onStatus((s) => statuses.push(s));
    const out = {};
    const err = async (p) => { try { await p; return 'no error'; } catch (e) { return e.message; } };
    out.notConnected = await err(m.readCoils(0, 1));
    out.badHost = await m.connect({ host: '', port, unitId: 1, timeoutMs: 1000 });
    out.connect = await m.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 1000 });
    out.coils = await m.readCoils(16384, 2);
    out.regs = await m.readHoldingRegisters(0, 1);
    await m.writeCoil(16385, true);
    await m.writeRegister(1, 99);
    out.after = [await m.readCoils(16385, 1), await m.readHoldingRegisters(1, 1)];
    out.exception = await err(m.writeCoil(16400, true));
    out.badCount = await err(m.readCoils(0, 5000));
    await m.disconnect();
    out.afterDisconnect = await err(m.readCoils(0, 1));
    await new Promise((r) => setTimeout(r, 100));
    off();
    out.statuses = statuses;
    return out;
  }, mbPort);
  log('Modbus via bridge:', JSON.stringify(mb));
  check(mb.notConnected === 'Not connected' && mb.badHost.ok === false && /IP address/.test(mb.badHost.error), 'modbus: not connected / bad host');
  check(mb.connect.ok === true && JSON.stringify(mb.coils) === '[true,false]' && mb.regs[0] === 1234, 'modbus: connect and read');
  check(plc.mem.coils[16385] === 1 && plc.mem.holding[1] === 99 && JSON.stringify(mb.after) === '[[true],[99]]', 'modbus: writes');
  check(mb.exception === 'Modbus exception 2 (illegal data address) at 16400' && /Count must be 1–2000/.test(mb.badCount), 'modbus: plain errors');
  check(mb.afterDisconnect === 'Not connected' && mb.statuses.some((s) => s.connected) && !mb.statuses.at(-1).connected, 'modbus: status events');
  await plc.close();

  // DWG import: GNU LibreDWG's dwg2dxf.exe comes with the Windows installer; this run is the unpackaged app on
  // Linux, where the Windows converter can't run: the bridge and Settings say so plainly
  const dwg = await win.evaluate(async () => ({ status: await window.isaDesktop.dwg.status(), read: await window.isaDesktop.dwg.read([{ name: 'a.dwg', bytes: new TextEncoder().encode('AC1032..') }]) }));
  const winBuild = process.platform === 'win32';
  check(winBuild ? dwg.status.ok && dwg.status.builtIn : dwg.status.ok === false && dwg.read.notConfigured === true, `dwg converter status: ${JSON.stringify(dwg)}`);
  await win.evaluate(() => { window.history.pushState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate')); });
  const dwgCard = win.getByTestId('dwg-reader-settings');
  await dwgCard.waitFor({ timeout: 10000 });
  const cardText = await dwgCard.innerText();
  check((winBuild ? /Ready: DWG files are converted by GNU LibreDWG/ : /Not available in this installation/).test(cardText) && /Advanced: use another DWG reader/.test(cardText) && !/ODA/.test(cardText), 'Settings → DWG drawings: built-in converter, other reader only under Advanced');

  const printers = await win.evaluate(async () => window.isaDesktop.listPrinters());
  log('Printers seen by Windows/CUPS:', printers.length ? printers.map((p) => p.name).join(', ') : 'none (no printers on this machine)');
  await win.screenshot({ path: path.join(OUT, '02_deliverables.png') });

  // A big program (only IndexedDB can hold it) made the project just before the window closes: closing waits
  // for the write, and it is all there after the restart.
  await win.evaluate(() => { history.pushState({}, '', '/import?tab=program'); dispatchEvent(new PopStateEvent('popstate')); });
  await win.getByTestId('program-file').setInputFiles({ name: 'Big_Line.L5X', mimeType: 'application/xml', buffer: Buffer.from(bigL5x(400)) });
  await win.getByTestId('program-found').waitFor({ timeout: 120000 });
  await win.getByTestId('program-apply').click();
  await win.waitForFunction(() => !document.querySelector('[data-testid=program-apply]')?.disabled, null, { timeout: 120000 });
  // the stores write a moment after the change; then the window is closed at once, with the write in flight
  await win.waitForFunction(() => localStorage.getItem('plc-program-store') === '\u0000in-indexeddb', null, { timeout: 10000 });
  await closeApp(app, win);

  // ── Second run: projects kept; window size remembered ──
  app = await launch();
  win = await app.firstWindow();
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  const projects2 = await win.locator('select[aria-label="Open project"] option').allInnerTexts();
  log('Projects after restart:', projects2.join(' | '));
  check(projects2.includes('Desktop Test Cell') && projects2.filter((t) => /example/i.test(t)).length === 1, 'projects kept after restart');
  check(fs.existsSync(path.join(PROFILE, 'window-state.json')), 'window size remembered');
  const kept = await win.evaluate(() => new Promise((resolve) => {
    const r = indexedDB.open('isa-auto-programmer');
    r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('plc-program-store'); g.onsuccess = () => resolve(JSON.parse(g.result ?? 'null')?.state?.ladder?.rungs?.length ?? 0); };
    r.onerror = () => resolve(-1);
  }));
  log('Big program after restart:', kept, 'rungs');
  check(kept === 400 * 50, 'the big program written just before closing is all there after the restart');
  await closeApp(app, win);

  // ── Printing: a 2-label PDF (38 x 12 mm) and a mixed-size PDF, laid out by the print window ──
  for (const [name, sizesMm, uniform] of [['labels', [[38, 12], [38, 12]], true], ['mixed', [[215.9, 279.4], [431.8, 279.4]], false]]) {
    const doc = await PDFDocument.create();
    for (const [w, h] of sizesMm) {
      const page = doc.addPage([w / 25.4 * 72, h / 25.4 * 72]);
      page.drawRectangle({ x: 2, y: 2, width: page.getWidth() - 4, height: page.getHeight() - 4, borderWidth: 1, borderColor: rgb(0, 0, 0) });
      page.drawText(name.toUpperCase(), { x: 6, y: page.getHeight() / 2 - 4, size: 8 });
    }
    const bytes = await doc.save();
    const outPdf = path.join(OUT, `print_${name}.pdf`);
    app = await launch({ ISA_PRINT_TO_PDF: outPdf });
    win = await app.firstWindow();
    await win.waitForSelector('text=Project navigation', { timeout: 30000 });
    const r = await win.evaluate(async ({ b, w, h, u }) => window.isaDesktop.print({ pdf: new Uint8Array(b), jobName: 'test', pageWidthMm: w, pageHeightMm: h, uniformPageSize: u, printerName: '', showDialog: true, scale: 'actual', copies: 1 }),
      { b: [...bytes], w: sizesMm[0][0], h: sizesMm[0][1], u: uniform });
    await closeApp(app, win);
    const printed = await PDFDocument.load(fs.readFileSync(outPdf));
    const mm = printed.getPages().map((p) => [p.getWidth() / 72 * 25.4, p.getHeight() / 72 * 25.4]);
    const got = mm.map(([w, h]) => `${w.toFixed(1)}x${h.toFixed(1)}`);
    log(`Print ${name}:`, JSON.stringify(r), '| printed pages', got.join(', '));
    check(r.ok, `print ${name} ok`);
    // Print-to-PDF rounds the page to whole points (≤ 0.2 mm); the printer gets the exact size in microns.
    check(mm.length === sizesMm.length && mm.every(([w, h], i) => Math.abs(w - sizesMm[i][0]) < 0.3 && Math.abs(h - sizesMm[i][1]) < 0.3), `print ${name} at actual page sizes`);
  }

  log('Page errors:', errors.length ? errors : 'none');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  if (errors.length) throw new Error(`${errors.length} page/console error(s)`);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
