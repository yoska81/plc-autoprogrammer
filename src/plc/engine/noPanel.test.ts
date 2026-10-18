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
import { missingOperatorIo } from '../../spec/operatorIo';
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
assert.deepEqual(missingOperatorIo([
  { description: 'Safety relay OK (E-stop and light curtain)', type: 'input', deviceType: 'safety-relay-output' }, { description: 'Cycle start PB', type: 'input' },
  { description: 'Stop button', type: 'input' }, { description: 'Fault reset button', type: 'input' }, { description: 'Machine running light', type: 'output', deviceType: 'pilot-light' },
]).map((p) => p.description), ['Auto/Manual selector (ON = Manual)', 'Fault lamp (red)'], 'existing operator devices are recognised');
assert.ok(missingOperatorIo([{ description: 'Two-hand start button left', type: 'input' }]).some((p) => p.description === 'Start pushbutton'), 'a two-hand button is not the Start pushbutton');

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
assert.ok(!r.notes.some((n) => /No touch panel/.test(n)), 'no missing-device note: every device is in the I/O list');
assert.deepEqual(validateProgram(r.program, profile, new Set([...addresses.values()])).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
// The same machine with a panel keeps the HMI commands alongside the door devices.
const withPanel = programWithCycle({ content, spec: SPEC });
assert.ok(withPanel.program.rungs.some((g) => g.branches.flat().some((e) => 'address' in e && e.address === withPanel.base.roles.get('cmd:start'))), 'with a panel: HMI Start still starts');
// Without the devices: the command bits stay, and a note says what to add.
const bare = defaultHmiContent({ io: io.slice(0, 2), addresses, machineName: 'Conveyor', spec: SPEC });
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

console.log('noPanel.test: all assertions passed');
