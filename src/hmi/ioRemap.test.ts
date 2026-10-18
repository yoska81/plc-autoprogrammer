/// <reference types="node" />
/**
 * HMI bindings follow their I/O point when the list is renumbered; a lamp on a deleted point is unbound and
 * reported, never left showing whatever input took its address (QA: deleting "Start PB" made its lamp show the
 * Stop button). The layout check reports X / Y addresses the I/O list does not have.
 * Run with:  npx tsx src/hmi/ioRemap.test.ts
 */
import assert from 'node:assert/strict';
import { ioRemap } from '../plc/core/ioRemap';
import { hmiUsesOf, remapHmiDesign } from './ioRemap';
import { checkDesign } from './layout';
import { createElement } from './editor';
import type { HmiDesign } from './types';

const B = { w: 800, h: 480 };
const lamp = (id: string, label: string, address: string, x: number) => ({ ...createElement('indicator', id, 0, 0, B), label, address, x, y: 100, w: 120, h: 48 });
const design: HmiDesign = {
  hmiPartNumber: 'CM5-T7W', generatedAt: '', notes: [],
  screens: [{ id: 'main', name: 'Main', purpose: '', elements: [lamp('l1', 'Start PB', 'X001', 10), lamp('l2', 'Stop PB', 'X002', 150), lamp('l3', 'Part present', 'X003', 300), { ...lamp('b1', 'Jog', 'C1001', 450), kind: 'button', interlock: 'X003' }] }],
  tags: [{ name: 'Start_PB', address: 'X001', dataType: 'BIT', access: 'read', description: '' }, { name: 'HMI_Jog', address: 'C1001', dataType: 'BIT', access: 'write', description: '' }],
  alarms: [],
};
const names: Record<string, string> = { start: 'Start PB', stop: 'Stop PB', pe: 'Part present' };

// Delete "Start PB": Stop PB X002 → X001 and Part present X003 → X002 (one pass).
const r = ioRemap(new Map([['start', 'X001'], ['stop', 'X002'], ['pe', 'X003']]), new Map([['stop', 'X001'], ['pe', 'X002']]));
const { design: d, notes } = remapHmiDesign(design, r, (id) => names[id] ?? '');
const by = (id: string) => d.screens[0].elements.find((e) => e.id === id)!;
assert.deepEqual([by('l1').address, by('l1').lostIo], ['', 'X001 Start PB'], 'the deleted point is unbound and marked, not left on X001');
assert.equal(by('l2').address, 'X001', 'Stop PB follows its point');
assert.equal(by('l3').address, 'X002');
assert.equal(by('b1').interlock, 'X002', 'interlocks follow too');
assert.equal(by('b1').address, 'C1001', 'internal bits are untouched');
assert.deepEqual(d.tags.map((t) => t.address), ['C1001'], 'the tag on the deleted point is removed');
assert.ok(notes.some((n) => /Unbound 1 element.*“Start PB” on Main/.test(n)) && notes.some((n) => /Start_PB \(X001 Start PB\)/.test(n)));

// The layout check reports the unbound lamp, and any X / Y the I/O list does not have.
const io = new Set(['X001', 'X002']);
const issues = checkDesign(d, 800, 480, { io });
assert.ok(issues.some((i) => i.elementId === 'l1' && i.severity === 'error' && /was bound to X001 Start PB, whose I\/O point was deleted/.test(i.message)));
const stale = checkDesign(design, 800, 480, { io });
assert.ok(stale.some((i) => i.elementId === 'l3' && /uses X003, which is not in the I\/O list/.test(i.message)), 'a design saved before the remap is caught too');
assert.ok(!checkDesign(d, 800, 480, { io }).some((i) => /not in the I\/O list/.test(i.message)), 'after the remap every X is in the list');

// Nothing changed: the same design back.
assert.equal(remapHmiDesign(design, ioRemap(new Map([['a', 'X001']]), new Map([['a', 'X001']]))).design, design);
// A PLC change renumbers every point (CLICK X001 → CompactLogix X101): descriptions that name the I/O move too,
// so the program templates still find each tag's role ("PLC runs Y001 while …" → Y201).
const plc = ioRemap(new Map([['conv', 'Y001'], ['pe', 'X003']]), new Map([['conv', 'Y201'], ['pe', 'X103']]));
const jog = { name: 'HMI_Jog', address: 'C1006', dataType: 'BIT' as const, access: 'write' as const, description: 'Hold-to-run: PLC runs Y001 while ON and X003 is OFF; not Y0012.' };
const moved = remapHmiDesign({ ...design, tags: [jog] }, plc).design.tags[0];
assert.equal(moved.description, 'Hold-to-run: PLC runs Y201 while ON and X103 is OFF; not Y0012.');

// What uses a point, for the delete confirmation.
assert.deepEqual(hmiUsesOf(design, 'x003'), ["Screen Main: lamp 'Part present'", "Screen Main: button 'Jog' (its permissive)"]);
assert.deepEqual(hmiUsesOf(null, 'X001'), []);
console.log('HMI ioRemap tests passed');
