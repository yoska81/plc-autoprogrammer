/// <reference types="node" />
/**
 * Sealing head (the harness's rules-sealing machine), closed loop against the simulator's plant model:
 * HMI Start only arms the cycle; every cycle starts with both two-hand buttons (released in between —
 * anti-tie-down) once the seal bar is at temperature; a hand off a button during the closing stroke sends
 * the head back up; the seal time is the operator's setpoint; input alarms (over-temperature limit, air
 * pressure low) latch and stop the machine; the HMI has no jog for the closing stroke.
 * Run with:  npx tsx src/plc/engine/sealing.test.ts
 */
import assert from 'node:assert/strict';
import { buildHmi, defaultHmiContent } from '../../hmi/engine';
import { programWithCycle } from './sequence';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { validateProgram } from '../core/validate';
import { createSimulator } from '../sim/engine';
import { buildMachineModel, machineAnalogValues, machineInputs, stepMachine } from '../sim/machineModel';
import type { IOPoint } from '../../types/io';

const SPEC = 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple. The film comes off an unwinder driven by a 0.5 HP motor on a VFD. CLICK PLC with a C-more 7" touch panel; the operator sets the seal temperature and the dwell time on the HMI. 480 V 3-phase supply.';
type P = [string, 'input' | 'output', string, string?, IOPoint['analog']?];
const POINTS: P[] = [
  ['Safety relay OK (E-stop and light curtain)', 'input', 'Safety', 'safety-relay-output'], ['Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no'], ['Light curtain clear (OSSD)', 'input', 'Safety', 'other'],
  ['Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'], ['Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Sealing head up (retracted)', 'input', 'Pneumatic', 'sensor-pnp'], ['Sealing head down (sealing position)', 'input', 'Pneumatic', 'sensor-pnp'],
  ['Air pressure OK', 'input', 'Pneumatic', 'pressure-switch'], ['Heater over-temperature limit tripped', 'input', 'Analog/Process', 'other'],
  ['Unwinder VFD fault', 'input', 'Conveyor', 'vfd-input'], ['Film roll low sensor', 'input', 'Product Detection', 'sensor-pnp'],
  ['Seal heater temperature (thermocouple transmitter)', 'input', 'Analog/Process', 'other', { range: '4-20mA', min: 0, max: 300, units: '°C' }],
  ['Sealing head down solenoid', 'output', 'Pneumatic', 'solenoid'], ['Sealing head up solenoid', 'output', 'Pneumatic', 'solenoid'],
  ['Seal heater on (SSR)', 'output', 'Analog/Process', 'other'], ['Unwinder VFD run', 'output', 'Conveyor', 'vfd-input'],
  ['Machine running light', 'output', 'Operator/HMI', 'pilot-light'], ['Fault light', 'output', 'Operator/HMI', 'pilot-light'],
  ['Unwinder speed reference', 'output', 'Conveyor', 'other', { range: '4-20mA', min: 0, max: 100, units: '%' }],
];
const io = POINTS.map(([description, type, category, deviceType, analog], i) => ({ id: `s${i}`, description, type, category, deviceType, ...(analog ? { signal: 'analog' as const, analog } : {}) })) as IOPoint[];
const profile = getProfile('click');
const addresses = resolveAddresses(profile, getCpu(profile, 'C0-12DD1E-D'), io, moduleSlots(['C0-16ND3', 'C0-08TD1']));
const A = (desc: RegExp) => addresses.get(io.find((p) => desc.test(p.description))!.id)!;

const content = defaultHmiContent({ io, addresses, machineName: 'Sealing Head', spec: SPEC });
assert.deepEqual(content.twoHand?.map((p) => p.address), [A(/left/), A(/right/)], 'two-hand buttons');
assert.deepEqual(content.alarmInputs?.map((a) => `${a.text}|${a.severity}|${a.activeWhen}`), [
  'Light curtain interrupted|warning|false', 'Air pressure low|alarm|false', 'Heater over-temperature limit tripped|alarm|true', 'Film roll low|warning|true',
], 'input alarms');
assert.equal(content.process?.temp?.pv.address, A(/heater temperature/));
assert.equal(content.process?.dwell?.name, 'Seal time');

const hmi = buildHmi(content, { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480, now: 'T' });
const role = (r: string) => hmi.tags.find((t) => t.role === r)?.address;
assert.equal(role(`jog:${A(/head down solenoid/)}`), undefined, 'no HMI jog for the closing stroke');
assert.ok(role(`jog:${A(/head up solenoid/)}`), 'the head can still be jogged up');
const setup = hmi.screens.filter((s) => s.id.startsWith('setup')).flatMap((s) => s.elements);
assert.ok(setup.some((e) => e.kind === 'numeric-entry' && e.address === role(`sp:temp:${A(/heater temperature/)}`)), 'temperature setpoint on Setup');
assert.ok(setup.some((e) => e.kind === 'numeric-entry' && e.address === role('sp:dwell') && e.units === 'ms'), 'seal time on Setup');
for (const re of [/over-temperature/, /Air pressure low/, /Film roll low/]) assert.ok(hmi.alarms.some((a) => re.test(a.message)), `HMI alarm ${re}`);

const r = programWithCycle({ content, hmiTags: hmi.tags, hmiScreens: hmi.screens, hmiAlarms: hmi.alarms, spec: SPEC });
const ioSet = new Set([...addresses.values()]);
assert.deepEqual(validateProgram(r.program, profile, ioSet, hmi).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors with the HMI');

// ---- Closed loop
const sim = createSimulator(r.program);
const m = buildMachineModel(io.map((p) => ({ address: addresses.get(p.id)!, description: p.description, type: p.type, category: p.category, ...(p.analog ? { analog: p.analog } : {}) })), []);
for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
const scan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(m, sim.outputs(), 10, (x) => sim.readWord(x))) sim.setInput(a, v); for (const [a, v] of machineAnalogValues(m)) sim.write(a, v); sim.step(10); } };
const pb = (re: RegExp) => { const d = m.devices.find((x) => x.kind === 'pushbutton' && re.test(x.label)); assert.ok(d && d.kind === 'pushbutton', `button ${re}`); return d; };
const left = pb(/left/i), right = pb(/right/i);
const hands = (on: boolean) => { left.state.pressed = on; right.state.pressed = on; for (const [a, v] of machineInputs(m)) sim.setInput(a, v); };
const press = (addr: string) => { sim.write(addr, true); scan(100); sim.write(addr, false); scan(100); };
const DOWN = A(/head down solenoid/), UP_FB = A(/head up \(retracted\)/), HEAT = A(/heater on/), S = r.stepRegister;
const cycles = () => sim.readWord(`CTD${r.cycleCounter.slice(2)}`);
const until = (cond: () => boolean, ms: number) => { for (let t = 0; t < ms && !cond(); t += 50) scan(50); return cond(); };

scan(500);
assert.equal(sim.readBit(HEAT), true, 'heater warms up the seal bar');
press(role('cmd:start')!);
assert.equal(sim.readBit(DOWN), false, 'Start arms only: nothing moves');
hands(true); scan(500); hands(false);
assert.equal(sim.readBit(DOWN), false, 'no cycle until the seal bar is at temperature');
assert.ok(until(() => sim.readWord(A(/heater temperature/)) >= 146, 120_000), 'reaches the temperature band');
scan(1000);
hands(true);
assert.ok(until(() => sim.readBit(DOWN), 2000), 'two-hand start closes the head');
assert.ok(until(() => cycles() === 1, 15_000), 'one full cycle: down, seal, up');
assert.equal(sim.readWord(S), 0, 'back to step 0: waits for the next two-hand start');
scan(3000);
assert.equal(cycles(), 1, 'holding both buttons does not start another cycle (anti-tie-down)');
hands(false); scan(300); hands(true);
assert.ok(until(() => cycles() === 2, 15_000), 'released and pressed again: the next cycle');
hands(false); scan(300);

// A hand off a button during the closing stroke: the head goes back up, no fault.
const sp = role('sp:dwell')!;
hands(true); assert.ok(until(() => sim.readBit(DOWN), 2000));
scan(100); left.state.pressed = false; for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
assert.ok(until(() => sim.readBit(UP_FB), 3000), 'released during closing: the head returns up');
assert.equal(cycles(), 2, 'not counted as a cycle');
assert.equal(sim.readBit(role('alarm:step')!), false, 'no step-timeout fault');
hands(false); scan(300);

// The seal time is the operator's setpoint (ms).
sim.write(sp, 4000);
hands(true); assert.ok(until(() => sim.readBit(A(/head down \(sealing/)), 3000));
// Double-solenoid valve: the head stays down with both coils off; the seal ends when the up coil switches on.
const UP = A(/head up solenoid/);
const t0 = (() => { let t = 0; while (!sim.readBit(UP) && t < 10_000) { scan(50); t += 50; } return t; })();
assert.ok(t0 >= 3800 && t0 <= 4600, `seal time follows the setpoint (${t0} ms)`);
hands(false); scan(1000);

// Over-temperature limit: latched alarm, heater off, the cycle stops.
const ot = m.devices.find((d) => d.kind === 'sensor' && /over-temperature/i.test(d.label));
assert.ok(ot && ot.kind === 'sensor');
ot.state.on = true; for (const [a, v] of machineInputs(m)) sim.setInput(a, v); scan(200);
assert.equal(sim.readBit(role(`alarm:input:${A(/over-temperature/)}`)!), true, 'over-temperature alarm');
assert.equal(sim.readBit(HEAT), false, 'heater off');
assert.equal(sim.readBit(role('sts:running')!), false, 'cycle stopped');
console.log('sealing head acceptance passed');
