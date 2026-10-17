// Q&A on the example project: questions the stages asked are on Design review without visiting their
// pages; "Change" keeps the saved answer until Save (Cancel leaves it); answering an HMI question
// makes only the HMI and the program out of date; using the AI's assumption stales nothing.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/qa-round.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  // Straight to Design review: no stage page visited in this session.
  await page.goto(BASE + '/review');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.waitForTimeout(1200);
  const qs = await page.evaluate(async () => {
    const { useQuestionStore } = await import('/src/components/questions/useQuestionStore.ts');
    const list = useQuestionStore.getState().byProject.p_example ?? [];
    return { total: list.length, bySource: list.reduce((m, q) => ({ ...m, [q.source]: (m[q.source] ?? 0) + 1 }), {}) };
  });
  log('Questions registered without visiting the stage pages:', JSON.stringify(qs));
  check(qs.bySource.electrical > 0 && qs.bySource.hmi > 0, 'electrical and HMI questions registered globally');
  check(await page.locator('li[data-question]').count() > 0, 'Design review lists questions to answer');

  // Answer an HMI question: only HMI and program go out of date.
  const stages = () => page.evaluate(async () => { const s = (await import('/src/spec/useStages.ts')).stagesNow(); return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status])); });
  const before = await stages();
  const hmiQ = page.locator('li[data-question^="hmi"]').first();
  const id = await hmiQ.getAttribute('data-question');
  await hmiQ.locator('textarea').fill('Main screen first.');
  await hmiQ.getByRole('button', { name: 'Save answer' }).click();
  await page.waitForTimeout(400);
  const after = await stages();
  log('Stages before / after an HMI answer:', JSON.stringify(before), JSON.stringify(after));
  check(['equipment', 'io', 'electrical'].every((k) => after[k] === before[k]) && after.hmi === 'stale' && after.program === 'stale', 'an HMI answer stales only HMI and program');

  // "Change" (on the description page, which lists answered questions too): the saved answer stays until Save; Cancel leaves it.
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(800);
  const card = page.locator(`li[data-question="${id}"]`);
  await card.getByRole('button', { name: 'Change' }).click();
  const status = () => page.evaluate(async (qid) => { const { useQuestionStore } = await import('/src/components/questions/useQuestionStore.ts'); const q = useQuestionStore.getState().byProject.p_example.find((x) => x.id === qid); return `${q.status}:${q.answer}`; }, id);
  check(await status() === 'answered:Main screen first.', 'Change keeps the saved answer while editing');
  await card.locator('textarea').fill('Alarms first.');
  await card.getByRole('button', { name: 'Cancel' }).click();
  check(await status() === 'answered:Main screen first.', 'Cancel leaves the saved answer');
  check(/Main screen first\./.test(await card.innerText()), 'the saved answer is shown again');

  // The AI's assumption (already used by the design) stales nothing.
  await page.evaluate(async () => {
    const { useStageStore } = await import('/src/store/useStageStore.ts');
    const { useSpecStore } = await import('/src/store/useSpecStore.ts');
    const { fingerprint } = await import('/src/spec/types.ts');
    const spec = useSpecStore.getState().sections;
    for (const st of ['equipment', 'io', 'electrical', 'hmi', 'program']) useStageStore.getState().markGenerated(st, { specFp: fingerprint(spec), spec });
  });
  const fresh = await stages();
  await page.goto(BASE + '/review');
  await page.waitForTimeout(800);
  const elQ = page.locator('li[data-question^="electrical"]').filter({ has: page.getByRole('button', { name: "Don't know — use the AI's assumption" }) }).first();
  await elQ.getByRole('button', { name: "Don't know — use the AI's assumption" }).click();
  await page.waitForTimeout(400);
  const assumed = await stages();
  check(Object.keys(fresh).every((k) => assumed[k] === fresh[k]), `using the AI's assumption stales nothing (${JSON.stringify(assumed)})`);

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('Q&A: global questions, Change/Cancel, per-stage staleness');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
