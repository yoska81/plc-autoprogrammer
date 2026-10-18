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

const seen = { equipment: null, unknown: [] };
function reply(system) {
  if (system.includes('choosing the control equipment')) {
    seen.equipment = system;
    const panel = (system.match(/^- (\S+) \((Siemens|Weintek|Maple Systems|Red Lion)[^)]*\): 7"/m) || system.match(/^- (\S+) \([^)]*\): 7"/m) || system.match(/^- (\S+) \([^)]*\):/m) || [])[1] ?? null;
    return {
      summary: `${CPU} for the capper.`, estimatedIO: { digitalInputs: 8, digitalOutputs: 4, analogInputs: 0, analogOutputs: 0, motionAxes: 0 },
      plc: { profileId: 'siemens-s7', cpuId: CPU, why: 'Siemens, as the customer asked.' }, modules: [],
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
  check(seen.unknown.length === 0, `every AI prompt known to the mock ${seen.unknown.join(' | ')}`);
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

(async () => {
  const browser = await chromium.launch();
  await scenario(browser, false);
  await scenario(browser, true);
  await extras(browser);
  await browser.close();
  console.log(fails.length ? `update-siemens e2e: ${fails.length} failed` : 'update-siemens e2e: all passed');
  process.exit(fails.length ? 1 : 0);
})();
