// Desktop app updates: the built app checks a local update feed (latest.yml + a fake "installer"), downloads it
// quietly (sha512 checked), shows "A new version is ready — Restart to update", installs only on the click
// (the install call is recorded instead of running an installer: ISA_UPDATE_TEST), and the projects and settings
// of the profile are there again at the next start. Also: Help shows the version, "Check for updates" answers,
// and a damaged download is refused.
//
//   npm run build:desktop
//   xvfb-run -a node e2e/desktop-update.e2e.cjs        # Linux without a display
const { _electron: electron } = require('/opt/node22/lib/node_modules/playwright');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out-desktop-update');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'isa-update-'));
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** A feed like the releases repo's: latest.yml naming the setup file, its size and sha512. */
function feed({ version, damaged = false }) {
  const setup = Buffer.from(`fake installer ${version}\n`.repeat(2000));
  const file = `ISA-Auto-Programmer-Setup-${version}.exe`;
  const sha512 = crypto.createHash('sha512').update(damaged ? Buffer.from('other') : setup).digest('base64');
  const yml = `version: ${version}\nfiles:\n  - url: ${file}\n    sha512: ${sha512}\n    size: ${setup.length}\npath: ${file}\nsha512: ${sha512}\nreleaseDate: '2026-10-22T12:00:00.000Z'\n`;
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    const u = req.url.split('?')[0];
    // The Windows app asks for latest.yml; on Linux the same updater asks for latest-linux.yml.
    if (/^\/latest(-linux)?\.yml$/.test(u)) { res.writeHead(200, { 'content-type': 'text/yaml' }); res.end(yml); return; }
    if (u === `/${file}`) { res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': setup.length }); res.end(setup); return; }
    res.writeHead(404); res.end();
  });
  return { hits, close: () => new Promise((r) => server.close(r)), listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}/`))) };
}

const launch = (env = {}) => electron.launch({
  executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
  args: [ROOT, '--no-sandbox'],
  env: { ...process.env, ISA_USER_DATA: PROFILE, ...env },
});

(async () => {
  const errors = [];
  // Closing a project not saved to a file: the page's beforeunload (accepted here) and the app's "Close without
  // saving" question (stubbed in the main process: nothing can be clicked headless).
  const watch = (win) => {
    win.on('dialog', (d) => d.accept().catch(() => {}));
    win.on('pageerror', (e) => errors.push(e.message));
    win.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };

  // ── 1. No feed reachable (development run without ISA_UPDATE_URL): updates are off, Help shows the version ──
  let app = await launch();
  let win = await app.firstWindow();
  watch(win);
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  check((await win.evaluate(() => window.isaDesktop.update.state())).status === 'off', 'development run: updates off');
  await win.getByRole('button', { name: 'Help' }).click();
  check((await win.getByTestId('help-version').innerText()).includes(pkg.version), `Help shows the version (${pkg.version})`);
  // A project and a setting made before the update.
  await win.keyboard.press('Escape');
  await win.getByRole('button', { name: 'New project' }).first().click();
  await win.getByPlaceholder('e.g. Line 3 case packer').fill('Update Test Cell');
  await win.getByRole('button', { name: 'Next →' }).click();
  await win.getByRole('button', { name: 'Close ✕' }).click();
  await win.waitForTimeout(500);
  await win.evaluate(() => localStorage.setItem('isa-update-test-setting', 'kept'));
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  await app.close();

  // ── 2. A new version on the feed: quiet download, banner, nothing installed until Restart ──
  const newer = '9.9.1';
  const f = feed({ version: newer });
  const url = await f.listen();
  const record = path.join(OUT, 'install.json');
  app = await launch({ ISA_UPDATE_URL: url, ISA_UPDATE_DELAY_MS: '500', ISA_UPDATE_TEST: record });
  win = await app.firstWindow();
  watch(win);
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  const banner = win.getByTestId('update-banner');
  await banner.filter({ hasText: 'A new version is ready' }).waitFor({ timeout: 30000 });
  log('Banner:', (await banner.innerText()).replace(/\s+/g, ' '), '| feed requests:', f.hits.join(' '));
  check(f.hits.some((h) => /^\/latest(-linux)?\.yml/.test(h)) && f.hits.some((h) => h.includes(`Setup-${newer}.exe`)), 'checked the feed and downloaded the new version in the background');
  check((await banner.innerText()).includes(newer), 'banner names the new version');
  await win.screenshot({ path: path.join(OUT, '01_ready.png') });
  await win.waitForTimeout(1500);
  check(!fs.existsSync(record), 'nothing installed without the click');
  // Later: the banner goes away (the update still installs on the next restart).
  await banner.getByRole('button', { name: 'Later' }).click();
  check(await win.getByTestId('update-banner').count() === 0, 'Later hides the banner');
  // Check for updates (Help): the downloaded version is ready again.
  await win.getByRole('button', { name: 'Help' }).click();
  await win.getByRole('button', { name: 'Check for updates' }).click();
  await banner.filter({ hasText: 'A new version is ready' }).waitFor({ timeout: 10000 });
  // Restart to update: the window closes through its save checks, then the install (recorded) with a restart after.
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  const closed = app.waitForEvent('close', { timeout: 30000 });
  await banner.getByRole('button', { name: 'Restart to update' }).click();
  await closed;
  const inst = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf8')) : null;
  log('Install call:', JSON.stringify(inst));
  check(inst && inst.isSilent === true && inst.forceRunAfter === true, 'Restart installs silently and starts the new version');
  await f.close();

  // ── 3. After the update: the projects and settings of the profile are all there ──
  const g = feed({ version: pkg.version });
  const url2 = await g.listen();
  app = await launch({ ISA_UPDATE_URL: url2, ISA_UPDATE_DELAY_MS: '60000' });
  win = await app.firstWindow();
  watch(win);
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  const projects = await win.locator('select[aria-label="Open project"] option').allInnerTexts();
  log('Projects after the update:', projects.join(' | '));
  check(projects.includes('Update Test Cell'), 'project kept');
  check(await win.evaluate(() => localStorage.getItem('isa-update-test-setting')) === 'kept', 'settings kept');
  // Check for updates with nothing new: says so.
  await win.getByRole('button', { name: 'Help' }).click();
  await win.getByRole('button', { name: 'Check for updates' }).click();
  await win.getByTestId('update-banner').filter({ hasText: 'You have the latest version' }).waitFor({ timeout: 15000 });
  check(true, '"Check for updates" with nothing new: "You have the latest version"');
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  await app.close();
  await g.close();

  // ── 4. A damaged download is refused (sha512), with a plain message on a manual check ──
  const h = feed({ version: '9.9.2', damaged: true });
  const url3 = await h.listen();
  app = await launch({ ISA_UPDATE_URL: url3, ISA_UPDATE_DELAY_MS: '60000', ISA_UPDATE_TEST: record + '.2' });
  win = await app.firstWindow();
  watch(win);
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  await win.getByRole('button', { name: 'Help' }).click();
  await win.getByRole('button', { name: 'Check for updates' }).click();
  await win.getByTestId('update-banner').filter({ hasText: /damaged|did not work/ }).waitFor({ timeout: 30000 });
  log('Damaged download:', (await win.getByTestId('update-banner').innerText()).replace(/\s+/g, ' '));
  check(await win.getByText('A new version is ready').count() === 0, 'a damaged download is never offered');
  await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 0; });
  await app.close();
  await h.close();

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  if (fails.length) { console.log(`FAIL: ${fails.length}`); process.exit(1); }
  console.log('desktop update: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
