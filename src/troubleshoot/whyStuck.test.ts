/// <reference types="node" />
/**
 * "Why stuck?" on the sample conveyor (its hand-written program and the rules' program with cycle steps), closed
 * loop against the simulator's plant model with injected faults; settings and latched alarms on small ladders.
 * Run with:  npx tsx src/troubleshoot/whyStuck.test.ts
 */
import assert from 'node:assert/strict';
import { whyStuck, type Values } from './whyStuck';
import { applySettingChange, nextAction, settingChange } from './actions';
import { applyPresetFaults, faultText, runWithFaults, type Fault } from './simFaults';
import { createSimulator, type Simulator } from '../plc/sim/engine';
import { buildMachineModel } from '../plc/sim/machineModel';
import { CONVEYOR_IO, CONVEYOR_PROGRAM, CONVEYOR_WIRING } from '../plc/sim/__fixtures__/conveyor';
import { defaultHmiContent } from '../hmi/engine';
import { programWithCycle } from '../plc/engine/sequence';
import type { IOPoint } from '../types/io';
import type { LadderProgram } from '../plc/core/ladder';

const values = (sim: Simulator): Values => ({ bit: (a) => sim.readBit(a), word: (a) => sim.readWord(a) });
const ctxIo = CONVEYOR_IO.map((p) => ({ ...p, deviceType: CONVEYOR_WIRING.find((w) => w.address === p.address)?.deviceType }));
const machine = (program: LadderProgram) => ({ sim: createSimulator(program), model: buildMachineModel(CONVEYOR_IO, CONVEYOR_WIRING) });
const press = (sim: Simulator, model: ReturnType<typeof buildMachineModel>, faults: Fault[], label: RegExp) => {
  const b = model.devices.find((d) => d.kind === 'pushbutton' && label.test(d.label));
  assert.ok(b && b.kind === 'pushbutton', `button ${label}`);
  b.state.pressed = true; runWithFaults(sim, model, faults, 200); b.state.pressed = false; runWithFaults(sim, model, faults, 200);
};

// ---- 1. Hand-written sample program: safety relay off → the conveyor (Y001) is off because of X001, not the Start button.
{
  const { sim, model } = machine(CONVEYOR_PROGRAM);
  const faults: Fault[] = [{ kind: 'open-wire', input: 'X001' }];
  runWithFaults(sim, model, faults, 300);
  press(sim, model, faults, /start/i);
  const r = whyStuck(CONVEYOR_PROGRAM, values(sim), { output: 'Y001' }, { io: ctxIo });
  assert.equal(r.state, 'off');
  assert.deepEqual(r.blockers.map((b) => `${b.kind} ${b.point} ${b.next}`).slice(0, 2), ['input X001 wiring', 'input X002 operator'], `safety input first: ${r.summary}`);
  assert.match(r.blockers[0].explain, /E-Stop OK/);
  assert.ok(r.blockers[0].path.some((p) => /C1/.test(p)), 'path goes through Safety OK C1');
  assert.equal(faultText(faults[0], (a) => `${a} ${CONVEYOR_IO.find((p) => p.address === a)?.description}`), 'Open wire on X001 E-Stop OK (safety relay)');
}

// ---- 2. Blown fuse on the pusher valve: Y002 ON, nothing moves; the timeout latches the fault; Reset needed.
{
  const { sim, model } = machine(CONVEYOR_PROGRAM);
  const faults: Fault[] = [{ kind: 'blown-fuse', outputs: ['Y002'], fuse: 'F3' }];
  runWithFaults(sim, model, faults, 300);
  press(sim, model, faults, /start/i);
  let pushing = false;
  for (let t = 0; t < 30_000 && !pushing; t += 50) { runWithFaults(sim, model, faults, 50); pushing = sim.readBit('Y002'); }
  assert.ok(pushing, 'a part reaches the eye: the pusher output turns ON');
  const r = whyStuck(CONVEYOR_PROGRAM, values(sim), { output: 'Y002' }, { io: ctxIo });
  assert.equal(r.state, 'on');
  assert.deepEqual(r.blockers.map((b) => `${b.kind} ${b.point} ${b.next}`), ['output-no-motion Y002 wiring'], 'ON in the PLC: the fault is downstream');
  runWithFaults(sim, model, faults, 4000);
  assert.equal(sim.readBit('C10'), true, 'pusher timeout fault latched');
  const r2 = whyStuck(CONVEYOR_PROGRAM, values(sim), { output: 'Y001' }, { io: ctxIo });
  assert.equal(r2.blockers[0].kind, 'reset-needed', `latched fault: ${r2.summary}`);
  assert.equal(r2.blockers[0].point, 'C10');
}

// ---- 3. Rules' program with cycle steps: an open wire on "Pusher extended" — step 20 waits with the valve ON.
{
  const io = CONVEYOR_IO.map((p, i) => ({ id: `c${i}`, description: p.description, type: p.type, category: p.category, deviceType: CONVEYOR_WIRING.find((w) => w.address === p.address)?.deviceType })) as IOPoint[];
  const addresses = new Map(io.map((p, i) => [p.id, CONVEYOR_IO[i].address] as const));
  const content = defaultHmiContent({ io, addresses, machineName: 'Conveyor', spec: '' });
  const prog = programWithCycle({ content, spec: '' });
  const S = prog.stepRegister;
  const { sim, model } = machine(prog.program);
  const faults: Fault[] = [{ kind: 'open-wire', input: 'X005' }];
  runWithFaults(sim, model, faults, 300);
  sim.write(prog.base.roles.get('cmd:start')!, true); runWithFaults(sim, model, faults, 100); sim.write(prog.base.roles.get('cmd:start')!, false);
  let at20 = false;
  for (let t = 0; t < 30_000 && !at20; t += 50) { runWithFaults(sim, model, faults, 50); at20 = sim.readWord(S) === 20; }
  assert.ok(at20, `the cycle reaches step 20 (${prog.sequence.steps.map((s) => s.name).join(' → ')})`);
  runWithFaults(sim, model, faults, 500);
  const r = whyStuck(prog.program, values(sim), { step: 20 }, { io: ctxIo });
  assert.deepEqual(r.blockers.slice(0, 2).map((b) => `${b.kind} ${b.point}`), ['output-no-motion Y002', 'input X005'], `step 20: ${r.summary}`);
  assert.match(r.summary, /Step 20 does not advance: Step 20 waits for X005 \(Pusher extended\) while Y002 \(Pusher solenoid\) is ON/);
  assert.equal(whyStuck(prog.program, values(sim), { step: 30 }).summary, 'Step 30 is not the active step (DS1150 = 20).');
}

// ---- 4. Settings: a timer preset register at 0, a compare against a setpoint; a bit nothing writes; a timer still timing.
{
  const p: LadderProgram = { tags: [{ address: 'DS5', nickname: 'Dwell_SP', comment: 'Dwell time (ms)' }, { address: 'DF1', nickname: 'Temp', comment: 'Seal temperature' }], rungs: [
    { id: 'a', comment: 'Default only on the first scan', branches: [[{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS5', op: '<', right: '0' }]], outputs: [{ type: 'COPY', source: '500', dest: 'DS5' }] },
    { id: 'b', comment: 'Dwell timer', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS5', unit: 'ms', accumulate: false, resetAddress: null }] },
    { id: 'c', comment: 'Done after the dwell', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'd', comment: 'Ready when hot', branches: [[{ type: 'CMP', left: 'DF1', op: '>=', right: 'DS6' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'h', comment: 'First scan: DS6 outside 50-300 is loaded with 160', branches: [[{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS6', op: '<', right: '50' }], [{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS6', op: '>', right: '300' }]], outputs: [{ type: 'COPY', source: '160', dest: 'DS6' }] },
    { id: 'e', comment: 'Waits for a panel command', branches: [[{ type: 'NO', address: 'C1001' }]], outputs: [{ type: 'OUT', address: 'Y003' }] },
    { id: 'f', comment: 'A 5 s timer', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'g', comment: 'After 5 s', branches: [[{ type: 'NO', address: 'T2' }]], outputs: [{ type: 'OUT', address: 'Y004' }] },
  ] };
  const sim = createSimulator(p);
  const faults: Fault[] = [{ kind: 'wrong-preset', register: 'DS5', value: 30000 }];
  sim.step(10); applyPresetFaults(sim, faults); sim.setInput('X001', true); sim.setInput('X002', true); sim.write('DF1', 150); sim.write('DS6', 180); sim.run(1000);
  const io4 = [{ address: 'DF1', description: 'Seal temperature', type: 'input' }];
  const k = (out: string) => whyStuck(p, values(sim), { output: out }, { io: io4 }).blockers.map((b) => `${b.kind} ${b.point} ${b.next}`);
  assert.deepEqual(k('Y001'), ['setting DS5 setting'], 'a preset 60 times its default');
  assert.deepEqual(k('Y002'), ['setting DS6 setting'], 'the setpoint is not reached');
  assert.deepEqual(k('Y003'), ['logic C1001 logic'], 'nothing writes the panel bit');
  assert.match(whyStuck(p, values(sim), { output: 'Y003' }).summary, /touch-panel command/);
  const w = whyStuck(p, values(sim), { output: 'Y004' });
  assert.deepEqual(w.blockers.map((b) => `${b.kind} ${b.point}`), ['waiting T2']);
  assert.match(w.blockers[0].explain, /timing: 1 of 5 sec/);

  // ---- End actions: a DS setting is changed live after a confirmation; a panel bit nothing writes gets CLICK edit steps.
  const ds6 = whyStuck(p, values(sim), { output: 'Y002' }, { io: io4 }).blockers[0];
  assert.deepEqual(ds6.limits, { min: 50, max: 300, default: 160 }, 'the range the program declares for DS6');
  assert.equal(settingChange(ds6)!.to, 160, 'suggested value = the declared default');
  const ch = settingChange(ds6, 140)!;
  assert.deepEqual({ address: ch.address, from: ch.from, to: ch.to, live: ch.live, min: ch.min, max: ch.max }, { address: 'DS6', from: 180, to: 140, live: true, min: 50, max: 300 });
  assert.match(ch.question, /^Write 140 to DS6\? It is 180 now; the program allows 50–300/);
  // Refused: outside the declared range, -32768, a fraction in a DS, a register with no declared range, a bit.
  for (const bad of [20, 400, -32768, 140.5, NaN]) assert.equal(settingChange(ds6, bad), null, `no change to ${bad}`);
  assert.equal(settingChange({ ...ds6, limits: undefined }, 140), null, 'no declared range: no live change');
  for (const point of ['C5', 'T1', 'CT1', 'X001', 'Y001', 'SC1', 'DD1', 'TD1']) assert.equal(settingChange({ ...ds6, point }, 140), null, `${point} is not a setting`);
  await assert.rejects(applySettingChange({ ...ch, to: -32768 }, () => true, async () => { throw new Error('must not write'); }), /outside the range/);
  await assert.rejects(applySettingChange({ ...ch, address: 'C5' }, () => true, async () => { throw new Error('must not write'); }), /not a setpoint register/);
  const writes: string[] = [];
  const fake = async (a: string, v: boolean | number) => { writes.push(`${a}=${v}`); };
  assert.equal(await applySettingChange(ch, () => false, fake), 'cancelled');
  assert.deepEqual(writes, [], 'nothing written without the confirmation');
  assert.equal(await applySettingChange(ch, () => true, fake), 'written');
  assert.deepEqual(writes, ['DS6=140']);
  const tmr = whyStuck(p, values(sim), { output: 'Y001' }).blockers[0];
  assert.equal(nextAction(tmr).kind, 'setting');
  const df = settingChange({ ...tmr, point: 'DF9', limits: { min: 0, max: 10 } }, 1)!;
  assert.equal(df.live, false, 'DF cannot be written from Online');
  await assert.rejects(applySettingChange(df, () => true, fake), /cannot be written from here/);
  const panel = nextAction(whyStuck(p, values(sim), { output: 'Y003' }).blockers[0]);
  assert.equal(panel.kind, 'edit');
  assert.ok(panel.steps!.some((x) => x === 'Go to rung 6 (search for C1001).') && panel.steps!.some((x) => /Replace the contact C1001 with the input/.test(x)) && panel.steps!.some((x) => /PLC > Write Project into PLC/.test(x)), panel.steps!.join(' | '));
  assert.equal(nextAction({ ...tmr, next: 'wiring', point: 'X004', description: 'Part at end photo-eye' }).kind, 'wiring');
}

console.log('whyStuck tests passed');
