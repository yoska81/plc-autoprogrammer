// The Change report: a program is uploaded (synthetic Yaskawa fixture), reorganized and approved, then moved to
// Siemens with "Also make a change report" ticked: a PDF and a Word file come down with the Converted, Deleted and
// Changed sections and a behaviour-check line per change; the Program page offers the report afterwards too.
//   npx vite --port 5205 &  ;  BASE_URL=http://localhost:5205 node e2e/change-report.e2e.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { useAppModules } = require('./lib/appModule.cjs');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const BASE = process.env.BASE_URL || 'http://localhost:5205';
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  ✗', what); } else console.log('  ✓', what); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true })).newPage();
  await useAppModules(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.goto(BASE + '/import?tab=program');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('program-file').setInputFiles({ name: 'demo_mp.YMW7', mimeType: 'application/octet-stream', buffer: fs.readFileSync(path.join(__dirname, '../src/plc/import/__fixtures__/demo_mp.YMW7')) });
  await page.getByTestId('program-found').waitFor({ timeout: 60000 });
  await page.getByTestId('program-apply').click();
  await page.getByTestId('upgrade-simplify').waitFor({ timeout: 60000 });

  // Reorganize with its defaults, approved.
  await page.getByRole('link', { name: 'Simplify & explain this program' }).click();
  const tidy = page.getByTestId('tidy-up');
  await tidy.waitFor({ timeout: 30000 });
  check(await page.getByTestId('change-report').count() === 0, 'no "Change report" button before any change');
  await tidy.getByRole('button', { name: 'Reorganize program…' }).click();
  const panel = page.getByRole('group', { name: 'Reorganize' });
  await panel.waitFor({ timeout: 30000 });
  check(!(await panel.getByLabel(/Also make a change report/).isChecked()), '"Also make a change report" is off by default');
  await panel.getByRole('button', { name: 'Check and propose' }).click();
  const approve = page.getByRole('button', { name: 'Approve', exact: true });
  await approve.waitFor({ timeout: 120000 });
  await approve.click();
  await page.getByTestId('change-report').waitFor({ timeout: 10000 });
  check(/1 change\b/.test(await page.getByTestId('change-report').textContent()), 'after the approval the Program page offers the Change report (1 change)');
  check(downloads.length === 0, 'nothing downloaded when the box was not ticked');

  // Move to Siemens with the report ticked: the report comes down with the move.
  await page.goto(BASE + '/import?tab=program');
  await page.getByTestId('upgrade-remake-report').check();
  await page.getByTestId('upgrade-move-siemens-s7').click();
  for (let i = 0; i < 100 && downloads.length < 2; i++) await page.waitForTimeout(200);
  const names = downloads.map((d) => d.suggestedFilename()).sort();
  check(names.length === 2 && /_change_report\.docx$/.test(names[0]) && /_change_report\.pdf$/.test(names[1]), `a PDF and a Word file (${names.join(', ')})`);
  const docx = downloads.find((d) => d.suggestedFilename().endsWith('.docx'));
  if (docx) {
    const zip = await JSZip.loadAsync(fs.readFileSync(await docx.path()));
    const doc = (await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');
    for (const h of ['Behaviour check per change', 'Converted', 'Deleted', 'Changed']) check(doc.includes(`\n${h}\n`), `the report has "${h}"`);
    check(/Yaskawa .* → Siemens S7-1200 \/ S7-1500/.test(doc) && /\d+ of \d+ rungs convert/.test(doc), 'Converted: from Yaskawa to Siemens, how much converts');
    check(/Reorganize: equivalence check (passed|found differences|not run)/.test(doc) && /Move to another PLC: equivalence check not run/.test(doc), 'a check line per change');
    check(/Program from: demo_mp\.YMW7/.test(doc), 'the header names the uploaded file');
  }
  const pdf = downloads.find((d) => d.suggestedFilename().endsWith('.pdf'));
  if (pdf) check(fs.readFileSync(await pdf.path()).slice(0, 5).toString() === '%PDF-', 'the PDF is a PDF');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  if (fails.length) { console.error(`FAILED (${fails.length})`); process.exit(1); }
  console.log('change-report e2e passed');
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
