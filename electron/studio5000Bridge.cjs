// "Send to Studio 5000": the app's side of the Studio 5000 bridge (tools/studio5000-bridge, Studio5000Bridge.exe,
// shipped in resources/studio5000-bridge), which runs Rockwell's Logix Designer SDK (the user's licence) to put the
// program into a copy of the user's project and, from the confirm screen, download it. Same protocol and client as
// the TIA bridge (electron/tiaBridge.cjs). Contract: src/desktop/bridge.ts (Studio5000Bridge).
// ISA_STUDIO5000_BRIDGE=<path> runs another bridge instead (a .cjs file: the tests' fake). Main process only.
const path = require('node:path');
const { createBridge, showLogFile } = require('./tiaBridge.cjs');

/** Detect runs Python a few times; an SDK job opens a project (minutes for a big one). */
const TIMEOUT_MS = { detect: 120000, writeL5x: 30000, open: 60000, default: 40 * 60000 };

/** The 'isa:studio5000' IPC: (cmd, args) → { ok, value | error }; progress to the window as 'isa:studio5000-progress' {id, text}. */
function registerStudio5000BridgeIpc(ipcMain, app, resourcesDir, dialog) {
  const exe = process.env.ISA_STUDIO5000_BRIDGE || (process.platform === 'win32' ? path.join(resourcesDir, 'studio5000-bridge', 'Studio5000Bridge.exe') : null);
  const logFile = path.join(app.getPath('logs'), 'studio5000-bridge.log');
  let sender = null;
  const bridge = createBridge({
    exe,
    label: 'Studio 5000 bridge',
    what: 'the Logix Designer SDK',
    timeouts: TIMEOUT_MS,
    logFile,
    onProgress: (id, text) => { try { sender?.send('isa:studio5000-progress', { id, text }); } catch { /* window gone */ } },
  });
  ipcMain.handle('isa:studio5000', async (e, cmd, args) => {
    sender = e.sender;
    if (!exe) return { ok: false, error: 'Sending to Studio 5000 needs the Windows desktop app (Studio 5000 runs on Windows only).' };
    try { return { ok: true, value: await bridge.call(String(cmd), args ?? {}) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('isa:studio5000-log', () => logFile);
  ipcMain.handle('isa:studio5000-show-log', () => showLogFile(logFile));
  // the user's Studio 5000 project, chosen in Windows' Open dialog (its path only: the bridge copies it)
  ipcMain.handle('isa:studio5000-pick', async () => {
    const d = dialog ?? require('electron').dialog;
    const r = await d.showOpenDialog({ title: 'Your Studio 5000 project', filters: [{ name: 'Studio 5000 project', extensions: ['ACD', 'acd'] }], properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0] ?? null;
  });
  app.on('will-quit', () => bridge.stop());
  return bridge;
}

module.exports = { registerStudio5000BridgeIpc, TIMEOUT_MS };
