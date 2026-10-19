// Side manager's QA, LOW items on the PLC pages (1366 × 768, the example project):
//   - the Program page says "Build program from my project", never "Generate Program";
//   - undo of a hand edit survives leaving the Program page and coming back;
//   - the Simulate live-logic legend fits its pane (it wraps instead of being cut off).
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/program-qa-low.e2e.cjs
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

  // Wording.
  await page.goto(BASE + '/program');
  await page.waitForTimeout(1000);
  const text = await page.locator('main').innerText();
  check(!/Generate Program|press Generate\b/.test(text), 'no "Generate Program" on the Program page');

  // Undo survives leaving the page: delete an element by hand, go to the I/O list, come back, Undo.
  const rungs = () => page.evaluate(async () => { const { useProgramStore } = await import('/src/store/useProgramStore.ts'); return JSON.stringify(useProgramStore.getState().ladder.rungs); });
  const before = await rungs();
  const cell = page.locator('div.overflow-auto div[role="button"][title]').nth(3);
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.getByRole('dialog').filter({ hasText: /Edit (condition|output)/ }).getByRole('button', { name: /Delete/ }).click();
  check(await rungs() !== before, 'a hand edit changed the program');
  check(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), 'Undo available right after the edit');
  // In-app navigation (the sidebar), as a user leaves the page; a reload starts a new session.
  await page.getByRole('link', { name: 'I/O list', exact: true }).first().click();
  await page.waitForURL(/\/io$/);
  await page.waitForTimeout(500);
  await page.goBack();
  await page.waitForURL(/\/program$/);
  await page.waitForTimeout(1000);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  check(await undo.isEnabled(), 'Undo is still available after leaving the Program page');
  await undo.click();
  check(await rungs() === before, 'Undo puts the hand edit back');

  // Simulate legend inside its pane.
  await page.goto(BASE + '/simulate');
  await page.waitForSelector('[data-testid=live-legend]');
  const fit = await page.evaluate(() => {
    const l = document.querySelector('[data-testid=live-legend]');
    const pane = l.parentElement.parentElement.getBoundingClientRect();
    return [...l.children].every((c) => { const r = c.getBoundingClientRect(); return r.left >= pane.left - 1 && r.right <= pane.right + 1; });
  });
  check(fit, 'the live-logic legend fits its pane at 1366 px');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`program-qa-low e2e: ${fails.length} failed`); process.exit(1); }
  console.log('program-qa-low e2e passed');
})();
