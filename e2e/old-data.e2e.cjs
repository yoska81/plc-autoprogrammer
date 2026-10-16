// Projects saved by older versions still open: e2e/old-data/<commit>.json is the browser storage that the
// example project of that commit left behind. Each is opened as the active project and as a stored
// project switched to from the menu; every page must render without errors.
//
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/old-data.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const DIR = __dirname + '/old-data/';
const log = (...a) => console.log('•', ...a);
const ROUTES = ['/spec', '/project', '/equipment', '/io', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine',
  '/electrical?tab=picture', '/electrical?tab=machining', '/hmi', '/program', '/simulate', '/export'];

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(DIR + file, 'utf8'));
    for (const how of ['active', 'switched']) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
      page.on('dialog', (d) => d.accept());
      await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
      await page.goto(BASE + '/settings');
      await page.evaluate(({ data, how }) => {
        localStorage.clear();
        if (how === 'active') { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); return; }
        // Stored as a non-active project: its stores' persisted state under plc-project-data:<id>.
        const keys = { spec: 'plc-spec-store', io: 'plc-io-store', plc: 'plc-project-store', program: 'plc-program-store', electrical: 'plc-electrical-store', hmi: 'plc-hmi-store', stages: 'plc-stage-store' };
        const snap = {};
        for (const [k, key] of Object.entries(keys)) if (data[key]) snap[k] = JSON.parse(data[key]).state;
        localStorage.setItem('plc-project-data:p_old', JSON.stringify(snap));
        localStorage.setItem('plc-projects', JSON.stringify({ state: { projects: [{ id: 'p_new', name: 'Current', createdAt: '' }, { id: 'p_old', name: 'Old project', createdAt: '' }], activeId: 'p_new' }, version: 0 }));
      }, { data, how });
      await page.goto(BASE + '/spec');
      if (how === 'switched') {
        await page.locator('select[aria-label="Open project"]').selectOption('p_old');
        await page.waitForTimeout(300);
      }
      let pages = 0;
      for (const r of ROUTES) {
        if (how === 'switched') await page.locator('nav a', { hasText: { '/spec': 'Machine description', '/project': 'Project data', '/equipment': 'Equipment', '/io': 'I/O list', '/hmi': 'HMI screens', '/program': 'PLC program', '/simulate': 'Simulation', '/export': 'Deliverables' }[r] ?? 'Electrical design' }).first().click();
        else await page.goto(BASE + r);
        await page.waitForTimeout(700);
        const blank = (await page.locator('main').innerText().catch(() => '')).trim().length < 20;
        if (blank) errors.push(`${r}: page is blank`);
        pages++;
      }
      if (how === 'active') {
        for (const name of ['Excel report', 'Engineering package', 'Download everything']) {
          const ok = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name, exact: true }).click()]).then(() => true, (e) => e.message.split('\n')[0]);
          if (ok !== true) errors.push(`${name}: ${ok}`);
        }
      }
      const io = how === 'active' ? await page.evaluate(() => JSON.parse(localStorage.getItem('plc-io-store') || '{}').state?.projectIO?.length) : '';
      log(`${file} (${how}): ${pages} pages, ${errors.length} error(s)${io !== '' ? `, ${io} I/O points` : ''}`);
      if (errors.length) failures.push([file, how, [...new Set(errors)].slice(0, 6)]);
      await page.close();
    }
  }
  await browser.close();
  for (const [f, how, e] of failures) console.log(`  ${f} (${how}):\n   - ${e.join('\n   - ')}`);
  if (failures.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
