// npx tsx src/convert/rollformerProgram.test.ts — the user's roll former (cn-rollformer-01) end to end, the way the app
// does it: the reading → convertMachine → applied to the project (I/O imported) → the program Update all writes for a
// machine with no touch panel (generateRuleBasedProgram, rules only) → the simulator, in the drawn sequence:
// pump on → line start → cut on the servo's cut signal → batch stop → E-stop → reset → no restart.
// The program engine's own closed-loop test (src/plc/engine/rollformer.test.ts) runs on a pinned copy of the converted
// I/O; this test also keeps that copy equal to what the converter produces.
import assert from 'node:assert/strict';
import { convertMachine } from './convert';
import { normalizeMachine } from './derive';
import { applyExistingMachine } from './apply';
import { CN_ROLLFORMER_01_READING } from './__fixtures__/cnRollformer01.reading';
import { CN_ROLLFORMER_IO } from '../plc/engine/__fixtures__/cnRollformerIo';
import { seedSampleProject } from '../preview/sampleProject';
import { useIOStore } from '../store/useIOStore';
import { generateRuleBasedProgram } from '../plc/ai/cycleAI';
import { getProfile } from '../plc/core/profiles';
import { validateProgram } from '../plc/core/validate';
import { createSimulator } from '../plc/sim/engine';

const m = normalizeMachine(CN_ROLLFORMER_01_READING);
const conv = convertMachine(m);

// 1. The converted I/O is the engine's pinned fixture, point for point.
assert.deepEqual(conv.io.map(({ address, description, type, deviceType, category }) => ({ address, description, type, deviceType, category })), CN_ROLLFORMER_IO,
  'src/plc/engine/__fixtures__/cnRollformerIo.ts is stale: copy convertMachine(normalizeMachine(CN_ROLLFORMER_01_READING)).io into it');

// 2. Applied to a project: the I/O list the app builds from.
seedSampleProject();
applyExistingMachine(m, conv);
const io = useIOStore.getState().projectIO;
assert.equal(io.length, conv.io.length);

// 3. The program Update all writes with no touch panel (rules, no AI). CLICK addresses, 16 points per slot.
const profile = getProfile('click');
const cpu = profile.cpuModels.find((c) => c.id === profile.defaultCpuId) ?? profile.cpuModels[0];
let xi = 0, yi = 0;
const slot = (prefix: string, i: number) => `${prefix}${Math.floor(i / 16)}${String((i % 16) + 1).padStart(2, '0')}`;
const addresses = new Map(io.map((p) => [p.id, p.type === 'input' ? slot('X', xi++) : slot('Y', yi++)] as const));
const r = await generateRuleBasedProgram({ ctx: { profile, cpu, io, addresses, wiring: new Map() }, spec: '', electrical: null, hmi: null, noPanel: true });
assert.equal(r.source, 'rules');
assert.deepEqual(validateProgram(r.program, profile, new Set(addresses.values()), undefined, { noPanel: true }).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker: no errors');
assert.ok(r.sequence.steps.some((s) => /U2 cut/.test(s.name)), `the cut runs off the servo's cut signal (${r.sequence.steps.map((s) => s.name).join(' → ')})`);

// 4. The simulator with a small plant: the shear moves while a valve is on; the servo is ready once enabled.
const A = (re: RegExp) => { const p = io.find((x) => re.test(x.description)); assert.ok(p, `point ${re}`); return addresses.get(p!.id)!; };
const sim = createSimulator(r.program);
const set = (re: RegExp, v: boolean) => sim.setInput(A(re), v);
const bit = (re: RegExp) => sim.readBit(A(re));
let shear = 0;
const plant = () => {
  if (bit(/Shear down valve/)) shear = Math.min(1, shear + 0.02);
  if (bit(/Shear up valve/)) shear = Math.max(0, shear - 0.02);
  set(/Shear down limit/, shear >= 1); set(/Shear up limit/, shear <= 0);
  set(/U2 ready/, bit(/DI1 SON/));
};
const run = (ms: number) => { for (let t = 0; t < ms; t += 10) { plant(); sim.step(10); } };
const until = (cond: () => boolean, maxMs: number, what: string) => { for (let t = 0; t < maxMs; t += 10) { if (cond()) return; run(10); } assert.fail(`${what} within ${maxMs} ms`); };
const press = (re: RegExp) => { set(re, true); run(100); set(re, false); run(100); };
const running = () => bit(/Line running lamp/);

// Released NC stops read ON; the safety relay made; U1 healthy; material at the entry; servo enabled.
set(/Pump stop/, true); set(/Line stop/, true); set(/Safety OK/, true); set(/U1 healthy/, true); set(/Entry inductive/, true); set(/Servo enable selector/, true);
run(300);

// Pump on, then the line.
press(/Line start/);
assert.equal(running(), false, 'no line without the pump');
press(/Pump start/);
assert.equal(bit(/Pump contactor/), true, 'pump on');
press(/Line start/);
assert.equal(running(), true, 'line running');
assert.deepEqual([bit(/MI1/), bit(/DI7 CAM/)], [true, true], 'VFD forward and CAM engaged');

// The cut on the servo's cut signal: down to the down limit, up to the up limit; the line keeps running.
set(/U2 cut/, true); run(50);
assert.equal(bit(/Shear down valve/), true, 'cut: shear down');
set(/U2 cut/, false);
until(() => bit(/Shear down limit/), 1000, 'down limit');
until(() => bit(/Shear up valve/), 100, 'shear up');
until(() => bit(/Shear up limit/), 1000, 'up limit');
run(100);
assert.deepEqual([bit(/Shear down valve/), bit(/Shear up valve/), running()], [false, false, true], 'cut done, line still running');

// Batch complete (the H7CX counter) stops the line.
set(/Batch counter output/, true); run(100);
assert.equal(running(), false, 'batch complete stops the line');
assert.equal(bit(/Batch complete lamp/), true);
set(/Batch counter output/, false); press(/Counter reset/);

// E-stop: everything drops; release + Reset restarts nothing; a fresh start is needed.
press(/Line start/);
assert.equal(running(), true);
set(/Safety OK/, false); run(100);
assert.deepEqual([running(), bit(/Pump contactor/), bit(/DI1 SON/), bit(/MI1/), bit(/Shear down valve/)], [false, false, false, false, false], 'E-stop drops line, pump, servo, VFD and shear');
set(/Safety OK/, true); press(/^Reset/); run(500);
assert.deepEqual([running(), bit(/Pump contactor/)], [false, false], 'no restart after release and Reset');
press(/Pump start/); press(/Line start/);
assert.equal(running(), true, 'runs again from a fresh Pump start + Line start');

console.log('roll former end to end: passed');
