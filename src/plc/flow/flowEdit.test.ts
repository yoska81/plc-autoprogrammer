/// <reference types="node" />
/**
 * Edits from the flow diagram, as ladder: a step added between two (the arrows re-linked, the cycle's guards kept),
 * deleted (the arrows go on past it), renamed; rungs edited beside a box put back in their place; and what changed,
 * in plain words. The edited cycle runs in the simulator the way the diagram says.
 * Run with:  npx tsx src/plc/flow/flowEdit.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderElement, LadderProgram, Rung } from '../core/ladder';
import { addStepAfter, deleteStep, flowChanges, mergeRungs, renameStep, stepsOf } from './flowEdit';
import { diagramOf } from './flowModel';
import { createSimulator } from '../sim/engine';

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const AT = (n: number): LadderElement => ({ type: 'CMP', left: 'DS1150', op: '==', right: String(n) });
const GO = (n: number) => ({ type: 'COPY' as const, source: String(n), dest: 'DS1150' });
const cycle: Rung[] = [
  { id: 'r0', block: 'cycle', comment: 'Cycle not running: step 0 (idle)', branches: [[NC('C1')]], outputs: [GO(0)] },
  { id: 'r1', block: 'cycle', comment: 'Cycle start: step 10 — Wait for part', branches: [[NO('C1'), AT(0)]], outputs: [GO(10)] },
  { id: 'r4', block: 'cycle', comment: 'Step 30 — Process: done when X003 ON → step 10', branches: [[NO('C1'), NO('C2'), AT(30), NO('X003')]], outputs: [GO(10)] },
  { id: 'r3', block: 'cycle', comment: 'Step 20 — Clamp: done when X002 ON → step 30', branches: [[NO('C1'), NO('C2'), AT(20), NO('X002')]], outputs: [GO(30)] },
  { id: 'r2', block: 'cycle', comment: 'Step 10 — Wait for part: done when X001 ON → step 20', branches: [[NO('C1'), NO('C2'), AT(10), NO('X001')]], outputs: [GO(20)] },
  { id: 'r5', block: 'cycle', comment: 'Clamp: in steps 20, 30', branches: [[AT(20)], [AT(30)]], outputs: [{ type: 'OUT', address: 'Y001' }] },
  { id: 'r6', block: 'cycle', comment: 'Process: in step 30', branches: [[AT(30)]], outputs: [{ type: 'OUT', address: 'Y002' }] },
];
const prog: LadderProgram = { rungs: cycle, tags: [] };
const names = new Map([['X001', 'Part present'], ['X002', 'Clamp closed'], ['X003', 'Process done'], ['C1', 'Run'], ['C2', 'Safe'], ['Y001', 'Clamp valve']]);
const nameOf = (a: string) => names.get(a) ?? a;

// add a step between 20 and 30: 25, the arrows re-linked, the guards (Run, Safe) kept
const a = addStepAfter(prog, 'DS1150', 20, 'Check clamp');
assert.ok(!('error' in a), JSON.stringify(a));
const p1 = (a as { program: LadderProgram }).program;
assert.deepEqual(stepsOf(p1, 'DS1150'), [0, 10, 20, 25, 30]);
const r3 = p1.rungs.find((r) => r.id === 'r3')!;
assert.deepEqual(r3.outputs, [GO(25)], 'step 20 now goes to 25');
assert.match(r3.comment, /→ step 25/);
const added = p1.rungs.find((r) => r.id === (a as { focusRung: string }).focusRung)!;
assert.deepEqual(added.branches, [[NO('C1'), NO('C2'), AT(25)]], 'the new step: the cycle\'s guards, its step');
assert.deepEqual(added.outputs, [GO(30)], 'and on to 30');
assert.ok(p1.rungs.indexOf(added) < p1.rungs.indexOf(r3), 'written before the way out of 20 (each step lasts a scan)');
const d = diagramOf('cycle', 'Cycle', '', p1.rungs, nameOf);
assert.deepEqual(d.nodes.filter((n) => n.kind === 'step').map((n) => n.title), ['0 · Idle', '10 · Wait for part', '20 · Clamp', '25 · Check clamp', '30 · Process'], 'the diagram shows it in its place');

// the edited cycle runs: 10 → 20 → 25 → 30 → 10
const sim = createSimulator(p1);
sim.write('C1', true); sim.write('C2', true);
sim.run(50);
assert.equal(sim.readWord('DS1150'), 10);
sim.setInput('X001', true); sim.run(50);
assert.equal(sim.readWord('DS1150'), 20);
sim.setInput('X001', false); sim.setInput('X002', true); sim.run(50);
assert.equal(sim.readWord('DS1150'), 30, 'through 25 (at once) to 30');
sim.setInput('X003', true); sim.run(50);
assert.equal(sim.readWord('DS1150'), 10, 'and the loop back');

// step 20 with a timeout way out to a fault step (written first) and a way out shared with step 10 (OR branches): only
// 20's way on to 30 goes to the new step; the timeout still goes to 900, step 10's branch still to 30
const busy: LadderProgram = { tags: [], rungs: [
  { id: 'rt', block: 'cycle', comment: 'Step 20 — Clamp: timeout → step 900', branches: [[AT(20), NO('T1')]], outputs: [GO(900)] },
  ...cycle,
  { id: 'rs', block: 'cycle', comment: 'Skip: → step 30', branches: [[AT(10), NO('X008')], [AT(20), NO('X009')]], outputs: [GO(30)] },
] };
const b = (addStepAfter(busy, 'DS1150', 20, 'Check') as { program: LadderProgram }).program;
assert.deepEqual(b.rungs.find((r) => r.id === 'rt')!.outputs, [GO(900)], 'the timeout way out not re-linked');
assert.deepEqual(b.rungs.find((r) => r.id === 'r3')!.outputs, [GO(25)]);
const rs = b.rungs.find((r) => r.id === 'rs')!;
assert.deepEqual([rs.branches, rs.outputs], [[[AT(10), NO('X008')]], [GO(30)]], 'step 10\'s branch still goes to 30');
assert.ok(b.rungs.some((r) => r.id !== 'rs' && JSON.stringify(r.branches) === JSON.stringify([[AT(20), NO('X009')]]) && JSON.stringify(r.outputs) === JSON.stringify([GO(25)])), 'step 20\'s branch of it to 25');
assert.equal(new Set(b.rungs.map((r) => r.id)).size, b.rungs.length, 'rung ids unique');
// deleting step 20: the steps that went to it go on to 30 (its way on), not to the fault step
assert.deepEqual((deleteStep(busy, 'DS1150', 20) as { program: LadderProgram }).program.rungs.find((r) => r.id === 'r2')!.outputs, [GO(30)]);

// no room between two numbers
const tight: LadderProgram = { rungs: [
  { id: 't1', comment: 'Step 10 — A: done → step 11', branches: [[AT(10), NO('X001')]], outputs: [GO(11)] },
  { id: 't2', comment: 'Step 11 — B: done → step 10', branches: [[AT(11), NO('X002')]], outputs: [GO(10)] },
], tags: [] };
assert.match((addStepAfter(tight, 'DS1150', 10, 'x') as { error: string }).error, /no free step number between 10 and 11/);
// after the last step (it loops back): the next number up
assert.deepEqual(stepsOf((addStepAfter(prog, 'DS1150', 30, 'Unload') as { program: LadderProgram }).program, 'DS1150'), [0, 10, 20, 30, 40]);

// delete step 20: 10 goes on to 30; step 20's way out gone; what it did (Clamp in 20) keeps step 30
const del = deleteStep(prog, 'DS1150', 20);
const p2 = (del as { program: LadderProgram }).program;
assert.deepEqual(stepsOf(p2, 'DS1150'), [0, 10, 30]);
assert.deepEqual(p2.rungs.find((r) => r.id === 'r2')!.outputs, [GO(30)]);
assert.ok(!p2.rungs.some((r) => r.id === 'r3'));
assert.deepEqual(p2.rungs.find((r) => r.id === 'r5')!.branches, [[AT(30)]]);
const sim2 = createSimulator(p2);
sim2.write('C1', true); sim2.write('C2', true); sim2.setInput('X001', true); sim2.run(50);
assert.equal(sim2.readWord('DS1150'), 30, 'without step 20 the cycle goes from 10 to 30');

// rename
const p3 = renameStep(prog, 'DS1150', 20, 'Clamp the part').program;
assert.equal(p3.rungs.find((r) => r.id === 'r3')!.comment, 'Step 20 — Clamp the part: done when X002 ON → step 30');
assert.ok(diagramOf('cycle', 'Cycle', '', p3.rungs, nameOf).nodes.some((n) => n.title === '20 · Clamp the part'));

// rungs edited beside a box: back in their place, a new one after them, in their function
const extra: Rung = { id: 'rx', comment: 'New', branches: [[NO('X009')]], outputs: [{ type: 'OUT', address: 'Y009' }] };
const m = mergeRungs(prog, ['r5'], [{ ...cycle[5], outputs: [{ type: 'OUT', address: 'Y003' }] }, extra]);
assert.deepEqual(m.rungs.map((r) => r.id), ['r0', 'r1', 'r4', 'r3', 'r2', 'r5', 'rx', 'r6']);
assert.equal(m.rungs.find((r) => r.id === 'rx')!.block, 'cycle');
assert.deepEqual(mergeRungs(prog, ['r5'], []).rungs.map((r) => r.id), ['r0', 'r1', 'r4', 'r3', 'r2', 'r6'], 'deleted beside the box: gone');

// what changed, in plain words
const ch = flowChanges(prog, m, nameOf);
assert.deepEqual(ch.map((c) => c.kind), ['changed', 'added']);
assert.deepEqual(ch[0].before.slice(-1), ['  Turn ON Clamp valve']);
assert.deepEqual(ch[0].after.slice(-1), ['  Turn ON Y003']);
assert.deepEqual(ch[1].after, ['IF', '  X009 ON', 'THEN', '  Turn ON Y009']);
assert.deepEqual(flowChanges(prog, p2, nameOf).filter((c) => c.kind === 'removed').map((c) => c.rungId), ['r3']);

console.log('flowEdit.test: all passed');
