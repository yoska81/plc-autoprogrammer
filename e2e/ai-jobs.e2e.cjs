// AI jobs keep running across pages, retry transient failures, can be cancelled, and fail with a
// Retry button. The AI is mocked (answers from fixtures.json, delayed / failing on purpose).
//
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/ai-jobs.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-ai-jobs/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures.json', 'utf8'));
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };
const sysText = (s) => (Array.isArray(s) ? s.map((b) => b.text).join('\n') : s);

function sse(model, text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}

const m = F.DESIGN.machine;
const ELECTRICAL = {
  explanation: 'Job-runner test design: NEMA 12 panel, 480 VAC.', components: F.DESIGN.components, ioWiring: F.DESIGN.ioWiring, notes: F.DESIGN.notes, motors: F.DESIGN.inputs.motors,
  machine: { zones: m.zones, junctionBoxes: m.junctionBoxes, motorLocations: Object.entries(m.motorLocations).map(([motorTag, location]) => ({ motorTag, location })), routing: Object.entries(m.routing).map(([deviceTag, junctionBox]) => ({ deviceTag, junctionBox })) },
};
const stageOf = (system) => (system.includes('industrial control panel') ? 'electrical' : system.includes('choosing the control equipment') ? 'equipment' : 'other');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());

  // Scripted AI: per stage, a queue of behaviours ({ delay, status, body }); default = answer at once.
  const script = { electrical: [], equipment: [] };
  const calls = { electrical: 0, equipment: 0 };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    const stage = stageOf(sysText(body.system));
    calls[stage] = (calls[stage] ?? 0) + 1;
    const b = script[stage]?.shift() ?? {};
    if (b.delay) await new Promise((res) => setTimeout(res, b.delay));
    if (b.status) {
      await route.fulfill({ status: b.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'error', error: { type: b.type ?? 'overloaded_error', message: b.message ?? 'Overloaded' } }) }).catch(() => {});
      return;
    }
    const answer = stage === 'electrical' ? ELECTRICAL : stage === 'equipment' ? F.RECOMMENDATION : {};
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, JSON.stringify(answer)) }).catch(() => {});
  });

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    const mod = await import('/src/preview/sampleProject.ts');
    const ps = await import('/src/store/useProjectsStore.ts');
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 2 }));
    mod.seedSampleProject();
    ps.useProjectsStore.getState().openProject(mod.EXAMPLE_ID);
  });
  await page.reload();
  const bar = page.getByTestId('ai-jobs');
  const explanation = () => page.evaluate(async () => (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState().explanation);

  // 1. A generation keeps running while the user visits three other pages; its result is applied.
  script.electrical.push({ delay: 4000 });
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: 'Generate New Design' }).click();
  await bar.locator('[data-job="electrical"][data-status="running"]').waitFor();
  log('Status bar:', await bar.innerText());
  for (const path of ['/io', '/hmi', '/review']) {
    await page.locator('nav, aside').getByText({ '/io': 'I/O list', '/hmi': 'HMI screens', '/review': 'Design review' }[path], { exact: true }).first().click();
    await page.waitForURL(`**${path}*`);
    check(await bar.locator('[data-job="electrical"]').count() === 1 || (await explanation()) === ELECTRICAL.explanation, `job still shown on ${path}`);
  }
  await page.locator('nav, aside').getByText('Electrical design', { exact: true }).first().click();
  await page.waitForFunction(async (exp) => (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState().explanation === exp, ELECTRICAL.explanation, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('[data-job="electrical"][data-status="running"]'));
  check(calls.electrical === 1, 'one request, not restarted by navigation');
  log('After navigating across 3 pages: design applied:', await explanation());
  await page.screenshot({ path: OUT + '01_after_navigation.png' });

  // 2. A result the page shows (equipment recommendation) waits for the page: leave, come back, it is there.
  script.equipment.push({ delay: 2500 });
  await page.goto(BASE + '/equipment');
  await page.getByRole('button', { name: /Suggest (equipment|again)/ }).click();
  await bar.locator('[data-job="equipment"]').waitFor();
  await page.locator('nav, aside').getByText('I/O list', { exact: true }).first().click();
  await page.waitForFunction(() => !document.querySelector('[data-job="equipment"][data-status="running"]'), null, { timeout: 15000 });
  await page.locator('nav, aside').getByText('Equipment', { exact: true }).first().click();
  await page.getByText(F.RECOMMENDATION.summary.slice(0, 40)).first().waitFor({ timeout: 5000 });
  log('Equipment recommendation shown after coming back');

  // 3. Transient failure: 529 then success, with "retrying (1/3)" in the status bar.
  script.electrical.push({ status: 529 }, { delay: 500 });
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: 'Generate New Design' }).click();
  await bar.getByText(/retrying \(1\/3\)/).waitFor({ timeout: 5000 });
  log('Retry shown:', await bar.innerText());
  await page.waitForFunction(() => !document.querySelector('[data-job="electrical"]'), null, { timeout: 15000 });
  check(calls.electrical === 3, `retried once (${calls.electrical} requests in total)`);

  // 4. Cancel stops a running job; the design stays as it was.
  await page.evaluate(async () => (await import('/src/store/useElectricalStore.ts')).useElectricalStore.setState({ explanation: 'before cancel' }));
  script.electrical.push({ delay: 20000 });
  await page.goto(BASE + '/electrical?tab=design'); // a finished generation switches to the Cabinet tab
  await page.getByRole('button', { name: 'Generate New Design' }).click();
  await bar.getByRole('button', { name: 'Cancel Electrical design' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-job="electrical"]'), null, { timeout: 5000 });
  check(await explanation() === 'before cancel', 'cancelled job applied nothing');
  check(await page.getByRole('button', { name: 'Generate New Design' }).isEnabled(), 'page usable after cancel');
  log('Cancel: no AI job left in the status bar');

  // 5. A final failure is plain English with Retry, which keeps the input and succeeds.
  script.electrical.push({ status: 400, type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' });
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: 'Generate New Design' }).click();
  const failed = bar.locator('[data-job="electrical"][data-status="failed"]');
  await failed.waitFor({ timeout: 5000 });
  log('Failure:', await failed.innerText());
  check(/no credit/i.test(await failed.innerText()), 'plain-English failure');
  check(await page.getByRole('alert').filter({ hasText: /no credit/i }).count() >= 1, 'failure shown on the page too');
  await bar.getByRole('button', { name: 'Retry Electrical design' }).click();
  await page.waitForFunction(async (exp) => (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState().explanation === exp, ELECTRICAL.explanation, { timeout: 10000 });
  log('Retry succeeded');
  await page.screenshot({ path: OUT + '02_end.png' });

  check(!errors.length, 'no page errors: ' + errors.join(' | '));
  log('OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
