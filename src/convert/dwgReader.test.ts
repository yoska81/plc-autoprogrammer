// npx tsx src/convert/dwgReader.test.ts — the Windows app's DWG reader (electron/dwgReader.cjs) with a stand-in
// reader program (the real one is built with the ODA Drawings SDK, which is not in this repository).
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dxfToText } from './dxf';

const require = createRequire(import.meta.url);
const handlers = new Map<string, (...a: unknown[]) => unknown>();
const dir = mkdtempSync(join(tmpdir(), 'isa-dwg-test-'));
let pick: string | null = null;
// electron is only needed for the dialog's window; the stub replaces it
const Module = require('node:module') as { _load: (r: string, ...a: unknown[]) => unknown };
const load = Module._load;
Module._load = (r: string, ...a: unknown[]) => (r === 'electron' ? { BrowserWindow: { fromWebContents: () => null } } : load(r, ...a));
const { registerDwgReaderIpc } = require('../../electron/dwgReader.cjs') as { registerDwgReaderIpc: (ipc: unknown, app: unknown, dialog: unknown) => void };
registerDwgReaderIpc(
  { handle: (ch: string, fn: (...a: unknown[]) => unknown) => handlers.set(ch, fn) },
  { getPath: () => dir },
  { showOpenDialog: async () => (pick ? { canceled: false, filePaths: [pick] } : { canceled: true, filePaths: [] }) },
);
const call = (ch: string, ...a: unknown[]) => handlers.get(ch)!({ sender: {} }, ...a) as Promise<Record<string, unknown>>;

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log('  ok ', name); };

try {
  await test('not set up: status says so, reading DWG asks for it', async () => {
    assert.deepEqual(await call('isa:dwg-status'), { configured: false, ok: false });
    const r = await call('isa:dwg-read', [{ name: 'a.dwg', bytes: new Uint8Array([1]) }]);
    assert.equal(r.ok, false);
    assert.equal(r.notConfigured, true);
  });

  await test('a reader program chosen in Settings converts DWG → DXF, read by the DXF reader', async () => {
    // the stand-in "reader": copies the roll-former DXF to the output path, as the SDK program writes its DXF
    const dxf = new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url).pathname;
    const reader = join(dir, 'reader.sh');
    writeFileSync(reader, `#!/bin/sh\ntest -f "$1" || exit 2\ncp "${dxf}" "$2"\n`);
    chmodSync(reader, 0o755);
    pick = reader;
    const st = await call('isa:dwg-configure');
    assert.deepEqual(st, { configured: true, ok: true, path: reader });
    assert.equal(JSON.parse(readFileSync(join(dir, 'dwg-reader.json'), 'utf8')).path, reader, 'kept for next time');
    const r = await call('isa:dwg-read', [{ name: 'Roll former.dwg', bytes: new Uint8Array([0x41, 0x43]) }]) as { ok: boolean; files: { name: string; text: string }[] };
    assert.equal(r.ok, true);
    assert.equal(r.files[0].name, 'Roll former.dxf');
    assert.match(dxfToText(r.files[0].text, 'Roll former.dwg'), /6 sheets side by side/);
  });

  await test('a reader that fails or is gone is reported plainly', async () => {
    const bad = join(dir, 'bad.sh');
    writeFileSync(bad, '#!/bin/sh\nexit 3\n');
    chmodSync(bad, 0o755);
    pick = bad;
    await call('isa:dwg-configure');
    const r = await call('isa:dwg-read', [{ name: 'x.dwg', bytes: new Uint8Array([1]) }]);
    assert.equal(r.ok, false);
    assert.ok(!r.notConfigured);
    assert.match(String(r.error), /DWG reader failed/);
    rmSync(bad);
    assert.match(String((await call('isa:dwg-status')).error), /no longer there/);
    assert.deepEqual(await call('isa:dwg-clear'), { configured: false, ok: false });
  });

  await test('a .node module without dwgToDxf is refused', async () => {
    const mod = join(dir, 'reader.node');
    writeFileSync(mod, 'not a module');
    pick = mod;
    const st = await call('isa:dwg-configure');
    assert.equal(st.ok, false);
    assert.match(String(st.error), /could not be loaded/);
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${passed} passed`);
