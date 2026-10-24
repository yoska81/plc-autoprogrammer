// npx tsx src/convert/dwgReader.test.ts — the Windows app's DWG reader (electron/dwgReader.cjs): GNU LibreDWG's
// dwg2dxf shipped with the installer (resources/libredwg, fetched by scripts/fetch-libredwg.cjs). With the real
// dwg2dxf.exe there (Windows, or wine elsewhere) it converts e2e/fixtures/convert/dwg-sample.dwg for real;
// without it a stand-in program plays its part. Also: another reader chosen in Settings (Advanced).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dxfToText } from './dxf';

const require = createRequire(import.meta.url);
const file = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const SAMPLE_DWG = file('e2e/fixtures/convert/dwg-sample.dwg');
const SAMPLE_DXF = readFileSync(file('e2e/fixtures/convert/dwg-sample.libredwg.dxf'), 'utf8');
const REAL = file('resources/libredwg/dwg2dxf.exe');
const hasWine = (() => { try { execFileSync('wine', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const real = existsSync(REAL) && (process.platform === 'win32' || hasWine);

const dir = mkdtempSync(join(tmpdir(), 'isa-dwg-test-'));
const res = join(dir, 'resources');
mkdirSync(join(res, 'libredwg'), { recursive: true });
// the bundled converter is a Windows program: elsewhere the tests act as Windows (with wine or a stand-in)
if (process.platform !== 'win32') Object.defineProperty(process, 'platform', { value: 'win32' });
const bundled = join(res, 'libredwg', 'dwg2dxf.exe');
const installBundled = () => {
  if (real && process.env.OS === 'Windows_NT') { writeFileSync(bundled, readFileSync(REAL)); for (const d of ['libredwg-0.dll', 'libiconv-2.dll']) writeFileSync(join(res, 'libredwg', d), readFileSync(file(`resources/libredwg/${d}`))); return 'real'; }
  if (real) { writeFileSync(bundled, `#!/bin/sh\nWINEDEBUG=-all exec wine "${REAL}" "$@"\n`); chmodSync(bundled, 0o755); return 'real (wine)'; }
  // stand-in: dwg2dxf's arguments are -y -o <output> <input>; it writes what LibreDWG wrote for the sample
  writeFileSync(bundled, `#!/bin/sh\n[ "$1" = "-y" ] && [ "$2" = "-o" ] && test -f "$4" || exit 2\ncp "${file('e2e/fixtures/convert/dwg-sample.libredwg.dxf')}" "$3"\necho "Warning: stale ATTRIB subentity" >&2\necho "Warning: Unhandled Class object 500 ACDBPLACEHOLDER (0x401) 12/2A" >&2\n`);
  chmodSync(bundled, 0o755);
  return 'stand-in';
};

const handlers = new Map<string, (...a: unknown[]) => unknown>();
let pick: string | null = null;
const Module = require('node:module') as { _load: (r: string, ...a: unknown[]) => unknown };
const load = Module._load;
Module._load = (r: string, ...a: unknown[]) => (r === 'electron' ? { BrowserWindow: { fromWebContents: () => null } } : load(r, ...a));
const reader = require('../../electron/dwgReader.cjs') as {
  registerDwgReaderIpc: (ipc: unknown, app: unknown, dialog: unknown, resourcesDir: string) => void;
  skipped: (stderr: string) => string[];
  versionNote: (bytes: Uint8Array) => { version: string | null; warning?: string | null; notDwg?: boolean };
};
reader.registerDwgReaderIpc(
  { handle: (ch: string, fn: (...a: unknown[]) => unknown) => handlers.set(ch, fn) },
  { getPath: () => dir },
  { showOpenDialog: async () => (pick ? { canceled: false, filePaths: [pick] } : { canceled: true, filePaths: [] }) },
  res,
);
const call = (ch: string, ...a: unknown[]) => handlers.get(ch)!({ sender: {} }, ...a) as Promise<Record<string, unknown>>;
type Read = { ok: boolean; notConfigured?: boolean; error?: string; files: { name: string; text: string; version: string | null; warnings: string[] }[] };

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('  ok ', name); };

try {
  await test('without the converter in the installation: not available, said plainly', async () => {
    const st = await call('isa:dwg-status');
    assert.equal(st.ok, false);
    assert.equal(st.builtIn, false);
    const r = await call('isa:dwg-read', [{ name: 'a.dwg', bytes: new Uint8Array([0x41]) }]) as Read;
    assert.equal(r.ok, false);
    assert.equal(r.notConfigured, true);
  });

  const kind = installBundled();
  await test(`the bundled dwg2dxf (${kind}) converts a DWG with nothing to set up`, async () => {
    assert.ok(kind !== 'stand-in' || process.env.OS !== 'Windows_NT', 'On Windows this test runs the real dwg2dxf: fetch it first with node scripts/fetch-libredwg.cjs');
    const st = await call('isa:dwg-status');
    assert.deepEqual([st.ok, st.builtIn, st.configured], [true, true, false]);
    const r = await call('isa:dwg-read', [{ name: 'Sample cell.dwg', bytes: new Uint8Array(readFileSync(SAMPLE_DWG)) }]) as Read;
    assert.equal(r.ok, true, r.error);
    assert.equal(r.files[0].name, 'Sample cell.dxf');
    assert.equal(r.files[0].version, 'R2000 (AC1015)');
    assert.equal(r.files[0].text.replace(/\r\n/g, '\n'), SAMPLE_DXF.replace(/\r\n/g, '\n'), 'what LibreDWG 0.14 writes for the sample');
    assert.match(dxfToText(r.files[0].text, 'Sample cell.dwg'), /TAG=KA1/);
    if (kind === 'stand-in') assert.deepEqual(r.files[0].warnings, ['Not read from Sample cell.dwg (shown as missing; check them on the drawing): ACDBPLACEHOLDER.']);
  });

  await test('what the converter skips, and DWG versions outside R13–R2018, become warnings', () => {
    assert.deepEqual(reader.skipped([
      'Warning: stale ATTRIB subentity',
      'Warning: Unhandled Class object 500 ACDBPLACEHOLDER (0x401) 12/2A',
      'Warning: Unhandled Class entity 501 ACAD_PROXY_ENTITY (0x401) 13/2B',
      'Warning: Unstable Class object 506 MLEADERSTYLE (0xfff) 45/2C',
      'ERROR: Unsupported MESH',
    ].join('\n')), ['ACDBPLACEHOLDER', 'ACAD_PROXY_ENTITY', 'MESH']);
    const v = (s: string) => reader.versionNote(new TextEncoder().encode(`${s}\0\0\0\0`));
    assert.equal(v('AC1032').version, 'R2018 (AC1032)');
    assert.equal(v('AC1024').warning, undefined);
    assert.match(String(v('AC1009').warning), /older than R13/);
    assert.match(String(v('AC1036').warning), /newer than R2018/);
    assert.equal(v('PK\u0003\u0004xx').notDwg, true);
  });

  await test('not a DWG: refused before converting', async () => {
    const r = await call('isa:dwg-read', [{ name: 'photo.dwg', bytes: new TextEncoder().encode('\u0089PNG....') }]) as Read;
    assert.equal(r.ok, false);
    assert.match(String(r.error), /not a DWG file/);
  });

  await test('Advanced: another reader program instead, and back to the built-in one', async () => {
    // a script reader, run with the app's Node like a program: reader input.dwg output.dxf
    const other = join(dir, 'other-reader.cjs');
    writeFileSync(other, `const fs = require('fs'); if (!fs.existsSync(process.argv[2])) process.exit(2); fs.copyFileSync(${JSON.stringify(file('e2e/fixtures/convert/roll-former.dxf'))}, process.argv[3]);\n`);
    pick = other;
    const st = await call('isa:dwg-configure');
    assert.deepEqual([st.ok, st.builtIn, st.configured, st.path], [true, false, true, other]);
    const r = await call('isa:dwg-read', [{ name: 'Roll former.dwg', bytes: new TextEncoder().encode('AC1032....') }]) as Read;
    assert.equal(r.ok, true, r.error);
    assert.match(dxfToText(r.files[0].text, 'Roll former.dwg'), /6 sheets side by side/);
    const back = await call('isa:dwg-clear');
    assert.deepEqual([back.ok, back.builtIn], [true, true]);
  });

  await test('a reader that fails, is gone, or is a module without dwgToDxf is reported plainly', async () => {
    const bad = join(dir, 'bad.cjs');
    writeFileSync(bad, 'console.error("cannot open"); process.exit(3);\n');
    pick = bad;
    await call('isa:dwg-configure');
    const r = await call('isa:dwg-read', [{ name: 'x.dwg', bytes: new TextEncoder().encode('AC1024..') }]) as Read;
    assert.equal(r.ok, false);
    assert.match(String(r.error), /DWG converter failed: cannot open/);
    rmSync(bad);
    assert.match(String((await call('isa:dwg-status')).error), /no longer there/);
    const mod = join(dir, 'reader.node');
    writeFileSync(mod, 'not a module');
    pick = mod;
    assert.match(String((await call('isa:dwg-configure')).error), /could not be loaded/);
    await call('isa:dwg-clear');
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${passed} passed`);
