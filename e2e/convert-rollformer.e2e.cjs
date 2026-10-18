// Acceptance case for "Convert existing drawings": a roll-forming machine with a servo flying shear, as one
// CAD file with six sheets side by side in model space (mirrors a real drawing a user sent; fixture:
// e2e/fixtures/convert/roll-former.dxf). No PLC (servo drive's built-in controller + touch panel), the
// E-stop only into a VFD input. Checks: the DXF goes to the AI split into its six sheets without MTEXT
// codes; the review shows the servo axis and flags "not a safety circuit"; the conversion recommends a
// safety relay + STO; the rebuild keeps every I/O, both panel motors, the axis and the E-stop.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/convert-rollformer.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-convert/rollformer/';
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
    summary: 'CLICK PLC for the converted roll former.', estimatedIO: { digitalInputs: 11, digitalOutputs: 5, analogInputs: 0, analogOutputs: 0, motionAxes: 1 },
    plc: { profileId: 'click', cpuId: 'C0-12DD1E-D', why: 'Enough I/O with a module.' }, modules: [{ partNumber: 'C0-16ND3', quantity: 1, why: 'Inputs' }],
    hmi: null, alternatives: [], cautions: ['The flying shear stays on its servo drive (indexer); the PLC commands it.'],
  };
  if (system.includes("describe the machine's electrical load and safety")) return {
    motors: [M('M1', 'Forming main motor', 7.5, 'vfd', 'Forming'), M('M2', 'Cut-off oil pump', 1, 'dol', 'Cutter')],
    estops: 1, guardDoors: [], lightCurtains: [], zones: ['Forming', 'Cutter'], interfaces: [], questions: [],
  };
  if (system.includes('You name things on an operator touch panel')) return { machineName: 'Roll Former', actuators: [], states: [], questions: [] };
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
  // the app's own summary of each build run: "[update] … equipment done · hmi skipped · electrical done · program done"
  const updates = [];
  page.on('console', (m) => { if (m.text().startsWith('[update]')) updates.push(m.text()); });
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
  MACHINE = await page.evaluate(async () => (await import('/src/convert/__fixtures__/rollFormer.ts')).ROLL_FORMER);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'high', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/spec');
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByTestId('start-option').getByRole('button', { name: /^From existing drawings \/ program/ }).click();
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Roll Former Retrofit');
  await page.getByRole('button', { name: 'Continue to the import →' }).click();
  await page.waitForURL(/\/import$/);

  // DWG in the browser: the Windows app opens it (its LibreDWG converter); here DXF or PDF
  check(/DWG opens in the Windows app; here use DXF or PDF/.test(await page.getByTestId('dwg-status').innerText()), 'DWG: "opens in the Windows app" line in the browser');
  // The one CAD file
  await page.getByTestId('convert-files').setInputFiles([FIX + 'roll-former.dxf']);
  await page.getByRole('button', { name: 'Read the drawings' }).click();
  await page.getByTestId('convert-recognised').waitFor({ timeout: 60000 });
  const sent = requests.find((r) => sysText(r.system).includes('taking over an existing machine'))?.messages[0].content.find((b) => b.type === 'text' && b.text.startsWith('roll-former.dxf'))?.text ?? '';
  fs.writeFileSync(OUT + 'sent_to_ai.txt', sent);
  check(/6 sheets side by side/.test(sent) && (sent.match(/^--- Sheet \d of 6/gm) ?? []).length === 6, 'the DXF goes to the AI split into its 6 sheets');
  check(/Sheet 3 of 6: 伺服切断 Servo shear · 第3页 共6页/.test(sent), 'each sheet named from its title block');
  check(!/SimSun|\\f|\\P/.test(sent) && /10平方 \(10 mm²\)/.test(sent), 'MTEXT codes stripped, wire sizes in mm²');
  log('Sent to the AI:', sent.split('\n')[0]);

  // Review
  const rec = await page.getByTestId('convert-recognised').innerText();
  check(/16 I\/O · 21 parts · 3 motors · 1 servo axis/.test(rec), 'found: I/O, parts, motors and the servo axis');
  check(/no PLC/.test(rec) && /servo drive's built-in controller/.test(rec), 'no PLC: the servo drive runs the machine');
  const axes = await page.getByTestId('review-axes').innerText();
  check(/A1/.test(axes) && /SD1/.test(axes) && /1\.5 kW/.test(axes) && /encoder/.test(axes) && /braking resistor/.test(axes), 'review: servo axis with drive, motor, encoder and braking resistor');
  const circuits = await page.getByTestId('review-circuits').innerText();
  check(/KM1[\s\S]*seal-in/.test(circuits) && /SD1[\s\S]*cuts at the set length/.test(circuits) && /the drive/.test(circuits), 'review: control circuits read as functions (seal-in, the flying shear in the drive)');
  check(await page.getByTestId('not-safety-circuit').isVisible(), 'review: the E-stop is flagged "not a safety circuit"');
  check(/1 low-confidence reading not confirmed/.test(await page.getByTestId('review-status').innerText()), 'review: the unsure pendant reading is counted');
  // a picture of the sheet (cut to the column) next to the readings
  const thumbs = page.getByTestId('review-parts').getByTestId('source-thumb');
  await thumbs.first().waitFor({ timeout: 15000 });
  check(await thumbs.count() >= 10, `review: sheet thumbnails next to the parts (${await thumbs.count()})`);
  await thumbs.first().click();
  const dlg = page.getByRole('dialog');
  check(/sheet 1, column 1/.test(await dlg.innerText()), 'thumbnail opens the sheet it was read from');
  await dlg.screenshot({ path: OUT + '01b_source_sheet.png' });
  await dlg.click();
  await page.getByTestId('convert-recognised').screenshot({ path: OUT + '01_review.png' });

  // Conversion
  const recs = await page.getByTestId('convert-recommendations').innerText();
  log('Recommendations:', recs.replace(/\s+/g, ' ').slice(0, 260));
  check(/not a safety circuit/.test(recs) && /safety relay/.test(recs) && /Safe Torque Off \(STO\) inputs of VF1, SD1/.test(recs), 'conversion recommends a safety relay + STO on the VFD and the servo drive');
  check(/Servo axis A1/.test(recs), 'conversion keeps the servo axis whole');
  check(await page.getByTestId('convert-logic').getByRole('radio', { name: /Move it into a new PLC/ }).isChecked(), 'no PLC: moving the logic into a new PLC is the default choice');
  const conCircuits = await page.getByTestId('convert-circuits').innerText();
  check(/PLC program K1: Main contactor/.test(conCircuits) && /in the drive SD1: Flying shear/.test(conCircuits), 'circuits: relay logic → PLC program (new tags), drive logic stays in the drive');
  const table = await page.getByTestId('convert-table').innerText();
  check(/M1: 5\.5 kW → 7\.5 HP 480 V/.test(table), 'forming motor 5.5 kW → 7.5 HP at 480 V');
  check(/VF1[\s\S]*STO wired to the safety relay/.test(table) && /SD1[\s\S]*Servo axis/.test(table), 'VFD and servo drive rows: STO, chosen with the axis');
  await page.getByTestId('convert-table').screenshot({ path: OUT + '02_conversion.png' });

  // Rebuild
  await page.getByTestId('convert-build').click();
  // wait for this build's summary line (a module imported from the test could be another instance than the app's)
  const before = updates.length;
  for (let t = 0; t < 360 && updates.length === before; t++) await page.waitForTimeout(500);
  const line = updates[before] ?? '';
  const run = [...line.matchAll(/(equipment|io|electrical|hmi|program) (done|skipped|failed|stopped)/g)].map((x) => `${x[1]}:${x[2]}`);
  log('Build:', line);
  check(run.filter((r) => /:done$/.test(r)).length === 3, 'equipment, electrical and program built');
  await page.getByRole('button', { name: 'Close', exact: true }).click().catch(() => {});
  const kept = page.getByTestId('convert-kept');
  await kept.waitFor();
  const keptText = await kept.innerText();
  fs.writeFileSync(OUT + 'function_kept.txt', keptText);
  log('Function kept:', keptText.split('\n')[1]);
  check(!/✗ Missing/.test(keptText), `nothing missing:\n${keptText.split('\n').filter((l) => /Missing/.test(l)).join('\n')}`);
  check(/servo axis[\s\S]*A1 Flying shear/.test(keptText), 'the servo axis is in function kept');
  check((keptText.match(/control circuit/g) ?? []).length === 6 && /KM2: Oil pump runs[\s\S]*PLC program/.test(keptText) && /In VFD1's own logic/.test(keptText), 'function kept checks each control circuit');
  check(/E-stop SB3 \(only a drive input: not a safety circuit\)[\s\S]*on safety relay/.test(keptText), 'the E-stop now goes through a safety relay');
  check(/re-validate/.test(keptText), 'safety marked re-validate');
  await kept.screenshot({ path: OUT + '03_function_kept.png' });

  // Questions on the Machine description page
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(800);
  const spec = await page.locator('body').innerText();
  check(/380 V 3-phase \+ N \(as the power sheet shows\) or 220 V/.test(spec), 'the 380 V / 220 V supply is a question');
  check(/no PLC/.test(spec) && /not a safety circuit/.test(spec), 'no-PLC and safety questions asked');

  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('Roll former (acceptance case): read from one CAD file, reviewed, converted with safety relay + STO, rebuilt, every function kept');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
