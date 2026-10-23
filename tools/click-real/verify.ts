/**
 * The real-CLICK test's proof: CLICK's own printout of the ladder (a PDF printed from CLICK on the build server)
 * against the example project, rung by rung, with the app's check (clickVerify.compareRungs: each rung's addresses
 * where they belong, in order). Passes when every rung the app enters is there and nothing extra is.
 *   npx tsx tools/click-real/verify.ts <printout.pdf> <plans.json>
 */
import fs from 'node:fs';
import { seedSampleProject } from '../../src/preview/sampleProject';
import { collectProject } from '../../src/deliverables/collect';
import { compareRungs } from '../../src/plc/click/clickVerify';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const [pdfFile, plansFile] = process.argv.slice(2);
const plans = JSON.parse(fs.readFileSync(plansFile, 'utf8')) as { leftForYouRungs: number[] };
seedSampleProject();
const p = collectProject();

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfFile)) }).promise;
const pages: string[] = [];
for (let n = 1; n <= doc.numPages; n++) {
  const tc = await (await doc.getPage(n)).getTextContent();
  pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
}
// only the rungs the app enters (the ones left for the user are not in CLICK; leaving them in would let a rung's
// address pair with a neighbour's), numbered back as the project numbers them
const yours = new Set(plans.leftForYouRungs);
const kept = p.ladder.rungs.map((_, i) => i + 1).filter((n) => !yours.has(n));
const r = compareRungs({ ...p.ladder, rungs: p.ladder.rungs.filter((_, i) => !yours.has(i + 1)) }, pages.join('\n'));
console.log(`CLICK's printout: ${doc.numPages} pages; ${r.ok} of the ${r.rungs} rungs the app enters as in the project (left for the user: rungs ${[...yours].join(', ') || 'none'})`);
for (const d of r.differences) console.log(`  rung ${kept[d.rung - 1]}: not found ${d.missing.join(', ')}`);
if (r.extra.length) console.log(`  in the printout but in no rung of the project: ${r.extra.join(', ')}`);
if (r.differences.length || r.extra.length) { console.log('VERIFY FAILED'); process.exit(1); }
console.log(`VERIFY PASSED: all ${r.rungs} rungs the app enters are in CLICK as in the project`);
