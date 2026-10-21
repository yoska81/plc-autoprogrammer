// "Send to CLICK": the app's side of the CLICK bridge (tools/click-bridge, ClickBridge.exe, shipped in
// resources/click-bridge), which drives CLICK Programming Software's windows while the user watches.
// Same protocol and client as the TIA bridge (electron/tiaBridge.cjs). Contract: src/desktop/bridge.ts
// (ClickBridge). ISA_CLICK_BRIDGE=<path> runs another bridge instead (a .cjs file: the tests' fake). Main process only.
const path = require('node:path');
const { createBridge } = require('./tiaBridge.cjs');

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
    try { return { ok: true, value: await bridge.call(String(cmd), args ?? {}) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('isa:click-log', () => path.join(app.getPath('logs'), 'click-bridge.log'));
  app.on('will-quit', () => bridge.stop());
  return bridge;
}

module.exports = { registerClickBridgeIpc, TIMEOUT_MS };
