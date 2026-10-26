// Program flow, Edit: the example with a 4-step cycle. A step renamed, one added after step 20 (25, the arrows
// re-linked) and checked in the simulator, deleted and put back with Undo; a rung added and deleted; every change
// listed in plain words; the ladder editor beside the box; an AI proposal shown in plain words and approved (no AI
// key needed: the proposal is set as the AI's answer would set it).
//   npm run dev -- --port 5220 &  ;  BASE_URL=http://localhost:5220 node e2e/flow-edit.e2e.cjs
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
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 920 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
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
  const ladder = () => page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().ladder);

  await page.goto(BASE + '/flow');
  const canvas = page.getByTestId('flow-canvas');
  await canvas.waitFor();
  await page.getByTestId('flow-mode-edit').click();
  await page.getByTestId('flow-functions').getByRole('button', { name: /Automatic cycle/ }).click();
  await page.waitForTimeout(300);

  // rename step 20
  await canvas.locator('[data-node$=":step:20"]').click();
  await page.getByTestId('flow-step-name').fill('Push the part');
  await page.getByTestId('flow-step-tools').getByRole('button', { name: 'Rename' }).click();
  await page.waitForTimeout(300);
  check(/20 · Push the part/.test(await canvas.locator('[data-node$=":step:20"]').textContent()), 'step 20 renamed on the diagram');
  check(/Changed: Step 20 — Push the part/.test(await page.getByTestId('flow-changes').innerText()), 'the change listed in plain words');

  // add a step after 20: 25, selected, the arrows re-linked
  await page.getByTestId('flow-add-step').click();
  await page.waitForTimeout(400);
  check(await canvas.locator('[data-node$=":step:25"]').count() === 1, 'step 25 added on the diagram');
  check(/Step 25 "New step" added after step 20; it goes on to step 30/.test(await page.getByTestId('flow-edit-note').innerText()), 'what was done, said');
  const l1 = await ladder();
  check(l1.rungs.find((r) => r.id === 'q3').outputs[0].source === '25', 'step 20 now goes to 25');
  await page.screenshot({ path: OUT + 'e1-step-added.png' });

  // the edited cycle in the simulator: 10 → 20 → 25 → 30 (no input needed in 25: it goes on at once)
  const steps = await page.evaluate(async () => {
    const { createSimulator } = await appImport('/src/plc/sim/engine.ts');
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const sim = createSimulator(useProgramStore.getState().ladder);
    const out = [];
    sim.setInput('X001', true); sim.setInput('X003', true); sim.setInput('X006', true); sim.run(100); sim.setInput('X002', true); sim.run(50); sim.setInput('X002', false); sim.run(100);
    out.push(sim.readWord('DS1150'));
    sim.setInput('X004', true); sim.run(50); out.push(sim.readWord('DS1150'));
    sim.setInput('X006', false); sim.setInput('X005', true); sim.run(50); out.push(sim.readWord('DS1150'));
    return out;
  });
  check(JSON.stringify(steps) === '[10,20,30]', `the edited cycle runs: 10, 20, then through 25 to 30 (${steps})`);

  // delete step 25, then Undo puts it back
  await canvas.locator('[data-node$=":step:25"]').click();
  await page.getByTestId('flow-delete-step').click();
  await page.waitForTimeout(300);
  check(await canvas.locator('[data-node$=":step:25"]').count() === 0 && (await ladder()).rungs.find((r) => r.id === 'q3').outputs[0].source === '30', 'step 25 deleted: 20 goes to 30 again');
  await page.getByTestId('flow-undo').click();
  await page.waitForTimeout(300);
  check(await canvas.locator('[data-node$=":step:25"]').count() === 1, 'Undo: step 25 back');

  // a rung added after the conveyor's first, then deleted
  await page.getByTestId('flow-functions').getByRole('button', { name: /Conveyor/ }).click();
  await page.waitForTimeout(300);
  const before = (await ladder()).rungs.length;
  await canvas.locator('[data-node*=":if:"]').first().click();
  await page.getByTestId('flow-add-rung').click();
  await page.waitForTimeout(300);
  const l2 = await ladder();
  check(l2.rungs.length === before + 1 && l2.rungs.some((r) => r.comment === 'New rung: say what it does' && r.block === 'conveyor'), 'a rung added in the Conveyor function');
  check(await page.getByTestId('flow-ladder-edit').locator('text=New rung').count() > 0, 'the new rung in the ladder editor beside it');
  await page.screenshot({ path: OUT + 'e2-rung-added.png' });
  await page.getByTestId('flow-delete-rung').click();
  await page.waitForTimeout(300);
  check((await ladder()).rungs.length === before, 'the rung deleted');

  // the AI: without a key it says so; a proposal (as the AI's answer sets it) shown in plain words, then approved
  check(await page.getByTestId('flow-ai-send').isDisabled() && /Add your AI key/.test(await page.getByTestId('flow-ai').innerText()), 'no AI key: Ask the AI says how to add it');
  await page.evaluate(async () => {
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const s = useProgramStore.getState();
    const program = { ...s.ladder, rungs: s.ladder.rungs.map((r) => (r.id === 'q5' ? { ...r, outputs: [...r.outputs, { type: 'OUT', address: 'Y004' }] } : r)) };
    s.setProposal({ program, explanation: 'Step 20 also turns on Y004.', reasoning: null });
  });
  await page.getByTestId('flow-proposal').waitFor();
  const prop = await page.getByTestId('flow-proposal').innerText();
  check(/The AI proposes \(1 change\)/.test(prop) && /Changed: Push request: in step 20/.test(prop) && /Turn ON Y004/.test(prop), 'the AI\'s proposal in plain words, before → after');
  await page.screenshot({ path: OUT + 'e3-ai-proposal.png' });
  await page.getByTestId('flow-approve').click();
  await page.waitForTimeout(300);
  check((await ladder()).rungs.find((r) => r.id === 'q5').outputs.some((o) => o.address === 'Y004'), 'approved: in the program');
  check(await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().versions.some((v) => /Before (edits in Program flow|AI change)/.test(v.label))), 'the program before is kept in History');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  if (fails.length) { console.log(`\nflow-edit e2e: ${fails.length} failed`); process.exit(1); }
  console.log('\nflow-edit e2e: all passed');
})();
