// "Simplify blocks with AI" on the Program page (scripted AI, synthetic program): the blocks listed with a checkbox
// each (a block with an instruction of another PLC not offered, with the reason); one request per block with only
// that block; the correct rewrite kept after the simulator check, the wrong one dropped with its reason; approved;
// History has the old program.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/tidy-simplify.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

function sse(model, text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}
const NO = (address) => ({ type: 'NO', address });
const OUT = (address) => ({ type: 'OUT', address });
const REWRITE = {
  b: [{ id: 'n1', comment: 'Lamp one when both buttons are pressed', branches: [[NO('X001'), NO('X002')]], outputs: [OUT('Y001')] }],
  c: [{ id: 'n1', comment: 'Lamp two (wrong: OR)', branches: [[NO('X003')], [NO('X004')]], outputs: [OUT('Y002')] }],
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const asked = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    const content = String(body.messages[body.messages.length - 1].content);
    const id = (/\(block "([^"]*)"\)/.exec(content) || [])[1] || '';
    asked.push({ id, others: ['X006'].some((a) => content.includes(`"${a}"`)) });
    const rungs = REWRITE[id];
    const answer = { explanation: `Rewrote ${id}.`, program: rungs ? { tags: [], blocks: [{ id, name: id, description: '' }], rungs: rungs.map((r) => ({ ...r, block: id })) } : null };
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, JSON.stringify(answer)) }).catch(() => {});
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const m = await appImport('/src/preview/sampleProject.ts');
    const ps = await appImport('/src/store/useProjectsStore.ts');
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'low', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 2 }));
    m.seedSampleProject();
    ps.useProjectsStore.getState().openProject(m.EXAMPLE_ID);
  });
  await page.reload();
  await page.evaluate(async () => {
    const NO = (address) => ({ type: 'NO', address }), OUT = (address) => ({ type: 'OUT', address });
    (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().setGeneratedLadder({
      tags: [], blocks: [{ id: 'b', name: 'Lamp one', description: '' }, { id: 'c', name: 'Lamp two', description: '' }, { id: 'raw', name: 'Kept', description: '' }],
      rungs: [
        { id: 'b1', block: 'b', comment: '', branches: [[NO('X001'), NO('X002')]], outputs: [OUT('C10')] },
        { id: 'b2', block: 'b', comment: '', branches: [[NO('C10')]], outputs: [OUT('Y001')] },
        { id: 'c1', block: 'c', comment: '', branches: [[NO('X003')]], outputs: [OUT('C20')] },
        { id: 'c2', block: 'c', comment: '', branches: [[NO('C20'), NO('X004')]], outputs: [OUT('Y002')] },
        { id: 'r1', block: 'raw', comment: '', branches: [[NO('X005')]], outputs: [{ type: 'RAW', text: 'JMP L1', vendor: 'logix' }] },
        { id: 'r2', block: 'raw', comment: '', branches: [[NO('X006')]], outputs: [OUT('Y003')] },
      ],
    }, 'x', null);
  });
  const versions0 = await page.evaluate(async () => (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().versions.length);
  await page.goto(BASE + '/program');
  await page.getByTestId('simplify-explain').click();
  await page.getByRole('button', { name: 'Simplify blocks with AI…' }).click();
  const panel = page.getByRole('group', { name: 'Simplify blocks' });
  await panel.waitFor({ timeout: 10000 });
  check(await panel.getByRole('checkbox').count() === 3, 'a checkbox per block');
  check(await panel.getByRole('checkbox').nth(2).isDisabled() && await panel.getByText(/original PLC/).count() === 1, 'the block with a kept instruction is not offered, with the reason');
  await panel.getByRole('button', { name: 'Rewrite and check 2 blocks' }).click();
  const approve = page.getByRole('button', { name: 'Approve', exact: true });
  await approve.waitFor({ timeout: 120000 });
  check(asked.length === 2 && asked.every((a) => !a.others), `one request per block, only that block (${JSON.stringify(asked)})`);
  check(await page.getByText(/Lamp one: 2 → 1 rungs/).count() > 0, 'the kept rewrite is listed with its size');
  check(await page.getByText(/Lamp two: behaves differently/).count() > 0, 'the wrong one is dropped with the reason');
  await approve.click();
  const after = await page.evaluate(async () => { const st = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState(); return { ids: st.ladder.rungs.map((r) => r.id), versions: st.versions.length }; });
  check(JSON.stringify(after.ids) === JSON.stringify(['b_s1', 'c1', 'c2', 'r1', 'r2']), `the program after approval: ${after.ids.join(', ')}`);
  check(after.versions === versions0 + 1, 'the program before it is in History');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('tidy-simplify e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
