/// <reference types="node" />
/**
 * A machine with no touch panel: the I/O list gets the door pushbuttons, the Auto/Manual selector, the
 * E-stop safety relay input and the Running / Fault lamps (src/spec/operatorIo.ts); the program runs from
 * them alone (no HMI command bit in any rung), closed loop against the simulator's plant model.
 * Run with:  npx tsx src/plc/engine/noPanel.test.ts
 */
import assert from 'node:assert/strict';
import { defaultHmiContent } from '../../hmi/engine';
import { programWithCycle } from './sequence';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { validateProgram } from '../core/validate';
import { createSimulator } from '../sim/engine';
import { buildMachineModel, machineInputs, stepMachine } from '../sim/machineModel';
import { missingOperatorIo, operatorRole } from '../../spec/operatorIo';
import { generatedToPoint } from '../../lib/ai/ioAI';
import type { IOPoint } from '../../types/io';
import type { FieldDeviceType } from '../../electrical/types';

const SPEC = 'Conveyor with a part-at-end photo-eye. No touch panel: pushbuttons and lights on the cabinet door.';
const MACHINE: Omit<IOPoint, 'id'>[] = [
  { description: 'Part at end photo-eye', type: 'input', category: 'Product Detection', deviceType: 'sensor-pnp' },
  { description: 'Conveyor motor contactor', type: 'output', category: 'Conveyor', deviceType: 'contactor-coil' },
];

// ---- I/O: the operator points a no-panel machine lacks; none once they are there; existing ones are kept.
const added = missingOperatorIo(MACHINE);
assert.deepEqual(added.map((p) => `${p.type} ${p.deviceType} ${p.description}`), [
  'input safety-relay-output E-stop safety relay OK', 'input pushbutton-no Start pushbutton', 'input pushbutton-nc Stop pushbutton (NC)',
  'input pushbutton-no Reset pushbutton', 'input selector Auto/Manual selector (ON = Manual)', 'output pilot-light Running lamp (green)', 'output pilot-light Fault lamp (red)',
]);
const io = [...MACHINE, ...added.map(generatedToPoint)].map((p, i) => ({ ...p, id: `n${i}` })) as IOPoint[];
assert.deepEqual(missingOperatorIo(io), [], 'nothing missing once added');
assert.deepEqual(io.map((p) => operatorRole(p)), [null, null, 'estop', 'start', 'stop', 'reset', 'mode', 'lamp-run', 'lamp-fault']);
assert.equal(operatorRole({ description: 'Ready lamp (white)', type: 'output', deviceType: 'pilot-light' }), 'lamp-ready');
assert.deepEqual(missingOperatorIo([
  { description: 'Safety relay OK (E-stop and light curtain)', type: 'input', deviceType: 'safety-relay-output' }, { description: 'Cycle start PB', type: 'input' },
  { description: 'Stop button', type: 'input' }, { description: 'Fault reset button', type: 'input' }, { description: 'Machine running light', type: 'output', deviceType: 'pilot-light' },
]).map((p) => p.description), ['Auto/Manual selector (ON = Manual)', 'Fault lamp (red)'], 'existing operator devices are recognised');
assert.ok(!missingOperatorIo([{ description: 'Two-hand start button left', type: 'input' }]).some((p) => p.description === 'Start pushbutton'), 'two-hand start buttons start the machine');
assert.deepEqual(['Run / setup selector', 'Auto/Hand switch', 'Conveyor run feedback', 'Air pressure switch'].map((d) => operatorRole({ description: d, type: 'input' })), ['mode', 'mode', null, null], 'mode selector words');

// ---- Program
const profile = getProfile('click');
const addresses = resolveAddresses(profile, getCpu(profile, 'C0-10DD1E-D'), io, moduleSlots([]));
const A = (re: RegExp) => addresses.get(io.find((p) => re.test(p.description))!.id)!;
const content = defaultHmiContent({ io, addresses, machineName: 'Conveyor', spec: SPEC });
const r = programWithCycle({ content, spec: SPEC, panel: false });
const roles = r.base.roles;
const used = new Set(r.program.rungs.flatMap((g) => g.branches.flat().map((e) => ('address' in e ? e.address : ''))));
for (const role of ['cmd:start', 'cmd:stop', 'cmd:reset', 'cmd:manual']) assert.ok(!used.has(roles.get(role)!), `no HMI command bit read: ${role} (${roles.get(role)})`);
assert.ok(!r.program.rungs.some((g) => /HMI (Start|Stop|Reset|Manual)/.test(g.comment ?? '')), 'no rung comment names an HMI command');
assert.ok(!r.notes.some((n) => /list has no/.test(n)), 'no missing-device note: every device is in the I/O list');
assert.ok(r.notes.some((n) => /no jog buttons/.test(n)), 'Manual without jog buttons is noted');
assert.ok(!r.program.rungs.some((g) => g.block === 'manual' || /heartbeat|Service Done/i.test(g.comment ?? '')), 'no HMI-only rungs (jog, heartbeat, Service Done)');
assert.deepEqual(validateProgram(r.program, profile, new Set([...addresses.values()])).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
const alarmTags = r.program.tags.filter((t) => /^ALM_/.test(t.nickname));
assert.ok(alarmTags.length >= 1 && alarmTags.every((t) => t.comment && r.program.rungs.some((g) => g.outputs.some((o) => 'address' in o && o.address === t.address))), `alarm bits named for the alarm list: ${alarmTags.map((t) => t.nickname).join(', ')}`);
// The same machine with a panel keeps the HMI commands alongside the door devices.
const withPanel = programWithCycle({ content, spec: SPEC });
assert.ok(withPanel.program.rungs.some((g) => g.branches.flat().some((e) => 'address' in e && e.address === withPanel.base.roles.get('cmd:start'))), 'with a panel: HMI Start still starts');
// Without the devices: the command bits stay, and a note says what to add.
const bare = defaultHmiContent({ io: io.slice(0, 2), addresses, machineName: 'Conveyor', spec: SPEC });
// The checker: a program whose cycle starts only from a panel Start bit (the 7138eef bench press) can't start without a panel.
const ioSet = new Set([...addresses.values()]);
const panelOnly = programWithCycle({ content: bare, spec: SPEC });
const cant = validateProgram(panelOnly.program, profile, ioSet, undefined, { noPanel: true }).filter((i) => /can never turn on/.test(i.message));
assert.ok(cant.some((i) => i.severity === 'error' && i.message.startsWith(`${r.base.internal.run} can never turn on`) && i.message.includes(panelOnly.base.roles.get('cmd:start')!)), `checker: the cycle can't start (${cant.map((i) => i.message).join(' | ')})`);
assert.ok(!validateProgram(panelOnly.program, profile, ioSet).some((i) => i.severity === 'error' && /can never turn on/.test(i.message)), 'with a panel (not designed yet) it is not an error');
assert.deepEqual(validateProgram(r.program, profile, ioSet, undefined, { noPanel: true }).filter((i) => /can never turn on/.test(i.message)).map((i) => i.message), [], 'the no-panel program starts');
assert.ok(programWithCycle({ content: bare, spec: SPEC, panel: false }).notes.some((n) => /no Start \/ Stop \/ Reset pushbutton/.test(n)), 'missing pushbuttons noted');

// ---- Closed loop: Start / Stop from the door, the lamps follow, the selector to Manual stops the cycle.
const wiring = io.map((p) => ({ address: addresses.get(p.id)!, deviceTag: '', deviceType: p.deviceType as FieldDeviceType, description: p.description }));
const m = buildMachineModel(io.map((p) => ({ address: addresses.get(p.id)!, description: p.description, type: p.type, category: p.category })), wiring);
const sim = createSimulator(r.program);
const sync = () => { for (const [a, v] of machineInputs(m)) sim.setInput(a, v); };
const scan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(m, sim.outputs(), 10, (x) => sim.readWord(x))) sim.setInput(a, v); sim.step(10); } };
const dev = <K extends string>(kind: K, re: RegExp) => { const d = m.devices.find((x) => x.kind === kind && re.test(x.label)); assert.ok(d, `${kind} ${re}`); return d as Extract<typeof m.devices[number], { kind: K }>; };
const press = (re: RegExp) => { const b = dev('pushbutton', re); b.state.pressed = true; sync(); scan(200); b.state.pressed = false; sync(); scan(200); };
const sel = dev('selector', /Auto\/Manual/);
const RUN_LAMP = A(/Running lamp/), FAULT_LAMP = A(/Fault lamp/), MOTOR = A(/Conveyor motor/), MANUAL = roles.get('sts:manual')!;

sync(); scan(500);
assert.equal(sim.readBit(RUN_LAMP), false, 'stopped: Running lamp off');
assert.equal(sim.readBit(FAULT_LAMP), false, 'safety OK: Fault lamp off');
press(/^Start/i);
assert.equal(sim.readBit(RUN_LAMP), true, 'Start pushbutton: running');
assert.equal(sim.readBit(MOTOR), true, 'the conveyor runs');
press(/^Stop/i);
assert.equal(sim.readBit(RUN_LAMP), false, 'Stop pushbutton (NC) stops the cycle');
assert.equal(sim.readBit(MOTOR), false, 'the conveyor stops');
press(/^Start/i);
assert.equal(sim.readBit(RUN_LAMP), true, 'running again');
sel.state.on = true; sync(); scan(300);
assert.equal(sim.readBit(RUN_LAMP), false, 'selector to Manual stops the cycle');
assert.equal(sim.readBit(MANUAL), true, 'Manual mode active');
press(/^Start/i);
assert.equal(sim.readBit(RUN_LAMP), false, 'Start does nothing in Manual');
sel.state.on = false; sync(); scan(300);
assert.equal(sim.readBit(MANUAL), false, 'back in Auto');
press(/^Start/i);
assert.equal(sim.readBit(RUN_LAMP), true, 'Start runs in Auto');
const sr = dev('safetyRelay', /E-stop/);
sr.state.ok = false; sync(); scan(300);
assert.equal(sim.readBit(RUN_LAMP), false, 'E-stop: the cycle stops');
assert.equal(sim.readBit(FAULT_LAMP), true, 'E-stop: Fault lamp on');
sr.state.ok = true; sync(); scan(300);
assert.equal(sim.readBit(FAULT_LAMP), false, 'safety restored: Fault lamp off');
press(/^Reset/i);
press(/^Start/i);
assert.equal(sim.readBit(RUN_LAMP), true, 'after Reset: Start runs');

// ---- Bench press (Debug 4's no-panel journey): two-hand start only, a Run / setup selector, Stop and Reset buttons.
{
  const PRESS: Omit<IOPoint, 'id'>[] = ([
    ['Safety relay OK (E-stop, guard door)', 'input', 'Safety', 'safety-relay-output'], ['Guard door closed', 'input', 'Safety', 'limit-switch'],
    ['Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no'], ['Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no'],
    ['Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'], ['Reset button', 'input', 'Operator/HMI', 'pushbutton-no'], ['Run / setup selector', 'input', 'Operator/HMI', 'selector'],
    ['Press up', 'input', 'Pneumatic', 'sensor-pnp'], ['Press down', 'input', 'Pneumatic', 'sensor-pnp'], ['Air pressure OK', 'input', 'Pneumatic', 'pressure-switch'],
    ['Press down solenoid', 'output', 'Pneumatic', 'solenoid'], ['Running lamp (green)', 'output', 'Operator/HMI', 'pilot-light'], ['Fault lamp (red)', 'output', 'Operator/HMI', 'pilot-light'],
  ] as const).map(([description, type, category, deviceType]) => ({ description, type, category, deviceType }));
  assert.deepEqual(missingOperatorIo(PRESS), [], 'bench press: every operator function is already in its I/O list');
  const pio = PRESS.map((p, i) => ({ ...p, id: `b${i}` })) as IOPoint[];
  const pAddr = resolveAddresses(profile, getCpu(profile, 'C0-11DD1E-D'), pio, moduleSlots(['C0-08ND3']));
  const B = (re: RegExp) => pAddr.get(pio.find((p) => re.test(p.description))!.id)!;
  const pc = defaultHmiContent({ io: pio, addresses: pAddr, machineName: 'Bench Press', spec: 'Pneumatic bench press, two-hand start, no touch screen.' });
  const pr = programWithCycle({ content: pc, spec: 'Pneumatic bench press, two-hand start, no touch screen.', panel: false });
  const pUsed = new Set(pr.program.rungs.flatMap((g) => g.branches.flat().map((e) => ('address' in e ? e.address : ''))));
  for (const role of ['cmd:start', 'cmd:stop', 'cmd:reset', 'cmd:manual']) assert.ok(!pUsed.has(pr.base.roles.get(role)!), `press: no HMI command bit read: ${role}`);
  assert.ok(pUsed.has(B(/selector/)), 'press: the Run / setup selector is used');
  assert.ok(pr.notes.some((n) => /Run \/ setup selector: ON = Manual \(setup\) assumed/.test(n)), 'press: the selector polarity is noted');
  assert.ok(!pr.program.rungs.some((g) => /heartbeat|Service Done/i.test(g.comment ?? '')), 'press: no heartbeat / Service Done rungs');
  const pw = pio.map((p) => ({ address: pAddr.get(p.id)!, deviceTag: '', deviceType: p.deviceType as FieldDeviceType, description: p.description }));
  const pm = buildMachineModel(pio.map((p) => ({ address: pAddr.get(p.id)!, description: p.description, type: p.type, category: p.category })), pw);
  const ps = createSimulator(pr.program);
  const psync = () => { for (const [a, v] of machineInputs(pm)) ps.setInput(a, v); };
  const pscan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(pm, ps.outputs(), 10, (x) => ps.readWord(x))) ps.setInput(a, v); ps.step(10); } };
  const hands = pm.devices.filter((d) => d.kind === 'pushbutton' && /two-hand/i.test(d.label)) as Extract<typeof pm.devices[number], { kind: 'pushbutton' }>[];
  assert.equal(hands.length, 2);
  const both = (on: boolean) => { for (const h of hands) h.state.pressed = on; psync(); };
  psync(); pscan(500);
  both(true);
  let down = false;
  for (let t = 0; t < 3000 && !down; t += 50) { pscan(50); down = ps.readBit(B(/Press down solenoid/)); }
  assert.ok(down, 'press: both two-hand buttons start the machine and close the press');
  assert.equal(ps.readBit(B(/Running lamp/)), true, 'press: Running lamp on');
  both(false); pscan(3000);
  const ss = pm.devices.find((d) => d.kind === 'selector') as Extract<typeof pm.devices[number], { kind: 'selector' }>;
  ss.state.on = true; psync(); pscan(300);
  assert.equal(ps.readBit(B(/Running lamp/)), false, 'press: selector to setup stops the machine');
  assert.equal(ps.readBit(pr.base.roles.get('sts:manual')!), true, 'press: setup = Manual mode');
}

console.log('noPanel.test: all assertions passed');
