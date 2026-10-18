// DWG export for the desktop app's "Save as AutoCAD": the app writes DXF; the free ODA File
// Converter (Open Design Alliance, installed separately by the user) turns it into DWG.
// And the other way for the drawing import (toDxf): a user's DWG is read as DXF.
// Contract: src/desktop/bridge.ts (OdaBridge). Main process only.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EXE = process.platform === 'win32' ? 'ODAFileConverter.exe' : 'ODAFileConverter';

/** Folders the converter installs into, newest version first. */
function candidates() {
  const out = [];
  if (process.env.ODA_FILE_CONVERTER) out.push(process.env.ODA_FILE_CONVERTER);
  const scan = (dir, prefix, rel) => {
    try {
      for (const d of fs.readdirSync(dir).filter((n) => n.startsWith(prefix)).sort().reverse()) out.push(path.join(dir, d, ...rel));
    } catch { /* not there */ }
  };
  if (process.platform === 'win32') {
    for (const pf of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) if (pf) scan(path.join(pf, 'ODA'), 'ODAFileConverter', [EXE]);
  } else if (process.platform === 'darwin') {
    out.push('/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter');
  } else {
    out.push('/usr/bin/ODAFileConverter', '/usr/local/bin/ODAFileConverter');
    scan('/opt', 'ODAFileConverter', [EXE]);
  }
  return out;
}

/** Path of the installed converter, or null. */
function findConverter() {
  for (const p of candidates()) {
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

/** Converts DXF files ({name, text}) to AutoCAD 2018 DWG; returns [{name, bytes}] in the same order. */
async function convert(files) {
  const exe = findConverter();
  if (!exe) return { ok: false, error: 'The ODA File Converter is not installed.' };
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isa-dwg-'));
  const inDir = path.join(root, 'in'), outDir = path.join(root, 'out');
  try {
    await fs.promises.mkdir(inDir); await fs.promises.mkdir(outDir);
    const names = files.map((f, i) => `${String(i).padStart(3, '0')}_${path.basename(String(f.name)).replace(/[^\w.-]+/g, '_')}`);
    await Promise.all(files.map((f, i) => fs.promises.writeFile(path.join(inDir, names[i]), String(f.text))));
    // ODAFileConverter <in> <out> <version> <type> <recurse> <audit> [filter]
    await new Promise((resolve, reject) => {
      execFile(exe, [inDir, outDir, 'ACAD2018', 'DWG', '0', '1', '*.DXF'], { timeout: 120000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
    });
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const dwg = path.join(outDir, names[i].replace(/\.dxf$/i, '.dwg'));
      if (!fs.existsSync(dwg)) return { ok: false, error: `The converter did not write ${path.basename(String(files[i].name))} (see the .err file in ${outDir}).` };
      out.push({ name: String(files[i].name).replace(/\.dxf$/i, '.dwg'), bytes: new Uint8Array(await fs.promises.readFile(dwg)) });
    }
    return { ok: true, files: out };
  } catch (err) {
    return { ok: false, error: `ODA File Converter failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    fs.promises.rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

/** Reads DWG files ({name, bytes}) as DXF text (ODA File Converter, ACAD2018 DXF), for the drawing import. */
async function toDxf(files) {
  const exe = findConverter();
  if (!exe) return { ok: false, notInstalled: true, error: 'The ODA File Converter is not installed.' };
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isa-dxf-'));
  const inDir = path.join(root, 'in'), outDir = path.join(root, 'out');
  try {
    await fs.promises.mkdir(inDir); await fs.promises.mkdir(outDir);
    const names = files.map((f, i) => `${String(i).padStart(3, '0')}_${path.basename(String(f.name)).replace(/[^\w.-]+/g, '_')}`);
    await Promise.all(files.map((f, i) => fs.promises.writeFile(path.join(inDir, names[i]), Buffer.from(f.bytes))));
    await new Promise((resolve, reject) => {
      execFile(exe, [inDir, outDir, 'ACAD2018', 'DXF', '0', '1', '*.DWG'], { timeout: 120000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
    });
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const dxf = path.join(outDir, names[i].replace(/\.dwg$/i, '.dxf'));
      if (!fs.existsSync(dxf)) return { ok: false, error: `The converter could not read ${path.basename(String(files[i].name))}.` };
      out.push({ name: String(files[i].name).replace(/\.dwg$/i, '.dxf'), text: await fs.promises.readFile(dxf, 'utf8') });
    }
    return { ok: true, files: out };
  } catch (err) {
    return { ok: false, error: `ODA File Converter failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    fs.promises.rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

function registerOdaIpc(ipcMain) {
  ipcMain.handle('isa:oda-detect', async () => { const p = findConverter(); return p ? { found: true, path: p } : { found: false }; });
  ipcMain.handle('isa:oda-convert', async (_e, files) => convert(Array.isArray(files) ? files : []));
  ipcMain.handle('isa:oda-to-dxf', async (_e, files) => toDxf(Array.isArray(files) ? files : []));
}

module.exports = { registerOdaIpc, findConverter, toDxf };
