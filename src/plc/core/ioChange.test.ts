/// <reference types="node" />
/**
 * Deleting an I/O point never silently changes the program (side manager's QA, item 1). In the sample conveyor,
 * deleting I004 (the photo-eye, X004) moves "Pusher extended" from X005 to X004. Before this fix, the part
 * counter then counted the pusher. Now every operand follows its point. The part counter's contact is marked
 * "?X004", the checker reports an error, the confirmation lists what used the point, and Undo puts everything
 * back. Also covered: the pure remap (a chain and a swap) and the motion / cycle operands.
 * Run with:  npx tsx src/plc/core/ioChange.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { useIOStore } from '../../store/useIOStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useProjectStore } from '../../store/useProjectStore';
import { deletePointWithUndo, ioAddresses, ioUsesOf, lastIoUndo, undoIoDelete } from './ioChange';
import { ioRemap } from './ioRemap';
import { remapProgram } from './remapProgram';
import { validateProgram } from './validate';
import { getProfile } from './profiles';
import type { LadderProgram } from './ladder';

// 1. Pure: a chain (X003 → X002 while X002 → X001) and a swap come out right in one pass; a deleted point is marked.
const prev = new Map([['a', 'X001'], ['b', 'X002'], ['c', 'X003'], ['y1', 'Y001'], ['y2', 'Y002']]);
const next = new Map([['b', 'X001'], ['c', 'X002'], ['y1', 'Y002'], ['y2', 'Y001']]);
const prog: LadderProgram = {
  rungs: [
    { id: 'r1', comment: 'a', branches: [[{ type: 'NO', address: 'X001' }], [{ type: 'NC', address: 'X002' }, { type: 'NO', address: 'X003' }]], outputs: [{ type: 'OUT', address: 'Y001' }, { type: 'SET', address: 'Y002' }] },
    { id: 'r2', comment: 'b', branches: [[{ type: 'CMP', left: 'DS1', op: '>', right: '0' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '10', resetAddress: 'X003' }, { type: 'MATH', dest: 'DS2', expression: 'DS1 + X002' }] },
  ],
  tags: [{ address: 'X001', nickname: 'Gone', comment: '' }, { address: 'X002', nickname: 'B', comment: '' }],
  motion: { axes: [{ axis: 1, name: 'A', pulse: 'Y001', direction: 'Y002', position: 'DD1', velocity: 'DD2', pulsesPerUnit: 1, units: 'mm', limitPos: 'X003' }], instructions: [], counters: [{ name: 'E', channels: ['X002', 'X003'], quadrature: true, withZ: false, count: 'DD3' }] },
  sequence: { steps: [{ name: 's', actions: [], waitFor: [{ input: 'X003', on: true }], timeoutSec: null }], questions: [], source: 'rules' },
};
const r = remapProgram(prog, ioRemap(prev, next));
assert.deepEqual(r.program.rungs[0].branches, [[{ type: 'NO', address: '?X001' }], [{ type: 'NC', address: 'X001' }, { type: 'NO', address: 'X002' }]], 'chain: X002 → X001, X003 → X002; the deleted X001 marked');
assert.deepEqual(r.program.rungs[0].outputs.map((o) => ('address' in o ? o.address : '')), ['Y002', 'Y001'], 'swap: Y001 ↔ Y002');
assert.deepEqual(r.program.rungs[1].outputs, [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '10', resetAddress: 'X002' }, { type: 'MATH', dest: 'DS2', expression: 'DS1 + X001' }], 'counter reset and MATH operands');
assert.deepEqual(r.program.tags, [{ address: 'X001', nickname: 'B', comment: '' }], "the deleted point's nickname dropped, the moved one follows");
assert.deepEqual([r.program.motion!.axes[0].pulse, r.program.motion!.axes[0].direction, r.program.motion!.axes[0].limitPos, ...r.program.motion!.counters[0].channels], ['Y002', 'Y001', 'X002', 'X001', 'X002'], 'motion operands');
assert.equal(r.program.sequence!.steps[0].waitFor[0].input, 'X002', 'cycle waits');
assert.deepEqual(r.deleted, [{ rungId: 'r1', address: 'X001' }]);
const profile = getProfile('click');
const errs = validateProgram(r.program, profile, new Set(['X001', 'X002', 'Y001', 'Y002'])).filter((i) => i.severity === 'error').map((i) => i.message);
assert.ok(errs.some((m) => /used X001, whose I\/O point was deleted/.test(m)), errs.join(' | '));
// An I/O operand with no point behind it is an error (it would drive whatever gets that address next).
assert.ok(validateProgram(prog, profile, new Set(['X001'])).some((i) => i.severity === 'error' && /X002 is not assigned to any point/.test(i.message)));

// 2. The sample conveyor: delete the photo-eye.
seedSampleProject();
const io = useIOStore.getState().projectIO;
const eye = io.find((p) => /photo-?eye/i.test(p.description))!;
const pusherExt = io.find((p) => /pusher extended/i.test(p.description))!;
const before = ioAddresses(io);
assert.deepEqual([before.get(eye.id), before.get(pusherExt.id)], ['X004', 'X005']);
const counterRung = () => useProgramStore.getState().ladder.rungs.find((g) => /^Part counter/.test(g.comment))!;
assert.deepEqual(counterRung().branches, [[{ type: 'NO', address: 'X004' }]]);
const pusherRungs = useProgramStore.getState().ladder.rungs.filter((g) => JSON.stringify(g).includes('"X005"')).map((g) => g.id);
assert.ok(pusherRungs.length > 0);
const ladderBefore = useProgramStore.getState().ladder;

// The confirmation says what uses it.
const uses = ioUsesOf(eye.id);
assert.ok(uses.some((u) => /Part counter/.test(u)), uses.join(' | '));

const messages = deletePointWithUndo(eye.id);
assert.equal(lastIoUndo(), `Delete ${eye.id} ${eye.description}`);
const after = ioAddresses(useIOStore.getState().projectIO);
assert.equal(after.get(pusherExt.id), 'X004', 'Pusher extended now on X004');
assert.deepEqual(counterRung().branches, [[{ type: 'NO', address: '?X004' }]], 'the part counter does not count the pusher');
for (const id of pusherRungs) assert.ok(JSON.stringify(useProgramStore.getState().ladder.rungs.find((g) => g.id === id)).includes('"X004"'), 'the pusher rungs follow it to X004');
assert.ok(messages.some((m) => /operands? moved/.test(m)) && messages.some((m) => /used X004, now deleted/.test(m)), messages.join(' | '));
const { plcId } = useProjectStore.getState();
const issues = validateProgram(useProgramStore.getState().ladder, getProfile(plcId), new Set([...after.values()]));
assert.ok(issues.some((i) => i.severity === 'error' && i.rungId === counterRung().id && /used X004, whose I\/O point was deleted/.test(i.message)), 'the checker blocks it');

// Undo: the list, the program, the addresses as they were.
assert.equal(undoIoDelete(), true);
assert.deepEqual(useIOStore.getState().projectIO, io);
assert.equal(useProgramStore.getState().ladder, ladderBefore);
assert.equal(lastIoUndo(), null);
assert.equal(undoIoDelete(), false);

// A plain edit that moves nothing leaves the program alone.
useIOStore.getState().updateDescription(eye.id, 'Part at end photo-eye (PE1)');
assert.equal(useProgramStore.getState().ladder, ladderBefore);

console.log('ioChange tests passed');
