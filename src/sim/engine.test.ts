/// <reference types="node" />
/**
 * Simulator tests. Run with:  npx tsx src/sim/engine.test.ts
 */
import assert from 'node:assert/strict';
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, Rung } from '../plc/ladder';
import { compileMath, createSimulator } from './engine';
import { buildMachineModel, machineInputs, stepMachine } from './machineModel';
import type { ConveyorDevice, CylinderDevice, MotorDevice } from './machineModel';
import { CONVEYOR_IO, CONVEYOR_PROGRAM, CONVEYOR_WIRING } from './__fixtures__/conveyor';

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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
