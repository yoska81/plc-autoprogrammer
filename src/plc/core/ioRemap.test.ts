/// <reference types="node" />
/**
 * I/O address remap: a delete shifts the points after it (a chain), moving a point swaps two addresses, a
 * deleted point is "gone" even when a new point now has its address, unresolved points are ignored.
 * Run with:  npx tsx src/plc/core/ioRemap.test.ts
 */
import assert from 'node:assert/strict';
import { ioRemap, remapAddress, remapIsEmpty } from './ioRemap';

const m = (o: Record<string, string>) => new Map(Object.entries(o));

// Delete the first input: X002 → X001 and X003 → X002 (a chain), applied in one pass.
const del = ioRemap(m({ start: 'X001', stop: 'X002', pe: 'X003', motor: 'Y001' }), m({ stop: 'X001', pe: 'X002', motor: 'Y001' }));
assert.deepEqual([...del.moved], [['X002', 'X001'], ['X003', 'X002']]);
assert.deepEqual([...del.gone], [['X001', 'start']]);
assert.equal(del.added.size, 0);
// One pass over the operands: each looked up once in the old table.
const ops = ['X001', 'X002', 'X003', 'Y001'];
assert.deepEqual(ops.map((a) => remapAddress(a, del)), ['X001', 'X001', 'X002', 'Y001'], 'X001 itself is gone (flagged by the caller), not moved');
assert.ok(del.gone.has('X001'));

// Two points swap places: both move, neither is lost.
const swap = ioRemap(m({ a: 'X001', b: 'X002' }), m({ a: 'X002', b: 'X001' }));
assert.deepEqual(['X001', 'X002'].map((x) => remapAddress(x, swap)), ['X002', 'X001']);

// A deleted point whose address a NEW point now has: gone, not moved; the new point is in `added`.
const replaced = ioRemap(m({ guard: 'X004' }), m({ horn: 'X004' }));
assert.deepEqual([[...replaced.gone], [...replaced.added], replaced.moved.size], [[['X004', 'guard']], [['horn', 'X004']], 0]);

// Case and blanks: addresses compared as written in any case; unresolved ('') points ignored.
const cased = ioRemap(m({ a: 'x001', b: '' }), m({ a: 'X001', b: 'X002' }));
assert.ok(remapIsEmpty(cased));
assert.equal(remapAddress('y009', cased), 'y009');

console.log('ioRemap tests passed');
