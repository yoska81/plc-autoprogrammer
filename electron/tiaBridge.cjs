// "Send to TIA Portal": the app's side of the TIA bridge (the same client drives the CLICK bridge: clickBridge.cjs) (tools/tia-bridge, TiaBridge.exe, shipped in
// resources/tia-bridge). The bridge is one long-lived process spoken to over stdin / stdout, one JSON object per
// line (tools/tia-bridge/src/Protocol.cs): {id, cmd, args} → {id, progress}… then {id, ok, result | error}.
// It is started on the first request and stopped with the app. Contract: src/desktop/bridge.ts (TiaBridge).
// ISA_TIA_BRIDGE=<path> runs another bridge instead (a .cjs / .js file runs with the app's Node: the fake bridge
// of the tests). Main process only.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

/** Longest a request may take before the app gives up on it (opening TIA Portal or compiling a big project is slow). */
const TIMEOUT_MS = { detect: 60000, default: 30 * 60000 };

/**
 * A bridge client. `exe`: the bridge program; `logFile`: where the bridge logs every call; `onProgress(id, text)`.
 * call(cmd, args) resolves with the result or rejects with the bridge's plain-English error.
 */
function createTiaBridge({ exe, logFile, onProgress, timeouts = TIMEOUT_MS, label = 'TIA Portal bridge', what = 'TIA Portal' }) {
  let proc = null;
  let ready = null; // promise of the "ready" line
  let nextId = 1;
  const pending = new Map(); // id → { resolve, reject, timer, cmd }

  const failAll = (msg) => {
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error(msg)); }
    pending.clear();
  };

  function start() {
    if (proc) return ready;
    if (!exe || !fs.existsSync(exe)) return Promise.reject(new Error(`The ${label} is not in this installation (Windows desktop app only). Reinstall ISA Auto Programmer.`));
    const script = /\.c?js$/i.test(exe);
    const args = logFile ? ['--log', logFile] : [];
    proc = script
      ? spawn(process.execPath, [exe, ...args], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true })
      : spawn(exe, args, { windowsHide: true, cwd: path.dirname(exe) });
    const me = proc;
    ready = new Promise((resolve, reject) => {
      const lines = readline.createInterface({ input: me.stdout });
      let isReady = false;
      lines.on('line', (line) => {
        let m;
        try { m = JSON.parse(line); } catch { return; } // anything else on stdout is not ours
        if (!m || typeof m !== 'object') return;
        if (m.ready) { isReady = true; resolve(m); return; }
        const p = pending.get(m.id);
        if (!p) return;
        if (typeof m.progress === 'string') { try { onProgress?.(m.id, m.progress); } catch { /* ignore */ } return; }
        pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.ok) p.resolve(m.result ?? null);
        else p.reject(new Error(m.error || `The ${label} failed without saying why.`));
      });
      let stderr = '';
      me.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
      me.on('error', (err) => {
        const msg = `The ${label} could not start: ${err.message}`;
        if (!isReady) reject(new Error(msg));
        failAll(msg);
        if (proc === me) proc = null;
      });
      me.on('exit', (code) => {
        const why = stderr.trim().split(/\r?\n/).slice(-1)[0];
        const msg = `The ${label} stopped (exit code ${code})${why ? `: ${why}` : ''}. Try again; the log is at ${logFile || 'the app\'s logs folder'}.`;
        if (!isReady) reject(new Error(msg));
        failAll(msg);
        if (proc === me) proc = null;
      });
    });
    return ready;
  }

  async function call(cmd, args = {}) {
    await start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const ms = timeouts[cmd] ?? timeouts.default;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`${what} did not answer within ${Math.round(ms / 1000)} s (${cmd}). Check ${what} for an open dialog${what === 'TIA Portal' ? ' (e.g. the Openness access question)' : ''} and try again.`));
      }, ms);
      pending.set(id, { resolve, reject, timer, cmd });
      proc.stdin.write(`${JSON.stringify({ id, cmd, args })}\n`);
    });
  }

  function stop() {
    if (!proc) return;
    const p = proc;
    proc = null;
    failAll(`The ${label} was stopped.`);
    try { p.stdin.write(`${JSON.stringify({ id: 0, cmd: 'quit' })}\n`); p.stdin.end(); } catch { /* gone */ }
    setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 3000).unref?.();
  }

  return { call, stop, get running() { return proc !== null; } };
}

/** The 'isa:tia' IPC: (cmd, args) → { ok, value | error }; progress to the window as 'isa:tia-progress' {id, text}. */
function registerTiaBridgeIpc(ipcMain, app, resourcesDir) {
  const exe = process.env.ISA_TIA_BRIDGE || (process.platform === 'win32' ? path.join(resourcesDir, 'tia-bridge', 'TiaBridge.exe') : null);
  let sender = null;
  const bridge = createTiaBridge({
    exe,
    logFile: path.join(app.getPath('logs'), 'tia-bridge.log'),
    onProgress: (id, text) => { try { sender?.send('isa:tia-progress', { id, text }); } catch { /* window gone */ } },
  });
  ipcMain.handle('isa:tia', async (e, cmd, args) => {
    sender = e.sender;
    if (!exe) return { ok: false, error: 'Sending to TIA Portal needs the Windows desktop app (TIA Portal runs on Windows only).' };
    try { return { ok: true, value: await bridge.call(String(cmd), args ?? {}) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('isa:tia-log', () => path.join(app.getPath('logs'), 'tia-bridge.log'));
  app.on('will-quit', () => bridge.stop());
  return bridge;
}

module.exports = { createTiaBridge, createBridge: createTiaBridge, registerTiaBridgeIpc, TIMEOUT_MS };
