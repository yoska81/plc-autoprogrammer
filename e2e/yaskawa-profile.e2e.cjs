// Yaskawa MP3000 / MP2000 is a real PLC choice now (it was "coming soon"): on the example project, picking it on
// the PLC page gives a Yaskawa CPU that holds its I/O, the Program page names memory by MP registers (MB / MW, MPE720's own form), and
// the I/O, Program and Simulate pages open without page errors.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/yaskawa-profile.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  await page.goto(BASE + '/plc');
  const button = page.getByRole('button', { name: /MP3000 \/ MP2000/ });
  check(await button.isEnabled(), 'Yaskawa can be chosen (no longer "coming soon")');
  await button.click();
  await page.waitForTimeout(500);
  const plc = await page.evaluate(async () => { const { useProjectStore } = await import('/src/store/useProjectStore.ts'); const s = useProjectStore.getState(); return `${s.plcId} ${s.cpuId} ${s.modules.join(',')}`; });
  // The first Yaskawa CPU that holds the example's 6 inputs / 3 outputs: the MP2300's built-in I/O (LIO modules come with the catalog).
  check(/^yaskawa-mp JEPMC-MP2300-E/.test(plc) && !/C0-/.test(plc), `the PLC is an MP2300 with no CLICK modules (${plc})`);
  const io = await page.evaluate(async () => { const [{ useIOStore }, { ioAddresses }, { getProfile }, { useProjectStore }] = await Promise.all([import('/src/store/useIOStore.ts'), import('/src/plc/core/ioChange.ts'), import('/src/plc/core/profiles/index.ts'), import('/src/store/useProjectStore.ts')]);
    const a = ioAddresses(useIOStore.getState().projectIO); const s = useProjectStore.getState();
    return [...a.values()].map((x) => getProfile(s.plcId).ioTag(x, [], s.cpuId)).join(','); });
  check(/^IB00000,IB00001/.test(io) && /OB00000/.test(io), `the I/O on IB / OB registers (${io})`);

  await page.goto(BASE + '/program');
  await page.waitForSelector('div.overflow-auto div[role="button"][title]');
  const ladder = await page.locator('main').innerText();
  check(/\bMB\d{6}\b/.test(ladder) || /\bMW\d{5}\b/.test(ladder), 'the ladder names memory by MP registers (MB000000 / MW01000)');
  for (const path of ['/io', '/simulate']) { await page.goto(BASE + path); await page.waitForTimeout(1500); }
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`yaskawa-profile e2e: ${fails.length} failed`); process.exit(1); }
  console.log('yaskawa-profile e2e passed');
})();
