// HMI QA fixes: text fit and reachability in the layout check, screen rename / access, background
// <-> picture, the live keypad, small panels, PLC tag names.   npx tsx src/hmi/qa.test.ts
import assert from 'node:assert/strict';
import { checkDesign, cutTexts, lockInset } from './layout';
import { createElement, renameScreen, setScreenLevel } from './editor';
import { backgroundAt, bgBox, pictureRect } from './background';
import { parseEntry, registerRange } from './keypad';
import { designable, getHmi } from './hmiCatalog';
import { withTagNames } from './tagLabels';
import type { HmiDesign, HmiElement, HmiScreen } from './types';

const B = { w: 800, h: 480 };
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };
const el = (kind: HmiElement['kind'], id: string, patch: Partial<HmiElement> = {}): HmiElement => ({ ...createElement(kind, id, 400, 240, B), ...patch });
const nav = (id: string, label: string, target: string, x: number): HmiElement => el('nav', id, { label, targetScreenId: target, x, y: 420, w: 120, h: 56 });
const design = (screens: HmiScreen[]): HmiDesign => ({ hmiPartNumber: 'P', screens, alarms: [], tags: [], notes: [], generatedAt: '' });

test('text that does not fit its element is reported (and fitting text is not)', () => {
  assert.deepEqual(cutTexts(el('button', 'b', { label: 'Start', w: 120 })), []);
  const cut = cutTexts(el('button', 'b', { label: 'Select Manual Mode Now', w: 120 }));
  assert.equal(cut.length, 1);
  assert.ok(cut[0].need > cut[0].room);
  // An indicator with ON / OFF texts shows those, not its label.
  assert.deepEqual(cutTexts(el('indicator', 'i', { label: 'A very long indicator label here', onText: 'On', offText: 'Off', w: 160 })), []);
  const d = design([{ id: 's', name: 'Main', purpose: '', elements: [el('header', 'h', { x: 0, y: 0, w: 800, h: 56 }), el('button', 'b', { label: 'Select Manual Mode Now', x: 40, y: 100, w: 120 })] }]);
  assert.ok(checkDesign(d, 800, 480).some((i) => i.elementId === 'b' && /does not fit/.test(i.message)));
});

test('the password lock badge takes room from a protected button\'s text', () => {
  const b = el('button', 'b', { label: 'Jog Conveyor', w: 130, h: 56 });
  assert.deepEqual(cutTexts(b), []);
  assert.equal(lockInset({ ...b, level: 'maintenance' }), 22);
  assert.equal(cutTexts({ ...b, level: 'maintenance' }).length, 1);
});

test('a screen no navigation button reaches is reported', () => {
  const main: HmiScreen = { id: 'main', name: 'Main', purpose: '', elements: [nav('n1', 'Setup', 'setup', 0)] };
  const setup: HmiScreen = { id: 'setup', name: 'Setup', purpose: '', elements: [nav('n2', 'Main', 'main', 0)] };
  const hidden: HmiScreen = { id: 'hidden', name: 'Hidden', purpose: '', elements: [nav('n3', 'Main', 'main', 0)] };
  const msgs = checkDesign(design([main, setup, hidden]), 800, 480).map((i) => i.message);
  assert.ok(msgs.some((m) => /cannot reach it/.test(m) && /Hidden/.test(m)));
  assert.ok(!msgs.some((m) => /cannot reach it/.test(m) && /“Setup”/.test(m)));
});

test('renaming a screen renames the navigation buttons that showed its name', () => {
  const d = design([
    { id: 'main', name: 'Main', purpose: '', elements: [nav('a', 'Diagnostics', 'diag', 0), nav('b', 'Diag.', 'diag', 130)] },
    { id: 'diag', name: 'Diagnostics', purpose: '', elements: [nav('c', 'DIAGNOSTICS', 'diag', 0)] },
  ]);
  const r = renameScreen(d, 'diag', 'I/O check');
  assert.equal(r.screens[1].name, 'I/O check');
  assert.deepEqual(r.screens.flatMap((s) => s.elements.map((e) => e.label)), ['I/O check', 'Diag.', 'I/O check']);
});

test('screen access level set and cleared', () => {
  const d = design([{ id: 's', name: 'Setup', purpose: '', elements: [] }]);
  assert.equal(setScreenLevel(d, 's', 'engineer').screens[0].level, 'engineer');
  assert.equal('level' in setScreenLevel(setScreenLevel(d, 's', 'engineer'), 's', 'operator').screens[0], false);
});

test('background -> movable picture -> background keeps place and size', () => {
  const bg = { fit: 'fit' as const, zoom: 0.6, offsetX: 40, offsetY: -20 };
  const r = pictureRect(bg, 800, 480, 1000, 500); // a 2:1 picture fitted in a zoomed, moved box
  const box = bgBox(bg, 800, 480);
  assert.equal(Math.round(r.w), Math.round(box.width));
  assert.ok(r.h < box.height);
  const back = backgroundAt(r, 800, 480);
  const again = pictureRect({ ...back }, 800, 480, 1000, 500);
  for (const k of ['x', 'y', 'w', 'h'] as const) assert.ok(Math.abs(again[k] - r[k]) < 1.5, `${k}: ${again[k]} vs ${r[k]}`);
  const st = pictureRect({ fit: 'stretch', zoom: 1 }, 800, 480, 10, 10);
  assert.deepEqual(st, { x: 0, y: 0, w: 800, h: 480 });
});

test('keypad entry: limits, whole numbers for DS, floats for DF', () => {
  assert.deepEqual(parseEntry('25', { address: 'DS1001', min: 0, max: 60, units: 's' }), { value: 25 });
  assert.match((parseEntry('75', { address: 'DS1001', min: 0, max: 60, units: 's' }) as { error: string }).error, /0 to 60 s/);
  assert.match((parseEntry('2.5', { address: 'DS1001', min: null, max: null, units: null }) as { error: string }).error, /Whole numbers/);
  assert.deepEqual(parseEntry('2.5', { address: 'DF3', min: null, max: null, units: null }), { value: 2.5 });
  assert.ok('error' in parseEntry('40000', { address: 'DS5', min: null, max: null, units: null }));
  assert.ok('error' in parseEntry('', { address: 'DS5', min: null, max: null, units: null }));
  assert.equal(registerRange('DD1').integer, true);
});

test('panels too small for touch screens are not designable', () => {
  assert.equal(designable(getHmi('EA3-S3ML')!), false);
  assert.equal(designable(getHmi('CM5-T7W')!), true);
});

test('neutral addresses shown with the PLC tag', () => {
  const tag = (a: string) => ({ C1001: 'HMI_Start', DS1001: 'Pusher_Timeout' } as Record<string, string>)[a] ?? null;
  assert.equal(withTagNames('Start (C1001) sets the timeout DS1001; X001 is wired.', tag), 'Start (HMI_Start (C1001)) sets the timeout Pusher_Timeout (DS1001); X001 is wired.');
  assert.equal(withTagNames('C1001', null), 'C1001');
});

console.log(`\n${passed} passed`);
