// Servo axes, encoders and ultrasonic level / distance on the HMI: a machine with two servo axes, an
// encoder and two ultrasonic sensors, designed by the rules for a 7" and a 4.3" panel; every Motion,
// Process and Setup screen in every look is drawn with no text past its element and no two elements'
// texts on top of each other (the live limit marks on the level bars are checked in src/hmi/engine/motion.test.ts).
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-motion.e2e.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-hmi-motion');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };
/** The large screen on the HMI page (the screen list's thumbnails carry the same aria-label). */
const mainSvg = (page) => page.evaluateHandle(() => [...document.querySelectorAll('svg[aria-label^="HMI screen:"]')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]);

/** In the page: texts past their element, and texts of different elements on top of each other. */
function measure(els) {
  // The large screen (the screen list's thumbnails carry the same label).
  const svg = [...document.querySelectorAll('svg[aria-label^="HMI screen:"]')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  const out = [];
  const texts = [];
  const byId = Object.fromEntries(els.map((e) => [e.id, e]));
  for (const g of svg.querySelectorAll('g[data-el]')) {
    const el = byId[g.getAttribute('data-el')];
    if (!el) continue;
    for (const tx of g.querySelectorAll('text')) {
      if (!tx.textContent.trim()) continue;
      const b = tx.getBBox();
      const slack = 1.5;
      if (el.kind !== 'machine' && (b.x < el.x - slack || b.y < el.y - slack || b.x + b.width > el.x + el.w + slack || b.y + b.height > el.y + el.h + slack)) {
        out.push(`“${tx.textContent}” runs past its ${el.kind} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)} in ${el.x},${el.y} ${el.w}×${el.h})`);
      }
      if (/…$/.test(tx.textContent) && !['header', 'alarm-list', 'alarm-banner', 'machine'].includes(el.kind)) out.push(`“${tx.textContent}” is cut off in its ${el.kind}`);
      if (el.kind !== 'panel' && el.kind !== 'machine') texts.push({ id: el.id, t: tx.textContent, b });
    }
  }
  for (let a = 0; a < texts.length; a++) for (let c = a + 1; c < texts.length; c++) {
    const p = texts[a], q = texts[c];
    if (p.id === q.id) continue;
    if (p.b.x < q.b.x + q.b.width - 1 && q.b.x < p.b.x + p.b.width - 1 && p.b.y < q.b.y + q.b.height - 1 && q.b.y < p.b.y + p.b.height - 1) out.push(`“${p.t}” overlaps “${q.t}”`);
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  for (const panel of [{ pn: 'CM5-T7W', w: 800, h: 480 }, { pn: 'CM5-T4W', w: 480, h: 272 }]) {
    // The rules design the screens for a machine with servo axes, an encoder and ultrasonic sensors.
    const info = await page.evaluate(async (panel) => {
      const { buildHmi, defaultHmiContent } = await import('/src/hmi/engine/index.ts');
      const { getCpu, getProfile } = await import('/src/plc/core/profiles/index.ts');
      const { resolveAddresses } = await import('/src/plc/core/profile.ts');
      const { moduleSlots } = await import('/src/plc/core/modules.ts');
      const { useHmiStore } = await import('/src/store/useHmiStore.ts');
      const pts = [
        ['E-Stop OK (safety relay)', 'input'], ['Start Button', 'input'], ['Stop Button', 'input'],
        ['Axis 1 Servo Ready', 'input', 'Servo/Axis'], ['Axis 1 Servo Fault', 'input', 'Servo/Axis'], ['Axis 1 Home Complete', 'input', 'Servo/Axis'],
        ['Axis 1 In Position', 'input', 'Servo/Axis'], ['Axis 1 Positive Limit', 'input', 'Servo/Axis'], ['Axis 1 Negative Limit', 'input', 'Servo/Axis'],
        ['Axis 1 Servo Enable', 'output', 'Servo/Axis'], ['Turntable servo fault', 'input'], ['Turntable servo enable', 'output'],
        ['Conveyor encoder A', 'input'], ['Conveyor encoder B', 'input'], ['Conveyor motor contactor', 'output'],
      ].map(([description, type, category], i) => ({ id: `p${i}`, description, type, category: category ?? 'Operator/HMI' }));
      pts.push({ id: 'a1', description: 'Tank level (ultrasonic)', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 2000, units: 'mm' } });
      pts.push({ id: 'a2', description: 'Distance to roll (ultrasonic)', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '0-10V', min: 50, max: 1000, units: 'mm' } });
      const profile = getProfile('click');
      const addresses = resolveAddresses(profile, getCpu(profile, 'C0-10DD1E-D'), pts, moduleSlots(['C0-08ND3', 'C0-08TD1', 'C0-04AD-1']));
      const design = buildHmi(defaultHmiContent({ io: pts, addresses, machineName: 'Pick and place' }), { partNumber: panel.pn, widthPx: panel.w, heightPx: panel.h });
      useHmiStore.getState().setHmiPartNumber(panel.pn);
      useHmiStore.getState().setDesign(design, null);
      return { screens: design.screens.map((s) => s.name), looks: (await import('/src/hmi/theme.ts')).HMI_LOOKS };
    }, panel);
    log(`${panel.pn}: ${info.screens.join(', ')}`);
    check(info.screens.some((n) => /^Motion/.test(n)), `${panel.pn}: Motion screen`);

    await page.goto(BASE + '/hmi');
    await page.waitForTimeout(800);
    const buttons = page.locator('nav[aria-label="Screens"] > button');
    const names = await buttons.allInnerTexts();
    const wanted = names.map((n, i) => ({ n, i })).filter(({ n }) => /(Motion|Process|Setup)/.test(n));
    // The page shows the design built above (its Motion screens), never a stale or empty list.
    check(wanted.length > 0 && names.some((n) => /Motion/.test(n)), `${panel.pn}: the page shows the Motion / Setup screens (${names.length} screens)`);
    for (const look of info.looks) {
      await page.evaluate(async (look) => { const { useHmiStore } = await import('/src/store/useHmiStore.ts'); const s = useHmiStore.getState(); s.setDesign({ ...s.design, look }, null); }, look);
      for (const { i } of wanted) {
        await buttons.nth(i).click();
        await page.waitForTimeout(50);
        const design = await page.evaluate(async () => (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design);
        const screenName = (await buttons.nth(i).innerText()).replace(/^\d+\.\s*/, '').split('\n')[0];
        const screen = design.screens.find((s) => s.name === screenName) ?? design.screens[i];
        const found = await page.evaluate(measure, screen.elements);
        check(found.length === 0, `${panel.pn} ${look} / ${screen.name}: ${found.slice(0, 4).join('; ')}`);
        if (/^Motion/.test(screen.name) && ['dark', 'siemens', 'weintek', 'isa101'].includes(look)) {
          await (await mainSvg(page)).screenshot({ path: path.join(OUT, `${panel.pn}_${look}_${screen.id}.png`) });
        }
      }
    }
    log(`${panel.pn}: ${wanted.length} screens × ${info.looks.length} looks checked`);
  }

  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
  console.log('hmi-motion e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
