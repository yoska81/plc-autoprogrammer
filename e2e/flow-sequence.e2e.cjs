// Program flow with a step sequence: the example project with a 4-step cycle added (step 0 idle, 10 wait for a part,
// 20 push, 30 return; the example's own sensors). Drawn as steps and diamonds with the loop back; in Test, the step
// now is green, what it waits for is amber and names what is still OFF, an input moves it to the next step, and a
// step that lasts longer than the limit turns red with the reason; the program's own ladder follows.
//   npm run dev -- --port 5217 &  ;  BASE_URL=http://localhost:5217 node e2e/flow-sequence.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = __dirname + '/out-flow/';
fs.mkdirSync(OUT, { recursive: true });
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
  // the cycle: C2 Cycle_Running, X004 part at the end, X006 pusher retracted, X005 pusher extended; DS1150 the step
  await page.evaluate(async () => {
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const NO = (a) => ({ type: 'NO', address: a }), NC = (a) => ({ type: 'NC', address: a });
    const AT = (n) => ({ type: 'CMP', left: 'DS1150', op: '==', right: String(n) });
    const GO = (n) => ({ type: 'COPY', source: String(n), dest: 'DS1150' });
    const cycle = [
      { id: 'q0', block: 'cycle', comment: 'Cycle not running: step 0 (idle)', branches: [[NC('C2')]], outputs: [GO(0)] },
      { id: 'q1', block: 'cycle', comment: 'Cycle start: step 10 — Wait for part', branches: [[NO('C2'), AT(0)]], outputs: [GO(10)] },
      { id: 'q4', block: 'cycle', comment: 'Step 30 — Return: done when X006 ON → step 10', branches: [[NO('C2'), AT(30), NO('X006')]], outputs: [GO(10)] },
      { id: 'q3', block: 'cycle', comment: 'Step 20 — Push: done when X005 ON → step 30', branches: [[NO('C2'), AT(20), NO('X005')]], outputs: [GO(30)] },
      { id: 'q2', block: 'cycle', comment: 'Step 10 — Wait for part: done when X004 ON → step 20', branches: [[NO('C2'), AT(10), NO('X004')]], outputs: [GO(20)] },
      { id: 'q5', block: 'cycle', comment: 'Push request: in step 20', branches: [[AT(20)]], outputs: [{ type: 'OUT', address: 'C3' }] },
    ];
    const s = useProgramStore.getState();
    s.editLadder({ ...s.ladder, rungs: [...s.ladder.rungs.filter((r) => r.block !== 'cycle' && !/^Automatic push request/.test(r.comment)), ...cycle], blocks: [...(s.ladder.blocks ?? []), { id: 'cycle', name: 'Automatic cycle', description: 'Step sequence' }] });
  });

  await page.goto(BASE + '/flow');
  const canvas = page.getByTestId('flow-canvas');
  await canvas.waitFor();
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();
  await page.waitForTimeout(400);
  const steps = await canvas.locator('[data-node*=":step:"]').allTextContents();
  check(steps.length === 4 && /0 · Idle/.test(steps[0]) && /10 · Wait for part/.test(steps[1]) && /20 · Push/.test(steps[2]) && /30 · Return/.test(steps[3]), `the steps drawn in order (${steps.map((s) => s.slice(0, 22)).join(' | ')})`);
  check(await canvas.locator('[data-node*=":step:20"]').textContent().then((t) => /Turn ON Push_Request/.test(t)), 'step 20 says what it turns on');
  check(await canvas.locator('[data-node*=":any:"]').count() === 1, 'from any step: not running → idle');
  await page.screenshot({ path: OUT + 's1-sequence.png' });

  // Test: idle, then running → step 10 waiting for the part
  await page.getByTestId('flow-mode-test').click();
  await page.getByTestId('flow-stuck').fill('1');
  await page.waitForTimeout(400);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:0"]').textContent()), 'test: step 0 now (not running)');
  // Cycle_Running is set by the program (Start / Stop seal-in): shown, not switched
  await canvas.locator('[data-node*=":any:"]').click();
  check(await page.getByTestId('flow-switches').locator('.grid button', { hasText: 'Cycle_Running' }).count() === 0 && /Cycle_Running/.test(await page.getByTestId('flow-driven').innerText()), 'a bit the program sets is shown, not switched');
  // the pusher at home (retracted), as a machine starts
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();
  await page.waitForTimeout(300);
  await canvas.locator('[data-node*=":dec:30:"]').click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Pusher retracted/ }).click();
  // start the machine as at the machine: safety OK, Stop button closed, press Start
  await page.getByTestId('flow-functions').getByRole('button', { name: /Safety & modes/ }).click();
  await page.waitForTimeout(300);
  await canvas.locator('[data-node*=":if:"]', { hasText: 'Safety OK from' }).first().click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /E-Stop OK/ }).click();
  await canvas.locator('[data-node*=":if:"]', { hasText: 'Cycle running' }).first().click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Stop Button|Stop_Button/ }).first().click();
  await page.getByTestId('flow-switches').locator('[data-press]', { hasText: 'press' }).nth(await page.getByTestId('flow-switches').locator('[data-switch]').evaluateAll((els) => els.findIndex((e) => /Start Button|Start_Button/.test(e.textContent)))).click();
  await page.waitForTimeout(500);
  check(/Cycle_Running/.test(await page.getByTestId('flow-driven').innerText()) && await page.getByTestId('flow-driven').locator('.bg-green-50', { hasText: 'Cycle_Running' }).count() === 1, 'Start pressed: Cycle_Running ON');
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();
  await page.waitForTimeout(400);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:10"]').textContent()), 'running: step 10 now');
  await page.waitForTimeout(1500);
  check(!/STUCK/.test(await canvas.locator('[data-node$=":step:10"]').textContent()), 'a step that only waits (for the part) is not red, past the limit');
  const wait10 = canvas.locator('[data-node*=":dec:10:"]');
  check(/WAITING/.test(await wait10.textContent()), 'step 10\'s diamond: waiting');
  await wait10.click();
  check(/Waiting [\d.]+ s in step 10 for: Part at end photo-eye ON/.test(await page.getByTestId('flow-why').innerText()), 'what it waits for, named');
  await page.screenshot({ path: OUT + 's2-waiting.png' });

  // the part comes: step 20
  await page.getByTestId('flow-switches').getByRole('button', { name: /Part at end/ }).click();
  await page.waitForTimeout(500);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:20"]').textContent()), 'the part: step 20 now');
  // the pusher does not extend: red after the 1 s limit, on the step and its diamond, with the reason
  await page.waitForTimeout(1600);
  const d20 = canvas.locator('[data-node*=":dec:20:"]');
  check(/STUCK/.test(await d20.textContent()) && /STUCK/.test(await canvas.locator('[data-node$=":step:20"]').textContent()), 'stuck in step 20: red on the step and its diamond');
  await d20.click();
  const why = await page.getByTestId('flow-why').innerText();
  check(/Stuck [\d.]+ s in step 20 for: Pusher extended ON \(more than 1 s\)/.test(why), `the reason: ${why}`);
  check(await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).locator('.bg-red-500').count() === 1, 'the function marked red in the list');
  await page.screenshot({ path: OUT + 's3-stuck.png' });

  // the pusher extends (before its 3 s fault time), then retracts: back to step 10 (the loop)
  await canvas.locator('[data-node*=":dec:30:"]').click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Pusher retracted/ }).click();
  await d20.click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Pusher extended/ }).click();
  await page.waitForTimeout(400);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:30"]').textContent()) && !/STUCK/.test(await canvas.locator('[data-node$=":step:20"]').textContent()), 'extended: step 30 now, red gone');
  // the part was pushed off the belt: the photo-eye clears
  await canvas.locator('[data-node*=":dec:10:"]').click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Part at end/ }).click();
  await d20.click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Pusher extended/ }).click();
  await canvas.locator('[data-node*=":dec:30:"]').click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Pusher retracted/ }).click();
  await page.waitForTimeout(400);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:10"]').textContent()), 'retracted: back to step 10 (the loop)');

  // the real fault: the next part comes, step 20, the pusher never leaves home: the program's own pusher-fault alarm
  // (3 s) latches and stops the cycle: the alarm red in the Alarms function, the cycle at step 0
  await canvas.locator('[data-node*=":dec:10:"]').click();
  await page.getByTestId('flow-switches').getByRole('button', { name: /Part at end/ }).click();
  await page.waitForTimeout(4500);
  check(/NOW/.test(await canvas.locator('[data-node$=":step:0"]').textContent()), 'the pusher fault stopped the cycle: step 0');
  check(await page.getByTestId('flow-functions').getByRole('button', { name: /^.*Alarms/ }).locator('.bg-red-500').count() === 1, 'Alarms marked red in the list');
  await page.getByTestId('flow-functions').getByRole('button', { name: /Alarms/ }).click();
  await page.waitForTimeout(400);
  const alarm = canvas.locator('[data-node*=":if:"]', { hasText: 'Pusher fault' }).first();
  check(/ALARM/.test(await alarm.textContent()), 'the pusher fault rung red on the diagram, tagged ALARM');
  await alarm.click();
  check(/Alarm ON: ALM_Pusher_Fault \(latched until reset\)/.test(await page.getByTestId('flow-why').innerText()), 'its reason: the alarm, latched');
  await page.screenshot({ path: OUT + 's4-alarm.png' });
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();

  // zoomed out: the function's box shows its step
  for (let i = 0; i < 8; i++) await page.locator('button[title="Zoom out"]').click();
  await page.waitForTimeout(300);
  const box = await canvas.locator('[data-diagram="cycle"]').textContent().catch(() => '');
  check(/step 0/.test(box), `zoomed out: the cycle's box says its step (${box.replace(/\s+/g, ' ')})`);

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nflow-sequence e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nflow-sequence e2e: all passed');
})();
