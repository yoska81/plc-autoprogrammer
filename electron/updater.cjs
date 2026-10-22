// Updates of the desktop app (electron-updater, NSIS). A quiet check a little after start; a new version
// downloads in the background; the page shows "A new version is ready — Restart to update" and the app
// restarts only when the user clicks it. Never a pop-up for an update error (the log has it).
//
// Feed: package.json build.publish (a public releases-only GitHub repo: no token in the app), or
// ISA_UPDATE_URL (a generic feed with latest.yml, for tests and a private server).
// Projects and settings live in userData (%APPDATA%\ISA Auto Programmer), which an update never touches.
// The bridges (TIA Portal, CLICK, CODESYS, Studio 5000) are part of the installer: they are stopped before the
// installer runs (their exes would be locked) and come back new with the app.
const fs = require('node:fs');
const path = require('node:path');

/**
 * The update logic, without Electron (tests drive it with a fake updater).
 * updater: electron-updater's autoUpdater (EventEmitter + checkForUpdates / quitAndInstall).
 * send(state): to every window. beforeInstall(): stop the bridges, close the windows (their own save checks);
 * resolves true when the app may install now.
 */
function createUpdateController({ updater, version, send, log = () => {}, beforeInstall = async () => true, setTimer = setTimeout }) {
  let state = { status: 'idle', current: version };
  let manual = false;
  const set = (s) => { state = { ...s, current: version, manual }; send(state); };
  updater.on('checking-for-update', () => set({ status: 'checking' }));
  updater.on('update-available', (info) => set({ status: 'downloading', version: info?.version ?? null, percent: 0 }));
  updater.on('download-progress', (p) => { if (state.status === 'downloading') set({ ...state, percent: Math.round(p?.percent ?? 0) }); });
  updater.on('update-not-available', () => set({ status: 'none' }));
  updater.on('update-downloaded', (info) => set({ status: 'ready', version: info?.version ?? state.version ?? null }));
  updater.on('error', (e) => {
    log(`update error: ${e?.stack || e?.message || e}`);
    // A quiet check stays quiet; "Check for updates" says what went wrong in plain words.
    set({ status: 'error', message: plainError(e) });
  });

  async function check(byUser = false) {
    manual = byUser;
    if (state.status === 'downloading' || state.status === 'ready') { set(state); return state; }
    try { await updater.checkForUpdates(); } catch (e) { updater.emit('error', e); }
    return state;
  }

  let installing = false;
  async function install() {
    if (state.status !== 'ready' || installing) return false;
    installing = true;
    try {
      if (!(await beforeInstall())) return false;
      log(`installing ${state.version} and restarting`);
      // Silent (the user already said yes), and start the new version afterwards.
      updater.quitAndInstall(true, true);
      return true;
    } finally { installing = false; }
  }

  return {
    get state() { return state; },
    check,
    install,
    /** The quiet check a little after start. */
    start(delayMs) { setTimer(() => { void check(false); }, delayMs); },
  };
}

function plainError(e) {
  const m = String(e?.message ?? e ?? '');
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|net::ERR_/i.test(m)) return 'No connection to the update server. Check the internet connection and try again later.';
  if (/\b404\b|Cannot find .*latest\.yml|No published versions/i.test(m)) return 'No update has been published yet.';
  if (/sha512 checksum mismatch/i.test(m)) return 'The download was damaged. It will be fetched again next time.';
  return 'The update check did not work. It will try again next time the app starts.';
}

/** electron-updater: the bundled copy the installer ships (scripts/desktop-prepare.cjs), else the package (development). */
function loadUpdater() {
  const bundled = path.join(__dirname, 'vendor', 'electron-updater.cjs');
  const mod = fs.existsSync(bundled) ? require(bundled) : require('electron-updater');
  // Tests (e2e/desktop-update.e2e.cjs, any OS): the Windows updater against a local feed; the installer is not
  // started, the install call is written to ISA_UPDATE_TEST and the app quits as it would for the installer.
  const test = process.env.ISA_UPDATE_TEST;
  if (!test) return mod.autoUpdater;
  const u = new mod.NsisUpdater();
  u.quitAndInstall = (isSilent, forceRunAfter) => {
    fs.writeFileSync(test, JSON.stringify({ isSilent, forceRunAfter, version: u.currentVersion?.version ?? null }));
    require('electron').app.quit();
  };
  return u;
}

/**
 * Wires the updater into the app. Off in development unless ISA_UPDATE_URL points at a feed.
 * closeWindowsForUpdate(): asks every window to close (their save checks run); resolves true once all are closed.
 */
function registerUpdater({ app, ipcMain, BrowserWindow, stopBridges, closeWindowsForUpdate }) {
  const feed = process.env.ISA_UPDATE_URL;
  const logFile = path.join(app.getPath('logs'), 'updates.log');
  const log = (line) => { try { fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`); } catch { /* no log */ } };
  const send = (s) => { for (const w of BrowserWindow.getAllWindows()) { try { w.webContents.send('isa:update-state', s); } catch { /* closing */ } } };
  const enabled = app.isPackaged || Boolean(feed);
  if (!enabled) {
    const off = { status: 'off', current: app.getVersion() };
    ipcMain.handle('isa:update-state', () => off);
    ipcMain.handle('isa:update-check', () => off);
    ipcMain.handle('isa:update-install', () => false);
    return null;
  }
  const updater = loadUpdater();
  updater.autoDownload = true;
  // Installs on the next normal quit too (the user then gets it without clicking Restart).
  updater.autoInstallOnAppQuit = true;
  // Builds from the integration branch are published as pre-releases.
  updater.allowPrerelease = true;
  updater.logger = { info: (m) => log(String(m)), warn: (m) => log(`warn ${m}`), error: (m) => log(`error ${m}`), debug: () => {} };
  if (feed) {
    // The packaged app has resources/app-update.yml (from build.publish); a feed given here gets its own.
    const cfg = path.join(app.getPath('userData'), 'update-feed.yml');
    fs.writeFileSync(cfg, `provider: generic\nurl: ${JSON.stringify(feed)}\nupdaterCacheDirName: isa-auto-programmer-updater\n`);
    updater.updateConfigPath = cfg;
    updater.forceDevUpdateConfig = !app.isPackaged;
    updater.setFeedURL({ provider: 'generic', url: feed });
  }
  const ctl = createUpdateController({
    updater, version: app.getVersion(), send, log,
    beforeInstall: async () => { await stopBridges(); return closeWindowsForUpdate(); },
  });
  ipcMain.handle('isa:update-state', () => ctl.state);
  ipcMain.handle('isa:update-check', () => ctl.check(true));
  ipcMain.handle('isa:update-install', () => ctl.install());
  app.whenReady().then(() => ctl.start(Number(process.env.ISA_UPDATE_DELAY_MS ?? 10000)));
  return ctl;
}

module.exports = { createUpdateController, registerUpdater, plainError };
