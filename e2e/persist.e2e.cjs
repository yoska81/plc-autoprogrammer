// Nothing the user typed or selected is lost when moving between pages or reloading.
// On the example project: type / select on each page, leave through the project tree, come back
// (client-side navigation), check; reload the browser, check again.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/persist.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const log = (...a) => console.log('•', ...a);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  const fails = [];
  const tree = async (name) => { await page.locator('nav a', { hasText: new RegExp(`^${name}(\\s*\\d+\\?)?$`) }).first().click(); await page.waitForTimeout(500); };
  // Each case: where, how to get there, what to do, how to read it back, expected value.
  const cases = [
    { name: 'Spec: "Add to the spec" text', go: () => tree('Machine description'),
      act: () => page.getByPlaceholder(/Pick and place cell/).fill('Persist: a second conveyor feeds the pusher.'),
      read: () => page.getByPlaceholder(/Pick and place cell/).inputValue(), want: 'Persist: a second conveyor feeds the pusher.' },
    { name: 'Equipment: CPU chosen, not yet applied', go: () => tree('Equipment'),
      act: async () => { await page.locator('tr', { has: page.locator('input[aria-label="Choose C0-11DD1E-D"]') }).click(); },
      read: async () => `${await page.locator('input[aria-label="Choose C0-11DD1E-D"]').isChecked()} ${await page.getByRole('status').filter({ hasText: 'not applied' }).count()}`, want: 'true 1' },
    { name: 'I/O list: filter text', go: () => tree('I/O list'),
      act: () => page.getByPlaceholder('Filter').first().fill('Pusher'),
      read: () => page.getByPlaceholder('Filter').first().inputValue(), want: 'Pusher' },
    { name: 'Electrical: selected sheet and zoom', go: () => tree('Cabinet wiring'),
      act: async () => { await page.locator('[role="tab"]').nth(4).click(); await page.getByRole('button', { name: '200%' }).click(); },
      read: async () => `${await page.locator('[role="tab"]').nth(4).getAttribute('aria-selected')} ${await page.getByRole('button', { name: '200%' }).getAttribute('class').then((c) => /bg-steel-900|bg-brand|text-white/.test(c ?? ''))}`, want: 'true true' },
    { name: 'Labels: filter', go: () => tree('Labels'),
      act: () => page.getByLabel('Filter labels').fill('PB'),
      read: () => page.getByLabel('Filter labels').inputValue(), want: 'PB' },
    { name: 'HMI: screen and edit mode', go: () => tree('HMI screens'),
      act: async () => { await page.locator('nav[aria-label="Screens"] button').nth(2).click(); await page.getByRole('button', { name: 'Edit screen' }).click(); },
      read: async () => `${await page.locator('nav[aria-label="Screens"] button').nth(2).getAttribute('aria-current')} ${await page.getByRole('button', { name: 'Done editing' }).count()}`, want: 'page 1' },
    { name: 'Program: Fix & Ask text', go: () => tree('PLC program'),
      act: async () => { const t = page.getByPlaceholder(/Describe a problem or change/); if (!(await t.count())) await page.getByRole('button', { name: /^Fix/ }).first().click(); await page.getByPlaceholder(/Describe a problem or change/).fill('Persist: add a jam timer'); },
      read: () => page.getByPlaceholder(/Describe a problem or change/).inputValue(), want: 'Persist: add a jam timer' },
    { name: 'Simulation: speed and block', go: () => tree('Simulation'),
      act: async () => { await page.getByRole('button', { name: '2x', exact: true }).click(); await page.getByRole('group', { name: 'Block' }).getByRole('button', { name: /^Conveyor/ }).click(); },
      read: async () => `${await page.getByRole('button', { name: '2x', exact: true }).getAttribute('class').then((c) => /bg-brand|text-white/.test(c ?? ''))} ${await page.getByRole('group', { name: 'Block' }).getByRole('button', { name: /^Conveyor/ }).getAttribute('class').then((c) => /bg-brand-600/.test(c ?? ''))}`, want: 'true true' },
    { name: 'Design review: status filter and search', go: () => tree('Design review'),
      act: async () => { await page.getByLabel('Status').selectOption('all'); await page.getByPlaceholder('Search findings').fill('reset'); },
      read: async () => `${await page.getByLabel('Status').inputValue()} ${await page.getByPlaceholder('Search findings').inputValue()}`, want: 'all reset' },
    { name: 'Project data: new revision description', go: () => tree('Project data'),
      act: async () => { const d = page.getByLabel(/Revision description|Description/).last(); await d.fill('Persist: for customer comments'); },
      read: () => page.getByLabel(/Revision description|Description/).last().inputValue(), want: 'Persist: for customer comments' },
  ];

  for (const c of cases) {
    try {
      await c.go();
      await c.act();
      await page.waitForTimeout(300);
    } catch (e) { fails.push(`${c.name}: could not set (${e.message.split('\n')[0]})`); c.skip = true; }
  }
  for (const phase of ['after navigating away and back', 'after a reload']) {
    if (phase === 'after a reload') { await page.reload(); await page.waitForTimeout(1200); }
    for (const c of cases.filter((x) => !x.skip)) {
      await tree('Project data');
      await c.go();
      await page.waitForTimeout(400);
      let got;
      try { got = await c.read(); } catch (e) { got = `error: ${e.message.split('\n')[0]}`; }
      if (got !== c.want) fails.push(`${c.name} ${phase}: got "${got}", want "${c.want}"`);
    }
  }

  // The new-project wizard: fields typed on step 1 survive leaving the wizard.
  await page.goto(BASE + '/new');
  await page.getByPlaceholder('e.g. Line 3 case packer').fill('Persist Wizard Cell');
  await page.waitForTimeout(300);
  await page.goto(BASE + '/project');
  await page.goto(BASE + '/new');
  const wiz = await page.getByPlaceholder('e.g. Line 3 case packer').inputValue();
  if (wiz !== 'Persist Wizard Cell') fails.push(`Wizard: project name got "${wiz}"`);

  // Drafts belong to the project: another project does not see them, and they come back with it.
  await page.evaluate(async () => { const { useProjectsStore } = await import('/src/store/useProjectsStore.ts'); useProjectsStore.getState().createProject('Persist Other'); });
  await page.goto(BASE + '/spec');
  const other = await page.getByPlaceholder(/Pick and place cell/).inputValue();
  if (other) fails.push(`Another project shows the example's draft: "${other}"`);
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/spec');
  const back = await page.getByPlaceholder(/Pick and place cell/).inputValue();
  if (back !== cases[0].want) fails.push(`Draft not restored after switching projects: "${back}"`);

  log(`${cases.length + 2} cases checked`);
  log('Page errors:', errors.length ? errors.slice(0, 5) : 'none');
  if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); await browser.close(); process.exit(1); }
  log('everything typed or selected is still there');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
