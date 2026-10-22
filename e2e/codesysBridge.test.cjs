// The desktop app's side of the CODESYS bridge (electron/codesysBridge.cjs, the TIA bridge's client) against a fake
// bridge (e2e/fake-codesys-bridge.cjs): the IPC answers, progress, stop while a build goes, the Open dialog, the
// log; and, on Windows CI after scripts/build-codesys-bridge.cjs, the real CodesysBridge.exe (no CODESYS there:
// detect says so).
//   node e2e/codesysBridge.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerCodesysBridgeIpc } = require('../electron/codesysBridge.cjs');
const { createBridge } = require('../electron/tiaBridge.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesys-'));
  const handlers = {};
  const quit = [];
  process.env.ISA_CODESYS_BRIDGE = path.join(__dirname, 'fake-codesys-bridge.cjs');
  const dialog = { showOpenDialog: async (o) => { assert.deepEqual(o.filters[0].extensions, ['project']); return { canceled: false, filePaths: ['D:\\Lines\\Line.project'] }; } };
  registerCodesysBridgeIpc({ handle: (ch, fn) => { handlers[ch] = fn; } }, { getPath: () => dir, on: (ev, fn) => { if (ev === 'will-quit') quit.push(fn); } }, dir, dialog);
  const sent = [];
  const e = { sender: { send: (ch, m) => sent.push([ch, m]) } };
  const call = (cmd, args) => handlers['isa:codesys'](e, cmd, args);

  const d = await call('detect', {});
  assert.equal(d.ok, true); assert.equal(d.value.installs[0].profile, 'CODESYS V3.5 SP19 Patch 2');
  assert.deepEqual(sent[0], ['isa:codesys-progress', { id: 1, text: 'Looking for CODESYS…' }]);
  assert.deepEqual(await call('build', {}), { ok: false, error: 'The app sent no program (generate it first).' });
  ok('detect; a build without the program refused in words; progress to the window');

  const running = call('build', { objects: [{ name: 'Main', kind: 'program' }] });
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await call('stop', {}), { ok: true, value: { stopping: true } });
  const r = await running;
  assert.equal(r.ok, false); assert.match(r.error, /^Stopped, as you asked: CODESYS was closed\. Your own project was not changed\./);
  ok('stop answers at once while a build goes; it ends saying the user\'s project was not changed');
  const b = await call('build', { objects: [{ name: 'Main', kind: 'program' }] });
  assert.deepEqual(b.value.objects, [{ name: 'Main', kind: 'program', action: 'created' }]);
  assert.equal(await handlers['isa:codesys-pick'](e), 'D:\\Lines\\Line.project');
  assert.equal(await handlers['isa:codesys-log'](), path.join(dir, 'codesys-bridge.log'));
  ok('a build after a stop goes; the Open dialog for the user\'s project; the log path');
  quit.forEach((f) => f());

  // The real CodesysBridge.exe (Windows CI): it starts, answers ping, detect finds no CODESYS, build says so.
  const real = process.env.CODESYS_BRIDGE_EXE;
  if (real) {
    const rb = createBridge({ exe: real, logFile: path.join(dir, 'real.log'), label: 'CODESYS bridge', what: 'CODESYS' });
    assert.deepEqual(await rb.call('ping'), { pong: true });
    const rd = await rb.call('detect');
    assert.equal(typeof rd.ready, 'boolean');
    if (!rd.ready) await assert.rejects(rb.call('build', { objects: [] }), /not installed on this PC/);
    assert.deepEqual(await rb.call('stop'), { stopping: false });
    rb.stop();
    assert.match(fs.readFileSync(path.join(dir, 'real.log'), 'utf8'), /codesys bridge .* started/);
    ok(`the real bridge: ping, detect (${rd.ready ? rd.installs[0].version : 'no CODESYS'}), build, stop, its log`);
  }
  console.log(`codesysBridge.test: all passed (${passed})`);
  setTimeout(() => process.exit(0), 100);
})().catch((err) => { console.error(err); process.exit(1); });
