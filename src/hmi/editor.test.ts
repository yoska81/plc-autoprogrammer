// Unit tests of the manual HMI editor model: npx tsx src/hmi/editor.test.ts
import assert from 'node:assert/strict';
import {
  alignElements, createElement, deleteElements, distributeElements, duplicateElements, elementsInRect, historyOf,
  missingTags, moveElements, newElementId, record, redo, resizeElement, snap, syncHandTags, undo,
} from './editor';
import type { HmiDesign, HmiScreen } from './types';

const B = { w: 800, h: 480 };
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

const screen = (): HmiScreen => ({
  id: 's1', name: 'Main', purpose: '', elements: [
    createElement('button', 'a', 100, 100, B),
    createElement('indicator', 'b', 400, 100, B),
    createElement('numeric', 'c', 650, 300, B),
  ],
});

test('snap to the 8 px grid', () => {
  assert.equal(snap(13), 16); assert.equal(snap(11), 8); assert.equal(snap(-3), 0);
});

test('new element: default size, snapped, centred, kept on screen', () => {
  const e = createElement('button', 'x', 100, 100, B);
  assert.deepEqual([e.x, e.y, e.w, e.h], [40, 72, 120, 56]);
  assert.equal(e.action, 'momentary');
  const edge = createElement('alarm-banner', 'y', 790, 470, B);
  assert.ok(edge.x + edge.w <= B.w && edge.y + edge.h <= B.h && edge.x % 8 === 0 && edge.y % 8 === 0);
});

test('move snaps and keeps the group on the panel', () => {
  const s = screen();
  const m = moveElements(s, ['a'], 13, 5, B);
  const a = m.elements.find((e) => e.id === 'a')!;
  assert.deepEqual([a.x, a.y], [56, 80]);
  const far = moveElements(s, ['a', 'b'], 5000, -5000, B);
  const fa = far.elements.find((e) => e.id === 'a')!;
  const fb = far.elements.find((e) => e.id === 'b')!;
  assert.equal(fa.y, 0);
  assert.equal(fb.x + fb.w, B.w);
  assert.equal(fb.x - fa.x, s.elements[1].x - s.elements[0].x, 'group keeps its shape');
  assert.equal(moveElements(s, ['a'], 1, 1, B, 1).elements[0].x, 41, 'grid off: 1 px nudge');
  assert.equal(moveElements(s, [], 10, 10, B), s);
});

test('resize from each handle, snapped, with a minimum size', () => {
  const e = createElement('indicator', 'i', 400, 240, B); // 160×48 at 320,216
  const se = resizeElement(e, 'se', 37, 21, B);
  assert.deepEqual([se.x, se.y, se.w, se.h], [320, 216, 200, 72]);
  const nw = resizeElement(e, 'nw', -20, -20, B);
  assert.deepEqual([nw.x, nw.y, nw.x + nw.w, nw.y + nw.h], [304, 200, 480, 264]);
  const tiny = resizeElement(e, 'e', -1000, 0, B);
  assert.equal(tiny.w, 16);
  const btn = resizeElement(createElement('button', 'b', 400, 240, B), 'se', -1000, -1000, B);
  assert.ok(btn.w >= 48 && btn.h >= 48, 'touch targets stay touchable');
  const out = resizeElement(e, 'se', 5000, 5000, B);
  assert.deepEqual([out.x + out.w, out.y + out.h], [800, 480]);
});

test('align left / right / centres', () => {
  const s = screen();
  const l = alignElements(s, ['a', 'b', 'c'], 'left');
  assert.ok(l.elements.every((e) => e.x === 40));
  const r = alignElements(s, ['a', 'b'], 'right');
  const [ra, rb] = r.elements;
  assert.equal(ra.x + ra.w, rb.x + rb.w);
  const v = alignElements(s, ['a', 'b'], 'vcenter');
  assert.equal(v.elements[0].y + v.elements[0].h / 2, v.elements[1].y + v.elements[1].h / 2);
  assert.equal(alignElements(s, ['a'], 'left'), s, 'one element: nothing to align');
});

test('distribute with equal gaps', () => {
  const s: HmiScreen = { ...screen(), elements: [
    { ...createElement('button', 'p', 0, 0, B), x: 0, w: 100 },
    { ...createElement('button', 'q', 0, 0, B), x: 130, w: 100 },
    { ...createElement('button', 'r', 0, 0, B), x: 500, w: 100 },
  ] };
  const d = distributeElements(s, ['p', 'q', 'r'], 'h');
  const xs = d.elements.map((e) => e.x);
  assert.deepEqual(xs, [0, 250, 500]);
});

test('duplicate, delete, marquee', () => {
  const s = screen();
  let n = 0;
  const { screen: d, ids } = duplicateElements(s, ['a', 'b'], () => `copy${++n}`, B);
  assert.equal(d.elements.length, 5);
  assert.deepEqual(ids, ['copy1', 'copy2']);
  const c1 = d.elements.find((e) => e.id === 'copy1')!;
  assert.deepEqual([c1.x - s.elements[0].x, c1.y - s.elements[0].y], [16, 16]);
  assert.notEqual(c1, s.elements[0]);
  assert.equal(deleteElements(d, ids).elements.length, 3);
  assert.deepEqual(elementsInRect(s, 0, 0, 300, 200), ['a']);
  assert.deepEqual(elementsInRect(s, 800, 480, 300, 0).sort(), ['b', 'c']);
});

test('unique ids across the design', () => {
  const design = { screens: [screen(), { ...screen(), id: 's2', elements: [{ ...createElement('text', 'el_1', 0, 0, B) }] }] } as HmiDesign;
  assert.equal(newElementId(design), 'el_2');
});

test('tag sync: hand tags follow their elements', () => {
  const s = screen();
  s.elements[0] = { ...s.elements[0], label: 'Jog', address: 'C1020' };
  let d = { screens: [s], tags: [], alarms: [], notes: [], hmiPartNumber: 'X', generatedAt: '' } as HmiDesign;
  d = syncHandTags(d, () => undefined);
  assert.deepEqual(d.tags.map((t) => t.address), ['C1020']);
  assert.equal(syncHandTags(d, () => undefined), d, 'nothing to change: same object');
  d = syncHandTags({ ...d, screens: [deleteElements(s, ['a'])] }, () => undefined);
  assert.deepEqual(d.tags, [], 'tag of a deleted hand-placed element goes');
  const ai = { ...d, tags: [{ name: 'AI', address: 'C1500', dataType: 'BIT' as const, access: 'read' as const, description: 'From the AI design.' }] };
  assert.equal(syncHandTags(ai, () => undefined).tags.length, 1, 'tags not made by hand are kept');
});

test('undo / redo', () => {
  let h = historyOf(1);
  h = record(h, 2); h = record(h, 3);
  h = undo(h); assert.equal(h.present, 2);
  h = undo(h); assert.equal(h.present, 1);
  h = undo(h); assert.equal(h.present, 1, 'nothing more to undo');
  h = redo(h); assert.equal(h.present, 2);
  h = record(h, 9); assert.equal(h.future.length, 0, 'a new change drops redo');
  assert.equal(record(h, h.present), h, 'same state not recorded');
  let big = historyOf(0);
  for (let i = 1; i <= 150; i++) big = record(big, i);
  assert.equal(big.past.length, 100);
});

test('tags for hand-placed addresses', () => {
  const s = screen();
  s.elements[0] = { ...s.elements[0], label: 'Start conveyor', address: 'c1010', interlock: 'C1' };
  s.elements[1] = { ...s.elements[1], label: 'Running', address: 'Y001' };
  s.elements[2] = { ...s.elements[2], label: 'Parts', address: 'DS1101' };
  const design = { screens: [s], tags: [{ name: 'SAFE', address: 'C1', dataType: 'BIT', access: 'read', description: '' }] } as unknown as HmiDesign;
  s.elements.push({ ...createElement('indicator', 'd', 100, 300, B), label: 'Pusher out', address: 'C1205' });
  const tags = missingTags(design, (a) => (a === 'C1205' ? 'Pusher extended' : undefined));
  assert.deepEqual(tags.map((t) => [t.address, t.name, t.dataType, t.access]), [
    ['C1010', 'START_CONVEYOR', 'BIT', 'write'],
    ['DS1101', 'PARTS', 'INT', 'read'],
    ['C1205', 'PUSHER_OUT', 'BIT', 'read'],
  ], 'physical Y001 gets no tag');
  assert.match(tags[2].description, /^Pusher extended\. Shown by "Pusher out" on screen "Main" \(placed by hand\)\.$/);
});

console.log(`\n${passed} passed`);
