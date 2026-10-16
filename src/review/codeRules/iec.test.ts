/// <reference types="node" />
/**
 * IEC 60204-1 rule set: rule selection by region, and a passing and a failing case per IEC rule.
 * Run with:  npx tsx src/review/codeRules/iec.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN, SPEC } from '../../preview/sampleProject';
import { getPart } from '../../electrical/catalog';
import type { DrawingContext } from '../../electrical/derive';
import type { ElectricalDesign } from '../../electrical/types';
import { iecAmpacity, mm2Of } from './iec';
import { makeEnv, rulesFor, ruleSetOf, runCodeRules, type CodeInput, type Env } from './rules';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

const ctxOf = (design: ElectricalDesign): DrawingContext => ({
  projectName: 'test', design, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const base = ctxOf(DESIGN);
const iecEnv = (ctx: DrawingContext = base): Env => { const e = makeEnv(ctx, 'IEC'); return { ...e, wires: e.wires.map((w) => ({ ...w })) }; };
const run = (rule: string, input: Partial<CodeInput> = {}, env?: Env) => runCodeRules({ ctx: base, spec: SPEC, ruleSet: 'IEC', ...input }, env ?? iecEnv(input.ctx)).filter((h) => h.rule === rule);
/** Wire sizes as an IEC design would give them. */
const toMm2 = (env: Env, map: Record<string, string>) => { for (const w of env.wires) w.size = map[w.size] ?? w.size; return env; };
const MM2: Record<string, string> = { '18 AWG': '0.75 mm²', '16 AWG': '1 mm²', '14 AWG': '1.5 mm²', '12 AWG': '2.5 mm²', '10 AWG': '4 mm²' };

console.log('IEC 60204-1 rules');

test('rule set by region: US / Canada = NA, Europe / Israel = IEC', () => {
  assert.equal(ruleSetOf('US'), 'NA'); assert.equal(ruleSetOf('Canada'), 'NA'); assert.equal(ruleSetOf(undefined), 'NA');
  assert.equal(ruleSetOf('Europe'), 'IEC'); assert.equal(ruleSetOf('Israel'), 'IEC');
  const iec = rulesFor('IEC').map((r) => r.id);
  for (const id of ['motor-scpd', 'transformer-protection', 'min-conductor', 'branch-conductor-ocpd', 'wire-colours', 'sccr', 'enclosure-type']) assert.ok(!iec.includes(id), `${id} is NA only`);
  for (const id of ['disconnect', 'estop-device', 'safety-reset', 'iec-supply', 'iec-wire-colours']) assert.ok(iec.includes(id), id);
  const hits = runCodeRules({ ctx: base, spec: SPEC, ruleSet: 'IEC' });
  assert.ok(hits.length && hits.every((h) => /IEC|ISO|Good practice/.test(h.clause)), JSON.stringify(hits.map((h) => h.clause)));
});

test('mm² parsing and Table 6 capacity', () => {
  assert.equal(mm2Of('1,5 mm²'), 1.5); assert.equal(mm2Of('2.5 mm2'), 2.5); assert.equal(mm2Of('14 AWG'), 2.08);
  assert.equal(iecAmpacity(1.5), 15.1); assert.equal(iecAmpacity(2.08), 15.1, 'between steps: next smaller');
});

test('iec-supply: 400 V 50 Hz ok, 480 V 60 Hz fails', () => {
  assert.equal(run('iec-supply').length, 1);
  const eu = { ...DESIGN, inputs: { ...DESIGN.inputs, supply: '400VAC-3PH-50Hz' as never } };
  assert.equal(run('iec-supply', { ctx: ctxOf(eu) }).length, 0);
});

test('iec-min-conductor: 0.75 mm² power ok, 0.5 mm² power fails', () => {
  assert.equal(run('iec-min-conductor', {}, toMm2(iecEnv(), MM2)).length, 0);
  const env = toMm2(iecEnv(), MM2);
  env.wires.find((w) => /M1 line side/.test(w.function))!.size = '0.5 mm²';
  assert.equal(run('iec-min-conductor', {}, env).length, 1);
});

test('iec-conductor-ocpd: 1.5 mm² on 3 A ok; 1 mm² motor conductor on a 12 A motor fails', () => {
  assert.equal(run('iec-conductor-ocpd', {}, toMm2(iecEnv(), MM2)).length, 0);
  const big = { ...DESIGN, inputs: { ...DESIGN.inputs, motors: [{ ...DESIGN.inputs.motors[0], hp: 7.5 }] } };
  const env = toMm2(iecEnv(ctxOf(big)), MM2);
  for (const w of env.wires.filter((x) => x.wire === 'M1-L1')) w.size = '1 mm²';
  const hits = run('iec-conductor-ocpd', { ctx: ctxOf(big) }, env);
  assert.ok(hits.some((h) => h.subject === 'M1'), JSON.stringify(hits));
});

test('iec-pe-size: PE same size ok, smaller PE fails', () => {
  assert.equal(run('iec-pe-size', {}, toMm2(iecEnv(), MM2)).length, 0);
  const env = toMm2(iecEnv(), MM2);
  for (const w of env.wires.filter((x) => /^M1 motor ground/i.test(x.function))) w.size = '0.75 mm²';
  assert.equal(run('iec-pe-size', {}, env).length, 1);
});

test('iec-wire-colours: GN/YE PE ok; white neutral and black AC control fail', () => {
  assert.equal(run('iec-wire-colours').length, 0);
  const env = iecEnv();
  env.wires.push({ wire: 'N', from: 'X', to: 'Y', color: 'WH', size: '1.5 mm²', function: 'Neutral' });
  env.wires.push({ wire: 'X1', from: 'T1', to: 'FU', color: 'BK', size: '1.5 mm²', function: 'Control transformer secondary 120VAC' });
  const hits = run('iec-wire-colours', {}, env);
  assert.deepEqual(hits.map((h) => h.subject).sort(), ['N', 'X1']);
  assert.match(hits.find((h) => h.subject === 'N')!.title, /expected LBU/);
});

test('iec-dc-control-protection: 5 A supply on 0.75 mm² ok, 10 A supply fails', () => {
  assert.equal(run('iec-dc-control-protection', {}, toMm2(iecEnv(), MM2)).length, 0);
  const big = { ...DESIGN, components: DESIGN.components.map((c) => (c.tag === 'PS1' ? { ...c, partNumber: 'PSR-24-240-3' } : c)) };
  assert.equal(run('iec-dc-control-protection', { ctx: ctxOf(big) }, toMm2(iecEnv(ctxOf(big)), MM2)).length, 1);
});

test('iec-short-circuit-protection: motor breaker ok (coordination note); none fails', () => {
  const ok = run('iec-short-circuit-protection');
  assert.ok(ok.every((h) => h.severity === 'info'), JSON.stringify(ok));
  const none = { ...DESIGN, components: DESIGN.components.filter((c) => c.tag !== 'CB1') };
  assert.ok(run('iec-short-circuit-protection', { ctx: ctxOf(none) }).some((h) => h.severity === 'major' && h.subject === 'M1'));
});

test('iec-enclosure-ip: NEMA 3R/4/12/13 ≈ IP66 ok (info); a NEMA 12-only box in a wash-down area fails', () => {
  const ok = run('iec-enclosure-ip');
  assert.ok(ok.length === 1 && ok[0].severity === 'info' && /IP66/.test(ok[0].title), JSON.stringify(ok));
  const env = iecEnv();
  env.m = { ...env.m, rc: env.m.rc.map((c) => (c.category === 'enclosure' && c.part ? { ...c, part: { ...c.part, ratings: { ...c.part.ratings, nema: '12' } } } : c)) };
  const wash = run('iec-enclosure-ip', { spec: { ...SPEC, utilities: 'Daily wash-down with hoses.' } }, env);
  assert.ok(wash.length === 1 && wash[0].severity === 'minor' && /IP54.*IP66/.test(wash[0].title), JSON.stringify(wash));
});

test('iec-marking: SCCR "TBD" and 60 Hz are reported, with the parts lacking a rating', () => {
  const hits = run('iec-marking', { sccr: { unknown: ['PS1'], lowest: 5 } });
  assert.equal(hits.length, 1);
  assert.match(hits[0].title, /short-circuit current \(no rating yet for PS1\)/);
});

test('iec-control-supply: 24 VDC control ok; AC control from the mains with two starters fails', () => {
  assert.equal(run('iec-control-supply').length, 0);
  const env = iecEnv();
  env.wires.push({ wire: 'X1', from: 'CB', to: 'K', color: 'RD', size: '1.5 mm²', function: 'Control 120VAC feed' });
  env.m = { ...env.m, transformer: undefined, motors: [...env.m.motors, { ...env.m.motors[0], motor: { ...env.m.motors[0].motor, tag: 'M2' } }] };
  assert.equal(run('iec-control-supply', {}, env).length, 1);
});

test('shared rules under IEC: disconnect at 100 % of full-load current, small motor without overload allowed', () => {
  assert.equal(run('disconnect').length, 0);
  const small = { ...DESIGN, components: DESIGN.components.filter((c) => c.tag !== 'OL1'), inputs: { ...DESIGN.inputs, motors: [{ ...DESIGN.inputs.motors[0], hp: 0.5 }] } };
  assert.equal(run('motor-overload', { ctx: ctxOf(small) }).length, 0, '0.37 kW: no overload required (7.3.1)');
  const big = { ...small, inputs: { ...small.inputs, motors: [{ ...small.inputs.motors[0], hp: 2 }] } };
  assert.equal(run('motor-overload', { ctx: ctxOf(big) }).length, 1, '1.5 kW needs overload protection');
});

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
