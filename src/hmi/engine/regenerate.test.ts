/// <reference types="node" />
/**
 * Regenerating an HMI with hand-edited screens: edited screens are kept and re-bound to the new tags,
 * new items go on an "(added)" screen, untouched screens are replaced, "Rebuild this screen" restores one.
 * Run with:  npx tsx src/hmi/engine/regenerate.test.ts
 */
import assert from 'node:assert/strict';
import { buildHmi, defaultHmiContent } from './index';
import { markEdited, mergeRegenerated, rebuildScreen } from './regenerate';
import { checkDesign } from '../layout';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import type { IOPoint } from '../../types/io';
import type { HmiDesign, HmiTag } from '../types';
import type { IOWiring } from '../../electrical/types';
import { inferRoles } from './roles';

const panel = { partNumber: 'P', widthPx: 800, heightPx: 480, now: 'T' };
function design(points: [string, 'input' | 'output'][]): HmiDesign {
  const io = points.map(([description, type], i) => ({ id: `p${i}`, description, type, category: 'Operator/HMI' })) as IOPoint[];
  const profile = getProfile('click');
  const addresses = resolveAddresses(profile, getCpu(profile, 'C0-11DD1E-D'), io, moduleSlots([]));
  return buildHmi(defaultHmiContent({ io, addresses, machineName: 'Cell' }), panel);
}
const BASE: [string, 'input' | 'output'][] = [
  ['Part at end photo-eye', 'input'], ['Pusher extended', 'input'], ['Pusher retracted', 'input'],
  ['Conveyor motor contactor', 'output'], ['Pusher solenoid', 'output'],
];
const v1 = design(BASE);

// markEdited: element changes mark the screen; look or nav-only changes do not.
const manual = v1.screens.find((s) => s.id === 'manual')!;
const moved = { ...manual, elements: manual.elements.map((e) => (e.kind === 'button' && e.label === 'Extend' ? { ...e, label: 'Push Out' } : e)) };
const userText = { id: 'u-note', kind: 'text' as const, label: 'Ask the shift lead first', x: 400, y: 330, w: 360, h: 20, address: null, action: null, targetScreenId: null, onText: null, offText: null, style: 'warning' as const, units: null, min: null, max: null, note: null };
moved.elements = [...moved.elements, userText];
const edited = markEdited(v1, { ...v1, screens: v1.screens.map((s) => (s.id === 'manual' ? moved : s)) });
assert.equal(edited.screens.find((s) => s.id === 'manual')!.edited, true);
assert.ok(edited.screens.filter((s) => s.id !== 'manual').every((s) => !s.edited));
assert.ok(markEdited(v1, { ...v1, look: 'dark' }).screens.every((s) => !s.edited), 'a look change is not an edit');
const navOnly = { ...v1, screens: v1.screens.map((s) => ({ ...s, elements: s.elements.map((e) => (e.kind === 'nav' ? { ...e, x: e.x + 1 } : e)) })) };
assert.ok(markEdited(v1, navOnly).screens.every((s) => !s.edited), 'navigation-only changes are not edits');

// Nothing edited: the regenerated design as it is.
assert.equal(mergeRegenerated(v1, v1).design, v1);

// The I/O list grows (Safety OK + a gripper): alarm addresses move; the edited Alarms and Manual screens are kept and re-bound.
const alarms = edited.screens.find((s) => s.id === 'alarms')!;
const myAlarms = { ...alarms, edited: true, elements: [...alarms.elements.map((e) => (e.kind === 'button' ? { ...e, label: 'Clear' } : e)), { ...userText, id: 'u-alm', x: 16, y: 100, w: 100, h: 0 }].filter((e) => e.h > 0) };
const before = { ...edited, screens: edited.screens.map((s) => (s.id === 'alarms' ? myAlarms : s)) };
const v2 = design([['Safety relay OK', 'input'], ...BASE, ['Gripper close solenoid', 'output'], ['Gripper open solenoid', 'output']]);
const oldTimeout = before.tags.find((t) => t.name === 'ALM_Pusher_Timeout')!.address;
const newTimeout = v2.tags.find((t) => t.name === 'ALM_Pusher_Timeout')!.address;
assert.notEqual(oldTimeout, newTimeout, 'the test needs an address that moves');
const { design: merged, notes } = mergeRegenerated(before, v2);
const keptManual = merged.screens.find((s) => s.id === 'manual')!;
assert.ok(keptManual.edited && keptManual.elements.some((e) => e.id === 'u-note'), "the user's own text is kept");
assert.equal(keptManual.elements.find((e) => e.label === 'Push Out')!.address, v2.tags.find((t) => t.name === 'HMI_Pusher_Extend')!.address);
const keptAlarms = merged.screens.find((s) => s.id === 'alarms')!;
assert.ok(keptAlarms.elements.some((e) => e.label === 'Clear'), 'user label kept');
assert.ok(keptAlarms.elements.some((e) => e.address === newTimeout) && !keptAlarms.elements.some((e) => e.address === oldTimeout && e.kind === 'indicator' && /did not reach/.test(e.label)),
  `alarm lamp re-bound by tag name (${oldTimeout} -> ${newTimeout})`);
const added = merged.screens.find((s) => s.id === 'alarms-added')!;
const safetyAlarm = v2.alarms.find((a) => /Safety circuit open/.test(a.message))!.address;
assert.ok(added.elements.some((e) => e.kind === 'indicator' && e.address === safetyAlarm), 'the new Safety Open lamp is on "Alarms (added)"');
// Every screen is reachable: the "(added)" screen has a button in each navigation bar.
assert.ok(merged.screens.every((s) => s.elements.some((e) => e.kind === 'nav' && e.targetScreenId === 'alarms-added')), '"Alarms (added)" in every navigation bar');
assert.deepEqual(checkDesign(merged, 800, 480).filter((i) => /cannot reach it/.test(i.message)).map((i) => i.message), [], 'no unreachable screen');
const manualAdded = merged.screens.find((s) => s.id === 'manual-added');
assert.ok(!manualAdded || manualAdded.elements.every((e) => !/^Push Out$/.test(e.label)));
assert.ok(notes.some((n) => /Kept your edited screen "Alarms"/.test(n)) && notes.some((n) => /Alarms \(added\)/.test(n)));
const body = (d: HmiDesign, id: string) => d.screens.find((s) => s.id === id)!.elements.filter((e) => !/-nav-/.test(e.id));
assert.deepEqual(body(merged, 'setup'), body(v2, 'setup'), 'untouched screens replaced by the new ones');
assert.deepEqual(checkDesign(merged, 800, 480).filter((i) => i.severity === 'error').map((i) => i.message), []);
assert.ok(v2.screens.some((s) => s.elements.some((e) => e.label === 'Close')) && v2.screens.some((s) => s.elements.some((e) => e.label === 'Open')), 'gripper buttons say Close / Open');

// A hand-added screen keeps its navigation button (here on the Main bar, which the regeneration replaces).
{
  const mine = { id: 'mine', name: 'Recipes', purpose: '', edited: true, elements: [{ ...userText, id: 'm-t', y: 100 }] };
  const mainV1 = v1.screens.find((s) => s.id === 'main')!;
  const navBtn = { ...mainV1.elements.find((e) => e.kind === 'nav')!, id: 'main-nav-mine', label: 'Recipes', targetScreenId: 'mine' };
  const withMine = { ...v1, screens: [...v1.screens.map((s) => (s.id === 'main' ? { ...s, elements: [...s.elements, navBtn] } : s)), mine] };
  const m = mergeRegenerated(withMine, v2).design;
  assert.ok(m.screens.find((s) => s.id === 'main')!.elements.some((e) => e.kind === 'nav' && e.targetScreenId === 'mine' && e.label === 'Recipes'), 'the button to the hand-added screen is kept');
  assert.deepEqual(checkDesign(m, 800, 480).filter((i) => i.severity === 'error' || /cannot reach it/.test(i.message)).map((i) => i.message), []);
}

// Rebuild this screen: the generated Alarms replaces the user's, its "(added)" page goes away.
const rebuilt = rebuildScreen(merged, v2, 'alarms')!;
assert.ok(!rebuilt.screens.some((s) => s.id === 'alarms-added'));
assert.equal(rebuilt.screens.find((s) => s.id === 'alarms')!.edited, undefined);
assert.ok(!rebuilt.screens.find((s) => s.id === 'alarms')!.elements.some((e) => e.label === 'Clear'));
assert.ok(rebuilt.screens.find((s) => s.id === 'manual')!.edited, 'other edited screens stay');
assert.equal(rebuildScreen(merged, v2, 'my-own-screen'), null);
console.log('hmi regenerate tests passed');

// A motor named with its ratings ("Film unwinder (0.18 kW, 1800 rpm, with STO)") is "Film Unwinder", and an HMI
// alarm named that way is the drive-fault alarm the program writes, even without a stored role.
{
  const io = [
    { id: 'a', description: 'Film unwinder VFD run', type: 'output', category: 'Conveyor', deviceType: 'vfd-input' },
    { id: 'b', description: 'Film unwinder VFD fault', type: 'input', category: 'Conveyor', deviceType: 'vfd-input' },
  ] as IOPoint[];
  const wiring = [{ address: 'Y001', deviceTag: 'VFD1', deviceType: 'vfd-input' }, { address: 'X005', deviceTag: 'VFD1', deviceType: 'vfd-input' }] as IOWiring[];
  const motorOf = new Map([['VFD1', { tag: 'M1', description: 'Film unwinder (0.18 kW, 1800 rpm, approx. 0.25 hp, with STO)' }]]);
  const c = defaultHmiContent({ io, addresses: new Map([['a', 'Y001'], ['b', 'X005']]), machineName: 'x', wiring, motorOf });
  assert.equal(c.actuators[0].name, 'Film Unwinder');
  const tag = { name: 'ALM_Film_Unwinder_Fault', address: 'C1102', dataType: 'BIT', access: 'read', description: 'Film Unwinder: drive fault' } as HmiTag;
  assert.equal(inferRoles([tag], { content: c }).tags[0].role, 'alarm:fault:X005');
  // A role on an input the I/O list no longer has (the PLC changed) is read again from the name.
  assert.equal(inferRoles([{ ...tag, role: 'alarm:fault:X009' }], { content: c }).tags[0].role, 'alarm:fault:X005');
  console.log('ok - rated motor names and stale roles');
}
