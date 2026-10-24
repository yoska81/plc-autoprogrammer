// "Send to CLICK": the app's side of the CLICK bridge (tools/click-bridge, ClickBridge.exe, shipped in
// resources/click-bridge), which drives CLICK Programming Software's windows while the user watches.
// Same protocol and client as the TIA bridge (electron/tiaBridge.cjs). Contract: src/desktop/bridge.ts
// (ClickBridge). ISA_CLICK_BRIDGE=<path> runs another bridge instead (a .cjs file: the tests' fake). Main process only.
const fs = require('node:fs');
const path = require('node:path');
const { createBridge, showLogFile } = require('./tiaBridge.cjs');

/** Where Write to the machine keeps each machine's CLICK project: Documents\ISA Auto Programmer\machines. */
const machinesDir = (app) => path.join(app.getPath('documents'), 'ISA Auto Programmer', 'machines');

/** A run of steps can take long (the user may pause it); detect and start are quick. */
const TIMEOUT_MS = { detect: 60000, start: 120000, default: 2 * 60 * 60000 };

/** The 'isa:click' IPC: (cmd, args) → { ok, value | error }; progress to the window as 'isa:click-progress' {id, text}. */
function registerClickBridgeIpc(ipcMain, app, resourcesDir) {
  const exe = process.env.ISA_CLICK_BRIDGE || (process.platform === 'win32' ? path.join(resourcesDir, 'click-bridge', 'ClickBridge.exe') : null);
  let sender = null;
  const bridge = createBridge({
    exe,
    label: 'CLICK bridge',
    what: 'CLICK Programming Software',
    timeouts: TIMEOUT_MS,
    logFile: path.join(app.getPath('logs'), 'click-bridge.log'),
    onProgress: (id, text) => { try { sender?.send('isa:click-progress', { id, text }); } catch { /* window gone */ } },
  });
  ipcMain.handle('isa:click', async (e, cmd, args) => {
    sender = e.sender;
    if (!exe) return { ok: false, error: 'Sending to CLICK needs the Windows desktop app (CLICK Programming Software runs on Windows only).' };
    // a run may save only as Write to the machine (the user confirmed it in the app), and only in the app's own
    // machines folder: the folder is set here, never taken from the page
    const a = { ...(args ?? {}) };
    delete a.saveIn;
    if (String(cmd) === 'run' && a.write === true) a.saveIn = machinesDir(app);
    delete a.write;
    try { return { ok: true, value: await bridge.call(String(cmd), a) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('isa:click-log', () => path.join(app.getPath('logs'), 'click-bridge.log'));
  // the app's machines folder (each machine's CLICK project as last written into it), made if missing
  ipcMain.handle('isa:click-machines', () => { const d = machinesDir(app); fs.mkdirSync(d, { recursive: true }); return d; });
  // "Open folder" for support: the log selected in Explorer (only this file: the path is the app's own)
  ipcMain.handle('isa:click-show-log', () => showLogFile(path.join(app.getPath('logs'), 'click-bridge.log')));
  app.on('will-quit', () => bridge.stop());
  return bridge;
}

module.exports = { registerClickBridgeIpc, machinesDir, TIMEOUT_MS };
