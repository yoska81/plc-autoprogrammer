// Sourcing & Engineer review on the example project (AI mocked): the BOM with price / availability /
// lifecycle, alternatives and Swap (design, drawings and SCCR follow; the change is shown; Undo),
// Live check (web search mocked: values only from a page the search returned), Optimise, the Engineer
// review (rule findings, AI findings with a one-click swap) and the review package for a human engineer.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/sourcing.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const JSZip = require('jszip');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
function sse(model, blocks) {
  let body = ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  blocks.forEach((b, i) => {
    if (b.type === 'text') {
      body += ev('content_block_start', { index: i, content_block: { type: 'text', text: '' } }) + ev('content_block_delta', { index: i, delta: { type: 'text_delta', text: b.text } });
    } else body += ev('content_block_start', { index: i, content_block: b });
    body += ev('content_block_stop', { index: i });
  });
  return body + ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } }) + ev('message_stop', {});
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  let engineerPart = null;
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    let blocks;
    if (body.tools?.some((t) => t.name === 'web_search')) {
      const pn = body.messages[0].content.match(/- (\S+) \(/)[1];
      const url = `https://www.automationdirect.com/adc/shopping/catalog/x/${pn.toLowerCase()}`;
      blocks = [
        { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: pn } },
        { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [{ type: 'web_search_result', url, title: `${pn} | AutomationDirect`, encrypted_content: 'x', page_age: '1 day ago' }] },
        { type: 'text', text: JSON.stringify({ results: [
          { partNumber: pn, stock: 'In stock: 37', leadTime: 'Ships today', price: '$60.00', distributor: 'AutomationDirect', url, note: '' },
        ] }) },
      ];
    } else {
      // The AI engineer: one finding with a swap between two catalog parts.
      blocks = [{ type: 'text', text: JSON.stringify({ summary: 'Sound panel; one breaker to reconsider.', findings: [
        { severity: 'minor', area: 'electrical', topic: 'SCCR', title: 'Prefer a higher-rated branch breaker', explanation: 'Test finding.', fix: 'Swap it.', tag: engineerPart.tag, replaceWith: engineerPart.to },
      ] }) }];
    }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(body.model, blocks) });
  });

  await page.goto(BASE + '/spec');
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('plc-settings-store', JSON.stringify({ state: { provider: 'anthropic', anthropicApiKey: 'sk-ant-test', anthropicModel: 'claude-opus-5-5', effort: 'low', openaiApiKey: '', openaiModel: 'gpt-4o' }, version: 4 }));
    (await appImport('/src/preview/sampleProject.ts')).seedSampleProject();
  });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  // The tree has the two new pages under Electrical design.
  check(await page.getByRole('link', { name: 'Sourcing' }).count() > 0, 'tree: Sourcing');
  check(await page.getByRole('link', { name: 'Engineer review' }).count() > 0, 'tree: Engineer review');

  // 1. Sourcing: BOM by function with price, availability, lifecycle, checked-on date.
  await page.goto(BASE + '/sourcing');
  await page.waitForTimeout(1200);
  const main = await page.locator('main').innerText();
  check(/List price \$\d/.test(main), 'total list price shown');
  check(/Checked on/i.test(main) && /2026-\d\d-\d\d/.test(main), 'checked-on dates shown');
  const altBtn = page.getByRole('button', { name: /^Alternatives \(/ }).first();
  check(await altBtn.count() > 0, 'a part with cross-brand alternatives');
  const row = altBtn.locator('xpath=ancestor::tr');
  const from = await row.getAttribute('data-part');
  await altBtn.click();
  const alts = page.getByTestId(`alternatives-${from}`);
  const to = (await alts.locator('tbody tr').first().locator('td').first().innerText()).split(/\s+/)[0];
  log(`Alternatives for ${from}: ${(await alts.locator('tbody tr').count())}; swapping to ${to}`);
  await alts.getByRole('button', { name: 'Swap' }).first().click();
  await page.waitForTimeout(500);
  const impact = page.getByTestId('swap-impact');
  check(await impact.count() === 1 && new RegExp(`${from} → ${to}`).test(await impact.innerText()), 'swap reported with what changed');
  const pns = await page.evaluate(async () => (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState().design.components.map((c) => c.partNumber));
  check(pns.includes(to) && !pns.includes(from), 'the design uses the replacement');
  await impact.getByRole('button', { name: 'Undo' }).click();
  const back = await page.evaluate(async () => (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState().design.components.map((c) => c.partNumber));
  check(back.includes(from) && !back.includes(to), 'Undo restores the part');

  // 2. Live check (mocked web search): values with their source page and date.
  await page.locator(`tr[data-part="${from}"]`).getByRole('button', { name: 'Check now' }).click();
  await page.locator(`tr[data-part="${from}"]`).getByText('In stock: 37').waitFor({ timeout: 15000 });
  const liveCell = await page.locator(`tr[data-part="${from}"]`).innerText();
  log('Live check cell:', liveCell.replace(/\s+/g, ' ').slice(0, 200));
  check(/AutomationDirect · \d{4}-\d\d-\d\d/.test(liveCell), 'live result names its source and date');
  check(/Pages the live check read/.test(await page.locator('main').innerText()), 'sources listed');

  // 3. Optimise: goals and the proposals table.
  await page.getByRole('button', { name: /^Optimise/ }).click();
  await page.getByLabel('One brand').fill('3');
  await page.waitForTimeout(300);
  const opt = await page.locator('main').innerText();
  log('Optimise:', /No change scores better/.test(opt) ? 'no proposals' : `${await page.getByTestId('optimise-proposals').locator('tbody tr').count()} proposal(s)`);
  check(/What matters most/.test(opt), 'optimise goals shown');

  // 4. Engineer review: rule findings, AI finding with a one-click swap.
  engineerPart = await page.evaluate(async () => {
    const { equivalentsOf } = await appImport('/src/sourcing/data.ts');
    const d = (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState().design;
    const c = d.components.find((x) => equivalentsOf(x.partNumber).length);
    return { tag: c.tag, from: c.partNumber, to: equivalentsOf(c.partNumber)[0].part.partNumber };
  });
  await page.goto(BASE + '/engineer');
  await page.waitForTimeout(1200);
  const rulesCount = await page.getByTestId('engineer-findings').locator('li').count();
  log('Engineer review rule findings:', rulesCount);
  await page.getByRole('button', { name: 'Run AI engineer' }).click();
  await page.getByText('Prefer a higher-rated branch breaker').waitFor({ timeout: 15000 });
  check(/Engineer's verdict/.test(await page.locator('main').innerText()), 'AI verdict shown');
  await page.getByRole('button', { name: `Use ${engineerPart.to}` }).first().click();
  await page.waitForTimeout(400);
  check(await page.getByTestId('engineer-fixed').count() === 1, 'one-click fix applied and reported');
  const fixedPns = await page.evaluate(async () => (await appImport('/src/store/useElectricalStore.ts')).useElectricalStore.getState().design.components.map((c) => c.partNumber));
  check(fixedPns.includes(engineerPart.to), 'the one-click fix swapped the part');

  // 5. Ask a human engineer: the review package.
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Download review package' }).click()]);
  const zip = await JSZip.loadAsync(require('fs').readFileSync(await dl.path()));
  const names = Object.keys(zip.files);
  log('Review package:', dl.suggestedFilename(), names.join(', '));
  for (const f of ['bom.csv', 'io_list.csv', 'machine_specification.md', 'engineer_findings.csv', 'engineer_review.md']) check(names.includes(f), `package has ${f}`);
  check(names.some((n) => n.endsWith('_drawings.pdf')), 'package has the drawings PDF');
  const mailto = await page.evaluate(async () => {
    const { reviewMailto } = await appImport('/src/engineer/package.ts');
    return reviewMailto((await appImport('/src/deliverables/collect.ts')).collectProject(), [], 'x.zip', 'eng@example.com');
  });
  check(/^mailto:eng%40example\.com\?subject=Design%20review%20request/.test(mailto), 'e-mail draft');

  for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
  await browser.close();
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
  log('Sourcing and Engineer review work');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
