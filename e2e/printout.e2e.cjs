// "Upgrade existing program" from a printout: a screenshot of a CLICK ladder is read by the AI (mocked),
// every rung is reviewed with its page and how sure the reading is, confirmed, and used: the CLICK keeps its
// terminals, the rung that was hard to read is asked on the Machine description page.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/printout.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const OUT = path.join(__dirname, 'out-printout');
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const READING = {
  plc: { maker: 'AutomationDirect', model: 'CLICK C0-02DD1-D', profileId: 'click' },
  projectName: 'Pusher cell',
  tags: [
    { name: 'Start_PB', address: 'X001', description: 'Start pushbutton', io: 'input', analog: false },
    { name: 'Stop_PB', address: 'X002', description: 'Stop pushbutton (NC)', io: 'input', analog: false },
    { name: 'Part_Sensor', address: 'X005', description: 'Part at end of conveyor', io: 'input', analog: false },
    { name: 'Conveyor_Motor', address: 'Y001', description: 'Conveyor motor', io: 'output', analog: false },
    { name: 'Pusher', address: 'Y003', description: 'Pusher valve', io: 'output', analog: false },
  ],
  routines: [{ name: 'Main', rungs: [
    { number: '1', page: 1, comment: 'Run latch', branches: [[{ type: 'NO', address: 'Start_PB' }, { type: 'NC', address: 'Stop_PB' }], [{ type: 'NO', address: 'Running' }, { type: 'NC', address: 'Stop_PB' }]], outputs: [{ type: 'OUT', address: 'Running' }], confidence: 'high', doubt: '' },
    { number: '2', page: 1, comment: '', branches: [[{ type: 'NO', address: 'Running' }]], outputs: [{ type: 'OUT', address: 'Conveyor_Motor' }], confidence: 'high', doubt: '' },
    { number: '3', page: 1, comment: 'Push the part', branches: [[{ type: 'NO', address: 'Running' }, { type: 'NO', address: 'Part_Sensor' }]], outputs: [{ type: 'OUT', address: 'Pusher' }], confidence: 'low', doubt: 'the second contact could be X005 or X006' },
  ] }],
  notes: [],
};

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
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  let asked = null;
  await page.route('https://api.anthropic.com/**', async (route) => {
    asked = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(asked.model, JSON.stringify(READING)) });
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'high', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 2 }));
  });
  await page.goto(BASE + '/upgrade');

  const png = path.join(OUT, 'ladder.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
  await page.getByTestId('printout-file').setInputFiles(png);
  await page.getByTestId('printout-read').click();
  await page.getByTestId('printout-review').waitFor({ timeout: 15000 });
  const review = await page.getByTestId('printout-review').innerText();
  check(/3\s*rungs read/.test(review) && /CLICK C0-02DD1-D/.test(review), 'reading summarised');
  check(/hard to read/.test(review) && /p\.1/.test(review), 'each rung with its page and how sure');
  check(Boolean(asked) && JSON.stringify(asked.messages).includes('"type":"image"'), 'the image was sent to the AI');
  await page.screenshot({ path: path.join(OUT, '1-review.png'), fullPage: true });

  await page.getByTestId('printout-confirm').click();
  await page.getByTestId('program-found').waitFor({ timeout: 5000 });
  check(/Part_Sensor/.test(await page.getByTestId('program-found').innerText()), 'the reading becomes the program');
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-original').waitFor({ timeout: 5000 });
  const st = await page.evaluate(async () => {
    const plc = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const io = (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO;
    const spec = (await import('/src/store/useSpecStore.ts')).useSpecStore.getState();
    return { plcId: plc.plcId, addrs: io.map((p) => p.plcAddress), questions: spec.questions };
  });
  check(st.plcId === 'click', 'a CLICK printout stays on a CLICK');
  check(JSON.stringify(st.addrs) === JSON.stringify(['X001', 'X002', 'X005', 'Y001', 'Y003']), `the CLICK keeps its terminals (${st.addrs.join(' ')})`);
  check(st.questions.some((q) => /Hard to read: rung 3 on page 1/.test(q)), 'the hard-to-read rung is asked on the Machine description page');

  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nprintout e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
