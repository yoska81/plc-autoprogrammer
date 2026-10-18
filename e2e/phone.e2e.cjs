// Every page on a phone (390 x 844) with the example project: the page never scrolls sideways; inside a
// page only explicit horizontal scrollers (overflow-x-auto boxes around wide tables / tab strips, or
// anything marked data-scroll-x: drawings, canvases, the simulator's columns) may scroll sideways; page
// headers fit (nothing past their edge) and the page title gets a usable width (not squeezed into a
// narrow column beside the buttons).
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
    if (found.length) bad++;
    check(found.length === 0, `${r}: ${found.slice(0, 4).join('; ')}`);
    await page.screenshot({ path: path.join(OUT, `${r.replace(/\W+/g, '_') || 'root'}.png`) });
  }
  log(`${ROUTES.length} pages at 390 px, ${bad} with problems`);
  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('phone e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
