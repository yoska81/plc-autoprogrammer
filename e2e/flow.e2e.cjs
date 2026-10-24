// Program flow: the example project as flow diagrams, one per function, on one zoomable map; a box clicked shows its
// ladder beside it with what each symbol means; Test (the simulator): an input switched on moves the program and
// the diagram shows it; search finds a name; the whole map zooms out to one box per function.
//   npm run dev -- --port 5216 &  ;  BASE_URL=http://localhost:5216 node e2e/flow.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = __dirname + '/out-flow/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 920 } })).newPage();
  await useAppModules(page);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  await page.goto(BASE + '/flow');
  const canvas = page.getByTestId('flow-canvas');
  await canvas.waitFor();
  await page.waitForTimeout(500);
  const fns = await page.getByTestId('flow-functions').locator('button').allInnerTexts();
  check(fns.some((t) => /Safety & modes/.test(t)) && fns.some((t) => /Conveyor/.test(t)) && fns.some((t) => /Pusher/.test(t)), 'one diagram per function, listed');
  check(await page.getByTestId('flow-minimap').isVisible(), 'the minimap');
  await page.screenshot({ path: OUT + '01-whole-program.png' });

  // open a function: its boxes drawn
  await page.getByTestId('flow-functions').getByRole('button', { name: /Pusher/ }).click();
  await page.waitForTimeout(400);
  const boxes = await canvas.locator('[data-node]').count();
  check(boxes > 4, `the function's boxes drawn (${boxes})`);
  await page.screenshot({ path: OUT + '02-pusher.png' });

  // click a diamond: its ladder beside it, the symbols explained
  await canvas.locator('[data-node*=":if:"]').first().click();
  await page.getByTestId('flow-ladder').locator('text=TRUE').or(page.getByTestId('flow-ladder').locator('text=FALSE')).first().waitFor();
  const learn = await page.getByTestId('flow-learn').innerText();
  check(/Normally (open|closed) contact/.test(learn) && /OR/.test(learn), 'the ladder beside it, the symbols explained');
  await page.screenshot({ path: OUT + '03-selected-with-ladder.png' });

  // Test: the simulator runs; switching an input changes the diagram
  await page.getByTestId('flow-mode-test').click();
  await page.waitForTimeout(600);
  await page.getByTestId('flow-functions').getByRole('button', { name: /Safety & modes/ }).click();
  await page.waitForTimeout(300);
  await canvas.locator('[data-node*=":if:"]', { hasText: 'Safety OK from' }).first().click();
  const sw = page.getByTestId('flow-switches').locator('button').first();
  await sw.waitFor({ timeout: 5000 }).catch(async () => { await page.screenshot({ path: OUT + '04-no-switches.png' }); });
  const before = await sw.innerText();
  await sw.click();
  await page.waitForTimeout(400);
  const after = await sw.innerText();
  check(before !== after && /ON|OFF/.test(after), `an input switched in the test (${before.trim()} → ${after.trim()})`);
  const green = await canvas.locator('[data-node] polygon[stroke="#34d399"], [data-node] rect[stroke="#34d399"]').count();
  check(green > 0, `true rungs lit green on the diagram (${green})`);
  await page.screenshot({ path: OUT + '04-test.png' });

  // search
  await page.getByTestId('flow-find').fill('Conveyor');
  await page.getByTestId('flow-find').press('Enter');
  await page.waitForTimeout(400);
  check(/\d+ found/.test(await page.locator('header').innerText()), 'search finds the name');
  await page.screenshot({ path: OUT + '05-search.png' });

  // zoomed far out: one box per function
  await page.getByTestId('flow-functions').getByRole('button', { name: 'Whole program' }).click();
  for (let i = 0; i < 6; i++) await page.locator('button[title="Zoom out"]').click();
  await page.waitForTimeout(300);
  check(await canvas.locator('[data-diagram]').count() > 0, 'zoomed out: each function one box');
  await page.screenshot({ path: OUT + '06-zoomed-out.png' });

  // window options: full screen, the ladder bigger, the ladder panel maximized and hidden
  await page.getByTestId('flow-functions').getByRole('button', { name: /Pusher/ }).click();
  await canvas.locator('[data-node*=":if:"]').first().click();
  const w0 = (await page.getByTestId('flow-ladder').boundingBox()).height;
  await page.getByTestId('flow-ladder-bigger').click(); await page.getByTestId('flow-ladder-bigger').click();
  const w1 = (await page.getByTestId('flow-ladder').boundingBox()).height;
  check(w1 > w0, `the ladder bigger (${Math.round(w0)} → ${Math.round(w1)} px)`);
  await page.getByTestId('flow-ladder-max').click();
  await page.waitForTimeout(200);
  check((await page.getByTestId('flow-side').boundingBox()).width > 1000 && !(await canvas.isVisible()), 'the ladder panel maximized');
  await page.screenshot({ path: OUT + '07-ladder-big.png' });
  await page.getByTestId('flow-ladder-max').click();
  await page.getByTestId('flow-toggle-side').click();
  check(await page.getByTestId('flow-side').count() === 0, 'the ladder panel hidden');
  await page.getByTestId('flow-toggle-side').click();
  await page.getByTestId('flow-full').click();
  await page.waitForTimeout(300);
  const fb = await page.getByTestId('flow-page').boundingBox();
  check(fb.width >= 1490 && fb.y <= 1, `full screen (${Math.round(fb.width)}×${Math.round(fb.height)})`);
  await page.screenshot({ path: OUT + '08-full-screen.png' });

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nflow e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nflow e2e: all passed');
})();
