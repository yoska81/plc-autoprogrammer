// Page sweep: every page at 1366x768 and 1920x1080, with an empty project and with the example project.
// Fails on console/page errors, horizontal page overflow, controls pushed off-screen and unreadable text
// (contrast below 3:1, or light text on the lime brand colour).
//
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/sweep.e2e.cjs
// Screenshots land in e2e/out-sweep/.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname + '/out-sweep/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const HASH = process.env.HASH === '1'; // preview build (hash routing, example project seeded)
const log = (...a) => console.log('•', ...a);

const ROUTES = ['/spec', '/project', '/equipment', '/io', '/electrical?tab=design', '/electrical?tab=cabinet', '/electrical?tab=machine',
  '/electrical?tab=picture', '/electrical?tab=machining', '/electrical?tab=labels', '/hmi', '/program', '/simulate', '/review', '/export', '/settings', '/plc', '/import', '/new'];
const VIEWPORTS = [[1366, 768], [1920, 1080]];

/** Runs in the page: layout and readability problems. */
function audit() {
  const out = [];
  const W = window.innerWidth;
  const doc = document.scrollingElement;
  if (doc.scrollWidth > W + 1) out.push(`page scrolls sideways (${doc.scrollWidth} > ${W})`);
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null; // gradients/images: skip
      const c = parse(s.backgroundColor);
      if ((c[3] ?? 1) > 0.5) return c;
    }
    return [255, 255, 255];
  };
  const isLime = ([r, g, b]) => g > 190 && r > 150 && b < 140 && g > b + 80;
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || !el.childNodes.length) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) < 0.6) continue;
    if (el.closest('[disabled], .opacity-40, .opacity-50, .opacity-60')) continue; // disabled controls are dim on purpose
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (!bg) continue;
    const cr = ratio(fg, bg);
    const key = `${text.slice(0, 30)}|${s.color}|${bg}`;
    if (seen.has(key)) continue;
    if (isLime(bg) && lum(fg) > 0.5) { seen.add(key); out.push(`light text on lime: "${text.slice(0, 40)}" (${s.color})`); }
    else if (cr < 3 && !(el.tagName === 'OPTION')) { seen.add(key); out.push(`low contrast ${cr.toFixed(2)}: "${text.slice(0, 40)}" ${s.color} on rgb(${bg.slice(0, 3)})`); }
  }
  for (const el of document.querySelectorAll('button, a, input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // Only things the page itself can't scroll to: past the right edge of a non-scrolling ancestor.
    if (r.left > W - 2 || r.right > W + 2) {
      let scrollable = false;
      for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth) { scrollable = true; break; } }
      if (!scrollable) out.push(`control off-screen: ${el.tagName} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').slice(0, 30)}" right=${Math.round(r.right)}`);
    }
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const scenario of HASH ? ['example'] : ['empty', 'example']) {
    for (const [w, h] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
      page.on('dialog', (d) => d.dismiss());
      await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
      await page.goto(BASE);
      if (!HASH) {
        await page.evaluate(() => localStorage.clear());
        if (scenario === 'example') {
          // The dev build has no example project: load the preview seed through the module graph.
          await page.goto(BASE + '/spec');
          await page.evaluate(async () => { const m = await import('/src/preview/sampleProject.ts'); localStorage.clear(); m.seedSampleProject?.(); });
          // The example is its own project: open it.
          await page.goto(BASE + '/spec');
          await page.locator('select[aria-label="Open project"]').selectOption('p_example');
          if ((await page.locator('select[aria-label="Open project"]').inputValue()) !== 'p_example') throw new Error('example project not opened');
        }
      }
      for (const route of ROUTES) {
        const url = HASH ? `${BASE}/#${route}` : BASE + route;
        await page.goto(url);
        if (HASH) await page.reload();
        await page.waitForTimeout(route.includes('electrical') || route === '/hmi' || route === '/simulate' ? 1500 : 600);
        const name = `${scenario}_${w}_${route.replace(/\W+/g, '_').replace(/^_|_$/g, '')}`;
        await page.screenshot({ path: `${OUT}${name}.png` });
        const found = await page.evaluate(audit);
        for (const e of errors.splice(0)) found.push('error: ' + e.slice(0, 200));
        if (found.length) { problems.push([name, found]); log(name, '\n   - ' + found.slice(0, 12).join('\n   - ')); }
      }
      await ctx.close();
    }
  }
  await browser.close();
  log(`${problems.length} page(s) with problems`);
  if (problems.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
