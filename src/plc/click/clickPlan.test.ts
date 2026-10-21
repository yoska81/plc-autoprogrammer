/// <reference types="node" />
/**
 * Send to CLICK's step plans: a new project with the CPU, the modules left to the user in System Configuration
 * (the run waits until it is closed), the nickname CSV through the Address Picker; no step saves (the bridge
 * refuses those, tools/click-bridge Runner.Guard, and so does saveSteps).
 * Run with:  npx tsx src/plc/click/clickPlan.test.ts
 */
import assert from 'node:assert/strict';
import { CLICK_MAIN, literal, modulesPlan, newProjectPlan, nicknamePlan, saveSteps, setupPlan } from './clickPlan';

const p = newProjectPlan('C0-10DD1E-D');
assert.equal(p[0].do, 'window');
assert.equal(p[0].title, CLICK_MAIN);
assert.deepEqual(p[1].path, ['File', 'New Project']);
const cpu = p.find((s) => s.do === 'click' && s.find?.name?.includes('C0'))!;
assert.ok(new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D  CLICK Ethernet Basic PLC'), 'the CPU item by its part number');
assert.ok(!new RegExp(cpu.find!.name!, 'i').test('C0-10DD1E-D2'), 'not a longer part number');

// modules: none → nothing; else System Configuration opened, the list said, the run waits until it closes
assert.deepEqual(modulesPlan([]), []);
const m = modulesPlan(['C0-16ND3', 'C0-08TR']);
assert.equal(m.at(-1)!.do, 'waitGone');
assert.match(m.find((s) => s.do === 'note')!.text!, /slot 1: C0-16ND3, slot 2: C0-08TR/);

// nicknames: the file name typed into the Open dialog as it is; confirmations optional
const n = nicknamePlan('C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\Line_nicknames.csv');
assert.equal(n.find((s) => s.do === 'setText')!.text, 'C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click\\Line_nicknames.csv');
assert.ok(new RegExp(`^(?:${n.find((s) => s.do === 'menu' && s.path?.[0] === 'File')!.path![2]})$`, 'i').test('Nick Names'));
assert.ok(new RegExp(`^(?:${n.find((s) => s.do === 'menu' && s.path?.[0] === 'File')!.path![2]})$`, 'i').test('Nickname'));
assert.ok(n.filter((s) => s.optional).length === 2 && n.filter((s) => s.optional).every((s, i, a) => i === 0 || n.indexOf(s) === n.indexOf(a[i - 1]) + 1), 'the optional steps together');

// the whole set-up: in order, every step that touches a control after a window, nothing that saves
const all = setupPlan({ cpuId: 'C0-12DD1E-D', modules: ['C0-16ND3'], nicknameCsvPath: 'x.csv' });
assert.equal(all[0].do, 'window');
assert.deepEqual(saveSteps(all), []);
assert.deepEqual(saveSteps([{ do: 'keys', keys: '^s' }, { do: 'menu', path: ['File', 'Save Project As'] }, { do: 'click', find: { name: '^Save$' } }, { do: 'keys', keys: 'abc' }]), [0, 1, 2]);
assert.equal(literal('C0-10DD1E-D'), 'C0-10DD1E-D');
assert.equal(literal('a.b(c)'), 'a\\.b\\(c\\)');
console.log('clickPlan.test: all passed');
