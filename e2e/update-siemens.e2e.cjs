// "Update all" on a description that names Siemens: every stage follows the brand. The AI is mocked; the mock checks
// that the equipment prompt offers Siemens CPUs and modules only (never CLICK), and answers with a 6ES7 CPU.
// Then: the project is a Siemens S7 with that CPU, the I/O list has %I / %Q addresses, the drawings use the
// 6ES7 parts, the HMI is designed on a panel that talks to an S7, and the program exports for TIA Portal.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/update-siemens.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

const TEXT = 'Bottle capper. Controller: Siemens S7-1200 programmed in TIA Portal. The operator presses Start; a bottle stops at the capping station '
  + '(photo-eye), the clamp closes, the capping head comes down and the spindle runs until the torque switch, then the head goes up and the clamp opens. '
  + 'E-stop and a guard door. A 7 inch touch panel to see counts and alarms.';
const P = (description, type, category, deviceType) => ({ description, type, category, deviceType, reason: 'spec', signal: 'discrete', analog: null });
const IO = [
  P('Safety relay OK (E-stop, guard door)', 'input', 'Safety', 'safety-relay-output'), P('Start button', 'input', 'Operator/HMI', 'pushbutton-no'),
  P('Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'), P('Bottle at station photo-eye', 'input', 'Product Detection', 'sensor-pnp'),
  P('Clamp closed', 'input', 'Pneumatic', 'sensor-pnp'), P('Head up', 'input', 'Pneumatic', 'sensor-pnp'), P('Head down', 'input', 'Pneumatic', 'sensor-pnp'),
  P('Torque reached switch', 'input', 'Station 1', 'other'),
  P('Clamp close solenoid', 'output', 'Pneumatic', 'solenoid'), P('Head down solenoid', 'output', 'Pneumatic', 'solenoid'),
  P('Spindle motor contactor', 'output', 'Station 1', 'contactor-coil'), P('Running light', 'output', 'Operator/HMI', 'pilot-light'),
];
const CPU = '6ES7214-1AG40-0XB0';
// The equipment the mocked AI answers with (the S7-1500 case changes it).
let EQUIP = { cpuId: CPU, modules: [] };

const seen = { equipment: null, unknown: [] };
function reply(system) {
  if (system.includes('choosing the control equipment')) {
    seen.equipment = system;
    const panel = EQUIP.hmi ?? (system.match(/^- (\S+) \((Siemens|Weintek|Maple Systems|Red Lion)[^)]*\): 7"/m) || system.match(/^- (\S+) \([^)]*\): 7"/m) || system.match(/^- (\S+) \([^)]*\):/m) || [])[1] ?? null;
    return {
      summary: `${EQUIP.cpuId} for the capper.`, estimatedIO: { digitalInputs: 8, digitalOutputs: 4, analogInputs: 0, analogOutputs: 0, motionAxes: 0 },
      plc: { profileId: 'siemens-s7', cpuId: EQUIP.cpuId, why: 'Siemens, as the customer asked.' }, modules: EQUIP.modules.map((partNumber) => ({ partNumber, quantity: 1, why: 'I/O' })),
      hmi: panel ? { partNumber: panel, why: '7 inch' } : null, alternatives: [], cautions: [],
    };
  }
  if (system.includes('functional specification')) return { sections: { overview: TEXT }, questions: [], summary: 'Organized the description.' };
  if (system.includes('complete discrete PLC I/O list')) return { explanation: `${IO.length} points.`, points: IO, questions: [] };
  if (system.includes("describe the machine's electrical load and safety")) return { motors: [{ tag: 'M1', description: 'Spindle', power: 0.5, unit: 'hp', powerGiven: true, start: 'dol', vertical: false, zone: 'Capper' }], estops: 1, guardDoors: [{ zone: 'Capper' }], lightCurtains: [], zones: ['Capper'], interfaces: [], questions: [] };
  if (system.includes('You name things on an operator touch panel')) return { machineName: 'Bottle capper', actuators: [], states: [], questions: [] };
  if (system.includes("You describe a machine's automatic cycle as a STEP SEQUENCE")) return { explanation: 'Rules keep their default cycle.', steps: [], questions: [] };
  if (system.includes('checks a machine control design')) return { findings: [], summary: 'No further findings.' };
  seen.unknown.push(system.slice(0, 120));
  throw new Error('unknown prompt');
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

async function scenario(browser, quick) {
  console.log(quick ? '• === equipment by the rules (no AI), from a CLICK project with a C-more panel' : '• === equipment by the AI');
  seen.equipment = null; seen.unknown = [];
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    let text = '{}', status = 200;
    try { text = JSON.stringify(reply(sysText(body.system))); } catch { status = 500; }
    await route.fulfill({ status, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: status === 200 ? sse(body.model, text) : '{"type":"error","error":{"type":"api_error","message":"mock"}}' });
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/spec');
  const before = await page.evaluate(async ([text, quick]) => {
    (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().setSections({ overview: text });
    if (quick) {
      (await import('/src/store/useSettingsStore.ts')).useSettingsStore.getState().setStageMode('equipment', 'quick');
      const { applyEquipment } = await import('/src/spec/equipment.ts');
      applyEquipment({ cpuId: 'C0-12DD1E-D', modules: [], hmiPartNumber: 'CM5-T7W' }, null);
    }
    const p = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    return `${p.plcId} ${p.cpuId} ${(await import('/src/store/useHmiStore.ts')).useHmiStore.getState().hmiPartNumber}`;
  }, [TEXT, quick]);
  console.log('• before:', before);

  const results = await page.evaluate(async () => {
    const { runStages } = await import('/src/spec/updateRun.ts');
    return (await runStages(['equipment', 'io', 'electrical', 'hmi', 'program'])).map((r) => `${r.step} ${r.status}: ${r.message}`);
  });
  for (const r of results) console.log('  ·', r.slice(0, 220));

  check(results.some((r) => /^equipment done: Using Siemens .* because the description says ".*Siemens S7-1200.*"\. Change it in Brand preference/.test(r)), 'the equipment step quotes where the brand was read');
  if (!quick) {
    check(seen.equipment && !/^- C0-|^- C2-/m.test(seen.equipment), 'equipment prompt offers no CLICK CPU or module');
    check(seen.equipment && /^- 6ES7/m.test(seen.equipment), 'equipment prompt offers Siemens CPUs');
    check(seen.equipment && !/CLICK CPUs take up to 8/.test(seen.equipment), 'no CLICK notes in the prompt');
  } else {
    check(results.some((r) => /^equipment done: .*CM5-T7W panel cannot talk to this PLC: \S+ /.test(r)), 'the C-more panel is swapped for one that talks to an S7, and the step says so');
  }

  const st = await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/store/useProjectStore.ts');
    const { useHmiStore } = await import('/src/store/useHmiStore.ts');
    const { useElectricalStore } = await import('/src/store/useElectricalStore.ts');
    const { useProgramStore } = await import('/src/store/useProgramStore.ts');
    const { getProfile, getCpu } = await import('/src/plc/core/profiles/index.ts');
    const { moduleSlots } = await import('/src/plc/core/modules.ts');
    const { resolveAddresses } = await import('/src/plc/core/profile.ts');
    const { useIOStore } = await import('/src/store/useIOStore.ts');
    const p = useProjectStore.getState();
    const profile = getProfile(p.plcId);
    const cpu = getCpu(profile, p.cpuId);
    const slots = moduleSlots(p.modules);
    const io = useIOStore.getState().projectIO;
    const addr = resolveAddresses(profile, cpu, io, slots);
    const native = io.map((x) => profile.ioTag?.(addr.get(x.id) ?? '', slots, cpu.id) ?? '');
    const comps = useElectricalStore.getState().design?.components ?? [];
    const hmi = useHmiStore.getState();
    const prog = useProgramStore.getState();
    let files = [];
    try {
      const { buildExports } = await import('/src/plc/core/exporters.ts').catch(() => ({}));
      files = buildExports ? buildExports().map((f) => f.fileName) : (profile.exporters ?? []).map((e) => e.label);
    } catch (e) { files = [`error ${e.message}`]; }
    return {
      plcId: p.plcId, cpuId: p.cpuId, modules: p.modules, io: io.length, native,
      parts: comps.map((c) => c.partNumber).filter((pn) => /^6ES7|^C0-|^C2-/.test(pn)),
      hmiPart: hmi.hmiPartNumber, hmiScreens: hmi.design?.screens?.length ?? 0,
      rungs: prog.ladder.rungs.length, code: Boolean(prog.generatedCode), exporters: files,
    };
  });
  console.log('•', JSON.stringify(st).slice(0, 600));
  check(st.plcId === 'siemens-s7' && /^6ES7/.test(st.cpuId), `the project is a Siemens S7 with a 6ES7 CPU (${st.plcId} ${st.cpuId})`);
  check(st.modules.every((m) => /^6ES7/.test(m)), `modules are Siemens (${st.modules.join(', ') || 'none'})`);
  check(st.io === IO.length, `I/O list made (${st.io})`);
  check(st.native.length > 0 && st.native.every((a) => /^%[IQ]\d+\.\d$/.test(a)), `every I/O point has a %I / %Q address (${st.native.join(' ')})`);
  check(st.parts.some((pn) => pn === st.cpuId) && !st.parts.some((pn) => /^C[02]-/.test(pn)), `drawings use the 6ES7 CPU, no CLICK part (${st.parts.join(', ')})`);
  check(Boolean(st.hmiPart) && st.hmiScreens > 0, `HMI designed (${st.hmiPart}, ${st.hmiScreens} screens)`);
  check(st.rungs > 0 || st.code, 'program built');
  check(st.exporters.some((f) => /TIA|SCL|\.scl|\.xml/i.test(f)), `TIA Portal export offered (${st.exporters.join(' | ')})`);
  check(!results.some((r) => / failed:/.test(r)), 'no stage failed');
  // The .scl speaks TIA Portal's names: no CLICK operand outside the user's own I/O descriptions, no static named
  // after a CLICK register, no "_Y003"-style name.
  const scl = await page.evaluate(async () => {
    const p = (await import('/src/deliverables/collect.ts')).collectProject();
    const { exportContext } = await import('/src/deliverables/exportContext.ts');
    const { buildScl } = await import('/src/plc/core/profiles/siemens.ts');
    let text = buildScl(p.ladder, exportContext(p)).scl;
    for (const x of [...p.io].sort((a, b) => b.description.length - a.description.length)) text = text.split(x.description).join('');
    const ops = [...new Set(text.match(/\b(?:CTD|TD|CT|DS|DD|DH|DF|SC|SD|TXT|C|T|X|Y)\d+\b/g) ?? [])];
    const names = [...text.matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*) : /gm)].map((m) => m[1]).filter((n) => /^(?:CTD|TD|CT|DS|DD|DH|DF|C|T|X|Y)\d+$|_[XY]\d{3}$/.test(n));
    return { ops, names };
  });
  check(scl.ops.length === 0 && scl.names.length === 0, `SCL in TIA names only (operands: ${scl.ops.slice(0, 8).join(' ') || 'none'}; names: ${scl.names.slice(0, 8).join(' ') || 'none'})`);
  check(seen.unknown.length === 0, `every AI prompt known to the mock ${seen.unknown.join(' | ')}`);
  // Equipment: the Siemens CPUs and panels first, the other brands one click away.
  await page.goto(BASE + '/equipment');
  await page.locator('input[aria-label^="Choose 6ES7"]').first().waitFor({ timeout: 15000 });
  const cpuIds = await page.locator('input[aria-label^="Choose "][type="radio"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Choose ', '')));
  check(cpuIds.some((id) => /^6ES7/.test(id)) && !cpuIds.some((id) => /^C[02]-/.test(id)), `Equipment: only Siemens CPUs shown first (${cpuIds.filter((id) => !/^6ES7|^6AV/.test(id)).slice(0, 3).join(', ') || 'no other'})`);
  check(await page.getByRole('button', { name: /^Show \d+ CPUs of other brands$/ }).count() === 1, 'the other brands are one click away');
  check(await page.locator('input[aria-label^="Choose CM5-"]').count() === 0, 'no C-more panel listed by default for an S7');
  // The brand rows and the CPU table follow the project's PLC (never the untouched CLICK / C-more default).
  const brandRow = async (g) => page.locator(`select[aria-label="Brand for ${g}"]`).inputValue();
  const shownBrands = [await brandRow('PLC and I/O'), await brandRow('Operator panel (HMI)')];
  const hmiNow = await page.evaluate(async () => (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().hmiPartNumber);
  check(shownBrands[0] === 'siemens' && (!/^6AV/.test(hmiNow ?? '') || shownBrands[1] === 'siemens'), `Preferred brands show the S7 project's brands (${shownBrands.join(' / ')}, panel ${hmiNow})`);
  check(await page.locator(`input[aria-label="Choose ${CPU}"][type="radio"]`).isChecked(), `the project's ${CPU} is selected in the CPU table`);
  // Online: a plain sentence for an S7 (its own software monitors it), never CLICK's Modbus table.
  await page.goto(BASE + '/online');
  const online = await page.getByTestId('online-not-here').innerText({ timeout: 10000 }).catch(() => '');
  check(/TIA Portal/.test(online) && !(await page.getByText(/MODBUS|016385|401001/).count()), `Online page: the sentence, no CLICK Modbus table (${online.slice(0, 80)})`);
  check(await page.getByRole('button', { name: /^I\/O check-out/ }).count() === 1 && await page.getByRole('button', { name: 'Fault finding' }).count() === 1, 'Online page: the I/O check-out and Fault finding tabs stay on an S7');
  // The navigation's Fault finding link: the troubleshooter works from the wiring alone, on every brand.
  await page.goto(BASE + '/online?tab=troubleshoot');
  const troubleshooter = await page.getByLabel('Point to troubleshoot').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check(troubleshooter, 'Fault finding opens on an S7 (/online?tab=troubleshoot)');
  const pointNames = await page.getByLabel('Point to troubleshoot').locator('option').allInnerTexts().catch(() => []);
  const points = pointNames.filter((t) => /^[XY]\d{3}/.test(t));
  check(points.length > 0 && points.every((t) => /^[XY]\d{3} \(%[IQ]\d+\.\d\) — /.test(t)), `Fault finding names each point's Siemens address (${points.slice(0, 2).join(' | ') || 'no points'})`);
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await page.context().close();
}

// A PLC brand the tool cannot program (Mitsubishi): Update all says so in the equipment step, never silently CLICK.
// Editing only the sensors' brand never saves a PLC preference (it moved Logix projects back to CLICK).
async function extras(browser) {
  console.log('• === unsupported brand, and the Brand preference card');
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/spec');
  const msg = await page.evaluate(async (io) => {
    (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().setSections({ overview: 'Bottle capper. The PLC is a Mitsubishi FX5U programmed in GX Works3.' });
    (await import('/src/store/useSettingsStore.ts')).useSettingsStore.getState().setStageMode('equipment', 'quick');
    const { useIOStore } = await import('/src/store/useIOStore.ts');
    useIOStore.getState().importPoints(io.map((p) => ({ description: p.description, type: p.type, category: p.category })), true);
    const { runUpdateAll } = await import('/src/spec/updateAll.ts');
    const out = [];
    await runUpdateAll(['equipment'], (r) => out.push(`${r.step} ${r.status}: ${r.message}`));
    return out.join(' | ');
  }, IO);
  console.log('  ·', msg.slice(0, 200));
  check(/^equipment done: Mitsubishi PLC isn't supported yet — using AutomationDirect CLICK \(/.test(msg), 'Mitsubishi: the step says it is not supported yet and which PLC is used');
  // A maker mentioned without saying it is the PLC: said, never a silent CLICK.
  const msg2 = await page.evaluate(async () => {
    (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().setSections({ overview: 'Bottle capper. The Siemens motor is started by the PLC.' });
    const { runUpdateAll } = await import('/src/spec/updateAll.ts');
    const out = [];
    await runUpdateAll(['equipment'], (r) => out.push(`${r.step} ${r.status}: ${r.message}`));
    return out.join(' | ');
  });
  console.log('  ·', msg2.slice(0, 220));
  check(/The description mentions Siemens but doesn't say the PLC is Siemens — using AutomationDirect CLICK/.test(msg2), 'Siemens mentioned, not as the PLC: the step says so');

  // A Logix project; the user changes only the sensors' brand on the Equipment page.
  await page.evaluate(async () => {
    (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().setSections({ overview: 'Pick and place cell with two conveyors.' });
    const { applyEquipment } = await import('/src/spec/equipment.ts');
    applyEquipment({ cpuId: '5069-L310ER', modules: ['5069-IB16', '5069-OB16'], hmiPartNumber: null }, null);
  });
  await page.goto(BASE + '/equipment');
  await page.locator('select[aria-label="Brand for PLC and I/O"]').waitFor({ timeout: 15000 });
  check(await page.locator('select[aria-label="Brand for PLC and I/O"]').inputValue() === 'allen-bradley', 'a Logix project shows Allen-Bradley as its PLC brand');
  check(await page.locator('input[aria-label="Choose 5069-L310ER"][type="radio"]').isChecked(), 'the project\'s 5069-L310ER is selected in the CPU table');
  const sensors = page.locator('select[aria-label^="Brand for"]').filter({ has: page.locator('option[value="ifm"]') }).first();
  await sensors.selectOption('ifm');
  const after = await page.evaluate(async () => {
    const p = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const st = (await import('/src/spec/useStages.ts')).stagesNow().equipment;
    return { vendors: p.info.vendors, plcId: p.plcId, reason: st.reason ?? '' };
  });
  console.log('  ·', JSON.stringify(after));
  check(after.vendors && !('plc' in after.vendors) && Object.values(after.vendors).some((v) => v.includes('ifm')), 'only the sensors brand is saved, no PLC preference');
  check(after.plcId === 'logix' && !/asks for/.test(after.reason), 'the Logix project is not flagged as another brand');
  // AutomationDirect picked on purpose for the PLC: a request (the Logix project is now another brand).
  const plcSelect = page.locator('select[aria-label^="Brand for"]').first();
  await plcSelect.selectOption('automationdirect');
  const picked = await page.evaluate(async () => {
    const p = (await import('/src/store/useProjectStore.ts')).useProjectStore.getState();
    return { chosen: p.info.plcChosen, reason: (await import('/src/spec/useStages.ts')).stagesNow().equipment.reason ?? '' };
  });
  check(picked.chosen === true && /Brand preference asks for AutomationDirect CLICK/.test(picked.reason), `an AutomationDirect pick is honoured (${picked.reason.slice(0, 80)})`);
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await page.context().close();
}

// S7-1500 + ET 200SP: the Siemens address the user sees (I/O list column, HMI tag list) is the one the exported
// tag table (.sdf) gives the same point. The CPU has no I/O of its own, so every point is on an ET 200SP module.
async function s1500(browser) {
  console.log('• === S7-1500 + ET 200SP: shown and exported addresses agree');
  // The AI answers with a C-more panel here: Update all must swap it for one that talks to the S7.
  EQUIP = { cpuId: '6ES7511-1AL03-0AB0', modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'], hmi: 'CM5-T7W' };
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    let text = '{}', status = 200;
    try { text = JSON.stringify(reply(sysText(body.system))); } catch { status = 500; }
    await route.fulfill({ status, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: status === 200 ? sse(body.model, text) : '{}' });
  });
  await page.goto(BASE + '/spec');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/spec');
  const results = await page.evaluate(async (text) => {
    (await import('/src/store/useSpecStore.ts')).useSpecStore.getState().setSections({ overview: text });
    const { runStages } = await import('/src/spec/updateRun.ts');
    return (await runStages(['equipment', 'io', 'electrical', 'hmi', 'program'])).map((r) => `${r.step} ${r.status}: ${r.message}`);
  }, TEXT.replace('Siemens S7-1200', 'Siemens S7-1500 with ET 200SP I/O'));
  for (const r of results) console.log('  ·', r.slice(0, 160));
  await page.goto(BASE + '/io');
  await page.locator('input[aria-label^="PLC address for"]').first().waitFor();
  // Shown: the I/O list's Siemens address column, by tag.
  const shown = await page.locator('tr', { has: page.locator('input[aria-label^="PLC address for"]') }).evaluateAll((rows) => rows.map((r) => {
    const id = r.querySelector('input[aria-label^="PLC address for"]').getAttribute('aria-label').replace('PLC address for ', '');
    return [id, r.children[1].textContent.trim()];
  }));
  const out = await page.evaluate(async () => {
    const { collectProject } = await import('/src/deliverables/collect.ts');
    const { exportContext } = await import('/src/deliverables/exportContext.ts');
    const { hmiTagRows } = await import('/src/deliverables/hmiTags.ts');
    const p = collectProject();
    const sdf = p.profile.exporters.find((e) => e.id === 'siemens-tags').build(p.ladder, exportContext(p));
    const exported = sdf.trim().split(/\r?\n/).map((l) => JSON.parse(`[${l}]`)).map(([name, address, type, , , , comment]) => ({ name, address, type, comment }));
    const ids = Object.fromEntries(p.io.map((x) => [x.id, { neutral: p.addresses.get(x.id), description: x.description }]));
    return { cpu: p.cpu.id, modules: p.modules, exported, ids, hmi: hmiTagRows(p).filter((r) => r.plcIo).map((r) => [r.address, r.plcIo]) };
  });
  console.log('  ·', out.cpu, out.modules.join(', '), '|', shown.slice(0, 3).map((x) => x.join('=')).join(' '), '| export', out.exported.slice(0, 3).map((t) => `${t.name}=${t.address}`).join(' '));
  check(results.some((r) => /^equipment done: .*The CM5-T7W panel cannot talk to the 6ES7511-1AL03-0AB0: \S+ \(/.test(r)), 'AI path: a panel that cannot talk to the S7 is swapped, and said');
  const hmiNow = await page.evaluate(async () => (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().hmiPartNumber);
  check(hmiNow && !/^CM5-/.test(hmiNow), `the project's panel talks to the S7 (${hmiNow})`);
  check(out.cpu === '6ES7511-1AL03-0AB0' && out.modules.length >= 2, `S7-1500 with ET 200SP modules (${out.cpu} ${out.modules.join(', ')})`);
  const exportedAt = new Set(out.exported.filter((t) => t.type === 'Bool').map((t) => t.address));
  // Every wired point is in the tag table with its description (the ones the program does not use say so).
  const byDescription = new Map(out.exported.filter((t) => t.type === 'Bool').map((t) => [t.comment.replace(/ — check against Device configuration$/, '').replace(/ \(not used by the program yet\)$/, ''), t.address]));
  const pairs = shown.map(([id, a]) => [id, a, byDescription.get(out.ids[id].description)]);
  const bad = pairs.filter(([, a, e]) => e && a !== e);
  const unused = pairs.filter(([, , e]) => !e).map(([id]) => id);
  check(unused.length === 0, `every I/O point is in the .sdf tag table (missing: ${unused.join(', ') || 'none'})`);
  check(shown.length > 0 && shown.every(([, a]) => /^%[IQ]\d+\.\d$/.test(a)), `every point shows a %I / %Q address (${shown.map(([, a]) => a).join(' ')})`);
  check(pairs.length - unused.length > 0 && bad.length === 0, `the I/O list shows the exported address of each point (${bad.map(([id, a, e]) => `${id} shows ${a}, export ${e}`).join('; ') || `${pairs.length - unused.length} match`})`);
  check(!shown.some(([, a]) => a === '%I8.0') || exportedAt.has('%I8.0'), 'no S7-1200 module numbering (%I8.0) where the export has another');
  const neutralToShown = new Map(shown.map(([id, a]) => [out.ids[id].neutral, a]));
  const hmiBad = out.hmi.filter(([addr, io]) => /^%[IQ]\d/.test(io) && neutralToShown.has(addr) && neutralToShown.get(addr) !== io);
  check(hmiBad.length === 0, `HMI tag list shows the same Siemens address as the I/O list (${hmiBad.map((x) => x.join('=')).join(' ') || `${out.hmi.length} I/O tags match`})`);
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await page.context().close();
  EQUIP = { cpuId: CPU, modules: [] };
}

(async () => {
  const browser = await chromium.launch();
  await s1500(browser);
  await scenario(browser, false);
  await scenario(browser, true);
  await extras(browser);
  await browser.close();
  console.log(fails.length ? `update-siemens e2e: ${fails.length} failed` : 'update-siemens e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
