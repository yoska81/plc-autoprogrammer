// Cabinet photos → as-built drawing (first slice): Import → "Cabinet photos" tab → 3 photos of one small cabinet →
// the AI (mocked with a recorded reading, src/convert/photos/__fixtures__/smallCabinet.ts) reads them → REVIEW
// (a crop of the photo per item, confidence, confirm / correct) → as-built design: panel layout in the
// photographed rail order + BOM, "as-built from photos — verify"; what the photos can't show is asked on the
// Machine description page. Checks what is sent to the AI (every photo, labelled with its index).
//   npm run dev -- --port 5204 &  ;  BASE_URL=http://localhost:5204 node e2e/photos.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-photos/';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5204';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

let READING = null;
const requests = [];
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
// A small photo (grey PNG, 40 x 30 px) the browser can decode and crop.
async function png(page, shade) {
  const b64 = await page.evaluate((s) => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = `rgb(${s},${s},${s})`; x.fillRect(0, 0, 40, 30); x.fillStyle = '#c00'; x.fillRect(5, 5, 10, 10); return c.toDataURL('image/png').split(',')[1]; }, shade);
  return Buffer.from(b64, 'base64');
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    const sys = sysText(body.system);
    const text = sys.includes('documenting an existing control cabinet from photos') ? JSON.stringify(READING) : (fails.push('AI mock: unknown prompt ' + sys.slice(0, 80)), '{}');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, text) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  READING = await page.evaluate(async () => (await import('/src/convert/photos/__fixtures__/smallCabinet.ts')).SMALL_CABINET);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'high', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
  });
  await page.goto(BASE + '/import?tab=photos');
  await page.getByTestId('photos-tab').waitFor();
  check(await page.getByRole('navigation', { name: 'Import from' }).getByRole('button', { name: 'Cabinet photos' }).getAttribute('aria-current') === 'page', 'third tab "Cabinet photos" on the Import page');

  // 1. Three photos of one cabinet.
  await page.getByLabel('Cabinet photos').setInputFiles([
    { name: 'overview.png', mimeType: 'image/png', buffer: await png(page, 90) },
    { name: 'rail1_nameplates.png', mimeType: 'image/png', buffer: await png(page, 150) },
    { name: 'plc_and_terminals.png', mimeType: 'image/png', buffer: await png(page, 200) },
  ]);
  await page.getByLabel('Note about the cabinet').fill('Line 3 starter panel');
  await page.getByRole('button', { name: 'Read the photos' }).click();
  await page.getByTestId('photos-review').waitFor({ timeout: 30000 });
  const req = requests[0];
  const parts = req?.messages?.[0]?.content ?? [];
  check(parts.filter((p) => p.type === 'image').length === 3, `every photo sent to the AI (${parts.filter((p) => p.type === 'image').length})`);
  check(parts.some((p) => p.type === 'text' && /Photo 2 \(plc_and_terminals\.png\)/.test(p.text)), 'photos labelled with their index');

  // 2. Review: one row per real device (the AI reported some twice), a crop per item.
  const rows = page.locator('[data-photo-item]');
  log('Review:', await rows.count(), 'items |', await page.getByTestId('photos-counts').innerText());
  check(await rows.count() === 9, 'merged: 8 devices + 1 terminal strip (CB1, CB2, PLC1, K1 and TB1 were each seen twice)');
  check(await page.locator('[data-photo-item] canvas').count() === 9, 'a crop of its photo next to every item');
  check(await page.getByText('seen in 2 photos').count() >= 4, 'items seen in two photos say so');
  check(/7 confirmed · 2 to check/.test(await page.getByTestId('photos-counts').innerText()), 'sure readings confirmed, the overload and the hidden relay to check');
  const ol = rows.filter({ has: page.locator('input[value="OL1"]') });
  await ol.getByRole('button', { name: 'Confirm' }).click();
  // Correct a reading: the PS1 nameplate (keep the part, change the tag the panel uses).
  await rows.filter({ has: page.locator('input[value="PS1"]') }).getByLabel(/^Tag of/).fill('PS24');
  check(/8 confirmed · 1 to check/.test(await page.getByTestId('photos-counts').innerText()), 'confirming updates the count');
  await page.screenshot({ path: OUT + 'review.png', fullPage: true });

  // 3. As-built design.
  await page.getByRole('button', { name: 'Make the as-built panel layout and BOM' }).click();
  await page.getByTestId('photos-applied').waitFor();
  const d = await page.evaluate(async () => { const s = (await import('/src/store/useElectricalStore.ts')).useElectricalStore.getState(); return { rails: s.design?.asBuilt?.rails, tags: s.design?.components.map((c) => c.tag), notes: s.design?.notes, source: s.source }; });
  log('As-built rails:', JSON.stringify(d.rails));
  check(JSON.stringify(d.rails) === JSON.stringify([['CB1', 'CB2', 'PS24'], ['PLC1', 'IO1', 'K1', 'OL1'], ['TB1']]), 'rails in the photographed order with the corrected tag');
  check(!d.tags.some((t) => /^CR/.test(t)), 'the unconfirmed hidden relay is left out');
  check(/As-built from photos — verify/.test(d.notes?.[0] ?? ''), 'marked "as-built from photos — verify"');

  // Or convert: the photographed devices go to the shared review below the tab (same path as drawings).
  await page.getByTestId('photos-convert').click();
  const parts = page.getByTestId('review-parts');
  await parts.waitFor({ timeout: 10000 });
  const partsText = await parts.innerText();
  check(['GMCBU-1C-5', 'SC-E02PG-24VDC', 'C0-08ND3'].every((pn) => partsText.includes(pn)) && /photo 1, rail 2, position 3/.test(partsText), 'the shared review lists the photographed parts with where they were seen');

  // What the photos can't show: on the Machine description page only.
  await page.goto(BASE + '/spec');
  await page.waitForTimeout(800);
  const qa = await page.locator('#questions-and-answers').innerText();
  check(/Cabinet photos: Where does wire 2001/.test(qa) && /could not be confirmed from the photos/.test(qa), 'hidden wiring and the unconfirmed relay are asked on the Machine description page');

  // Drawings: the panel layout sheet and the BOM.
  await page.goto(BASE + '/electrical?tab=cabinet');
  await page.locator('nav[aria-label="Drawing sheets"] li button').first().waitFor({ timeout: 60000 }).catch(() => {});
  const sheets = await page.locator('nav[aria-label="Drawing sheets"] li button').evaluateAll((bs) => bs.map((b) => b.title));
  log('Sheets:', sheets.join(' | '));
  check(sheets.some((t) => /PANEL LAYOUT/i.test(t)) && sheets.some((t) => /BILL OF MATERIALS/i.test(t)), 'panel layout and BOM sheets');
  const bom = await page.evaluate(async () => {
    const { collectProject } = await import('/src/deliverables/collect.ts');
    const { billOfMaterials } = await import('/src/electrical/derive.ts');
    const p = collectProject();
    return billOfMaterials(p.drawingCtx).flatMap((g) => g.lines.map((l) => l.partNumber));
  });
  for (const pn of ['GMCBU-1C-5', 'PSL-24-030', 'C0-10DD1E-D', 'C0-08ND3', 'SC-E02PG-24VDC', 'TK-E02-72']) check(bom.includes(pn), `BOM has ${pn}`);
  await page.screenshot({ path: OUT + 'drawings.png' });

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('3 cabinet photos → reviewed → as-built panel layout + BOM; hidden items asked on the Machine description page');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
