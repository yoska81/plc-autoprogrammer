// DWG reading for the drawing import, through the ODA Drawings SDK (a paid licence the user buys). Nothing
// of the SDK is in this repository: the user points the app at their reader in Settings, and it is kept in
// <userData>/dwg-reader.json. The reader is either
//   - a Node-API module (.node) built against the ODA Drawings SDK for this Electron version, exporting
//     dwgToDxf(inputPath, outputPath) (sync or returning a Promise), or
//   - a command-line program built with the SDK: <reader> <input.dwg> <output.dxf> (exit code 0 on success).
// Its ODA activation (licence) is built into it. The DXF it writes goes through the app's DXF reader.
// Contract: src/desktop/bridge.ts (DwgReaderBridge). Main process only.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let configFile = null;
const config = () => {
  try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { return {}; }
};

/** Whether a reader is set up, and whether it can be used. */
function status() {
  const p = config().path;
  if (!p) return { configured: false, ok: false };
  if (!fs.existsSync(p)) return { configured: true, ok: false, path: p, error: 'The DWG reader file is no longer there.' };
  if (/\.node$/i.test(p)) {
    try {
      const mod = require(p);
      if (typeof mod.dwgToDxf !== 'function') return { configured: true, ok: false, path: p, error: 'This module has no dwgToDxf(input, output) function.' };
    } catch (err) {
      return { configured: true, ok: false, path: p, error: `The module could not be loaded: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  return { configured: true, ok: true, path: p };
}

/** Converts one DWG file to DXF with the configured reader. */
async function convertOne(reader, input, output) {
  if (/\.node$/i.test(reader)) {
    await require(reader).dwgToDxf(input, output);
    return;
  }
  await new Promise((resolve, reject) => {
    execFile(reader, [input, output], { timeout: 120000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/** DWG files ({name, bytes}) in, DXF text out (same order). */
async function read(files) {
  const s = status();
  if (!s.ok) return { ok: false, notConfigured: !s.configured, error: s.error ?? 'The DWG reader is not set up yet.' };
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isa-dwg-'));
  try {
    const out = [];
    for (const [i, f] of files.entries()) {
      const base = `${String(i).padStart(3, '0')}_${path.basename(String(f.name)).replace(/[^\w.-]+/g, '_')}`;
      const input = path.join(root, base);
      const output = path.join(root, base.replace(/\.dwg$/i, '') + '.dxf');
      await fs.promises.writeFile(input, Buffer.from(f.bytes));
      await convertOne(s.path, input, output);
      if (!fs.existsSync(output)) return { ok: false, error: `The DWG reader could not read ${path.basename(String(f.name))}.` };
      out.push({ name: String(f.name).replace(/\.dwg$/i, '.dxf'), text: await fs.promises.readFile(output, 'utf8') });
    }
    return { ok: true, files: out };
  } catch (err) {
    return { ok: false, error: `The DWG reader failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    fs.promises.rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

function registerDwgReaderIpc(ipcMain, app, dialog) {
  configFile = path.join(app.getPath('userData'), 'dwg-reader.json');
  ipcMain.handle('isa:dwg-status', () => status());
  ipcMain.handle('isa:dwg-read', async (_e, files) => read(Array.isArray(files) ? files : []));
  // Choose the reader (a .node module or a program) in a native dialog; the choice is kept for next time.
  ipcMain.handle('isa:dwg-configure', async (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose the DWG reader (ODA Drawings SDK)',
      properties: ['openFile'],
      filters: [{ name: 'DWG reader', extensions: ['node', 'exe'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (r.canceled || !r.filePaths[0]) return status();
    fs.writeFileSync(configFile, JSON.stringify({ path: r.filePaths[0] }, null, 2));
    return status();
  });
  ipcMain.handle('isa:dwg-clear', () => { try { fs.rmSync(configFile, { force: true }); } catch { /* none */ } return status(); });
}

module.exports = { registerDwgReaderIpc, status, read };
