// A big imported program (a generated L5X: 500 programs, 25,000 rungs, 2,048 I/O; about 7M characters saved, well
// over what localStorage holds; no customer data) is read,
// made the project without freezing the page, and is all there after a reload (kept in IndexedDB: it does not
// fit in localStorage). Clearing localStorage still starts the app clean.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/big-program.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  try {
    await page.goto(BASE + '/import?tab=program');
    const text = await page.evaluate(async () => (await appImport('/src/plc/import/__fixtures__/bigPrograms.ts')).l5x(500, 1024));
    const rungsOf = () => page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder.rungs.length);
    // the longest gap between two frames while the program is made the project
    await page.evaluate(() => { window.__gap = 0; let last = performance.now(); const tick = () => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - last); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });

    await page.getByTestId('program-file').setInputFiles({ name: 'Big_Line.L5X', mimeType: 'application/xml', buffer: Buffer.from(text) });
    await page.getByTestId('program-found').waitFor({ timeout: 120000 });
    await page.getByTestId('program-apply').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid=program-apply]')?.disabled, null, { timeout: 120000 });
    const rungs = await rungsOf();
    const gap = await page.evaluate(() => window.__gap);
    log(`${(text.length / 1e6).toFixed(1)} MB, ${rungs} rungs; longest frame gap ${(gap / 1000).toFixed(1)} s`);
    check(rungs >= 25000, 'the big program is the project');
    check(gap < 3000, 'the page did not freeze for seconds');
    // the stores write a moment after the last change (appStorage.ts): wait for it, not a fixed time
    const inLs = await page.waitForFunction(() => localStorage.getItem('plc-program-store') === '\u0000in-indexeddb', null, { timeout: 10000 }).then(() => true, () => false);
    const size = await page.evaluate(async () => (await appImport('/src/lib/appStorage.ts')).appStorage.getItem('plc-program-store')?.length ?? 0);
    log(`program store: ${(size / 1e6).toFixed(1)}M characters`);
    check(inLs, 'too big for localStorage: kept in IndexedDB (a placeholder in localStorage)');

    // closing while the program (only IndexedDB holds it) is being written: the browser asks to stay
    const dialogs = [];
    const onDialog = (d) => { dialogs.push(d.type()); void d.dismiss(); };
    page.on('dialog', onDialog);
    await page.evaluate(async () => {
      const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore;
      st.setState({ ladder: { ...st.getState().ladder } }); // a change: written again in a moment
      location.reload();
    });
    await page.waitForTimeout(500);
    page.off('dialog', onDialog);
    check(dialogs.includes('beforeunload'), `leaving while it is being written asks first (${dialogs.join() || 'no dialog'})`);
    // another tab of the app sees what this one writes
    const other = await context.newPage();
    await useAppModules(other);
    await other.goto(BASE + '/spec');
    await other.waitForSelector('nav');
    await page.evaluate(async () => (await appImport('/src/lib/appStorage.ts')).appStorage.setItem('plc-project-data:probe', '{"from":"first tab"}'));
    await other.waitForTimeout(300);
    check(await other.evaluate(async () => (await appImport('/src/lib/appStorage.ts')).appStorage.getItem('plc-project-data:probe')) === '{"from":"first tab"}', 'another tab reads the copy this tab saved (not an old one)');
    await other.close();
    await page.evaluate(async () => { const m = await appImport('/src/lib/appStorage.ts'); m.appStorage.removeItem('plc-project-data:probe'); await m.flushAppStorage(); });
    await page.reload();
    await page.waitForSelector('nav');
    check(await rungsOf() === rungs, 'after a reload the whole program is there');
    const original = await page.evaluate(async () => Object.keys((await appImport('/src/store/useDraftStore.ts')).useDraftStore.getState().drafts));
    check(original.includes('upgrade.original'), 'and its original (for "Original vs now")');
    check(!/could not be saved/.test(await page.locator('body').innerText()), 'no "could not be saved" notice');

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('nav');
    check(await rungsOf() < 1000, 'localStorage cleared: the app starts clean');
    check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  } catch (e) {
    fails.push(String(e));
    console.log('FAILED:', e.message);
  }
  await browser.close();
  console.log(fails.length ? `\n${fails.length} failed` : '\nbig-program e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
