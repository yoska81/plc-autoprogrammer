/// <reference types="node" />
/**
 * VFD control wiring / parameter tests. Run with:  npx tsx src/electrical/vfd.test.ts
 */
import assert from 'node:assert/strict';
import { driveControls, driveParamsCsv, type DriveIoPoint, type DriveSpec } from './vfd';
import type { AnalogSetupRow } from '../plc/core/analog';

const drive = (over: Partial<DriveSpec>): DriveSpec => ({
  tag: 'VFD1', partNumber: 'GS23-45P0', series: 'GS20', outputAmps: 9, motorTag: 'M3', motorDescription: 'Belt 1 motor',
  motorHp: 5, motorVolts: 460, fla: 7.6, reversing: false, ...over,
});
const pt = (address: string, type: 'input' | 'output', description: string, deviceTag = ''): DriveIoPoint => ({ address, type, description, deviceTag, deviceType: 'vfd-input' });
const speedRow = (over: Partial<AnalogSetupRow>): AnalogSetupRow => ({
  pointId: 'Q010', description: 'Belt 1 speed reference', kind: 'output', channel: 'Slot 1 CH1', partNumber: 'C0-04DA-1',
  terminal: 'CH1', address: 'DF1', range: '4-20mA', scaleMin: 0, scaleMax: 50, units: 'Hz', ...over,
});
const param = (c: ReturnType<typeof driveControls>[number], p: string) => c.params.find((x) => x.param === p)?.value;

// GS20, reversing, presets, fault + running, analog 4-20 mA speed, sinking PLC outputs.
const io = [
  pt('Y001', 'output', 'Belt 1 run'), pt('Y002', 'output', 'Belt 1 reverse'), pt('Y003', 'output', 'Belt 1 preset speed 1'),
  pt('X001', 'input', 'Belt 1 drive fault'), pt('X002', 'input', 'Belt 1 drive running'),
  pt('Y004', 'output', 'Belt 2 run', 'VFD2'), pt('X003', 'input', 'VFD2 fault', 'VFD2'),
];
const [a, b] = driveControls([drive({ reversing: true }), drive({ tag: 'VFD2', motorTag: 'M4', motorDescription: 'Belt 2 motor' })], io, [speedRow({})], 'sinking', '24+S');
assert.equal(a.series, 'GS20');
assert.deepEqual(a.terminals.map((t) => [t.role, t.address, t.terminal]), [
  ['run', 'Y001', 'FWD/DI1'], ['reverse', 'Y002', 'REV/DI2'], ['preset', 'Y003', 'DI3'], ['fault', 'X001', 'R1O'], ['running', 'X002', 'DO1'], ['speed', 'DF1', 'AI2'],
]);
assert.equal(a.terminals[0].common, 'DCM (24+S)', 'sinking PLC outputs: safety-switched +24 V on DCM (GS20 App. D-4)');
assert.equal(param(a, 'P00.20'), '2 (external analog input)');
assert.equal(param(a, 'P00.21'), '1 (external terminals)');
assert.equal(param(a, 'P03.01'), '1 (frequency command)');
assert.equal(param(a, 'P03.29'), '0 (4–20 mA)');
assert.equal(param(a, 'P01.10'), '50.00 Hz', 'upper limit = speed reference top');
assert.equal(param(a, 'P02.13'), '11 (malfunction indication)');
assert.equal(param(a, 'P02.16'), '1 (indication during RUN)');
assert.equal(param(a, 'P02.03'), '1 (multi-step speed command 1)');
assert.equal(param(a, 'P04.00'), 'SET ON SITE');
assert.equal(param(a, 'P05.03'), 'NAMEPLATE');
assert.equal(param(a, 'P01.12'), 'SET ON SITE', 'accel time is never guessed');
assert.ok(a.notes.some((n) => /STO1\/STO2/.test(n)));
assert.ok(a.notes.some((n) => /open-collector/.test(n)));
// Belt 2 gets only its own points (whole-word match, explicit device tag wins).
assert.deepEqual(b.terminals.map((t) => t.address), ['Y004', 'X003']);
assert.equal(b.speedSource, 'keypad');
assert.equal(param(b, 'P00.20'), '0 (digital keypad)');

// GS10, sourcing outputs, 0-10 V speed reference on its single AI.
const [g] = driveControls([drive({ partNumber: 'GS13N-42P0', series: 'GS10', motorDescription: 'Mixer' })], [pt('Y001', 'output', 'Mixer run')],
  [speedRow({ description: 'Mixer speed', range: '0-10V', units: 'Hz', scaleMax: 60 })], 'sourcing', '24+S');
assert.equal(g.series, 'GS10');
assert.deepEqual(g.terminals.map((t) => t.terminal), ['FWD/DI1', 'AI']);
assert.equal(g.terminals[0].common, 'DCM (0V)');
assert.equal(param(g, 'P03.28'), '0 (0–10 V)');
assert.ok(!g.notes.some((n) => /STO/.test(n)), 'GS10 has no STO terminals');

// Vertical load: braking note. No run output: flagged.
const [h] = driveControls([drive({ motorDescription: 'Hoist motor' })], [], [], 'sinking', '24+S');
assert.ok(h.notes.some((n) => /braking resistor/i.test(n)));
assert.ok(h.notes.some((n) => /No PLC output runs/.test(n)));

// Safety stop: STO on GS20, contactor, nothing.
assert.equal(a.safetyStop, 'none');
const [s1] = driveControls([drive({ sto: true })], [], [], 'sinking', '24+S');
assert.equal(s1.safetyStop, 'sto');
assert.ok(s1.notes.some((n) => /STO1 and STO2 from the safety relay/.test(n)));
const [s2] = driveControls([drive({ partNumber: 'GS13N-42P0', series: 'GS10', sto: true })], [], [], 'sinking', '24+S');
assert.equal(s2.safetyStop, 'none', 'GS10 has no STO');
assert.ok(s2.notes.some((n) => /no STO terminals/.test(n)));
const [s3] = driveControls([drive({ contactor: true })], [], [], 'sinking', '24+S');
assert.equal(s3.safetyStop, 'contactor');

const csv = driveParamsCsv([a]);
assert.match(csv.split('\r\n')[0], /^Drive,Part number,Motor,Parameter/);
assert.ok(csv.includes('"VFD1","GS23-45P0","M3","P00.20"'));
assert.ok(!/[−→≤Ω]/.test(JSON.stringify([a, b, g, h])), 'drawing text stays in the PDF font');

console.log('vfd tests passed');
