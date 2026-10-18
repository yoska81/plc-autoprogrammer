// Drawing text overlap check: every sheet of every variant rendered in the browser (dev server), text
// boxes (sheet mm, trimmed to the glyphs) against other text and against every stroked line.
// FAIL: text on text >= 0.5 mm², or a line running >= 1 mm through a text.
// Usage: npm run dev -- --port 5204 &   then   node tools/check_overlap.cjs [variant ...] [--json out.json]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:5204';
const ALL = ['us480', 'big', 'analog', 'rules-eu', 'rules-sealing', 'rules-sealing-long', 'ca600', 'us120', 'rules', 'rules-big', 'rules-stress', 'rules-floor', 'rules-unitronics', 'rules-unistream', 'rules-nopanel'];
const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const variants = args.filter((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1));

(async () => {
  const browser = await chromium.launch();
  const all = {};
  let fails = 0;
  for (const v of variants.length ? variants : ALL) {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '/');
    await page.waitForLoadState('networkidle');
    const sheets = await page.evaluate(async (variant) => (await import('/tools/harness/overlap.ts')).measureOverlaps(variant), v);
    all[v] = sheets;
    for (const s of sheets) {
      const n = s.tt.length + s.tl.length;
      if (!n) continue;
      fails += n;
      console.log(`FAIL ${v} sheet ${s.n} ${s.title}: ${s.tt.length} text/text, ${s.tl.length} text/line`);
      for (const h of s.tt.slice(0, 4)) console.log(`     text "${h.a.slice(0, 40)}" / "${h.b.slice(0, 40)}" ${h.area} mm² at ${h.at}`);
      for (const h of s.tl.slice(0, 4)) console.log(`     line through "${h.text.slice(0, 50)}" ${h.len} mm at ${h.at}`);
    }
    const sum = (k) => sheets.reduce((a, s) => a + s[k].length, 0);
    console.log(`${v}: ${sheets.length} sheets, ${sheets.reduce((a, s) => a + s.texts, 0)} texts, ${sum('tt')} text/text, ${sum('tl')} text/line`);
    if (errors.length) console.log(`${v}: browser errors: ${errors.slice(0, 3).join(' | ')}`);
    await page.close();
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  console.log(`OVERLAP: ${fails ? fails + ' FAIL' : '0 FAIL'}`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
