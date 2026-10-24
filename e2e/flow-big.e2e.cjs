// Program flow on big and imported programs: a generated program of thousands of rungs (hundreds of functions) and
// the Yaskawa MPE720 demo (.YMW7) loaded as the project's program. The page opens quickly, the whole map zooms out to
// one box per function, a function opens, search finds across the program, and the screen stays responsive.
//   npm run dev -- --port 5219 &  ;  BASE_URL=http://localhost:5219 node e2e/flow-big.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = __dirname + '/out-flow/';
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 920 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // a big program: 120 parts × 60 rungs
  const rungs = await page.evaluate(async () => {
    const { importProgramFiles } = await appImport('/src/plc/import/index.ts');
    const { plcopen } = await appImport('/src/plc/import/__fixtures__/bigPrograms.ts');
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const program = importProgramFiles([{ name: 'big.xml', text: plcopen(120, 240) }]).program.program;
    useProgramStore.getState().editLadder(program);
    return program.rungs.length;
  });
  let t = Date.now();
  await page.goto(BASE + '/flow');
  const canvas = page.getByTestId('flow-canvas');
  await canvas.waitFor({ timeout: 30000 });
  const open = Date.now() - t;
  check(open < 8000, `the page with ${rungs} rungs opens in ${(open / 1000).toFixed(1)} s`);
  const fns = await page.getByTestId('flow-functions').locator('button').count();
  check(fns > 100, `${fns - 1} functions listed`);
  check(await canvas.locator('[data-diagram]').count() > 0 && await canvas.locator('[data-node]').count() === 0, 'zoomed out: one box per function, no rung drawn');
  await page.screenshot({ path: OUT + 'b1-big-map.png' });

  // open one function in the middle of the list; time to draw it
  t = Date.now();
  await page.getByTestId('flow-functions').locator('button').nth(60).click();
  await canvas.locator('[data-node]').first().waitFor({ timeout: 10000 });
  const drawn = await canvas.locator('[data-node]').count();
  check(Date.now() - t < 3000 && drawn > 0 && drawn < 800, `a function opens in ${((Date.now() - t) / 1000).toFixed(1)} s, ${drawn} boxes drawn (only what is on screen)`);
  await page.screenshot({ path: OUT + 'b2-big-function.png' });

  // zoom and drag stay quick
  t = Date.now();
  for (let i = 0; i < 6; i++) await page.locator('button[title="Zoom in"]').click();
  for (let i = 0; i < 6; i++) await page.locator('button[title="Zoom out"]').click();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 300, box.y + 300); await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 120, { steps: 10 }); await page.mouse.up();
  check(Date.now() - t < 6000, `12 zooms and a drag in ${((Date.now() - t) / 1000).toFixed(1)} s`);

  // search across the whole program
  t = Date.now();
  await page.getByTestId('flow-find').fill('P77_v3');
  await page.getByTestId('flow-find').press('Enter');
  await page.waitForTimeout(300);
  const found = await page.locator('header').innerText();
  check(/[1-9]\d* found/.test(found) && Date.now() - t < 4000, `search across ${rungs} rungs: ${/(\d+) found/.exec(found)?.[1]} found in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  check(/P77/.test(await page.getByTestId('flow-side').innerText()), 'Enter: the first match opened, its ladder beside it');
  const selectedNode = () => page.evaluate(() => document.querySelector('[data-testid="flow-canvas"] [stroke="#b45309"]')?.closest('[data-node]')?.getAttribute('data-node') ?? null);
  const first = await selectedNode();
  await page.getByTestId('flow-find').press('Enter');
  await page.waitForTimeout(300);
  const second = await selectedNode();
  check(first && second && first !== second, `Enter again: the next match (${first} → ${second})`);
  await page.screenshot({ path: OUT + 'b3-big-search.png' });

  // the Yaskawa demo (MPE720 .YMW7)
  const ymw = fs.readFileSync(path.join(__dirname, '..', 'src', 'plc', 'import', '__fixtures__', 'demo_mp.YMW7'));
  const yr = await page.evaluate(async (bytes) => {
    const { importProgramFiles } = await appImport('/src/plc/import/index.ts');
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const program = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: new Uint8Array(bytes) }]).program.program;
    useProgramStore.getState().editLadder(program);
    return { rungs: program.rungs.length, blocks: (program.blocks ?? []).map((b) => b.name) };
  }, [...ymw]);
  await page.goto(BASE + '/flow');
  await canvas.waitFor();
  await page.getByTestId('flow-functions').locator('button').first().click();
  await canvas.locator('[data-node]').first().waitFor({ timeout: 10000 });
  check(await canvas.locator('[data-node]').count() > 0, `the Yaskawa program drawn (${yr.rungs} rungs; ${yr.blocks.join(', ')})`);
  await canvas.locator('[data-node]').first().click();
  check(await page.getByTestId('flow-ladder').locator('text=/TRUE|FALSE/').count() > 0, 'its ladder beside it');
  await page.screenshot({ path: OUT + 'b4-yaskawa.png' });
  // Test mode on the imported program (its own addresses): runs without errors
  await page.getByTestId('flow-mode-test').click();
  await page.waitForTimeout(800);
  await canvas.locator('[data-node]').first().click();
  check(await page.getByTestId('flow-ladder').locator('text=/TRUE|FALSE/').count() > 0, 'Test on the Yaskawa program runs');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nflow-big e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nflow-big e2e: all passed');
})();
