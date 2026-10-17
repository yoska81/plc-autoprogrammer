// User walk-through of the PREVIEW build at 1366x768 with a fake Claude runtime: a new project from the
// wizard through description (with questions), equipment, I/O, electrical (all tabs), HMI (picture editor),
// program, simulation, design review and deliverables. Screenshots of every page (scrolled) go to
// e2e/out-walkthrough/ for a human look; page errors fail the run.
//   VITE_PREVIEW=1 npx vite build --config vite.preview.config.ts && npx http-server dist-preview -p 5203 -s &
//   BASE_URL=http://localhost:5203 node e2e/walkthrough.preview.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-walkthrough');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));
const log = (...a) => console.log('•', ...a);

const IO_POINTS = [
  ['E-Stop OK (safety relay)', 'input', 'Safety', 'safety-relay-output'],
  ['Start Button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Stop Button', 'input', 'Operator/HMI', 'pushbutton-nc'],
  ['Part at end photo-eye', 'input', 'Product Detection', 'sensor-pnp'],
  ['Pusher extended', 'input', 'Pneumatic', 'sensor-pnp'],
  ['Conveyor motor contactor', 'output', 'Conveyor', 'contactor-coil'],
  ['Pusher solenoid', 'output', 'Pneumatic', 'solenoid'],
].map(([description, type, category, deviceType]) => ({ description, type, category, deviceType, reason: 'spec' }));

function reply(system) {
  const m = F.DESIGN.machine;
  if (system.includes('checks a machine control design')) return F.REVIEW;
  if (system.includes('functional specification')) return { sections: F.SPEC, questions: ['How many parts per minute at most?', 'Is the pusher air-operated or electric?'], summary: 'Organized the description into 10 sections.' };
  if (system.includes('choosing the control equipment')) return F.RECOMMENDATION;
  if (system.includes('complete discrete PLC I/O list')) return { explanation: '5 inputs, 2 outputs.', points: IO_POINTS, questions: [] };
  if (system.includes('industrial control panel')) return {
    explanation: 'NEMA 12 panel, 480 VAC.', components: F.DESIGN.components, ioWiring: F.DESIGN.ioWiring, notes: F.DESIGN.notes, motors: F.DESIGN.inputs.motors,
    machine: { zones: m.zones, junctionBoxes: m.junctionBoxes, motorLocations: Object.entries(m.motorLocations).map(([motorTag, location]) => ({ motorTag, location })), routing: Object.entries(m.routing).map(([deviceTag, junctionBox]) => ({ deviceTag, junctionBox })) },
  };
  if (system.includes('HMI designer')) return { explanation: 'Three screens.', screens: F.HMI.screens, alarms: F.HMI.alarms, tags: F.HMI.tags, notes: ['Confirm the maintenance password.'] };
  if (system.includes('ladder logic')) return { explanation: 'Program written from the spec.', program: F.LADDER };
  throw { code: 'refused', message: 'unknown prompt' };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.exposeFunction('__reply', (system) => JSON.stringify(reply(system)));
  await page.addInitScript(() => {
    const run = async (input, options, json) => {
      await new Promise((r) => setTimeout(r, 30));
      const v = JSON.parse(await window.__reply(input[0].content));
      return json ? v : { text: JSON.stringify(v), truncated: false };
    };
    const sample = (i, o) => run(i, o, false);
    sample.json = (i, o) => run(i, o, true);
    window.claude = { use: async (n) => (n === 'sample' ? sample : n === 'downloads' ? { save: async () => ({ status: 'saved' }) } : null) };
  });

  let n = 0;
  const shot = async (name) => {
    const base = `${String(++n).padStart(2, '0')}_${name}`;
    await page.screenshot({ path: path.join(OUT, `${base}.png`) });
    // Scroll the page's main scroller and take more shots while there is more below.
    for (let k = 1; k <= 4; k++) {
      const more = await page.evaluate((k) => {
        const el = [...document.querySelectorAll('main *, body > div *')].find((e) => {
          const s = getComputedStyle(e);
          return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300;
        });
        if (!el) return false;
        const before = el.scrollTop;
        el.scrollTop = k * (el.clientHeight - 80);
        return el.scrollTop > before;
      }, k);
      if (!more) break;
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${base}_${k}.png`) });
    }
    await page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
  };
  const go = async (route) => { await page.goto(`${BASE}/#${route}`); await page.waitForTimeout(900); };
  const click = async (name, opts = {}) => { await page.getByRole('button', { name, ...opts }).first().click(); };

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/#/spec');
  await page.waitForTimeout(1000);
  await shot('first_open');

  // Wizard
  await click('New project');
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Bottle Capper');
  await shot('wizard_1_project_data');
  await click('Next →');
  await page.locator('textarea').first().fill('A conveyor brings bottles to a capping station. A photo-eye sees the bottle, a stopper cylinder holds it, the capper screws the cap on, then the stopper releases. E-stop and a guard door. 7 inch touch screen.');
  await click('Add to spec');
  await page.getByText('Organized the description').waitFor({ timeout: 15000 });
  await shot('wizard_2_described');
  await click('Next →');
  await click(/Suggest for me/);
  await page.getByRole('button', { name: /Suggest again/ }).waitFor({ timeout: 15000 });
  await shot('wizard_3_equipment');
  await click('Use this selection');
  await click('Next →');
  await shot('wizard_4_summary');
  await click('Open project →');
  await page.waitForTimeout(800);
  await shot('after_wizard');

  await go('/spec');
  await shot('description');
  await go('/equipment');
  await shot('equipment');

  await go('/io');
  await click(/I\/O from spec/);
  await page.getByText('Review I/O changes').waitFor({ timeout: 15000 });
  await shot('io_review');
  await click('Apply changes');
  await shot('io');

  await go('/electrical?tab=design');
  await shot('electrical_before');
  await click(/Generate (Electrical Design|New Design)/);
  await page.waitForFunction(() => location.hash.includes('tab=cabinet'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const t of ['design', 'cabinet', 'machine', 'picture', 'machining', 'labels']) { await go(`/electrical?tab=${t}`); await page.waitForTimeout(700); await shot(`electrical_${t}`); }

  await go('/hmi');
  await shot('hmi_before');
  await click(/Design the HMI screens/);
  await page.getByRole('button', { name: 'Redesign screens' }).waitFor({ timeout: 20000 });
  await shot('hmi');
  await click('Edit screen');
  await page.locator('input[aria-label="Upload background picture"]').setInputFiles(path.join(__dirname, '..', 'build', 'icon.png'));
  await page.waitForTimeout(700);
  await click('Add Push button');
  await shot('hmi_editor');
  await click('Done editing');

  await go('/program');
  await shot('program_before');
  await page.getByRole('button', { name: 'Build', exact: true }).click().catch(() => {});
  await click(/Generate (New )?Program/);
  await page.waitForTimeout(2500);
  await shot('program');

  await go('/simulate');
  await shot('simulate');
  await go('/review');
  await page.waitForTimeout(1500);
  await shot('review');
  await go('/project');
  await shot('project_data');
  await go('/export');
  await shot('deliverables');
  await go('/settings');
  await shot('settings');

  log('Screenshots:', fs.readdirSync(OUT).length, 'in', OUT);
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
