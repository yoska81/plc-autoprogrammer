// HMI QA fixes on the example project: layout check reports cut-off text and unreachable screens;
// screen access goes through undo (Ctrl+Z while the editor is open, focus anywhere); renaming a
// screen renames its nav buttons; background -> movable picture keeps zoom / offset / dim; the
// 128x64 C-more Micro is refused; setpoints are typed on the live HMI's keypad (limits enforced);
// an Allen-Bradley project shows the PLC's tag names in the Tags tab and the element editor.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-qa.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

async function open(browser) {
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
  return { page, errors };
}
const screenButton = (page, name) => page.locator('nav[aria-label="Screens"] > button', { has: page.locator('span', { hasText: new RegExp(`^\\d+\\. ${name}$`) }) });
// Open a screen and wait until the editor shows it: typing into the name field before the switch lands
// renames the previous screen (seen under load).
const openScreen = async (page, name) => {
  await screenButton(page, name).click();
  await page.waitForFunction((n) => document.querySelector('input[aria-label="Screen name"]')?.value === n, name, { timeout: 10000 });
};
const hmiState = (page) => page.evaluate(async () => (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design);

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await open(browser);

  // 1. Layout check: a label too long for its button and a screen no nav button goes to.
  await page.evaluate(async () => {
    const { useHmiStore } = await import('/src/store/useHmiStore.ts');
    const d = useHmiStore.getState().design;
    const main = d.screens[0];
    const b = main.elements.find((e) => e.kind === 'button');
    const screens = d.screens.map((s) => (s.id === main.id ? { ...s, elements: s.elements.map((e) => (e.id === b.id ? { ...e, label: 'Start the whole machine and every conveyor now' } : e)) } : s));
    screens.push({ id: 'orphan', name: 'Orphan screen', purpose: '', elements: [] });
    useHmiStore.getState().setDesign({ ...d, screens }, null);
  });
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Layout check/ }).click();
  const checkText = await page.locator('main').innerText();
  check(/does not fit its button and is cut off/.test(checkText), 'layout check: cut-off button text');
  check(/cannot reach it/.test(checkText) && /Orphan screen/.test(checkText), 'layout check: unreachable screen');

  // 2 + 7. Screen access is one undo step; Ctrl+Z works while the editor is open with the focus elsewhere.
  await openScreen(page, 'Setup');
  await page.getByRole('button', { name: 'Edit screen' }).click();
  const before = (await hmiState(page)).screens.find((s) => s.name === 'Setup').level ?? 'operator';
  const access = page.locator('label', { hasText: 'Screen access' }).locator('select');
  await access.selectOption('engineer');
  const after = await hmiState(page);
  check(after.screens.find((s) => s.name === 'Setup').level === 'engineer', 'screen access set');
  check(after.screens.find((s) => s.name === 'Setup').edited === true, 'screen access marks the screen edited (kept on Redesign)');
  await page.locator('h2, h1').first().click(); // focus away from the canvas and the select
  await page.keyboard.press('Control+z');
  const undone = (await hmiState(page)).screens.find((s) => s.name === 'Setup').level ?? 'operator';
  check(undone === before, `Ctrl+Z restores the screen access (${undone} vs ${before})`);
  await page.keyboard.press('Control+y');
  check((await hmiState(page)).screens.find((s) => s.name === 'Setup').level === 'engineer', 'Ctrl+Y redoes it');

  // 5. Rename a screen: its navigation buttons follow.
  await openScreen(page, 'Alarms');
  await page.locator('input[aria-label="Screen name"]').fill('Faults');
  const renamed = await hmiState(page);
  const target = renamed.screens.find((s) => s.name === 'Faults');
  const navLabels = renamed.screens.flatMap((s) => s.elements.filter((e) => e.kind === 'nav' && e.targetScreenId === target.id).map((e) => e.label));
  log('Nav buttons to the renamed screen:', [...new Set(navLabels)].join(', '));
  check(navLabels.length > 0 && navLabels.every((l) => l === 'Faults'), 'nav buttons renamed with the screen');

  // 4. Background with zoom / offset / dim -> movable picture -> background.
  await page.evaluate(async () => {
    const { useHmiStore } = await import('/src/store/useHmiStore.ts');
    const d = useHmiStore.getState().design;
    // 40x20 red PNG.
    const c = document.createElement('canvas'); c.width = 40; c.height = 20; const g = c.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 40, 20);
    const bg = { src: c.toDataURL('image/png'), fit: 'fit', dim: 0.5, zoom: 0.5, offsetX: 100, offsetY: 40, name: 'red.png' };
    useHmiStore.getState().setDesign({ ...d, screens: d.screens.map((s) => (s.name === 'Faults' ? { ...s, background: bg } : s)) }, null);
  });
  await page.getByRole('button', { name: 'Make it a movable picture' }).click();
  await page.waitForTimeout(500);
  const pic = (await hmiState(page)).screens.find((s) => s.name === 'Faults').elements.find((e) => e.kind === 'image');
  log('Picture element:', pic && JSON.stringify({ x: pic.x, y: pic.y, w: pic.w, h: pic.h, dim: pic.dim }));
  // 800x480 box zoomed 0.5 = 400x240 centred, moved (100, 40): (300, 160); a 2:1 picture fills its width, 400x200 at (300, 180).
  check(pic && pic.x === 300 && pic.y === 180 && pic.w === 400 && pic.h === 200 && pic.dim === 0.5, 'movable picture keeps the zoom, offset and dim');
  await page.getByRole('button', { name: 'Use as background' }).click();
  const back = (await hmiState(page)).screens.find((s) => s.name === 'Faults').background;
  log('Back to background:', JSON.stringify({ ...back, src: undefined }));
  check(back && back.dim === 0.5 && Math.abs(back.zoom - 0.5) < 0.01 && back.offsetX === 100 && back.offsetY === 40, '"Use as background" keeps the place and the dim');
  await page.getByRole('button', { name: 'Done editing' }).click();

  // 8. Lock badge vs text: no protected button's text runs into its badge (the check reports none).
  const lockCut = await page.evaluate(async () => {
    const { cutTexts, lockInset } = await import('/src/hmi/layout.ts');
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return d.screens.flatMap((s) => s.elements.filter((e) => lockInset(e) && cutTexts(e).length).map((e) => `${s.name}: ${e.label}`));
  });
  log('Protected buttons whose text would reach the lock:', lockCut.join('; ') || 'none');

  // 6. Live HMI: tap the pusher timeout setpoint, type a value; out of range is refused.
  await page.goto(BASE + '/simulate');
  await page.getByRole('button', { name: /^Run$/ }).first().click();
  await page.locator('select[aria-label="HMI screen"]').selectOption({ label: 'Setup' });
  await page.waitForTimeout(400);
  await page.locator('svg[aria-label^="HMI screen"] [data-el="s-tmo"]').last().dispatchEvent('pointerdown');
  const pad = page.getByTestId('hmi-keypad');
  await pad.waitFor({ timeout: 3000 });
  for (const k of ['7', '5']) await pad.getByRole('button', { name: k, exact: true }).click();
  await pad.getByRole('button', { name: 'Enter' }).click();
  check(/Allowed: 1 to 10 s/.test(await pad.innerText()), 'out-of-range setpoint refused with the limits');
  await pad.getByRole('button', { name: 'Backspace' }).click();
  await pad.getByRole('button', { name: 'Backspace' }).click();
  await pad.getByRole('button', { name: '7', exact: true }).click();
  await pad.getByRole('button', { name: 'Enter' }).click();
  check(await pad.count() === 0, 'keypad closes after Enter');
  await page.waitForTimeout(300);
  await page.locator('svg[aria-label^="HMI screen"] [data-el="s-tmo"]').last().dispatchEvent('pointerdown');
  const now = await page.getByTestId('hmi-keypad').innerText();
  check(/Now 7\b/.test(now), `setpoint written to the PLC (${now.replace(/\s+/g, ' ').slice(0, 60)})`);
  await page.getByTestId('hmi-keypad').getByRole('button', { name: 'Cancel' }).click();

  // 3. A 128x64 C-more Micro: refused with a reason, not offered in the picker.
  await page.evaluate(async () => {
    const { useHmiStore } = await import('/src/store/useHmiStore.ts');
    useHmiStore.setState({ design: null, hmiPartNumber: 'EA3-S3ML' });
  });
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(600);
  check(await page.getByTestId('hmi-too-small').count() === 1, 'EA3-S3ML: too small to design for, says so');
  const picker = await page.locator('main').innerText();
  check(!/EA3-S3ML/.test(picker.replace(/The EA3-S3ML[^.]*\./, '')), 'EA3-S3ML not offered in the picker');
  check(/CM5-T7W/.test(picker), 'C-more touch panels offered');
  for (const e of errors.splice(0)) fails.push(`page error: ${e.slice(0, 160)}`);

  // 9. Allen-Bradley CompactLogix: the HMI page shows the program's tag names.
  const ab = await open(browser);
  await ab.page.evaluate(async () => {
    const { platformById, suggestModules } = await import('/src/plc/core/platforms.ts');
    const { applyEquipment } = await import('/src/spec/equipment.ts');
    const need = { digitalInputs: 6, digitalOutputs: 3, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null };
    applyEquipment({ cpuId: '5069-L306ER', modules: suggestModules(platformById('ab-compactlogix-5380'), '5069-L306ER', need), hmiPartNumber: '2711R-T7T' }, null);
    (await import('/src/hmi/retarget.ts')).setProjectPanel('2711R-T7T');
  });
  await ab.page.goto(BASE + '/hmi');
  await ab.page.waitForTimeout(1200);
  await ab.page.getByRole('button', { name: /^Tags/ }).click();
  const tagsTab = await ab.page.locator('main').innerText();
  check(/PLC tag \(memory\)/i.test(tagsTab), 'AB: Tags tab headed with the PLC tag');
  const firstRow = (await ab.page.locator('main table tbody tr').first().locator('td').first().innerText()).replace(/\s+/g, ' ');
  log('AB: first tag cell:', firstRow);
  check(/^[A-Za-z_][\w.]* [CDXYT]/.test(firstRow), 'AB: tag name shown above the memory address');
  await ab.page.getByRole('button', { name: 'Edit screen' }).click();
  const bound = await ab.page.evaluate(async () => {
    const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
    return d.screens[0].elements.find((e) => e.kind === 'button' && e.address)?.id;
  });
  const box = await ab.page.locator(`[data-testid="hmi-editor"] [data-el="${bound}"]`).first().boundingBox();
  await ab.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await ab.page.waitForTimeout(300);
  const plcTag = ab.page.getByTestId('plc-tag');
  const plcTagText = (await plcTag.count()) ? await plcTag.innerText() : '';
  log('AB: element editor:', plcTagText);
  check(/^PLC tag: \w/.test(plcTagText), 'AB: element editor shows the PLC tag of its address');
  for (const e of ab.errors) fails.push(`AB page error: ${e.slice(0, 160)}`);

  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('HMI QA fixes work');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
