// "Simplify & explain" is easy to find: right after a program is read on the Upgrade page a next-step card leads to
// the Program page with the Tidy up group in view, and from there one click opens Reorganize. The Program toolbar has
// the same button; while a proposal waits the group stays visible, disabled, and says why.
// Synthetic L5X (no customer data).
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/simplify-discover.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
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
  await page.goto(BASE + '/import?tab=program');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/import?tab=program');
  const text = await page.evaluate(async () => (await appImport('/src/plc/import/__fixtures__/bigPrograms.ts')).l5x(4, 32));
  await page.getByTestId('program-file').setInputFiles({ name: 'Line.L5X', mimeType: 'application/xml', buffer: Buffer.from(text) });
  await page.getByTestId('program-found').waitFor({ timeout: 60000 });
  await page.getByTestId('program-apply').click();

  // The next step, right after "Use this program".
  const card = page.getByTestId('upgrade-simplify');
  await card.waitFor({ timeout: 60000 });
  check(await card.isVisible(), 'the Upgrade page offers "Simplify & explain this program" next');
  await card.getByRole('link', { name: 'Simplify & explain this program' }).click();
  await page.waitForURL(/\/program\?tidy=1/);
  const tidy = page.getByTestId('tidy-up');
  await tidy.waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  check(await tidy.isVisible() && await tidy.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'the Program page opens with Tidy up in view');
  check(await tidy.getByText('Adds a plain-words note on every rung, then you can simplify.').count() === 1, 'the hint says what Add comments does');
  // One click to Reorganize.
  await tidy.getByRole('button', { name: 'Reorganize program…' }).click();
  check(await page.getByRole('group', { name: 'Reorganize' }).isVisible(), 'one click reaches Reorganize');

  // The toolbar button from another tab of the panel.
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  check(await page.getByTestId('tidy-up').count() === 0, '(the Build tab has no Tidy up)');
  await page.getByTestId('simplify-explain').click();
  await tidy.waitFor({ timeout: 10000 });
  check(await tidy.isVisible(), 'the toolbar "Simplify & explain" opens Tidy up');

  // While a proposal waits: still there, disabled, with the reason.
  await page.evaluate(async () => {
    const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    st.setProposal({ program: { ...st.ladder, rungs: st.ladder.rungs.slice(1) }, explanation: 'test', reasoning: null });
  });
  await page.getByTestId('tidy-wait').waitFor({ timeout: 10000 });
  check(await tidy.getByRole('button', { name: 'Add comments' }).isDisabled() && await tidy.getByRole('button', { name: 'Reorganize program…' }).isDisabled(), 'while a proposal waits Tidy up stays, disabled');
  check(await page.getByTestId('tidy-wait').textContent() === 'Approve or reject the current proposal first.', 'and says why');
  await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().rejectProposal());

  // On a phone: the button switches to the Build / Change pane.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE + '/program');
  await page.getByRole('tab', { name: 'Program' }).click().catch(() => {});
  await page.getByTestId('simplify-explain').click();
  await page.waitForTimeout(800);
  check(await page.getByTestId('tidy-up').isVisible(), 'on a phone the button shows Tidy up');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('simplify-discover e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
