// A machine that keeps its own controller (a Yaskawa MP3000 read from its MPE720 project): Equipment shows that
// controller, with no CLICK chooser and no "cannot hold the I/O list"; a new PLC only on "Choose a new PLC instead".
//   npm run dev -- --port 5224 &  ;  BASE_URL=http://localhost:5224 node e2e/equipment-kept.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5224';
const FIXTURE = path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'demo_mp.YMW7');
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/upgrade');
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  await page.getByTestId('program-found').waitFor({ timeout: 20000 });
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 20000 });
  const note = await page.getByTestId('upgrade-cpu-note').innerText();
  check(/programmed in MPE720/.test(note) && /Teach the app MPE720/.test(note) && !/cannot program it yet/.test(note), 'the Upgrade note says how the app will put changes into MPE720');

  await page.goto(BASE + '/equipment');
  const kept = page.getByTestId('equipment-kept');
  await kept.waitFor({ timeout: 10000 });
  const text = await kept.innerText();
  check(/keeps its own controller/.test(text) && /Yaskawa/.test(text) && /demo_mp\.YMW7/.test(text), `the machine's controller shown (${text.split('\n')[1]})`);
  check(await page.getByText('PLC CPU', { exact: true }).count() === 0, 'no CPU chooser until asked');
  check(await page.getByText(/cannot hold the I\/O list/).count() === 0, 'no "cannot hold the I/O list"');
  const stage = await page.evaluate(async () => (await appImport('/src/spec/useStages.ts')).stagesNow().equipment);
  check(stage.status === 'ready', `the Equipment step done: the controller is there (${stage.status})`);
  await page.getByTestId('equipment-replace-kept').click();
  await page.getByText('PLC CPU', { exact: true }).waitFor({ timeout: 5000 });
  check(/replaces the controller/.test(await kept.innerText()), 'Choose a new PLC instead: the chooser, with what a new PLC means');
  await page.screenshot({ path: path.join(__dirname, 'out-flow', 'equipment-kept.png') });
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `equipment-kept e2e: ${fails.length} failed` : 'equipment-kept e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
