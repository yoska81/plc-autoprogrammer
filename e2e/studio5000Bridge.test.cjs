// The desktop app's side of the Studio 5000 bridge (electron/studio5000Bridge.cjs, the TIA bridge's client) against a
// fake bridge (e2e/fake-studio5000-bridge.cjs): the IPC answers, progress, stop while an import goes, the Open dialog
// (.ACD), the log; and, on Windows CI after scripts/build-studio5000-bridge.cjs, the real Studio5000Bridge.exe (no
// Studio 5000 there: detect says so).
//   node e2e/studio5000Bridge.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerStudio5000BridgeIpc } = require('../electron/studio5000Bridge.cjs');
const { createBridge } = require('../electron/tiaBridge.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio5000-'));
  const handlers = {};
  const quit = [];
  process.env.ISA_STUDIO5000_BRIDGE = path.join(__dirname, 'fake-studio5000-bridge.cjs');
  const dialog = { showOpenDialog: async (o) => { assert.ok(o.filters[0].extensions.includes('ACD')); return { canceled: false, filePaths: ['D:\\Lines\\Line.ACD'] }; } };
  registerStudio5000BridgeIpc({ handle: (ch, fn) => { handlers[ch] = fn; } }, { getPath: () => dir, on: (ev, fn) => { if (ev === 'will-quit') quit.push(fn); } }, dir, dialog);
  const sent = [];
  const e = { sender: { send: (ch, m) => sent.push([ch, m]) } };
  const call = (cmd, args) => handlers['isa:studio5000'](e, cmd, args);

  const d = await call('detect', {});
  assert.equal(d.ok, true); assert.equal(d.value.logix[0].version, '36.00.02');
  assert.deepEqual(sent[0], ['isa:studio5000-progress', { id: 1, text: 'Looking for Studio 5000 and the Logix Designer SDK…' }]);
  assert.deepEqual(await call('import', {}), { ok: false, error: 'Choose your Studio 5000 project (.ACD) first.' });
  ok('detect; an import without the project refused in words; progress to the window');

  const running = call('import', { acd: 'D:\\Lines\\Line.ACD', xpaths: ['Controller/Tags'] });
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await call('stop', {}), { ok: true, value: { stopping: true } });
  const r = await running;
  assert.equal(r.ok, false); assert.match(r.error, /^Stopped, as you asked\. Your own Studio 5000 project was not changed\./);
  ok('stop answers at once while an import goes; the user\'s project not changed, said');
  const b = await call('import', { acd: 'D:\\Lines\\Line.ACD', xpaths: ['Controller/Tags'] });
  assert.equal(b.value.project, 'D:\\Lines\\Line_ISA.ACD');
  assert.equal(await handlers['isa:studio5000-pick'](e), 'D:\\Lines\\Line.ACD');
  assert.equal(await handlers['isa:studio5000-log'](), path.join(dir, 'studio5000-bridge.log'));
  ok('an import after a stop goes; the Open dialog for the .ACD; the log path');
  quit.forEach((f) => f());

  // The real Studio5000Bridge.exe (Windows CI): it starts, answers ping, detect finds no Studio 5000, import says so.
  const real = process.env.STUDIO5000_BRIDGE_EXE;
  if (real) {
    const rb = createBridge({ exe: real, logFile: path.join(dir, 'real.log'), label: 'Studio 5000 bridge', what: 'the Logix Designer SDK' });
    assert.deepEqual(await rb.call('ping'), { pong: true });
    const rd = await rb.call('detect');
    assert.equal(typeof rd.ready, 'boolean');
    if (!rd.ready) await assert.rejects(rb.call('import', { acd: path.join(dir, 'none.ACD'), l5x: 'x', xpaths: ['a'] }), /no Studio 5000 project|not installed/);
    assert.deepEqual(await rb.call('stop'), { stopping: false });
    rb.stop();
    assert.match(fs.readFileSync(path.join(dir, 'real.log'), 'utf8'), /studio 5000 bridge .* started/);
    ok(`the real bridge: ping, detect (${rd.ready ? rd.logix[0].version : 'no Studio 5000'}), import, stop, its log`);
  }
  console.log(`studio5000Bridge.test: all passed (${passed})`);
  setTimeout(() => process.exit(0), 100);
})().catch((err) => { console.error(err); process.exit(1); });
