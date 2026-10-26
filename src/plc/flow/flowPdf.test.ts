/// <reference types="node" />
/**
 * The program flow PDF: made for the example project (every function's diagram and ladder, the I/O list, the
 * alarms, what changed) and for a big imported program; a tall diagram split over pages between boxes, never
 * through one. FLOW_PDF_OUT=dir also writes the PDFs there to look at.
 * Run with:  npx tsx src/plc/flow/flowPdf.test.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { importProgramFiles } from '../import';
import { plcopen } from '../import/__fixtures__/bigPrograms';
import { flowMap } from './flowModel';
import { bands, buildFlowPdf } from './flowPdf';
import { flowChanges } from './flowEdit';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
const out = process.env.FLOW_PDF_OUT;

seedSampleProject();
const p = collectProject();
const nameOf = (a: string) => p.labels.get(a) ?? p.ladder.tags.find((t) => t.address === a)?.nickname ?? a;
const map = flowMap(p.ladder, nameOf);
const ioOf = (a: string) => (/^X\d+$/.test(a) ? { dir: 'in' as const, name: nameOf(a) } : /^Y\d+$/.test(a) ? { dir: 'out' as const, name: nameOf(a) } : null);

// bands: cover the diagram, and no box is cut where a page ends
for (const d of [...map.diagrams, ...flowMap(p.ladder, nameOf, { io: ioOf, notes: true }).diagrams]) {
  const bs = bands(d, 600);
  assert.equal(bs[0][0], 0);
  assert.equal(bs[bs.length - 1][1], d.h);
  for (let i = 1; i < bs.length; i++) assert.equal(bs[i][0], bs[i - 1][1]);
  for (const [, y1] of bs.slice(0, -1)) for (const n of d.nodes) assert.ok(!(n.y < y1 && n.y + n.h > y1) || n.h > 580, `${d.name}: ${n.title} not cut at ${y1}`);
}

const pdfText = async (b: Blob) => Buffer.from(await b.arrayBuffer()).toString('latin1');
const changed = { ...p.ladder, rungs: p.ladder.rungs.map((r, i) => (i === 0 ? { ...r, comment: `${r.comment} (edited)` } : r)) };
// the boxes with their real inputs / outputs and their comments beside them (as the page shows them)
const blob = await buildFlowPdf({
  projectName: 'Example', plcName: 'AutomationDirect CLICK', program: changed, map: flowMap(changed, nameOf, { io: ioOf, notes: true }), nameOf,
  io: [{ address: 'X001', description: 'E-stop OK', kind: 'Input' }, { address: 'Y001', description: 'Conveyor motor', kind: 'Output' }],
  changes: flowChanges(p.ladder, changed, nameOf), date: '2026-10-24', compress: false,
});
const raw = await pdfText(blob);
const pages = (raw.match(/\/Type \/Page\b/g) ?? []).length;
assert.ok(raw.startsWith('%PDF-'), 'a PDF');
assert.ok(pages >= map.diagrams.length + 2, `a page or more per function (${pages} pages, ${map.diagrams.length} functions)`);
for (const s of ['How to read the diagrams', 'Machine map', 'I/O list', 'Alarms and faults', 'What was changed', 'The ladder of', 'IN / OUT rows', '(OUT Y003 ', '(// Main air dump valve']) assert.ok(raw.includes(s), `has "${s}"`);
if (out) writeFileSync(join(out, 'flow-example.pdf'), Buffer.from(await blob.arrayBuffer()));

// one function only: its diagram and ladder, still the map and the lists
const one = await pdfText(await buildFlowPdf({ projectName: 'Example', plcName: 'CLICK', program: p.ladder, map, nameOf, io: [], only: [map.diagrams[1].id], compress: false }));
assert.ok(one.includes(`The ladder of ${map.diagrams[1].name}`) && !one.includes(`The ladder of ${map.diagrams[0].name}`), 'only the chosen function');
assert.ok((one.match(/\/Type \/Page\b/g) ?? []).length < pages, 'fewer pages');

// a big imported program: made in reasonable time
const big = importProgramFiles([{ name: 'big.xml', text: plcopen(20, 40) }]).program.program;
const t0 = performance.now();
const bb = await buildFlowPdf({ projectName: 'Big', plcName: 'CODESYS', program: big, map: flowMap(big, (a) => a), nameOf: (a) => a, io: [] });
const ms = performance.now() - t0;
assert.ok(ms < 20000, `${big.rungs.length} rungs in ${ms.toFixed(0)} ms`);
assert.ok(bb.size < 3 * 1024 * 1024, `compressed: ${(bb.size / 1024).toFixed(0)} KB`);
if (out) writeFileSync(join(out, 'flow-big.pdf'), Buffer.from(await bb.arrayBuffer()));

console.log(`flowPdf.test: all passed (example ${pages} pages; big ${big.rungs.length} rungs, ${(bb.size / 1024).toFixed(0)} KB in ${ms.toFixed(0)} ms)`);
