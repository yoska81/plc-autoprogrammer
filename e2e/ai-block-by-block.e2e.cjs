// A change asked for a program too big for one AI answer (3,000 rungs): no "too big" refusal; the AI (faked here)
// picks the blocks, each part goes alone with progress, one proposal at the end with every part's change.
//   npm run dev -- --port 5225 &  ;  BASE_URL=http://localhost:5225 node e2e/ai-block-by-block.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules, waitApp } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5225';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };
const sysText = (s) => (Array.isArray(s) ? s.map((b) => b.text).join('\n') : s);
const textOf = (c) => (Array.isArray(c) ? c.map((b) => b.text ?? '').join('\n') : c);
function sse(model, text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const calls = { pick: 0, parts: [] };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    const sys = sysText(body.system);
    let answer;
    if (/You route a change request/.test(sys)) {
      calls.pick++;
      answer = { blocks: ['cycle'], all: false, why: 'the request is about the automatic cycle' };
    } else {
      const content = textOf(body.messages[body.messages.length - 1].content);
      const json = content.split('Current program (JSON, includes any manual edits):\n')[1].split('\n\nIssues the app')[0];
      const prog = JSON.parse(json);
      calls.parts.push(prog.rungs.length);
      answer = { explanation: `Added "checked" to ${prog.rungs.length} rung comments.`, program: { ...prog, rungs: prog.rungs.map((r) => ({ ...r, comment: `${r.comment} (checked)` })) } };
    }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, JSON.stringify(answer)) });
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const mod = await appImport('/src/preview/sampleProject.ts');
    const ps = await appImport('/src/store/useProjectsStore.ts');
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o', showExperimental: true }, version: 2 }));
    mod.seedSampleProject();
    ps.useProjectsStore.getState().openProject(mod.EXAMPLE_ID);
  });
  await page.reload();
  // a big program: 3 blocks, 3,000 rungs
  await page.evaluate(async () => {
    const { useProgramStore } = await appImport('/src/store/useProgramStore.ts');
    const rung = (id, block, n) => ({ id, block, comment: `Rung ${id} keeps the station ${n} going`, branches: [[{ type: 'NO', address: `C${n}` }]], outputs: [{ type: 'OUT', address: `C${n + 1}` }] });
    const rungs = [...Array.from({ length: 1000 }, (_, i) => rung(`s${i}`, 'safety', i)), ...Array.from({ length: 1000 }, (_, i) => rung(`k${i}`, 'cycle', 1000 + i)), ...Array.from({ length: 1000 }, (_, i) => rung(`h${i}`, 'hmi', 2000 + i))];
    useProgramStore.getState().editLadder({ tags: [], rungs, blocks: [{ id: 'safety', name: 'Safety', description: '' }, { id: 'cycle', name: 'Automatic cycle', description: '' }, { id: 'hmi', name: 'HMI', description: '' }] });
  });
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Change', exact: true }).first().click();
  await page.getByLabel('Describe a problem or change').fill('Check every rung of the automatic cycle');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const job = page.locator('[data-job="program-revise"]');
  await job.waitFor({ timeout: 10000 });
  const progress = await job.innerText().catch(() => '');
  await waitApp(page, async () => Boolean((await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState().proposal), { timeout: 60000 }).catch(() => {});
  const st = await page.evaluate(async () => {
    const s = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    if (!s.proposal) return { n: 0, checked: [], chat: s.chat.map((c) => c.text).join(' | '), rungs: s.ladder.rungs.filter((r) => r.comment.endsWith('(checked)')).length };
    return { n: s.proposal.program.rungs.length, checked: s.proposal.program.rungs.filter((r) => r.comment.endsWith('(checked)')).map((r) => r.block), chat: s.chat.map((c) => c.text).join(' | ') };
  });
  check(!/too big for the AI/.test(st.chat), 'no "too big" refusal');
  check(calls.pick === 1 && calls.parts.length >= 2 && calls.parts.reduce((a, b) => a + b, 0) === 1000, `the cycle block only, in ${calls.parts.length} parts (${calls.parts.join(', ')} rungs)`);
  check(/Part \d+ of \d+|finding the blocks/.test(progress), `progress shown (${progress.replace(/\s+/g, ' ').slice(0, 80)})`);
  check(st.n === 3000 && st.checked.length === 1000 && st.checked.every((b) => b === 'cycle'), 'one proposal: every rung there, only the cycle changed');
  check(/Changed block by block/.test(st.chat) && /the request is about the automatic cycle/.test(st.chat), 'what was done, said');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `ai-block-by-block e2e: ${fails.length} failed` : 'ai-block-by-block e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
