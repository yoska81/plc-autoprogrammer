// Desktop app updates without Electron: the update logic (electron/updater.cjs) with a fake electron-updater,
// and the installer settings an update relies on (same app id, user profile kept, feed with no token).
//   node e2e/updater.test.cjs
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { createUpdateController, plainError } = require('../electron/updater.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

function fakeUpdater(script) {
  const u = new EventEmitter();
  u.installs = [];
  u.checkForUpdates = async () => { for (const [ev, arg] of script()) u.emit(ev, arg); };
  u.quitAndInstall = (silent, runAfter) => u.installs.push([silent, runAfter]);
  return u;
}

(async () => {
  // A quiet check that finds and downloads a new version: the page hears every step; nothing installs by itself.
  const sent = [];
  let gate = true;
  const u = fakeUpdater(() => [['checking-for-update'], ['update-available', { version: '0.7.12' }], ['download-progress', { percent: 42.4 }], ['update-downloaded', { version: '0.7.12' }]]);
  const timers = [];
  const ctl = createUpdateController({ updater: u, version: '0.7.3', send: (s) => sent.push(s), beforeInstall: async () => gate, setTimer: (fn, ms) => timers.push([fn, ms]) });
  ctl.start(10000);
  assert.equal(timers[0][1], 10000);
  assert.equal(await ctl.install(), false, 'nothing to install before a download');
  timers[0][0]();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent.map((s) => s.status), ['checking', 'downloading', 'downloading', 'ready']);
  assert.equal(sent[2].percent, 42);
  assert.equal(ctl.state.version, '0.7.12');
  assert.equal(ctl.state.current, '0.7.3');
  assert.equal(ctl.state.manual, false, 'a quiet check');
  assert.equal(u.installs.length, 0, 'never installs without the click');
  ok('quiet check → background download → ready; no install by itself');

  // Restart: the windows' save checks can call it off; then it installs silently and starts the new version.
  gate = false;
  assert.equal(await ctl.install(), false);
  assert.equal(u.installs.length, 0, 'called off (unsaved changes → Cancel)');
  gate = true;
  assert.equal(await ctl.install(), true);
  assert.deepEqual(u.installs, [[true, true]]);
  ok('Restart → save checks → silent install, new version started');

  // A manual check while an update is ready says so again (no second download).
  const before = sent.length;
  await ctl.check(true);
  assert.equal(sent.at(-1).status, 'ready');
  assert.equal(sent.at(-1).manual, true);
  assert.equal(sent.length, before + 1);
  ok('"Check for updates" with an update ready');

  // Nothing new / errors: plain words, never a crash.
  const s2 = [];
  const u2 = fakeUpdater(() => [['checking-for-update'], ['update-not-available']]);
  const c2 = createUpdateController({ updater: u2, version: '0.7.3', send: (s) => s2.push(s) });
  await c2.check(true);
  assert.equal(s2.at(-1).status, 'none');
  assert.equal(s2.at(-1).manual, true);
  const u3 = fakeUpdater(() => { throw new Error('net::ERR_INTERNET_DISCONNECTED'); });
  const s3 = [];
  const logs = [];
  const c3 = createUpdateController({ updater: u3, version: '0.7.3', send: (s) => s3.push(s), log: (l) => logs.push(l) });
  await c3.check(false);
  assert.equal(s3.at(-1).status, 'error');
  assert.match(s3.at(-1).message, /No connection to the update server/);
  assert.match(logs[0], /ERR_INTERNET_DISCONNECTED/, 'the details go to the log');
  assert.match(plainError(new Error('HttpError: 404 Cannot find latest.yml')), /No update has been published yet/);
  assert.match(plainError(new Error('sha512 checksum mismatch, expected x')), /damaged/);
  ok('nothing new / no connection / not published / damaged: plain words, details in the log');

  // Installer settings an update relies on.
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const b = pkg.build;
  assert.equal(b.appId, 'com.isa.autoprogrammer', 'same app id: the update replaces the installed app');
  assert.equal(b.productName, 'ISA Auto Programmer', 'same name: same profile folder %APPDATA%\\ISA Auto Programmer');
  assert.equal(b.nsis.perMachine, false, 'per-user install: updates need no administrator');
  assert.equal(b.nsis.deleteAppDataOnUninstall, false, 'the profile (projects, settings) is never deleted');
  assert.ok(b.win.target.some((t) => t.target === 'nsis'), 'NSIS installer (what electron-updater installs)');
  const pub = b.publish[0];
  assert.equal(pub.provider, 'github');
  assert.notEqual(`${pub.owner}/${pub.repo}`, 'yoska81/plc-autoprogrammer', 'the feed is the public releases repo, not the private source repo');
  assert.ok(!('token' in pub) && !('private' in pub), 'no token in the app');
  assert.ok(b.extraResources.some((r) => r.to === 'tia-bridge') && b.extraResources.some((r) => r.to === 'click-bridge') && b.extraResources.some((r) => r.to === 'codesys-bridge') && b.extraResources.some((r) => r.to === 'studio5000-bridge'), 'the bridges are in the installer: an update replaces them');
  ok('installer: same app id and profile, per-user, profile kept, public feed without a token, bridges included');

  // The main process wires it in: bridges stopped and windows closed (their save checks) before installing.
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /registerUpdater\(\{/);
  assert.match(main, /stopBridges:/);
  assert.match(main, /closeWindowsForUpdate:/);
  assert.match(main, /if \(updateRestart\) return;/);
  ok('main process: bridges stop, windows close through their save checks, then install');

  console.log(`updater: ${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
