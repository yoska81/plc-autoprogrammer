/// <reference types="node" />
/**
 * The user's roll former (cn-rollformer-01) as converted from its relay drawings (Debug 1's I/O, fixture
 * cnRollformerIo.ts), no touch panel, closed loop against the simulator, in the drawn sequence:
 *   pump → line start (pump running, U2 ready, no alarm, material present, U1 healthy, no run-out end) → line stop
 *   → jog forward / reverse (exclusive, line stopped only) → SON from the selector → CAM only while running
 *   → manual cut (line stopped) → cut on U2 DO3: YV1 down → SQ1 → YV2 up → SQ2 → KT1 2 s watchdog trips the line
 *   → batch complete stops the line → E-stop (Safety OK off) → Reset → no restart → Start runs → U2 alarm / Reset.
 * Run with:  npx tsx src/plc/engine/rollformer.test.ts
 */
import assert from 'node:assert/strict';
import { CN_ROLLFORMER_IO } from './__fixtures__/cnRollformerIo';
import { defaultHmiContent } from '../../hmi/engine';
import { programWithCycle } from './sequence';
import { createSimulator } from '../sim/engine';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';
import type { IOPoint } from '../../types/io';

let xi = 0, yi = 0;
const io = CN_ROLLFORMER_IO.map((p, i) => ({ id: `r${i}`, description: p.description, type: p.type, category: p.category, deviceType: p.deviceType })) as IOPoint[];
// CLICK addresses: 16 points per slot (X001–X016, X101–X116 …).
const clickAddr = (prefix: string, i: number) => `${prefix}${Math.floor(i / 16)}${String((i % 16) + 1).padStart(2, '0')}`;
const addresses = new Map(io.map((p) => [p.id, p.type === 'input' ? clickAddr('X', xi++) : clickAddr('Y', yi++)] as const));
const A = (re: RegExp) => { const p = io.find((x) => re.test(x.description)); assert.ok(p, `point ${re}`); return addresses.get(p!.id)!; };
const content = defaultHmiContent({ io, addresses, machineName: 'Roll former', spec: '' });

// One signal, one role: the VFD is one drive (forward, reverse, jog speed); the servo U2 one axis with SON and CAM.
const u1 = content.actuators.find((a) => a.name === 'U1 drive')!;
assert.ok(u1, `U1 drive (${content.actuators.map((a) => a.name).join(', ')})`);
assert.deepEqual([u1.run?.address, u1.reverse?.address, u1.jogSpeed?.address], [A(/MI1/), A(/MI2/), A(/MI3/)], 'U1: MI1 forward, MI2 reverse, MI3 jog speed');
assert.equal(content.axes?.length, 1);
assert.deepEqual([content.axes![0].enable?.address, content.axes![0].engage?.address, content.axes![0].enableSelector?.address, content.axes![0].ready?.address],
  [A(/DI1 SON/), A(/DI7 CAM/), A(/Servo enable selector/), A(/U2 ready/)]);
const shear = content.actuators.filter((a) => a.kind === 'cylinder');
assert.deepEqual(shear.map((a) => [a.extend?.address, a.retract?.address, a.timeoutS]), [[A(/Shear down valve/), A(/Shear up valve/), 2]], 'one shear (down / up), cut watchdog 2 s from the drawing');

const r = programWithCycle({ content, spec: '', panel: false });
assert.deepEqual(r.sequence.steps.map((s) => s.name), ['Wait for the cut signal (U2 cut (DO3))', 'Shear down until Shear down limit (下限位)', 'Shear up until Shear up limit (上限位)'], 'the cut runs off U2 DO3');
const ioSet = new Set(addresses.values());
assert.deepEqual(validateProgram(r.program, getProfile('click'), ioSet, undefined, { noPanel: true }).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
const RUN = r.base.internal.run, FAULT = r.base.internal.fault;

const sim = createSimulator(r.program);
const set = (re: RegExp, v: boolean) => sim.setInput(A(re), v);
const bit = (re: RegExp) => sim.readBit(A(re));
// The plant: the shear moves 0.02 of its stroke per 10 ms (a 0.5 s stroke) while a valve is on (stuck = it does not move);
// the servo reports ready once enabled (SON).
let shearPos = 0, stuck = false;
const plant = () => {
  if (!stuck) {
    if (bit(/Shear down valve/)) shearPos = Math.min(1, shearPos + 0.02);
    if (bit(/Shear up valve/)) shearPos = Math.max(0, shearPos - 0.02);
  }
  set(/Shear down limit/, shearPos >= 1); set(/Shear up limit/, shearPos <= 0);
  set(/U2 ready/, bit(/DI1 SON/));
};
const run = (ms: number) => { for (let t = 0; t < ms; t += 10) { plant(); sim.step(10); } };
const until = (cond: () => boolean, maxMs: number, what: string) => { for (let t = 0; t < maxMs; t += 10) { if (cond()) return; run(10); } assert.fail(`${what} within ${maxMs} ms`); };
const press = (re: RegExp) => { set(re, true); run(100); set(re, false); run(100); };
// Released NC stops read ON; the safety relay is made (Safety OK); U1 healthy; material at the entry.
set(/Pump stop/, true); set(/Line stop/, true); set(/Safety OK/, true); set(/U1 healthy/, true); set(/Entry inductive/, true);
run(300);
assert.equal(bit(/Power on lamp/), true, 'power lamp');

// 1. The pump: its own Start / Stop; the line needs it.
press(/Line start/);
assert.equal(sim.readBit(RUN), false, 'no line without the pump');
press(/Pump start/);
assert.equal(bit(/Pump contactor/), true, 'Pump start runs the pump');
assert.equal(bit(/Pump running lamp/), true, 'pump lamp follows the pump');
assert.equal(sim.readBit(RUN), false, 'Pump start does not start the line');

// 2. Permissives: U2 ready (SON from the selector), material present, U1 healthy, no run-out end.
press(/Line start/);
assert.equal(sim.readBit(RUN), false, 'no line without U2 ready');
set(/Servo enable selector/, true); run(100);
assert.equal(bit(/DI1 SON/), true, 'SON from the selector');
assert.equal(bit(/DI7 CAM/), false, 'no CAM with the line stopped');
for (const [re, v, why] of [[/Entry inductive/, false, 'material'], [/U1 healthy/, false, 'U1 healthy'], [/Run-out end/, true, 'run-out end clear']] as const) {
  set(re, v); press(/Line start/);
  assert.equal(sim.readBit(RUN), false, `no line without ${why}`);
  set(re, !v); run(100);
}

// 3. Jog with the line stopped: forward = MI1 + MI3, reverse = MI2 + MI3; never both.
set(/Jog forward/, true); run(100);
assert.deepEqual([A(/MI1/), A(/MI2/), A(/MI3/)].map((a) => sim.readBit(a)), [true, false, true], 'jog forward');
set(/Jog reverse/, true); run(100);
assert.equal(bit(/MI1/) && bit(/MI2/), false, 'forward and reverse never together');
set(/Jog forward/, false); run(100);
assert.deepEqual([A(/MI1/), A(/MI2/), A(/MI3/)].map((a) => sim.readBit(a)), [false, true, true], 'jog reverse (MI2 on)');
set(/Jog reverse/, false); run(100);
assert.deepEqual([A(/MI1/), A(/MI2/), A(/MI3/)].map((a) => sim.readBit(a)), [false, false, false], 'jog released');

// 4. Manual cut with the line stopped: down to the down limit, then up to the up limit.
press(/Manual cut/);
assert.equal(bit(/Shear down valve/), true, 'manual cut: shear down');
until(() => bit(/Shear down limit/), 1000, 'shear reached the down limit');
until(() => bit(/Shear up valve/), 100, 'then shear up');
assert.equal(bit(/Shear down valve/), false, 'down valve off going up');
until(() => bit(/Shear up limit/), 1000, 'shear back up');
run(100);
assert.deepEqual([bit(/Shear down valve/), bit(/Shear up valve/)], [false, false], 'manual cut done, valves off');

// 5. Line start: running, CAM engaged, MI1 forward; jog and manual cut ignored while running.
press(/Line start/);
assert.equal(sim.readBit(RUN), true, 'Line start runs the line');
assert.equal(bit(/Line running lamp/), true);
assert.equal(bit(/DI7 CAM/), true, 'CAM engaged while the line runs');
assert.equal(bit(/MI1/), true, 'VFD forward while running');
set(/Jog reverse/, true); run(100);
assert.equal(bit(/MI2/), false, 'no jog while running');
set(/Jog reverse/, false);
press(/Manual cut/);
assert.equal(bit(/Shear down valve/), false, 'no manual cut while running');

// 6. The cut on U2 DO3: YV1 down → SQ1 → YV2 up → SQ2.
set(/U2 cut/, true); run(50);
assert.equal(bit(/Shear down valve/), true, 'DO3: shear down (YV1)');
set(/U2 cut/, false);
until(() => bit(/Shear down limit/), 1000, 'SQ1 reached');
until(() => bit(/Shear up valve/), 100, 'then shear up (YV2)');
assert.equal(bit(/Shear down valve/), false, 'YV1 off going up');
until(() => bit(/Shear up limit/), 1000, 'SQ2 reached');
run(100);
assert.deepEqual([bit(/Shear down valve/), bit(/Shear up valve/)], [false, false], 'cut done');
assert.equal(sim.readBit(RUN), true, 'the line keeps running after a good cut');

// 7. Line stop (not Pump stop) stops the line; the pump keeps running.
set(/Line stop/, false); run(100); set(/Line stop/, true); run(100);
assert.equal(sim.readBit(RUN), false, 'Line stop stops the line');
assert.equal(bit(/DI7 CAM/), false, 'CAM off when the line stops');
assert.equal(bit(/Pump contactor/), true, 'the pump keeps running');

// 8. KT1: the shear stuck — the 2 s watchdog trips the line and lights the Fault lamp; Reset clears it.
press(/Line start/);
assert.equal(sim.readBit(RUN), true);
stuck = true;
set(/U2 cut/, true); run(50); set(/U2 cut/, false);
run(1500);
assert.equal(sim.readBit(RUN), true, 'still running inside the 2 s');
run(1000);
assert.equal(sim.readBit(FAULT), true, 'cut watchdog tripped after 2 s');
assert.equal(sim.readBit(RUN), false, 'the watchdog stops the line');
assert.equal(bit(/Shear down valve/), false, 'shear down dropped on the trip');
stuck = false; shearPos = 0; run(100);
press(/^Reset/); run(100);
assert.equal(sim.readBit(FAULT), false, 'Reset clears the watchdog');

// 9. The external batch counter stops the line and lights its lamp.
press(/Line start/);
assert.equal(sim.readBit(RUN), true, 'runs again after Reset + Start');
set(/Batch counter output/, true); run(100);
assert.equal(sim.readBit(RUN), false, 'batch complete stops the line');
assert.equal(bit(/Batch complete lamp/), true);
set(/Batch counter output/, false); run(100);

// 10. E-stop (Safety OK off): line, pump and SON drop; Reset after release restarts nothing; a fresh Start is needed.
press(/Line start/);
assert.equal(sim.readBit(RUN), true);
set(/Safety OK/, false); run(100);
assert.deepEqual([RUN, A(/Pump contactor/), A(/DI1 SON/), A(/MI1/)].map((a) => sim.readBit(a)), [false, false, false, false], 'E-stop drops the line, the pump and the servo');
set(/Safety OK/, true); press(/^Reset/); run(500);
assert.deepEqual([RUN, A(/Pump contactor/)].map((a) => sim.readBit(a)), [false, false], 'releasing the E-stop and Reset restart nothing');
press(/Pump start/); press(/Line start/);
assert.equal(sim.readBit(RUN), true, 'fresh Pump start + Line start run again');

// 11. U2 alarm latches and stops the line; the counter reset does not clear it, Reset does.
set(/U2 alarm/, true); run(100);
assert.equal(sim.readBit(FAULT), true, 'servo alarm latched');
assert.equal(sim.readBit(RUN), false, 'servo alarm stops the line');
assert.equal(bit(/Fault lamp/), true, 'fault lamp');
set(/U2 alarm/, false); press(/Counter reset/);
assert.equal(sim.readBit(FAULT), true, 'the counter reset does not reset faults');
press(/^Reset/);
assert.equal(sim.readBit(FAULT), false, 'Reset clears the servo alarm');
press(/Line start/);
assert.equal(sim.readBit(RUN), true, 'Start runs after the alarm is reset');

console.log('roll former tests passed');
