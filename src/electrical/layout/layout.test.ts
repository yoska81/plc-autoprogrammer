/// <reference types="node" />
/**
 * Machine layout: scale, routed cable lengths, derive integration, suggestions.
 * Run with:  npx tsx src/electrical/layout/layout.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../../preview/sampleProject';
import { getPart } from '../catalog';
import { billOfMaterials, buildModel, cableSchedule, type DrawingContext } from '../derive';
import { layoutForDesign, routedLength, unitsPerMeter, withService, lengthText, RouteGraph } from './geometry';
import { cableTotals, clusters, suggest } from './suggest';
import { CABINET, EMPTY_LAYOUT, type LayoutForDesign, type MachineLayout } from './types';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

const ctxOf = (machineLayout?: LayoutForDesign): DrawingContext => ({
  projectName: 'test', design: DESIGN, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
  machineLayout,
});
const ml = (pos: Record<string, [number, number]>, routes: [number, number][][] = [], extra: Partial<LayoutForDesign> = {}): LayoutForDesign => ({
  pos: Object.fromEntries(Object.entries(pos).map(([k, [x, y]]) => [k, { x, y }])), routes: routes.map((pts) => ({ kind: 'tray' as const, pts })),
  service: { pct: 10, endM: 1 }, manifolds: [], remoteIo: [], sizeM: { w: 40, h: 20 }, ...extra,
});

console.log('machine layout');

test('scale from two points: 100 units over 2 m = 50 units/m; 10 in', () => {
  near(unitsPerMeter([0, 0], [100, 0], 2, 'm'), 50);
  near(unitsPerMeter([0, 0], [0, 254], 10, 'in'), 1000);
  near(unitsPerMeter([0, 0], [100, 0], 2000, 'mm'), 50);
});

test('layoutForDesign converts to metres; none without a scale', () => {
  const l: MachineLayout = { ...EMPTY_LAYOUT, items: [{ id: 'a', tag: CABINET, kind: 'cabinet', x: 100, y: 50 }], routes: [{ id: 'r', kind: 'tray', points: [[0, 0], [200, 0]] }] };
  assert.equal(layoutForDesign(l), undefined);
  const d = layoutForDesign({ ...l, scale: { unitsPerMeter: 50, a: [0, 0], b: [100, 0], value: 2, unit: 'm' } })!;
  near(d.pos[CABINET].x, 2); near(d.pos[CABINET].y, 1); near(d.routes[0].pts[1][0], 4);
});

test('no routes: Manhattan distance', () => {
  near(routedLength([0, 0], [3, 4], []).len, 7);
});

test('along a tray: drop + tray + drop; crossing trays connect', () => {
  // tray along y = 1 from x 0..20; cabinet at (0,0), device at (20,3)
  const r = routedLength([0, 0], [20, 3], [{ kind: 'tray', pts: [[0, 1], [20, 1]] }]);
  near(r.len, 1 + 20 + 2);
  // L-shaped run on two separate trays that cross at (10,1)
  const r2 = routedLength([0, 0], [10, 10], [{ kind: 'tray', pts: [[0, 1], [15, 1]] }, { kind: 'tray', pts: [[10, -2], [10, 10]] }]);
  near(r2.len, 1 + 10 + 9 + 0, 1e-3);
  assert.deepEqual(r2.routes.sort(), [0, 1]);
  const g = new RouteGraph([{ kind: 'tray', pts: [[0, 0], [10, 0]] }, { kind: 'tray', pts: [[5, -5], [5, 5]] }]);
  assert.equal(g.nodes.length, 5, 'cross point is a node');
});

test('two items dropping onto the same tray segment connect directly', () => {
  // tray y = 9 from x 2..29; items at (5,5) and (8,6): 4 + 3 + 3 = 10 m, not via a segment end
  const rs: LayoutForDesign['routes'] = [{ kind: 'tray', pts: [[2, 9], [29, 9]] }, { kind: 'chain', pts: [[12, 9], [12, 6.5]] }];
  near(routedLength([5, 5], [8, 6], rs).len, 10);
  // the chain is closer in a straight line, but the orthogonal drop to the tray is shorter
  near(routedLength([8, 6], [7.75, 3.5], rs).len, 3 + 0.25 + 5.5);
});

test('short hops are point to point', () => {
  near(routedLength([0, 0], [1, 0.5], [{ kind: 'tray', pts: [[0, 10], [20, 10]] }]).len, 1.5);
});

test('service allowance: +10 % and 1 m each end', () => {
  near(withService(20, { pct: 10, endM: 1 }), 24);
  assert.equal(lengthText(24), '24.0 m (79 ft)');
});

const pos = { [CABINET]: [0, 0] as [number, number], JB1: [11, 2] as [number, number], PE1: [12, 2] as [number, number], LS1: [13, 2.5] as [number, number], LS2: [13, 1.5] as [number, number], SOL1: [13.5, 2] as [number, number], SOL2: [14, 2.5] as [number, number], M1: [6, 2] as [number, number] };

test('derive: cable schedule lengths come from the layout, "BY SITE" only for unplaced ends', () => {
  const before = cableSchedule(ctxOf());
  assert.ok(before.every((c) => c.length === 'BY SITE'));
  const tray: [number, number][] = [[0, 1], [15, 1]];
  const cs = cableSchedule(ctxOf(ml(pos, [tray])));
  const m1 = cs.find((c) => c.to === 'M1')!;
  // cabinet (0,0) -> tray y=1 (1 m) -> along to x=6 (6 m) -> drop to (6,2) (1 m) = 8 m; +10 % + 2 m = 10.8 m
  assert.equal(m1.length, lengthText(10.8));
  assert.ok(cs.filter((c) => pos[c.to as keyof typeof pos]).every((c) => c.length !== 'BY SITE'));
});

test('suggest: two close cylinders -> manifold with tubing; far valve excluded', () => {
  const d = ml({ ...pos, SOL2: [30, 15] });
  const model = buildModel(ctxOf(d));
  const s1 = suggest(d, model.machine.devices, model.machine.cables, { manifoldRadiusM: 2 }).filter((s) => s.kind === 'manifold');
  assert.equal(s1.length, 0, 'SOL1 alone');
  const d2 = ml({ ...pos, SOL2: [14, 3] });
  const m2 = buildModel(ctxOf(d2));
  const s2 = suggest(d2, m2.machine.devices, m2.machine.cables, { manifoldRadiusM: 2 }).filter((s) => s.kind === 'manifold');
  assert.equal(s2.length, 1);
  assert.deepEqual(s2[0].manifold!.valves, ['SOL1', 'SOL2']);
  assert.equal(s2[0].manifold!.tubes.length, 2);
});

test('accepted manifold: valve cables go to the manifold and the BOM lists it as "part to be selected"', () => {
  const d = ml(pos, [], { manifolds: [{ tag: 'MV1', valves: ['SOL1', 'SOL2'], x: 13, y: 2 }] });
  const cs = cableSchedule(ctxOf(d));
  const sol1 = cs.find((c) => c.to === 'SOL1')!;
  assert.equal(sol1.length, lengthText(withService(2, d.service)), 'JB1 (11,2) -> manifold (13,2)');
  const notes = billOfMaterials(ctxOf(d)).flatMap((g) => g.lines).filter((l) => /manifold MV1/.test(l.description));
  assert.equal(notes.length, 1);
  assert.equal(notes[0].partNumber, '');
});

test('suggest: junction box placement and cabinet location', () => {
  const withJb = { ...DESIGN, machine: { ...DESIGN.machine!, junctionBoxes: [{ tag: 'JB1', location: 'Pusher station' }], routing: { PE1: 'JB1', LS1: 'JB1', LS2: 'JB1', SOL1: 'JB1' } } };
  const d = ml({ ...pos, JB1: [3, 0] });
  const ctx = { ...ctxOf(d), design: withJb };
  const model = buildModel(ctx);
  const s = suggest(d, model.machine.devices, model.machine.cables, { manifoldRadiusM: 2 });
  const mv = s.find((x) => x.kind === 'jb-move');
  assert.ok(mv && mv.jbMove!.jb === 'JB1' && mv.savingM! > 1, JSON.stringify(s.map((x) => x.id)));
  // home-run devices around LS1/LS2: the suggested cabinet spot is never on top of a device
  const homeRun = ['PE1', 'LS1', 'LS2', 'SOL1', 'SOL2'].map((to, i) => ({ tag: `W${i + 1}`, kind: 'device', zone: '', from: `TB2-${i + 1}`, to, type: '3-core', size: '18 AWG', length: 'BY SITE', cores: [], spareCores: 0 })) as unknown as Parameters<typeof suggest>[2];
  const d2 = ml(pos);
  const all2 = suggest(d2, [], homeRun, { manifoldRadiusM: 2 });
  const cabS = all2.find((x) => x.kind === 'cabinet');
  assert.ok(cabS, 'cabinet move suggested');
  for (const [tag, p] of Object.entries(pos)) if (tag !== CABINET) assert.ok(Math.hypot(cabS.cabinet!.to[0] - p[0], cabS.cabinet!.to[1] - p[1]) >= 1, `cabinet ${cabS.cabinet!.to} clear of ${tag}`);
});

test('clusters and cable totals', () => {
  const g = clusters([{ id: 'a', p: [0, 0] }, { id: 'b', p: [1, 0] }, { id: 'c', p: [2.5, 0] }, { id: 'd', p: [10, 0] }], 1.6);
  assert.deepEqual(g.map((x) => x.map((y) => y.id).sort()), [['a', 'b', 'c'], ['d']]);
  const cs = cableSchedule(ctxOf(ml(pos)));
  const tot = cableTotals(cs);
  assert.ok(tot.reduce((a, t) => a + t.count, 0) === cs.length);
});

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
