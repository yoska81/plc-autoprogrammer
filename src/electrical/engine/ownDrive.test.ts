/// <reference types="node" />
/**
 * Motors read from an imported program's I/O (project 1317): the same name in two I/O groups is one motor, and a
 * motor with its own "Driver … fault" input has its own drive on the machine (type unknown) — shown as that drive with
 * its commands and fault wired to it, never a reversing DOL starter or a VFD invented for it.
 * Run with:  npx tsx src/electrical/engine/ownDrive.test.ts
 */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './index';
import { exampleInput, ctxFor } from '../improve/testDesign';
import { getPart } from '../catalog';
import { billOfMaterials, designWarnings } from '../derive';

const base = exampleInput('480VAC-3PH');
const pts: [string, 'input' | 'output', string][] = [
  ['Conveyor 1 forward', 'output', 'OB00010'], ['Conveyor 1 reverse', 'output', 'OB00011'], ['Conveyor 2 forward', 'output', 'OB00012'], ['Conveyor 2 reverse', 'output', 'OB00013'],
  ['Driver of conveyor 1 fault', 'input', 'IB00010'], ['Driver of conveyor 2 fault', 'input', 'IB00011'],
  // the same names again in another I/O group (IB041x / OB041x)
  ['Conveyor 1 forward', 'output', 'OB04110'], ['Conveyor 2 forward', 'output', 'OB04111'],
];
const io = pts.map(([description, type], i) => ({ id: `c${i}`, category: 'Operator/HMI', description, type })) as typeof base.io;
const input = { ...base, io, addresses: new Map(pts.map(([, , a], i) => [`c${i}`, a])), inputs: { ...base.inputs, motors: [] }, spec: 'Roll former with two conveyors.' };
const d = generateDefaultDesign(input).design;
const cat = (c: string) => d.components.filter((x) => getPart(x.partNumber)?.category === c);
assert.equal(cat('contactor').length, 0, 'no starter invented');
assert.equal(cat('overload').length, 0);
assert.equal(cat('vfd').length, 0, 'no VFD invented');
assert.equal(cat('sensor').length, 0, 'the driver fault inputs are not sensors');
const drives = d.components.filter((x) => /type not identified/.test(x.function));
assert.deepEqual(drives.map((x) => x.function.split(' (')[0]), ['Conveyor 1 drive', 'Conveyor 2 drive'], 'one drive per conveyor (duplicates merged)');
assert.ok(d.notes.some((n) => /named twice/.test(n)), 'duplicates said');
// Commands and fault wired to the drive.
const u1 = drives[0].tag;
assert.deepEqual(d.ioWiring.filter((w) => w.deviceTag === u1).map((w) => w.address).sort(), ['IB00010', 'OB00010', 'OB00011', 'OB04110']);
// BOM: a note line each, never ordered; the warning asks to check the drive on the machine.
const ctx = ctxFor(input, d);
const notes = billOfMaterials(ctx).flatMap((g) => g.lines).filter((l) => l.tags.includes(u1));
assert.ok(notes.length === 1 && notes[0].note && !notes[0].partNumber);
assert.ok(designWarnings(ctx).some((w) => w.startsWith(`${u1}: Conveyor 1 drive`) && /check the drive on the machine/.test(w)));

// A conveyor without a driver-fault input keeps its starter.
const plain = generateDefaultDesign({ ...input, io: io.filter((p) => !/driver/i.test(p.description)) }).design;
assert.ok(plain.components.some((x) => getPart(x.partNumber)?.category === 'contactor'), 'a plain conveyor gets its starter');
console.log('own drive tests passed');
