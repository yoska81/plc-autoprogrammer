// ISA Auto Programmer — Windows desktop shell (Electron main process).
// The Vite build (dist-desktop/) is served from the private scheme app://isa so the
// app has a fixed origin: projects saved in localStorage stay between runs and the
// AI APIs see an ordinary cross-origin request, as from the web version.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { registerModbusIpc } = require('./modbus.cjs');
const mic = require('./micPermission.cjs');

const SCHEME = 'app';
const ORIGIN = `${SCHEME}://isa`;
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-desktop');
const PRINT_DIR = path.join(__dirname, 'print');
const PDFJS_DIR = path.join(__dirname, 'vendor', 'pdfjs');
const APP_NAME = 'ISA Auto Programmer';

// Tests run the app with a throw-away profile.
if (process.env.ISA_USER_DATA) app.setPath('userData', process.env.ISA_USER_DATA);
app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.isa.autoprogrammer');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// ── Single instance: a second start focuses the open window ──
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
    const file = projectFileArg(argv);
    if (w && file) sendProjectFile(w, file);
  });
}

// ── Project files (.isap): double-clicked in Explorer, or passed on the command line ──
function projectFileArg(argv) {
  return argv.slice(1).find((a) => typeof a === 'string' && a.toLowerCase().endsWith('.isap') && fs.existsSync(a)) ?? null;
}
function sendProjectFile(win, file) {
  fs.promises.readFile(file)
    .then((buf) => { writablePaths.add(file); win.webContents.send('isa:open-file', path.basename(file), new Uint8Array(buf), file); })
    .catch(() => { /* unreadable file: nothing to open */ });
}

// ── Static files: app://isa/<path> → dist-desktop, with SPA fallback to index.html ──
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const pick = (base, rel) => {
    const full = path.normalize(path.join(base, rel));
    return full.startsWith(base) && fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
  };
  if (clean.startsWith('__print/')) return pick(PRINT_DIR, clean.slice(8));
  if (clean.startsWith('__pdfjs/')) return pick(PDFJS_DIR, clean.slice(8));
  return pick(DIST, clean || 'index.html') ?? (path.extname(clean) ? null : path.join(DIST, 'index.html'));
}

function serveApp() {
  protocol.handle(SCHEME, (req) => {
    const file = resolveFile(new URL(req.url).pathname);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ── Window size and position remembered between runs ──
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadBounds() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; }
}
function saveBounds(win) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch { /* not critical */ }
}

function isAppUrl(u) { return u.startsWith(`${ORIGIN}/`) || u === ORIGIN; }

function createWindow() {
  const b = loadBounds();
  const win = new BrowserWindow({
    width: b?.width ?? 1440, height: b?.height ?? 900, x: b?.x, y: b?.y,
    minWidth: 1024, minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#f0f2f3',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (b?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));

  // Links: pages of the app (print views) open in a new app window, everything else in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true } } };
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) { e.preventDefault(); if (/^https?:/.test(url)) void shell.openExternal(url); }
  });
  // Unsaved changes: the page blocks unload (beforeunload); ask like any Windows program.
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning', buttons: ['Close without saving', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
      title: 'ISA Auto Programmer', message: 'The project has unsaved changes.',
      detail: 'Cancel, then press Save (Ctrl+S) to keep them in the project file.',
    });
    if (choice === 0) e.preventDefault();
  });
  const startFile = projectFileArg(process.argv);
  if (startFile) win.webContents.once('did-finish-load', () => setTimeout(() => sendProjectFile(win, startFile), 1500));
  void win.loadURL(`${ORIGIN}/`);
  return win;
}

function buildMenu() {
  const template = [
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools', label: 'Developer tools' }] },
    { label: 'Help', submenu: [{ label: `About ${APP_NAME}`, click: () => dialog.showMessageBox({ type: 'info', title: APP_NAME, message: `${APP_NAME} ${app.getVersion()}`, detail: 'Projects are saved on this PC in your user profile.' }) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Save dialog ──
const FILTERS = {
  pdf: 'PDF document', xlsx: 'Excel workbook', csv: 'CSV (Excel)', zip: 'ZIP archive', dxf: 'DXF drawing (CAD/CAM)', dwg: 'AutoCAD drawing',
  step: 'STEP 3D model', png: 'PNG image', txt: 'Text file', json: 'JSON file', md: 'Text (Markdown)',
  isap: 'ISA Auto Programmer project',
};
// Paths the user picked in a Save dialog or opened from Explorer: the page may write back to these only.
const writablePaths = new Set();
ipcMain.handle('isa:save-file', async (e, name, bytes) => {
  try {
    const ext = path.extname(String(name)).slice(1).toLowerCase();
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showSaveDialog(win, {
      title: 'Save file',
      defaultPath: path.join(app.getPath('documents'), path.basename(String(name))),
      filters: [...(ext ? [{ name: FILTERS[ext] ?? `${ext.toUpperCase()} file`, extensions: [ext] }] : []), { name: 'All files', extensions: ['*'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, cancelled: true };
    await fs.promises.writeFile(r.filePath, Buffer.from(bytes));
    writablePaths.add(r.filePath);
    return { ok: true, path: r.filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// Save again to a file the user already chose (project Save without a dialog).
ipcMain.handle('isa:write-file', async (_e, filePath, bytes) => {
  try {
    if (!writablePaths.has(filePath)) return { ok: false, error: 'not a file chosen in this session' };
    await fs.promises.writeFile(filePath, Buffer.from(bytes));
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// ── Printing ──
// Electron's built-in PDF viewer prints blank pages from a hidden window, so the PDF is
// drawn with pdf.js into page-sized images (electron/print/print.html) and that page is
// printed at 100 % with the PDF's paper size.
ipcMain.handle('isa:list-printers', async (e) => {
  try {
    const list = await e.sender.getPrintersAsync();
    return list.map((p) => ({ name: p.name, isDefault: Boolean(p.isDefault) }));
  } catch {
    return [];
  }
});

ipcMain.handle('isa:print', async (e, job) => {
  const win = new BrowserWindow({
    show: false, width: 900, height: 1200,
    webPreferences: { preload: path.join(PRINT_DIR, 'print-preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  try {
    await win.loadURL(`${ORIGIN}/__print/print.html`);
    // The print page draws every PDF page as an image at its real size, then answers.
    const rendered = await new Promise((resolve) => {
      const id = win.webContents.id;
      const onDone = (ev, r) => { if (ev.sender.id === id) { ipcMain.removeListener('isa:print-rendered', onDone); resolve(r); } };
      ipcMain.on('isa:print-rendered', onDone);
      win.webContents.send('isa:print-pdf', { bytes: Buffer.from(job.pdf), uniform: Boolean(job.uniformPageSize), widthMm: Number(job.pageWidthMm), heightMm: Number(job.pageHeightMm) });
    });
    if (!rendered.ok) throw new Error(rendered.error || 'The PDF could not be prepared for printing.');
    const opts = {
      silent: !job.showDialog,
      printBackground: true,
      deviceName: job.printerName || undefined,
      copies: Math.max(1, Number(job.copies) || 1),
      margins: { marginType: 'none' },
      scaleFactor: 100,
      ...(job.uniformPageSize ? { pageSize: { width: Math.round(job.pageWidthMm * 1000), height: Math.round(job.pageHeightMm * 1000) } } : {}),
    };
    // Test hook: write what would be printed to a PDF instead of printing.
    if (process.env.ISA_PRINT_TO_PDF) {
      const pdf = await win.webContents.printToPDF({ printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
      fs.writeFileSync(process.env.ISA_PRINT_TO_PDF, pdf);
      return { ok: true };
    }
    return await new Promise((resolve) => {
      win.webContents.print(opts, (ok, reason) => {
        if (ok) resolve({ ok: true });
        else if (/cancel/i.test(reason || '')) resolve({ ok: false, cancelled: true });
        else resolve({ ok: false, error: reason || 'Printing failed.' });
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
});

ipcMain.on('isa:version', (e) => { e.returnValue = app.getVersion(); });

// ── Connect to PLC: Modbus TCP (electron/modbus.cjs) ──
registerModbusIpc(ipcMain);

// ── Microphone for voice input: a native question the first time (electron/micPermission.cjs) ──
let micState = { always: false, session: false };
let micAsking = null; // one dialog at a time; requests while it is open share the answer
async function askMic(wc) {
  if (!micAsking) {
    micAsking = (async () => {
      const r = await dialog.showMessageBox(BrowserWindow.fromWebContents(wc) ?? undefined, {
        type: 'question', buttons: mic.BUTTONS, defaultId: 0, cancelId: 2, noLink: true,
        title: APP_NAME, message: `${APP_NAME} wants to use the microphone for voice input`,
        detail: 'What you say is written into the text box. "Always allow" can be changed later in Settings → Voice.',
      });
      const { grant, state } = mic.applyChoice(micState, r.response);
      micState = state;
      if (r.response === 1) mic.save(app.getPath('userData'), micState);
      return grant;
    })().finally(() => { micAsking = null; });
  }
  return micAsking;
}
function installMicPermission() {
  micState = mic.load(app.getPath('userData'));
  // Other permissions keep Electron's default (granted); camera / video capture is not used by the app.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (permission !== 'media') return callback(true);
    if (!mic.isMicRequest(permission, details)) return callback(false);
    if (mic.decide(micState) === 'allow') return callback(true);
    askMic(wc).then(callback, () => callback(false));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) => {
    if (permission !== 'media') return true;
    return details?.mediaType !== 'video' && mic.decide(micState) === 'allow';
  });
}
ipcMain.handle('isa:mic-permission', () => mic.status(micState));
ipcMain.handle('isa:mic-permission-reset', () => {
  micState = { always: false, session: false };
  mic.save(app.getPath('userData'), micState);
  return mic.status(micState);
});

app.whenReady().then(() => {
  serveApp();
  installMicPermission();
  // The AI services accept browser calls with CORS; make sure the app origin is allowed.
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['https://api.anthropic.com/*', 'https://api.openai.com/*'] }, (d, cb) => {
    const h = { ...d.responseHeaders };
    const has = Object.keys(h).some((k) => k.toLowerCase() === 'access-control-allow-origin');
    if (!has) h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
