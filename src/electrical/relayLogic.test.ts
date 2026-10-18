/// <reference types="node" />
/**
 * Relay logic → NFPA 79 ladder: wire numbers per rung, terminals, branches, the wire list and the ladder sheets.
 * Run with:  npx tsx src/electrical/relayLogic.test.ts
 */
import assert from 'node:assert/strict';
import { relayLadder, relayPins } from './relayLogic';
import { buildModel, designWarnings, type DrawingContext } from './derive';
import { planDrawings } from './drawings/plan';
import { getPart } from './catalog';
import { DESIGN } from '../preview/sampleProject';
import type { RelayLogic } from './types';

// A start / stop seal-in through the overload, an on-delay timer and a drive run input.
const LOGIC: RelayLogic = {
  supply: '24VDC',
  rungs: [
    { id: 'C1', description: 'Pump 1 start / stop', path: [
      { t: 'contact', tag: 'PB1', nc: true, terms: '11-12', kind: 'pb' },
      { t: 'branch', paths: [[{ t: 'contact', tag: 'PB2', nc: false, terms: '13-14', kind: 'pb' }], [{ t: 'contact', tag: 'K1', nc: false, terms: '13-14', kind: 'relay' }]] },
      { t: 'contact', tag: 'OL1', nc: true, terms: '95-96', kind: 'ol' },
      { t: 'coil', tag: 'K1', kind: 'contactor' },
    ] },
    { id: 'C2', description: 'Start delay', path: [{ t: 'contact', tag: 'K1', nc: false, terms: '23-24', kind: 'relay' }, { t: 'coil', tag: 'CR11', kind: 'timer-on', preset: '2 s' }] },
    { id: 'C3', description: 'Drive run', path: [{ t: 'contact', tag: 'CR11', nc: false, terms: '15-18', kind: 'timer' }, { t: 'coil', tag: 'VFD1', kind: 'drive-input', terms: 'MI1' }] },
  ],
};

assert.deepEqual(relayPins({ t: 'contact', tag: 'K1', nc: false, terms: '13-14' }), ['13', '14']);
assert.deepEqual(relayPins({ t: 'contact', tag: 'K1', nc: true }), ['11', '12']);
assert.deepEqual(relayPins({ t: 'coil', tag: 'K1', kind: 'relay' }), ['A1', 'A2']);

const lad = relayLadder(LOGIC);
assert.deepEqual(lad.rails, ['24+', '0V']);
assert.deepEqual(lad.rungs.map((r) => r.rows), [2, 1, 1], 'the seal-in branch takes a second row');
const [r1, r2, r3] = lad.rungs;
// rung 1: 24+ | PB1 | 101 | (PB2 ∥ K1) | 101A | OL1 | 101B | K1 | 0V
assert.equal(r1.cols[0].kind === 'el' && r1.cols[0].e.wIn, '24+');
assert.equal(r1.cols[0].kind === 'el' && r1.cols[0].e.wOut, '101');
const br = r1.cols[1];
assert.ok(br.kind === 'branch' && br.wIn === '101' && br.wOut === '101A' && br.paths.every((p) => p[0].wIn === '101' && p[p.length - 1].wOut === '101A'), 'both paths of the branch share its nodes');
assert.equal(r1.cols[3].kind === 'el' && r1.cols[3].e.wOut, '0V');
assert.equal(r2.cols[1].kind === 'el' && r2.cols[1].e.wIn, '102');
assert.ok(r3.driveEnd, 'rung 3 ends at the drive input');
assert.equal(lad.coilRung.get('K1'), 1);
assert.equal(lad.coilRung.get('CR11'), 2);
assert.ok(!lad.coilRung.has('VFD1'), 'a drive input is not a coil');
// the wire list joins every terminal of a node: 101 = PB1:12, PB2:13, K1:13
const w101 = lad.wires.filter((w) => w.wire === '101').flatMap((w) => [w.from, w.to]);
for (const t of ['PB1:12', 'PB2:13', 'K1:13']) assert.ok(w101.includes(t), `101 joins ${t}: ${w101.join(', ')}`);
assert.ok(lad.wires.some((w) => w.wire === '24+' && w.from === 'TB1 24+'), 'the rail starts at TB1');
assert.ok(lad.wires.some((w) => w.wire === '103' && w.to === 'VFD1:MI1'), 'the drive input is wired');
assert.ok(!lad.wires.some((w) => w.from.startsWith('VFD1:') && w.wire === '0V'), 'no 0V to the drive input');
assert.deepEqual(relayLadder({ supply: '120VAC', rungs: LOGIC.rungs.slice(0, 1) }).rails, ['X1', 'X2']);

// ladder sheets and the wire list of a design that keeps relay logic
const ctx: DrawingContext = {
  projectName: 'Relay', getPart, plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  design: { ...DESIGN, inputs: { ...DESIGN.inputs, relayLogic: LOGIC } },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
};
const plan = planDrawings(ctx);
const sheets = plan.sheets.filter((s) => s.spec.kind === 'ladder');
assert.equal(sheets.length, 1);
assert.match(sheets[0].title, /RELAY CONTROL CIRCUIT 24VDC — RUNGS 1–3/);
const n = sheets[0].n;
assert.equal(plan.xref.get('coil:K1'), `${n}.01`);
assert.equal(plan.xref.get('coil:CR11'), `${n}.03`, 'rung 2 starts below rung 1\'s branch row');
assert.equal(plan.xref.get('rung:C3'), `${n}.04`);
assert.ok((plan.contacts.get('K1') ?? []).some((c) => c.term === '23-24' && c.line === `${n}.03`), 'K1 mirror lists its 23-24 contact');
for (const t of ['PB1', 'PB2', 'K1', 'OL1', 'CR11', 'VFD1']) assert.ok(plan.where.get(t)?.includes(n), `${t} drawn on the ladder sheet`);
const m = buildModel(ctx);
assert.ok(designWarnings(ctx).some((w) => /^Relay logic: .*CR11.*not in the design's parts/.test(w)), 'tags without a part are flagged');
assert.ok(!designWarnings(ctx).some((w) => /^Relay logic: .*\bK1\b/.test(w)), 'K1 is a part of the sample design');
assert.ok(m.wires.some((w) => w.wire === '101A' && w.color === 'BU'), 'ladder wires in the wire list');
// many rungs page without splitting a rung
const many: RelayLogic = { supply: '24VDC', rungs: Array.from({ length: 12 }, (_, i) => ({ ...LOGIC.rungs[0], id: `R${i}` })) };
const big = planDrawings({ ...ctx, design: { ...ctx.design, inputs: { ...ctx.design.inputs, relayLogic: many } } }).sheets.filter((s) => s.spec.kind === 'ladder');
assert.equal(big.length, 2, '12 two-row rungs on 14-row sheets: 7 + 5');
for (const s of big) {
  const sp = s.spec as Extract<typeof s.spec, { kind: 'ladder' }>;
  assert.ok(sp.rungs.every(({ r, idx }) => idx + r.rows - 1 <= 14), `${s.title}: rungs inside the sheet`);
}

console.log('relayLogic.test: ok');
