// Page sweep: every page at 1366x768 and 1920x1080, with an empty project and with the example project.
// Fails on console/page errors, horizontal page overflow, controls pushed off-screen and unreadable text
// (contrast below 3:1, or light text on the old lime brand colour).
//
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/sweep.e2e.cjs
// Screenshots land in e2e/out-sweep/.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-sweep/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const HASH = process.env.HASH === '1'; // preview build (hash routing, example project seeded)
const log = (...a) => console.log('•', ...a);

const ROUTES = ['/spec', '/project', '/equipment', '/io', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine', '/electrical?tab=layout',
  '/electrical?tab=picture', '/electrical?tab=machining', '/electrical?tab=labels', '/electrical?tab=lists', '/hmi', '/program', '/simulate', '/review', '/export', '/settings', '/plc', '/import', '/new'];
const VIEWPORTS = [[1366, 768], [1920, 1080]];

/** Runs in the page: layout and readability problems. */
function audit() {
  const out = [];
  const W = window.innerWidth;
  const doc = document.scrollingElement;
  if (doc.scrollWidth > W + 1) out.push(`page scrolls sideways (${doc.scrollWidth} > ${W})`);
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null; // gradients/images: skip
      const c = parse(s.backgroundColor);
      if ((c[3] ?? 1) > 0.5) return c;
    }
    return [255, 255, 255];
  };
  const isLime = ([r, g, b]) => g > 190 && r > 150 && b < 140 && g > b + 80;
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || !el.childNodes.length) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!/[\p{L}\p{N}]/u.test(text)) continue; // separators like "|" are decoration
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) < 0.6) continue;
    if (el.closest('[disabled], .opacity-40, .opacity-50, .opacity-60')) continue; // disabled controls are dim on purpose
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (!bg) continue;
    const cr = ratio(fg, bg);
    const key = `${text.slice(0, 30)}|${s.color}|${bg}`;
    if (seen.has(key)) continue;
    if (isLime(bg) && lum(fg) > 0.5) { seen.add(key); out.push(`light text on lime: "${text.slice(0, 40)}" (${s.color})`); }
    else if (cr < 3 && !(el.tagName === 'OPTION')) { seen.add(key); out.push(`low contrast ${cr.toFixed(2)}: "${text.slice(0, 40)}" ${s.color} on rgb(${bg.slice(0, 3)})`); }
  }
  for (const el of document.querySelectorAll('button, a, input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // Only things the page itself can't scroll to: past the right edge of a non-scrolling ancestor.
    if (r.left > W - 2 || r.right > W + 2) {
      let scrollable = false;
      for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth) { scrollable = true; break; } }
      if (!scrollable) out.push(`control off-screen: ${el.tagName} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').slice(0, 30)}" right=${Math.round(r.right)}`);
    }
  }
  return out;
}

/**
 * Analog points on the example project: an input and an output switched to analog with a range and units in
 * the I/O list, then the analog drawing sheet, the simulator slider and an HMI bar graph bound to the input.
 */
async function analogPass(browser, problems) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const check = async (name) => {
    await page.screenshot({ path: `${OUT}analog_${name}.png` });
    const found = await page.evaluate(audit);
    for (const e of errors.splice(0)) found.push('error: ' + e.slice(0, 200));
    if (found.length) { problems.push([`analog_${name}`, found]); log(`analog_${name}`, '\n   - ' + found.slice(0, 12).join('\n   - ')); }
  };
  const fail = (msg) => { problems.push(['analog', [msg]]); log('analog:', msg); };

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // An analog input and an analog output module (the example CPU has no analog channels).
  await page.goto(BASE + '/equipment');
  await page.waitForTimeout(800);
  for (const part of ['C0-04AD-1', 'C0-04DA-1']) {
    await page.getByRole('button', { name: '+ Add module' }).click();
    await page.locator('select').filter({ has: page.locator(`option[value="${part}"]`) }).last().selectOption(part);
  }
  await page.getByRole('button', { name: 'Use this selection' }).first().click();
  await page.waitForTimeout(500);
  await check('equipment');

  // I/O list: a (non-safety) input and an output become analog, with range, scale and units.
  await page.goto(BASE + '/io');
  await page.waitForTimeout(800);
  const made = [];
  for (const kind of ['input', 'output']) {
    const id = await page.evaluate((kind) => {
      const rows = [...document.querySelectorAll('tr')].filter((r) => [...r.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Discrete'));
      const re = kind === 'input' ? /^I\d/ : /^Q\d/;
      const row = rows.find((r) => re.test(r.querySelector('td')?.textContent.trim() ?? '') && !/Safety/.test(r.querySelector('select')?.value ?? ''));
      return row?.querySelector('td')?.textContent.trim() ?? null;
    }, kind);
    if (!id) { fail(`no discrete ${kind} row to switch`); continue; }
    const row = page.locator('tr', { has: page.locator(`[aria-label="Description of ${id}"]`) });
    await row.getByRole('button', { name: 'Discrete' }).click();
    await page.locator(`select[aria-label="Signal range of ${id}"]`).selectOption('4-20mA');
    await page.locator(`input[aria-label="Scale minimum of ${id}"]`).fill('0');
    await page.locator(`input[aria-label="Scale minimum of ${id}"]`).blur();
    await page.locator(`input[aria-label="Scale maximum of ${id}"]`).fill(kind === 'input' ? '150' : '60');
    await page.locator(`input[aria-label="Scale maximum of ${id}"]`).blur();
    await page.locator(`input[aria-label="Units of ${id}"]`).fill(kind === 'input' ? 'psi' : 'Hz');
    await page.locator(`input[aria-label="Units of ${id}"]`).blur();
    const desc = await page.locator(`[aria-label="Description of ${id}"]`).inputValue();
    const address = (await page.locator(`[aria-label="PLC address for ${id}"]`).getAttribute('placeholder')) || '';
    made.push({ kind, id, desc, address });
  }
  const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /io/i.test(k)).map(([, v]) => v).join(' '));
  if (!/"units":"psi"/.test(stored) || !/"max":150/.test(stored)) fail('analog range/units not saved in the I/O store');
  log('analog points:', made.map((m) => `${m.kind} ${m.id} ${m.address} "${m.desc}"`).join('; '));
  await check('io');

  // Drawings: an analog loop sheet exists and renders.
  for (const tab of ['cabinet', 'machine']) {
    await page.goto(`${BASE}/electrical?tab=${tab}`);
    await page.waitForTimeout(1200);
    const t = page.locator('nav[aria-label="Drawing sheets"] button[title*="ANALOG"]');
    if (await t.count()) {
      await t.first().click();
      await page.waitForTimeout(800);
      // The sheet list and the stacked sheets are in the same order.
      const i = (await page.locator('nav[aria-label="Drawing sheets"] button[title]').evaluateAll((bs) => bs.map((b) => b.title))).findIndex((t) => t.includes('ANALOG'));
      const svgText = (await page.locator('[data-sheet]').nth(i).textContent().catch(() => '')) ?? '';
      if (!svgText.includes('psi') && !svgText.includes(made[0]?.address ?? '§')) fail('analog sheet does not show the analog input');
      await check(`drawing_${tab}`);
      break;
    }
    if (tab === 'machine') fail('no ANALOG drawing sheet');
  }

  // Simulator: a slider for the analog input; moving it changes the shown value.
  await page.goto(BASE + '/simulate');
  await page.waitForTimeout(1500);
  const slider = page.locator('input[type="range"][aria-label$=" value"]');
  if (!(await slider.count())) fail('no analog slider in the simulator');
  else {
    const s = slider.first();
    if ((await s.getAttribute('max')) !== '150') fail(`slider max is ${await s.getAttribute('max')}, expected 150`);
    await s.evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '75'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(300);
    if (Number(await s.inputValue()) !== 75) fail('slider did not take the value');
  }
  await check('simulate');

  // HMI: add a bar graph bound to the analog input's address.
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(1500);
  const edit = page.getByRole('button', { name: 'Edit screen' });
  if (!(await edit.count())) fail('HMI has no Edit screen button');
  else {
    await edit.click();
    await page.getByRole('button', { name: 'Add Bar graph' }).click();
    await page.waitForTimeout(300);
    const addr = made.find((m) => m.kind === 'input')?.address;
    if (addr) {
      await page.locator('input[aria-label="PLC address"]').fill(addr);
      await page.locator('input[aria-label="PLC address"]').blur();
      // A-19: the bar takes the analog point's scale (0–150 psi).
      const got = `${await page.getByLabel('Min', { exact: true }).inputValue()}-${await page.getByLabel('Max', { exact: true }).inputValue()} ${await page.getByLabel('Units', { exact: true }).inputValue()}`;
      if (got !== '0-150 psi') fail(`HMI bar on ${addr} shows ${got}, expected the point's 0-150 psi`);
    }
    await check('hmi_editor');
    await page.getByRole('button', { name: 'Done editing' }).click();
    await page.waitForTimeout(500);
    await check('hmi');
  }
  await ctx.close();
}

/** IEC regions: the example switched to Europe / Israel at 400 V; every electrical page, Project data and Deliverables. */
async function iecPass(browser, problems, region) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/project');
  await page.locator('select[aria-label="Electrical code"]').selectOption(region);
  const opts = await page.evaluate(() => ['Device designations', 'Drawing symbols', 'Sheet size'].map((l) => document.querySelector(`select[aria-label="${l}"]`)?.value));
  if (opts.join() !== 'iec81346,iec60617,A3') problems.push([`iec_${region}`, [`region defaults not applied: ${opts.join()}`]]);
  // Stand-in for a design regenerated for the region: the example's design at 400 V 50 Hz.
  await page.evaluate(async () => {
    const { useElectricalStore: E } = await import('/src/store/useElectricalStore.ts');
    const d = E.getState().design;
    E.setState({ design: { ...d, inputs: { ...d.inputs, supply: '400VAC-3PH', motors: d.inputs.motors.map((m) => ({ ...m, voltage: '400VAC-3PH' })) } } });
  });
  for (const route of ['/project', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine', '/electrical?tab=labels', '/review', '/export']) {
    await page.goto(BASE + route);
    await page.waitForTimeout(route.includes('electrical') ? 1500 : 800);
    const name = `iec_${region}_${route.replace(/\W+/g, '_').replace(/^_|_$/g, '')}`;
    await page.screenshot({ path: `${OUT}${name}.png` });
    const found = await page.evaluate(audit);
    if (route === '/electrical?tab=cabinet') {
      const svg = await page.locator('main svg').first().textContent();
      if (!/400\/230V 50Hz/.test(svg) || !/IEC 60204-1/.test(svg)) found.push('cover sheet is not IEC (supply / IEC 60204-1 notes missing)');
      if (/NFPA 79 13\.2\.4/.test(svg)) found.push('cover sheet still shows the NFPA colour table');
      // A3 sheets (not ANSI B letterboxed), -X terminal strips, wire numbers without "-", kW motors.
      const vb = await page.locator('main svg[viewBox]').first().getAttribute('viewBox');
      if (vb !== '0 0 420 297') found.push(`sheet is not A3 (viewBox ${vb})`);
      const all = (await page.locator('main [data-sheet]').allTextContents()).join(' ');
      if (!/A3 420 x 297 mm/.test(all)) found.push('title block does not say A3');
      if (/ANSI B/.test(all)) found.push('title block still says ANSI B');
      if (/\bTB\d/.test(all)) found.push(`terminal strip named TB…: ${all.match(/.{20}\bTB\d.{10}/)?.[0]}`);
      if (/(^|\s)-[A-Z]\d+-[LCT]\d/.test(all)) found.push(`wire number with a prefix sign: ${all.match(/(^|\s)-[A-Z]\d+-[LCT]\d/)?.[0]}`);
      if (/\d HP\b/.test(all)) found.push(`motor power in HP: ${all.match(/.{15}\d HP\b/)?.[0]}`);
    }
    for (const e of errors.splice(0)) found.push('error: ' + e.slice(0, 200));
    if (found.length) { problems.push([name, found]); log(name, '\n   - ' + found.slice(0, 12).join('\n   - ')); }
  }
  // The drawings PDF: every page A3 (1190.55 x 841.89 pt).
  const pdf = await page.evaluate(async () => {
    const { buildDrawingsPdf } = await import('/src/deliverables/files.ts');
    const { collectProject } = await import('/src/deliverables/collect.ts');
    const blob = await buildDrawingsPdf(collectProject());
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    const boxes = [...text.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number).slice(2).map((v) => Math.round(v)).join('x'));
    return { pages: boxes.length, sizes: [...new Set(boxes)] };
  });
  log(`iec ${region}: drawings PDF ${pdf.pages} pages, ${pdf.sizes.join(', ')} pt`);
  if (!pdf.pages || pdf.sizes.join() !== '1191x842') problems.push([`iec_${region}_pdf`, [`drawings PDF pages are not A3: ${pdf.sizes.join(', ')}`]]);
  log(`iec ${region}: done`);
  await ctx.close();
}

/**
 * A project copied from the example with the user's own description (the "Sealing Head" case): the
 * leftover warnings on Electrical motors and Program notes, and the "Start clean" banner, must show
 * and the pages must audit clean with them on.
 */
async function copiedExamplePass(browser, problems) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.evaluate(async () => {
    const ps = await import('/src/store/useProjectsStore.ts');
    ps.addProjectFromData('Sealing Head', ps.activeProjectData().data);
    const { useSpecStore } = await import('/src/store/useSpecStore.ts');
    const { EMPTY_SECTIONS } = await import('/src/spec/types.ts');
    useSpecStore.getState().setSections({ ...EMPTY_SECTIONS, overview: 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple.' });
    (await import('/src/store/useProgramStore.ts')).useProgramStore.getState().setUserPrompt('Conveyor pusher: keep the pusher retracted while the conveyor runs; batch counter on the photo-eye.');
  });
  for (const [route, testid] of [['/spec', 'start-clean'], ['/project', 'start-clean'], ['/electrical?tab=design', 'leftover-motor'], ['/program', 'leftover-notes']]) {
    await page.goto(BASE + route);
    await page.waitForTimeout(route.includes('electrical') ? 1500 : 800);
    if (route === '/program') { const d = page.getByRole('button', { name: 'Build', exact: true }); if (await d.count()) { await d.first().click(); await page.waitForTimeout(300); } }
    const name = `copied_${route.replace(/\W+/g, '_').replace(/^_|_$/g, '')}`;
    await page.screenshot({ path: `${OUT}${name}.png` });
    const found = await page.evaluate(audit);
    if (!(await page.getByTestId(testid).count())) found.push(`"${testid}" warning not shown`);
    for (const e of errors.splice(0)) found.push('error: ' + e.slice(0, 200));
    if (found.length) { problems.push([name, found]); log(name, '\n   - ' + found.slice(0, 12).join('\n   - ')); }
  }
  log('copied example: leftover warnings shown');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const scenario of HASH ? ['example'] : ['empty', 'example']) {
    for (const [w, h] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
      page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
      await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
      await page.goto(BASE);
      if (!HASH) {
        await page.evaluate(() => localStorage.clear());
        if (scenario === 'example') {
          // The dev build has no example project: load the preview seed through the module graph.
          await page.goto(BASE + '/spec');
          await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
          // The example is its own project: open it.
          await page.goto(BASE + '/spec');
          await page.locator('select[aria-label="Open project"]').selectOption('p_example');
          if ((await page.locator('select[aria-label="Open project"]').inputValue()) !== 'p_example') throw new Error('example project not opened');
        }
      }
      for (const route of ROUTES) {
        const url = HASH ? `${BASE}/#${route}` : BASE + route;
        await page.goto(url);
        if (HASH) await page.reload();
        await page.waitForTimeout(route.includes('electrical') || route === '/hmi' || route === '/simulate' ? 1500 : 600);
        const name = `${scenario}_${w}_${route.replace(/\W+/g, '_').replace(/^_|_$/g, '')}`;
        await page.screenshot({ path: `${OUT}${name}.png` });
        const found = await page.evaluate(audit);
        for (const e of errors.splice(0)) found.push('error: ' + e.slice(0, 200));
        if (found.length) { problems.push([name, found]); log(name, '\n   - ' + found.slice(0, 12).join('\n   - ')); }
      }
      await ctx.close();
    }
  }
  if (!HASH) await analogPass(browser, problems);
  if (!HASH) for (const region of ['EU', 'Israel']) await iecPass(browser, problems, region);
  if (!HASH) await copiedExamplePass(browser, problems);
  await browser.close();
  log(`${problems.length} page(s) with problems`);
  if (problems.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
