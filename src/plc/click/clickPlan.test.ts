/// <reference types="node" />
/**
 * Send to CLICK's step plans: each action is a oneOf, CLICK 4's way first (Ctrl+N / key tips for the ribbon, the
 * Navigation tree for the Address Picker and the ladder editor), CLICK 3's menus kept as a way; a new project
 * with the CPU, the nickname CSV through the Address Picker, the editor ready; the modules as one line for the
 * result; no step saves (the bridge refuses those, tools/click-bridge Runner.Guard, and so does saveSteps).
 * Run with:  npx tsx src/plc/click/clickPlan.test.ts
 */
import assert from 'node:assert/strict';
import { allSteps, CLICK_MAIN, editorPlan, literal, modulesLine, newProjectPlan, nicknamePlan, saveSteps, setupPlan, type ClickStep } from './clickPlan';

const ways = (s: ClickStep | undefined) => (s?.options ?? []).map((o) => o.label);

const p = newProjectPlan('C0-10DD1E-D');
assert.equal(p[0].do, 'window');
assert.ok(new RegExp(p[0].title!).test('CLICK Programming Software (Version4.00)') && new RegExp(p[0].title!).test('Startup'), 'CLICK, or CLICK 4 just started showing only its Startup window');
const np = p.find((s) => s.what === 'New project');
assert.deepEqual(ways(np), ['the Startup window CLICK shows when it starts', 'Ctrl+N', 'the File menu', 'the ribbon key tips (Alt, F, N)'], 'CLICK 4 first, CLICK 3\'s menu kept');
assert.ok(np!.options!.every((o) => o.steps.at(-1)!.do === 'window'), 'each way counts only when the CPU dialog comes');
assert.ok(np!.options![1].steps.some((s) => s.do === 'keys' && s.keys === '^n'));
assert.deepEqual(np!.options![2].steps.find((s) => s.do === 'menu')!.path, ['File', 'New Project']);
// CLICK 4.00 (a user's log): Ctrl+N opens "Startup" first, the CPU dialog inside it; Start a new project is its
// leftmost, unnamed button; a CLICK whose Ctrl+N opens the CPU dialog straight away skips that press
// CLICK 4.00 shows its "What's New Feature Guide" when it starts: closed before anything else, when it comes
const news = p.findIndex((s) => s.do === 'window' && s.optional && new RegExp(s.title!).test("What's New Feature Guide"));
assert.ok(new RegExp(p[news].title!).test('ClickNewFeature'), 'its plain box where its pictures cannot show (the build server)');
assert.ok(news > 0 && news < p.indexOf(np!), 'the guide is looked for before the new project');
assert.equal(p[news + 1].do, 'click');
assert.ok(p[news + 1].optional && new RegExp(p[news + 1].find!.name!).test('Close') && new RegExp(p[news + 1].find!.name!).test('OK') && !new RegExp(p[news + 1].find!.name!).test('Next'), 'closed (its Close, or the box\'s OK), not paged through');
assert.ok(new RegExp(p[0].title!).test("What's New Feature Guide"), 'the run can start while the guide is in front');
// CLICK 4.00 asks for the new project's user accounts after the CPU: no password, then OK; skipped when it does not ask
const ua = p.findIndex((s) => s.do === 'window' && new RegExp(s.title!).test('User Account Setup'));
assert.ok(ua > p.findIndex((s) => s.do === 'click' && s.find?.name === '^OK$'), 'after the CPU dialog\'s OK');
assert.ok(p[ua].optional && p[ua + 1].do === 'check' && p[ua + 1].on === true && /Disable Password Requirement/.test(p[ua + 1].find!.name!) && p[ua + 1].optional);
assert.ok(!p[ua + 2].optional, 'a wait ends the skipping, so a question it asks is still looked for');
const box = p[ua + 3];
assert.ok(box.do === 'window' && box.optional && new RegExp(box.title!).test('Confirm') && new RegExp(box.title!).test('CLICK Programming Software') && !new RegExp(box.title!).test('CLICK Programming Software (Version4.00) - NewProject1.ckp - [Main Program]'), 'a message box, never the main window');
assert.ok(/Yes/.test(p[ua + 4].find!.name!) && p[ua + 4].optional);
assert.ok(!p[ua + 5].optional, 'a wait ends the skipping, so its OK is pressed when no box came');
assert.ok(new RegExp(p[ua + 6].title!).test('User Account Setup') && p[ua + 7].find?.name === '^OK$' && p[ua + 7].optional, 'then its OK');
const ctrlN = np!.options![1].steps;
const came = ctrlN.find((s) => s.do === 'window' && s.title !== CLICK_MAIN)!;
assert.ok(new RegExp(came.title!, 'i').test('Startup') && new RegExp(came.title!, 'i').test('Select a CPU Module'), 'Startup or the CPU dialog');
assert.ok(!new RegExp(came.title!, 'i').test('CLICK Programming Software (Version4.00) - NewProject1.ckp - [Main Program]'), 'not the main window');
const startNew = ctrlN.find((s) => s.do === 'click')!;
assert.equal(startNew.optional, true);
assert.equal(startNew.find?.order, 'left');
assert.ok(new RegExp(startNew.find!.name!).test('') && !new RegExp(startNew.find!.name!).test('Close') && !new RegExp(startNew.find!.name!).test('OK'), 'the unnamed picture button, not Close / Help / OK');
assert.equal(ctrlN.indexOf(startNew), ctrlN.indexOf(came) + 1);
const cpu = allSteps(p).find((s) => s.do === 'click' && s.find?.name?.includes('C0'))!;
assert.ok(new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D  CLICK Ethernet Basic PLC'), 'the CPU item by its part number');
assert.ok(!new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D2'), 'not a longer part number');

// modules: one line for the result (no stop in the middle of the run)
assert.equal(modulesLine([]), null);
assert.equal(modulesLine(['C0-16ND3', 'C0-08TR']), 'Add these 2 modules in CLICK\'s System Configuration: slot 1: C0-16ND3, slot 2: C0-08TR.');
assert.match(modulesLine(['C0-16ND3'])!, /^Add this module/);

// nicknames: the Address Picker from the tree (CLICK 4) or the View menu (CLICK 3); the file name typed as it is
const n = nicknamePlan('C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\Line_nicknames.csv');
const picker = allSteps(n).find((s) => s.what === 'the Address Picker');
assert.deepEqual(ways(picker), ['the Navigation tree', 'the View menu']);
assert.ok(picker!.options![0].steps.some((s) => s.do === 'doubleClick' && s.find?.type === 'TreeItem' && new RegExp(s.find.name!).test('Address Picker')));
const imp = n.find((s) => s.what === 'the nickname import');
assert.deepEqual(ways(imp), ['File › Import › Nickname (key tips Alt+F, I, N)', 'the Address Picker\'s Import button', 'the Address Picker\'s File menu'], 'CLICK 4\'s ribbon File menu first (its Address Picker has no Import)');
assert.deepEqual(imp!.options![0].steps.filter((s) => s.do === 'keys').map((s) => s.keys), ['%f', 'i', 'n']);
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
