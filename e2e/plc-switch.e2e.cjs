// QA HIGH #1, both halves, on the example project:
//   - deleting I002 Start Button leaves no HMI element or rung silently on the Stop button that moves onto X002:
//     the HMI's Start elements are unbound and marked, the rungs marked ?X002, and the checker shows an error;
//   - switching CLICK → CompactLogix on the PLC page renumbers the I/O and the program and the HMI follow:
//     0 checker errors, no HMI element left on a CLICK address.
//   npx vite --port 5202 &  ;  BASE_URL=http://localhost:5202 node e2e/plc-switch.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:5202';
const fails = [];
const check = (ok, what) => { console.log(ok ? '  ✓' : '  ✗', what); if (!ok) fails.push(what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await useAppModules(page);
  // A cold dev server compiles the app on the first load: allow it time (the waits below are for elements, not delays).
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const seed = async () => {
    await page.goto(BASE + '/spec');
    await page.evaluate(async () => { const m = await appImport('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
    await page.goto(BASE + '/spec');
    await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  };
  // The checker's errors and what the HMI binds, read from the app's own stores.
  const state = () => page.evaluate(async () => {
    const [{ useProgramStore }, { useHmiStore }, { useIOStore }, { useProjectStore }, { ioAddresses }, { validateProgram }, { getProfile }] = await Promise.all([
      appImport('/src/store/useProgramStore.ts'), appImport('/src/store/useHmiStore.ts'), appImport('/src/store/useIOStore.ts'), appImport('/src/store/useProjectStore.ts'),
      appImport('/src/plc/core/ioChange.ts'), appImport('/src/plc/core/validate.ts'), appImport('/src/plc/core/profiles/index.ts'),
    ]);
    const addr = ioAddresses(useIOStore.getState().projectIO);
    const design = useHmiStore.getState().design;
    const errors = validateProgram(useProgramStore.getState().ladder, getProfile(useProjectStore.getState().plcId), new Set([...addr.values()]), design ?? undefined).filter((i) => i.severity === 'error').map((i) => i.message);
    const els = design.screens.flatMap((s) => s.elements);
    return { plc: useProjectStore.getState().plcId, errors, lost: els.filter((e) => e.lostIo).map((e) => e.label), startOnX002: els.some((e) => e.address === 'X002' && /start/i.test(e.label || '')), clickAddr: els.filter((e) => /^[XY]0\d\d$/.test(e.address || '')).length };
  });

  // 1. Delete I002 Start Button.
  await seed();
  await page.goto(BASE + '/io');
  await page.waitForSelector('input[aria-label="Description of I002"]');
  const row = page.locator('tr', { has: page.locator('input[aria-label="Description of I002"]') });
  await row.hover();
  await page.getByRole('button', { name: 'Delete I002' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete I002?' });
  const listed = await dialog.innerText();
  check(/Program rung/.test(listed) && /Screen /.test(listed), 'the confirmation lists the program rungs and the HMI elements on Start');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  const d = await state();
  check(!d.startOnX002, 'no HMI Start element left on X002 (now the Stop button)');
  check(d.lost.length > 0, `the HMI elements on Start are marked (${d.lost.join(', ')})`);
  check(d.errors.some((m) => /used X002, whose I\/O point was deleted/.test(m)), 'the checker shows an error for the deleted point');
  check(/Deleted I002/.test(await page.getByRole('alert').innerText()), 'a message says what changed');

  // 2. CLICK → CompactLogix on the PLC page.
  await seed();
  check((await state()).errors.length === 0, 'the example has 0 checker errors on CLICK');
  await page.goto(BASE + '/plc');
  await page.getByTestId('plc-change').locator('summary').click(); // the PLC is chosen in Equipment; changed here behind this
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /CompactLogix/ }).first().click();
  await page.waitForTimeout(500);
  const l = await state();
  check(l.plc === 'logix', `the PLC is now CompactLogix (${l.plc})`);
  check(l.errors.length === 0, `0 checker errors after the switch (${l.errors.slice(0, 3).join(' | ')})`);
  check(l.clickAddr === 0, 'no HMI element left on a CLICK address');
  check(/renumbered/.test(await page.getByRole('alert').innerText()), 'a message says the program and the HMI followed');

  // 3. More points than the CPU has built in (side manager's probe): a CLICK C0-12 with a C0-16ND3 and a C0-08TD1,
  // 23 points, switched to CompactLogix. The CPU and its rack change in one step: every rung still names its own
  // point (none lands on another point's terminal), and one Undo puts the CLICK project back.
  await seed();
  const program = () => page.evaluate(async () => {
    const [{ useProgramStore }, { useIOStore }, { useProjectStore }, { ioAddresses }] = await Promise.all([
      appImport('/src/store/useProgramStore.ts'), appImport('/src/store/useIOStore.ts'), appImport('/src/store/useProjectStore.ts'), appImport('/src/plc/core/ioChange.ts'),
    ]);
    const io = useIOStore.getState().projectIO;
    const addr = ioAddresses(io);
    // Each rung's comment is its point's id: the operand must be that point's address now.
    const wrong = useProgramStore.getState().ladder.rungs.filter((r) => /^P:/.test(r.comment)).filter((r) => {
      const id = r.comment.slice(2);
      const op = io.find((p) => p.id === id)?.type === 'input' ? r.branches[0][0].address : r.outputs[0].address;
      return op !== addr.get(id);
    }).map((r) => r.comment);
    return { plc: useProjectStore.getState().plcId, cpu: useProjectStore.getState().cpuId, modules: useProjectStore.getState().modules.join(','), wrong, addr: [...addr.values()].join(',') };
  });
  await page.evaluate(async () => {
    const [{ useProgramStore }, { useIOStore }, { useProjectStore }] = await Promise.all([
      appImport('/src/store/useProgramStore.ts'), appImport('/src/store/useIOStore.ts'), appImport('/src/store/useProjectStore.ts'),
    ]);
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-12DD1E-D', modules: ['C0-16ND3', 'C0-08TD1'] });
    useIOStore.getState().importPoints([
      ...Array.from({ length: 13 }, (_, i) => ({ description: `Sensor ${i + 1}`, type: 'input', category: 'Product Detection' })),
      ...Array.from({ length: 10 }, (_, i) => ({ description: `Valve ${i + 1}`, type: 'output', category: 'Pneumatic' })),
    ], true);
    const { ioAddresses } = await appImport('/src/plc/core/ioChange.ts');
    const io = useIOStore.getState().projectIO, addr = ioAddresses(io);
    const rungs = io.map((p, i) => (p.type === 'input'
      ? { id: `r${i}`, comment: `P:${p.id}`, branches: [[{ type: 'NO', address: addr.get(p.id) }]], outputs: [{ type: 'OUT', address: `C${300 + i}` }] }
      : { id: `r${i}`, comment: `P:${p.id}`, branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'OUT', address: addr.get(p.id) }] }));
    const ladder = useProgramStore.getState().ladder;
    useProgramStore.getState().editLadder({ ...ladder, rungs: [...ladder.rungs, ...rungs] });
  });
  const c0 = await program();
  check(c0.wrong.length === 0 && /Y205/.test(c0.addr), `the 23-point CLICK project: every rung on its point (${c0.addr})`);
  await page.goto(BASE + '/plc');
  await page.getByTestId('plc-change').locator('summary').click(); // the PLC is chosen in Equipment; changed here behind this
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /CompactLogix/ }).first().click();
  await page.waitForTimeout(500);
  const big = await program();
  check(big.plc === 'logix', `the PLC is now CompactLogix (${big.plc} ${big.cpu} ${big.modules})`);
  check(big.wrong.length === 0, `every rung still names its own point (${big.wrong.slice(0, 4).join(', ')})`);
  await page.getByRole('button', { name: /^Undo: PLC change/ }).click();
  await page.waitForTimeout(300);
  const back = await program();
  check(back.plc === 'click' && back.cpu === 'C0-12DD1E-D' && back.modules === 'C0-16ND3,C0-08TD1', `one Undo puts the CPU and the modules back (${back.cpu} ${back.modules})`);
  check(back.wrong.length === 0 && back.addr === c0.addr, 'and every rung on its CLICK address');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  if (fails.length) { console.log(`plc-switch e2e: ${fails.length} failed`); process.exit(1); }
  console.log('plc-switch e2e passed');
})();
