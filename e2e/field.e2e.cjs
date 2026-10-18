// On site: the commissioning checklist (tick, note, fail, sign, PDF + Excel from the page and from
// Deliverables) and redlines (mark a change on a drawing sheet, add a field change, apply → design
// edited, revision bumped, change list in the revision history). Ticks and redlines survive a reload.
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/field.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const OUT = path.join(__dirname, 'out-field');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // ── Commissioning checklist ──
  await page.locator('nav a', { hasText: /^Commissioning checklist$/ }).click();
  await page.getByTestId('comm-progress').waitFor();
  const items = page.locator('[data-comm-item]');
  const n = await items.count();
  log('Checklist items:', n, '|', await page.getByTestId('comm-progress').innerText());
  check(n >= 10, 'checklist has the I/O, safety and alarm items');
  for (const s of ['Inputs', 'Outputs', 'Safety functions', 'Alarms']) check(await page.getByRole('region', { name: s }).count() === 1, `section ${s}`);
  check(/Program drives it in rung \d+/.test(await page.getByRole('region', { name: 'Outputs' }).innerText()), 'outputs show the rung that drives them');
  await page.getByLabel('Technician').fill('J. Tech');
  await items.nth(0).getByRole('button', { name: 'Pass' }).click();
  await items.nth(1).getByRole('button', { name: 'Fail' }).click();
  await items.nth(1).getByRole('textbox').fill('Wired to the wrong terminal');
  await items.nth(1).getByRole('textbox').blur();
  await page.getByLabel('Sign-off name').fill('J. Tech');
  await page.getByLabel('Typed signature').fill('J. Tech');
  await page.getByRole('button', { name: 'Sign', exact: true }).click();
  check(/2 of \d+ done/.test(await page.getByTestId('comm-progress').innerText()), 'progress counts the ticks');
  check(await page.getByTestId('comm-signed').count() === 1, 'signed');
  for (const [btn, ext] of [['PDF', 'pdf'], ['Excel', 'xlsx']]) {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: btn, exact: true }).click()]);
    const f = path.join(OUT, d.suggestedFilename());
    await d.saveAs(f);
    check(f.endsWith(`_commissioning_checklist.${ext}`) && fs.statSync(f).size > 3000, `checklist ${ext} saved (${fs.statSync(f).size} bytes)`);
  }
  await page.reload();
  await page.getByTestId('comm-progress').waitFor();
  check(/2 of \d+ done/.test(await page.getByTestId('comm-progress').innerText()) && await page.getByTestId('comm-signed').count() === 1, 'ticks and signature survive a reload');
  check((await items.nth(1).getByRole('textbox').inputValue()) === 'Wired to the wrong terminal', 'note kept');
  await page.screenshot({ path: path.join(OUT, 'commissioning.png') });

  // Deliverables card.
  await page.goto(BASE + '/export');
  const [dx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Commissioning checklist Excel' }).click()]);
  check(/commissioning_checklist\.xlsx$/.test(dx.suggestedFilename()), 'Deliverables: checklist Excel');

  // ── Redlines ──
  await page.goto(BASE + '/electrical?tab=cabinet');
  await page.getByRole('button', { name: 'Redline' }).click();
  const sheet = page.locator('[data-redline-sheet]').nth(2);
  await sheet.scrollIntoViewIfNeeded();
  const box = await sheet.boundingBox();
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.getByLabel('Redline change').fill('M1 is 3 HP');
  await page.getByRole('button', { name: 'Add redline' }).click();
  check(await sheet.locator('[data-redline]').count() === 1, 'redline mark on the sheet');
  await page.screenshot({ path: path.join(OUT, 'redline-sheet.png') });
  await page.goto(BASE + '/redlines');
  await page.getByLabel('Change', { exact: true }).fill('Add a second E-stop at the infeed');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const openList = page.getByRole('region', { name: 'Open changes' });
  check(/Will change: M1 power set to 3 HP/.test(await openList.innerText()), 'preview of the design edit');
  check(/edit the design by hand/.test(await openList.innerText()), 'not-editable change recorded only');
  await page.reload();
  // pages load as their own chunks: wait for the redlines page before counting
  await page.locator('[data-redline]').nth(1).waitFor({ timeout: 15000 }).catch(() => {});
  check(await page.locator('[data-redline]').count() === 2, 'redlines survive a reload');
  await page.getByLabel('Revised by').fill('JT');
  const applyBtn = page.getByRole('button', { name: /Apply and issue revision/ });
  const rev = (await applyBtn.innerText()).replace(/.*revision\s+/, '').trim();
  await applyBtn.click();
  check(/Rev \w+/.test(await page.getByRole('region', { name: 'Applied changes' }).innerText()), 'changes closed with their revision');
  const motor = await page.evaluate(async () => (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState().inputs.motors.find((m) => m.tag === 'M1')?.hp);
  check(motor === 3, `M1 is 3 HP in the design (${motor})`);
  await page.goto(BASE + '/project');
  const changes = page.getByLabel(`Changes in revision ${rev}`);
  await changes.first().waitFor({ timeout: 15000 }).catch(() => {});
  check(await changes.count() === 1 && /M1 is 3 HP → M1 power set to 3 HP/.test(await changes.innerText()) && /second E-stop.*by hand/.test(await changes.innerText()), `revision ${rev} lists the changes`);
  await page.screenshot({ path: path.join(OUT, 'revision.png') });

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log(`commissioning checklist ticked, signed, exported; redlines applied as revision ${rev}`);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
