// Convert existing drawings: New project → "From existing drawings / program" → Import (Drawings tab) → upload a Chinese-style drawing set
// (PDF + DXF, e2e/fixtures/convert/) → the AI (mocked) reads it → description, conversion table to North
// America, rebuild with the engine → function kept. Checks what is sent to the AI (the PDF as a document,
// the DXF as text with its Chinese labels), the old → new table, the questions on the Machine description
// page, the rebuilt design (480 V, reversing starter, every original I/O) and that nothing is lost.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/convert.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-convert/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const FIX = __dirname + '/fixtures/convert/';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

const M = (tag, description, power, start, zone) => ({ tag, description, power, unit: 'hp', powerGiven: true, start, vertical: false, zone });
let MACHINE = null;
const requests = [];
function reply(system) {
  if (system.includes('taking over an existing machine from its electrical drawings')) return MACHINE;
  if (system.includes('checks a machine control design')) return { findings: [], summary: 'No further findings.' };
  if (system.includes('choosing the control equipment')) return {
    summary: 'CLICK PLC for the converted sorting conveyor.', estimatedIO: { digitalInputs: 9, digitalOutputs: 6, analogInputs: 0, analogOutputs: 0, motionAxes: 0 },
    plc: { profileId: 'click', cpuId: 'C0-12DD1E-D', why: 'Enough I/O with a module, Ethernet.' }, modules: [{ partNumber: 'C0-16ND3', quantity: 1, why: 'Inputs' }],
    hmi: null, alternatives: [], cautions: [],
  };
  if (system.includes("describe the machine's electrical load and safety")) return {
    motors: [M('M1', 'Conveyor belt, forward and reverse', 1.5, 'reversing', 'Conveyor'), M('M2', 'Coolant pump', 1, 'dol', 'Pump')],
    estops: 1, guardDoors: [], lightCurtains: [], zones: ['Conveyor', 'Pump'], interfaces: [], questions: [],
  };
  if (system.includes('You name things on an operator touch panel')) return { machineName: 'Sorting Conveyor', actuators: [], states: [], questions: [] };
  if (system.includes("You describe a machine's automatic cycle as a STEP SEQUENCE")) return { explanation: 'Rules keep their default cycle.', steps: [], questions: [] };
  throw new Error('unknown prompt: ' + system.slice(0, 100));
}
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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    let text;
    try { text = JSON.stringify(reply(sysText(body.system))); } catch (e) { fails.push('AI mock: ' + e.message); text = '{}'; }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, text) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE);
  // The mocked AI answers with what a good AI reads from this set (src/convert/__fixtures__/chineseConveyor.ts).
  MACHINE = await page.evaluate(async () => (await import('/src/convert/__fixtures__/chineseConveyor.ts')).CHINESE_CONVEYOR);
  // one reading the AI is unsure of: it must become a question unless the user confirms it
  MACHINE.io = MACHINE.io.map((p) => (p.address === 'X7' ? { ...p, confidence: 'low' } : p));
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'high', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/spec');

  // New project → From existing drawings
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByTestId('start-option').getByRole('button', { name: /^From existing drawings \/ program/ }).click();
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Sorting Conveyor Retrofit');
  await page.getByRole('button', { name: 'Continue to the import →' }).click();
  await page.waitForURL(/\/import$/);
  const limits = await page.getByTestId('import-limits').innerText();
  check(/DWG/.test(limits) && /\.ACD/.test(limits) && /\.gx3/.test(limits) && /\.ckp/.test(limits), 'upload says plainly what can\'t be read');
  log('Start option: "From existing drawings / program" → /import (Drawings | Program)');

  // Upload and read
  await page.getByTestId('convert-files').setInputFiles([FIX + 'sorting_conveyor_drawings.pdf', FIX + 'E-03_PLC_IO.dxf']);
  await page.getByRole('button', { name: 'Read the drawings' }).click();
  await page.getByTestId('convert-recognised').waitFor({ timeout: 60000 });
  const derive = requests.find((r) => sysText(r.system).includes('taking over an existing machine'));
  const content = derive?.messages[0].content ?? [];
  check(content.some((b) => b.type === 'document' && b.source?.media_type === 'application/pdf'), 'the PDF goes to the AI as a document');
  const dxfText = content.find((b) => b.type === 'text' && b.text.includes('E-03_PLC_IO.dxf (DXF export'))?.text ?? '';
  check(/启动/.test(dxfText) && /TAG1=KM1/.test(dxfText) && /急停为单回路/.test(dxfText), 'the DXF goes as text with its Chinese labels and attributes');
  log('Sent to the AI:', content.map((b) => b.type).join(', '), '| DXF text:', dxfText.split('\n')[2]);
  const rec = await page.getByTestId('convert-recognised').innerText();
  check(/15 I\/O · 23 parts · 2 motors/.test(rec) && /3~380V 50Hz/.test(rec) && /FX3U/.test(rec), 'what the drawings show: counts, supply, PLC');
  // Review: every reading with its source and confidence; correct one, leave the low-confidence X7 unconfirmed
  const ioRows = page.getByTestId('review-io').locator('tbody tr');
  check(await ioRows.count() === 15 && /sheet 4, column 2/.test(await ioRows.first().innerText()) && /high/.test(await ioRows.first().innerText()), 'review: each I/O with its source and confidence');
  check(/sheet 1, column 2/.test(await page.getByTestId('review-parts').innerText()), 'review: each part with its source');
  check(/1 low-confidence reading not confirmed/.test(await page.getByTestId('review-status').innerText()), 'review: the low-confidence reading is counted');
  const x1 = page.getByLabel('Function of X1', { exact: true });
  await x1.fill('Start pushbutton (启动)');
  await x1.blur();
  await page.waitForTimeout(200);
  check(/✓/.test(await ioRows.nth(1).innerText()), 'review: a correction confirms the reading');
  check(/re-validate/.test(rec), 'review: safety marked re-validate');
  await page.getByTestId('convert-recognised').screenshot({ path: OUT + '00_review.png' });

  // Description written from the drawings
  const desc = await page.getByTestId('convert-description').innerText();
  check(/Sorting conveyor/.test(desc) && /pusher/i.test(desc), 'description written from the drawings');

  // Conversion table
  const table = page.getByTestId('convert-table');
  const row = async (tag) => (await table.locator('tr', { has: page.locator('td:first-child', { hasText: new RegExp(`^${tag}$`) }) }).first().innerText()).replace(/\s+/g, ' ');
  const qf1 = await row('QF1'), km1 = await row('KM1'), fr1 = await row('FR1'), sb2 = await row('SB2');
  log('QF1:', qf1); log('KM1:', km1); log('FR1:', fr1); log('SB2:', sb2);
  check(/CB1/.test(qf1) && /UL 489/.test(qf1) && /Equivalent/.test(qf1), 'QF1 → CB1, a UL 489 breaker');
  check(/K1/.test(km1) && /Coil 220VAC → 24/.test(km1), 'KM1 → K1 with the coil change named');
  check(/OL1/.test(fr1) && /480 V/.test(fr1) && /Chosen by the design/.test(fr1), 'FR1 → OL1, set by the design for the new current');
  check(/PB1/.test(sb2) && /Chosen by the design/.test(sb2), 'SB2 → PB1');
  const tableText = await table.innerText();
  check(/480 VAC 3-phase 60 Hz/.test(tableText) && /M1: 1\.1 kW → 1\.5 HP/.test(tableText), 'supply and motors converted');
  await table.screenshot({ path: OUT + '01_convert_table.png' });

  // Build the converted design with the engine
  await page.getByTestId('convert-build').click();
  // (waitForFunction can't await an import: poll)
  for (let t = 0; t < 360; t++) {
    if (await page.evaluate(async () => Boolean((await import('/src/spec/updateRun.ts')).useUpdateRun.getState().finishedAt))) break;
    await page.waitForTimeout(500);
  }
  const run = await page.evaluate(async () => (await import('/src/spec/updateRun.ts')).useUpdateRun.getState().results.map((r) => `${r.step}:${r.status}${r.status === 'done' ? '' : ` (${r.message})`}`));
  log('Build:', run.join(' | '));
  check(run.length === 4 && run.every((r) => /:done$/.test(r) || /^hmi:skipped \(No HMI chosen/.test(r)), 'equipment, electrical and program built (no HMI: the old machine has none)');
  await page.getByRole('button', { name: 'Close', exact: true }).click().catch(() => {});
  const after = await page.evaluate(async () => {
    const el = (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState();
    const io = (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO;
    const info = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState().info;
    return { region: info.region, supply: el.design?.inputs.supply, motors: el.design?.inputs.motors.map((m) => `${m.tag} ${m.hp}HP ${m.starter}${m.reversing ? ' rev' : ''}`), io: io.length, parts: el.design?.components.length };
  });
  log('New design:', JSON.stringify(after));
  check(after.region === 'US' && after.supply === '480VAC-3PH', 'new design on 480 V for the US');
  check(after.io === 15, 'every original I/O point in the new I/O list');

  // Function kept
  const kept = page.getByTestId('convert-kept');
  await kept.waitFor();
  const keptText = await kept.innerText();
  log('Function kept:', keptText.split('\n')[1]);
  check(!/✗ Missing/.test(keptText), `nothing missing in the new design:\n${keptText.split('\n').filter((l) => /Missing/.test(l)).join('\n')}`);
  check((keptText.match(/✓ Kept/g) ?? []).length >= 15 + 2, 'I/O and motors kept');
  check(/re-validate/.test(keptText), 'safety functions marked re-validate');
  await kept.screenshot({ path: OUT + '02_function_kept.png' });

  // Questions on the Machine description page; the review shows no lost function
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(800);
  const spec = await page.locator('body').innerText();
  fs.writeFileSync(OUT + 'spec_page.txt', spec);
  check(/pusher take to extend/i.test(spec) && /50 Hz/.test(spec) && /single-channel/.test(spec), 'questions on the Machine description page (drawings + conversion)');
  check(/Please check on the machine: X7 Conveyor overload/.test(spec), 'the unconfirmed low-confidence reading is a question');
  check(/Start pushbutton \(启动\)/.test(await page.evaluate(async () => (await import('/src/store/useIOStore.ts')).useIOStore.getState().projectIO.map((p) => p.description).join('|'))), 'the correction is in the I/O list');
  const review = await page.evaluate(async () => (await import('/src/review/actions.ts')).refreshChecks().filter((f) => f.id.startsWith('convert:kept:')).map((f) => f.title));
  check(review.length === 0, `no "function lost" review findings: ${review.join('; ')}`);

  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('Convert existing drawings works: read, described, converted to North America, rebuilt, every function kept');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
