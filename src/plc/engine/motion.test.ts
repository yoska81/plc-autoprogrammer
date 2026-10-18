/// <reference types="node" />
/**
 * One CLICK PLUS pulse-train axis and one encoder, closed loop: the rules' motion blocks (motion.ts) implement the
 * HMI's axis / encoder roles; the simulator runs the PLC's Home / Velocity Move / Position Move instructions
 * (motionSim.ts). Enable needs Safety OK; Home makes it homed; jog runs only in Manual and stops at the limit
 * (a fault, reset by Reset); Move goes to the target once homed; the encoder is scaled and zeroed.
 * Run with:  npx tsx src/plc/engine/motion.test.ts
 */
import assert from 'node:assert/strict';
import { defaultHmiContent } from '../../hmi/engine';
import { programWithCycle } from './sequence';
import { pulsesPerUnit } from './motion';
import { createSimulator } from '../sim/engine';
import { createMotionSim, stepMotion } from '../sim/motionSim';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';
import type { IOPoint } from '../../types/io';
import { clickEntrySheetHtml, clickEntryText } from '../core/clickEntrySheet';

assert.deepEqual(pulsesPerUnit(['Axis 1 pulse (200 pulses/mm)']), { ppu: 200, known: true, unit: 'mm' });
assert.deepEqual(pulsesPerUnit(['Encoder 1 A (1000 counts/rev, 10 mm/rev)']), { ppu: 100, known: true, unit: 'mm' });
assert.deepEqual(pulsesPerUnit(['Axis 1 pulse']), { ppu: 1, known: false });

const POINTS: [string, 'input' | 'output', string, string][] = [
  ['Safety relay OK', 'input', 'X007', 'Safety'], ['Axis 1 servo ready', 'input', 'X001', 'Servo/Axis'], ['Axis 1 servo fault', 'input', 'X002', 'Servo/Axis'],
  ['Axis 1 home sensor', 'input', 'X003', 'Servo/Axis'], ['Axis 1 positive limit', 'input', 'X004', 'Servo/Axis'],
  ['Encoder 1 A (1000 counts/rev, 10 mm/rev)', 'input', 'X005', 'Product Detection'], ['Encoder 1 B', 'input', 'X006', 'Product Detection'],
  ['Axis 1 servo pulse (200 pulses/mm)', 'output', 'Y001', 'Servo/Axis'], ['Axis 1 servo direction', 'output', 'Y002', 'Servo/Axis'], ['Axis 1 servo enable', 'output', 'Y004', 'Servo/Axis'],
];
const io = POINTS.map(([description, type, , category], i) => ({ id: `m${i}`, description, type, category, deviceType: type === 'input' ? 'other' : 'relay-coil' })) as IOPoint[];
io[0].deviceType = 'safety-relay-output';
const addresses = new Map(io.map((p, i) => [p.id, POINTS[i][2]] as const));
const content = defaultHmiContent({ io, addresses, machineName: 'Positioner', spec: 'One servo axis positions the part; an encoder measures the feed.' });
assert.equal(content.axes?.length, 1, 'one axis');
assert.equal(content.encoders?.length, 1, 'one encoder');
const r = programWithCycle({ content, spec: '' });
const m = r.program.motion!;
assert.deepEqual(m.axes.map((a) => `${a.axis} ${a.pulse} ${a.direction} ${a.pulsesPerUnit} ${a.limitPos}`), ['1 Y001 Y002 200 X004']);
assert.deepEqual(m.instructions.map((i) => i.kind), ['home', 'velocity', 'position']);
assert.equal(m.instructions[0].homeSwitch, 'X003');
assert.deepEqual(m.counters.map((c) => `${c.channels.join('/')} ${c.quadrature} ${c.withZ}`), ['X005/X006 true false']);
assert.deepEqual(validateProgram(r.program, getProfile('click'), new Set(POINTS.map((p) => p[2]))).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
assert.ok(!validateProgram(r.program, getProfile('click'), new Set(POINTS.map((p) => p[2]))).some((i) => m.instructions.some((x) => i.message.startsWith(`${x.busy} `) || i.message.startsWith(`${x.enable} `))), 'motion bits are not dead logic');
assert.ok(!r.notes.some((n) => /not Y001 \/ Y003 \/ Y005|pulses per mm not given/.test(n)), r.notes.join(' | '));

const role = (x: string) => { const a = r.base.roles.get(x); assert.ok(a, `role ${x}`); return a!; };
const K = 'axis:X001';
const sim = createSimulator(r.program);
const ms = createMotionSim();
const run = (msTotal: number) => { for (let t = 0; t < msTotal; t += 10) { stepMotion(sim, m, 10, ms); sim.step(10); } };
const pulse = (a: string) => { sim.write(a, true); run(50); sim.write(a, false); run(50); };
sim.setInput('X007', true); sim.setInput('X001', true);
run(200);

// Enable: only with Safety OK.
sim.write(role(`${K}:enable`), true); run(100);
assert.equal(sim.readBit('Y004'), true, 'drive enabled');
assert.equal(sim.readBit(role(`${K}:enabled`)), true, 'enabled status');
sim.setInput('X007', false); run(50);
assert.equal(sim.readBit('Y004'), false, 'Safety lost: drive disabled');
sim.setInput('X007', true); run(50);

// Home → homed, position 0.
pulse(role(`${K}:home`)); run(1200);
assert.equal(sim.readBit(role(`${K}:homed`)), true, 'homed after the Home instruction');

// Jog + in Manual: 5 mm/s default → about 5 mm in 1 s; not without Manual.
sim.write(role(`${K}:jogpos`), true); run(500); sim.write(role(`${K}:jogpos`), false); run(50);
assert.equal(sim.readWord(role(`${K}:pos`)), 0, 'no jog outside Manual');
sim.write(role('cmd:manual'), true); run(100);
assert.equal(sim.readBit(role(`${K}:jogpermit`)), true, 'jog permit in Manual');
sim.write(role(`${K}:jogpos`), true); run(1000);
assert.equal(sim.readBit(role(`${K}:moving`)), true, 'moving while jogging');
sim.write(role(`${K}:jogpos`), false); run(100);
const after = sim.readWord(role(`${K}:pos`));
assert.ok(after > 4.5 && after < 5.5, `jogged about 5 mm (${after})`);

// Positive limit: the jog request is not given at the limit (no fault); a jog into it from the instruction side faults.
sim.setInput('X004', true); sim.write(role(`${K}:jogpos`), true); run(300); sim.write(role(`${K}:jogpos`), false);
assert.equal(sim.readWord(role(`${K}:pos`)), after, 'no motion into the limit');
sim.setInput('X004', false); run(50);

// Move to 20 mm at the default 10 mm/s → in position.
sim.write(role(`${K}:target`), 20);
pulse(role(`${K}:move`)); run(2500);
assert.equal(sim.readWord(role(`${K}:pos`)), 20, 'moved to the target');
assert.equal(sim.readBit(role(`${K}:inpos`)), true, 'in position');
assert.equal(sim.readBit(role(`${K}:moving`)), false);

// Drive fault: latched, drive disabled, homed lost; the axis Reset clears it once the drive fault is off.
sim.setInput('X002', true); run(100);
const fault = role(`alarm:axis:X001:fault`);
assert.equal(sim.readBit(fault), true, 'fault latched');
assert.equal(sim.readBit('Y004'), false, 'drive disabled on a fault');
assert.equal(sim.readBit(role(`${K}:homed`)), false, 'homed lost');
sim.setInput('X002', false); pulse(role(`${K}:reset`)); run(100);
assert.equal(sim.readBit(fault), false, 'Reset clears the fault');
assert.equal(sim.readBit('Y004'), true, 're-enabled');
// Move refused until homed again.
sim.write(role(`${K}:target`), 40); pulse(role(`${K}:move`)); run(500);
assert.equal(sim.readWord(role(`${K}:pos`)), 20, 'no move until homed again');

// Encoder: 1000 counts/rev, 10 mm/rev = 100 counts/mm; zero; speed from 100 ms.
const enc = m.counters[0];
sim.write(enc.count, 500); run(150);
assert.equal(sim.readWord(role('enc:X005:pos')), 5, 'encoder 500 counts = 5 mm');
pulse(role('enc:X005:zero'));
assert.equal(sim.readWord(role('enc:X005:pos')), 0, 'zeroed');
// 10 mm/s = 1000 counts/s, counted continuously (10 counts per 10 ms scan). The window is 100 ms + one scan: with the
// test's 10 ms scans that reads up to 10 % high (a real CLICK scans in about 1 ms).
for (let t = 0; t < 100; t++) { sim.write(enc.count, sim.readWord(enc.count) + 10); stepMotion(sim, m, 10, ms); sim.step(10); }
const v = sim.readWord(role('enc:X005:speed'));
assert.ok(v >= 10 && v <= 11, `encoder speed about 10 mm/s (${v})`);

// CLICK entry sheet: High Speed I/O Setup first, then one rung per motion instruction, before END.
const labels = new Map(r.program.tags.map((t) => [t.address.toUpperCase(), t.nickname] as const));
const text = clickEntryText(r.program, labels, 'Positioner');
assert.match(text, /=== Motion — set up first/);
assert.match(text, /High Speed I\/O Setup: PTO Axis 1 "Axis 1" — pulse Y001 .* direction Y002; 200 pulses per mm; current position → DD\d+/);
assert.match(text, /High Speed I\/O Setup: high-speed counter "Encoder 1" on X005 \/ X006 — quadrature A-B; current count → DD\d+/);
for (const k of ['Home for PTO Axis', 'Velocity Move for PTO Axis', 'Position Move for PTO Axis']) assert.ok(text.includes(`Output: ${k} [Axis: Axis 1`), k);
assert.match(text, new RegExp(`Rung ${r.program.rungs.length + 4} — END instruction`), 'END after the three motion rungs');
assert.match(clickEntrySheetHtml(r.program, labels, 'Positioner', ['C2-03CPU']), /Position Move for PTO Axis/);

console.log('motion tests passed');
