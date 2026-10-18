/// <reference types="node" />
/**
 * The user's roll former (cn-rollformer-01, converted from its relay drawings by src/convert), no touch panel,
 * against the simulator: the pump has its own Start / Stop and the line its own (the line needs the pump and the
 * servo ready); jog forward / reverse drive the VFD's forward / reverse with its jog-speed input, only with the
 * line stopped; the servo is enabled from its selector and its E-CAM engages only while the line runs; Reset is
 * the general Reset (not the counter's); the external batch counter stops the line; the cut watchdog keeps its 2 s;
 * an E-stop drops everything and releasing it restarts nothing.
 * Run with:  npx tsx src/plc/engine/rollformer.test.ts
 */
import assert from 'node:assert/strict';
import { convertMachine } from '../../convert/convert';
import { CN_ROLLFORMER_01_READING } from '../../convert/__fixtures__/cnRollformer01.reading';
import { defaultHmiContent } from '../../hmi/engine';
import { programWithCycle } from './sequence';
import { createSimulator } from '../sim/engine';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';
import type { IOPoint } from '../../types/io';

const conv = convertMachine(CN_ROLLFORMER_01_READING);
let xi = 0, yi = 0;
const io = conv.io.map((p, i) => ({ id: `r${i}`, description: p.description, type: p.type, category: p.category, deviceType: p.deviceType })) as IOPoint[];
// The cut watchdog as drawn (KT1 2 s), the way the conversion writes it on the shear-down valve.
io.find((p) => /Shear down valve/.test(p.description))!.description += ' (watchdog 2 s)';
// CLICK addresses: 16 points per slot (X001–X016, X101–X116 …).
const clickAddr = (prefix: string, i: number) => `${prefix}${Math.floor(i / 16)}${String((i % 16) + 1).padStart(2, '0')}`;
const addresses = new Map(io.map((p) => [p.id, p.type === 'input' ? clickAddr('X', xi++) : clickAddr('Y', yi++)] as const));
const A = (re: RegExp) => { const p = io.find((x) => re.test(x.description)); assert.ok(p, `point ${re}`); return addresses.get(p!.id)!; };
const content = defaultHmiContent({ io, addresses, machineName: 'Roll former', spec: '' });

// One signal, one role: the VFD is one drive (forward, reverse, jog speed); the servo U2 one axis with SON and CAM.
const u1 = content.actuators.find((a) => a.name === 'U1 drive')!;
assert.deepEqual([u1.run?.address, u1.reverse?.address, u1.jogSpeed?.address], [A(/MI1/), A(/MI2/), A(/MI3/)], 'U1: MI1 forward, MI2 reverse, MI3 jog speed');
assert.equal(content.actuators.filter((a) => a.run?.address === A(/MI2/)).length, 0, 'MI2 is never a run output');
assert.equal(content.axes?.length, 1);
assert.deepEqual([content.axes![0].enable?.address, content.axes![0].engage?.address, content.axes![0].enableSelector?.address, content.axes![0].ready?.address],
  [A(/DI1 SON/), A(/DI7 CAM/), A(/Servo enable selector/), A(/U2 ready/)]);
const shear = content.actuators.filter((a) => a.kind === 'cylinder');
assert.deepEqual(shear.map((a) => [a.extend?.address, a.retract?.address, a.timeoutS]), [[A(/Shear down valve/), A(/Shear up valve/), 2]], 'one shear (down / up), cut watchdog 2 s from the drawing');

const r = programWithCycle({ content, spec: '', panel: false });
const ioSet = new Set(addresses.values());
assert.deepEqual(validateProgram(r.program, getProfile('click'), ioSet, undefined, { noPanel: true }).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
const tmoRung = r.program.rungs.find((g) => /Shear: extend timeout/.test(g.comment ?? ''))!;
const tmoPreset = tmoRung.outputs.find((o) => o.type === 'TMR')!;
const preset = tmoPreset.type === 'TMR' ? tmoPreset.preset : '';
assert.ok(preset === '2' || r.program.rungs.some((g) => /First scan: Shear timeout .* default 2$/.test(g.comment ?? '') && g.outputs.some((o) => o.type === 'COPY' && o.dest === preset && o.source === '2')), `the shear timeout is 2 s (${preset})`);
const RUN = r.base.internal.run, FAULT = r.base.internal.fault;

const sim = createSimulator(r.program);
const set = (re: RegExp, v: boolean) => sim.setInput(A(re), v);
const press = (re: RegExp) => { set(re, true); sim.run(100); set(re, false); sim.run(100); };
// Released NC devices read ON: E-stops, Pump stop, Line stop; the shear guard closed. The servo reports ready only once enabled (SON).
set(/E-stop, operator/, true); set(/E-stop, run-out/, true); set(/Pump stop/, true); set(/Line stop/, true); set(/Shear guard switch/, true); // guard closed
const servoReady = () => sim.setInput(A(/U2 ready/), sim.readBit(A(/DI1 SON/)));
const run = (ms: number) => { for (let t = 0; t < ms; t += 10) { servoReady(); sim.step(10); } };
run(300);

// The line needs the pump.
press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), false, 'no line without the pump');
press(/Pump start/); run(100);
assert.equal(sim.readBit(A(/Pump contactor/)), true, 'Pump start runs the pump');
assert.equal(sim.readBit(A(/Pump running lamp/)), true, 'pump lamp follows the pump');
assert.equal(sim.readBit(RUN), false, 'Pump start does not start the line');
// … and the servo ready: SON from the selector.
press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), false, 'no line without the servo ready');
set(/Servo enable selector/, true); run(100);
assert.equal(sim.readBit(A(/DI1 SON/)), true, 'SON from the selector');
assert.equal(sim.readBit(A(/DI7 CAM/)), false, 'no CAM with the line stopped');

// Jog with the line stopped: forward = MI1 + MI3, reverse = MI2 + MI3; never both.
set(/Jog forward/, true); run(100);
assert.deepEqual([A(/MI1/), A(/MI2/), A(/MI3/)].map((a) => sim.readBit(a)), [true, false, true], 'jog forward');
set(/Jog forward/, false); set(/Jog reverse/, true); run(100);
assert.deepEqual([A(/MI1/), A(/MI2/), A(/MI3/)].map((a) => sim.readBit(a)), [false, true, true], 'jog reverse (MI2 on)');
set(/Jog reverse/, false); run(100);

// Line start: running, CAM engaged; jog ignored while running; Line stop (not Pump stop) stops it.
press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), true, 'Line start runs the line');
assert.equal(sim.readBit(A(/Line running lamp/)), true);
assert.equal(sim.readBit(A(/DI7 CAM/)), true, 'CAM engaged while the line runs');
set(/Jog reverse/, true); run(100);
assert.equal(sim.readBit(A(/MI2/)), false, 'no jog while running');
set(/Jog reverse/, false);
set(/Line stop/, false); run(100); set(/Line stop/, true); run(100);
assert.equal(sim.readBit(RUN), false, 'Line stop stops the line');
assert.equal(sim.readBit(A(/DI7 CAM/)), false, 'CAM off when the line stops');
assert.equal(sim.readBit(A(/Pump contactor/)), true, 'the pump keeps running');

// The external batch counter stops the line and lights its lamp.
press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), true);
set(/Batch counter output/, true); run(100);
assert.equal(sim.readBit(RUN), false, 'batch complete stops the line');
assert.equal(sim.readBit(A(/Batch complete lamp/)), true);
set(/Batch counter output/, false); run(100);

// E-stop: line, pump and SON drop; releasing it restarts nothing; a fresh Start is needed.
press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), true);
set(/E-stop, run-out/, false); run(100);
assert.deepEqual([RUN, A(/Pump contactor/), A(/DI1 SON/), A(/MI1/)].map((a) => sim.readBit(a)), [false, false, false, false], 'E-stop drops the line, the pump and the servo');
set(/E-stop, run-out/, true); run(500);
assert.deepEqual([RUN, A(/Pump contactor/)].map((a) => sim.readBit(a)), [false, false], 'releasing the E-stop restarts nothing');
press(/Pump start/); run(100); press(/Line start/); run(100);
assert.equal(sim.readBit(RUN), true, 'fresh Pump start + Line start run again');

// Reset is the general Reset (X004), not the counter reset: a servo alarm latches and stops the line; Reset clears it.
set(/U2 alarm/, true); run(100);
assert.equal(sim.readBit(FAULT), true, 'servo alarm latched');
assert.equal(sim.readBit(RUN), false, 'servo alarm stops the line');
set(/U2 alarm/, false); press(/Counter reset/); run(100);
assert.equal(sim.readBit(FAULT), true, 'the counter reset does not reset faults');
press(/^Reset/); run(100);
assert.equal(sim.readBit(FAULT), false, 'Reset clears the servo alarm');

console.log('roll former tests passed');
