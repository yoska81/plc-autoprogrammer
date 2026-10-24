/// <reference types="node" />
/**
 * The program as flow diagrams: one per function; a step sequence as squares (steps) and diamonds (what each waits
 * for) with arrows and loops; every other rung as IF → THEN; every box linked to its rungs; any program (the app's,
 * an imported Yaskawa one, a big one in well under a second).
 * Run with:  npx tsx src/plc/flow/flowModel.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LadderElement, Rung } from '../core/ladder';
import { actionText, conditionLines, conditionText, diagramOf, flowMap, nodesOfRung, stepRegisters } from './flowModel';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { importProgramFiles } from '../import';
import { plcopen } from '../import/__fixtures__/bigPrograms';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const AT = (n: number): LadderElement => ({ type: 'CMP', left: 'DS1150', op: '==', right: String(n) });
const names = new Map([['X001', 'Part present'], ['X002', 'Clamp closed'], ['X003', 'Process done'], ['C1', 'Run'], ['Y001', 'Clamp valve'], ['Y002', 'Process motor']]);
const nameOf = (a: string) => names.get(a) ?? a;

// A cycle as the app writes it: step 0 idle, 10 wait for part, 20 clamp, 30 process, back to 10
const cycle: Rung[] = [
  { id: 'r0', block: 'cycle', comment: 'Cycle not running: step 0 (idle)', branches: [[NC('C1')]], outputs: [{ type: 'COPY', source: '0', dest: 'DS1150' }] },
  { id: 'r1', block: 'cycle', comment: 'Cycle start: step 10 — Wait for part', branches: [[NO('C1'), AT(0)]], outputs: [{ type: 'COPY', source: '10', dest: 'DS1150' }] },
  { id: 'r4', block: 'cycle', comment: 'Step 30 — Process: done when X003 ON → step 10', branches: [[NO('C1'), AT(30), NO('X003')]], outputs: [{ type: 'COPY', source: '10', dest: 'DS1150' }] },
  { id: 'r3', block: 'cycle', comment: 'Step 20 — Clamp: done when X002 ON → step 30', branches: [[NO('C1'), AT(20), NO('X002')]], outputs: [{ type: 'COPY', source: '30', dest: 'DS1150' }] },
  { id: 'r2', block: 'cycle', comment: 'Step 10 — Wait for part: done when X001 ON → step 20', branches: [[NO('C1'), AT(10), NO('X001')]], outputs: [{ type: 'COPY', source: '20', dest: 'DS1150' }] },
  { id: 'r5', block: 'cycle', comment: 'Clamp: in steps 20, 30', branches: [[AT(20)], [AT(30)]], outputs: [{ type: 'OUT', address: 'Y001' }] },
  { id: 'r6', block: 'cycle', comment: 'Process: in step 30', branches: [[AT(30)]], outputs: [{ type: 'OUT', address: 'Y002' }] },
  { id: 'r7', block: 'cycle', comment: 'Cycle lamp', branches: [[NO('C1')]], outputs: [{ type: 'OUT', address: 'Y005' }] },
];
assert.deepEqual(stepRegisters(cycle), ['DS1150']);
const d = diagramOf('cycle', 'Cycle', '', cycle, nameOf);
assert.equal(d.register, 'DS1150');
const steps = d.nodes.filter((n) => n.kind === 'step');
assert.deepEqual(steps.map((n) => n.title), ['0 · Idle', '10 · Wait for part', '20 · Clamp', '30 · Process'], 'the steps, in order, named from their rungs');
assert.ok(steps[0].y < steps[1].y && steps[1].y < steps[2].y, 'top to bottom');
assert.deepEqual(steps.find((n) => n.step === 20)!.lines, ['Turn ON Clamp valve'], 'what a step turns on');
assert.deepEqual(steps.find((n) => n.step === 30)!.lines, ['Turn ON Clamp valve', 'Turn ON Process motor']);
const dec20 = d.nodes.find((n) => n.kind === 'decision' && n.rungIds[0] === 'r3')!;
assert.deepEqual(dec20.lines, ['Run ON', 'AND Clamp closed ON'], 'what the step waits for, the step compare left out');
assert.match(dec20.title, /→ 30 · Process/);
assert.ok(d.edges.some((e) => e.from === dec20.id && e.to === 'cycle:step:30' && e.label === 'YES' && !e.back), 'YES ↓ to the next step');
const loop = d.edges.find((e) => e.from.includes(':r4') && e.to === 'cycle:step:10')!;
assert.ok(loop.back && loop.points.length === 4, 'the loop back to step 10 drawn on the left');
assert.ok(d.nodes.some((n) => n.kind === 'any' && n.rungIds[0] === 'r0' && n.lines.join() === 'NOT Run'), 'from any step: not running → idle');
const lamp = d.nodes.filter((n) => n.rungIds.includes('r7'));
assert.deepEqual(lamp.map((n) => n.kind), ['decision', 'action'], 'a rung outside the sequence: IF → THEN');
assert.ok(d.nodes.every((n) => n.rungIds.every((id) => cycle.some((r) => r.id === id))), 'every box linked to its rungs');

// several paths: what all need said once, what differs under ANY of
assert.deepEqual(conditionLines([[NO('X002'), NO('X003'), NC('C5')], [NO('C1'), NO('X003'), NC('C5')]], nameOf),
  ['ANY of:', '• Clamp closed ON', '• Run ON', 'AND Process done ON', 'AND NOT C5']);
assert.deepEqual(conditionLines([[NO('X001')], [NO('X002')]], nameOf), ['Part present ON', '— OR —', 'Clamp closed ON'], 'nothing shared: the paths one after the other');

// plain words
assert.equal(conditionText({ type: 'CMP', left: 'DS1', op: '>=', right: '10' }, nameOf), 'DS1 ≥ 10');
assert.equal(conditionText(NC('X001'), nameOf), 'NOT Part present');
assert.equal(actionText({ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }, nameOf), 'Wait 5 s (T1)');
assert.equal(actionText({ type: 'COPY', source: '4', dest: 'DS1101' }, (a) => (a === 'DS1101' ? 'Machine_State' : a)), 'Machine_State = 4');

// the example project: every function its diagram, every rung in it, the map laid out without overlaps
seedSampleProject();
const p = collectProject();
const pName = (a: string) => p.labels.get(a) ?? p.ladder.tags.find((t) => t.address === a)?.nickname ?? a;
const m = flowMap(p.ladder, pName);
assert.equal(m.diagrams.length, new Set(p.ladder.rungs.map((r) => r.block ?? '')).size, 'one diagram per function');
assert.deepEqual(m.diagrams.map((x) => x.name).slice(0, 3), ['Safety & modes', 'Alarms', 'Conveyor']);
for (const r of p.ladder.rungs) assert.ok(nodesOfRung(m, r.id).length > 0, `rung ${r.id} is on the diagram`);
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const a of m.diagrams) for (const b of m.diagrams) if (a !== b) assert.ok(!overlap(a, b), `${a.name} and ${b.name} apart`);
assert.ok(m.diagrams.flatMap((x) => x.nodes).some((n) => n.lines.some((l) => /E-stop|Safety/i.test(l))), 'conditions by their names');

// an imported Yaskawa program (MPE720 .YMW7)
const ymw = new Uint8Array(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'import', '__fixtures__', 'demo_mp.YMW7')));
const y = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: ymw }]).program;
const ym = flowMap(y.program, (a) => y.program.tags.find((t) => t.address === a)?.nickname || a);
assert.ok(ym.diagrams.length >= 1 && y.program.rungs.every((r) => nodesOfRung(ym, r.id).length > 0), 'the Yaskawa program, every rung drawn');

// a big program: thousands of rungs, drawn in well under a second
const big = importProgramFiles([{ name: 'big.xml', text: plcopen(200, 400) }]).program.program;
const t0 = performance.now();
const bm = flowMap(big, (a) => a);
const ms = performance.now() - t0;
assert.ok(big.rungs.length > 1000 && ms < 1500, `${big.rungs.length} rungs in ${ms.toFixed(0)} ms`);
assert.ok(bm.diagrams.length > 10, `${bm.diagrams.length} functions`);

console.log(`flowModel.test: all passed (example ${m.diagrams.length} functions; Yaskawa ${ym.diagrams.length}; big ${big.rungs.length} rungs, ${bm.diagrams.length} functions in ${ms.toFixed(0)} ms)`);
