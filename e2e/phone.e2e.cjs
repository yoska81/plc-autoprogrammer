// Every page on a phone (390 x 844) with the example project: the page never scrolls sideways; inside a
// page only explicit horizontal scrollers (overflow-x-auto boxes around wide tables / tab strips, or
// anything marked data-scroll-x: drawings, canvases, the simulator's columns) may scroll sideways; page
// headers fit (nothing past their edge) and the page title gets a usable width (not squeezed into a
// narrow column beside the buttons); no button or field is cut off at the right edge (outside a horizontal
// scroller). Workspaces that show one pane at a time on a phone (Labels, PLC program) are checked pane by pane.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/phone.e2e.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-phone');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

const ROUTES = ['/spec', '/project', '/equipment', '/io', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine', '/electrical?tab=layout',
  '/electrical?tab=picture', '/electrical?tab=machining', '/electrical?tab=labels', '/electrical?tab=improve', '/electrical?tab=lists', '/sourcing', '/engineer',
  '/hmi', '/program', '/simulate', '/review', '/export', '/settings', '/plc', '/import', '/import?tab=program', '/import?tab=photos', '/new', '/online',
  '/commissioning', '/redlines'];

/** In the page: what scrolls sideways that should not, and how the page header fits. */
function audit() {
  const W = window.innerWidth;
  const out = [];
  const docOver = document.scrollingElement.scrollWidth - W;
  if (docOver > 0) out.push(`the page scrolls sideways (+${docOver}px)`);
  const intentional = (el) => el.closest('[data-scroll-x]') || /\boverflow-x-(auto|scroll)\b/.test(String(el.className));
  for (const el of document.querySelectorAll('main *')) {
    if (!el.clientWidth || el.scrollWidth <= el.clientWidth + 1) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowX) || intentional(el)) continue;
    out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} scrolls sideways (+${el.scrollWidth - el.clientWidth}px)`);
  }
  // Controls cut off: a button or field whose box ends past the screen, outside a horizontal scroller.
  const inScroller = (el) => {
    for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) if (/(auto|scroll)/.test(getComputedStyle(x).overflowX) && intentional(x)) return true;
    return false;
  };
  const cut = [...document.querySelectorAll('main button, main input, main select, main textarea, main a[href]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > W + 1 && !inScroller(el);
  });
  if (cut.length) out.push(`${cut.length} control(s) cut off at the right edge: ${cut.slice(0, 3).map((el) => `“${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 22)}”`).join(', ')}`);
  const hdr = document.querySelector('main header');
  if (hdr) {
    if (hdr.scrollWidth > hdr.clientWidth + 1) out.push(`the header runs past the screen (${hdr.scrollWidth} > ${hdr.clientWidth})`);
    const title = hdr.querySelector('h1, h2');
    const tw = title ? title.getBoundingClientRect().width : W;
    if (tw < 160) out.push(`the page title is squeezed to ${Math.round(tw)}px`);
    // Buttons squeezed into a narrow column wrap their label over three lines or more.
    for (const b of hdr.querySelectorAll('button, a')) {
      const r = b.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(b).lineHeight) || 20;
      if (r.width && r.height > lh * 2.6 + 16) out.push(`“${b.textContent.trim().slice(0, 24)}” is squeezed (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');
  let bad = 0;
  for (const r of ROUTES) {
    await page.goto(BASE + r);
    await page.waitForTimeout(1000);
    const found = await page.evaluate(audit);
    // Workspaces that show one pane at a time on a phone: every pane is checked.
    const tabs = page.locator('[data-phone-tabs] [role="tab"]');
    const names = await tabs.allInnerTexts();
    for (let i = 0; i < names.length; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
      for (const f of await page.evaluate(audit)) found.push(`[${names[i]}] ${f}`);
      await page.screenshot({ path: path.join(OUT, `${r.replace(/\W+/g, '_')}_${names[i].replace(/\W+/g, '_')}.png`) });
    }
    if (names.length) {
      log(`${r}: phone panes ${names.join(' / ')}`);
      // Each tab names the pane it shows, the shown pane is a tab panel, and the arrow keys move between tabs.
      const wiring = await page.evaluate(() => [...document.querySelectorAll('[data-phone-tabs] [role="tab"]')].map((t) => {
        const p = document.getElementById(t.getAttribute('aria-controls') || '');
        return { name: t.textContent.trim(), selected: t.getAttribute('aria-selected') === 'true', panel: !!p && p.getAttribute('role') === 'tabpanel' && p.getAttribute('aria-labelledby') === t.id };
      }));
      const shown = wiring.find((w) => w.selected);
      check(shown && shown.panel, `${r}: the “${shown?.name}” tab does not point at its tab panel`);
      await tabs.first().click();
      await page.keyboard.press('ArrowRight');
      const after = await page.evaluate(() => ({ sel: document.querySelector('[data-phone-tabs] [aria-selected="true"]')?.textContent.trim(), focus: document.activeElement?.textContent.trim() }));
      check(after.sel === names[1] && after.focus === names[1], `${r}: ArrowRight did not move to “${names[1]}” (${JSON.stringify(after)})`);
      if (r === '/program') {
        await tabs.filter({ hasText: 'Cross-ref' }).click();
        const xb = page.getByRole('button', { name: /Cross reference/ });
        const on = await xb.evaluate((b) => b.getAttribute('aria-pressed') === 'true' && /\bbg-brand-600\b/.test(b.className));
        check(on, '/program: on the Cross-ref tab the Cross reference button is not shown pressed');
      }
    }
    if (found.length) bad++;
    check(found.length === 0, `${r}: ${[...new Set(found)].slice(0, 4).join('; ')}`);
    await page.screenshot({ path: path.join(OUT, `${r.replace(/\W+/g, '_') || 'root'}.png`) });
  }
  log(`${ROUTES.length} pages at 390 px, ${bad} with problems`);
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('phone e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
