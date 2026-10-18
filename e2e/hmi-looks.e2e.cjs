// HMI looks on the example project: the Look picker lists every look with a preview thumbnail;
// the look follows the panel's maker until one is picked (C-more panel → C-more look, Weintek
// panel → Weintek look); every screen in every look is drawn with no text past its element, no
// two elements' texts on top of each other and a clean layout check; the screen images (PNG ZIP)
// and the HMI screens PDF use the chosen look.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/hmi-looks.e2e.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const JSZip = require(path.join(__dirname, '..', 'node_modules', 'jszip'));
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-hmi-looks');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };
/** The large screen on the HMI page (the screen list's thumbnails carry the same aria-label). */
const mainSvg = (page) => page.evaluateHandle(() => [...document.querySelectorAll('svg[aria-label^="HMI screen:"]')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]);

const hmiState = (page) => page.evaluate(async () => (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design);
const screenButtons = (page) => page.locator('nav[aria-label="Screens"] > button');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(800);

  const theme = await page.evaluate(async () => {
    const t = await import('/src/hmi/theme.ts');
    return { looks: t.HMI_LOOKS, labels: t.LOOK_LABEL, screens: Object.fromEntries(t.HMI_LOOKS.map((l) => [l, t.PALETTES[l].screen])), headers: Object.fromEntries(t.HMI_LOOKS.map((l) => [l, t.PALETTES[l].header])) };
  });

  // 1. Default: the example's C-more panel → C-more look, shown as following the panel.
  const picker = page.getByRole('button', { name: 'HMI look' });
  const startDesign = await hmiState(page);
  check(!startDesign.look, 'example design has no look stored');
  check(/C-more style \(panel\)/.test(await picker.innerText()), `picker shows the C-more look as the panel's (${await picker.innerText()})`);
  const bg = async () => (await mainSvg(page)).evaluate((s) => s.style.background);
  const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
  check((await bg()) === rgb(theme.screens.cmore), `screen drawn in the C-more look (${await bg()})`);

  // 2. The list: "Match the panel" + every look, each with a thumbnail.
  await picker.click();
  const options = page.locator('[role="listbox"][aria-label="HMI looks"] [role="option"]');
  check(await options.count() === theme.looks.length + 1, `picker lists every look (${await options.count()})`);
  check(await options.locator('svg').count() === theme.looks.length + 1, 'every look has a preview thumbnail');
  await page.locator('[role="listbox"]').screenshot({ path: path.join(OUT, '00_picker.png') });
  await page.keyboard.press('Escape');

  // 2b. The list stays inside the window: with the picker near the bottom it opens upward (or
  // shrinks and scrolls); near the top it opens downward.
  const inWindow = async (where) => {
    await picker.evaluate((b, where) => {
      // Scroll the picker's scroll container (or the page) so the button sits near the bottom / top.
      let sc = b.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const r = b.getBoundingClientRect();
      const target = where === 'bottom' ? window.innerHeight - r.height - 20 : 80;
      (sc ?? document.scrollingElement).scrollBy(0, r.top - target);
    }, where);
    await picker.click();
    const list = page.locator('[role="listbox"][aria-label="HMI looks"]');
    const b = await list.boundingBox();
    const btn = await picker.boundingBox();
    const vh = page.viewportSize().height;
    const placement = await list.getAttribute('data-placement');
    const scrolls = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    log(`Picker near the ${where} (button at y=${Math.round(btn.y)}): list opens ${placement}, ${Math.round(b.y)}–${Math.round(b.y + b.height)} of ${vh}${scrolls ? ', scrolls' : ''}`);
    check(b.y >= 0 && b.y + b.height <= vh, `picker near the ${where}: list inside the window (${Math.round(b.y)}–${Math.round(b.y + b.height)} of ${vh})`);
    // Not cut off by the panel it sits in either: its first and last rows are what is drawn there.
    const visible = await list.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [r.top + 6, r.bottom - 6].every((y) => el.contains(document.elementFromPoint(r.left + r.width / 2, y)));
    });
    check(visible, `picker near the ${where}: top and bottom of the list are visible (not clipped)`);
    await page.screenshot({ path: path.join(OUT, `00_picker_${where}.png`) });
    await page.keyboard.press('Escape');
    return { placement, btn };
  };
  await page.setViewportSize({ width: 1600, height: 700 });
  const low = await inWindow('bottom');
  if (low.btn.y > 700 / 2) check(low.placement === 'up', 'low picker opens upward');
  await page.setViewportSize({ width: 1600, height: 1400 });
  const high = await inWindow('top');
  check(high.btn.y + 416 < 1400 ? high.placement === 'down' : true, 'picker with room below opens downward');
  await page.setViewportSize({ width: 1600, height: 1000 });

  // 3. Every look × every screen: texts inside their element, no two texts on top of each other, layout check clean.
  const nScreens = await screenButtons(page).count();
  for (const look of theme.looks) {
    await picker.click();
    await page.locator(`[role="option"][data-look="${look}"]`).click();
    check((await hmiState(page)).look === look, `${look}: stored`);
    check((await bg()) === rgb(theme.screens[look]), `${look}: screen colour ${await bg()}`);
    const layout = await page.evaluate(async () => {
      const { checkDesign } = await import('/src/hmi/layout.ts');
      const { getHmi } = await import('/src/hmi/hmiCatalog.ts');
      const d = (await import('/src/store/useHmiStore.ts')).useHmiStore.getState().design;
      const m = getHmi(d.hmiPartNumber);
      return checkDesign(d, m.widthPx, m.heightPx, { text: true }).filter((i) => i.severity === 'error' || /cut off/.test(i.message)).map((i) => i.message);
    });
    check(layout.length === 0, `${look}: layout check clean (${layout.join(' | ')})`);
    for (let i = 0; i < nScreens; i++) {
      await screenButtons(page).nth(i).click();
      await page.waitForTimeout(60);
      const design = await hmiState(page);
      const found = await page.evaluate((els) => {
        const svg = [...document.querySelectorAll('svg[aria-label^="HMI screen:"]')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const out = [];
        const texts = [];
        const byId = Object.fromEntries(els.map((e) => [e.id, e]));
        for (const g of svg.querySelectorAll('g[data-el]')) {
          const el = byId[g.getAttribute('data-el')];
          if (!el) continue;
          for (const tx of g.querySelectorAll('text')) {
            if (!tx.textContent.trim()) continue;
            const b = tx.getBBox();
            // Machine symbols label below their shape inside the machine frame; everything else stays in its element.
            const slack = el.kind === 'machine' ? 0 : 1.5;
            if (b.x < el.x - slack || b.y < el.y - slack || b.x + b.width > el.x + el.w + slack || b.y + b.height > el.y + el.h + slack) {
              out.push(`“${tx.textContent}” runs past its ${el.kind} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)} in ${el.x},${el.y} ${el.w}×${el.h})`);
            }
            if (/…$/.test(tx.textContent) && !['header', 'alarm-list', 'alarm-banner', 'machine'].includes(el.kind)) out.push(`“${tx.textContent}” is cut off in its ${el.kind}`);
            if (el.kind !== 'panel' && el.kind !== 'machine') texts.push({ id: el.id, t: tx.textContent, b });
          }
        }
        for (let a = 0; a < texts.length; a++) for (let c = a + 1; c < texts.length; c++) {
          const p = texts[a], q = texts[c];
          if (p.id === q.id) continue;
          if (p.b.x < q.b.x + q.b.width - 1 && q.b.x < p.b.x + p.b.width - 1 && p.b.y < q.b.y + q.b.height - 1 && q.b.y < p.b.y + p.b.height - 1) out.push(`“${p.t}” overlaps “${q.t}”`);
        }
        return out;
      }, design.screens.find((s) => s.name === design.screens[i].name).elements);
      const name = design.screens[i].name;
      check(found.length === 0, `${look} / ${name}: ${found.slice(0, 4).join('; ')}`);
      if (i === 0) await (await mainSvg(page)).screenshot({ path: path.join(OUT, `${String(theme.looks.indexOf(look) + 1).padStart(2, '0')}_${look}.png`) });
    }
    log(`${theme.labels[look]}: ${nScreens} screens checked`);
  }

  // 4. Exports use the chosen look: the PNGs are drawn on its screen colour, the PDF names it.
  const exported = async (look) => {
    await page.goto(BASE + '/hmi');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'HMI look' }).click();
    await page.locator(`[role="option"][data-look="${look}"]`).click();
    await page.goto(BASE + '/export');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Screen images (ZIP)', exact: true }).click()]);
    const zipPath = path.join(OUT, `${look}_${d.suggestedFilename()}`);
    await d.saveAs(zipPath);
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const first = Object.keys(zip.files).sort()[0];
    const png = await zip.file(first).async('nodebuffer');
    // Share of pixels in the look's screen colour and in its header colour.
    const share = await page.evaluate(async ({ b64, hexes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      return hexes.map((hex) => {
        const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        let n = 0;
        for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - want[0]) + Math.abs(px[i + 1] - want[1]) + Math.abs(px[i + 2] - want[2]) < 12) n++;
        return n / (px.length / 4);
      });
    }, { b64: png.toString('base64'), hexes: [theme.screens[look], theme.headers[look]] });
    check(share[0] > 0.03 && share[1] > 0.02, `${look}: exported PNG drawn in the look (screen colour ${(share[0] * 100).toFixed(0)}%, header ${(share[1] * 100).toFixed(0)}% of pixels)`);
    const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'HMI screens PDF', exact: true }).click()]);
    const pdfPath = path.join(OUT, `${look}_${pdf.suggestedFilename()}`);
    await pdf.saveAs(pdfPath);
    const pdfText = fs.readFileSync(pdfPath, 'latin1');
    check(pdfText.includes(`${theme.labels[look]} look`.replace(/[()]/g, (c) => `\\${c}`)) || pdfText.includes(`${theme.labels[look]} look`), `${look}: HMI PDF names the look`);
    log(`Export in ${theme.labels[look]}: ${first}, ${(share[0] * 100).toFixed(0)}% screen colour, ${(share[1] * 100).toFixed(0)}% header colour`);
  };
  await exported('proface');
  await exported('isa101');

  // 5. Back to "Match the panel", then a Weintek panel: the look follows the maker; a picked look survives a reload.
  await page.goto(BASE + '/hmi');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'HMI look' }).click();
  await page.locator('[role="option"][data-look="auto"]').click();
  check(!(await hmiState(page)).look, 'Match the panel clears the stored look');
  const weintek = await page.evaluate(async () => {
    const { catalogPanels } = await import('/src/hmi/panels.ts');
    const o = catalogPanels().find((x) => x.model && x.part.manufacturer === 'Weintek' && x.model.widthPx === 800 && x.model.heightPx === 480)
      ?? catalogPanels().find((x) => x.model && x.part.manufacturer === 'Weintek');
    const { useHmiStore } = await import('/src/store/useHmiStore.ts');
    const s = useHmiStore.getState();
    s.setHmiPartNumber(o.part.partNumber);
    s.setDesign({ ...s.design, hmiPartNumber: o.part.partNumber }, null);
    return o.part.partNumber;
  });
  await page.reload();
  await page.waitForTimeout(800);
  const label = await page.getByRole('button', { name: 'HMI look' }).innerText();
  check(/Weintek style \(panel\)/.test(label), `Weintek panel ${weintek} → Weintek look (${label})`);
  check((await bg()) === rgb(theme.screens.weintek), 'screen drawn in the Weintek look');
  await page.getByRole('button', { name: 'HMI look' }).click();
  check(/panel maker/.test(await page.locator('[role="option"][data-look="weintek"]').innerText()), 'Weintek marked as the panel maker in the list');
  await page.locator('[role="option"][data-look="omron"]').click();
  await page.reload();
  await page.waitForTimeout(800);
  check((await hmiState(page)).look === 'omron' && (await bg()) === rgb(theme.screens.omron), 'a picked look survives a reload (user free to switch)');

  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
  console.log('hmi-looks e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
