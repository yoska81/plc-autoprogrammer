// E2E v0.7: wizard (describe → equipment) → I/O → electrical (cabinet/machine/picture) → HMI → program → simulate → spec change/update all → deliverables.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require('jszip');
const fs = require('fs');
const SP = __dirname + '/';
const OUT = SP + 'out/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const F = JSON.parse(fs.readFileSync(SP + 'fixtures.json', 'utf8'));
const log = (...a) => console.log('•', ...a);
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
function reply(system) {
  const k = system.includes('functional specification') ? 'spec'
    : system.includes('choosing the control equipment') ? 'equipment'
    : system.includes('complete discrete PLC I/O list') ? 'io'
    : system.includes('industrial control panel') ? 'electrical'
    : system.includes('HMI designer') ? 'hmi'
    : system.includes('ladder logic') ? 'ladder' : 'unknown';
  counts[k] = (counts[k] ?? 0) + 1;
  const m = F.DESIGN.machine;
  switch (k) {
    case 'spec': return { sections: F.SPEC, questions: ['How many parts per minute at most?'], summary: 'Organized the description into 10 sections.' };
    case 'equipment': return F.RECOMMENDATION;
    case 'io': return { explanation: '5 inputs, 2 outputs.', points: IO_POINTS, questions: [] };
    case 'electrical': return {
      explanation: 'NEMA 12 panel, 480 VAC.', components: F.DESIGN.components, ioWiring: F.DESIGN.ioWiring, notes: F.DESIGN.notes, motors: F.DESIGN.inputs.motors,
      machine: { zones: m.zones, junctionBoxes: m.junctionBoxes, motorLocations: Object.entries(m.motorLocations).map(([motorTag, location]) => ({ motorTag, location })), routing: Object.entries(m.routing).map(([deviceTag, junctionBox]) => ({ deviceTag, junctionBox })) },
    };
    case 'hmi': return { explanation: 'Three screens.', screens: F.HMI.screens, alarms: F.HMI.alarms, tags: F.HMI.tags, notes: [] };
    case 'ladder': {
      if (counts.ladder === 1) return { explanation: 'Program written from the spec.', program: F.LADDER };
      const p = JSON.parse(JSON.stringify(F.LADDER));
      p.rungs.find((r) => r.id === 'r_tmo').outputs[0].preset = '5';
      return { explanation: 'Pusher timeout changed from 3 s to 5 s.', program: p };
    }
    default: throw new Error('unknown prompt: ' + system.slice(0, 80));
  }
}

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
  page.on('dialog', (d) => d.accept());
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, JSON.stringify(reply(body.system))) });
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
  await page.getByRole('button', { name: /480 V 3-phase/ }).click();
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
  await page.getByRole('button', { name: 'Use this selection' }).click();
  log('Summary panel controller:', await page.locator('aside dd.font-mono').first().innerText());
  await page.getByRole('button', { name: 'Next →' }).click();
  await snap(page, 'wizard_4');
  await page.getByRole('button', { name: 'Open project →' }).click();
  await page.waitForURL('**/io');
  log('Project open:', await page.locator('select[aria-label="Open project"] option:checked').innerText());

  // I/O
  await page.getByRole('button', { name: 'Generate I/O from spec' }).click();
  await page.getByText('Review I/O changes').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Apply changes' }).click();
  log('I/O addresses:', (await page.locator('input[aria-label^="PLC address"]').evaluateAll((els) => els.map((e) => e.placeholder))).join(' '));
  await snap(page, 'io');

  // Electrical
  await page.goto(BASE + '/electrical?tab=design');
  await page.getByRole('button', { name: /Generate (Electrical Design|New Design)/ }).click();
  await page.getByRole('button', { name: 'BOM CSV' }).waitFor({ timeout: 15000 });
  for (const t of ['cabinet', 'machine', 'picture']) {
    await page.goto(BASE + `/electrical?tab=${t}`);
    await page.waitForTimeout(1200);
    await snap(page, `electrical_${t}`);
  }

  // HMI (part preselected by equipment)
  await page.goto(BASE + '/hmi');
  log('HMI preselected:', await page.getByText(/CM5-T7W · 7"/).count() > 0);
  await page.getByRole('button', { name: 'Design the HMI screens' }).click();
  await page.getByText(/HMI tags \(\d+\)/).waitFor({ timeout: 15000 });

  // Program
  await page.goto(BASE + '/program');
  await page.getByRole('button', { name: 'Describe' }).click();
  await page.getByRole('button', { name: 'Generate Program' }).click();
  await page.getByText('Cycle running: panel or HMI Start').waitFor({ timeout: 15000 });
  log('Tree status dots (done/stale):', await page.locator('nav [title="Done"]').count(), '/', await page.locator('nav [title="Out of date"]').count());
  await snap(page, 'program');

  // Simulate
  await page.goto(BASE + '/simulate');
  await page.getByRole('button', { name: /^Run$/ }).first().click();
  const box = await page.locator('aside svg text', { hasText: /^START$/ }).last().boundingBox();
  if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); }
  await page.waitForTimeout(5000);
  await snap(page, 'simulate');

  // Spec change → update all
  await page.goto(BASE + '/spec');
  await page.locator('#spec-alarms').fill('- Pusher fault: pusher not extended within 5 s.');
  log('Out of date after edit:', await page.locator('nav [title="Out of date"]').count());
  await page.getByRole('button', { name: /Update out-of-date stages/ }).click();
  await page.getByRole('button', { name: 'Review program changes' }).waitFor({ timeout: 30000 });
  log('Update steps:', (await page.locator('.fixed ol li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  await page.getByRole('button', { name: 'Review program changes' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.waitForTimeout(300);
  log('After approve out of date:', await page.locator('nav [title="Out of date"]').count());

  // Deliverables
  await page.goto(BASE + '/export');
  const dl = async (name) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name, exact: true }).click()]);
    const path = OUT + d.suggestedFilename();
    await d.saveAs(path);
    return path;
  };
  const eng = await dl('Engineering package');
  const engTxt = fs.readFileSync(eng, 'latin1');
  log('Engineering PDF:', Math.round(fs.statSync(eng).size / 1024), 'KB, pages', (engTxt.match(/\/Type \/Page[^s]/g) || []).length, '| has images', engTxt.includes('/Subtype /Image'));
  const xlsx = await dl('Excel report');
  const wbXml = await (await JSZip.loadAsync(fs.readFileSync(xlsx))).file('xl/workbook.xml').async('string');
  log('Excel sheets:', [...wbXml.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(', '));
  const zipPath = await dl('Download everything');
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  log('ZIP:', Object.keys(zip.files).filter((f) => !f.endsWith('/')).join(', '));
  await snap(page, 'deliverables');

  log('AI calls:', JSON.stringify(counts));
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
