// The Upgrade page's "Remake it for another PLC" card on a read-only Yaskawa program (synthetic fixture): when every
// PLC gives the same result it is said once, in plain words, then just the buttons; Structured Text named plainly.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/upgrade-remake.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 1000 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/import?tab=program');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('program-file').setInputFiles({ name: 'demo_mp.YMW7', mimeType: 'application/octet-stream', buffer: fs.readFileSync(path.join(__dirname, '../src/plc/import/__fixtures__/demo_mp.YMW7')) });
  await page.getByTestId('program-found').waitFor({ timeout: 60000 });
  await page.getByTestId('program-apply').click();
  const card = page.getByTestId('upgrade-choose-plc');
  await card.waitFor({ timeout: 60000 });
  const same = (await page.getByTestId('upgrade-remake-same').textContent()) || '';
  // (A drawing called with SEE may convert or stay to redo by hand: the wording, not the count, is checked.)
  check(/^On every PLC: \d+ of \d+ rungs convert; to redo by hand: .*\b1 instruction the app can't read\.$/.test(same), `said once, in plain words: "${same}"`);
  check(await card.getByText(/×|SEE/).count() === 0, 'no "SEE ×1" shorthand');
  check(await card.getByRole('button', { name: 'Remake for Generic Structured Text (any IEC PLC)' }).count() === 1, 'Structured Text named plainly');
  check(await card.getByRole('button', { name: /^Remake for / }).count() >= 5, 'one button per PLC');
  check(!(await card.getAttribute('class')).includes('border-brand'), 'a neutral card, not a warning-coloured border');
  // Its order on the page: the simplify card first.
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => /^upgrade-(simplify|choose-plc)$/.test(t)));
  check(order.join() === 'upgrade-simplify,upgrade-choose-plc', `simplify & explain, then remake (${order.join(' → ')})`);
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('upgrade-remake e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
