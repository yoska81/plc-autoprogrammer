// The Yaskawa path end to end: an MPE720 project uploaded and used; Add comments (without an AI key: the rules'
// comments) writes a plain-words note on its rungs; Simplify offers its blocks (a big one in parts); Explain and
// Program flow show it with the comments beside the boxes.
//   npm run dev -- --port 5227 &  ;  BASE_URL=http://localhost:5227 node e2e/yaskawa-understand.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules, waitApp } = require('./lib/appModule.cjs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5227';
const FIXTURE = path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'demo_mp.YMW7');
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/upgrade');
  await page.getByTestId('program-file').setInputFiles(FIXTURE);
  await page.getByTestId('program-found').waitFor({ timeout: 20000 });
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 20000 });
  const prog = () => page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState());
  const p0 = await prog();
  check(p0.ladder.rungs.length > 0, `uploaded: ${p0.ladder.rungs.length} rungs in ${(p0.ladder.blocks ?? []).length} blocks`);
  const blank0 = p0.ladder.rungs.filter((r) => !r.comment.trim()).length;

  // Add comments (no key: the rules'), approved
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Change', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add comments', exact: true }).click();
  await waitApp(page, async () => Boolean((await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().proposal), { timeout: 30000 });
  await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().applyProposal());
  const p1 = await prog();
  const blank1 = p1.ladder.rungs.filter((r) => !r.comment.trim()).length;
  check(blank1 < blank0 || blank0 === 0, `comments added (${blank0} → ${blank1} rungs without one)`);
  check(JSON.stringify(p1.ladder.rungs.map((r) => [r.branches, r.outputs])) === JSON.stringify(p0.ladder.rungs.map((r) => [r.branches, r.outputs])), 'only comments changed: the logic is the same');

  // Simplify offers the blocks (the AI does the rewrite; here: what it is offered)
  const cands = await page.evaluate(async () => (await appImport('/src/plc/tidy/rewrite.ts')).rewriteCandidates((await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder));
  check(cands.some((c) => c.ok), `Simplify offers ${cands.filter((c) => c.ok).length} of ${cands.length} blocks (${cands.filter((c) => !c.ok).map((c) => `${c.name}: ${c.why}`).join('; ') || 'all'})`);

  // Program flow: the diagrams, with the comments beside the boxes
  await page.goto(BASE + '/flow');
  await page.getByTestId('flow-canvas').waitFor({ timeout: 10000 });
  await page.getByTestId('flow-functions').getByRole('button').first().click();
  await page.waitForTimeout(800);
  check(await page.locator('[data-node]').count() > 0 && await page.locator('[data-note]').count() > 0, `Program flow: boxes and // comments (${await page.locator('[data-node]').count()} boxes, ${await page.locator('[data-note]').count()} comments)`);
  await page.screenshot({ path: path.join(__dirname, 'out-flow', 'yaskawa-flow.png') });
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `yaskawa-understand e2e: ${fails.length} failed` : 'yaskawa-understand e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
