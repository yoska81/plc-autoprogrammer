/// <reference types="node" />
/**
 * Design review tests. Run with:  npx tsx src/review/review.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject, LADDER } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { stagesNow } from '../spec/useStages';
import { useProjectStore } from '../store/useProjectStore';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useSpecStore } from '../store/useSpecStore';
import { useReviewStore } from './useReviewStore';
import { runChecks } from './checks';
import { projectSummary, REVIEW_SCHEMA } from './reviewAI';
import { reviewRows } from './report';
import { acceptCriticalForConstruction, openCriticalFindings } from './actions';
import { openCounts } from './useReviewStore';
import { designReviewTable } from '../deliverables/docs/manual';
import { pageRoute } from './types';
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

const check = () => runChecks({ p: collectProject(), stages: stagesNow(), modules: useProjectStore.getState().modules });
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
