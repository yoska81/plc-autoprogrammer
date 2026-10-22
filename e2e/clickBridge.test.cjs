// The desktop app's side of the CLICK bridge (electron/clickBridge.cjs, the TIA bridge's client) against a fake
// bridge (e2e/fake-click-bridge.cjs): the IPC answers, progress, stop while a run goes, errors in words; and, on
// Windows CI after scripts/build-click-bridge.cjs, the real ClickBridge.exe (no CLICK there: detect says so).
//   node e2e/clickBridge.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerClickBridgeIpc } = require('../electron/clickBridge.cjs');
const { createBridge } = require('../electron/tiaBridge.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'click-'));
  const handlers = {};
  const quit = [];
  process.env.ISA_CLICK_BRIDGE = path.join(__dirname, 'fake-click-bridge.cjs');
  registerClickBridgeIpc({ handle: (ch, fn) => { handlers[ch] = fn; } }, { getPath: () => dir, on: (ev, fn) => { if (ev === 'will-quit') quit.push(fn); } }, dir);
  const sent = [];
  const e = { sender: { send: (ch, m) => sent.push([ch, m]) } };
  const call = (cmd, args) => handlers['isa:click'](e, cmd, args);

  const d = await call('detect', {});
  assert.equal(d.ok, true); assert.equal(d.value.installs[0].version, '3.71');
  assert.deepEqual(sent[0], ['isa:click-progress', { id: 1, text: 'Looking for CLICK Programming Software…' }]);
  assert.deepEqual(await call('run', { steps: [{ do: 'wait' }] }), { ok: false, error: 'Open CLICK first.' });
  assert.equal((await call('start', {})).value.version, '3.71');
  ok('detect, start, a run before start refused in words; progress to the window');

  const steps = Array.from({ length: 40 }, (_, i) => ({ do: 'wait', ms: 1, say: `step ${i + 1}` }));
  const running = call('run', { steps });
  await new Promise((r) => setTimeout(r, 200));
  const s = await call('stop', {});
  assert.deepEqual(s, { ok: true, value: { stopping: true } });
  const r = await running;
  assert.equal(r.ok, false); assert.match(r.error, /^Stopped at step \d+, as you asked\. Nothing was saved\./);
  ok('stop answers at once while a run goes; the run ends saying nothing was saved');
  assert.deepEqual((await call('run', { steps: steps.slice(0, 3) })).value, { steps: 3 });
  assert.match(sent.filter(([ch]) => ch === 'isa:click-progress').at(-1)[1].text, /^3\/3 step 3$/);
  assert.equal(await handlers['isa:click-log'](), path.join(dir, 'click-bridge.log'));
  ok('a run after a stop goes; progress per step; the log path');
  quit.forEach((f) => f());

  // The real ClickBridge.exe (Windows CI): it starts, answers ping, detect finds no CLICK, start says so.
  const real = process.env.CLICK_BRIDGE_EXE;
  if (real) {
    const b = createBridge({ exe: real, logFile: path.join(dir, 'real.log'), label: 'CLICK bridge', what: 'CLICK Programming Software' });
    assert.deepEqual(await b.call('ping'), { pong: true });
    const rd = await b.call('detect');
    assert.equal(typeof rd.ready, 'boolean');
    if (!rd.ready) await assert.rejects(b.call('start'), /not installed on this PC/);
    await assert.rejects(b.call('run', { steps: [] }), /Open CLICK first|no steps/);
    assert.deepEqual(await b.call('stop'), { stopping: false });
    b.stop();
    assert.match(fs.readFileSync(path.join(dir, 'real.log'), 'utf8'), /click bridge .* started/);
    ok(`the real bridge: ping, detect (${rd.ready ? rd.installs[0].version : 'no CLICK'}), start, stop, its log`);
  }
  console.log(`clickBridge.test: all passed (${passed})`);
  setTimeout(() => process.exit(0), 100);
})().catch((err) => { console.error(err); process.exit(1); });
