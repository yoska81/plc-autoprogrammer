/// <reference types="node" />
/**
 * Simulator tests. Run with:  npx tsx src/sim/engine.test.ts
 */
import assert from 'node:assert/strict';
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, Rung } from '../plc/ladder';
import { compileMath, createSimulator } from './engine';
import { buildMachineModel, machineInputs, setDeviceBypass, stepMachine } from './machineModel';
import { blockAddresses, devicesInBlock, externalSignals, programBlocks } from './blocks';
import { SimController } from './controller';
import type { ConveyorDevice, CylinderDevice, MotorDevice } from './machineModel';
import { CONVEYOR_IO, CONVEYOR_PROGRAM, CONVEYOR_WIRING } from './__fixtures__/conveyor';
import { DESIGN, HMI, LADDER } from '../preview/sampleProject';
import { validateProgram } from '../plc/validate';
import { getProfile } from '../plc/profiles';
import { rungAddresses, rungWrites } from '../plc/ladder';
import { rungReads } from './blocks';
import { crossReference, issueStatus } from '../components/program/programIndex';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

let rid = 0;
const rung = (branches: LadderElement[][], outputs: LadderOutput[]): Rung => ({ id: `t${++rid}`, comment: '', branches, outputs });
const prog = (...rungs: Rung[]): LadderProgram => ({ rungs, tags: [] });
const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const OUT = (address: string): LadderOutput => ({ type: 'OUT', address });

console.log('engine');

test('seal-in circuit (start/stop)', () => {
  const sim = createSimulator(prog(rung([[NO('X001'), NC('X002')], [NO('Y001'), NC('X002')]], [OUT('Y001')])));
  sim.step();
  assert.equal(sim.readBit('Y001'), false);
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readBit('Y001'), true);
  sim.setInput('X001', false); sim.run(100);
  assert.equal(sim.readBit('Y001'), true, 'stays sealed in');
  sim.setInput('X002', true); sim.step();
  assert.equal(sim.readBit('Y001'), false, 'stop drops it');
  sim.setInput('X002', false); sim.step();
  assert.equal(sim.readBit('Y001'), false);
  const p = sim.rungPower().get(`t${rid}`)!;
  assert.deepEqual(p.closed, [[false, true], [false, true]]);
  assert.deepEqual(p.branches, [[false, false], [false, false]]);
});

test('NC contact and SC bits', () => {
  const sim = createSimulator(prog(
    rung([[NC('X001')]], [OUT('C1')]),
    rung([[NO('SC2')]], [OUT('C2')]),
    rung([[NO('SC1')]], [OUT('C3')]),
    rung([[NO('SC7')]], [OUT('C4')]),
  ));
  sim.step();
  assert.equal(sim.readBit('C1'), true);
  assert.equal(sim.readBit('C2'), true, 'SC2 first scan');
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readBit('C1'), false);
  assert.equal(sim.readBit('C2'), false, 'SC2 only on first scan');
  assert.equal(sim.readBit('C3'), true);
  sim.reset(); sim.run(490);
  assert.equal(sim.readBit('C4'), false);
  sim.run(20);
  assert.equal(sim.readBit('C4'), true, 'SC7 on after 500 ms');
  sim.run(500);
  assert.equal(sim.readBit('C4'), false, 'SC7 off after 1000 ms');
});

test('SET / RST latch and last write wins', () => {
  const sim = createSimulator(prog(
    rung([[NO('X001')]], [{ type: 'SET', address: 'C1' }]),
    rung([[NO('X002')]], [{ type: 'RST', address: 'C1' }]),
    rung([[NO('C1')]], [OUT('Y001')]),
  ));
  sim.setInput('X001', true); sim.step();
  sim.setInput('X001', false); sim.step();
  assert.equal(sim.readBit('C1'), true);
  assert.equal(sim.readBit('Y001'), true);
  sim.setInput('X002', true); sim.step();
  assert.equal(sim.readBit('C1'), false);
  const dbl = createSimulator(prog(rung([[NO('X001')]], [OUT('Y001')]), rung([[NC('X001')]], [OUT('Y001')])));
  dbl.setInput('X001', true); dbl.step();
  assert.equal(dbl.readBit('Y001'), false, 'second OUT wins');
});

test('rising / falling edge contacts', () => {
  const sim = createSimulator(prog(
    rung([[{ type: 'RISE', address: 'X001' }]], [OUT('C1')]),
    rung([[{ type: 'FALL', address: 'X001' }]], [OUT('C2')]),
  ));
  sim.step();
  assert.equal(sim.readBit('C1'), false);
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readBit('C1'), true, 'one scan on rise');
  sim.step();
  assert.equal(sim.readBit('C1'), false);
  sim.setInput('X001', false); sim.step();
  assert.equal(sim.readBit('C2'), true, 'one scan on fall');
  sim.step();
  assert.equal(sim.readBit('C2'), false);
});

test('ON-delay timer 3 s', () => {
  const sim = createSimulator(prog(rung([[NO('X001')]], [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }])));
  sim.setInput('X001', true);
  sim.run(2990);
  assert.equal(sim.readBit('T1'), false, 'not done at 2.99 s');
  assert.equal(sim.readWord('TD1'), 2);
  sim.run(10);
  assert.equal(sim.state.timeMs, 3000);
  assert.equal(sim.readBit('T1'), true, 'done at 3.00 s');
  assert.equal(sim.readWord('TD1'), 3);
  sim.setInput('X001', false); sim.step();
  assert.equal(sim.readBit('T1'), false);
  assert.equal(sim.readWord('TD1'), 0, 'non-retentive resets');
});

test('retentive timer + reset', () => {
  const sim = createSimulator(prog(rung([[NO('X001')]], [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '1000', unit: 'ms', accumulate: true, resetAddress: 'X002' }])));
  sim.setInput('X001', true); sim.run(600);
  sim.setInput('X001', false); sim.run(1000);
  assert.equal(sim.readWord('TD2'), 600, 'holds while off');
  sim.setInput('X001', true); sim.run(390);
  assert.equal(sim.readBit('T2'), false);
  sim.run(10);
  assert.equal(sim.readBit('T2'), true, 'done after 1000 ms total');
  sim.setInput('X001', false); sim.step();
  assert.equal(sim.readBit('T2'), true, 'stays done');
  sim.setInput('X002', true); sim.step();
  assert.equal(sim.readBit('T2'), false);
  assert.equal(sim.readWord('TD2'), 0);
});

test('OFF-delay timer', () => {
  const sim = createSimulator(prog(rung([[NO('X001')]], [{ type: 'TMR', address: 'T3', mode: 'OFF_DELAY', preset: '500', unit: 'ms', accumulate: false, resetAddress: null }])));
  sim.step();
  assert.equal(sim.readBit('T3'), false);
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readBit('T3'), true, 'on immediately');
  sim.run(2000);
  assert.equal(sim.readBit('T3'), true);
  sim.setInput('X001', false); sim.run(490);
  assert.equal(sim.readBit('T3'), true, 'held 490 ms after off');
  sim.run(10);
  assert.equal(sim.readBit('T3'), false, 'off at 500 ms');
});

test('UP / DOWN counters + reset', () => {
  const sim = createSimulator(prog(
    rung([[NO('X001')]], [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '3', resetAddress: 'X002' }]),
    rung([[NO('X001')]], [{ type: 'CNT', address: 'CT2', direction: 'DOWN', preset: '2', resetAddress: 'X002' }]),
  ));
  for (let i = 0; i < 2; i++) { sim.setInput('X001', true); sim.run(30); sim.setInput('X001', false); sim.run(30); }
  assert.equal(sim.readWord('CTD1'), 2, 'counts edges, not scans');
  assert.equal(sim.readBit('CT1'), false);
  assert.equal(sim.readWord('CTD2'), 0);
  assert.equal(sim.readBit('CT2'), true, 'down counter done at 0');
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readBit('CT1'), true);
  sim.setInput('X002', true); sim.step();
  assert.equal(sim.readWord('CTD1'), 0);
  assert.equal(sim.readBit('CT1'), false);
  assert.equal(sim.readWord('CTD2'), 2, 'down counter reloads preset');
});

test('CMP + COPY step sequencer', () => {
  const cmp = (left: string, op: CompareOp, right: string): LadderElement => ({ type: 'CMP', left, op, right });
  const sim = createSimulator(prog(
    rung([[NO('SC2')]], [{ type: 'COPY', source: '1', dest: 'DS1' }]),
    rung([[cmp('DS1', '==', '1'), NO('X001')]], [{ type: 'COPY', source: '2', dest: 'DS1' }]),
    rung([[cmp('DS1', '==', '2')]], [OUT('Y001'), { type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '100', unit: 'ms', accumulate: false, resetAddress: null }]),
    rung([[cmp('DS1', '==', '2'), NO('T1')]], [{ type: 'COPY', source: '3', dest: 'DS1' }]),
    rung([[cmp('DS1', '>=', '3')]], [OUT('Y002')]),
    rung([[cmp('DF1', '>', '1.5')]], [OUT('C9')]),
  ));
  sim.step();
  assert.equal(sim.readWord('DS1'), 1);
  sim.setInput('X001', true); sim.step();
  assert.equal(sim.readWord('DS1'), 2);
  assert.equal(sim.readBit('Y001'), true);
  sim.run(100);
  assert.equal(sim.readWord('DS1'), 3);
  assert.equal(sim.readBit('Y002'), true);
  sim.write('DF1', 1.75); sim.step();
  assert.equal(sim.readBit('C9'), true, 'float compare');
});

test('MATH formulas', () => {
  assert.equal(compileMath('(DS1 + 2) * 3 MOD 4')((a) => (a === 'DS1' ? 5 : 0)), 1);
  assert.equal(compileMath('-DS1 / 2 + 10 % 4')((a) => (a === 'DS1' ? 8 : 0)), -2);
  assert.equal(compileMath('DS1 / 0')(() => 3), 0, 'divide by zero gives 0');
  assert.throws(() => compileMath('DS1 + * 2'));
  assert.throws(() => compileMath('alert(1)'));
  const sim = createSimulator(prog(
    rung([[{ type: 'RISE', address: 'X001' }]], [{ type: 'MATH', dest: 'DS1', expression: 'DS1 + 1' }]),
    rung([], [{ type: 'MATH', dest: 'DF1', expression: 'DS1 / 4' }, { type: 'MATH', dest: 'DS2', expression: 'DS1 / 4' }]),
    rung([[NO('X009')]], [{ type: 'MATH', dest: 'DS3', expression: 'DS1 +' }]),
  ));
  for (let i = 0; i < 3; i++) { sim.setInput('X001', true); sim.step(); sim.setInput('X001', false); sim.step(); }
  assert.equal(sim.readWord('DS1'), 3);
  assert.equal(sim.readWord('DF1'), 0.75, 'DF keeps fractions');
  assert.equal(sim.readWord('DS2'), 0, 'DS truncates');
  sim.setInput('X009', true); sim.step();
  assert.equal(sim.state.errors.length, 1, 'bad formula reported, not thrown');
});

console.log('machine model');

test('builds devices for the conveyor cell', () => {
  const m = buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING);
  const kinds = m.devices.map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['conveyor', 'cylinder', 'estop', 'motor', 'pushbutton', 'pushbutton', 'safetyRelay'].sort());
  const cyl = m.devices.find((d): d is CylinderDevice => d.kind === 'cylinder')!;
  assert.equal(cyl.extendOutput, 'Y002');
  assert.equal(cyl.extendedInput, 'X005');
  const conv = m.devices.find((d): d is ConveyorDevice => d.kind === 'conveyor')!;
  assert.deepEqual(conv.sensors.map((s) => s.input), ['X004']);
  assert.equal(conv.pusherId, cyl.id);
  const inputs = machineInputs(m);
  assert.equal(inputs.get('X001'), true, 'safety OK at start');
  assert.equal(inputs.get('X003'), true, 'NC stop button closed when released');
  assert.equal(inputs.get('X002'), false);
});

test('pairs solenoids / motors with feedback by description', () => {
  const io = [
    { address: 'Y001', description: 'Clamp 1 extend solenoid', type: 'output', category: 'Pneumatic' },
    { address: 'Y002', description: 'Clamp 1 retract solenoid', type: 'output', category: 'Pneumatic' },
    { address: 'Y003', description: 'Clamp 2 solenoid', type: 'output', category: 'Pneumatic' },
    { address: 'Y004', description: 'Pump motor starter', type: 'output', category: 'Analog/Process' },
    { address: 'Y005', description: 'Fault light red', type: 'output', category: 'Operator/HMI' },
    { address: 'X001', description: 'Clamp 2 extended', type: 'input', category: 'Pneumatic' },
    { address: 'X002', description: 'Clamp 1 retracted', type: 'input', category: 'Pneumatic' },
    { address: 'X003', description: 'Clamp 1 extended', type: 'input', category: 'Pneumatic' },
    { address: 'X004', description: 'Pump running', type: 'input', category: 'Analog/Process' },
    { address: 'X005', description: 'Emergency stop', type: 'input', category: 'Safety' },
  ];
  const m = buildMachineModel(io, []);
  const cyls = m.devices.filter((d): d is CylinderDevice => d.kind === 'cylinder');
  assert.equal(cyls.length, 2);
  assert.deepEqual([cyls[0].extendOutput, cyls[0].retractOutput, cyls[0].extendedInput, cyls[0].retractedInput], ['Y001', 'Y002', 'X003', 'X002']);
  assert.deepEqual([cyls[1].extendOutput, cyls[1].extendedInput], ['Y003', 'X001']);
  const pump = m.devices.find((d): d is MotorDevice => d.kind === 'motor')!;
  assert.equal(pump.feedbackInput, 'X004');
  assert.ok(m.devices.some((d) => d.kind === 'indicator' && d.color === 'red'));
  assert.ok(m.devices.some((d) => d.kind === 'estop' && d.input === 'X005'));
});

test('cylinder travel and sensors', () => {
  const m = buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING);
  const outs = new Map([['Y002', true]]);
  let ext = false, at = 0;
  for (let t = 10; t <= 1000; t += 10) {
    const ch = stepMachine(m, outs, 10);
    if (ch.get('X005') === true) { ext = true; at = t; break; }
  }
  assert.ok(ext, 'extended sensor turns on');
  assert.equal(at, 800, 'after the 800 ms travel time');
  outs.set('Y002', false);
  const ch = stepMachine(m, outs, 10);
  assert.equal(ch.get('X005'), false, 'leaves extended as soon as it retracts');
});

test('motor running feedback after 200 ms', () => {
  const m = buildMachineModel([
    { address: 'Y001', description: 'Pump motor', type: 'output', category: 'Analog/Process' },
    { address: 'X001', description: 'Pump running feedback', type: 'input', category: 'Analog/Process' },
  ], []);
  const outs = new Map([['Y001', true]]);
  for (let i = 0; i < 19; i++) stepMachine(m, outs, 10);
  assert.equal(m.inputs.get('X001'), false);
  stepMachine(m, outs, 10);
  assert.equal(m.inputs.get('X001'), true);
});

test('part flow: conveyor brings a part to the eye, pusher clears it', () => {
  const m = buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING);
  const conv = m.devices.find((d): d is ConveyorDevice => d.kind === 'conveyor')!;
  const outs = new Map([['Y001', false], ['Y002', false]]);
  for (let i = 0; i < 100; i++) stepMachine(m, outs, 10);
  assert.equal(conv.state.parts.length, 0, 'no parts while stopped');
  outs.set('Y001', true);
  let seenAt = 0;
  for (let t = 10; t <= 6000 && !seenAt; t += 10) if (stepMachine(m, outs, 10).get('X004')) seenAt = t;
  assert.ok(seenAt > 3000 && seenAt < 4000, `part reaches the eye after ~3.4 s (got ${seenAt})`);
  outs.set('Y001', false);
  outs.set('Y002', true);
  let cleared = 0;
  for (let t = 10; t <= 2000 && !cleared; t += 10) if (stepMachine(m, outs, 10).get('X004') === false) cleared = t;
  assert.ok(cleared >= 700 && cleared <= 800, `pusher clears the part near full stroke (got ${cleared})`);
  assert.equal(conv.state.removed, 1);
});

test('closed loop: sample program runs the whole cycle', () => {
  const sim = createSimulator(CONVEYOR_PROGRAM);
  const m = buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING);
  for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
  const pb = m.devices.find((d) => d.kind === 'pushbutton' && d.input === 'X002');
  assert.ok(pb && pb.kind === 'pushbutton');
  const scan = (ms: number) => {
    for (let t = 0; t < ms; t += 10) {
      for (const [a, v] of stepMachine(m, sim.outputs(), 10)) sim.setInput(a, v);
      sim.step(10);
    }
  };
  scan(50);
  pb.state.pressed = true; scan(100); pb.state.pressed = false; scan(100);
  assert.equal(sim.readBit('Y001'), true, 'conveyor running');
  let pushed = false;
  for (let i = 0; i < 600 && !pushed; i++) { scan(10); pushed = sim.readBit('Y002'); }
  assert.ok(pushed, 'pusher fires when the part arrives');
  scan(10); // the conveyor rung sits above the push rung, so it sees C3 one scan later
  assert.equal(sim.readBit('Y001'), false, 'conveyor stops while pushing');
  scan(1500);
  assert.equal(sim.readBit('Y002'), false, 'pusher retracts');
  assert.equal(sim.readBit('Y001'), true, 'conveyor restarts');
  assert.equal(sim.readBit('C10'), false, 'no fault');
  const es = m.devices.find((d) => d.kind === 'estop');
  assert.ok(es && es.kind === 'estop');
  es.state.pressed = true; scan(50);
  assert.equal(sim.readBit('Y001'), false, 'E-stop stops the conveyor');
  assert.equal(sim.readBit('C2'), false);
});

console.log('bypass & forces');

test('rung bypass: skipped, outputs hold last value', () => {
  const r1 = rung([[NO('X001')]], [OUT('Y001'), { type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '100', unit: 'ms', accumulate: false, resetAddress: null }]);
  const sim = createSimulator(prog(r1));
  sim.setInput('X001', true); sim.run(50);
  sim.bypassRung(r1.id, true);
  sim.setInput('X001', false); sim.run(200);
  assert.equal(sim.readBit('Y001'), true, 'OUT holds while bypassed');
  assert.equal(sim.readWord('TD1'), 50, 'timer frozen');
  assert.equal(sim.rungPower().get(r1.id)?.bypassed, true);
  sim.bypassRung(r1.id, false); sim.step();
  assert.equal(sim.readBit('Y001'), false, 'executes again');
});

test('forces win over program writes for the whole scan', () => {
  const sim = createSimulator(prog(
    rung([[NO('X001')]], [OUT('C1')]),
    rung([[NO('C1')]], [OUT('Y001')]),
    rung([], [{ type: 'COPY', source: '5', dest: 'DS1' }]),
    rung([[{ type: 'CMP', left: 'DS1', op: '==', right: '7' }]], [OUT('C2')]),
  ));
  sim.force('C1', true);
  sim.force('DS1', 7);
  sim.step();
  assert.equal(sim.readBit('C1'), true, 'OUT C1 (false) ignored');
  assert.equal(sim.readBit('Y001'), true, 'later rung reads the forced value');
  assert.equal(sim.readWord('DS1'), 7, 'COPY ignored');
  assert.equal(sim.readBit('C2'), true);
  sim.force('X001', true); sim.force('C1', null); sim.step();
  assert.equal(sim.readBit('C1'), true, 'forced input drives the logic');
  sim.clearForces(); sim.step();
  assert.equal(sim.readBit('C1'), false);
  assert.equal(sim.readWord('DS1'), 5);
});

test('device bypass: cylinder, motor, sensor, E-stop', () => {
  const m = buildMachineModel([
    { address: 'Y001', description: 'Lift solenoid', type: 'output', category: 'Pneumatic' },
    { address: 'X001', description: 'Lift extended', type: 'input', category: 'Pneumatic' },
    { address: 'X002', description: 'Lift retracted', type: 'input', category: 'Pneumatic' },
    { address: 'Y002', description: 'Pump motor', type: 'output', category: 'Analog/Process' },
    { address: 'X003', description: 'Pump running', type: 'input', category: 'Analog/Process' },
    { address: 'X004', description: 'Guard door closed', type: 'input', category: 'Safety' },
    { address: 'X005', description: 'Emergency stop', type: 'input', category: 'Safety' },
  ], []);
  const id = (k: string) => m.devices.find((d) => d.kind === k)!.id;
  setDeviceBypass(m, id('cylinder'), true);
  setDeviceBypass(m, id('motor'), true);
  setDeviceBypass(m, id('sensor'), true, true);
  const outs = new Map([['Y001', true], ['Y002', true]]);
  stepMachine(m, outs, 10);
  assert.equal(m.inputs.get('X001'), true, 'extended sensor follows the solenoid in one scan');
  assert.equal(m.inputs.get('X002'), false);
  assert.equal(m.inputs.get('X003'), true, 'motor feedback follows the command at once');
  assert.equal(m.inputs.get('X004'), true, 'sensor held at the chosen value');
  const es = m.devices.find((d) => d.kind === 'estop')!;
  if (es.kind === 'estop') es.state.pressed = true;
  stepMachine(m, outs, 10);
  assert.equal(m.inputs.get('X005'), false, 'pressed E-stop opens its contact');
  setDeviceBypass(m, es.id, true);
  stepMachine(m, outs, 10);
  assert.equal(m.inputs.get('X005'), true, 'bypassed E-stop reads healthy');
});

console.log('blocks');

test('blocks, external signals and devices of a block', () => {
  const blocks = programBlocks(CONVEYOR_PROGRAM);
  assert.deepEqual(blocks.map((b) => [b.id, b.rungIds.length]), [['conveyor', 3], ['pusher', 4]]);
  const conv = externalSignals(CONVEYOR_PROGRAM, 'conveyor');
  assert.deepEqual(conv.map((s) => [s.address, s.value]), [['C3', false], ['C10', false]], 'NC-read bits held OFF');
  const push = externalSignals(CONVEYOR_PROGRAM, 'pusher');
  assert.deepEqual(push.map((s) => [s.address, s.value]), [['C1', true], ['C2', true]], 'NO-read bits held ON');
  const m = buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING);
  const kinds = (ids: Set<string>) => m.devices.filter((d) => ids.has(d.id)).map((d) => d.kind).sort();
  assert.deepEqual(kinds(devicesInBlock(m.devices, blockAddresses(CONVEYOR_PROGRAM, 'pusher'))), ['conveyor', 'cylinder', 'motor', 'pushbutton']);
  assert.deepEqual(kinds(devicesInBlock(m.devices, blockAddresses(CONVEYOR_PROGRAM, 'conveyor'))), ['conveyor', 'estop', 'motor', 'pushbutton', 'pushbutton', 'safetyRelay']);
  const general = programBlocks({ rungs: [rung([], [OUT('C1')])], tags: [] });
  assert.deepEqual(general.map((b) => b.name), ['General']);
});

test('controller: pusher block alone with held signals, block-only run, clear all', () => {
  const ctl = new SimController(CONVEYOR_PROGRAM, CONVEYOR_IO, CONVEYOR_WIRING);
  ctl.selectBlock('pusher');
  ctl.setBlockOnly(true);
  let s = ctl.getSnapshot();
  assert.equal(s.skippedRungs.size, 3);
  assert.equal(s.holds.get('C2'), true);
  // No Start pressed: C2 is held ON, so the pusher reacts to a part by itself.
  const conv = s.devices.find((d) => d.kind === 'conveyor')!;
  ctl.addPart(conv.id);
  ctl.force('Y001', true); // conveyor rung is skipped: run the belt by force
  ctl.advance(5000);
  s = ctl.getSnapshot();
  assert.ok(s.log.some((e) => e.address === 'Y002' && e.value), 'pusher fired');
  assert.ok(s.log.some((e) => e.address === 'X005' && e.value), 'pusher reached extended');
  assert.equal(s.bits.get('C10') ?? false, false, 'no fault');
  assert.equal(s.bits.get('C1'), true, 'held');
  ctl.bypassRung('r_flt', true);
  const cyl = s.devices.find((d) => d.kind === 'cylinder')!;
  ctl.setDeviceBypass(cyl.id, true);
  ctl.clearAll();
  s = ctl.getSnapshot();
  assert.equal(s.forces.size + s.holds.size + s.rungBypass.size + s.skippedRungs.size, 0);
  assert.ok(!s.devices.some((d) => d.bypass?.on));
  ctl.selectBlock(null);
  assert.equal(ctl.getSnapshot().block, null);
});

console.log('\nretentive memory, register presets, HMI presses');

test('power cycle keeps DS registers and counters, clears bits and timers', () => {
  const sim = createSimulator(prog(
    rung([[NO('X001')]], [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '100', resetAddress: null }]),
    rung([[NO('X002')]], [{ type: 'MATH', dest: 'DS5', expression: 'DS5 + 7' }]),
    rung([[NO('X002')]], [OUT('C1')]),
    rung([[NO('X002')]], [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '10', unit: 'sec', accumulate: false, resetAddress: null }]),
  ));
  sim.setInput('X001', true); sim.step(); sim.setInput('X001', false); sim.step();
  sim.setInput('X001', true); sim.step();
  sim.setInput('X002', true); sim.step(); sim.run(1000);
  const ds5 = sim.readWord('DS5');
  assert.ok(ds5 > 0);
  sim.reset();
  assert.equal(sim.readWord('CTD1'), 2, 'counter value is retentive');
  assert.equal(sim.readWord('DS5'), ds5, 'DS is retentive');
  assert.equal(sim.readBit('C1'), false, 'C bits are not');
  assert.equal(sim.readWord('TD1'), 0, 'timers are not');
  sim.step();
  assert.equal(sim.readWord('CTD1'), 2, 'no count after the power cycle without an edge');
  sim.reset({ clearRetentive: true });
  assert.equal(sim.readWord('CTD1'), 0);
  assert.equal(sim.readWord('DS5'), 0);
});

test('custom retentive ranges', () => {
  const sim = createSimulator(prog(rung([[NO('SC1')]], [{ type: 'COPY', source: '5', dest: 'DS1' }, { type: 'COPY', source: '6', dest: 'DD1' }])), { retentive: (a) => a === 'DD1' });
  sim.step(); sim.reset();
  assert.equal(sim.readWord('DS1'), 0);
  assert.equal(sim.readWord('DD1'), 6);
});

test('timer preset from a DS register, changed while running', () => {
  const sim = createSimulator(prog(
    rung([[NO('SC2')]], [{ type: 'COPY', source: '3', dest: 'DS1' }]),
    rung([[NO('X001')]], [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1', unit: 'sec', accumulate: false, resetAddress: null }]),
  ));
  sim.setInput('X001', true);
  sim.run(2990);
  assert.equal(sim.readBit('T1'), false);
  assert.equal(sim.readWord('TD1'), 2);
  sim.run(20);
  assert.equal(sim.readBit('T1'), true, '3 s from DS1');
  sim.write('DS1', 5);
  sim.step();
  assert.equal(sim.readBit('T1'), false, 'new setpoint applies at once');
  sim.run(2000);
  assert.equal(sim.readBit('T1'), true);
});

test('SC7 rising edge flips a heartbeat every second', () => {
  const sim = createSimulator(prog(
    rung([[{ type: 'RISE', address: 'SC7' }]], [OUT('C12')]),
    rung([[NO('C12'), NC('C1203')], [NC('C12'), NO('C1203')]], [OUT('C1203')]),
  ));
  const seen: boolean[] = [];
  for (let i = 0; i < 4; i++) { sim.run(1000); seen.push(sim.readBit('C1203')); }
  assert.deepEqual(seen, [true, false, true, false]);
});

test('controller: HMI momentary press shorter than a scan is still seen once', () => {
  const ctl = new SimController(prog(rung([[NO('C1001')]], [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '99', resetAddress: null }])), [], []);
  ctl.handle.write('C1001', true);
  ctl.handle.write('C1001', false);
  assert.equal(ctl.sim.readBit('C1001'), true, 'held until a scan ran');
  ctl.stepOnce();
  assert.equal(ctl.sim.readWord('CTD1'), 1);
  assert.equal(ctl.sim.readBit('C1001'), false, 'released after the scan');
  ctl.stepOnce();
  ctl.handle.write('C1001', true); ctl.stepOnce(); ctl.handle.write('C1001', false);
  assert.equal(ctl.sim.readBit('C1001'), false, 'normal release once a scan saw it');
  assert.equal(ctl.sim.readWord('CTD1'), 2);
});

console.log('\nexample project program');

const exIO = DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output', category: '' }));
const exCtl = () => {
  const ctl = new SimController(LADDER, exIO, DESIGN.ioWiring);
  ctl.advance(100);
  return ctl;
};
const press = (ctl: SimController, a: string) => { ctl.handle.write(a, true); ctl.advance(50); ctl.handle.write(a, false); ctl.advance(50); };

test('example program passes the program checker', () => {
  const issues = validateProgram(LADDER, getProfile('click'), new Set(DESIGN.ioWiring.map((w) => w.address)));
  assert.deepEqual(issues, []);
  const blocks = LADDER.blocks!.map((b) => b.name);
  assert.deepEqual(blocks, ['Safety & modes', 'Alarms', 'Conveyor', 'Pusher', 'Manual', 'Outputs', 'HMI & status']);
  assert.ok(LADDER.rungs.every((r) => r.comment && r.block));
  const tagged = new Set(LADDER.tags.map((t) => t.address));
  for (const r of LADDER.rungs) for (const a of rungAddresses(r)) {
    if (/^[XY]\d+$/.test(a) || /^[-\d.]+$/.test(a)) continue;
    assert.ok(tagged.has(a), `${a} has a nickname`);
  }
  // one OUT coil per output
  for (const y of ['Y001', 'Y002']) assert.equal(LADDER.rungs.filter((r) => rungWrites(r).includes(y)).length, 1);
});

test('example program implements every HMI tag', () => {
  const writes = new Set(LADDER.rungs.flatMap(rungWrites));
  for (const r of LADDER.rungs) for (const o of r.outputs) {
    if (o.type === 'TMR') writes.add(`TD${o.address.slice(1)}`);
    if (o.type === 'CNT') writes.add(`CTD${o.address.slice(2)}`);
  }
  const reads = new Set(LADDER.rungs.flatMap((r) => rungReads(r).map((x) => x.address)));
  for (const t of HMI.tags) {
    if (/^X|^Y/.test(t.address)) continue;
    if (t.access === 'read') assert.ok(writes.has(t.address), `${t.name} ${t.address} written by the PLC`);
    else assert.ok(reads.has(t.address), `${t.name} ${t.address} used by the PLC`);
  }
  for (const a of HMI.alarms) assert.ok(writes.has(a.address), `alarm ${a.address}`);
  for (const s of HMI.screens) for (const e of s.elements) {
    if (e.interlock) assert.ok(writes.has(e.interlock), `interlock ${e.interlock}`);
  }
});

test('example: first scan defaults, Stopped -> Running -> Pushing -> Running', () => {
  const ctl = exCtl();
  const r = (a: string) => ctl.sim.read(a);
  assert.equal(r('DS1001'), 3);
  assert.equal(r('DS1003'), 500);
  assert.equal(r('DS1101'), 0, 'stopped');
  press(ctl, 'C1001');
  assert.equal(r('C2'), true);
  assert.equal(r('DS1101'), 1, 'running');
  assert.equal(r('Y001'), true);
  const states = new Set<number>();
  for (let i = 0; i < 1000; i++) { ctl.advance(10); states.add(Number(r('DS1101'))); }
  assert.ok(states.has(2), 'pushing seen');
  assert.ok(Number(r('CTD1')) >= 1 && Number(r('CTD2')) >= 1, 'parts and pusher cycles counted');
  assert.equal(r('C1101'), false, 'no fault');
  press(ctl, 'C1002');
  assert.equal(r('C2'), false);
});

test('example: safety stop and pusher fault set alarms and the state word', () => {
  const ctl = exCtl();
  const r = (a: string) => ctl.sim.read(a);
  press(ctl, 'C1001');
  const es = ctl.getSnapshot().devices.find((d) => d.kind === 'estop')!;
  ctl.toggle(es.id); ctl.advance(100);
  assert.equal(r('C1102'), true, 'safety open alarm');
  assert.equal(r('DS1101'), 5, 'safety stop');
  assert.equal(r('C2'), false);
  ctl.toggle(es.id); ctl.advance(100);
  assert.equal(r('C1102'), false);
  // pusher never reaches extended -> fault after DS1001 s
  ctl.handle.write('DS1001', 2);
  const cyl = ctl.getSnapshot().devices.find((d) => d.kind === 'cylinder')!;
  ctl.setDeviceBypass(cyl.id, true, false);
  ctl.force('X005', false);
  press(ctl, 'C1001');
  ctl.advance(12_000);
  assert.equal(r('C1101'), true, 'pusher fault');
  assert.equal(r('DS1101'), 3, 'faulted');
  assert.equal(r('C2'), false);
  ctl.force('X005', null);
  press(ctl, 'C1003');
  assert.equal(r('C1101'), false, 'reset');
});

test('example: manual mode, permissives and hold-to-run', () => {
  const ctl = exCtl();
  const r = (a: string) => ctl.sim.read(a);
  press(ctl, 'C1001');
  ctl.handle.write('C1005', true); ctl.advance(50);
  assert.equal(r('C1005'), false, 'manual refused while running');
  assert.equal(r('C1201'), false);
  press(ctl, 'C1002');
  ctl.handle.write('C1005', true); ctl.advance(50);
  assert.equal(r('C1201'), true, 'manual active');
  assert.equal(r('DS1101'), 4);
  press(ctl, 'C1001');
  assert.equal(r('C2'), false, 'start blocked in manual');
  assert.equal(r('C1204'), true);
  assert.equal(r('C1205'), true);
  ctl.handle.write('C1006', true); ctl.advance(100);
  assert.equal(r('Y001'), true, 'jog runs the conveyor');
  assert.equal(r('C1205'), false, 'extend not permitted while jogging');
  ctl.handle.write('C1007', true); ctl.advance(100);
  assert.equal(r('Y002'), false, 'no extend while jogging');
  ctl.handle.write('C1006', false); ctl.advance(100);
  assert.equal(r('Y001'), false, 'jog stops on release');
  assert.equal(r('Y002'), true, 'extend once the conveyor is off');
  assert.equal(r('C1204'), false, 'jog not permitted while extended');
  ctl.handle.write('C1007', false); ctl.advance(100);
  assert.equal(r('Y002'), false);
  const es = ctl.getSnapshot().devices.find((d) => d.kind === 'estop')!;
  ctl.toggle(es.id); ctl.advance(100);
  ctl.handle.write('C1006', true); ctl.advance(100);
  assert.equal(r('Y001'), false, 'no jog without Safety OK');
  assert.equal(r('DS1101'), 5);
});

test('example: batch target stops the cycle after the last part', () => {
  const ctl = exCtl();
  const r = (a: string) => ctl.sim.read(a);
  ctl.handle.write('DS1002', 2);
  press(ctl, 'C1001');
  ctl.advance(30_000);
  assert.equal(r('CTD1'), 2);
  assert.equal(r('C2'), false, 'stopped at the batch target');
  assert.equal(r('Y002'), false, 'last part pushed');
  press(ctl, 'C1001');
  assert.equal(r('C2'), false, 'start blocked until the count is reset');
  press(ctl, 'C1004');
  press(ctl, 'C1001');
  assert.equal(r('C2'), true);
});

test('example: parts per minute, run hours, service due and retentive hours', () => {
  const ctl = exCtl();
  const r = (a: string) => ctl.sim.read(a);
  press(ctl, 'C1001');
  ctl.advance(65_000);
  assert.ok(Number(r('DS1103')) >= 8 && Number(r('DS1103')) <= 16, `rate ${r('DS1103')}`);
  // run hours: engine only, conveyor forced on, 1 s scans
  const sim = createSimulator(LADDER);
  sim.setInput('X001', true); sim.setInput('X003', true);
  sim.step();
  sim.write('DS1003', 50);
  sim.force('Y001', true);
  sim.run(3_600_000 * 2 + 5000, 1000);
  assert.equal(sim.readWord('DS1102'), 2);
  assert.equal(sim.readWord('DS1104'), 2);
  sim.reset();
  assert.equal(sim.readWord('DS1102'), 2, 'run hours survive a power cycle');
  sim.step();
  assert.equal(sim.readWord('DS1003'), 50, 'valid setpoint kept on first scan');
  sim.write('DS1104', 50); sim.step();
  assert.equal(sim.readBit('C1103'), true, 'service due');
  sim.write('C1009', true); sim.step(); sim.write('C1009', false); sim.step();
  assert.equal(sim.readWord('DS1104'), 0);
  assert.equal(sim.readBit('C1103'), false);
  // heartbeat
  const hb = new Set<boolean>();
  for (let i = 0; i < 4; i++) { sim.run(1000, 10); hb.add(sim.readBit('C1203')); }
  assert.equal(hb.size, 2, 'heartbeat toggles');
});

test('program page cross reference and block status', () => {
  const x = crossReference(LADDER);
  const c1204 = x.get('C1204')!;
  assert.deepEqual(c1204.map((u) => [u.kind, u.how, u.block]), [['write', 'OUT coil', 'manual'], ['read', 'NO contact', 'manual']]);
  assert.ok(x.get('TD1')!.some((u) => u.kind === 'write' && u.how === 'Timer value'));
  assert.ok(x.get('DS1001')!.some((u) => u.how === 'Timer preset'));
  assert.ok(x.get('CTD1')!.some((u) => u.how === 'MATH operand'));
  const st = issueStatus(LADDER, [{ rungId: 'r_y1', severity: 'error', message: 'x' }, { rungId: null, severity: 'warning', message: 'y' }]);
  assert.deepEqual(st.byBlock.get('outputs'), { errors: 1, warnings: 0 });
  assert.equal(st.byBlock.size, 1);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
