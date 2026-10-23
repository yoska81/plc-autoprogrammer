/// <reference types="node" />
/**
 * Send to CLICK's step plans: each action is a oneOf, CLICK 4's way first (Ctrl+N / key tips for the ribbon, the
 * Navigation tree for the Address Picker and the ladder editor), CLICK 3's menus kept as a way; a new project
 * with the CPU, the nickname CSV through the Address Picker, the editor ready; the modules as one line for the
 * result; no step saves (the bridge refuses those, tools/click-bridge Runner.Guard, and so does saveSteps).
 * Run with:  npx tsx src/plc/click/clickPlan.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allSteps, CHOOSER, CLICK_MAIN, editorPlan, literal, modulesLine, newProjectPlan, nicknamePlan, saveSteps, sendKeysText, setupPlan, type ClickStep } from './clickPlan';

const ways = (s: ClickStep | undefined) => (s?.options ?? []).map((o) => o.label);

const p = newProjectPlan('C0-10DD1E-D');
assert.equal(p[0].do, 'window');
assert.equal(p[0].title, CLICK_MAIN);
const np = p.find((s) => s.what === 'New project');
assert.deepEqual(ways(np), ['Ctrl+N', 'the File menu', 'the ribbon key tips (Alt, F, N)'], 'CLICK 4 first, CLICK 3\'s menu kept');
const opened = new RegExp(np!.options![0].steps.at(-1)!.title!, 'i');
assert.ok(np!.options!.every((o) => o.steps.at(-1)!.do === 'window'), 'each way counts only when a window comes');
assert.ok(opened.test('Select a CPU Module') && opened.test('Select an Operation') && !opened.test('CLICK Programming Software - NewProject1.ckp'), 'the CPU dialog, or CLICK 4\'s startup chooser');
assert.ok(np!.options![0].steps.some((s) => s.do === 'keys' && s.keys === '^n'));
assert.deepEqual(np!.options![1].steps.find((s) => s.do === 'menu')!.path, ['File', 'New Project']);

// the chooser: with the CPU dialog, closed; alone, Start a new project in it
const cw = p.find((s) => s.what === 'the CPU window')!;
assert.deepEqual(ways(cw), ['the CPU dialog', 'Start a new project in "Select an Operation"']);
assert.deepEqual(cw.options![0].steps.map((s) => s.do), ['window', 'close']);
assert.equal(cw.options![0].steps[1].title, CHOOSER);
assert.ok(cw.options![1].steps.some((s) => s.do === 'click' && new RegExp(s.find!.name!, 'i').test('Start a new project')));

// the CPU: three ways, each checked (the list shows exactly that CPU as chosen) before OK
const pick = p.find((s) => s.what === 'the CPU C0-10DD1E-D')!;
assert.deepEqual(ways(pick), ['its entry in the list', 'picked in the list', 'typed into the list']);
assert.ok(pick.options!.every((o) => o.steps.at(-1)!.do === 'expect'), 'every way ends with the check');
const expect = pick.options![0].steps.at(-1)!;
for (const shown of ['C0-10DD1E-D', 'C0-10DD1E-D  CLICK Ethernet Basic PLC']) assert.ok(new RegExp(expect.item!, 'i').test(shown), shown);
for (const shown of ['C0-00DD1-D', 'C0-10DD1E-D2', 'ALL']) assert.ok(!new RegExp(expect.item!, 'i').test(shown), `not ${shown}`);
assert.ok(!new RegExp(`^(?:${expect.find!.type})$`, 'i').test('ComboBox'), 'the check reads the CPU list, not the CPU Category box');
const cpu = pick.options![0].steps[0];
assert.ok(new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D  CLICK Ethernet Basic PLC'), 'the CPU item by its part number');
assert.ok(!new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D2'), 'not a longer part number');
assert.equal(pick.options![2].steps[1].keys, '{HOME}C0-10DD1E-D');
assert.equal(sendKeysText('A+B(1)'), 'A{+}B{(}1{)}');
const ok = p.findIndex((s) => s.do === 'click' && s.find?.name === '^OK$');
assert.ok(ok > p.indexOf(pick), 'OK only after the CPU is checked');
assert.ok(p.filter((s) => s.do === 'refuse').every((s) => /save/i.test(s.text!) && /yourself/.test(s.text!)), 'a save question: the user\'s, never answered');

// the C# bridge's tests run this very plan (tools/click-bridge/tests/new-project-plan.json)
const fixture = new URL('../../../tools/click-bridge/tests/new-project-plan.json', import.meta.url);
const json = `${JSON.stringify(p, null, 1)}\n`;
if (process.env.UPDATE_FIXTURES) fs.writeFileSync(fixture, json);
assert.equal(fs.readFileSync(fixture, 'utf8'), json, 'the bridge tests\' copy of the plan is current (UPDATE_FIXTURES=1 npx tsx src/plc/click/clickPlan.test.ts)');

// modules: one line for the result (no stop in the middle of the run)
assert.equal(modulesLine([]), null);
assert.equal(modulesLine(['C0-16ND3', 'C0-08TR']), 'Add these 2 modules in CLICK\'s System Configuration: slot 1: C0-16ND3, slot 2: C0-08TR.');
assert.match(modulesLine(['C0-16ND3'])!, /^Add this module/);

// nicknames: the Address Picker from the tree (CLICK 4) or the View menu (CLICK 3); the file name typed as it is
const n = nicknamePlan('C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\Line_nicknames.csv');
assert.deepEqual(ways(n.find((s) => s.what === 'the Address Picker')), ['the Navigation tree', 'the View menu']);
assert.ok(n.find((s) => s.what === 'the Address Picker')!.options![0].steps.some((s) => s.do === 'doubleClick' && s.find?.type === 'TreeItem' && new RegExp(s.find.name!).test('Address Picker')));
assert.deepEqual(ways(n.find((s) => s.what === 'the nickname import')), ['its Import button', 'its File menu']);
const menuName = allSteps(n).find((s) => s.do === 'menu' && s.path?.[1] === 'Import')!.path![2];
assert.ok(new RegExp(`^(?:${menuName})$`, 'i').test('Nick Names') && new RegExp(`^(?:${menuName})$`, 'i').test('Nickname'));
assert.equal(n.find((s) => s.do === 'setText')!.text, 'C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\Line_nicknames.csv');

// the editor for the rungs: Main Program in the tree, else the one open; at the first rung
const e = editorPlan();
assert.deepEqual(ways(e[0]), ['Main Program in the Navigation tree', 'the editor that is open']);
assert.equal(e.at(-1)!.keys, '^{HOME}');

// the whole set-up: a window first, nothing that saves (inside the ways too)
const all = setupPlan({ cpuId: 'C0-12DD1E-D', nicknameCsvPath: 'x.csv' });
assert.equal(all[0].do, 'window');
assert.deepEqual(saveSteps(all), []);
assert.ok(allSteps(all).every((s) => s.do !== 'waitGone' && s.do !== 'waitUser'), 'one click: nothing waits for the user');
assert.deepEqual(saveSteps([{ do: 'keys', keys: '^s' }, { do: 'menu', path: ['File', 'Save Project As'] }, { do: 'click', find: { name: '^Save$' } }, { do: 'keys', keys: 'abc' }, { do: 'oneOf', options: [{ label: 'x', steps: [{ do: 'keys', keys: '{F12}' }] }] }]), [0, 1, 2, 4]);
assert.equal(literal('C0-10DD1E-D'), 'C0-10DD1E-D');
assert.equal(literal('a.b(c)'), 'a\\.b\\(c\\)');
console.log('clickPlan.test: all passed');
