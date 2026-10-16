/// <reference types="node" />
/**
 * Electrical code rules: a passing and a failing case per rule.
 * Run with:  npx tsx src/review/codeRules/codeRules.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN, SPEC } from '../../preview/sampleProject';
import { getPart } from '../../electrical/catalog';
import type { DrawingContext } from '../../electrical/derive';
import type { DesignComponent, ElectricalDesign } from '../../electrical/types';
import { RULES, makeEnv, runCodeRules, type CodeInput, type Env } from './rules';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

const ctxOf = (design: ElectricalDesign, region: 'US' | 'Canada' = 'US'): DrawingContext => ({
  projectName: 'test', design, getPart, region,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const swap = (d: ElectricalDesign, tag: string, partNumber: string, fn?: string): ElectricalDesign => ({ ...d, components: d.components.map((c) => (c.tag === tag ? { ...c, partNumber, function: fn ?? c.function } : c)) });
const drop = (d: ElectricalDesign, ...tags: string[]): ElectricalDesign => ({ ...d, components: d.components.filter((c) => !tags.includes(c.tag)) });
const add = (d: ElectricalDesign, ...cs: DesignComponent[]): ElectricalDesign => ({ ...d, components: [...d.components, ...cs] });
const run = (rule: string, input: Partial<CodeInput> & { ctx: DrawingContext }, env?: Env) => runCodeRules({ spec: SPEC, ...input }, env).filter((h) => h.rule === rule);
const base = ctxOf(DESIGN);
const cloneEnv = (ctx: DrawingContext): Env => { const e = makeEnv(ctx); return { ...e, wires: e.wires.map((w) => ({ ...w })), m: { ...e.m, safety: { ...e.m.safety } }, L: { ...e.L, door: { ...e.L.door, items: e.L.door.items.map((i) => ({ ...i })) } } }; };

console.log('code rules');

test('every rule has US and Canada clauses', () => {
  for (const r of RULES) { assert.ok(r.clause.US && r.clause.Canada, r.id); }
  const ca = runCodeRules({ ctx: ctxOf(DESIGN, 'Canada'), spec: SPEC });
  assert.ok(ca.every((h) => !/NEC 4|UL 508A/.test(h.clause) || /CEC|CSA/.test(h.clause)), 'Canada hits cite CEC / CSA');
});

test('min-conductor: 14 AWG ok, 16 AWG power fails', () => {
  assert.equal(run('min-conductor', { ctx: base }).length, 0);
  const env = cloneEnv(base);
  env.wires.find((w) => /M1 line side/.test(w.function))!.size = '16 AWG';
  assert.equal(run('min-conductor', { ctx: base }, env).length, 1);
});

test('branch-conductor-ocpd: 3 A on 14 AWG ok, 20 A on 14 AWG fails', () => {
  assert.equal(run('branch-conductor-ocpd', { ctx: base }).length, 0);
  const hits = run('branch-conductor-ocpd', { ctx: ctxOf(swap(DESIGN, 'CB2', 'GMCBU-3C-20')) });
  assert.ok(hits.length >= 1 && /15 A/.test(hits[0].detail), JSON.stringify(hits));
});

test('dc-control-protection: 5 A supply ok, 10 A supply on 18 AWG fails, fused terminals fix it', () => {
  assert.equal(run('dc-control-protection', { ctx: base }).length, 0);
  const big = swap(DESIGN, 'PS1', 'PSR-24-240-3');
  assert.equal(run('dc-control-protection', { ctx: ctxOf(big) }).length, 1);
  const fused = add(big, { tag: 'TBF', partNumber: 'DN-F6', quantity: 4, function: '24VDC distribution fuses', motorTag: null });
  assert.equal(run('dc-control-protection', { ctx: ctxOf(fused) }).length, 0);
});

test('motor-conductor: 14 AWG for 2.1 A ok; 7.5 HP (11 A x 125 % = 13.8 A) on 18 AWG (7 A) fails', () => {
  assert.equal(run('motor-conductor', { ctx: base }).length, 0);
  const big = { ...DESIGN, inputs: { ...DESIGN.inputs, motors: [{ ...DESIGN.inputs.motors[0], hp: 7.5 }] } };
  assert.equal(run('motor-conductor', { ctx: ctxOf(big) }).length, 0, 'derive sizes it correctly');
  const env = cloneEnv(ctxOf(big));
  for (const w of env.wires.filter((x) => x.wire === 'M1-L1')) w.size = '18 AWG';
  assert.equal(run('motor-conductor', { ctx: ctxOf(big) }, env).length, 1);
});

test('motor-overload: TK-E02-220 covers 2.1 A, TK-E02-600 does not', () => {
  assert.equal(run('motor-overload', { ctx: base }).length, 0);
  assert.equal(run('motor-overload', { ctx: ctxOf(swap(DESIGN, 'OL1', 'TK-E02-600')) }).length, 1);
});

test('motor-scpd: 5 A breaker ok for 2.1 A, 20 A breaker exceeds the 15 A maximum', () => {
  assert.equal(run('motor-scpd', { ctx: base }).length, 0);
  const hits = run('motor-scpd', { ctx: ctxOf(swap(DESIGN, 'CB1', 'GMCBU-3C-20')) });
  assert.equal(hits.length, 1);
  assert.match(hits[0].title, /15 A maximum/);
});

const cpt = (pn: string, extra: DesignComponent[] = []) => ({
  ...DESIGN,
  inputs: { ...DESIGN.inputs, supply: '600VAC-3PH' as const, motors: [{ ...DESIGN.inputs.motors[0], voltage: '600VAC-3PH' as const }] },
  components: [...DESIGN.components.filter((c) => c.tag !== 'CB2' && c.tag !== 'PS1'), { tag: 'T1', partNumber: pn, quantity: 1, function: 'Control transformer 600:120', motorTag: null }, { tag: 'PS1', partNumber: 'PSR-24-120', quantity: 1, function: '24VDC power supply', motorTag: null }, ...extra],
});

test('transformer-protection: fused CT ok, unfused CT without primary protection fails', () => {
  assert.equal(run('transformer-protection', { ctx: ctxOf(cpt('CT-050-060-12-1'), 'Canada') }).length, 0);
  const hits = run('transformer-protection', { ctx: ctxOf(cpt('CT-010-060-12-0'), 'Canada') });
  assert.equal(hits.length, 1);
  assert.match(hits[0].clause, /CEC/);
});

test('disconnect: present + lockable ok; missing handle fails; missing disconnect is critical', () => {
  assert.equal(run('disconnect', { ctx: base }).length, 0);
  assert.equal(run('disconnect', { ctx: ctxOf(drop(DESIGN, 'DS1H')) }).length, 1);
  const none = run('disconnect', { ctx: ctxOf(drop(DESIGN, 'DS1', 'DS1H', 'DS1S')) });
  assert.equal(none[0].severity, 'critical');
});

test('mounting-heights: example gives a mounting window; a 2 m door with a high handle and low devices fails', () => {
  const ok = run('mounting-heights', { ctx: base });
  assert.equal(ok.length, 1);
  assert.equal(ok[0].severity, 'info');
  const env = cloneEnv(base);
  env.L = { ...env.L, door: { ...env.L.door, h: 2000, handle: { ...env.L.door.handle!, cy: 100 }, items: env.L.door.items.map((i) => ({ ...i, cy: 1950, h: 30 })) } };
  assert.equal(run('mounting-heights', { ctx: base }, env)[0].severity, 'minor');
});

test('wire-colours: example colours ok; black 120 VAC control conductor fails', () => {
  assert.equal(run('wire-colours', { ctx: base }).length, 0);
  assert.equal(run('wire-colours', { ctx: ctxOf(cpt('CT-050-060-12-1')) }).length, 0, 'X1 is red');
  const env = cloneEnv(ctxOf(cpt('CT-050-060-12-1')));
  env.wires.find((w) => w.wire === 'X1')!.color = 'BK';
  assert.equal(run('wire-colours', { ctx: base }, env).length, 1);
});

test('protective-earth: ground bar ok; no ground bar fails', () => {
  assert.equal(run('protective-earth', { ctx: base }).length, 0);
  assert.ok(run('protective-earth', { ctx: ctxOf(drop(DESIGN, 'GB1')) }).some((h) => h.subject === 'bar'));
});

test('sccr: unknown component ratings fail; known ratings only ask for the nameplate marking', () => {
  assert.ok(run('sccr', { ctx: base, sccr: { unknown: ['PS1'], lowest: 5 } }).some((h) => h.subject === 'unknown'));
  assert.ok(run('sccr', { ctx: base, sccr: { unknown: [], lowest: 5 } }).every((h) => h.subject !== 'unknown'));
});

test('enclosure-type: NEMA 12 ok; NEMA 4X design or a wash-down spec fails', () => {
  assert.equal(run('enclosure-type', { ctx: base }).length, 0);
  assert.equal(run('enclosure-type', { ctx: ctxOf({ ...DESIGN, inputs: { ...DESIGN.inputs, enclosureRating: 'NEMA 4X' } }) }).length, 1);
  assert.equal(run('enclosure-type', { ctx: base, spec: { ...SPEC, utilities: 'Daily wash-down with hoses.' } }).length, 1);
});

test('estop-device: red mushroom ok; yellow background needed unless a yellow legend plate is in the design', () => {
  const hits = run('estop-device', { ctx: base });
  assert.ok(hits.every((h) => /yellow/i.test(h.title)), JSON.stringify(hits));
  const plate = add(DESIGN, { tag: 'LP1', partNumber: 'YEL-PLATE', quantity: 1, function: 'Yellow E-stop legend plate', motorTag: null });
  assert.equal(run('estop-device', { ctx: ctxOf(plate) }).length, 0);
});

test('stop-category: stated in the example; missing fails', () => {
  assert.equal(run('stop-category', { ctx: base }).length, 0);
  assert.equal(run('stop-category', { ctx: base, spec: { ...SPEC, safety: 'One E-stop.', modes: '' } }).length, 1);
});

test('safety-edm: contactor in the feedback loop ok; empty EDM fails', () => {
  assert.equal(run('safety-edm', { ctx: base }).length, 0);
  const env = cloneEnv(base);
  env.m = { ...env.m, safety: { ...env.m.safety, edm: [], edmTerms: [] } };
  assert.equal(run('safety-edm', { ctx: base }, env).length, 1);
});

test('safety-reset: separate reset ok; no reset or reset = Start fails', () => {
  assert.equal(run('safety-reset', { ctx: base }).length, 0);
  const resetTag = DESIGN.components.find((c) => /safety reset/i.test(c.function))?.tag;
  assert.ok(resetTag, 'example has a safety reset button');
  assert.equal(run('safety-reset', { ctx: ctxOf(drop(DESIGN, resetTag!)) }).length, 1);
  const startIsReset = swap(drop(DESIGN, resetTag!), 'PB1', 'GCX1102', 'Start / safety reset');
  assert.equal(run('safety-reset', { ctx: ctxOf(startIsReset) }).length, 1);
});

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
