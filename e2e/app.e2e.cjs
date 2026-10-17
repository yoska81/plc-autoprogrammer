// E2E v0.8: wizard (project data → describe → equipment chooser) → project data/revisions → I/O (+filter) → electrical
// (part picker, cabinet/machine/picture, machining DXF, labels: label-printer PDF / sheet / CSV / Excel) → HMI → program (blocks) → simulate (blocks, bypasses) →
// resizable panels → settings connection test → spec change/update all → second project (no leaks, rename) → deliverables (incl. full package PDF with bookmarks).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const { PDFDocument, PDFName } = require('pdf-lib');
const { fakeServer } = require('./fake-modbus.cjs');
const { createModbusClient } = require('../electron/modbus.cjs');
const fs = require('fs');
const SP = __dirname + '/';
const OUT = SP + 'out/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const F = JSON.parse(fs.readFileSync(SP + 'fixtures.json', 'utf8'));
const log = (...a) => console.log('•', ...a);
const check = (ok, what) => { if (!ok) throw new Error('Check failed: ' + what); };
let shot = 0;
const snap = async (page, name, full = false) => page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}_${name}.png`, fullPage: full });

const IO_POINTS = [
  ['E-Stop OK (safety relay)', 'input', 'Safety', 'safety-relay-output'],
  ['Start Button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Stop Button', 'input', 'Operator/HMI', 'pushbutton-nc'],
  ['Part at end photo-eye', 'input', 'Product Detection', 'sensor-pnp'],
  ['Pusher extended', 'input', 'Pneumatic', 'sensor-pnp'],
  ['Conveyor motor contactor', 'output', 'Conveyor', 'contactor-coil'],
  ['Pusher solenoid', 'output', 'Pneumatic', 'solenoid'],
].map(([description, type, category, deviceType]) => ({ description, type, category, deviceType, reason: 'spec' }));

const counts = {};
const lastUser = {};
function reply(system, body = {}) {
  const k = system.includes('checks a machine control design') ? 'review'
    : system.includes('functional specification') ? 'spec'
    : system.includes('choosing the control equipment') ? 'equipment'
    : system.includes('complete discrete PLC I/O list') ? 'io'
    : system.includes('industrial control panel') ? 'electrical'
    : system.includes("describe the machine's electrical load and safety") ? 'machine'
    : system.includes('HMI designer') ? 'hmi'
    : system.includes('ladder logic') ? 'ladder' : 'unknown';
  counts[k] = (counts[k] ?? 0) + 1;
  // Last prompt text sent per stage (user messages), so steps can check what the AI was given.
  lastUser[k] = (body.messages ?? []).flatMap((x) => (Array.isArray(x.content) ? x.content : [{ text: x.content }])).map((c) => c.text ?? '').join('\n');
  const m = F.DESIGN.machine;
  switch (k) {
    case 'review': return F.REVIEW;
    case 'spec': return { sections: F.SPEC, questions: ['How many parts per minute at most?'], summary: 'Organized the description into 10 sections.' };
    case 'equipment': return F.RECOMMENDATION;
    case 'io': return { explanation: '5 inputs, 2 outputs.', points: IO_POINTS, questions: [] };
    case 'electrical': return {
      explanation: 'NEMA 12 panel, 480 VAC.', components: F.DESIGN.components, ioWiring: F.DESIGN.ioWiring, notes: F.DESIGN.notes, motors: F.DESIGN.inputs.motors,
      machine: { zones: m.zones, junctionBoxes: m.junctionBoxes, motorLocations: Object.entries(m.motorLocations).map(([motorTag, location]) => ({ motorTag, location })), routing: Object.entries(m.routing).map(([deviceTag, junctionBox]) => ({ deviceTag, junctionBox })) },
    };
    case 'machine': return {
      motors: F.DESIGN.inputs.motors.map((x) => ({ tag: x.tag, description: x.description, power: x.hp, unit: 'hp', powerGiven: true, start: 'dol', vertical: false, zone: m.motorLocations[x.tag] ?? '' })),
      estops: 1, guardDoors: [], lightCurtains: [], zones: m.zones, interfaces: [], questions: ['Confirm the conveyor motor nameplate current.'],
    };
    case 'hmi': return { explanation: 'Three screens.', screens: F.HMI.screens, alarms: F.HMI.alarms, tags: F.HMI.tags, notes: [{ kind: 'question', text: 'Which operator password levels are needed?' }, { kind: 'issue', text: 'Alarm banner colour chosen for contrast with the header.' }] };
    case 'ladder': {
      if (counts.ladder === 1) return { explanation: 'Program written from the spec.', program: F.LADDER };
      const p = JSON.parse(JSON.stringify(F.LADDER));
      p.rungs.find((r) => r.id === 'r_tmo').outputs[0].preset = '5';
      return { explanation: 'Pusher timeout changed from 3 s to 5 s.', program: p };
    }
    default: throw new Error('unknown prompt: ' + system.slice(0, 80));
  }
}

/** System prompt text (the app sends it as cacheable content blocks). */
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

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, JSON.stringify(reply(sysText(body.system), body))) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());

  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'max', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 2 }));
  });
  await page.goto(BASE + '/spec');
  await snap(page, 'shell');

  // Wizard
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Wizard Conveyor Cell');
  await page.getByPlaceholder('Shown on drawings and documents').fill('Acme Automation');
  await page.getByPlaceholder('e.g. 24-117').fill('26-042');
  await page.getByPlaceholder('e.g. WCC').fill('wcc');
  await page.getByPlaceholder('e.g. Y.S.').fill('J.D.');
  await page.getByRole('button', { name: /^Canada/ }).click();
  const summary = async () => (await page.locator('aside.w-80').innerText()).replace(/\s+/g, ' ');
  check((await summary()).includes('600 V 3-phase'), 'Canada selects 600 V');
  await page.getByRole('button', { name: /^United States/ }).click();
  check((await summary()).includes('480 V 3-phase'), 'US selects 480 V');
  await page.getByRole('button', { name: /^Canada/ }).click();
  await page.getByRole('button', { name: /^600 V 3-phase/ }).click();
  log('Wizard summary:', (await summary()).slice(0, 120));
  await snap(page, 'wizard_1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.locator('textarea').first().fill('Conveyor with a pusher at the end, E-stop, 7 inch HMI.');
  await page.getByRole('button', { name: 'Add to spec' }).click();
  await page.getByText('Organized the description').waitFor({ timeout: 15000 });
  await snap(page, 'wizard_2');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Suggest equipment' }).click();
  await page.getByRole('button', { name: 'Suggest again' }).waitFor({ timeout: 15000 });
  await snap(page, 'wizard_3_recommendation');
  // Equipment chooser: weak CPUs are greyed, a bigger one can be chosen.
  const greyCpus = await page.locator('input[aria-label^="Choose C"][disabled]').count();
  log('Greyed (too weak) CPUs:', greyCpus);
  check(greyCpus > 0, 'some CPUs are greyed as too weak');
  const weakRow = page.locator('tr', { has: page.locator('input[aria-label^="Choose C"][disabled]') }).first();
  await weakRow.click();
  check(!(await page.locator('aside', { hasText: 'Your selection' }).innerText()).includes(await weakRow.locator('td.font-mono').innerText()), 'clicking a greyed CPU does not select it');
  await page.locator('tr', { has: page.locator('input[aria-label="Choose C0-11DD1E-D"]') }).click();
  check(await page.locator('input[aria-label="Choose C0-11DD1E-D"]').isChecked(), 'bigger CPU selected');
  await page.getByRole('button', { name: 'Use this selection' }).first().click();
  await page.getByText('Applied to the project.').waitFor();
  log('Summary panel controller:', await page.locator('aside.w-80 dd.font-mono').first().innerText());
  check((await page.locator('aside.w-80 dd.font-mono').first().innerText()).includes('C0-11DD1E-D'), 'bigger CPU applied');
  await page.getByRole('button', { name: 'Next →' }).click();
  await snap(page, 'wizard_4');
  await page.getByRole('button', { name: 'Open project →' }).click();
  await page.waitForURL('**/io');
  log('Project open:', await page.locator('select[aria-label="Open project"] option:checked').innerText());
  const statusBar = () => page.locator('div.h-6').last().innerText();
  check((await statusBar()).includes('C0-11DD1E-D'), 'status bar shows the chosen CPU');

  // Project data: wizard values arrived; issue revisions; status bar follows.
  await page.goto(BASE + '/project');
  check(await page.getByLabel('company').inputValue() === 'Acme Automation', 'company saved');
  check(await page.getByLabel('projectNumber').inputValue() === '26-042', 'job number saved');
  check(await page.getByLabel('Drawing prefix').inputValue() === 'WCC', 'prefix saved upper-case');
  check(await page.getByLabel('preparedBy').inputValue() === 'J.D.', 'engineer saved');
  check((await page.locator('select').filter({ hasText: 'Canada' }).first().inputValue()) === 'Canada', 'region saved');
  check((await statusBar()).includes('Rev A · Preliminary'), 'preliminary rev A before issuing');
  await page.getByRole('button', { name: 'Issue revision A' }).click();
  check((await statusBar()).includes('Rev A · Issued for review'), 'status bar shows issued rev A');
  await page.getByRole('button', { name: 'Issue revision B' }).click();
  check((await statusBar()).includes('Rev B · Issued for approval'), 'status bar shows rev B');
  await page.getByRole('button', { name: 'Withdraw revision B' }).click();
  check((await statusBar()).includes('Rev A'), 'withdrawing B goes back to A');
  check(await page.getByRole('button', { name: 'Issue revision B' }).count() === 1, 'next revision is B again after withdrawing');
  log('Status bar:', (await statusBar()).replace(/\s+/g, ' '));
  await snap(page, 'project_data');

  // I/O
  await page.goto(BASE + '/io');
  await page.getByRole('button', { name: 'Generate I/O from spec' }).click();
  await page.getByText('Review I/O changes').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Apply changes' }).click();
  log('I/O addresses:', (await page.locator('input[aria-label^="PLC address"]').evaluateAll((els) => els.map((e) => e.placeholder))).join(' '));
  await snap(page, 'io');
  const ioRows = () => page.locator('input[aria-label^="PLC address"]').count();
  await page.getByLabel('Filter I/O').fill('pusher');
  check(await ioRows() === 2, 'filter "pusher" shows 2 points');
  await page.getByLabel('Show').selectOption('output');
  check(await ioRows() === 1, 'pusher outputs only shows 1 point');
  await page.getByLabel('Filter I/O').fill('zzz');
  await page.getByText('Nothing matches the filter.').waitFor();
  await page.getByLabel('Filter I/O').fill('');
  await page.getByLabel('Show').selectOption('all');
  check(await ioRows() === 7, 'filter cleared shows all 7');

  const dl = async (name) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.getByRole('button', { name, exact: true }).click()]);
    const path = OUT + d.suggestedFilename();
    await d.saveAs(path);
    return path;
  };

  // Electrical
  // Generate = AI machine model (small prompt, no catalog) -> rule-based engine picks every part.
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: /Generate (Electrical Design|New Design)/ }).click();
  await page.getByRole('button', { name: 'BOM CSV' }).waitFor({ timeout: 15000 });
  await page.goto(BASE + '/electrical?tab=design');
  const ruleSummary = await page.getByText(/Rule-based design:/).first().innerText();
  log('Rule-based design:', ruleSummary.slice(0, 160));
  check(counts.machine === 1 && !/Catalog|partNumber/.test(lastUser.machine ?? ''), 'machine-model prompt sent without the catalog');
  check(await page.getByRole('button', { name: 'Change K1', exact: true }).count() === 1 && await page.getByRole('button', { name: 'Change SR1', exact: true }).count() === 1, 'rule-based design has the motor contactor and the safety relay');
  // The older all-AI design is still there as an experimental option (the steps below use its design).
  await page.getByRole('button', { name: 'AI full design (experimental)' }).click();
  await page.getByText('NEMA 12 panel, 480 VAC.').first().waitFor({ timeout: 15000 });
  check(counts.electrical === 1, 'AI full design (experimental) still works');
  await page.waitForURL(/tab=cabinet/);
  await page.goto(BASE + '/electrical?tab=design');
  check(await page.locator('select').filter({ hasText: '600 V 3-phase' }).first().inputValue() !== '', 'supply select present');
  log('Electrical supply / code:', await page.locator('select').filter({ hasText: '600 V 3-phase' }).first().inputValue(), '/', await page.getByLabel('Electrical code').inputValue());

  // Part picker: weaker parts greyed, a stronger one can be chosen.
  const changeBtn = page.locator('button[aria-label^="Change "]').first();
  const changeTag = (await changeBtn.getAttribute('aria-label')).slice(7);
  const row = page.locator('tr', { has: changeBtn });
  const before = await row.locator('div.font-mono').first().innerText();
  await changeBtn.click();
  const dialog = page.locator('.fixed.inset-0').filter({ hasText: `Change ${changeTag}` });
  await dialog.waitFor();
  const choosable = dialog.locator('tr', { has: page.locator('input[type=radio]:not([disabled]):not(:checked)') });
  const nChoosable = await choosable.count();
  log(`Part picker ${changeTag}: ${await dialog.locator('input[type=radio][disabled]').count()} greyed, ${nChoosable} choosable`);
  if (nChoosable) {
    const pn = await choosable.first().locator('td').nth(1).innerText();
    await choosable.first().click();
    await dialog.waitFor({ state: 'detached' });
    const after = await row.locator('div.font-mono').first().innerText();
    log(`Changed ${changeTag}: ${before} → ${after}`);
    check(after === pn && after !== before, 'part picker replaced the part');
  } else {
    await dialog.getByRole('button', { name: 'Close' }).last().click();
  }

  // Machining: units, cut-only, DXF download.
  await page.goto(BASE + '/electrical?tab=machining');
  await page.getByLabel('DXF units').selectOption('in');
  // Drawings as a real PDF from the Electrical page (Print / Drawings PDF buttons, no new tab).
  {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: 'Drawings PDF' }).click()]);
    const f = OUT + d.suggestedFilename(); await d.saveAs(f);
    const doc = await PDFDocument.load(fs.readFileSync(f));
    log('Drawings PDF from the Electrical page:', d.suggestedFilename(), doc.getPageCount(), 'pages');
    check(doc.getPageCount() > 5, 'drawings PDF has every sheet');
  }
  await page.getByText('X in [mm]').waitFor();
  await page.getByLabel('Cutting geometry only').check();
  {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back panel DXF' }).click()]);
    const path = OUT + d.suggestedFilename();
    await d.saveAs(path);
    const dxf = fs.readFileSync(path, 'utf8');
    const ok = /\$INSUNITS\s*\r?\n\s*70\s*\r?\n\s*1\s*\r?\n/.test(dxf);
    log('Machining DXF:', d.suggestedFilename(), Math.round(dxf.length / 1024), 'KB, inch header', ok, '| TEXT layer used', /\n\s*8\s*\r?\nTEXT\s*\r?\n/.test(dxf));
    check(/_in_cut\.dxf$/.test(d.suggestedFilename()) && ok, 'inch, cut-only DXF');
  }
  // A printable PDF drawing next to each DXF: the drilling / cutout sheet(s) on the project's paper.
  for (const [btn, re] of [['Back panel PDF', /_back_panel_drilling\.pdf$/], ['Front door PDF', /_door_cutouts\.pdf$/]]) {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: btn }).click()]);
    const f = OUT + d.suggestedFilename(); await d.saveAs(f);
    const doc = await PDFDocument.load(fs.readFileSync(f));
    const { width, height } = doc.getPage(0).getSize();
    log('Machining PDF:', d.suggestedFilename(), doc.getPageCount(), 'page(s),', `${(width / 72).toFixed(1)}x${(height / 72).toFixed(1)} in`);
    check(re.test(d.suggestedFilename()) && doc.getPageCount() >= 1 && width > height, `${btn}: landscape drawing PDF`);
  }
  await snap(page, 'electrical_machining');
  for (const t of ['cabinet', 'machine', 'picture']) {
    await page.goto(BASE + `/electrical?tab=${t}`);
    await page.waitForTimeout(1200);
    await snap(page, `electrical_${t}`);
  }

  // Labels: categories, content, size, label-printer PDF (one page per label at the label size), sheet PDF, CSV, Excel
  await page.goto(BASE + '/electrical?tab=labels');
  await page.getByText('1. Which labels').waitFor({ timeout: 15000 });
  log('Label categories:', (await page.locator('section label').filter({ has: page.locator('input[type=checkbox]') }).allInnerTexts()).slice(0, 6).map((t) => t.split('\n')[0] + ' ' + t.split('\n').pop()).join(' | '));
  await page.getByLabel('Number + description beside it').check();
  await page.getByLabel('Label size').selectOption('25x10');
  log('Labels to print:', await page.getByText(/labels selected/).innerText(), '| preview labels', await page.locator('[data-testid=label-preview] svg').count());
  // The preview shows every label once (copies as ×N), so no wire number hides behind 20 copies of 24+.
  const nWires = Number((await page.locator('section label').filter({ hasText: 'Wire markers' }).innerText()).trim().split('\n').pop());
  const shownCodes = new Set((await page.locator('[data-testid=label-preview] svg').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))));
  if (!(nWires > 2) || shownCodes.size < nWires) throw new Error(`label preview shows ${shownCodes.size} distinct labels, ${nWires} wire numbers exist`);
  // Labels unticked in the list (kept with the project) are called out with a one-click fix.
  await page.getByLabel('Filter labels').fill('24+');
  await page.getByRole('button', { name: 'Select none' }).click();
  await page.getByTestId('labels-unticked').waitFor();
  log('Unticked warning:', await page.getByTestId('labels-unticked').innerText());
  await page.getByTestId('labels-unticked').getByRole('button', { name: 'Tick all' }).click();
  await page.getByTestId('labels-unticked').waitFor({ state: 'detached' });
  await page.getByLabel('Filter labels').fill('');
  await snap(page, 'labels');
  const lpdf = fs.readFileSync(await dl('Labels PDF for label printer'), 'latin1');
  const boxes = [...lpdf.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  const mm = (b) => `${((b[2] - b[0]) / 72 * 25.4).toFixed(1)}x${((b[3] - b[1]) / 72 * 25.4).toFixed(1)}`;
  log('Label printer PDF pages:', boxes.length, '| sizes', [...new Set(boxes.map(mm))].join(', '));
  if (boxes.some((b) => mm(b) !== '25.0x10.0')) throw new Error('label page size is not 25 x 10 mm');
  const sheet = fs.readFileSync(await dl('Sheet PDF'), 'latin1');
  log('Label sheet PDF pages:', (sheet.match(/\/Type \/Page[^s]/g) || []).length);
  log('Labels CSV rows:', fs.readFileSync(await dl('CSV'), 'utf8').trim().split('\n').length - 1);
  const lx = await JSZip.loadAsync(fs.readFileSync(await dl('Excel')));
  log('Labels Excel sheets:', [...(await lx.file('xl/workbook.xml').async('string')).matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(', '));
  const lxSheet = await lx.file('xl/worksheets/sheet1.xml').async('string');
  if (/<c r="D2"[^>]*t="s"/.test(lxSheet) || !/<c r="D2"[^>]*>\s*<v>\d+<\/v>/.test(lxSheet)) throw new Error('labels Excel Copies is not a number');
  const howTo = await lx.file('xl/sharedStrings.xml').async('string');
  if (!howTo.includes('Excel Import') || !howTo.includes('Use first row as header')) throw new Error('Brady Workstation steps missing from the labels Excel');
  // Desktop app: "Print labels" goes to window.isaDesktop.print with the label page size at actual scale
  await page.evaluate(() => { window.__jobs = []; window.isaDesktop = { print: async (job) => { window.__jobs.push({ ...job, pdf: job.pdf.length }); return { ok: true }; } }; });
  await page.getByRole('button', { name: 'Print labels', exact: true }).click();
  await page.getByText(/sent to the printer/).waitFor({ timeout: 30000 });
  const job = await page.evaluate(() => window.__jobs[0]);
  log('Desktop print job:', job.jobName, '|', job.pageWidthMm, 'x', job.pageHeightMm, 'mm | scale', job.scale, '| dialog', job.showDialog, '| PDF bytes', job.pdf);
  if (job.pageWidthMm !== 25 || job.pageHeightMm !== 10 || job.scale !== 'actual' || !job.uniformPageSize) throw new Error('desktop print job has the wrong page size');
  await page.evaluate(() => { delete window.isaDesktop; });
  // Brady printer + supply: the PDF pages take the supply's real size (B33-80-427 = 12.7 x 19.05 mm)
  await page.getByLabel('Label printer').selectOption('brady-i3300');
  await page.getByLabel('Printer labels').selectOption('B33-80-427');
  const bpdf = fs.readFileSync(await dl('Labels PDF for label printer'), 'latin1');
  const bboxes = [...bpdf.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  log('Brady i3300 B33-80-427 PDF:', bboxes.length, 'pages | sizes', [...new Set(bboxes.map(mm))].join(', '));
  if (bboxes.some((b) => mm(b) !== '12.7x19.1')) throw new Error('Brady supply page size is not 12.7 x 19.05 mm');
  // Match the roll: B33-80-427 is 4 across on a 63.5 mm liner -> one page per row of 4
  await page.getByLabel(/^Match the roll/).check();
  const rpdf = fs.readFileSync(await dl('Labels PDF for label printer'), 'latin1');
  const rboxes = [...rpdf.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  log('Match the roll PDF:', rboxes.length, 'pages | sizes', [...new Set(rboxes.map(mm))].join(', '));
  if (rboxes.length !== Math.ceil(bboxes.length / 4) || rboxes.some((b) => mm(b) !== '63.5x19.1')) throw new Error('roll layout pages are not 63.5 x 19.05 mm rows of 4');
  await page.getByLabel(/^One label per page/).check();
  await page.getByLabel('Label printer').selectOption('');
  await page.getByLabel('Label size').selectOption('38x12');

  // HMI (part preselected by equipment)
  await page.goto(BASE + '/hmi');
  log('HMI preselected:', await page.getByText(/CM5-T7W · 7"/).count() > 0);
  await page.getByRole('button', { name: 'Design the HMI screens' }).click();
  await page.getByRole('button', { name: 'Redesign screens' }).waitFor({ timeout: 15000 });
  log('HMI screens:', await page.locator('nav[aria-label="Screens"] > button').count(), '| tags tab:', (await page.getByRole('button', { name: /^Tags\s*\d+/ }).innerText()).replace(/\s+/g, ' '));
  await snap(page, 'hmi');

  // Program
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Describe' }).click();
  await page.getByRole('button', { name: 'Generate Program' }).click();
  await page.getByText('Cycle running: panel or HMI Start').waitFor({ timeout: 15000 });
  log('Tree status dots (done/stale):', await page.locator('nav [title="Done"]').count(), '/', await page.locator('nav [title="Out of date"]').count());
  await snap(page, 'program');
  const rungNumbers = () => page.locator('div.select-none > div.font-mono.font-bold').allInnerTexts();
  log('Block banners:', (await page.locator('span.text-xs.font-semibold.text-slate-800').allInnerTexts()).join(' | '));
  await page.getByRole('button', { name: /^Pusher\s*2$/ }).click();
  await page.getByText('Working on Pusher').waitFor();
  log('Pusher block rung numbers:', (await rungNumbers()).join(','), '|', await page.getByText(/of 8 rungs/).innerText());
  check((await rungNumbers()).join(',') === '4,5', 'block keeps the real rung numbers');
  await snap(page, 'program_block');
  await page.getByRole('button', { name: /^All\s*8$/ }).click().catch(() => {});

  // Simulate
  await page.goto(BASE + '/simulate');
  await page.getByRole('button', { name: /^Run$/ }).first().click();
  const box = await page.locator('svg[aria-label^="HMI screen"] text', { hasText: /^start$/i }).last().boundingBox({ timeout: 10000 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
  await page.waitForTimeout(3000);
  const yOn = await page.locator('span[title="Outputs ON"] b').innerText();
  log('Simulation outputs ON after HMI Start:', yOn);
  if (yOn.startsWith('0/')) throw new Error('HMI Start did not start the machine');
  const blockGroup = page.getByRole('group', { name: 'Block' });
  await blockGroup.getByRole('button', { name: /^Pusher/ }).click();
  await page.getByText('Showing the rungs and devices of').waitFor();
  await page.getByLabel('Run selected block only').check();
  const banner = page.locator('[role=status]').filter({ hasText: 'Bypasses active' });
  await banner.waitFor();
  log('Bypass banner:', (await banner.innerText()).replace(/\s+/g, ' ').slice(0, 120));
  await snap(page, 'simulate_block');
  await page.getByRole('button', { name: 'Clear all bypasses / forces' }).click();
  await banner.waitFor({ state: 'detached' });
  await blockGroup.getByRole('button', { name: /^All/ }).click();
  await snap(page, 'simulate');

  // Resizable panels: drag, remembered after reload, double-click resets.
  {
    const sep = page.locator('[role=separator]').first();
    const width = async () => Number(await sep.getAttribute('aria-valuenow'));
    const w0 = await width();
    const b = await sep.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 200);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 60, b.y + 200, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2 + 100, b.y + 200, { steps: 5 });
    await page.mouse.up();
    const w1 = await width();
    await page.reload();
    const w2 = await width();
    await sep.dblclick();
    const w3 = await width();
    log(`Nav panel width: ${w0} → drag ${w1} → reload ${w2} → double-click ${w3}`);
    check(w1 === w0 + 100 && w2 === w1 && w3 === 256, 'resizable nav panel');
  }

  // Settings: connection test messages.
  await page.goto(BASE + '/settings');
  const testWith = async (status, body) => {
    await page.route('https://api.anthropic.com/v1/messages', (r) => r.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'request-id': 'req_test' }, body: JSON.stringify(body) }));
    await page.getByRole('button', { name: 'Test connection' }).click();
    const st = page.locator('[role=status]');
    await st.waitFor();
    await page.getByRole('button', { name: 'Test connection' }).waitFor();
    const txt = await st.innerText();
    await page.unroute('https://api.anthropic.com/v1/messages');
    return txt;
  };
  const apiErr = (type, message) => ({ type: 'error', error: { type, message } });
  const results = {
    401: await testWith(401, apiErr('authentication_error', 'invalid x-api-key')),
    404: await testWith(404, apiErr('not_found_error', 'model: claude-opus-5-5')),
    credit: await testWith(400, apiErr('invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.')),
    ok: await testWith(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 } }),
  };
  for (const [k, v] of Object.entries(results)) log(`Test connection ${k}:`, v);
  check(/rejected the key \(401\)/.test(results[401]), '401 message');
  check(/not available to this account \(404\)/.test(results[404]), '404 message');
  check(/no credit/.test(results.credit), 'credit message');
  check(/^✓ Connected/.test(results.ok), 'success message');
  await snap(page, 'settings');

  // Spec change → update all
  // Open questions: answer right under the question; it stays as a Q/A pair below the description,
  // is part of the spec (fingerprint changes, later stages go out of date) and the AI gets it.
  await page.goto(BASE + '/spec');
  const qBox = page.getByLabel('Answer to: How many parts per minute at most?');
  await qBox.waitFor({ timeout: 10000 });
  log('Open questions in tree:', await page.locator('nav [aria-label$="open questions"]').allInnerTexts());
  const staleBefore = await page.locator('nav [title="Out of date"]').count();
  await qBox.fill('60 parts per minute');
  await page.locator('li', { has: qBox }).getByRole('button', { name: 'Save answer' }).click();
  const qa = page.locator('#questions-and-answers');
  await qa.locator('[data-answer]', { hasText: '60 parts per minute' }).waitFor({ timeout: 20000 });
  const qaText = await qa.innerText();
  const overview = await page.locator('#spec-overview').inputValue();
  const staleAfter = await page.locator('nav [title="Out of date"]').count();
  log('Q/A below description:', qaText.includes('How many parts per minute at most?') && qaText.includes('60 parts per minute'), '| copied into overview:', overview.includes('60 parts per minute'), '| out of date', staleBefore, '→', staleAfter, '| tree badges left:', await page.locator('nav [aria-label$="open questions"]').count());
  check(qaText.includes('How many parts per minute at most?') && qaText.includes('60 parts per minute'), 'answer stays as Q/A below the description');
  check(!overview.includes('60 parts per minute'), 'answer is not copied into the spec sections');
  check(staleAfter > staleBefore, 'answering changes the spec fingerprint (later stages out of date)');
  // Only real questions: the HMI question is listed, the HMI issue and the layout-check messages are not.
  check(qaText.includes('Which operator password levels are needed?'), 'AI question (kind "question") is in the Q&A');
  check(!/Alarm banner colour|header bar|on the HMI page|Layout check|touch target|overlaps/i.test(qaText), 'technical issues are not questions: ' + qaText.split('\n').filter((l) => /header bar|Layout check|Alarm banner/i.test(l)).join(' | '));
  // Older versions stored layout messages as questions: they are dropped on load.
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('isa-questions'));
    const k = Object.keys(st.state.byProject)[0];
    st.state.byProject[k].push({ id: 'hmi:legacy', source: 'hmi', text: 'I/O Status: no header bar and the top band is in use; add one on the HMI page.', answer: '', status: 'open', date: '2026-10-01 10:00', merged: false });
    localStorage.setItem('isa-questions', JSON.stringify(st));
  });
  await page.reload();
  await qa.waitFor();
  check(!(await qa.innerText()).includes('no header bar'), 'stored layout messages are removed from the questions on load');
  await qa.scrollIntoViewIfNeeded();
  await snap(page, 'questions');
  await page.locator('#spec-alarms').fill('- Pusher fault: pusher not extended within 5 s.');
  log('Out of date after edit:', await page.locator('nav [title="Out of date"]').count());
  await page.getByRole('button', { name: /Update out-of-date stages/ }).click();
  await page.getByRole('button', { name: 'Review program changes' }).waitFor({ timeout: 30000 });
  log('Update steps:', (await page.locator('.fixed ol li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  await page.getByRole('button', { name: 'Review program changes' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.waitForTimeout(300);
  log('After approve out of date:', await page.locator('nav [title="Out of date"]').count());
  log('I/O prompt has Q&A block:', /Questions and answers/.test(lastUser.io ?? '') && (lastUser.io ?? '').includes('60 parts per minute'));
  check(/Questions and answers/.test(lastUser.io ?? '') && (lastUser.io ?? '').includes('60 parts per minute'), 'I/O prompt contains the Questions and answers block');

  // A second project starts empty, then the first comes back intact; rename shows everywhere.
  const firstId = await page.locator('select[aria-label="Open project"]').inputValue();
  await page.goto(BASE + '/new');
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Second Cell');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Close ✕' }).click();
  await page.goto(BASE + '/io');
  check(await page.getByText('No I/O points yet').count() === 1, 'new project has no I/O');
  check((await statusBar()).includes('PLC: —') || !(await statusBar()).includes('C0-11DD1E-D'), 'new project has no CPU from the first');
  check((await statusBar()).includes('Rev A · Preliminary'), 'new project has no revisions from the first');
  await page.goto(BASE + '/project');
  check(await page.getByLabel('company').inputValue() === 'ISA', 'new project starts with the default company ISA, not the first project\'s');
  await page.getByLabel('Project name').fill('Second Cell Renamed');
  check((await page.locator('select[aria-label="Open project"] option:checked').innerText()) === 'Second Cell Renamed', 'rename shows in the project list');
  await page.locator('select[aria-label="Open project"]').selectOption(firstId);
  await page.goto(BASE + '/io');
  check(await ioRows() === 7, 'first project I/O back');
  check((await statusBar()).includes('C0-11DD1E-D') && (await statusBar()).includes('Rev A · Issued for review'), 'first project CPU and revision back');
  log('Projects:', (await page.locator('select[aria-label="Open project"] option').allInnerTexts()).join(' | '));
  await page.goto(BASE + '/project');
  check(await page.getByRole('button', { name: 'Delete project Wizard Conveyor Cell' }).count() === 0, 'open project cannot be deleted');
  await page.getByRole('button', { name: 'Delete project My PLC Project' }).click();
  check(!(await page.locator('select[aria-label="Open project"] option').allInnerTexts()).includes('My PLC Project'), 'project deleted');
  await page.goto(BASE + '/io');

  // While the AI is working the project can't be switched (its answer would land in the other project);
  // generation errors are plain English.
  await page.route('https://api.anthropic.com/v1/messages?*', async (r) => {
    await new Promise((res) => setTimeout(res, 1500));
    await r.fulfill({ status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }) });
  });
  await page.getByRole('button', { name: 'Update I/O from spec' }).click();
  const secondId = await page.locator('select[aria-label="Open project"] option', { hasText: 'Second Cell Renamed' }).getAttribute('value');
  await page.getByText('Reading the spec…').waitFor();
  await page.locator('select[aria-label="Open project"]').selectOption(secondId);
  check(await page.getByRole('alert').filter({ hasText: 'AI is still working' }).count() === 1, 'switch refused while the AI works');
  check(await page.locator('select[aria-label="Open project"]').inputValue() === firstId, 'still on the first project');
  const genErr = page.locator('[role=alert]').filter({ hasText: 'no credit' });
  await genErr.waitFor({ timeout: 10000 });
  log('Generation error:', await genErr.innerText());
  await page.unroute('https://api.anthropic.com/v1/messages?*');
  check(await ioRows() === 7, 'first project I/O untouched');

  // Design review
  await page.goto(BASE + '/review');
  await page.getByText(/Checks: \d+ finding/).waitFor({ timeout: 10000 });
  log('Review checks:', await page.getByText(/Checks: \d+ finding/).innerText());
  await page.getByRole('button', { name: /Run AI review/ }).click();
  await page.getByRole('button', { name: 'Air is not dumped on an E-stop', exact: true }).waitFor({ timeout: 15000 });
  log('Review verdict shown:', await page.getByText(/Reviewer's verdict/).count() > 0, '| critical open:', await page.locator('div', { hasText: /^Critical open$/ }).locator('xpath=following-sibling::div').first().innerText());
  const rowOf = (t) => page.locator('tr', { hasText: t });
  check(await rowOf('HMI: Alarm banner colour').count() === 1, 'HMI technical issue is a design review finding (not a question)');
  const badge = page.locator('nav a', { hasText: 'Design review' }).locator('span[aria-label$="open critical or major findings"]');
  log('Review badge / status bar:', await badge.innerText(), '|', await page.getByRole('link', { name: /^Review: / }).innerText());
  check(Number(await badge.innerText()) >= 1, 'tree badge counts open critical/major findings');
  // Issuing for construction is blocked while a critical finding is open.
  await page.goto(BASE + '/project');
  await page.getByLabel('Revision description').fill('Issued for construction');
  await page.getByRole('button', { name: /^Issue revision/ }).click();
  const guard = page.getByRole('alertdialog', { name: 'Critical findings open' });
  await guard.waitFor({ timeout: 5000 });
  log('Construction guard:', (await guard.locator('p').first().innerText()).replace(/\s+/g, ' '));
  await guard.getByRole('button', { name: 'Cancel' }).click();
  await page.goto(BASE + '/review');
  await page.getByRole('button', { name: 'Air is not dumped on an E-stop', exact: true }).waitFor({ timeout: 10000 });
  await rowOf('Air is not dumped on an E-stop').getByRole('button', { name: 'Resolved' }).click();
  await page.getByPlaceholder(/Reason/).fill('Dump valve added to the pneumatic design');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  check(await rowOf('Air is not dumped on an E-stop').count() === 0, 'resolved finding leaves the open list');
  await rowOf('Pusher retract is not confirmed').getByRole('button', { name: 'Ask AI to fix' }).click();
  await page.waitForURL(/\/program/);
  // Wait for the program's request box (the review page also has answer boxes until it unmounts).
  await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some((t) => t.value.includes('Pusher retract is not confirmed')), null, { timeout: 10000 }).catch(() => {});
  const req = await page.locator('textarea').last().inputValue();
  check(req.includes('Pusher retract is not confirmed'), 'finding handed to the program Fix & Ask');
  log('Program request from review:', req.split('\n')[0]);
  await snap(page, 'review_fix');
  await page.goto(BASE + '/review');
  await page.getByRole('combobox', { name: 'Status' }).selectOption('all');
  check(await rowOf('Air is not dumped on an E-stop').getByText('resolved').count() === 1, 'resolution kept');
  await snap(page, 'review');

  // Online with a real PLC (desktop bridge = the desktop app's own Modbus client, called from the page, talking to a fake CLICK on localhost):
  // read-only by default, live values, writes only to C/DS after "Allow writes", I/O check-out feeds the SAT and ZIP
  const plc = fakeServer();
  plc.mem.discrete[0] = 1; plc.mem.discrete[45056] = 1; plc.mem.coils[16385] = 1; plc.mem.holding[0] = 7;
  const plcPort = await plc.listen();
  const mb = createModbusClient();
  await page.exposeFunction('__modbus', (method, args) => mb[method](...args));
  await ctx.addInitScript(() => {
    const call = (m) => (...a) => window.__modbus(m, a);
    window.isaDesktop = { ...(window.isaDesktop ?? {}), modbus: Object.fromEntries(['connect', 'disconnect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters', 'writeCoil', 'writeRegister'].map((m) => [m, call(m)])) };
  });
  await page.goto(BASE + '/online');
  await page.getByLabel('PLC IP address').fill('127.0.0.1');
  await page.getByLabel('Modbus port').fill(String(plcPort));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText(/Connected · \d+ reads/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const val = (a) => page.getByLabel(`Value of ${a}`).innerText();
  log('Online values:', 'X001', await val('X001'), '| X002', await val('X002'), '| Y001', await val('Y001'), '| C2', await val('C2'), '| T1', await val('T1'));
  if (await val('X001') !== 'ON' || await val('C2') !== 'ON' || await val('Y001') !== 'OFF') throw new Error('online values do not match the PLC');
  check(!(await page.getByLabel('Allow writes').isChecked()) && plc.state.log.every((l) => l.fc <= 4), 'read-only by default (no write requests)');
  await page.getByLabel('Allow writes').check();
  await page.getByRole('alert').filter({ hasText: 'WRITES ENABLED' }).waitFor();
  check(await page.locator('tr[data-address="Y001"] button').count() === 0 && await page.locator('tr[data-address="X001"] button').count() === 0, 'X / Y cannot be written');
  await page.locator('tr[data-address="C1"]').getByRole('button', { name: 'Set ON' }).click();
  await page.getByText('C1 written.').waitFor({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('[aria-label="Value of C1"]')?.textContent === 'ON', null, { timeout: 5000 });
  const writes = plc.state.log.filter((l) => l.fc === 5 || l.fc === 6);
  log('PLC writes:', JSON.stringify(writes));
  if (writes.length !== 1 || writes[0].address !== 16384 || writes[0].value !== true) throw new Error('unexpected PLC writes');
  await page.getByRole('button', { name: 'Live ladder' }).click();
  await snap(page, 'online_ladder');
  await page.getByRole('button', { name: /^I\/O check-out/ }).click();
  await page.getByLabel('Technician').fill('J.D.');
  await page.getByLabel('Verified X001').check();
  log('Check-out:', await page.getByText(/points verified/).first().innerText());
  await snap(page, 'online_checkout');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await mb.disconnect();
  await plc.close();

  // Preferred brands (customer standard): Allen-Bradley panel parts become choices next to the design's own parts;
  // the electrical AI was given the catalog notes of the brands in use (AutomationDirect by default).
  check(/Catalog specifics per brand:\n- AutomationDirect:/.test(lastUser.electrical ?? '') && !/Allen-Bradley:/.test(lastUser.electrical ?? ''), 'electrical prompt has only the default brand notes');
  await page.goto(BASE + '/equipment');
  // One dropdown per group (like "Use one brand for everything").
  const brandSelect = (group) => page.getByRole('combobox', { name: new RegExp(`^Brand for ${group}`) });
  const addBrand = async (group, name) => {
    const sel = brandSelect(group);
    const value = await sel.locator('option', { hasText: new RegExp(`^${name}`) }).first().getAttribute('value');
    await sel.selectOption(value);
  };
  const hasBrand = async (group, name) => (await brandSelect(group).locator('option:checked').innerText()).startsWith(name);
  const removeBrand = (group) => addBrand(group, 'AutomationDirect');
  await addBrand('Panel parts', 'Allen-Bradley');
  await page.reload();
  check(await hasBrand('Panel parts', 'Allen-Bradley'), 'brand preference is saved with the project');
  await page.setViewportSize({ width: 1366, height: 768 });
  const card = page.getByRole('region', { name: 'Preferred brands' });
  const cardBox = await card.boundingBox();
  log('Brand card at 1366x768:', Math.round(cardBox.width), "x", Math.round(cardBox.height), "px");
  check(cardBox.width <= 1366 && cardBox.height < 520, 'brand card fits at 1366x768');
  await snap(page, 'brands_1366');
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: 'Change K1', exact: true }).click();
  const abChoices = await page.getByLabel(/^Choose 100-C\d\dEJ10$/).count();
  log('Allen-Bradley contactors offered for K1:', abChoices);
  check(abChoices >= 3, 'Allen-Bradley contactors offered when the brand is preferred');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.goto(BASE + '/equipment');
  await removeBrand('Panel parts');
  // An Allen-Bradley PLC + HMI preference shows that brand's CPUs with the modules they'd need and the fit (comparison only).
  await addBrand('PLC and I/O', 'Allen-Bradley');
  await addBrand('Operator panel', 'Allen-Bradley');
  const abCard = page.getByRole('region', { name: 'Preferred PLC brands for this machine' });
  await abCard.waitFor();
  const m820 = await abCard.locator('tr[data-cpu="2080-L20E-20QBB"]').innerText();
  log('Allen-Bradley comparison:', (await abCard.locator('tr[data-cpu]').count()), 'CPUs | Micro820:', m820.replace(/\s+/g, ' '));
  check(/Yes ·/.test(m820), 'Micro820 fits the conveyor cell');
  const panels = await abCard.getByText(/^Touch panels:/).first().innerText();
  log('Touch panels for Allen-Bradley:', panels);
  check(panels.includes('2713P-T7WD1 (7")'), 'PanelView 5310 listed as a compatible touch panel');
  await snap(page, 'brands');
  await removeBrand('PLC and I/O');
  await removeBrand('Operator panel');

  // Deliverables
  await page.goto(BASE + '/export');
  const eng = await dl('Engineering package');
  const engTxt = fs.readFileSync(eng, 'latin1');
  log('Engineering PDF:', Math.round(fs.statSync(eng).size / 1024), 'KB, pages', (engTxt.match(/\/Type \/Page[^s]/g) || []).length, '| has images', engTxt.includes('/Subtype /Image'));
  const xlsx = await dl('Excel report');
  const wbXml = await (await JSZip.loadAsync(fs.readFileSync(xlsx))).file('xl/workbook.xml').async('string');
  log('Excel sheets:', [...wbXml.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(', '));
  check(wbXml.includes('name="Review Findings"'), 'Excel has the design review findings');
  // Purchasing: order list by supplier, AutomationDirect cart CSV ("PartNumber,Quantity", no header), one-page summary
  await page.getByText('Purchasing — order list').waitFor();
  log('Order list:', (await page.locator('#order-list .bg-steel-50 span.text-xs').first().innerText()), '|', await page.getByText(/^Panel parts, total of verified prices/).innerText());
  const adCsv = fs.readFileSync(await dl('AutomationDirect order file (CSV)'), 'utf8').trim().split(/\r?\n/);
  if (!adCsv.length || !adCsv.every((l) => /^[A-Z0-9][A-Z0-9-]*,\d+$/i.test(l))) throw new Error('AutomationDirect order file is not "PartNumber,Quantity" lines: ' + adCsv.slice(0, 3).join(' | '));
  log('AutomationDirect order file:', adCsv.length, 'lines, e.g.', adCsv.slice(0, 3).join(' | '));
  // Panel parts only: the CPU is ordered once (spares are a separate, optional order, off by default)
  if (!adCsv.some((l) => /^C0-1\dDD1E-D,1$/.test(l))) throw new Error('order file should hold one CPU (no spares): ' + adCsv.filter((l) => l.startsWith('C0-')).join(' | '));
  if (await page.getByLabel('Show recommended spares (separate order)').isChecked()) throw new Error('spares should be off by default');
  const ps = await PDFDocument.load(fs.readFileSync(await dl('Purchase summary PDF')));
  log('Purchase summary PDF pages:', ps.getPageCount());
  if (ps.getPageCount() !== 1) throw new Error('purchase summary is not one page');
  const ox = await JSZip.loadAsync(fs.readFileSync(await dl('Order list (Excel)')));
  log('Order list Excel sheets:', [...(await ox.file('xl/workbook.xml').async('string')).matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(', '));
  const full = await dl('Download full package PDF');
  const fullDoc = await PDFDocument.load(fs.readFileSync(full));
  const outlines = fullDoc.catalog.lookup(PDFName.of('Outlines'));
  log('Full package PDF:', Math.round(fs.statSync(full).size / 1024), 'KB, pages', fullDoc.getPageCount(), '| bookmarks', outlines ? outlines.get(PDFName.of('Count')).toString() : 'none');
  if (!outlines) throw new Error('full package has no bookmarks');
  const zipPath = await dl('Download everything');
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  log('ZIP:', Object.keys(zip.files).filter((f) => !f.endsWith('/')).join(', '));
  if (!Object.keys(zip.files).some((f) => f.startsWith('purchasing/') && f.endsWith('_purchase_summary.pdf'))) throw new Error('ZIP has no purchase summary');
  if (!Object.keys(zip.files).some((f) => /^purchasing\/.*_spares_order\.csv$/.test(f))) throw new Error('ZIP has no separate spares order file');
  if (!Object.keys(zip.files).some((f) => /^commissioning\/.*_IO_checkout\.pdf$/.test(f))) throw new Error('ZIP has no I/O check-out sheet');
  await snap(page, 'deliverables');
  // Full machine specification: one text with every part of the project.
  await page.getByTestId('machine-spec').getByRole('button', { name: 'Show' }).click();
  const specDoc = await page.getByLabel('Machine specification text').inputValue();
  fs.writeFileSync(OUT + 'machine_specification.md', specDoc);
  log('Machine specification:', specDoc.length, 'chars,', (specDoc.match(/^## /gm) ?? []).length, 'sections');
  for (const want of ['Machine description', 'Control equipment', 'I/O list', 'Electrical components', 'Operator screens', 'PLC program']) check(specDoc.includes(want), `machine spec has ${want}`);

  // Project file (.isap): save the open project, open it back as a new project, same data.
  const pfBefore = await page.evaluate(() => ({
    io: JSON.parse(localStorage.getItem('plc-io-store')).state.projectIO.length,
    rungs: JSON.parse(localStorage.getItem('plc-program-store')).state.ladder.rungs.length,
    hasDesign: Boolean(JSON.parse(localStorage.getItem('plc-electrical-store')).state.design),
    screens: JSON.parse(localStorage.getItem('plc-hmi-store')).state.design?.screens.length ?? 0,
    name: document.querySelector('select[aria-label="Open project"] option:checked').textContent,
  }));
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const [isapDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Save\s*Ctrl\+S$/ }).click()]);
  const isapPath = OUT + isapDl.suggestedFilename();
  await isapDl.saveAs(isapPath);
  check(isapPath.endsWith('.isap'), 'project file has the .isap extension');
  const isap = await JSZip.loadAsync(fs.readFileSync(isapPath));
  const manifest = JSON.parse(await isap.file('manifest.json').async('string'));
  check(manifest.format === 'isa-auto-programmer-project' && manifest.formatVersion === 1, 'project file manifest');
  check(!(await isap.file('project.json').async('string')).includes('sk-ant-test'), 'API key is not in the project file');
  page.on('console', (m) => { if (m.text().startsWith('DIRTY')) log(m.text().slice(0, 900)); });
  await page.locator('[data-testid="open-project-file"]').setInputFiles(isapPath);
  await page.waitForTimeout(1500);
  check(!(await page.locator('[data-testid="window-title"]').innerText()).includes('*'), 'an opened project has no unsaved changes');
  const pfAfter = await page.evaluate(() => ({
    io: JSON.parse(localStorage.getItem('plc-io-store')).state.projectIO.length,
    rungs: JSON.parse(localStorage.getItem('plc-program-store')).state.ladder.rungs.length,
    hasDesign: Boolean(JSON.parse(localStorage.getItem('plc-electrical-store')).state.design),
    screens: JSON.parse(localStorage.getItem('plc-hmi-store')).state.design?.screens.length ?? 0,
    name: document.querySelector('select[aria-label="Open project"] option:checked').textContent,
  }));
  log('Project file:', Math.round(fs.statSync(isapPath).size / 1024), 'KB |', JSON.stringify(pfBefore), '→', JSON.stringify(pfAfter));
  check(pfAfter.name === `${pfBefore.name} (2)`, 'opened as a new project with a new name');
  check(pfAfter.io === pfBefore.io && pfAfter.rungs === pfBefore.rungs && pfAfter.hasDesign === pfBefore.hasDesign && pfAfter.screens === pfBefore.screens, 'project file round trip keeps the data');
  // Unsaved-changes marker: an edit sets it, Save clears it.
  await page.goto(BASE + '/project');
  await page.getByLabel('preparedBy').fill('Q.A.');
  await page.waitForTimeout(300);
  check((await page.locator('[data-testid="window-title"]').innerText()).endsWith('*'), 'an edit marks the project unsaved');
  check((await page.locator('[data-testid="save-state"]').innerText()) === 'Unsaved changes', 'status bar shows unsaved changes');
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  await page.waitForTimeout(300);
  check(!(await page.locator('[data-testid="window-title"]').innerText()).includes('*'), 'Ctrl+S saves and clears the marker');
  log('Save state:', await page.locator('[data-testid="save-state"]').innerText(), '| title:', await page.title());
  await page.locator('[data-testid="open-project-file"]').setInputFiles({ name: 'bad.isap', mimeType: 'application/octet-stream', buffer: Buffer.from('not a zip') });
  await page.waitForTimeout(500);
  check((await page.locator('body').innerText()).includes('not an ISA Auto Programmer project file'), 'a wrong file is refused with a clear message');

  log('AI calls:', JSON.stringify(counts));
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) throw new Error(`${errors.length} page/console error(s)`);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
