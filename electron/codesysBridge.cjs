// "Send to CODESYS": the app's side of the CODESYS bridge (tools/codesys-bridge, CodesysBridge.exe, shipped in
// resources/codesys-bridge), which runs the user's CODESYS headless with a job script to put the program into a
// project and build it. Same protocol and client as the TIA bridge (electron/tiaBridge.cjs). Contract:
// src/desktop/bridge.ts (CodesysBridge). ISA_CODESYS_BRIDGE=<path> runs another bridge instead (a .cjs file: the
// tests' fake). Main process only.
const path = require('node:path');
const { createBridge } = require('./tiaBridge.cjs');

/** CODESYS starts slowly and a build can take minutes; detect is quick. */
const TIMEOUT_MS = { detect: 60000, open: 60000, default: 40 * 60000 };

/** The 'isa:codesys' IPC: (cmd, args) → { ok, value | error }; progress to the window as 'isa:codesys-progress' {id, text}. */
function registerCodesysBridgeIpc(ipcMain, app, resourcesDir, dialog) {
  const exe = process.env.ISA_CODESYS_BRIDGE || (process.platform === 'win32' ? path.join(resourcesDir, 'codesys-bridge', 'CodesysBridge.exe') : null);
  const logFile = path.join(app.getPath('logs'), 'codesys-bridge.log');
  let sender = null;
  const bridge = createBridge({
    exe,
    label: 'CODESYS bridge',
    what: 'CODESYS',
    timeouts: TIMEOUT_MS,
    logFile,
    onProgress: (id, text) => { try { sender?.send('isa:codesys-progress', { id, text }); } catch { /* window gone */ } },
  });
  ipcMain.handle('isa:codesys', async (e, cmd, args) => {
    sender = e.sender;
    if (!exe) return { ok: false, error: 'Sending to CODESYS needs the Windows desktop app (CODESYS runs on Windows only).' };
    try { return { ok: true, value: await bridge.call(String(cmd), args ?? {}) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('isa:codesys-log', () => logFile);
  ipcMain.handle('isa:codesys-show-log', () => { require('electron').shell.showItemInFolder(logFile); return true; });
  // the user's CODESYS project, chosen in Windows' Open dialog (its path only: the bridge opens it)
  ipcMain.handle('isa:codesys-pick', async (e) => {
    const d = dialog ?? require('electron').dialog;
    const r = await d.showOpenDialog({ title: 'Your CODESYS project', filters: [{ name: 'CODESYS project', extensions: ['project'] }], properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0] ?? null;
  });
  app.on('will-quit', () => bridge.stop());
  return bridge;
}

module.exports = { registerCodesysBridgeIpc, TIMEOUT_MS };
