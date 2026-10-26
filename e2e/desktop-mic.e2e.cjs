// Desktop app: the microphone permission for voice input. The first press asks with a native dialog
// (Allow once / Always allow / Don't allow, stubbed here: no dialog can be clicked headless); "Always" is
// remembered across a restart and can be reset in Settings → Voice; "Don't allow" explains what to do;
// camera requests are refused.
//
//   npm run build:desktop
//   xvfb-run -a node e2e/desktop-mic.e2e.cjs        # Linux without a display
const { _electron: electron } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out-desktop-mic');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'isa-mic-'));
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (ok) log('ok', what); else { fails.push(what); log('FAIL', what); } };

const launch = () => electron.launch({
  executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
  args: [ROOT, '--no-sandbox', '--use-fake-device-for-media-stream'],
  env: { ...process.env, ISA_USER_DATA: PROFILE },
});
// The native question, answered with button `answer` (0 Allow once, 1 Always allow, 2 Don't allow); counts how often it was asked.
const answerWith = (app, answer) => app.evaluate(({ dialog }, a) => {
  globalThis.__asked = [];
  dialog.showMessageBox = async (_w, o) => { globalThis.__asked.push(o.message); return { response: a, checkboxChecked: false }; };
}, answer);
const asked = (app) => app.evaluate(() => globalThis.__asked);
const mic = (win) => win.evaluate(async () => {
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); return 'ok'; } catch (e) { return e.name; }
});
const file = path.join(PROFILE, 'mic-permission.json');

(async () => {
  const errors = [];
  let app = await launch();
  let win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  check(await win.evaluate(() => window.isaDesktop?.micPermission?.get()) === 'ask', 'first run: the app will ask');

  // Always allow: asked once, remembered.
  await answerWith(app, 1);
  check(await mic(win) === 'ok', 'microphone works after "Always allow"');
  const q = await asked(app);
  check(q.length === 1 && /wants to use the microphone for voice input/.test(q[0]), `asked once with a plain question (${JSON.stringify(q)})`);
  check(await mic(win) === 'ok' && (await asked(app)).length === 1, 'not asked again');
  check(JSON.parse(fs.readFileSync(file, 'utf8')).always === true, 'remembered in mic-permission.json');
  check(await win.evaluate(async () => { try { await navigator.mediaDevices.getUserMedia({ video: true }); return 'ok'; } catch (e) { return e.name; } }) !== 'ok', 'camera is refused');
  await app.close();

  // Restart: still allowed, no question; Settings shows it with Reset.
  app = await launch();
  win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForSelector('text=Project navigation', { timeout: 30000 });
  await answerWith(app, 2);
  check(await mic(win) === 'ok' && (await asked(app)).length === 0, 'after a restart: allowed without asking');
  await win.evaluate(() => { history.pushState({}, '', '/settings#voice'); dispatchEvent(new PopStateEvent('popstate')); });
  const perm = win.getByTestId('mic-permission');
  await perm.waitFor({ timeout: 10000 });
  check(/allowed always/.test(await perm.innerText()), 'Settings → Voice: "Microphone: allowed always"');
  await win.screenshot({ path: path.join(OUT, '01-settings-allowed-always.png') });
  await perm.getByRole('button', { name: 'Reset' }).click();
  await win.waitForTimeout(300);
  check(/asks the first time/.test(await perm.innerText()) && JSON.parse(fs.readFileSync(file, 'utf8')).always === false, 'Reset: the app asks again');

  // Don't allow: refused, and the mic popover says what to do (no address-bar advice).
  check(await mic(win) === 'NotAllowedError' && (await asked(app)).length === 1, '"Don\'t allow" refuses the microphone');
  const trial = win.getByLabel('Try the microphone');
  await win.locator('div.relative', { has: trial }).getByTestId('mic').click();
  const pop = win.getByTestId('dictation');
  await pop.getByText(/not allowed/).waitFor({ timeout: 10000 });
  const said = await pop.innerText();
  check(/Allow once/.test(said) && /Windows Settings/.test(said) && !/address bar/.test(said), `refusal explained for the desktop app ("${said.replace(/\s+/g, ' ').slice(0, 120)}…")`);
  await win.screenshot({ path: path.join(OUT, '02-dont-allow.png') });
  await pop.getByRole('button', { name: 'Close' }).click();

  // Allow once: works until the app is closed, not remembered.
  await answerWith(app, 0);
  check(await mic(win) === 'ok' && (await asked(app)).length === 1, '"Allow once" works');
  check(await mic(win) === 'ok' && (await asked(app)).length === 1, '"Allow once" lasts until the app closes');
  check(JSON.parse(fs.readFileSync(file, 'utf8')).always === false && await win.evaluate(() => window.isaDesktop.micPermission.get()) === 'session', 'not remembered for the next start');
  await app.close();

  console.log(`\n${fails.length ? `FAILED ${fails.length}: ${fails.join('; ')}` : 'All desktop microphone checks passed'}`);
  if (errors.length) console.log('Page errors:', errors);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
