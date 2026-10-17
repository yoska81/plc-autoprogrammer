/// <reference types="node" />
/**
 * Design review tests. Run with:  npx tsx src/review/review.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject, LADDER } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { useProgramStore } from '../store/useProgramStore';
import { useProjectStore } from '../store/useProjectStore';
import { useIOStore } from '../store/useIOStore';
import { useSpecStore } from '../store/useSpecStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useReviewStore } from './useReviewStore';
import { projectSummary, REVIEW_SCHEMA } from './reviewAI';
import { reviewRows } from './report';
import { acceptCriticalForConstruction, checksFor, openCriticalFindings } from './actions';
import { openCounts } from './useReviewStore';
import { designReviewTable } from '../deliverables/docs/manual';
import { pageRoute } from './types';
import { specMotorRatings } from './checks';
import type { LadderProgram } from '../plc/core/ladder';

// The stores persist to localStorage, which node doesn't have: silence the warnings.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

const check = () => checksFor(collectProject());
const ids = () => check().map((f) => f.id);

console.log('design review');

test('example project: no critical or major findings', () => {
  seedSampleProject();
  const f = check();
  assert.deepEqual(f.filter((x) => x.severity === 'critical' || x.severity === 'major').map((x) => x.title), []);
  assert.ok(f.some((x) => x.id === 'doc:approved'), 'approval still missing');
  assert.ok(f.every((x) => x.source === 'check' && x.title && x.detail && x.fix));
  assert.equal(new Set(f.map((x) => x.id)).size, f.length, 'unique ids');
});

test('broken variant: every cross-stage problem is found', () => {
  seedSampleProject();
  const broken: LadderProgram = structuredClone(LADDER);
  // Y001 driven straight from the Start button: not gated by Safety OK
  broken.rungs.find((r) => r.id === 'r_y1')!.branches = [[{ type: 'NO', address: 'X002' }]];
  // no fault reset, no heartbeat, Y002 never driven
  broken.rungs = broken.rungs.filter((r) => !['r_alm_reset', 'r_hb', 'r_y2'].includes(r.id));
  useProgramStore.setState({ ladder: broken });
  // a guard switch nobody described or programmed, and five more outputs than the CPU has
  const io = useIOStore.getState();
  io.importPoints([
    { description: 'Guard door switch', type: 'input', category: 'Safety' },
    ...['Horn', 'Valve A', 'Valve B', 'Valve C', 'Valve D'].map((d) => ({ description: d, type: 'output' as const, category: 'Pneumatic' as const })),
  ], false);
  const got = ids();
  for (const id of ['out-unsafe:Y001', 'out-undriven:Y002', 'alm-noreset:C1101', 'hmi-unwritten:C1203', 'in-unused:X007', 'io-spec:', 'cap:outputs', 'stale:program']) {
    assert.ok(got.some((g) => g.startsWith(id)), `expected ${id} in ${got.join(', ')}`);
  }
  const unsafe = check().find((f) => f.id === 'out-unsafe:Y001')!;
  assert.equal(unsafe.severity, 'critical');
  assert.equal(unsafe.page, 'program');
});

test('spec device without an I/O point', () => {
  seedSampleProject();
  useSpecStore.getState().setSections({ ...useSpecStore.getState().sections, sensing: '- Part-at-end photo-eye, PNP.\n- Pusher extended prox, PNP.\n- Bin full level sensor, PNP.' });
  const f = check().filter((x) => x.id.startsWith('spec-io:'));
  assert.equal(f.length, 1);
  assert.match(f[0].title, /Bin full level sensor/);
});

test('marks carry into the engineering package table', () => {
  seedSampleProject();
  useReviewStore.setState(useReviewStore.getInitialState());
  useReviewStore.getState().setAi({ summary: 'Sound design.', findings: [{ id: 'ai:safety:x', source: 'ai', severity: 'major', area: 'safety', title: 'Air not dumped on E-stop', detail: 'd', fix: 'Add a dump valve.', page: 'electrical', item: '' }] });
  useReviewStore.getState().mark('doc:approved', 'ignored', 'Approval after FAT');
  const rows = reviewRows(collectProject());
  assert.equal(rows[0].title, 'Air not dumped on E-stop', 'most severe first');
  assert.equal(rows[0].source, 'AI review');
  const appr = rows.find((r) => r.title === 'Design not approved')!;
  assert.equal(appr.status, 'ignored');
  assert.equal(appr.reason, 'Approval after FAT');
  const t = designReviewTable(collectProject());
  assert.equal(t.rows.length, rows.length);
  assert.ok(t.rows.some((r) => Array.isArray(r) && r[3] === 'Accepted: Approval after FAT'));
});

test('AI request: summary has every part of the project, schema is strict', () => {
  seedSampleProject();
  const det = check();
  const s = projectSummary(collectProject(), det);
  for (const h of ['# Specification', '# I/O list', '# Equipment', '# Control panel', 'Safety circuit wiring', 'Calculations:', '# PLC program', '# HMI', '# Deterministic findings']) assert.ok(s.includes(h), h);
  assert.ok(s.includes('X001') && s.includes('PB3') && s.includes('C1204') && s.includes('Design not approved'));
  assert.ok(s.includes('1=r_init_tmo'), 'rung ids for links');
  const item = REVIEW_SCHEMA.properties.findings.items;
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
  assert.equal(pageRoute('hmi', 'manual'), '/hmi?screen=manual');
});

test('construction guard: open criticals block, override marks them accepted', () => {
  seedSampleProject();
  assert.equal(openCriticalFindings().length, 0, 'example has no open critical');
  const broken: LadderProgram = structuredClone(LADDER);
  broken.rungs.find((r) => r.id === 'r_y1')!.branches = [[{ type: 'NO', address: 'X002' }]];
  useProgramStore.setState({ ladder: broken });
  const open = openCriticalFindings();
  assert.deepEqual(open.map((f) => f.id), ['out-unsafe:Y001']);
  assert.equal(openCounts(useReviewStore.getState()).critical, 1, 'badge count');
  acceptCriticalForConstruction(open, 'B', 'Interlock added in hardware, program fix in rev C');
  assert.equal(openCriticalFindings().length, 0);
  assert.match(useReviewStore.getState().marks['out-unsafe:Y001'].reason, /rev B.*Interlock added/);
  assert.equal(openCounts(useReviewStore.getState()).critical, 0);
});

test('spec motors: a motor described in two sections counts once; a match is never a mismatch', () => {
  const three = {
    overview: 'Conveyor cell: M1 infeed conveyor 2 HP, M2 transfer conveyor 1 HP and an M3 discharge conveyor 1/2 HP.',
    motion: '- Infeed conveyor motor 2 HP, 480 V, across the line.\n- The 0.5 HP discharge motor runs at constant speed.',
    qa: 'Q: Is the transfer conveyor motor 1 HP? A: Yes, M2 is 1 HP with a gearbox.',
  };
  assert.deepEqual(specMotorRatings(three).length, 3, specMotorRatings(three).join(', '));
  // the same motor twice in one section, once unnamed
  assert.equal(specMotorRatings({ motion: 'Conveyor motor 2 HP. The 2 HP motor stops on a jam.' }).length, 1);
  // two different motors of one rating are two
  assert.equal(specMotorRatings({ motion: 'Pump 1 HP and fan 1 HP.' }).length, 2);
  assert.equal(specMotorRatings({ overview: 'No motors.' }).length, 0);
  // the review: a 3-motor panel for that spec raises nothing; a 2-motor panel does (on a copy of the project)
  seedSampleProject();
  const snap = collectProject();
  const withMotors = (n: number) => {
    const m0 = snap.electrical!.inputs.motors[0];
    const motors = Array.from({ length: n }, (_, i) => ({ ...m0, tag: `M${i + 1}` }));
    return checksFor({ ...snap, spec: { ...snap.spec, ...three }, electrical: { ...snap.electrical!, inputs: { ...snap.electrical!.inputs, motors } } });
  };
  assert.ok(!withMotors(3).some((x) => x.id === 'spec-motors'), withMotors(3).map((x) => x.id).join(', '));
  const f = withMotors(2).find((x) => x.id === 'spec-motors');
  assert.ok(f, 'a missing motor is flagged');
  assert.match(f!.title, /names 3 motors, the panel has 2/);
});

test('spec coverage: analog, guarding, motors, VFD and servo the design misses', () => {
  seedSampleProject();
  const sp = useSpecStore.getState();
  sp.setSections({ ...sp.sections,
    sensing: sp.sections.sensing + '\n- Tank level transmitter, 4-20 mA.',
    guarding: '- Light curtain at the operator opening.',
    motion: sp.sections.motion + '\n- M2 agitator 5 HP on a variable speed drive.\n- Servo for the sideways move.' });
  useIOStore.getState().importPoints([{ description: 'Tank level transmitter 4-20 mA', type: 'input', category: 'Analog/Process' }], false);
  const got = ids();
  for (const id of ['spec-analog', 'analog-on-discrete:', 'spec-guard', 'spec-motors', 'spec-vfd', 'spec-servo']) assert.ok(got.some((g) => g.startsWith(id)), `expected ${id} in ${got.join(', ')}`);
  assert.equal(check().find((f) => f.id.startsWith('analog-on-discrete:'))!.severity, 'critical');
  // an equipment caution about servo motion answers the servo check
  useProjectStore.getState().setRecommendation({ ...useProjectStore.getState().recommendation!, cautions: ['Servo motion needs a drive with an indexer.'] });
  assert.ok(!ids().includes('spec-servo'));
});

test('drives: undersized VFD, unmonitored fault, commissioning values', () => {
  seedSampleProject();
  const el = useElectricalStore.getState();
  const d = el.design!;
  // M1 (2 HP, 3.4 A at 480 V) on a GS10 rated 2.7 A, no fault input
  el.setDesign({
    ...d,
    inputs: { ...d.inputs, motors: d.inputs.motors.map((m) => (m.tag === 'M1' ? { ...m, hp: 2, starter: 'vfd' as const } : m)) },
    components: [...d.components, { tag: 'VFD1', partNumber: 'GS13N-41P0', quantity: 1, function: 'Conveyor drive', motorTag: 'M1' }],
  }, 'generated', 'test');
  const f = check();
  const size = f.find((x) => x.id === 'drive:size:VFD1');
  assert.equal(size?.severity, 'critical', f.map((x) => x.id).join(', '));
  assert.ok(f.some((x) => x.id === 'drive:fault:VFD1'));
  assert.ok(f.some((x) => x.id === 'drive:commission:VFD1' && /P05\.03/.test(x.detail)));
  assert.ok(!f.some((x) => x.id === 'drive:sto:VFD1'), 'K1 in the motor branch is the safety stop');
});

test('drives: E-stop must remove torque (STO or contactor)', () => {
  seedSampleProject();
  const el = useElectricalStore.getState();
  const d = el.design!;
  const motors = d.inputs.motors.map((m) => (m.tag === 'M1' ? { ...m, starter: 'vfd' as const } : m));
  const base = d.components.filter((c) => !(c.motorTag === 'M1' && /contactor|overload/i.test(c.function)));
  const vfd = (fn: string) => ({ tag: 'VFD1', partNumber: 'GS23-41P0', quantity: 1, function: fn, motorTag: 'M1' });
  el.setDesign({ ...d, inputs: { ...d.inputs, motors }, components: [...base, vfd('Conveyor drive')] }, 'generated', 'test');
  const sto = check().find((x) => x.id === 'drive:sto:VFD1');
  assert.equal(sto?.severity, 'major');
  assert.match(sto!.fix, /STO1 and STO2/);
  el.setDesign({ ...d, inputs: { ...d.inputs, motors }, components: [...base, vfd('Conveyor drive, STO from safety relay')] }, 'generated', 'test');
  assert.ok(!ids().includes('drive:sto:VFD1'));
});

test('no safety reset is reported once (code rule), not again as a design warning', () => {
  seedSampleProject();
  const el = useElectricalStore.getState();
  const d = el.design!;
  const resetTag = d.components.find((c) => /safety reset/i.test(c.function))?.tag;
  el.setDesign({ ...d, components: d.components.filter((c) => c.tag !== resetTag) }, 'generated', null);
  const reset = check().filter((f) => /no reset pushbutton/i.test(f.title));
  assert.equal(reset.length, 1, JSON.stringify(reset.map((f) => f.id)));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
