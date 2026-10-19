// The user's own case through the rule-based pipeline in the PREVIEW build (window.claude mocked with the
// answers a good AI gives): a copy of the example with a "Sealing Head" description -> Start clean ->
// Build everything (equipment, I/O, electrical engine, HMI engine, program) -> deliverables ZIP. Checks
// every stage finishes, the ZIP builds, and the design review flags what the engines cannot design yet
// (two-hand control, light curtain channel, heater power circuit, over-temperature cutoff, thermocouple).
//
//   VITE_PREVIEW=1 npx vite --port 5206 --strictPort &  ;  BASE_URL=http://localhost:5206 node e2e/sealing-head.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const OUT = __dirname + '/out-sealing-head/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5206';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

const SPEC = 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple. The film comes off an unwinder driven by a 0.5 HP motor on a VFD. CLICK PLC with a C-more 7" touch panel; the operator sets the seal temperature and the dwell time on the HMI. 480 V 3-phase supply.';
const P = (description, type, category, deviceType, extra = {}) => ({ description, type, category, deviceType, reason: 'spec', signal: 'discrete', analog: null, ...extra });
const IO = [
  P('Safety relay OK (E-stop and light curtain)', 'input', 'Safety', 'safety-relay-output'),
  P('Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no'),
  P('Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no'),
  P('Light curtain clear (OSSD)', 'input', 'Safety', 'other'),
  P('Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'),
  P('Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no'),
  P('Sealing head up (retracted)', 'input', 'Pneumatic', 'sensor-pnp'),
  P('Sealing head down (sealing position)', 'input', 'Pneumatic', 'sensor-pnp'),
  P('Air pressure OK', 'input', 'Pneumatic', 'pressure-switch'),
  P('Heater over-temperature limit tripped', 'input', 'Analog/Process', 'other'),
  P('Unwinder VFD fault', 'input', 'Conveyor', 'vfd-input'),
  P('Film roll low sensor', 'input', 'Product Detection', 'sensor-pnp'),
  P('Seal heater temperature (thermocouple transmitter)', 'input', 'Analog/Process', 'other', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } }),
  P('Sealing head down solenoid', 'output', 'Pneumatic', 'solenoid'),
  P('Sealing head up solenoid', 'output', 'Pneumatic', 'solenoid'),
  P('Seal heater on (SSR)', 'output', 'Analog/Process', 'other'),
  P('Unwinder VFD run', 'output', 'Conveyor', 'vfd-input'),
  P('Machine running light', 'output', 'Operator/HMI', 'pilot-light'),
  P('Fault light', 'output', 'Operator/HMI', 'pilot-light'),
  P('Unwinder speed reference', 'output', 'Conveyor', 'other', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }),
];
const EQUIP = {
  summary: 'CLICK Ethernet Analog CPU (2 AI / 2 AO built in) with one 16-point input module and an 8-point output module; C-more 7" for the temperature and dwell setpoints.',
  estimatedIO: { digitalInputs: 12, digitalOutputs: 6, analogInputs: 1, analogOutputs: 1, motionAxes: 0 },
  plc: { profileId: 'click', cpuId: 'C0-12DD1E-D', why: 'Built-in analog for the heater temperature and the VFD speed; Ethernet for the HMI.' },
  modules: [{ partNumber: 'C0-16ND3', quantity: 1, why: 'Inputs' }, { partNumber: 'C0-08TD1', quantity: 1, why: 'Outputs' }],
  hmi: { partNumber: 'CM5-T7W', why: '7" for setpoints and alarms' },
  alternatives: [], cautions: ['The thermocouple needs a transmitter (4-20 mA) or a thermocouple module.'],
};
const MODEL = {
  motors: [{ tag: 'M1', description: 'Unwinder motor', power: 0.5, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Unwind' }],
  estops: 1, guardDoors: [], lightCurtains: [{ zone: 'Sealing station' }], zones: ['Unwind', 'Sealing station'], interfaces: [],
  questions: ['Confirm the heater power and voltage.', 'Confirm the light curtain type (type 4) and the two-hand control category (ISO 13851 type IIIC).'],
};
const HMI_CONTENT = { machineName: 'Sealing Head', actuators: [], states: [
  { value: 0, text: 'Stopped', style: 'normal' }, { value: 1, text: 'Running', style: 'ok' }, { value: 2, text: 'Heating', style: 'ok' },
  { value: 3, text: 'Sealing', style: 'ok' }, { value: 4, text: 'Opening', style: 'ok' }, { value: 5, text: 'Faulted', style: 'alarm' },
  { value: 6, text: 'Manual', style: 'warning' }, { value: 7, text: 'Safety Stop', style: 'alarm' }], questions: [] };

const C = (a, t = 'NO') => ({ type: t, address: a });
const R = (id, comment, branches, outputs, block) => ({ id, comment, branches, outputs, block });
const PROGRAM = {
  blocks: [{ id: 'safety', name: 'Safety & modes', description: 'Safety OK, two-hand start, cycle' }, { id: 'seal', name: 'Sealing', description: 'Head, dwell, heater' }, { id: 'alarms', name: 'Alarms', description: 'Alarm bits' }],
  rungs: [
    R('r1', 'Safety OK from the safety relay', [[C('X001')]], [{ type: 'OUT', address: 'C1' }], 'safety'),
    R('r2', 'Two-hand: both buttons within 0.5 s (T1 starts on the first)', [[C('X002')], [C('X003')]], [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '500', unit: 'ms', accumulate: false, resetAddress: null }], 'safety'),
    R('r3', 'Two-hand start accepted', [[C('X002'), C('X003'), C('T1', 'NC'), C('C1'), C('C1201', 'NC'), C('X103')]], [{ type: 'SET', address: 'C10' }], 'safety'),
    R('r4', 'Head down while cycling and both hands held', [[C('C10'), C('X002'), C('X003'), C('C1'), C('C12', 'NC')]], [{ type: 'OUT', address: 'Y001' }], 'seal'),
    R('r5', 'Dwell timer at the sealing position', [[C('C10'), C('X104')]], [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: 'DS2', unit: 'ms', accumulate: false, resetAddress: null }], 'seal'),
    R('r6', 'Dwell done: open', [[C('T2')], [C('C12'), C('X103', 'NC')]], [{ type: 'OUT', address: 'C12' }, { type: 'OUT', address: 'Y002' }], 'seal'),
    R('r7', 'Cycle ends with the head up', [[C('C12'), C('X103')], [C('C1', 'NC')], [C('X101', 'NC')]], [{ type: 'RST', address: 'C10' }], 'seal'),
    R('r8', 'Heater on below the setpoint (DF201) while safety OK and no over-temperature', [[C('C1'), C('X106', 'NC'), { type: 'CMP', left: 'DF1', op: '<', right: 'DF201' }]], [{ type: 'OUT', address: 'Y003' }], 'seal'),
    R('r9', 'Unwinder runs while cycling', [[C('C10'), C('X107', 'NC')], [C('C1005'), C('C1204')]], [{ type: 'OUT', address: 'Y004' }], 'seal'),
    R('r10', 'Safety alarm', [[C('C1', 'NC')]], [{ type: 'OUT', address: 'C1101' }], 'alarms'),
    R('r11', 'Running light', [[C('C10')]], [{ type: 'OUT', address: 'Y201' }], 'alarms'),
  ],
  tags: [{ address: 'C1', nickname: 'Safety_OK', comment: '' }, { address: 'C10', nickname: 'Cycle', comment: '' }, { address: 'DS2', nickname: 'Dwell_ms', comment: 'Dwell time (ms)' }, { address: 'DF201', nickname: 'Temp_SP', comment: 'Seal temperature setpoint' }],
};

function reply(text) {
  if (text.includes('Reply with the single word OK')) return 'OK';
  if (text.includes('choosing the control equipment')) return EQUIP;
  if (text.includes('complete discrete PLC I/O list')) return { explanation: 'Sealing head I/O.', points: IO, questions: [] };
  if (text.includes('describe the machine\'s electrical load and safety')) return MODEL;
  if (text.includes('You name things on an operator touch panel')) return HMI_CONTENT;
  if (text.includes('ladder')) return { explanation: 'Sealing head cycle: two-hand start within 0.5 s, head down, dwell, head up; heater on/off control on the temperature setpoint.', program: PROGRAM };
  if (text.includes('functional specification')) return { explanation: 'no change', sections: null };
  throw { code: 'refused', message: 'unknown prompt: ' + text.slice(0, 120) };
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.exposeFunction('__reply', (t) => JSON.stringify(reply(t)));
  await page.exposeFunction('__prompt', (t) => { fs.appendFileSync(OUT + 'prompts.txt', '\n\n======== PROMPT ========\n' + t); });
  await page.addInitScript(() => {
    window.__saves = [];
    const run = async (input, options, json) => {
      const t = input.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
      await window.__prompt(t);
      const value = JSON.parse(await window.__reply(t));
      return json ? value : { text: typeof value === 'string' ? value : JSON.stringify(value), truncated: false };
    };
    const sample = (input, options) => run(input, options, false);
    sample.json = (input, options) => run(input, options, true);
    const downloads = { save: async ({ filename, data }) => { const buf = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new TextEncoder().encode(String(data)); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); window.__saves.push({ filename, b64: btoa(bin) }); return { status: 'saved' }; } };
    window.claude = { use: async (name) => (name === 'sample' ? sample : name === 'downloads' ? downloads : null) };
  });

  await page.goto(BASE + '/#/spec');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/#/spec');
  await page.waitForTimeout(1500);
  // The user's case: a copy of the example with their own description.
  await page.evaluate(async ({ spec }) => {
    const ps = await appImport('/src/store/useProjectsStore.ts');
    const { data } = ps.activeProjectData();
    ps.addProjectFromData('Sealing Head', data);
    const { useSpecStore } = await appImport('/src/store/useSpecStore.ts');
    const { EMPTY_SECTIONS } = await appImport('/src/spec/types.ts');
    useSpecStore.getState().setSections({ ...EMPTY_SECTIONS, overview: spec });
  }, { spec: SPEC });
  await page.goto(BASE + '/#/spec');
  const banner = page.getByTestId('start-clean');
  // Wait for the banner itself (a fixed wait failed under load). Needs the PREVIEW build (see the header).
  await banner.waitFor({ timeout: 20000 });
  log('Banner:', (await banner.innerText()).replace(/\s+/g, ' ').slice(0, 200));
  await banner.getByRole('button', { name: 'Start clean from my description' }).click();
  await banner.getByLabel('Make it again from the description').check();
  await banner.getByRole('button', { name: "Clear the example's parts" }).click();
  await page.waitForTimeout(500);
  const build = page.getByRole('button', { name: 'Build everything from my description' });
  log('Build button enabled:', await build.isEnabled());
  await page.evaluate(async () => { window.__stages = []; (await appImport('/src/lib/ai/jobs.ts')).useAiJobs.subscribe((st) => { for (const j of st.jobs) if (j.stage && window.__stages[window.__stages.length - 1] !== j.stage) window.__stages.push(j.stage); }); });
  await build.click();
  // wait for the job to finish
  await page.waitForFunction(async () => !(await appImport('/src/lib/ai/jobs.ts')).useAiJobs.getState().jobs.some((j) => j.status === 'running'), null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(1000);
  const jobs = await page.evaluate(async () => (await appImport('/src/lib/ai/jobs.ts')).useAiJobs.getState().jobs.map((j) => ({ kind: j.kind, status: j.status, stage: j.stage, error: j.error })));
  log('Jobs:', JSON.stringify(jobs));
  const stageLog = await page.evaluate(() => window.__stages);
  log('Stage log:', JSON.stringify(stageLog));
  log('HMI store part:', await page.evaluate(async () => (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState().hmiPartNumber));
  const state = await page.evaluate(async () => {
    const io = (await appImport('/src/store/useIOStore.ts')).useIOStore.getState().projectIO;
    const proj = (await appImport('/src/store/useProjectStore.ts')).useProjectStore.getState();
    const el = (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState();
    const hmi = (await appImport('/src/store/useHmiStore.ts')).useHmiStore.getState();
    const prog = (await appImport('/src/store/useProgramStore.ts')).useProgramStore.getState();
    const stages = (await appImport('/src/spec/useStages.ts')).stagesNow();
    return { io, plc: { plcId: proj.plcId, cpuId: proj.cpuId, modules: proj.modules, hmi: proj.hmiPartNumber ?? proj.hmi }, electrical: { inputs: el.inputs, design: el.design, explanation: el.explanation },
      hmi: hmi.design, program: { rungs: prog.ladder?.rungs?.length, pending: prog.pending ?? prog.proposal ?? null, userPrompt: prog.userPrompt },
      stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, { status: v.status, why: v.reason ?? v.why ?? '' }])) };
  });
  fs.writeFileSync(OUT + 'state.json', JSON.stringify(state, null, 2));
  // Deliverables: everything ZIP (full package, labels, machining), machine spec
  const zip = await page.evaluate(async () => {
    const { collectProject } = await appImport('/src/deliverables/collect.ts');
    const { buildEverythingZip } = await appImport('/src/deliverables/files.ts');
    const blob = await buildEverythingZip(collectProject());
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  fs.writeFileSync(OUT + 'everything.zip', Buffer.from(zip, 'base64'));
  const spec = await page.evaluate(async () => { const m = await appImport('/src/deliverables/machineSpec.ts').catch(() => null); if (!m) return 'NO MODULE'; const f = m.machineSpecText; const { collectProject } = await appImport('/src/deliverables/collect.ts'); try { return String(f(collectProject())); } catch (e) { return 'ERR ' + e.message; } });
  fs.writeFileSync(OUT + 'machine_spec.md', spec);
  const JSZip = require('jszip');
  const z = await JSZip.loadAsync(fs.readFileSync(OUT + 'everything.zip'));
  const names = Object.keys(z.files);
  log('ZIP:', names.length, 'files');
  for (const want of [/^spec\.md$/, /_full_package\.pdf$/, /labels\/.*_label_printer\.pdf$/, /machining\/.*_back_panel_drilling\.pdf$/, /machining\/enclosure_bottom_cutouts_1to1_in\.dxf$/, /plc\/.*_analog_setup\.csv$/]) check(names.some((n) => want.test(n)), `ZIP has ${want}`);
  check(/Sealing head/i.test(await z.file('spec.md').async('string')), 'spec.md has the description');
  // Start clean replaced the example's document control (customer, project no., drawing prefix)
  const specMd = await z.file('spec.md').async('string');
  check(!/example foods|24-117/i.test(specMd) && !Object.keys(z.files).some((n) => /CNV/i.test(n)), 'no example document control after Start clean');
  check(/Two-hand start/.test(spec) && /Seal heater/.test(spec), 'machine spec lists the sealing head I/O');
  // The design review says what the engines could not design (instead of a silently unsafe panel).
  const findings = await page.evaluate(async () => {
    const { checksFor } = await appImport('/src/review/actions.ts');
    const { collectProject } = await appImport('/src/deliverables/collect.ts');
    return checksFor(collectProject()).map((f) => `${f.severity}|${f.title}`);
  });
  fs.writeFileSync(OUT + 'findings.txt', findings.join('\n'));
  // palm buttons are placed at the machine (no longer on the cabinet door)
  const palm = (state.electrical.design?.ioWiring ?? []).filter((w) => /two-hand/i.test(w.description));
  check(palm.length === 2 && palm.every((w) => !/door/i.test(w.location ?? '')), `two-hand buttons at the machine: ${palm.map((w) => `${w.deviceTag}@${w.location}`).join(', ')}`);
  check(!findings.some((f) => /^Wire DF\d+[+-]? is /.test(f.split('|')[1] ?? '')), 'analog signal pairs not flagged by the wire colour rule');
  // Dev 2's #64 put the safety and heater functions in the design; the review no longer raises them
  for (const re of [/Two-hand control without a two-hand safety relay/, /is a standard sensor, not a safety device/, /Light curtain without a safety relay channel/,
    /has no heater power circuit/, /over-temperature cutoff is not hardwired/, /Thermocouple without a transmitter/, /cannot switch: its circuit does not match/]) {
    check(!findings.some((f) => re.test(f)), `review no longer: ${re}`);
  }
  const parts = (state.electrical.design?.components ?? []).map((c) => c.partNumber);
  for (const [what, re] of [['two-hand relay', /^BG5933/], ['safety light curtain', /^SH4-/], ['curtain OSSD relay', /^LG5925-48-900/], ['over-temperature limit', /^SCU-3100/], ['heater SSR', /^GRSH/], ['TC transmitter', /^XTD2/]]) {
    check(parts.some((pn) => re.test(pn)), `design has the ${what}`);
  }
  log('Stages:', JSON.stringify(state.stages));
  log('PLC:', JSON.stringify(state.plc), '| IO', state.io.length, '| components', state.electrical.design?.components?.length, '| HMI screens', state.hmi?.screens?.length);
  check(['Equipment', 'I/O list', 'Electrical design', 'HMI screens', 'PLC program'].every((k) => stageLog.some((s) => s.split(' + ').some((x) => x.startsWith(k)))), `every stage done: ${stageLog.join(', ')}`);
  check(state.plc.cpuId === 'C0-12DD1E-D' && state.hmi?.screens?.length > 0, 'equipment and HMI applied');
  check(state.electrical.design?.components?.some((c) => c.tag === 'VFD1'), 'unwinder VFD in the design');
  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('sealing head built end to end in the preview; the review flags the safety / heater gaps');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
