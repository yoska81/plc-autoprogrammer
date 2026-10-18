// DWG reading for the drawing import. By default GNU LibreDWG's dwg2dxf.exe, shipped with the installer as a
// separate program (resources/libredwg: GPL v3, run with execFile, never linked; COPYING and SOURCE.txt
// next to it). DWG → DXF in a temp folder → the app's DXF reader. LibreDWG reads R13–R2018 (AC1012–AC1032);
// what it skips is reported as warnings. Advanced (Settings): another reader instead, kept in
// <userData>/dwg-reader.json: a program run as "reader input.dwg output.dxf", a script (.js / .cjs) run the
// same way with the app's Node, or a Node-API module (.node) exporting dwgToDxf(inputPath, outputPath).
// Contract: src/desktop/bridge.ts (DwgReaderBridge). Main process only.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let configFile = null;
let bundledDir = null;
const config = () => {
  try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { return {}; }
};
const bundled = () => (bundledDir && process.platform === 'win32' ? path.join(bundledDir, 'dwg2dxf.exe') : null);

/** The reader in use: the user's own (Advanced), else the bundled dwg2dxf. */
function status() {
  const own = config().path;
  if (own) {
    if (!fs.existsSync(own)) return { configured: true, ok: false, builtIn: false, path: own, error: 'The DWG reader file is no longer there.' };
    if (/\.node$/i.test(own)) {
      try {
        if (typeof require(own).dwgToDxf !== 'function') return { configured: true, ok: false, builtIn: false, path: own, error: 'This module has no dwgToDxf(input, output) function.' };
      } catch (err) {
        return { configured: true, ok: false, builtIn: false, path: own, error: `The module could not be loaded: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    return { configured: true, ok: true, builtIn: false, path: own };
  }
  const b = bundled();
  if (b && fs.existsSync(b)) return { configured: false, ok: true, builtIn: true, path: b };
  return { configured: false, ok: false, builtIn: false, error: 'The DWG converter is not in this installation.' };
}

// DWG versions by the file's first bytes; LibreDWG reads R13 to R2018 completely
const VERSIONS = { AC1012: 'R13', AC1014: 'R14', AC1015: 'R2000', AC1018: 'R2004', AC1021: 'R2007', AC1024: 'R2010', AC1027: 'R2013', AC1032: 'R2018' };
function versionNote(bytes) {
  const v = Buffer.from(bytes.slice(0, 6)).toString('latin1');
  if (VERSIONS[v]) return { version: `${VERSIONS[v]} (${v})` };
  if (/^AC10(0\d|1[01])$/.test(v) || /^AC[12]\./.test(v) || /^MC0\.0/.test(v)) return { version: v, warning: `Saved in an AutoCAD version older than R13 (${v}): the reading may be incomplete. Check it against the drawing, or save it again as a newer DWG or as DXF.` };
  if (/^AC\d{4}$/.test(v)) return { version: v, warning: `Saved in an AutoCAD version newer than R2018 (${v}): the reading may be incomplete. Save it as DXF in AutoCAD if anything is missing.` };
  return { version: null, warning: null, notDwg: true };
}

/** What dwg2dxf says it could not read (it prints these on stderr), in plain words and once each. */
function skipped(stderr) {
  const out = new Set();
  for (const line of String(stderr).split(/\r?\n/)) {
    const l = line.trim();
    if (!l || /stale .* subentity/i.test(l)) continue;
    // e.g. "Warning: Unhandled Class object 500 ACDBPLACEHOLDER (0x401) 12/2A", "ERROR: Unsupported MESH"
    const m = l.match(/\b(?:unhandled|unsupported|skip(?:ping|ped)?|ignor(?:ed|ing)|not yet implemented)\s+(?:class\s+)?(?:object\s+|entity\s+)?(?:\d+\s+)?([A-Za-z][A-Za-z0-9_]{2,})/i);
    if (m && m[1] === m[1].toUpperCase()) out.add(m[1]);
  }
  return [...out];
}

/** Converts one DWG file to DXF with the reader in use; returns the converter's own messages. */
async function convertOne(st, input, output) {
  if (!st.builtIn && /\.node$/i.test(st.path)) {
    await require(st.path).dwgToDxf(input, output);
    return '';
  }
  // a script (.js / .cjs) runs with the app's own Node; a program runs as it is
  const script = !st.builtIn && /\.c?js$/i.test(st.path);
  const [exe, args] = st.builtIn ? [st.path, ['-y', '-o', output, input]] : script ? [process.execPath, [st.path, input, output]] : [st.path, [input, output]];
  const env = script ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env;
  return new Promise((resolve, reject) => {
    execFile(exe, args, { timeout: 180000, windowsHide: true, maxBuffer: 16 * 1024 * 1024, cwd: path.dirname(st.path), env }, (err, _stdout, stderr) => {
      // dwg2dxf can exit non-zero on recoverable errors and still write the DXF: the output decides
      if (err && !fs.existsSync(output)) reject(new Error(String(stderr).split(/\r?\n/).filter(Boolean).slice(-2).join(' ') || err.message));
      else resolve(String(stderr));
    });
  });
}

/** DWG files ({name, bytes}) in, DXF text out (same order), with warnings about what was not read. */
async function read(files) {
  const st = status();
  if (!st.ok) return { ok: false, notConfigured: !st.configured, error: st.error ?? 'The DWG converter is not available.' };
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isa-dwg-'));
  try {
    const out = [];
    for (const [i, f] of files.entries()) {
      const name = path.basename(String(f.name));
      const bytes = Buffer.from(f.bytes);
      const v = versionNote(bytes);
      if (v.notDwg) return { ok: false, error: `${name} is not a DWG file.` };
      const base = `${String(i).padStart(3, '0')}_${name.replace(/[^\w.-]+/g, '_')}`;
      const input = path.join(root, base);
      const output = path.join(root, base.replace(/\.dwg$/i, '') + '.dxf');
      await fs.promises.writeFile(input, bytes);
      const log = await convertOne(st, input, output);
      if (!fs.existsSync(output)) return { ok: false, error: `The DWG converter could not read ${name}.` };
      const skip = skipped(log);
      const warnings = [
        ...(v.warning ? [v.warning] : []),
        ...(skip.length ? [`Not read from ${name} (shown as missing; check them on the drawing): ${skip.slice(0, 12).join(', ')}${skip.length > 12 ? ` and ${skip.length - 12} more` : ''}.`] : []),
      ];
      out.push({ name: String(f.name).replace(/\.dwg$/i, '.dxf'), text: await fs.promises.readFile(output, 'utf8'), version: v.version, warnings });
    }
    return { ok: true, files: out };
  } catch (err) {
    return { ok: false, error: `The DWG converter failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    fs.promises.rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

/** resourcesDir: where the installer put libredwg/ (process.resourcesPath), or resources/ in a dev run. */
function registerDwgReaderIpc(ipcMain, app, dialog, resourcesDir) {
  configFile = path.join(app.getPath('userData'), 'dwg-reader.json');
  bundledDir = path.join(resourcesDir, 'libredwg');
  ipcMain.handle('isa:dwg-status', () => status());
  ipcMain.handle('isa:dwg-read', async (_e, files) => read(Array.isArray(files) ? files : []));
  // Advanced: another reader instead of the bundled one, chosen in a native dialog and kept for next time
  ipcMain.handle('isa:dwg-configure', async (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose another DWG reader',
      properties: ['openFile'],
      filters: [{ name: 'DWG reader', extensions: ['exe', 'cjs', 'js', 'node'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (r.canceled || !r.filePaths[0]) return status();
    fs.writeFileSync(configFile, JSON.stringify({ path: r.filePaths[0] }, null, 2));
    return status();
  });
  ipcMain.handle('isa:dwg-clear', () => { try { fs.rmSync(configFile, { force: true }); } catch { /* none */ } return status(); });
}

module.exports = { registerDwgReaderIpc, status, read, skipped, versionNote };
