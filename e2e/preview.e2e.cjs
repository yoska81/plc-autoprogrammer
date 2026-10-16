// Preview build E2E: the claude.ai side-panel build (VITE_PREVIEW=1) with a fake `window.claude` runtime.
// Checks: AI works without an API key, prompts are well-formed and small enough, runtime errors read as
// plain English, and saves go out as-is (.pdf/.xlsx/.csv) or zipped (.dxf/.step).
//
//   VITE_PREVIEW=1 npx vite build --config vite.preview.config.ts
//   npx http-server dist-preview -p 5203 -s &
//   BASE_URL=http://localhost:5203 node e2e/preview.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const OUT = __dirname + '/out-preview/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures.json', 'utf8'));
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };
const MAX_PROMPT = 256 * 1024;

const IO_POINTS = [
  ['E-Stop OK (safety relay)', 'input', 'Safety', 'safety-relay-output'],
  ['Start Button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Stop Button', 'input', 'Operator/HMI', 'pushbutton-nc'],
  ['Conveyor motor contactor', 'output', 'Conveyor', 'contactor-coil'],
].map(([description, type, category, deviceType]) => ({ description, type, category, deviceType, reason: 'spec' }));

function reply(system) {
  const m = F.DESIGN.machine;
  if (system.includes('Reply with the single word OK')) return 'OK';
  if (system.includes('choosing the control equipment')) return F.RECOMMENDATION;
  if (system.includes('complete discrete PLC I/O list')) return { explanation: 'Updated.', points: IO_POINTS, questions: [] };
  if (system.includes('industrial control panel')) return {
    explanation: 'NEMA 12 panel.', components: F.DESIGN.components, ioWiring: F.DESIGN.ioWiring, notes: F.DESIGN.notes, motors: F.DESIGN.inputs.motors,
    machine: { zones: m.zones, junctionBoxes: m.junctionBoxes, motorLocations: Object.entries(m.motorLocations).map(([motorTag, location]) => ({ motorTag, location })), routing: Object.entries(m.routing).map(([deviceTag, junctionBox]) => ({ deviceTag, junctionBox })) },
  };
  if (system.includes('HMI designer')) return { explanation: 'Three screens.', screens: F.HMI.screens, alarms: F.HMI.alarms, tags: F.HMI.tags, notes: [] };
  if (system.includes('ladder logic')) return { explanation: 'Program written.', program: F.LADDER };
  throw { code: 'refused', message: 'unknown prompt' };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  // Nothing may go to the AI services directly from the preview.
  const direct = [];
  await page.route(/api\.(anthropic|openai)\.com/, (r) => { direct.push(r.request().url()); r.abort(); });

  await page.exposeFunction('__reply', (system) => JSON.stringify(reply(system)));
  await page.addInitScript(() => {
    window.__calls = [];
    window.__saves = [];
    window.__mode = 'ok';
    const run = async (input, options, json) => {
      window.__calls.push({ input, options: { ...options, images: options?.images?.length ?? 0 }, json, size: JSON.stringify(input).length });
      await new Promise((r) => setTimeout(r, 50));
      if (window.__mode !== 'ok') throw { code: window.__mode, message: 'fake ' + window.__mode };
      const value = JSON.parse(await window.__reply(input[0].content));
      return json ? value : { text: typeof value === 'string' ? value : JSON.stringify(value), truncated: false };
    };
    const sample = (input, options) => run(input, options, false);
    sample.json = (input, options) => run(input, options, true);
    const downloads = {
      save: async ({ filename, data }) => {
        const buf = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new TextEncoder().encode(String(data));
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        window.__saves.push({ filename, type: data?.type ?? typeof data, b64: btoa(bin) });
        return { status: 'saved' };
      },
    };
    window.claude = { use: async (name) => (name === 'sample' ? sample : name === 'downloads' ? downloads : null) };
  });

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/#/spec');
  await page.waitForTimeout(800);
  log('Preview banner:', await page.getByText('Preview with an example project').count() > 0);

  // Settings: no key needed; test connection runs through the account; runtime errors in plain English.
  await page.goto(BASE + '/#/settings');
  const keyBox = page.getByPlaceholder('Not needed in the preview');
  check(await keyBox.inputValue() === '', 'no API key shown in the preview');
  const test = async (mode) => {
    await page.evaluate((m) => { window.__mode = m; }, mode);
    await page.getByRole('button', { name: 'Test connection' }).click();
    await page.getByRole('button', { name: 'Test connection' }).waitFor();
    return page.locator('[role=status]').innerText();
  };
  const msgs = {};
  for (const mode of ['ok', 'not_granted', 'rate_limited', 'session_expired', 'weird_new_code']) msgs[mode] = await test(mode);
  for (const [k, v] of Object.entries(msgs)) log(`Test connection ${k}:`, v);
  check(/^✓ Connected/.test(msgs.ok), 'ok');
  check(/not allowed for this page/.test(msgs.not_granted), 'not_granted');
  check(/usage limit/.test(msgs.rate_limited), 'rate_limited');
  check(/session expired/.test(msgs.session_expired), 'session_expired');
  check(/could not answer right now \(weird_new_code\)/.test(msgs.weird_new_code), 'unknown code');
  check(!/[{}]/.test(Object.values(msgs).join('')), 'no raw JSON in messages');
  await page.evaluate(() => { window.__mode = 'ok'; });

  // AI buttons are enabled without a key and send well-formed prompts.
  const clickAi = async (path, name, done) => {
    await page.goto(BASE + '/#' + path);
    const btn = page.getByRole('button', { name }).first();
    await btn.waitFor({ timeout: 10000 });
    check(await btn.isEnabled(), `${name} enabled without an API key`);
    await btn.click();
    await done();
  };
  await clickAi('/equipment', /Suggest (again|equipment)/, () => page.getByText('AI suggestion:').waitFor({ timeout: 10000 }));
  await clickAi('/io', /I\/O from spec/, () => page.getByText('Review I/O changes').waitFor({ timeout: 10000 }));
  await page.getByRole('button', { name: 'Cancel' }).click();
  await clickAi('/electrical?tab=design', /Generate (New|Electrical) Design/, () => page.waitForFunction(() => location.hash.includes('tab=cabinet'), null, { timeout: 20000 }));
  await clickAi('/hmi', /Redesign screens|Design the HMI screens/, () => page.getByRole('button', { name: 'Redesign screens' }).waitFor({ timeout: 20000 }));

  await page.goto(BASE + '/#/program');
  await page.getByRole('button', { name: 'Describe' }).click();
  {
    const n = await page.evaluate(() => window.__calls.length);
    const btn = page.getByRole('button', { name: /Generate (New )?Program/ });
    check(await btn.isEnabled(), 'Generate Program enabled without an API key');
    await btn.click();
    await page.waitForFunction((k) => window.__calls.length > k, n, { timeout: 10000 });
    await page.waitForTimeout(1500);
  }
  const calls = await page.evaluate(() => window.__calls);
  for (const c of calls) {
    const first = c.input[0];
    const schemaAt = first.content.indexOf('OUTPUT FORMAT:');
    let schemaOk = schemaAt < 0;
    if (schemaAt >= 0) { try { JSON.parse(first.content.slice(first.content.indexOf('\n', schemaAt) + 1)); schemaOk = true; } catch { schemaOk = false; } }
    const turnsOk = c.input.every((t) => ['user', 'assistant'].includes(t.role) && typeof t.content === 'string' && t.content.length > 0) && c.input[c.input.length - 1].role === 'user';
    log(`AI call: ${first.content.slice(0, 60).replace(/\s+/g, ' ')}… | ${(c.size / 1024).toFixed(1)} KiB | json ${c.json} | schema ${schemaAt >= 0 ? (schemaOk ? 'ok' : 'BROKEN') : 'none'} | tier ${c.options.modelTier} effort ${c.options.effort}`);
    check(first.role === 'user' && first.content.length > (c.json ? 500 : 10), 'system text sent first');
    check(!c.json || schemaAt >= 0, 'json call carries the schema instruction');
    check(schemaOk && turnsOk, 'prompt well-formed');
    check(c.size < MAX_PROMPT, `prompt under 256 KiB (${c.size})`);
  }
  check(calls.filter((c) => c.json).length >= 5, 'all AI calls went through the account');

  // Generation error from the runtime shows up in plain English.
  await page.evaluate(() => { window.__mode = 'rate_limited'; });
  await page.goto(BASE + '/#/equipment');
  await page.getByRole('button', { name: /Suggest (again|equipment)/ }).click();
  const alert = page.locator('[role=alert]');
  await alert.waitFor({ timeout: 10000 });
  log('Generation error:', await alert.innerText());
  check(/usage limit/.test(await alert.innerText()), 'rate_limited generation error');
  await page.evaluate(() => { window.__mode = 'ok'; });

  // Saves: as-is or zipped.
  const saves = async () => page.evaluate(() => window.__saves.splice(0));
  await page.goto(BASE + '/#/export');
  for (const name of ['Excel report', 'BOM CSV', 'Back panel DXF', 'Cabinet STEP', 'Engineering package']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => window.__saves.length > 0, null, { timeout: 120000 });
    for (const s of await saves()) {
      const buf = Buffer.from(s.b64, 'base64');
      fs.writeFileSync(OUT + s.filename, buf);
      let inner = '';
      if (s.filename.endsWith('.zip')) inner = ' → ' + Object.keys((await JSZip.loadAsync(buf)).files).join(', ');
      log(`Saved (${name}): ${s.filename} ${Math.round(buf.length / 1024)} KB ${s.type}${inner}`);
      const ext = s.filename.split('.').slice(-2).join('.');
      if (/DXF|STEP/.test(name)) check(/\.(dxf|step)\.zip$/.test(s.filename) && inner.includes(s.filename.replace(/\.zip$/, '')), `${name} zipped with the original name`);
      else check(!s.filename.endsWith('.zip') || name === 'Download everything', `${name} saved as-is (${ext})`);
      if (s.filename.endsWith('.pdf')) check(buf.subarray(0, 5).toString() === '%PDF-', 'pdf content');
      if (s.filename.endsWith('.xlsx')) check(buf[0] === 0x50 && buf[1] === 0x4b, 'xlsx content');
    }
  }
  await page.goto(BASE + '/#/electrical?tab=machining');
  await page.getByRole('button', { name: 'Front door DXF' }).click();
  await page.waitForFunction(() => window.__saves.length > 0);
  const [dxf] = await saves();
  log('Machining save:', dxf.filename);
  check(dxf.filename.endsWith('.dxf.zip'), 'machining DXF zipped');

  log('Direct API requests:', direct.length ? direct : 'none');
  log('Dialogs:', dialogs.length ? dialogs : 'none');
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (direct.length) throw new Error('preview called an AI API directly');
  if (errors.length) throw new Error(`${errors.length} page/console error(s)`);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
