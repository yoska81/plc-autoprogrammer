// The desktop app's side of the TIA Portal bridge (electron/tiaBridge.cjs) against a fake bridge speaking the
// same protocol (e2e/fake-tia-bridge.cjs): start on the first request, answers matched by id (several in flight),
// progress, plain errors, a bridge that stops or never answers, restart after a stop, the IPC.
//   node e2e/tiaBridge.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTiaBridge, registerTiaBridgeIpc } = require('../electron/tiaBridge.cjs');

const fake = path.join(__dirname, 'fake-tia-bridge.cjs');
const rejects = async (p, re) => { await assert.rejects(p, (e) => { assert.match(e.message, re); return true; }); };
let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tia-'));
  const logFile = path.join(dir, 'tia-bridge.log');
  const progress = [];
  const b = createTiaBridge({ exe: fake, logFile, onProgress: (id, text) => progress.push([id, text]), timeouts: { default: 3000 } });
  assert.equal(b.running, false);

  const d = await b.call('detect');
  assert.equal(d.ready, true);
  assert.equal(d.openness[0].version, 'V19');
  assert.deepEqual(progress, [[1, 'Looking for TIA Portal and TIA Openness…']]);
  assert.equal(b.running, true);
  ok('detect: the bridge starts on the first request, progress comes before the answer');
  assert.match(fs.readFileSync(logFile, 'utf8'), /→ 1 detect/);
  ok('the bridge logs to the file the app gives it');

  const [slow, fast] = await Promise.all([b.call('slow', { ms: 300 }), b.call('ping')]);
  assert.deepEqual(slow, { waited: 300 }); assert.deepEqual(fast, { pong: true });
  ok('several requests in flight: each answer goes to its own request');

  await rejects(b.call('fails'), /^Open TIA Portal first\.$/);
  await rejects(b.call('nope'), /no command "nope"/);
  assert.deepEqual(await b.call('noisy'), { fine: true });
  ok('errors in plain words; other text on the bridge\'s output is ignored');

  await rejects(b.call('slow', { ms: 5000 }), /did not answer within 3 s \(slow\).*Openness access question/);
  ok('a request that never answers times out with what to check');

  const inFlight = b.call('slow', { ms: 2000 });
  await rejects(b.call('crash'), /bridge stopped \(exit code 3\): Unhandled exception: boom.*the log is at/);
  await rejects(inFlight, /bridge stopped/);
  assert.equal(b.running, false);
  ok('the bridge stops: every open request fails with the reason and where the log is');
  assert.deepEqual(await b.call('ping'), { pong: true });
  ok('the next request starts it again');
  b.stop();
  await rejects(createTiaBridge({ exe: path.join(dir, 'missing.exe') }).call('ping'), /not in this installation/);
  ok('no bridge installed: says so');

  // The IPC as the window uses it: { ok, value | error }, progress sent to the window.
  const handlers = {};
  const quitHooks = [];
  const app = { getPath: () => dir, on: (ev, fn) => { if (ev === 'will-quit') quitHooks.push(fn); } };
  process.env.ISA_TIA_BRIDGE = fake;
  process.env.FAKE_TIA = JSON.stringify({ detect: { ready: false, steps: ['Add your Windows user to the "Siemens TIA Openness" group.'] } });
  registerTiaBridgeIpc({ handle: (ch, fn) => { handlers[ch] = fn; } }, app, dir);
  const sent = [];
  const e = { sender: { send: (ch, m) => sent.push([ch, m]) } };
  const r = await handlers['isa:tia'](e, 'detect', {});
  assert.equal(r.ok, true); assert.equal(r.value.ready, false); assert.match(r.value.steps[0], /Siemens TIA Openness/);
  assert.deepEqual(sent[0], ['isa:tia-progress', { id: 1, text: 'Looking for TIA Portal and TIA Openness…' }]);
  const bad = await handlers['isa:tia'](e, 'fails', {});
  assert.deepEqual(bad, { ok: false, error: 'Open TIA Portal first.' });
  assert.equal(await handlers['isa:tia-log'](), path.join(dir, 'tia-bridge.log'));
  ok('IPC: { ok, value | error }, progress to the window, the log path');
  quitHooks.forEach((f) => f());

  // The real TiaBridge.exe (CI on Windows, after scripts/build-tia-bridge.cjs): it starts, answers ping, and
  // detect says what this PC lacks (no TIA Portal on a build server) in plain steps.
  const real = process.env.TIA_BRIDGE_EXE;
  if (real) {
    const rb = createTiaBridge({ exe: real, logFile: path.join(dir, 'real.log') });
    assert.deepEqual(await rb.call('ping'), { pong: true });
    const rd = await rb.call('detect');
    assert.equal(typeof rd.ready, 'boolean');
    assert.ok(Array.isArray(rd.steps) && (rd.ready || rd.steps.length > 0), JSON.stringify(rd));
    await rejects(rb.call('nope'), /no command "nope"/);
    rb.stop();
    assert.match(fs.readFileSync(path.join(dir, 'real.log'), 'utf8'), /bridge .* started[\s\S]*→ 2 detect/);
    ok(`the real bridge: ping, detect (${rd.ready ? 'ready' : rd.steps[0]}), unknown command, its log`);
  }

  console.log(`tiaBridge.test: all passed (${passed})`);
  setTimeout(() => process.exit(0), 100);
})().catch((err) => { console.error(err); process.exit(1); });
