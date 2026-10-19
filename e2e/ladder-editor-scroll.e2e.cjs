// The rung element editor stays open while the ladder scrolls (side manager's QA, item 2): it moves with its
// element and closes only when the element scrolls out of the window.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/ladder-editor-scroll.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  // A cold dev server compiles the app on the first load: allow it time (the waits below are for elements, not delays).
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/program');
  await page.waitForTimeout(1000);
  const cell = page.locator('div.overflow-auto div[role="button"][title]').nth(3);
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  const editor = page.getByRole('dialog').filter({ hasText: /Edit (condition|output)/ });
  check(await editor.isVisible(), 'the element editor opens');
  const top0 = (await editor.boundingBox()).y;
  const cell0 = (await cell.boundingBox()).y;
  // Scroll the ladder a little: the editor follows its element.
  await cell.evaluate((el) => { let p = el.parentElement; while (p && getComputedStyle(p).overflowY !== 'auto') p = p.parentElement; p.scrollTop += 60; });
  await page.waitForTimeout(200);
  check(await editor.isVisible(), 'still open after scrolling the ladder');
  const moved = (await cell.boundingBox()).y - cell0, followed = (await editor.boundingBox()).y - top0;
  check(Math.abs(moved) > 20 && Math.abs(followed - moved) < 2, `it moves with its element (element ${moved.toFixed(0)} px, editor ${followed.toFixed(0)} px)`);
  // Scroll it out of the window: the editor closes.
  await cell.evaluate((el) => { let p = el.parentElement; while (p && getComputedStyle(p).overflowY !== 'auto') p = p.parentElement; p.scrollTop += 5000; });
  await page.waitForTimeout(200);
  check(!(await editor.isVisible()), 'closes when its element leaves the window');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`ladder-editor-scroll e2e: ${fails.length} failed`); process.exit(1); }
  console.log('ladder-editor-scroll e2e passed');
})();
