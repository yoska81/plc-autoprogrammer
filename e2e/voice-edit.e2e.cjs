// Voice input / read aloud and hand edits, on the example project.
//  Voice: microphone on text boxes (browser speech recognition, faked), add vs replace, cancel; recording +
//  OpenAI transcription (mocked, fake microphone); on-device model download error; speaker buttons;
//  hands-free answers; Settings → Voice.
//  Edits: order-list price / quantity / part number / description (marked, in totals and files, kept after
//  reload and an electrical regeneration, back to generated); label text; cable & wire notes (in the CSV);
//  review note; machine spec text; I/O description; rung comment; HMI alarm text; everything in the .isap file.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/voice-edit.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const OUT = path.join(__dirname, 'out-voice-edit');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);

// Fake speech services: SpeechRecognition answers from window.__speech (one phrase per start),
// speechSynthesis records what is read in window.__spoken and finishes at once.
const FAKE_SPEECH = () => {
  window.__speech = [];
  window.__spoken = [];
  window.__recStarts = 0;
  class FakeRecognition {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; this.ended = false; }
    start() {
      window.__recStarts++;
      this.phrase = window.__speech.shift() ?? 'hello from the microphone';
      const words = this.phrase.split(' ');
      setTimeout(() => this.onstart?.(), 30);
      // Interim words first (live text), then the final phrase.
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: words.slice(0, Math.ceil(words.length / 2)).join(' ') } }] }), 150);
      this.finalTimer = setTimeout(() => {
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: this.phrase } }] });
        if (!this.continuous) this.finish();
      }, 400);
    }
    finish() { if (this.ended) return; this.ended = true; setTimeout(() => this.onend?.(), 20); }
    stop() { setTimeout(() => this.finish(), 450); }
    abort() { clearTimeout(this.finalTimer); this.finish(); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  const synth = {
    speaking: false,
    getVoices: () => [{ voiceURI: 'he-voice', name: 'Hebrew voice', lang: 'he-IL' }, { voiceURI: 'en-voice', name: 'English voice', lang: 'en-US' }],
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 30); },
    cancel() {},
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, permissions: ['microphone'] });
  await context.addInitScript(FAKE_SPEECH);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource|huggingface|speech model/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  // OpenAI transcription (mocked): remember what was sent.
  const transcribed = [];
  await page.route('https://api.openai.com/v1/audio/transcriptions', async (r) => {
    const body = r.request().postDataBuffer()?.toString('latin1') ?? '';
    transcribed.push({ model: /name="model"\r\n\r\n([^\r]+)/.exec(body)?.[1], language: /name="language"\r\n\r\n([^\r]+)/.exec(body)?.[1], bytes: body.length });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Transcribed by OpenAI' }) });
  });
  // The on-device model cannot be downloaded here: the app must say so in plain words.
  await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net/, (r) => r.abort());

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  const fails = [];
  const check = (ok, what) => { if (ok) log('ok', what); else { fails.push(what); log('FAIL', what); } };
  const tree = async (name) => { await page.locator('nav a', { hasText: new RegExp(`^${name}(\\s*\\d+\\?)?$`) }).first().click(); await page.waitForTimeout(600); };

  // ── 1. Dictation into the machine description (browser recognition) ──
  await tree('Machine description');
  const add = page.getByPlaceholder(/Pick and place cell/);
  const addMic = page.locator('div.relative', { has: add }).getByTestId('mic');
  await page.evaluate(() => { window.__speech.push('The robot holds the part when a door opens'); });
  await addMic.click();
  await page.getByTestId('dictation').waitFor();
  await page.waitForTimeout(250);
  const live = await add.inputValue();
  check(live.length > 0 && 'The robot holds the part when a door opens'.startsWith(live), `live words while speaking ("${live}")`);
  await page.getByTestId('dictation').getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('dictation').waitFor({ state: 'detached' });
  check(await add.inputValue() === 'The robot holds the part when a door opens', 'Done keeps what was said');
  await page.screenshot({ path: path.join(OUT, '01-dictation.png') });

  // Add to the existing text, then switch to Replace while speaking, then Cancel.
  await page.evaluate(() => { window.__speech.push('two guard doors'); });
  await addMic.click();
  await page.getByTestId('dictation').getByRole('button', { name: 'Add to the text' }).waitFor();
  await page.waitForTimeout(500);
  check(/^The robot holds the part when a door opens two guard/.test(await add.inputValue()), 'Add to the text: words go at the end');
  await page.getByTestId('dictation').getByRole('button', { name: 'Replace the text' }).click();
  await page.waitForTimeout(100);
  check(await add.inputValue() === 'two guard doors', 'Replace the text: only the new words');
  await page.getByTestId('dictation').getByRole('button', { name: 'Cancel' }).click();
  check(await add.inputValue() === 'The robot holds the part when a door opens', 'Cancel puts the text back');
  await add.fill('');

  // Read aloud: a spec section and a question.
  const overview = page.locator('#spec-overview');
  if (await overview.count()) {
    await page.locator('div.relative', { has: overview }).getByTestId('speak').click();
    await page.waitForTimeout(200);
    const spoken = await page.evaluate(() => window.__spoken.join(' '));
    check(spoken.includes((await overview.inputValue()).split(/[.!?]/)[0].trim()), 'speaker reads the spec section');
  }
  const qa = page.locator('#questions-and-answers');
  const q1 = qa.locator('li[data-question]').first();
  const qText = (await q1.locator('p').first().innerText()).replace(/^Q:\s*/, '');
  await q1.getByTestId('speak').click();
  await page.waitForTimeout(200);
  check((await page.evaluate(() => window.__spoken.at(-1) ?? '')).includes(qText.slice(0, 20)), 'speaker reads the question');

  // ── 2. Hands-free answers ──
  const openBefore = await qa.locator('li[data-question].border-amber-300').count();
  if (openBefore) {
    await page.evaluate(() => { window.__speech.push('About twenty parts per minute', 'yes'); });
    await qa.getByTestId('hands-free').click();
    await qa.getByTestId('hands-free-panel').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#questions-and-answers li[data-question].border-amber-300').length < (window.__openBefore ?? 99), null, { timeout: 100 }).catch(() => {});
    await page.evaluate((n) => { window.__openBefore = n; }, openBefore);
    await page.waitForFunction(() => document.querySelectorAll('#questions-and-answers li[data-question].border-amber-300').length < window.__openBefore, null, { timeout: 15000 }).catch(() => {});
    const saved = await page.evaluate(async () => {
      const m = await import('/src/components/questions/useQuestionStore.ts');
      return Object.values(m.useQuestionStore.getState().byProject).flat().filter((q) => q.answer === 'About twenty parts per minute' && q.status === 'answered').length;
    });
    check(saved === 1, 'hands-free: question read, answer heard, "yes" saved it');
    const spokenAll = await page.evaluate(() => window.__spoken.join(' | '));
    check(/Question 1 of \d+/.test(spokenAll) && /You said: About twenty parts per minute/.test(spokenAll), 'hands-free reads the question and the answer back');
    await page.screenshot({ path: path.join(OUT, '02-hands-free.png') });
    await qa.getByTestId('hands-free-panel').getByRole('button', { name: 'Stop' }).click();
    check(await qa.getByTestId('hands-free-panel').count() === 0, 'hands-free: Stop ends it');
  } else log('(no open questions in the example: hands-free skipped)');

  // ── 3. Settings → Voice; recording + OpenAI; on-device model error ──
  await page.goto(BASE + '/settings#voice');
  const voice = page.getByTestId('voice-settings');
  await voice.waitFor();
  await voice.getByLabel('Speech language').selectOption('he-IL');
  check(await voice.getByLabel('Read-aloud voice').locator('option', { hasText: 'Hebrew voice' }).count() === 1, 'Hebrew voice offered for Hebrew');
  await voice.getByLabel('Read-aloud voice').selectOption('he-voice');
  await voice.getByRole('button', { name: 'Test the voice' }).click();
  await page.waitForTimeout(200);
  check(/המסוע/.test(await page.evaluate(() => window.__spoken.at(-1) ?? '')), 'test voice speaks Hebrew');
  check(await voice.getByRole('radio', { name: /OpenAI/ }).isDisabled(), 'OpenAI engine needs a key');
  await page.screenshot({ path: path.join(OUT, '03-settings-voice.png'), fullPage: true });
  // A fake OpenAI key (never a real one) and the OpenAI engine.
  await page.evaluate(async () => {
    const s = await import('/src/store/useSettingsStore.ts'); s.useSettingsStore.getState().setOpenaiApiKey('sk-test-not-a-real-key');
    const v = await import('/src/voice/useVoiceSettings.ts'); v.useVoiceSettings.getState().set({ engine: 'openai' });
  });
  const trial = page.getByLabel('Try the microphone');
  await page.locator('div.relative', { has: trial }).getByTestId('mic').click();
  await page.getByTestId('dictation').getByText(/Listening/).waitFor({ timeout: 10000 });
  check(await page.getByTestId('dictation').getByText(/OpenAI/).count() === 1, 'recording engine shown (OpenAI)');
  await page.waitForTimeout(1800);
  await page.getByTestId('dictation').getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('dictation').waitFor({ state: 'detached', timeout: 15000 });
  check(await trial.inputValue() === 'Transcribed by OpenAI', 'recorded speech written down by OpenAI');
  check(transcribed.length >= 1 && transcribed.at(-1).language === 'he' && transcribed.at(-1).model && transcribed.at(-1).bytes > 1000, `audio sent with the language (${JSON.stringify(transcribed.at(-1))})`);
  // On-device model: no internet for it here → plain error.
  await page.evaluate(async () => { const v = await import('/src/voice/useVoiceSettings.ts'); v.useVoiceSettings.getState().set({ engine: 'local', language: 'en-US' }); });
  await trial.fill('');
  await page.locator('div.relative', { has: trial }).getByTestId('mic').click();
  await page.getByTestId('dictation').getByText(/Listening/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.getByTestId('dictation').getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('dictation').getByText(/speech model could not be downloaded|internet/i).waitFor({ timeout: 60000 }).then(() => check(true, 'on-device model: download failure explained'), () => check(false, 'on-device model: download failure explained'));
  await page.screenshot({ path: path.join(OUT, '04-local-model-error.png') });
  await page.getByTestId('dictation').getByRole('button', { name: 'Close' }).click();
  await page.evaluate(async () => {
    const v = await import('/src/voice/useVoiceSettings.ts'); v.useVoiceSettings.getState().set({ engine: 'auto', language: 'en-US', voice: '' });
    const s = await import('/src/store/useSettingsStore.ts'); s.useSettingsStore.getState().setOpenaiApiKey('');
  });

  // ── 4. Order list: price, quantity, part number, description ──
  await tree('Deliverables');
  const order = page.locator('#order-list');
  await order.scrollIntoViewIfNeeded();
  const totalText = async () => (await order.getByTestId('order-total').innerText());
  const money = (t) => Number(t.replace(/[^\d.]/g, ''));
  const before = money(await totalText());
  const priceInputs = order.locator('input[aria-label^="Unit price of"]');
  // A line still waiting for a price, else the first line.
  let target = order.locator('tr[data-part]', { has: page.locator('input[placeholder="to confirm"]') }).first();
  if (!(await target.count())) target = order.locator('tr[data-part]').first();
  const pn = await target.getAttribute('data-part');
  const listPrice = Number((await target.locator('input[aria-label^="Unit price of"]').getAttribute('placeholder')) || 0) || 0;
  const qty = Number(await target.locator('input[aria-label^="Order quantity of"]').inputValue());
  await target.locator('input[aria-label^="Unit price of"]').fill('123.45');
  await target.locator('input[aria-label^="Unit price of"]').press('Enter');
  await page.waitForTimeout(200);
  check(await target.getByTestId('edited-mark').filter({ hasText: 'entered by you' }).count() === 1, `price marked "entered by you" (${pn})`);
  const after = money(await totalText());
  check(Math.abs(after - (before - listPrice * qty + 123.45 * qty)) < 0.02, `typed price is in the total (${before} → ${after})`);
  await target.locator('input[aria-label^="Order quantity of"]').fill(String(qty + 2));
  await target.locator('input[aria-label^="Order quantity of"]').press('Enter');
  await target.locator('[aria-label^="Description of"]').fill('Spare-friendly contactor, customer stock');
  await target.locator('[aria-label^="Description of"]').press('Enter');
  await target.locator('input[aria-label^="Part number"]').fill('MY-PN-001');
  await target.locator('input[aria-label^="Part number"]').press('Enter');
  await page.waitForTimeout(200);
  check(Math.abs(money(await totalText()) - (before - listPrice * qty + 123.45 * (qty + 2))) < 0.02, 'typed quantity is in the total');
  check(await target.getByTestId('edited-mark').count() === 4, 'four fields marked as entered by you');
  await page.screenshot({ path: path.join(OUT, '05-order-list.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), order.getByRole('button', { name: 'Order list (CSV)' }).click()]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  check(/"MY-PN-001"/.test(csv) && /"123\.45"/.test(csv) && /"entered by you"/.test(csv) && /Spare-friendly contactor/.test(csv), 'order list CSV has the typed values');

  // ── 5. Machine spec text ──
  const spec = page.getByTestId('machine-spec');
  await spec.getByRole('button', { name: 'Show' }).click();
  const specBox = spec.getByLabel('Machine specification text');
  await specBox.fill(`${await specBox.inputValue()}\n\nNOTE FROM THE ENGINEER: paint the frame yellow.`);
  check(await spec.getByTestId('edited-mark').count() === 1, 'machine spec marked edited by hand');
  await spec.getByTestId('speak').first().click();
  await page.waitForFunction(() => window.__spoken.join(' ').includes('paint the frame yellow'), null, { timeout: 20000 }).then(() => check(true, 'machine spec read aloud (the edited text)'), () => check(false, 'machine spec read aloud (the edited text)'));
  await spec.getByTestId('speak').first().click(); // stop

  // ── 6. Labels, cable & wire notes ──
  await tree('Labels');
  const firstCode = page.locator('input[aria-label^="Label text "]').first();
  const labelId = (await firstCode.getAttribute('aria-label')).replace('Label text ', '');
  const labelWas = await firstCode.inputValue();
  await firstCode.fill('0V-MAIN');
  await firstCode.press('Enter');
  await page.waitForTimeout(200);
  check(await page.locator('tr', { has: page.locator(`input[aria-label="Label text ${labelId}"]`) }).getByTestId('edited-mark').count() === 1, `label text marked (${labelWas} → 0V-MAIN)`);
  check(await page.locator('svg title', { hasText: '0V-MAIN' }).count() > 0 || await page.getByText('0V-MAIN', { exact: true }).count() > 0, 'label preview shows the typed text');

  await tree('Cable & wire lists');
  const cableNote = page.locator('input[aria-label^="Note for cable"]').first();
  const cableTag = (await cableNote.getAttribute('aria-label')).replace('Note for cable ', '');
  await cableNote.fill('Route through the left gland');
  await cableNote.press('Enter');
  const wireNote = page.locator('input[aria-label^="Note for wire"]').first();
  await wireNote.fill('Checked by Sam');
  await wireNote.press('Enter');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, '06-cable-wire-lists.png') });
  const [cdl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Cable schedule CSV/ }).click()]);
  const ccsv = fs.readFileSync(await cdl.path(), 'utf8');
  check(ccsv.split('\r\n')[0].endsWith(',Note') && ccsv.includes(`${cableTag},`) && ccsv.includes('Route through the left gland'), 'cable schedule CSV has the note');
  const [wdl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Wire list CSV/ }).click()]);
  check(fs.readFileSync(await wdl.path(), 'utf8').includes('Checked by Sam'), 'wire list CSV has the note');

  // ── 7. I/O description ──
  await tree('I/O list');
  const d1 = page.getByLabel('Description of I001');
  const genDesc = await d1.inputValue();
  await d1.fill('E-stop chain OK (from safety relay K0)');
  await d1.blur();
  const ioRow = page.locator('tr', { has: d1 });
  check(await ioRow.getByTestId('edited-mark').count() === 1, 'I/O description marked edited by you');
  await ioRow.getByTestId('reset-edit').click();
  check(await d1.inputValue() === genDesc && await ioRow.getByTestId('edited-mark').count() === 0, 'I/O description back to the generated text');
  await d1.fill('E-stop chain OK (from safety relay K0)');
  await d1.blur();

  // ── 8. Review note ──
  await page.goto(BASE + '/review');
  const finding = page.locator('tbody tr').first();
  await finding.locator('button').first().click();
  const reviewNote = page.getByLabel(/^Your note on:/).first();
  await reviewNote.fill('Discussed with the customer on site');
  await page.waitForTimeout(200);

  // ── 9. HMI alarm text ──
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(800);
  const alarmsTab = page.getByRole('button', { name: /^Alarms/ });
  let alarmChecked = false;
  if (await alarmsTab.count()) {
    await alarmsTab.first().click();
    const msg = page.locator('input[aria-label^="Alarm message"]').first();
    if (await msg.count()) {
      await msg.fill('Close the guard door to continue');
      await msg.press('Enter');
      await page.waitForTimeout(200);
      check(await page.locator('tr', { has: msg }).getByTestId('edited-mark').count() === 1, 'HMI alarm text marked edited by you');
      alarmChecked = true;
    }
  }
  if (!alarmChecked) log('(no HMI alarms in the example: alarm text skipped)');

  // ── 10. Rung comment ──
  await page.goto(BASE + '/program');
  await page.waitForTimeout(800);
  const comment = page.locator('[data-rung-id] span[title]').first();
  if (await comment.count()) {
    const rungId = await page.locator('[data-rung-id]').first().getAttribute('data-rung-id');
    await comment.dblclick();
    const box = page.getByPlaceholder('Rung comment', { exact: true });
    await box.fill('My own rung comment');
    await box.press('Enter');
    await page.waitForTimeout(200);
    check(await page.locator(`[data-rung-id="${rungId}"]`).getByTestId('edited-mark').count() === 1, 'rung comment marked edited by you');
  } else check(false, 'a rung comment to edit');

  // ── 11. Reload: everything is still there ──
  await page.reload();
  await page.waitForTimeout(800);
  const edits = await page.evaluate(async () => (await import('/src/edits/useEditsStore.ts')).useEditsStore.getState());
  check(edits.bom[pn]?.price === 123.45 && edits.bom[pn]?.partNumber === 'MY-PN-001', 'order-list edits kept after reload');
  check(edits.labels[labelId]?.code === '0V-MAIN', 'label edit kept');
  check(Object.values(edits.notes).includes('Route through the left gland') && Object.values(edits.notes).includes('Checked by Sam') && Object.values(edits.notes).includes('Discussed with the customer on site'), 'notes kept');
  check(edits.texts.machineSpec?.value.includes('paint the frame yellow') && edits.texts['io:I001']?.value.startsWith('E-stop chain OK'), 'spec and I/O texts kept');

  // ── 12. The .isap project file holds the edits ──
  const isap = await page.evaluate(async () => {
    const f = await import('/src/project/projectFile.ts');
    const { blob } = await f.buildProjectFile();
    const { body } = await f.readProjectFile(blob);
    return body.stores.edits;
  });
  check(isap?.bom?.[pn]?.price === 123.45 && isap?.labels?.[labelId]?.code === '0V-MAIN' && isap?.texts?.machineSpec, 'the .isap file contains the hand edits');

  // ── 13. Regenerate the electrical design: the edits stay ──
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: 'Update design' }).first().click();
  await page.waitForFunction(async () => { const m = await import('/src/store/useElectricalStore.ts'); return !m.useElectricalStore.getState().isGenerating; }, null, { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.goto(BASE + '/export');
  await page.waitForTimeout(800);
  const row = page.locator(`#order-list tr[data-part="${pn}"]`);
  check(await row.count() === 1 && await row.locator('input[aria-label^="Part number"]').inputValue() === 'MY-PN-001' && await row.locator('input[aria-label^="Unit price of"]').inputValue() === '123.45', 'order-list edits kept after the design was generated again');
  // Back to generated.
  await row.locator('td').nth(5).getByTestId('reset-edit').click();
  await page.waitForTimeout(200);
  check(await page.locator(`#order-list tr[data-part="${pn}"]`).locator('input[aria-label^="Unit price of"]').inputValue() === '', 'price back to generated');

  // ── 14. Another project does not see these edits ──
  await page.goto(BASE + '/new');
  const other = await page.evaluate(async () => {
    const p = await import('/src/store/useProjectsStore.ts');
    p.useProjectsStore.getState().createProject('Voice edit other');
    const e = (await import('/src/edits/useEditsStore.ts')).useEditsStore.getState();
    return Object.keys(e.bom).length + Object.keys(e.labels).length + Object.keys(e.notes).length + Object.keys(e.texts).length;
  });
  check(other === 0, 'a new project starts without hand edits');

  console.log(`\n${fails.length ? `FAILED ${fails.length}: ${fails.join('; ')}` : 'All voice/edit checks passed'}`);
  if (errors.length) console.log('Page errors:', errors);
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
