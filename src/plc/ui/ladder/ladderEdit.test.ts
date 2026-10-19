/// <reference types="node" />
/**
 * Hand edits of the ladder: insert a rung above / below the selected one (it joins that rung's block), add a
 * contact right after the selected one or at the branch end, delete an item, delete and move rungs.
 * Run with:  npx tsx src/plc/ui/ladder/ladderEdit.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram } from '../../core/ladder';
import { deleteElement, deleteRung, insertContact, insertRung, moveRung } from './ladderEdit';

const p: LadderProgram = {
  rungs: [
    { id: 'a', comment: 'A', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'b', comment: 'B', block: 'cycle', branches: [[{ type: 'NO', address: 'X002' }, { type: 'NC', address: 'X003' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
  ],
  tags: [],
};

// Above / below / at the end; the new rung joins the block of the rung it was inserted beside.
const above = insertRung(p, 'b', 'above');
assert.deepEqual(above.program.rungs.map((r) => r.id), ['a', above.id, 'b']);
assert.equal(above.program.rungs[1].block, 'cycle');
const below = insertRung(p, 'a', 'below');
assert.deepEqual(below.program.rungs.map((r) => r.id), ['a', below.id, 'b']);
assert.equal(below.program.rungs[1].block, undefined);
const end = insertRung(p, null, 'below');
assert.equal(end.program.rungs[2].id, end.id);
assert.equal(p.rungs.length, 2, 'the original program is not changed');

// A contact right after the selected one, or at the end of the branch.
const r = p.rungs[1];
assert.deepEqual(insertContact(r, 0, 0, 'NC').branches[0].map((e) => e.type), ['NO', 'NC', 'NC']);
assert.deepEqual(insertContact(r, 0, 0, 'NC').branches[0][1], { type: 'NC', address: '' });
assert.deepEqual(insertContact(r, 0, null, 'NO').branches[0].map((e) => (e.type === 'NO' || e.type === 'NC' ? e.address : '')), ['X002', 'X003', '']);
assert.deepEqual(insertContact({ ...r, branches: [] }, 0, null, 'NO').branches, [[{ type: 'NO', address: '' }]]);

// Delete an item (an emptied branch goes), delete and move rungs.
assert.equal(deleteElement(p.rungs[0], 0, 0).branches.length, 0);
assert.deepEqual(deleteRung(p, 'a').rungs.map((x) => x.id), ['b']);
assert.deepEqual(moveRung(p, 'b', -1).rungs.map((x) => x.id), ['b', 'a']);
assert.equal(moveRung(p, 'a', -1), p, 'the first rung cannot move up');

console.log('ladderEdit tests passed');
