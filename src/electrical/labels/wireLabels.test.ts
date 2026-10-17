/// <reference types="node" />
/**
 * Wire-number labels cover every wire number of the wire list: power (L1…, 1L1…, M1-T1…), control
 * (24+, 0V), every I/O wire (X…, Y…), safety (24+S, S11…), each with one marker per conductor end,
 * in natural order; every field cable gets a tag at both ends. The label-printer PDF prints each copy.
 * Run with:  npx tsx src/electrical/labels/wireLabels.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../../preview/sampleProject';
import { getPart } from '../catalog';
import { cableSchedule, naturalCompare, wireNumbers, type DrawingContext } from '../derive';
import { buildLabels } from '../labels';
import { expandCopies } from './layout';

const ctx: DrawingContext = {
  projectName: 'test', design: DESIGN, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
};

const labels = buildLabels(ctx);
const wireLabels = labels.filter((l) => l.kind === 'wire');

// Every unique wire number of the wire list, once, with 2 markers per conductor.
const conductors = new Map<string, number>();
for (const w of wireNumbers(ctx)) if (w.wire) conductors.set(w.wire, (conductors.get(w.wire) ?? 0) + 1);
assert.deepEqual(wireLabels.map((l) => l.code).sort(), [...conductors.keys()].sort(), 'one wire label per wire number');
for (const l of wireLabels) assert.equal(l.copies, 2 * conductors.get(l.code)!, `${l.code}: both ends of every conductor`);
assert.equal(new Set(wireLabels.map((l) => l.code)).size, wireLabels.length, 'no duplicate wire labels');

// Natural order (X2 before X10).
const codes = wireLabels.map((l) => l.code);
assert.deepEqual(codes, [...codes].sort(naturalCompare), 'wire labels in natural order');

// The classes the user expects to find, not only 24+.
const has = (re: RegExp) => codes.some((c) => re.test(c));
for (const [what, re] of [
  ['incoming power L1/L2/L3', /^L[123]$/], ['power bus 1L1…', /^1L\d$/], ['motor leads M1-T1…', /^M\d+-T\d$/],
  ['24 V supply', /^24\+$/], ['0 V common', /^0V$/], ['safety 24+S', /^24\+S$/], ['safety circuit S11/S12…', /^S\d\d/],
  ['PLC inputs X…', /^X\d+/], ['PLC outputs Y…', /^Y\d+/], ['protective earth', /^PE$/],
] as const) assert.ok(has(re), `wire labels include ${what}`);
for (const w of DESIGN.ioWiring) assert.ok(codes.some((c) => c === w.address || c.startsWith(w.address)), `I/O wire ${w.address} labelled`);

// Field cables: a tag at each end.
const cables = cableSchedule(ctx);
const cableLabels = labels.filter((l) => l.kind === 'cable');
assert.deepEqual(cableLabels.map((l) => l.code).sort(), cables.map((c) => c.tag).sort(), 'one cable tag per field cable');
assert.ok(cableLabels.every((l) => l.copies === 2), 'cable tags at both ends');

// Printing every copy prints every marker (the label-printer PDF has one page per entry of this list).
const printed = expandCopies(wireLabels, true);
assert.equal(printed.length, [...conductors.values()].reduce((s, n) => s + 2 * n, 0));
assert.equal(new Set(printed.map((l) => l.code)).size, conductors.size, 'every wire number is printed');

console.log(`wireLabels: OK (${wireLabels.length} wire numbers, ${printed.length} markers, ${cableLabels.length} cable tags)`);
