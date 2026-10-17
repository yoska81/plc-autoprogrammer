// User journeys: a non-engineer makes a new project from scratch for four machine types and takes each one
// through every stage to Deliverables, with the AI mocked (answers a good AI gives for that machine):
//   sealing head (heater + VFD + two-hand + light curtain + guard door), conveyor with 3 motors,
//   pick-and-place, pump skid with analogs.
// On every page it clicks every safe button (no delete / clear / new project / leave) and records page errors,
// error banners and failed downloads. Deliverables: every download button, the certification pack and the ZIP.
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/journeys.e2e.cjs [machine]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const OUT = __dirname + '/out-journeys/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const ONLY = process.argv[2];
const log = (...a) => console.log('•', ...a);
const problems = [];
const problem = (machine, where, what) => { problems.push(`[${machine}] ${where}: ${what}`); console.log('  ✗', where, '—', what); };

const P = (description, type, category, deviceType, extra = {}) => ({ description, type, category, deviceType, reason: 'spec', signal: 'discrete', analog: null, ...extra });
const A = (description, type, min, max, units) => P(description, type, 'Analog/Process', 'other', { signal: 'analog', analog: { range: '4-20mA', min, max, units } });
const M = (tag, description, power, start, zone) => ({ tag, description, power, unit: 'hp', powerGiven: true, start, vertical: false, zone });

const MACHINES = [
  {
    key: 'sealing', name: 'Pouch Sealer', region: 'United States',
    text: 'Pouch sealing head. The operator puts a pouch in, presses two-hand start, the heated sealing head comes down, holds for the dwell time, goes up. The seal bar has a heater with a thermocouple and an over-temperature limit. Film unwinder motor 0.5 HP on a VFD. Light curtain at the front and an interlocked guard door at the back. E-stop on the panel. 7 inch touch screen to set temperature and dwell.',
    io: [
      P('Safety relay OK (E-stop, guard door, light curtain)', 'input', 'Safety', 'safety-relay-output'),
      P('Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no'), P('Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no'),
      P('Light curtain clear (OSSD)', 'input', 'Safety', 'other'), P('Guard door closed', 'input', 'Safety', 'limit-switch'),
      P('Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'), P('Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no'),
      P('Sealing head up', 'input', 'Pneumatic', 'sensor-pnp'), P('Sealing head down', 'input', 'Pneumatic', 'sensor-pnp'),
      P('Heater over-temperature limit tripped', 'input', 'Analog/Process', 'other'), P('Unwinder VFD fault', 'input', 'Conveyor', 'vfd-input'),
      A('Seal bar temperature (thermocouple transmitter)', 'input', 0, 300, '°C'),
      P('Sealing head down solenoid', 'output', 'Pneumatic', 'solenoid'), P('Sealing head up solenoid', 'output', 'Pneumatic', 'solenoid'),
      P('Seal heater on (SSR)', 'output', 'Analog/Process', 'other'), P('Unwinder VFD run', 'output', 'Conveyor', 'vfd-input'),
      P('Running light', 'output', 'Operator/HMI', 'pilot-light'), A('Unwinder speed reference', 'output', 0, 100, '%'),
    ],
    model: { motors: [M('M1', 'Film unwinder', 0.5, 'vfd', 'Unwind')], estops: 1, guardDoors: [{ zone: 'Sealing station' }], lightCurtains: [{ zone: 'Sealing station' }], zones: ['Unwind', 'Sealing station'], interfaces: [], questions: ['Confirm the heater power.'] },
    di: 11, do: 6, ai: 1, ao: 1,
  },
  {
    key: 'conveyor', name: 'Three Belt Conveyor', region: 'United States',
    text: 'Three belt conveyors in a row carry boxes to a palletizer. Each belt has a 2 HP motor started across the line, with a photo-eye at its end. Belts start from the last one backwards. Start, stop and E-stop on the panel, a stack light, and a ready signal from the palletizer.',
    io: [
      P('Safety relay OK (E-stop)', 'input', 'Safety', 'safety-relay-output'), P('Start button', 'input', 'Operator/HMI', 'pushbutton-no'), P('Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'),
      P('Belt 1 end photo-eye', 'input', 'Product Detection', 'sensor-pnp'), P('Belt 2 end photo-eye', 'input', 'Product Detection', 'sensor-pnp'), P('Belt 3 end photo-eye', 'input', 'Product Detection', 'sensor-pnp'),
      P('Belt 1 overload tripped', 'input', 'Conveyor', 'other'), P('Belt 2 overload tripped', 'input', 'Conveyor', 'other'), P('Belt 3 overload tripped', 'input', 'Conveyor', 'other'),
      P('Palletizer ready', 'input', 'Interface', 'other'),
      P('Belt 1 motor contactor', 'output', 'Conveyor', 'contactor-coil'), P('Belt 2 motor contactor', 'output', 'Conveyor', 'contactor-coil'), P('Belt 3 motor contactor', 'output', 'Conveyor', 'contactor-coil'),
      P('Stack light green', 'output', 'Operator/HMI', 'stack-light'), P('Stack light red', 'output', 'Operator/HMI', 'stack-light'),
    ],
    model: { motors: [M('M1', 'Belt 1', 2, 'dol', 'Belt 1'), M('M2', 'Belt 2', 2, 'dol', 'Belt 2'), M('M3', 'Belt 3', 2, 'dol', 'Belt 3')], estops: 1, guardDoors: [], lightCurtains: [], zones: ['Belt 1', 'Belt 2', 'Belt 3'], interfaces: [], questions: [] },
    di: 10, do: 5, ai: 0, ao: 0,
  },
  {
    key: 'pickplace', name: 'Pick and Place', region: 'Europe',
    text: 'Pneumatic pick-and-place: an X slide and a Z slide with a vacuum gripper move parts from an infeed nest to an outfeed tray. Each slide has two end sensors, the vacuum has a vacuum switch. Guard with an interlocked door. Start/stop on the panel, E-stop. Cycle about 20 parts per minute.',
    io: [
      P('Safety relay OK (E-stop, guard door)', 'input', 'Safety', 'safety-relay-output'), P('Guard door closed', 'input', 'Safety', 'limit-switch'),
      P('Start button', 'input', 'Operator/HMI', 'pushbutton-no'), P('Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'), P('Reset button', 'input', 'Operator/HMI', 'pushbutton-no'),
      P('X slide at pick', 'input', 'Pneumatic', 'sensor-pnp'), P('X slide at place', 'input', 'Pneumatic', 'sensor-pnp'),
      P('Z slide up', 'input', 'Pneumatic', 'sensor-pnp'), P('Z slide down', 'input', 'Pneumatic', 'sensor-pnp'),
      P('Vacuum OK', 'input', 'Pneumatic', 'pressure-switch'), P('Part in infeed nest', 'input', 'Product Detection', 'sensor-pnp'),
      P('X slide to place solenoid', 'output', 'Pneumatic', 'solenoid'), P('Z slide down solenoid', 'output', 'Pneumatic', 'solenoid'), P('Vacuum on solenoid', 'output', 'Pneumatic', 'solenoid'),
      P('Running light', 'output', 'Operator/HMI', 'pilot-light'),
    ],
    model: { motors: [], estops: 1, guardDoors: [{ zone: 'Pick and place' }], lightCurtains: [], zones: ['Pick and place'], interfaces: [], questions: [] },
    di: 11, do: 4, ai: 0, ao: 0,
  },
  {
    key: 'pumpskid', name: 'Pump Skid', region: 'United States',
    text: 'Water pump skid with two 10 HP pumps on VFDs (duty and standby) holding a pressure setpoint. Discharge pressure, flow, tank level and water temperature transmitters, all 4-20 mA. Low-level float switch stops the pumps. Hand-off-auto selector per pump. E-stop. Touch screen with trends.',
    io: [
      P('Safety relay OK (E-stop)', 'input', 'Safety', 'safety-relay-output'),
      P('Pump 1 auto (HOA)', 'input', 'Operator/HMI', 'selector'), P('Pump 2 auto (HOA)', 'input', 'Operator/HMI', 'selector'),
      P('Pump 1 VFD fault', 'input', 'Pump', 'vfd-input'), P('Pump 2 VFD fault', 'input', 'Pump', 'vfd-input'), P('Tank low level float', 'input', 'Process', 'limit-switch'),
      A('Discharge pressure', 'input', 0, 150, 'psi'), A('Discharge flow', 'input', 0, 500, 'gpm'), A('Tank level', 'input', 0, 100, '%'), A('Water temperature', 'input', 0, 100, '°C'),
      P('Pump 1 VFD run', 'output', 'Pump', 'vfd-input'), P('Pump 2 VFD run', 'output', 'Pump', 'vfd-input'), P('Alarm light', 'output', 'Operator/HMI', 'pilot-light'),
      A('Pump 1 speed reference', 'output', 0, 100, '%'), A('Pump 2 speed reference', 'output', 0, 100, '%'),
    ],
    model: { motors: [M('M1', 'Pump 1', 10, 'vfd', 'Pumps'), M('M2', 'Pump 2', 10, 'vfd', 'Pumps')], estops: 1, guardDoors: [], lightCurtains: [], zones: ['Pumps', 'Tank'], interfaces: [], questions: [] },
    di: 6, do: 3, ai: 4, ao: 2,
  },
];

function reply(mc, system) {
  const k = system.includes('checks a machine control design') ? 'review'
    : system.includes('functional specification') ? 'spec'
    : system.includes('choosing the control equipment') ? 'equipment'
    : system.includes('complete discrete PLC I/O list') ? 'io'
    : system.includes("describe the machine's electrical load and safety") ? 'machine'
    : system.includes('You name things on an operator touch panel') ? 'hmiNames'
    : system.includes("You describe a machine's automatic cycle as a STEP SEQUENCE") ? 'cycle'
    : 'unknown';
  switch (k) {
    case 'review': return { findings: [], summary: 'No further findings.' };
    case 'spec': return { sections: { overview: mc.text }, questions: [], summary: 'Organized the description.' };
    case 'equipment': {
      const mods = [];
      if (mc.di > 4) mods.push({ partNumber: 'C0-16ND3', quantity: 1, why: 'Inputs' });
      if (mc.do > 4) mods.push({ partNumber: 'C0-08TD1', quantity: 1, why: 'Outputs' });
      if (mc.ai > 2) mods.push({ partNumber: 'C0-04AD-1', quantity: 1, why: 'Analog inputs' });
      return {
        summary: `CLICK analog CPU for ${mc.name}.`, estimatedIO: { digitalInputs: mc.di, digitalOutputs: mc.do, analogInputs: mc.ai, analogOutputs: mc.ao, motionAxes: 0 },
        plc: { profileId: 'click', cpuId: 'C0-12DD1E-D', why: 'Built-in analog and Ethernet.' }, modules: mods,
        hmi: { partNumber: 'CM5-T7W', why: '7 inch' }, alternatives: [], cautions: [],
      };
    }
    case 'io': return { explanation: `${mc.io.length} points.`, points: mc.io, questions: [] };
    case 'machine': return mc.model;
    case 'hmiNames': return { machineName: mc.name, actuators: [], states: [], questions: [] };
    case 'cycle': return { explanation: 'Rules keep their default cycle.', steps: [], questions: [] };
    default: throw new Error('unknown prompt: ' + system.slice(0, 100));
  }
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

// Buttons a sweep never presses: they leave the page, delete or reset work, or open the file dialogs of the OS.
const SKIP = /delete|remove|clear|reset all|new project|start clean|withdraw|issue revision|discard|close|cancel|open project|import|load|print|connect|disconnect|ai full|redesign|regenerate|generate|build|rebuild|update all|update .* from|ask ai|save as|save|undo|redo|restore|revert|replace|sign out|log ?out|quit|exit|copy|back to typical|^open$|start empty|from template|^change|^update|add rung|new blank screen|new screen from|run ai review/i;

async function sweep(page, mc, where) {
  const before = page.url();
  const labels = await page.locator('main button:visible, [role="main"] button:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(Boolean));
  const uniq = [...new Set(labels)].filter((l) => !SKIP.test(l) && l.length < 80);
  let clicked = 0;
  for (const l of uniq) {
    const b = page.getByRole('button', { name: l, exact: true }).first();
    if (!(await b.isVisible().catch(() => false)) || !(await b.isEnabled().catch(() => false))) continue;
    const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
    await b.click({ timeout: 3000 }).catch(() => {});
    clicked++;
    fs.appendFileSync(OUT + 'clicks.txt', `${mc.key} ${where}: ${l}\n`);
    const proj = await page.locator('select[aria-label="Open project"] option:checked').innerText().catch(() => '');
    if (proj && proj !== mc.name && !proj.startsWith(mc.name)) problem(mc.key, where, `after "${l}" the open project is "${proj}"`);
    await dl;
    await page.waitForTimeout(150);
    const alert = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    for (const a of alert) if (/error|failed|cannot|could not|undefined|NaN/i.test(a) && !/checker finds/i.test(a)) problem(mc.key, `${where} after "${l}"`, a.replace(/\s+/g, ' ').slice(0, 200));
    // Dialogs opened by a button: close them.
    await page.keyboard.press('Escape').catch(() => {});
    if (page.url() !== before) await page.goto(before);
  }
  return clicked;
}

async function journey(browser, mc) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problem(mc.key, 'page error', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|net::ERR_FAILED|Failed to load resource/.test(m.text())) problem(mc.key, 'console', m.text().slice(0, 300)); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    let text;
    try { text = JSON.stringify(reply(mc, sysText(body.system))); } catch (e) { problem(mc.key, 'AI mock', e.message); text = '{}'; }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, text) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/spec');
  const step = async (what, fn) => {
    try { await fn(); } catch (e) {
      problem(mc.key, what, e.message.split('\n')[0]);
      await page.screenshot({ path: `${OUT}${mc.key}_${what.replace(/\W+/g, '_')}.png`, fullPage: true }).catch(() => {});
    }
  };

  await step('wizard', async () => {
    await page.getByRole('button', { name: 'New project' }).first().click();
    await page.getByPlaceholder('e.g. Line 3 case packer').fill(mc.name);
    await page.getByRole('button', { name: new RegExp(`^${mc.region}`) }).click();
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.locator('textarea').first().fill(mc.text);
    await page.getByRole('button', { name: 'Add to spec' }).click();
    await page.getByText('Organized the description').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.getByRole('button', { name: /Suggest for me/ }).click();
    await page.getByRole('button', { name: /Suggest again/ }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Use this selection' }).first().click();
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.screenshot({ path: `${OUT}${mc.key}_wizard_summary.png` });
    await page.getByRole('button', { name: 'Open project →' }).click();
    await page.waitForURL('**/io');
  });
  await step('I/O', async () => {
    await page.getByRole('button', { name: /Generate I\/O from spec|Update I\/O from spec/ }).click();
    await page.getByText('Review I/O changes').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Apply changes' }).click();
    const n = await page.locator('input[aria-label^="PLC address"]').count();
    if (n !== mc.io.length) problem(mc.key, 'I/O', `${n} points shown, ${mc.io.length} generated`);
    log(mc.key, 'I/O points', n);
  });
  await step('electrical', async () => {
    await page.goto(BASE + '/electrical?tab=design');
    await page.getByRole('button', { name: /Generate (Electrical Design|New Design)/ }).click();
    await page.getByRole('button', { name: 'BOM CSV' }).waitFor({ timeout: 30000 });
  });
  await step('HMI', async () => {
    await page.goto(BASE + '/hmi');
    await page.getByRole('button', { name: 'Design the HMI screens' }).click();
    await page.getByRole('button', { name: 'Redesign screens' }).waitFor({ timeout: 30000 });
  });
  await step('program', async () => {
    await page.goto(BASE + '/program');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Build program from my project' }).click();
    await page.waitForTimeout(3000);
  });
  await step('review after build', async () => {
    const f = await page.evaluate(async () => {
      const { checksFor } = await import('/src/review/actions.ts');
      const { collectProject } = await import('/src/deliverables/collect.ts');
      return checksFor(collectProject()).filter((x) => x.severity === 'critical' || x.severity === 'major').map((x) => `${x.severity}: ${x.title}`);
    });
    fs.writeFileSync(`${OUT}${mc.key}_review.txt`, f.join('\n'));
    log(mc.key, 'critical/major review findings after the build', f.length);
    for (const x of f) console.log('    ', x);
  });
  // Every page: look and click.
  for (const route of ['/spec', '/project', '/equipment', '/io', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine', '/electrical?tab=picture', '/electrical?tab=machining', '/electrical?tab=labels', '/hmi', '/program', '/simulate', '/review', '/export']) {
    await step(`page ${route}`, async () => {
      await page.goto(BASE + route);
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      for (const bad of ['undefined', 'NaN', '[object Object]']) if (body.includes(bad)) problem(mc.key, route, `page shows "${bad}": …${body.slice(Math.max(0, body.indexOf(bad) - 80), body.indexOf(bad) + 40).replace(/\s+/g, ' ')}…`);
      await page.screenshot({ path: `${OUT}${mc.key}_${route.replace(/\W+/g, '_')}.png`, fullPage: false });
      if (route !== '/export') log(mc.key, route, 'buttons clicked', await sweep(page, mc, route));
    });
  }
  // Deliverables: every download.
  await step('deliverables', async () => {
    await page.goto(BASE + '/export');
    const stages = await page.locator('main').innerText();
    if (/Not done yet/.test(stages)) problem(mc.key, 'deliverables', 'a stage is still "Not done yet" after the whole journey');
    const names = await page.locator('main button:visible').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    for (const n of names) {
      if (/^(Show|Hide)|edit rates|Copy|Print|Download everything|Back to typical|Rebuild/.test(n) || !n) continue;
      const b = page.getByRole('button', { name: n, exact: true }).first();
      if (!(await b.isEnabled().catch(() => false))) { if (/certification|build time/i.test(n)) problem(mc.key, 'deliverables', `"${n}" is disabled`); continue; }
      const [d] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }).catch(() => null), b.click()]);
      if (!d) { problem(mc.key, 'deliverables', `"${n}" gave no file`); continue; }
      const path = OUT + mc.key + '_' + d.suggestedFilename();
      await d.saveAs(path);
      if (fs.statSync(path).size < 50) problem(mc.key, 'deliverables', `"${n}" file is empty`);
    }
    const alert = await page.locator('[role="alert"]').allInnerTexts();
    for (const a of alert) if (!/checker finds/i.test(a)) problem(mc.key, 'deliverables', a.slice(0, 200));
    log(mc.key, 'build time', await page.getByTestId('build-total').innerText());
    const [z] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.getByRole('button', { name: 'Download everything' }).click()]);
    const zp = OUT + mc.key + '_everything.zip';
    await z.saveAs(zp);
    const zip = await JSZip.loadAsync(fs.readFileSync(zp));
    const files = Object.keys(zip.files);
    for (const want of [/certification_pack\.pdf$/, /order_list\.xlsx$/, /_full_package\.pdf$/]) if (!files.some((f) => want.test(f))) problem(mc.key, 'ZIP', `no ${want}`);
    log(mc.key, 'ZIP files', files.length);
  });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const mc of MACHINES) if (!ONLY || ONLY === mc.key) { log('=== ', mc.name); await journey(browser, mc); }
  await browser.close();
  fs.writeFileSync(OUT + 'problems.txt', problems.join('\n'));
  console.log(`\n${problems.length} problem(s)`);
  for (const p of problems) console.log(' -', p);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
