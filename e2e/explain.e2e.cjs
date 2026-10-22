// The Explain tab on the Program page: one section per block from the program itself, a block's rung range shows it
// in the ladder, the PDF and Word downloads; "Explain with AI" needs a key. Also in the deliverables' Export page.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/explain.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async () => (await appImport('/src/store/useSettingsStore.ts')).useSettingsStore.setState({ anthropicApiKey: '' }));
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Explain', exact: true }).click();
  const panel = page.getByTestId('explain-panel');
  await panel.waitFor({ timeout: 20000 });
  const blocks = await page.evaluate(async () => ((await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder.blocks || []).length);
  check(await page.getByTestId('explain-block').count() === blocks, `one section per block (${blocks})`);
  const pusher = page.getByRole('region', { name: 'Block Pusher' });
  check(await pusher.getByText('Push Timeout (T1)', { exact: false }).count() > 0, 'the Pusher section lists its timers');
  check(await panel.getByRole('button', { name: 'Explain with AI' }).isDisabled(), 'Explain with AI needs a key');
  await pusher.getByRole('button', { name: /rungs 15–18/ }).click();
  await page.waitForTimeout(300);
  check(await page.getByText(/Working on\s+Pusher/).count() > 0, 'the rung range shows the block in the ladder');
  for (const [label, ext] of [['Download PDF', 'pdf'], ['Download Word', 'docx']]) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), panel.getByRole('button', { name: label }).click()]);
    check(dl.suggestedFilename().endsWith(`_how_the_program_works.${ext}`), `${label}: ${dl.suggestedFilename()}`);
  }
  await page.goto(BASE + '/export');
  await page.getByRole('button', { name: 'Program listing PDF' }).waitFor({ timeout: 20000 });
  check(await page.getByRole('button', { name: 'How the program works (Word)' }).count() === 1, 'the Export page has it too');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('explain e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
