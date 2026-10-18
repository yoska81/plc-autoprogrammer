// UI responsiveness on a big project: main-thread long tasks while switching pages and using the
// heavy views (drawing set, HMI editor, program), in the production build.
//
//   npx vite --port 5204 &                 # dev server: builds the big project with the test harness
//   npx vite build && npx vite preview --port 5210 &
//   node tools/perf-ui.cjs                 # DEV=http://localhost:5204 APP=http://localhost:5210 VARIANT=rules-floor CPU=1
//
//   PROFILE=drawing node tools/perf-ui.cjs  # also prints the hottest functions of the steps whose name contains 'drawing'
//
// Prints, per step, the longest main-thread task and the total blocking time (sum of each long
// task's time over 50 ms); a step over 200 ms is marked SLOW. Exit code 0 always (a report).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const DEV = process.env.DEV || 'http://localhost:5204';
const APP = process.env.APP || 'http://localhost:5210';
const VARIANT = process.env.VARIANT || 'rules-floor';
const CPU = Number(process.env.CPU || 1);

/** Top functions by self time (and by total time) of a CPU profile. */
function printProfile(name, p) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const dt = new Map();
  p.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (p.timeDeltas[i] ?? 0) / 1000));
  const label = (n) => `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url.split('/').pop() || '').replace(/\?.*/, '')}:${n.callFrame.lineNumber + 1}`;
  const self = new Map(), total = new Map();
  const parent = new Map();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  for (const [id, ms] of dt) {
    const n = byId.get(id);
    if (/^\((idle|program|garbage collector)\)/.test(n.callFrame.functionName)) continue;
    self.set(label(n), (self.get(label(n)) ?? 0) + ms);
    const seen = new Set();
    for (let k = id; k !== undefined; k = parent.get(k)) { const l = label(byId.get(k)); if (seen.has(l)) continue; seen.add(l); total.set(l, (total.get(l) ?? 0) + ms); }
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([l, ms]) => `    ${ms.toFixed(0).padStart(6)} ms  ${l}`).join('\n');
  console.log(`  -- ${name}: self time\n${top(self, 15)}\n  -- total time\n${top(total, 25)}`);
}

(async () => {
  const browser = await chromium.launch();
  // 1. Build the project in the dev server (harness + rules engines), keep its browser storage.
  const dev = await browser.newPage();
  await dev.goto(DEV + '/spec');
  await dev.waitForLoadState('networkidle');
  const storage = await dev.evaluate(async (variant) => {
    const h = await import('/tools/harness/variants.ts');
    await h.setup(variant);
    // the big project's own HMI and program, from the rules (no AI)
    const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
    const { useProgramStore } = await import('/src/store/useProgramStore.ts');
    const { runUpdateAll } = await import('/src/spec/updateAll.ts');
    useSettingsStore.setState({ anthropicApiKey: '', stageModes: { equipment: 'quick', electrical: 'quick', hmi: 'quick', program: 'quick' } });
    useProgramStore.setState({ ladder: { ...useProgramStore.getState().ladder, rungs: [] } });
    await runUpdateAll(['hmi', 'program'], () => {});
    await new Promise((r) => setTimeout(r, 1500)); // persisted stores write
    return Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  }, VARIANT);
  await dev.close();

  // 2. The production build with that storage.
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, storage);
  await ctx.addInitScript(() => {
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const rows = [];
  const step = async (name, fn, settle = 1500) => {
    await page.evaluate(() => { window.__lt = []; });
    const prof = process.env.PROFILE && name.includes(process.env.PROFILE);
    if (prof) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
    const t0 = Date.now();
    await fn();
    await page.waitForTimeout(settle);
    if (prof) printProfile(name, (await cdp.send('Profiler.stop')).profile);
    const lt = await page.evaluate(() => window.__lt);
    const max = Math.round(Math.max(0, ...lt));
    const tbt = Math.round(lt.reduce((a, d) => a + Math.max(0, d - 50), 0));
    rows.push({ name, max, tbt, n: lt.length, ms: Date.now() - t0 - settle });
    console.log(`${max > 200 ? 'SLOW' : 'ok  '} ${name.padEnd(34)} longest ${String(max).padStart(5)} ms · blocking ${String(tbt).padStart(5)} ms · ${lt.length} long tasks`);
  };
  const nav = (label) => page.locator('nav a', { hasText: label }).first().click();

  await step('start (/spec)', () => page.goto(APP + '/spec').then(() => page.locator('nav').first().waitFor()), 3000);
  for (const [label, path] of [['I/O', 'io'], ['Electrical', 'electrical'], ['HMI', 'hmi'], ['PLC Program', 'program'], ['Simulat', 'simulate'], ['Design review', 'review'], ['Export', 'export'], ['Equipment', 'equipment']]) {
    await step(`page ${path}`, () => nav(label).catch(() => page.goto(APP + '/' + path)));
  }
  // second visits (chunks loaded): the page's own render cost
  for (const [label, path] of [['Electrical', 'electrical'], ['HMI', 'hmi'], ['PLC Program', 'program']]) {
    await step(`page ${path} (again)`, () => nav(label).catch(() => page.goto(APP + '/' + path)));
  }
  await step('electrical: drawings (cabinet tab)', async () => {
    await page.goto(APP + '/electrical?tab=cabinet');
    await page.locator('[data-testid="drawing-document"]').waitFor();
  }, 3000);
  await step('drawings: scroll to the end', async () => {
    for (let i = 0; i < 20; i++) { await page.mouse.move(900, 600); await page.mouse.wheel(0, 2500); await page.waitForTimeout(50); }
  }, 1500);
  await step('electrical: Drawings PDF (build)', async () => {
    await page.goto(APP + '/electrical');
    await page.waitForTimeout(1000);
    const dl = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
    await page.getByRole('button', { name: 'Drawings PDF' }).click();
    await dl;
  }, 500);
  await step('hmi: open editor', async () => {
    await nav('HMI').catch(() => page.goto(APP + '/hmi'));
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Edit/ }).first().click().catch(() => {});
  }, 2000);
  await step('program: scroll the rungs', async () => {
    await nav('PLC Program').catch(() => page.goto(APP + '/program'));
    await page.waitForTimeout(800);
    for (let i = 0; i < 15; i++) { await page.mouse.wheel(0, 2000); await page.waitForTimeout(50); }
  }, 1500);
  await step('io: type in the filter', async () => {
    await nav('I/O').catch(() => page.goto(APP + '/io'));
    await page.waitForTimeout(800);
    const f = page.getByPlaceholder(/filter|search/i).first();
    await f.click().catch(() => {});
    await page.keyboard.type('motor', { delay: 60 });
  }, 1000);

  const slow = rows.filter((r) => r.max > 200);
  console.log(`\n${VARIANT} · CPU ×${CPU} · ${slow.length} step(s) over 200 ms${errors.length ? ` · page errors: ${errors.join(' | ')}` : ''}`);
  if (process.env.JSON) require('node:fs').writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
  await browser.close();
})();
