// A project handed over from the web page (electron/sendWatch.cjs), in a temp "Downloads": a browser's finished
// download (written under a temp name, then renamed) is offered once; a second copy "(2)" too; other files, an
// empty file, a file from before the app started and the same file again are not.
//   node e2e/sendWatch.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { watchSends, handedOver, projectName } = require('../electron/sendWatch.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  assert.ok(handedOver('Line 1.isa-send.zip') && handedOver('LINE.ISA-SEND.ZIP') && handedOver('Line 1.isa-send (2).zip'));
  assert.ok(!handedOver('Line 1.isap') && !handedOver('Line 1.zip') && !handedOver('Line 1.isa-send.zip.crdownload'));
  assert.equal(projectName('Line 1.isa-send.zip'), 'Line 1.isap');
  assert.equal(projectName('Line 1.isa-send (2).zip'), 'Line 1.isap');
  ok('the names: <project>.isa-send.zip (and a browser\'s "(2)" copy) → <project>.isap');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'downloads-'));
  const old = path.join(dir, 'Before.isa-send.zip');
  fs.writeFileSync(old, 'zip');
  const offered = [];
  const logged = [];
  const stop = watchSends({ dir, since: Date.now(), settleMs: 100, onFile: (f) => offered.push(path.basename(f)), log: (s) => logged.push(s) });

  fs.writeFileSync(path.join(dir, 'Line 1.isa-send.zip.crdownload'), 'PK zip bytes');
  await wait(200);
  assert.deepEqual(offered, []);
  fs.renameSync(path.join(dir, 'Line 1.isa-send.zip.crdownload'), path.join(dir, 'Line 1.isa-send.zip'));
  await wait(400);
  assert.deepEqual(offered, ['Line 1.isa-send.zip']);
  assert.match(logged.join('\n'), /handed over from the web page: Line 1\.isa-send\.zip \(12 bytes\)/);
  ok('a finished download (temp name, then renamed) is offered once, and logged');

  fs.writeFileSync(path.join(dir, 'report.pdf'), 'pdf');
  fs.writeFileSync(path.join(dir, 'Empty.isa-send.zip'), '');
  const before = path.join(dir, 'Old.isa-send.zip');
  fs.writeFileSync(before, 'zip');
  const hourAgo = new Date(Date.now() - 3600000);
  fs.utimesSync(before, hourAgo, hourAgo);
  fs.utimesSync(old, hourAgo, hourAgo);
  await wait(400);
  assert.deepEqual(offered, ['Line 1.isa-send.zip']);
  ok('not offered: other files, an empty file, files from before the app started');

  const mtime = fs.statSync(path.join(dir, 'Line 1.isa-send.zip')).mtime;
  fs.utimesSync(path.join(dir, 'Line 1.isa-send.zip'), mtime, mtime);
  await wait(400);
  assert.deepEqual(offered, ['Line 1.isa-send.zip']);
  fs.writeFileSync(path.join(dir, 'Line 1.isa-send (2).zip'), 'PK again');
  await wait(400);
  assert.deepEqual(offered, ['Line 1.isa-send.zip', 'Line 1.isa-send (2).zip']);
  ok('the same file again: not twice; a second copy sent: offered');

  stop();
  fs.writeFileSync(path.join(dir, 'Late.isa-send.zip'), 'zip');
  await wait(400);
  assert.equal(offered.length, 2);
  ok('stopped: nothing more');

  const quiet = watchSends({ dir: path.join(dir, 'missing'), onFile: () => undefined, log: (s) => logged.push(s) });
  quiet();
  assert.match(logged.pop(), /cannot watch .*missing/);
  ok('no Downloads folder: logged, nothing breaks');
  console.log(`sendWatch.test: all passed (${passed})`);
})().catch((e) => { console.error(e); process.exit(1); });
