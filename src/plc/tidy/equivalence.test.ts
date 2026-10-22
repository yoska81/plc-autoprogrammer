/// <reference types="node" />
/**
 * The behaviour check behind "Reorganize": a reorder that keeps every dependency gives 0 differences; a change of
 * behaviour (one scan late, a contact inverted, a timer preset) is caught.
 * Run with:  npx tsx src/plc/tidy/equivalence.test.ts
 */
import assert from 'node:assert/strict';
import { LADDER, seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import type { LadderProgram } from '../core/ladder';
import { checkEquivalence, equivalenceSummary, programInputs, simOptionsFor } from './equivalence';
import { getProfile } from '../core/profiles';
import { reorder, rungDeps } from './deps';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
seedSampleProject();
const snap = collectProject();
// The example's machine: the plant model answers the outputs (cylinder sensors, conveyor parts).
const plant = snap.io.map((x) => ({ address: snap.addresses.get(x.id) ?? '', description: x.description, type: x.type, category: x.category }));
const quick = { random: 60, steps: 40, plant, plantSequences: 40 };

// The example against itself, and against a reorder that keeps every dependency (reversed preference): same.
{
  const t0 = performance.now();
  const same = checkEquivalence(LADDER, structuredClone(LADDER), quick);
  assert.deepEqual(same.differences, [], equivalenceSummary(same));
  assert.ok(same.sequences > 60 && same.observed > 5, equivalenceSummary(same));
  const moved = { ...LADDER, rungs: reorder(LADDER.rungs, (_r, i) => -i) };
  assert.notDeepEqual(moved.rungs.map((r) => r.id), LADDER.rungs.map((r) => r.id), 'something moved');
  const r = checkEquivalence(LADDER, moved, quick);
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
  assert.match(equivalenceSummary(r), /^Same behaviour in [\d,]+ test sequences \(0 differences\)\. Details: [\d,]+ with one input changed, [\d,]+ random[^;]*; [\d,]+ scans, [\d,]+ values compared every scan\./);
  console.log(`  example: ${equivalenceSummary(r)} (${Math.round(performance.now() - t0)} ms for both checks)`);
}

// Read-before-write matters: a reader moved before its writer is one scan late, and that is caught.
{
  const p: LadderProgram = { tags: [], rungs: [
    { id: 'a', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'b', comment: '', branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
  ] };
  assert.deepEqual(programInputs(p), ['X001']);
  assert.deepEqual(reorder(p.rungs, (r) => (r.id === 'b' ? 0 : 1)).map((r) => r.id), ['a', 'b'], 'the dependency keeps the writer first');
  const swapped = { ...p, rungs: [p.rungs[1], p.rungs[0]] };
  const r = checkEquivalence(p, swapped, quick);
  assert.ok(r.differences.length > 0 && r.differences[0].address === 'Y001', equivalenceSummary(r));
  assert.match(equivalenceSummary(r), /^Different behaviour: Y001 is (true|false) in the original but (true|false) in the reorganized program/);
}

// A contact inverted, a timer preset changed: caught.
{
  const inverted: LadderProgram = structuredClone(LADDER);
  const rung = inverted.rungs.find((x) => x.outputs.some((o) => o.type === 'OUT' && /^Y/.test(o.address)) && x.branches[0]?.some((e) => e.type === 'NO'))!;
  const el = rung.branches[0].find((e) => e.type === 'NO')!;
  el.type = 'NC';
  assert.ok(checkEquivalence(LADDER, inverted, quick).differences.length > 0, 'an inverted contact is caught');
  const timer: LadderProgram = structuredClone(LADDER);
  // The rate window timer (10 s, always running); a run-hours timer the sequences never reach shows as not exercised.
  const t = timer.rungs.flatMap((x) => x.outputs).find((o) => o.type === 'TMR' && o.address === 'T3');
  if (t && t.type === 'TMR') {
    t.preset = String(Number(t.preset) + 1);
    assert.ok(checkEquivalence(LADDER, timer, quick).differences.length > 0, 'a timer preset change is caught');
  }
}

// A kept instruction of another PLC (RAW) is a barrier: nothing moves across it, and it is reported.
{
  const p: LadderProgram = { tags: [], rungs: [
    { id: 'r1', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'raw', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'RAW', text: 'MOV 5 MW100', vendor: 'yaskawa-mpe720' } as never] },
    { id: 'r3', comment: '', branches: [[{ type: 'NO', address: 'X003' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
  ] };
  assert.ok(rungDeps(p.rungs[1]).barrier);
  assert.deepEqual(reorder(p.rungs, (r) => (r.id === 'r3' ? 0 : 1)).map((r) => r.id), ['r1', 'raw', 'r3']);
  assert.equal(checkEquivalence(p, p, quick).notSimulated, 1);
}

// The lean simulator the check runs (no per-contact power, no change list) keeps the same memory as the full one.
{
  const sim = await import('../sim/engine');
  const rnd = (() => { let a = 7; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296); })();
  const full = sim.createSimulator(LADDER), lean = sim.createSimulator(LADDER, { lean: true });
  const ins = programInputs(LADDER);
  for (let k = 0; k < 3000; k++) {
    if (rnd() < 0.2) { const i = ins[Math.floor(rnd() * ins.length)]; const v = rnd() < 0.5; full.write(i, v); lean.write(i, v); }
    const dt = rnd() < 0.05 ? 2000 : 10;
    full.step(dt); lean.step(dt);
    assert.deepEqual([...lean.state.bits].sort(), [...full.state.bits].sort(), `bits at step ${k}`);
    assert.deepEqual([...lean.state.words].sort(), [...full.state.words].sort(), `words at step ${k}`);
  }
}

// The project's PLC: its scan rules go to the simulators by profile id (an id can go to the worker; rules cannot).
{
  for (const id of ['click', 'logix', 'siemens-s7', 'yaskawa-mp']) {
    assert.equal(getProfile(id).id, id, `a real profile: ${id}`);
    const sem = getProfile(id).simSemantics;
    assert.equal(simOptionsFor(id)?.semantics, sem, id);
  }
  assert.equal(simOptionsFor(undefined), undefined);
  const r = checkEquivalence(LADDER, LADDER, { random: 5, steps: 10, profileId: 'logix' });
  assert.deepEqual(r.differences, []);
}

console.log('tidy equivalence tests passed');
