// HMI screens made by hand on top of a picture: upload, place and bind a button, move / resize / undo,
// tag list and program stage, fit and dim, AI recreate proposal (mocked), the screen in the simulator
// (button works, picture behind it) and in the exported PNG.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-editor.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-hmi-editor');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PICTURE = path.join(__dirname, '..', 'build', 'icon.png');
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };

let failPage = null;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await useAppModules(page);

  // Pages load as their own chunks: after a navigation, wait until the app and the page have rendered.
  const gotoRaw = page.goto.bind(page);
  page.goto = async (...a) => { const r = await gotoRaw(...a); await page.waitForFunction(() => document.getElementById('root')?.childElementCount && !document.querySelector('[data-page-loading]')); return r; };
  failPage = page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const aiRequests = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    aiRequests.push(body);
    const answer = {
      explanation: 'Recognised two buttons and a lamp.',
      elements: [
        { id: 'x1', kind: 'button', label: 'Reset', x: 40, y: 380, w: 120, h: 56, address: 'C1060', action: 'momentary', targetScreenId: null, onText: null, offText: null, style: 'normal', units: null, min: null, max: null, note: null, level: 'operator', interlock: '', states: [], symbols: [] },
        { id: 'x2', kind: 'indicator', label: 'Ready', x: 600, y: 40, w: 160, h: 48, address: 'C1061', action: null, targetScreenId: null, onText: null, offText: null, style: 'ok', units: null, min: null, max: null, note: null, level: 'operator', interlock: '', states: [], symbols: [] },
      ],
      tags: [{ name: 'READY', address: 'C1061', dataType: 'BIT', access: 'read', description: 'PLC sets ON when the machine is ready.' }],
    };
    const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const text = JSON.stringify(answer);
    await route.fulfill({
      status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' },
      body: ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
        + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
        + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } }) + ev('message_stop', {}),
    });
  });

  // Example project, with an API key for the AI step.
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'high', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
    (await appImport('/src/preview/sampleProject.ts')).seedSampleProject();
  });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/hmi');
  const screensBefore = await page.locator('nav[aria-label="Screens"] > button').count();
  const programStale = () => page.locator('nav a', { hasText: 'PLC program' }).locator('[title="Out of date"]').count();
  check(await programStale() === 0, 'program up to date before editing');

  // New screen from a picture
  await page.locator('input[aria-label="+ New screen from picture…"]').setInputFiles(PICTURE);
  await page.getByRole('button', { name: 'Done editing' }).waitFor();
  check(await page.locator('nav[aria-label="Screens"] > button').count() === screensBefore + 1, 'screen added');
  check(await page.locator('[data-testid="hmi-editor-layer"]').count() === 1, 'editor open');
  const bg = page.getByTestId('hmi-editor').locator('g[data-background] image');
  check(((await bg.getAttribute('href')) || '').startsWith('data:image/'), 'picture behind the screen');
  log('Picture stored:', Math.round(((await bg.getAttribute('href')) || '').length * 0.75 / 1024), 'KB');

  // Place a button and bind it
  await page.getByRole('button', { name: 'Add Push button' }).click();
  const props = page.locator('aside').filter({ hasText: 'Element properties' });
  await props.getByLabel('Label').first().fill('Hand Start');
  await props.getByLabel('PLC address').fill('C1050', { timeout: 5000 });
  const id = await page.locator('[data-element]').last().getAttribute('data-element');
  const xy = async () => Promise.all(['X', 'Y', 'W', 'H'].map(async (k, i) => Number(await props.locator('input[type=number]').nth(i).inputValue())));
  const start = await xy();
  // Drag it (snaps to the 8 px grid)
  const box = await page.locator(`[data-element="${id}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 47, { steps: 6 });
  await page.mouse.up();
  const moved = await xy();
  // Resize from the bottom-right handle
  const h = await page.locator('[data-handle="se"]').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2 + 25, { steps: 5 });
  await page.mouse.up();
  const sized = await xy();
  log(`Button: placed ${start} → moved ${moved} → resized ${sized}`);
  check(moved[0] > start[0] && moved[1] > start[1] && moved[0] % 8 === 0 && moved[1] % 8 === 0, 'moved and snapped');
  check(sized[2] > moved[2] && sized[3] > moved[3] && sized[2] % 8 === 0, 'resized and snapped');
  // Keyboard nudge, undo, redo
  await page.getByTestId('hmi-editor').focus();
  await page.keyboard.press('ArrowLeft');
  check((await xy())[0] === sized[0] - 1, 'arrow nudges 1 px');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  check(JSON.stringify(await xy()) === JSON.stringify(moved), 'undo back to the moved size');
  await page.getByRole('button', { name: 'Redo' }).click();
  check(JSON.stringify(await xy()) === JSON.stringify(sized), 'redo');
  // Duplicate and delete (keyboard goes to the editor again after clicking the toolbar)
  await page.getByTestId('hmi-editor').focus();
  await page.keyboard.press('Control+d');
  const afterDup = await page.locator('[data-element]').count();
  await page.keyboard.press('Delete');
  check(await page.locator('[data-element]').count() === afterDup - 1, 'duplicate then delete');
  await page.locator(`[data-element="${id}"]`).click();

  // Fit and dim
  await page.getByLabel('Picture fit').selectOption('fill');
  await page.getByLabel('Dim picture').fill('0.6');
  check(await bg.getAttribute('preserveAspectRatio') === 'xMidYMid slice', 'fill');
  check(Number(await page.getByTestId('hmi-editor').locator('g[data-background] rect').getAttribute('opacity')) === 0.6, 'dim 60 %');
  await page.screenshot({ path: path.join(OUT, '01_editor.png') });

  // AI recreate: a proposal, accepted by the user
  await page.getByRole('button', { name: 'Let the AI recreate this screen' }).click();
  const banner = page.locator('[role=status]').filter({ hasText: 'AI proposal' });
  await banner.waitFor({ timeout: 15000 });
  const req = aiRequests.at(-1);
  const img = req.messages[0].content.find((b) => b.type === 'image');
  log('AI request:', img ? `image ${img.source.media_type} ${Math.round(img.source.data.length * 0.75 / 1024)} KB` : 'NO IMAGE', '|', (await banner.innerText()).replace(/\s+/g, ' ').slice(0, 90));
  check(img && /800x480/.test(JSON.stringify(req.system)), 'picture sent at panel size');
  const before = await page.locator('[data-element]').count();
  await banner.getByRole('button', { name: 'Add to the screen' }).click();
  check(await page.locator('[data-element]').count() === before + 2, 'proposal added');
  // A lamp on the same bit shows the button working in the simulator.
  await page.getByRole('button', { name: 'Add Indicator lamp' }).click();
  await props.getByLabel('PLC address').fill('C1050');
  await props.getByLabel('Text when ON').fill('PRESSED');
  await props.getByLabel('Text when OFF').fill('IDLE');
  await page.screenshot({ path: path.join(OUT, '02_after_ai.png') });
  await page.getByRole('button', { name: 'Done editing' }).click();

  // Tags and program stage
  await page.getByRole('button', { name: /^Tags/ }).click();
  const tagRow = page.locator('tr', { hasText: 'C1050' });
  log('Tag added:', (await tagRow.innerText()).replace(/\s+/g, ' '));
  check(/HAND_START/.test(await tagRow.innerText()), 'tag for the hand-placed button');
  check(await page.locator('tr', { hasText: 'C1061' }).count() === 1, 'tag from the AI proposal');
  check(await programStale() === 1, 'program marked out of date');
  const screenName = 'icon'; // named after the picture file
  const navTo = await page.evaluate(async (name) => {
    const { useHmiStore } = await appImport('/src/store/useHmiStore.ts');
    const d = useHmiStore.getState().design;
    const id = d.screens.find((s) => s.name === name).id;
    return d.screens.filter((s) => s.elements.some((e) => e.kind === 'nav' && e.targetScreenId === id)).length;
  }, screenName);
  log(`Nav buttons to "${screenName}": on ${navTo} screen(s)`);
  check(navTo >= 6, 'the hand-added screen has a nav button on every screen with a nav bar');

  // In the simulator: the screen with its picture; pressing the button sets C1050
  await page.goto(BASE + '/simulate');
  await page.getByRole('button', { name: /^Run$/ }).first().click();
  await page.locator('select[aria-label="HMI screen"]').selectOption({ label: screenName });
  const live = page.locator('svg[aria-label^="HMI screen"]').last();
  check(await live.locator('g[data-background] image').count() === 1, 'picture in the live HMI');
  const lamp = async () => (await live.locator('text').allTextContents()).map((t) => t.trim().toUpperCase()).find((t) => t === 'PRESSED' || t === 'IDLE');
  const idle = await lamp();
  const btn = live.locator('text', { hasText: /^hand start$/i }).first();
  const bb = await btn.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  const held = await lamp();
  await page.screenshot({ path: path.join(OUT, '03_simulator.png') });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const released = await lamp();
  log(`Simulator: picture shown; lamp on C1050 ${idle} → held ${held} → released ${released}`);
  check(idle === 'IDLE' && held === 'PRESSED' && released === 'IDLE', 'hand-placed button drives the PLC bit in the simulator');

  // Export: the PNG of the screen includes the picture
  await page.goto(BASE + '/export');
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Screen images (ZIP)', exact: true }).click()]);
  const zipPath = path.join(OUT, d.suggestedFilename());
  await d.saveAs(zipPath);
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const names = Object.keys(zip.files);
  const mine = names.find((n) => n.toLowerCase().includes(screenName.toLowerCase().replace(/\W+/g, '_')));
  log('Exported PNGs:', names.join(', '));
  check(Boolean(mine), 'PNG of the new screen exported');
  const png = await zip.file(mine).async('nodebuffer');
  fs.writeFileSync(path.join(OUT, mine), png);
  // The picture is lime on graphite: count lime-ish pixels in the export.
  const lime = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 1] > 70 && px[i] > 60 && px[i + 2] < 40 && px[i + 1] > px[i + 2] + 40) n++;
    return n;
  }, png.toString('base64'));
  log('Lime pixels from the picture in the exported PNG:', lime);
  check(lime > 2000, 'picture visible in the exported PNG');

  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) throw new Error(`${errors.length} page/console error(s)`);
})().catch(async (e) => { await failPage?.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {}); console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
