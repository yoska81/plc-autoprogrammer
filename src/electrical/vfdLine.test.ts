/// <reference types="node" />
/**
 * VFD with a line contactor (safety stop by contactor): the contactor is wired between the branch
 * protection and the drive, and its coil hangs on the safety-switched supply when no PLC output drives it.
 * Run with:  npx tsx src/electrical/vfdLine.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from './catalog';
import { buildModel, type DrawingContext } from './derive';
import { planDrawings } from './drawings/plan';
import type { ElectricalDesign } from './types';

const ctxOf = (design: ElectricalDesign): DrawingContext => ({
  projectName: 'test', design, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});

// M1 on a drive: CB1 -> K1 (line contactor) -> VFD1 -> M1; the PLC output runs the drive, not K1
const vfd = (k1OnPlc: boolean): ElectricalDesign => ({
  ...DESIGN,
  inputs: { ...DESIGN.inputs, motors: [{ ...DESIGN.inputs.motors[0], starter: 'vfd' }] },
  components: [...DESIGN.components.filter((c) => c.tag !== 'OL1'), { tag: 'VFD1', partNumber: 'GS23-21P0', quantity: 1, function: 'Conveyor drive', motorTag: 'M1' }],
  ioWiring: DESIGN.ioWiring.map((w) => (w.deviceTag === 'K1' && !k1OnPlc ? { ...w, deviceTag: 'VFD1', deviceType: 'vfd-input' as const, description: 'Conveyor drive run' } : w)),
});

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };
console.log('VFD line contactor');

ok('power path: protection -> K1 -> VFD1 -> motor', () => {
  const m = buildModel(ctxOf(vfd(false)));
  const w = (fromTo: RegExp) => m.wires.filter((x) => fromTo.test(`${x.from}>${x.to}`));
  assert.equal(w(/^CB1:T\d>K1:L\d$/).length, 3, 'CB1 to K1');
  assert.equal(w(/^K1:T\d>VFD1:L\d$/).length, 3, 'K1 to VFD1');
  assert.equal(w(/^CB1:T\d>VFD1:L\d$/).length, 0, 'not CB1 straight to the drive');
  assert.equal(w(/^VFD1:T\d>/).length, 3, 'drive to motor terminals');
});

ok('coil on the safety-switched supply, dropped by the safety relay; K1 in the EDM loop', () => {
  const m = buildModel(ctxOf(vfd(false)));
  assert.ok(m.wires.some((x) => x.to === 'K1:A1' && x.wire === '24+S'), 'K1:A1 from 24+S');
  assert.ok(m.wires.some((x) => x.from === 'K1:A2' && x.wire === '0V'));
  assert.ok(m.safety.edm.includes('K1'));
  const rung = planDrawings(ctxOf(vfd(false))).sheets.flatMap((s) => (s.spec.kind === 'control' ? s.spec.rungs : [])).find((r) => r.key === 'coil:K1');
  assert.ok(rung && rung.els.some((e) => e.t === 'coil' && e.tag === 'K1'), 'control sheet has the K1 coil rung');
});

ok('a K1 switched by a PLC output gets no extra coil wiring', () => {
  const m = buildModel(ctxOf(vfd(true)));
  assert.ok(!m.wires.some((x) => x.to === 'K1:A1' && x.wire === '24+S' && /line contactor coil/.test(x.function)));
  assert.equal(m.wires.filter((x) => /^K1:T\d$/.test(x.from) && /^VFD1:L\d$/.test(x.to)).length, 3);
});

ok('DOL motors unchanged: CB1 -> K1 -> OL1', () => {
  const m = buildModel(ctxOf(DESIGN));
  assert.equal(m.wires.filter((x) => /^K1:T\d$/.test(x.from) && /^OL1:L\d$/.test(x.to)).length, 3);
  assert.ok(!m.wires.some((x) => /line contactor/.test(x.function)));
});

console.log(`vfd line contactor tests passed (${n})`);
