// "Add comments" on the Program page: the example with some comments blanked gets every blank filled as a
// proposal (no API key: from the I/O names and the cross-reference); approved, only comments changed, the comments
// already there are kept, and the program before it is in History.
//   npm run dev -- --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/tidy-comments.e2e.cjs
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
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  // No key: the rules write the comments. Every other rung comment blanked.
  const before = await page.evaluate(async () => {
    (await appImport('/src/store/useSettingsStore.ts')).useSettingsStore.setState({ anthropicApiKey: '' });
    const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore;
    const l = structuredClone(st.getState().ladder);
    l.rungs.forEach((r, i) => { if (i % 2 === 0) r.comment = ''; });
    st.getState().setGeneratedLadder(l, 'x', null);
    return { ladder: l, versions: st.getState().versions.length };
  });
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Change', exact: true }).first().click();
  await page.getByRole('group', { name: 'Tidy up' }).getByRole('button', { name: 'Add comments' }).click();
  const approve = page.getByRole('button', { name: 'Approve', exact: true });
  await approve.waitFor({ timeout: 20000 });
  check(await page.getByText(/^Comments added: \d+ rung comments?/).count() > 0, 'the proposal says what was added');
  await approve.click();
  const after = await page.evaluate(async () => {
    const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    return { ladder: st.ladder, versions: st.versions.length, origin: st.ladderOrigin };
  });
  const strip = (l) => JSON.stringify(l.rungs.map((r) => ({ ...r, comment: '' })));
  check(strip(after.ladder) === strip(before.ladder), 'the logic is the same');
  check(after.ladder.rungs.every((r) => r.comment.trim()), 'every rung has a comment');
  check(after.ladder.rungs.every((r, i) => !before.ladder.rungs[i].comment || r.comment === before.ladder.rungs[i].comment), 'the comments already there are kept');
  check(after.versions === before.versions + 1, 'the program before it is in History');
  check(after.origin === 'user', 'approved, the program is the user\'s (Update all will not rebuild it away)');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('tidy-comments e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
