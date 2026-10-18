/// <reference types="node" />
/**
 * Certification pack and shop build-time estimate. Run with:  npx tsx src/deliverables/certPack.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from './collect';
import { buildCertPackPdf, certPack, TO_CONFIRM } from './certPack';
import { buildEstimate, buildTimeSummary, defaultRates, gaugeKey, sizeMm2 } from './buildTime';
import { applyRegion } from '../standards/applyRegion';
import { useElectricalStore } from '../store/useElectricalStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

console.log('certification pack');

await test('US example: UL 508A pack from the design, weakest link named', () => {
  seedSampleProject();
  const c = certPack(collectProject());
  assert.equal(c.kind, 'ul508a');
  assert.match(c.title, /UL 508A/);
  const sccr = c.plate.find((i) => i.label.startsWith('Short-circuit'))!;
  assert.match(sccr.value, /^5 kA/);
  assert.match(c.weakest, /K1 .*OL1 .*5 kA/);
  assert.ok(c.plate.some((i) => i.label.startsWith('Largest motor') && /M1/.test(i.value)));
  assert.ok(c.plate.some((i) => /Enclosure type/.test(i.label) && /NEMA/.test(i.value)));
  assert.ok(c.safety.length >= 1 && c.safety.every((s) => s.plr.includes(TO_CONFIRM)));
  assert.equal(c.components.find((x) => x.tag === 'CB1')?.ul, 'UL 489');
  assert.ok(['Wire sizing', 'Overcurrent protection', 'Spacings'].every((t) => c.statements.some((s) => s.topic === t)));
  assert.equal(c.declaration, null);
  // Serial number is never invented.
  assert.ok(c.plate.find((i) => i.label === 'Serial number')!.confirm);
  assert.ok(c.toConfirm.some((t) => t.includes('Serial number')));
});

await test('a motor branch without a breaker is flagged', () => {
  seedSampleProject();
  const el = useElectricalStore.getState();
  const d = structuredClone(el.design!);
  d.components = d.components.filter((x) => x.tag !== 'CB1');
  useElectricalStore.setState({ design: d });
  const c = certPack(collectProject());
  const oc = c.statements.find((s) => s.topic === 'Overcurrent protection')!;
  assert.equal(oc.status, 'Check');
  assert.match(oc.text, /M1 motor branch — NONE/);
});

await test('Canada: CSA wording', () => {
  seedSampleProject();
  applyRegion('Canada');
  const c = certPack(collectProject());
  assert.match(c.title, /CSA/);
  assert.ok(c.plate.some((i) => /cUL \/ CSA/.test(i.label)));
});

await test('IEC project: CE technical file with declaration, risk summary input and IP rating', async () => {
  seedSampleProject();
  applyRegion('EU');
  const p = collectProject();
  const c = certPack(p);
  assert.equal(c.kind, 'ce');
  assert.match(c.title, /CE technical file/);
  assert.ok(c.declaration && c.declaration.some((i) => i.label === 'Directives' && /2006\/42\/EC/.test(i.value)));
  assert.ok(c.declaration!.find((i) => i.label.startsWith('Signature'))!.confirm);
  assert.ok(c.plate.some((i) => /Icc/.test(i.label) && i.confirm));
  assert.ok(c.plate.some((i) => /IP/.test(i.label)));
  assert.ok(c.toConfirm.some((t) => /Risk assessment/.test(t)));
  const pdf = await buildCertPackPdf(p);
  assert.ok(pdf.size > 5000);
});

await test('no electrical design: one clear to-confirm item, PDF still builds', async () => {
  seedSampleProject();
  useElectricalStore.setState({ design: null });
  const p = collectProject();
  assert.match(certPack(p).toConfirm[0], /no electrical design/);
  assert.ok((await buildCertPackPdf(p)).size > 1000);
  assert.equal(buildEstimate(p), null);
});

await test('a part the catalog does not know is listed to confirm', () => {
  seedSampleProject();
  const el = useElectricalStore.getState();
  const d = structuredClone(el.design!);
  d.components = d.components.map((x) => (x.tag === 'PLC' ? { ...x, partNumber: 'XYZ-NOT-IN-CATALOG-1' } : x));
  useElectricalStore.setState({ design: d });
  const c = certPack(collectProject());
  assert.ok(c.toConfirm.some((t) => t.startsWith('Not in the parts catalog') && t.includes('XYZ-NOT-IN-CATALOG-1')), c.toConfirm.join(' | '));
  assert.equal(c.components.find((x) => x.partNumber === 'XYZ-NOT-IN-CATALOG-1')?.manufacturer, TO_CONFIRM);
});

console.log('shop build time');

await test('wire sizes map to the right termination rate', () => {
  assert.equal(gaugeKey('18 AWG'), 'term18');
  assert.equal(gaugeKey('16 AWG'), 'term14');
  assert.equal(gaugeKey('14 AWG'), 'term14');
  assert.equal(gaugeKey('12 AWG'), 'term10');
  assert.equal(gaugeKey('6 AWG'), 'term6');
  assert.equal(gaugeKey('2/0 AWG'), 'term4');
  assert.equal(gaugeKey('2.5 mm²'), 'term14');
  assert.equal(gaugeKey('0.75 mm²'), 'term18');
  assert.equal(gaugeKey('Cat6'), null);
  assert.ok(Math.abs(sizeMm2('14 AWG')! - 2.08) < 0.02);
});

await test('example: every task has hours, quantities come from the design', () => {
  seedSampleProject();
  const e = buildEstimate(collectProject())!;
  for (const t of e.byTask) assert.ok(t.hours > 0, `${t.task} has no hours`);
  const q = (k: string) => e.lines.find((l) => l.key === k)!.qty;
  assert.ok(q('hole') > 0 && q('cutout') > 0);
  assert.ok(q('term18') > 0 && q('term14') > 0 && q('term18') % 2 === 0, 'two ends per conductor');
  assert.equal(q('fatMotor'), 1);
  assert.equal(q('cable'), 8, 'seven field cables + the supply');
  assert.ok(Math.abs(e.totalHours - e.lines.reduce((s, l) => s + l.hours, 0)) < 1e-9);
  assert.equal(e.cost, 0);
  assert.doesNotMatch(buildTimeSummary(e), /labour/);
});

await test('shop rates change the hours and the cost', () => {
  seedSampleProject();
  const p = collectProject();
  const base = buildEstimate(p)!;
  const r = { ...defaultRates(), term18: 6 };
  const e = buildEstimate(p, r, 100)!;
  const n = base.lines.find((l) => l.key === 'term18')!.qty;
  assert.ok(Math.abs(e.totalHours - base.totalHours - (n * 3) / 60) < 1e-9);
  assert.ok(Math.abs(e.cost - e.totalHours * 100) < 1e-9);
  assert.match(buildTimeSummary(e), /labour \$/);
  // Bad input falls back to the default rate.
  assert.ok(Math.abs(buildEstimate(p, { hole: -1, cutout: NaN })!.totalHours - base.totalHours) < 1e-9);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
