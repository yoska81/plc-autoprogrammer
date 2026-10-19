/// <reference types="node" />
/**
 * One source for the pulse-train and high-speed counter points (program, drawings, checkers):
 *   - CLICK PLUS: the option-slot module's Y1 / Y3 / Y5 are Y001 / Y003 / Y005 (slot 0), its X1–X8 are X001–X008;
 *     with no option module there are none;
 *   - CLICK C0: its own X001–X004 counters, no pulse outputs;
 *   - CLICK addressing puts the option-slot module at slot 0, the stackable modules at slots 1…;
 *   - the program checker reports an error when a motion axis's pulse is not on a pulse output.
 * Run with:  npx tsx src/electrical/highSpeedIo.test.ts
 */
import assert from 'node:assert/strict';
import { highSpeedIo, hsInputsFor, pointsFromText, ptoPointsFor } from './highSpeedIo';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { clickAnalogChannels } from '../plc/core/profiles/clickAnalog';
import { validateProgram } from '../plc/core/validate';
import type { LadderProgram } from '../plc/core/ladder';
import type { IOPoint } from '../types/io';

assert.deepEqual(pointsFromText('Y1, Y3, Y5', 'Y'), ['Y001', 'Y003', 'Y005']);
assert.deepEqual(pointsFromText('X1-X8', 'X'), ['X001', 'X002', 'X003', 'X004', 'X005', 'X006', 'X007', 'X008']);
assert.deepEqual(pointsFromText('X001-X004', 'X'), ['X001', 'X002', 'X003', 'X004']);
assert.deepEqual(pointsFromText('Option Slot 0 module Y1, Y3, Y5 (C2-14D1 sinking) or Y1, Y3 (C2-08D1-xx; 2 axes)', 'Y'), ['Y001', 'Y003', 'Y005'], 'the first alternative');

assert.deepEqual(ptoPointsFor('C2-03CPU', ['C2-14D1']), ['Y001', 'Y003', 'Y005']);
assert.deepEqual(hsInputsFor('C2-03CPU', ['C2-14D1']), ['X001', 'X002', 'X003', 'X004', 'X005', 'X006', 'X007', 'X008']);
assert.deepEqual(ptoPointsFor('C2-01CPU', ['C2-08D2-4VC']), ['Y001', 'Y003'], 'C2-08 modules: 2 axes');
assert.deepEqual(ptoPointsFor('C2-03CPU', ['C2-14DR']), [], 'the relay option module has no pulse outputs');
assert.deepEqual(highSpeedIo('C2-03CPU', []).pulseOutputs, []);
assert.match(highSpeedIo('C2-03CPU', []).note, /option-slot module \(none chosen\)/);
assert.deepEqual(ptoPointsFor('C0-11DD2E-D'), [], 'CLICK C0: no pulse outputs');
assert.deepEqual(hsInputsFor('C0-11DD2E-D').slice(0, 2), ['X001', 'X002']);

// CLICK PLUS addressing: the option module is slot 0; a stackable module (listed first or not) is slot 1.
const profile = getProfile('click');
const cpu = getCpu(profile, 'C2-03CPU');
const stack = ['C0-16ND3', 'C2-14D1'].filter((pn) => moduleSlots([pn])[0].inputs > 0);
const mods = moduleSlots(stack);
assert.ok(mods.some((m) => m.optionSlot) && mods.some((m) => !m.optionSlot), `fixture modules ${stack.join(', ')}`);
const io = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `I${i}`, description: `In ${i}`, type: 'input', category: 'Station 1' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `Q${i}`, description: `Out ${i}`, type: 'output', category: 'Station 1' })),
] as IOPoint[];
const addr = resolveAddresses(profile, cpu, io, mods);
assert.deepEqual(['I0', 'I7', 'I8', 'Q0', 'Q2'].map((id) => addr.get(id)), ['X001', 'X008', 'X101', 'Y001', 'Y003'], 'option module X001–X008 / Y001…, then slot 1');
assert.equal(clickAnalogChannels(cpu, moduleSlots(['C2-08D2-4VC']))[0].label, 'Option slot CH1');

// Automatic addresses: an axis's pulse output takes a pulse-train point even when listed after other outputs.
const motionIo = [
  { id: 'Q1', description: 'Conveyor motor', type: 'output', category: 'Conveyor' },
  { id: 'Q2', description: 'Axis 1 servo direction', type: 'output', category: 'Servo/Axis' },
  { id: 'Q3', description: 'Axis 1 servo pulse', type: 'output', category: 'Servo/Axis' },
  { id: 'Q4', description: 'Axis 2 servo pulse', type: 'output', category: 'Servo/Axis' },
] as IOPoint[];
const ma = resolveAddresses(profile, cpu, motionIo, moduleSlots(['C2-14D1']));
assert.deepEqual(['Q1', 'Q2', 'Q3', 'Q4'].map((id) => ma.get(id)), ['Y002', 'Y004', 'Y001', 'Y003'], 'pulses on Y001 / Y003, the rest around them');

// The checker: a pulse on a pulse output is fine; on Y002 it is an error.
const prog = (pulse: string): LadderProgram => ({ rungs: [], tags: [], motion: { axes: [{ axis: 1, name: 'Axis 1', pulse, direction: 'Y002', position: 'DD1', velocity: 'DD2', pulsesPerUnit: 1, units: 'mm' }], instructions: [], counters: [] } });
const pulseErr = (pulse: string, outs: string[]) => validateProgram(prog(pulse), profile, new Set(['Y001', 'Y002', 'Y004']), undefined, { pulseOutputs: outs }).filter((i) => /pulse train/.test(i.message)).map((i) => i.message);
assert.deepEqual(pulseErr('Y001', ptoPointsFor('C2-03CPU', ['C2-14D1'])), []);
assert.match(pulseErr('Y004', ptoPointsFor('C2-03CPU', ['C2-14D1']))[0], /Axis 1: its pulse output Y004 cannot make a pulse train on this PLC — use Y001 \/ Y003 \/ Y005/);
assert.match(pulseErr('Y001', [])[0], /has no pulse-train outputs/);

console.log('highSpeedIo tests passed');
