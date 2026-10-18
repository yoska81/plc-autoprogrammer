// Project data page, "Pieces of your work" / "Recover saved work": long rows never push the page sideways
// (390 px phone and 1366 px laptop), long texts are clamped to two lines (full text on hover / click),
// the Copy and "Start a new project from this" buttons sit in one aligned right-hand column on every
// row, pieces are grouped by project and older program versions fold away.
//   npm run dev -- --port 5203 &  ;  BASE_URL=http://localhost:5203 node e2e/recover-list.e2e.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5203';
const OUT = path.join(__dirname, 'out-recover-list');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } };

const LONG = 'Make the pusher wait for the part to settle on the conveyor for at least half a second before it extends, and if the photo-eye is blocked for longer than five seconds raise a jam alarm that stops the conveyor and asks the operator to clear the jam and press Reset; also count rejected parts separately from good ones';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.goto(BASE + '/spec');
  // The example project, plus a backup holding long AI requests, long program notes, a long machine
  // description and eight near-duplicate program versions.
  await page.evaluate(async (LONG) => {
    const m = await import('/src/preview/sampleProject.ts');
    localStorage.clear();
    m.seedSampleProject?.();
    const ladder = JSON.parse(JSON.stringify(m.LADDER));
    ladder.rungs[0].comment = `${ladder.rungs[0].comment ?? ''} (edited)`;
    // Near-duplicates: the same program with one rung comment changed per version.
    const versions = Array.from({ length: 8 }, (_, i) => {
      const program = JSON.parse(JSON.stringify(ladder));
      program.rungs[0].comment = `${program.rungs[0].comment} v${i}`;
      return { id: `v${i}`, label: i % 2 ? 'Before new generation' : 'Before AI fix', at: new Date(Date.UTC(2026, 9, 10 + i, 9, 30)).toISOString(), program };
    });
    const chat = Array.from({ length: 5 }, (_, i) => ({ role: 'user', text: `${i + 1}. ${LONG}`, at: new Date(Date.UTC(2026, 9, 17, 8, i)).toISOString() }));
    const data = {
      program: { ladder, versions, chat, userPrompt: `Notes: ${LONG} ${LONG}`, projectName: 'Conveyor cell with a very long project name that keeps going and going' },
      spec: { sections: { overview: `${LONG}. ${LONG}.` } },
    };
    localStorage.setItem('plc-backup:2026-10-17T09:00:00.000Z', JSON.stringify({ data }));
  }, LONG);
  await page.goto(BASE + '/spec');
  await page.locator('select[aria-label="Open project"]').selectOption('p_example');

  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + '/project');
    await page.locator('#recover').waitFor();
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const recover = document.querySelector('#recover');
      const rr = recover.getBoundingClientRect();
      // Every element that scrolls sideways (or is wider than the window) on the page.
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const st = getComputedStyle(el);
        return (/(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1) && el.closest('#recover, main');
      }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} ${el.scrollWidth}>${el.clientWidth}`);
      const rows = [...recover.querySelectorAll('[data-piece], [data-saved-work]')];
      const pastRight = rows.filter((r) => r.getBoundingClientRect().right > rr.right + 1 || r.scrollWidth > r.clientWidth + 1).length;
      const btn = (re) => [...recover.querySelectorAll('[data-piece] button')].filter((b) => re.test(b.textContent)).map((b) => b.getBoundingClientRect());
      const starts = btn(/^Start a new project from this$/).filter((r) => r.width > 0);
      const copies = btn(/^Copy$/).filter((r) => r.width > 0);
      // Every clamped text (titles, previews, saved-work descriptions) shows at most two lines.
      const titles = [...recover.querySelectorAll('.line-clamp-2')].filter((s) => s.getBoundingClientRect().width > 0)
        .map((s) => s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight));
      const older = [...recover.querySelectorAll('details summary')].map((s) => s.textContent);
      return {
        docScroll: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        wide, pastRight, rows: rows.length,
        startRights: starts.map((r) => Math.round(r.right)), copyLefts: copies.map((r) => Math.round(r.left)),
        maxTitleLines: Math.max(0, ...titles), older,
        groups: recover.querySelectorAll('[data-piece-group]').length,
      };
    });
    log(`${width}px: ${m.rows} rows in ${m.groups} groups; page overflow ${m.docScroll}px; folded: ${m.older.join(', ') || 'none'}; text lines ≤ ${m.maxTitleLines.toFixed(1)}`);
    check(m.docScroll <= 0, `${width}px: no horizontal page scroll (${m.docScroll}px too wide)`);
    check(m.wide.length === 0, `${width}px: nothing scrolls sideways: ${m.wide.slice(0, 3).join('; ')}`);
    check(m.pastRight === 0, `${width}px: ${m.pastRight} row(s) run past the list`);
    check(m.maxTitleLines <= 2.05, `${width}px: long texts clamped to 2 lines (${m.maxTitleLines.toFixed(2)})`);
    check(m.groups >= 2, `${width}px: grouped by project (${m.groups} groups)`);
    check(m.older.some((t) => /^6 older program versions$/.test(t)), `${width}px: older program versions folded (${m.older.join(', ')})`);
    if (width >= 640) {
      const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
      check(m.startRights.length >= 3 && spread(m.startRights) <= 1, `${width}px: "Start a new project" buttons aligned (${[...new Set(m.startRights)].join(', ')})`);
      check(spread(m.copyLefts) <= 1, `${width}px: Copy buttons aligned (${[...new Set(m.copyLefts)].join(', ')})`);
    }
    await page.locator('#recover').screenshot({ path: path.join(OUT, `recover_${width}.png`) });
  }

  // The full text is one click away; the folded versions open.
  await page.setViewportSize({ width: 1366, height: 900 });
  const first = page.locator('[data-piece] button[aria-expanded]').filter({ hasText: /request\(s\) to the AI/ }).first();
  await first.click();
  check(/half a second/.test(await page.locator('#recover pre').first().innerText()), 'click shows the full text');
  await page.locator('#recover details summary').first().click();
  check(await page.locator('#recover details[open] [data-piece]').count() === 6, 'the older versions open');

  log('Page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) fails.push(`${errors.length} page/console error(s)`);
  if (fails.length) { console.error(`FAILED (${fails.length}):\n  ${fails.join('\n  ')}`); process.exit(1); }
  console.log('recover-list e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
