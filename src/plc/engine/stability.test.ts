/// <reference types="node" />
/**
 * Address stability: an address, once assigned to a function, keeps it. On the example project (an HMI
 * made by hand, no tag roles): the rule-based program implements every HMI address with its meaning;
 * redesigning the HMI keeps every address; a new HMI next to an old program takes no address the program
 * uses. Run with:  npx tsx src/plc/engine/stability.test.ts
 */
import assert from 'node:assert/strict';
import { HMI, LADDER } from '../../preview/sampleProject';
import { buildHmi, defaultHmiContent } from '../../hmi/engine';
import { inferRoles } from '../../hmi/engine/roles';
import { programWithCycle } from './sequence';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { validateProgram } from '../core/validate';
import { rungAddresses, rungWrites } from '../core/ladder';
import { createSimulator } from '../sim/engine';
import { buildMachineModel, machineInputs, stepMachine } from '../sim/machineModel';
import type { IOPoint } from '../../types/io';

const profile = getProfile('click');
const io = [
  ['E-Stop OK (safety relay)', 'input', 'Safety'], ['Start Button', 'input', 'Operator/HMI'], ['Stop Button', 'input', 'Operator/HMI'],
  ['Part at end photo-eye', 'input', 'Product Detection'], ['Pusher extended', 'input', 'Pneumatic'], ['Pusher retracted', 'input', 'Pneumatic'],
  ['Conveyor motor contactor', 'output', 'Conveyor'], ['Pusher solenoid', 'output', 'Pneumatic'], ['Main air dump valve', 'output', 'Pneumatic'],
].map(([description, type, category], i) => ({ id: `p${i}`, description, type, category })) as IOPoint[];
const addresses = resolveAddresses(profile, getCpu(profile, 'C0-10DD1E-D'), io, moduleSlots([]));
const content = defaultHmiContent({ io, addresses, machineName: 'Conveyor Cell' });
const states = HMI.screens.flatMap((s) => s.elements).find((e) => e.kind === 'multistate' && e.address === 'DS1101')!.states!;
content.states = states;

// 1. Roles read from the example HMI's own tags.
const { tags, unmatched } = inferRoles(HMI.tags, { content, screens: HMI.screens, alarms: HMI.alarms });
const role = (a: string) => tags.find((t) => t.address === a)?.role;
assert.deepEqual(Object.fromEntries(['C1001', 'C1002', 'C1003', 'C1004', 'C1005', 'C1006', 'C1007', 'C1009', 'C1101', 'C1102', 'C1103', 'C1201', 'C1203', 'C1204', 'C1205', 'DS1001', 'DS1002', 'DS1003', 'DS1101', 'DS1102', 'DS1103', 'DS1104', 'CTD1', 'C1', 'C2', 'TD1'].map((a) => [a, role(a)])), {
  C1001: 'cmd:start', C1002: 'cmd:stop', C1003: 'cmd:reset', C1004: 'cmd:countreset', C1005: 'cmd:manual', C1006: 'jog:Y001', C1007: 'jog:Y002', C1009: 'cmd:servicedone',
  C1101: 'alarm:timeout:Y002', C1102: 'alarm:safety', C1103: 'alarm:servicedue', C1201: 'sts:manual', C1203: 'sts:heartbeat', C1204: 'permit:Y001', C1205: 'permit:Y002',
  DS1001: 'sp:timeout:Y002', DS1002: 'sp:batch', DS1003: 'sp:serviceinterval', DS1101: 'word:state', DS1102: 'word:runhours', DS1103: 'word:rate', DS1104: 'word:sinceservice',
  CTD1: 'word:count', C1: 'int:safety', C2: 'int:running', TD1: 'timer:timeout:Y002',
});
assert.deepEqual(unmatched.map((t) => t.address).sort(), ['C1008', 'CTD2'], 'only the pusher cycle counter and its reset need the description rule');

// 2. The rule-based program on the example HMI: every HMI address implemented with its meaning.
const r = programWithCycle({ content, hmiTags: HMI.tags, hmiScreens: HMI.screens, hmiAlarms: HMI.alarms, spec: 'Conveyor brings parts to the end; the pusher pushes each part off.' });
const ioSet = new Set([...addresses.values()]);
assert.deepEqual(validateProgram(r.program, profile, ioSet, HMI).map((i) => `${i.severity}: ${i.message}`), [], 'checker with the HMI: every tag written / read');
assert.deepEqual(r.base.unmatched, [], 'nothing left unimplemented');
const writers = (a: string) => r.program.rungs.filter((x) => rungWrites(x).includes(a));
const readers = (a: string) => r.program.rungs.filter((x) => rungAddresses(x).includes(a) && !rungWrites(x).includes(a));
assert.ok(readers('C1004').some((x) => x.outputs.some((o) => o.type === 'CNT' && o.resetAddress === 'C1004')), 'C1004 stays Count Reset (resets the part counter)');
assert.ok(writers('C1201').length === 1 && /Manual mode active/.test(writers('C1201')[0].comment), 'C1201 stays Manual mode');
assert.ok(readers('C1005').some((x) => /Manual mode/.test(x.comment)), 'C1005 stays Manual select');
assert.ok(writers('C1101').some((x) => /Pusher/.test(x.comment)) && writers('C1102').some((x) => /Safety circuit open/.test(x.comment)), 'C1101 Pusher fault, C1102 Safety open (not swapped)');
assert.ok(writers('DS1102').some((x) => x.outputs.some((o) => o.type === 'MATH' && /DS1102 \+ 1/.test(o.expression))), 'DS1102 stays Run hours');
assert.ok(writers('DS1103').some((x) => /Parts per minute/.test(x.comment)), 'DS1103 stays Parts per minute');
assert.ok(r.program.rungs.some((x) => x.outputs.some((o) => o.type === 'CNT' && o.address === 'CT2' && o.resetAddress === 'C1008')), 'CTD2 Pusher cycles counted, reset by C1008');
assert.ok(r.program.rungs.some((x) => x.outputs.some((o) => o.type === 'TMR' && o.address === 'T1') && /extend timeout/.test(x.comment)), 'TD1 shows the pusher timeout timer');
const stateCopy = (text: string) => r.program.rungs.find((x) => x.comment.startsWith('Machine state') && x.comment.includes(text))?.outputs.find((o) => o.type === 'COPY');
assert.deepEqual([stateCopy('Running'), stateCopy('Faulted'), stateCopy('Manual'), stateCopy('Safety Stop')].map((o) => (o as { source: string }).source), ['1', '3', '4', '5'], 'state numbers from the HMI table');
assert.notEqual(r.stepRegister, 'DS1101'); assert.notEqual(r.cycleCounter, 'CT2', 'cycle counter does not take the HMI pusher counter');

// 3. In the simulator: E-stop shows Safety open (C1102), not Pusher fault (C1101); the HMI does not say Manual.
{
  const sim = createSimulator(r.program);
  const m = buildMachineModel(io.map((p) => ({ address: addresses.get(p.id)!, description: p.description, type: p.type, category: p.category })), []);
  for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
  const scan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(m, sim.outputs(), 10)) sim.setInput(a, v); sim.step(10); } };
  scan(200); sim.write('C1001', true); scan(100); sim.write('C1001', false); scan(2000);
  assert.equal(sim.readBit('C1201'), false, 'not Manual while running');
  assert.equal(sim.readWord('DS1101') >= 1, true, 'state Running / Pushing');
  const es = m.devices.find((d) => d.kind === 'estop')!;
  if (es.kind === 'estop') es.state.pressed = true;
  scan(200);
  assert.equal(sim.readBit('C1102'), true, 'E-stop -> Safety open alarm C1102');
  assert.equal(sim.readBit('C1101'), false, 'E-stop is not a Pusher fault');
  assert.equal(sim.readWord('DS1101'), 5, 'state 5 Safety stop (the HMI table)');
}

// 4. Redesigning the example HMI keeps every address's meaning; new tags take no address the old HMI or program uses.
{
  const programAddr = LADDER.rungs.flatMap((x) => [...rungAddresses(x), ...rungWrites(x)]);
  const redesign = buildHmi(content, { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480, keepTags: tags, usedAddresses: programAddr });
  for (const t of tags.filter((x) => x.role && !x.role.startsWith('int:'))) {
    const now = redesign.tags.find((x) => x.role === t.role);
    if (now) assert.equal(now.address, t.address, `${t.role} keeps ${t.address} (got ${now.address})`);
  }
  const oldAddr = new Set([...HMI.tags.map((t) => t.address), ...programAddr]);
  const keptRoles = new Set(tags.filter((t) => t.role).map((t) => t.role));
  for (const t of redesign.tags) if (!keptRoles.has(t.role)) assert.ok(!oldAddr.has(t.address), `new tag ${t.name} takes ${t.address}, which is already in use`);
  // The redesigned HMI with the rebuilt program: still consistent.
  const r2 = programWithCycle({ content, hmiTags: redesign.tags, hmiScreens: redesign.screens, hmiAlarms: redesign.alarms, spec: '' });
  assert.deepEqual(validateProgram(r2.program, profile, ioSet, redesign).filter((i) => i.severity === 'error').map((i) => i.message), []);
}

// 5. A new HMI next to an old program (no HMI yet): no collisions.
{
  const programAddr = new Set(LADDER.rungs.flatMap((x) => [...rungAddresses(x), ...rungWrites(x)]));
  const fresh = buildHmi(content, { partNumber: 'P', widthPx: 800, heightPx: 480, usedAddresses: programAddr });
  for (const t of fresh.tags) assert.ok(!programAddr.has(t.address) || /^[XY]/.test(t.address), `${t.name} collides with the program's ${t.address}`);
}
// 6. The example program (hand-made): stopped during a push, the part left at the eye is pushed after the restart.
{
  const sim = createSimulator(LADDER);
  const m = buildMachineModel(io.map((p) => ({ address: addresses.get(p.id)!, description: p.description, type: p.type, category: p.category })), []);
  for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
  const scan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(m, sim.outputs(), 10)) sim.setInput(a, v); sim.step(10); } };
  scan(200); sim.write('C1001', true); scan(100); sim.write('C1001', false);
  for (let t = 0; t < 20_000 && !sim.readBit('Y002'); t += 10) scan(10);
  assert.equal(sim.readBit('Y002'), true, 'push started');
  sim.write('C1002', true); scan(50); sim.write('C1002', false); scan(1500);
  assert.equal(sim.readBit('Y002'), false, 'Stop ends the push');
  const atEye = sim.readBit('X004');
  sim.write('C1001', true); scan(100); sim.write('C1001', false);
  if (atEye) {
    let pushed = false;
    for (let t = 0; t < 3000 && !pushed; t += 10) { scan(10); pushed = sim.readBit('Y002'); }
    assert.ok(pushed, 'the part left at the eye is pushed after the restart');
  }
  assert.equal(sim.readBit('C1101'), false, 'no fault');
}
// 7. Checker dead-logic warnings: internal memory read but never written, or written but never read.
{
  const dead = validateProgram({ tags: [], rungs: [
    { id: 'a', comment: '', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NO', address: 'C50' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'b', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'C51' }, { type: 'TMR', address: 'T5', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'c', comment: '', branches: [[{ type: 'NO', address: 'C1001' }]], outputs: [{ type: 'OUT', address: 'C1201' }, { type: 'CNT', address: 'CT4', direction: 'UP', preset: '10', resetAddress: 'X003' }] },
  ] }, profile, ioSet).map((i) => `${i.rungId}: ${i.message}`);
  assert.deepEqual(dead, ['a: C50 is read but never written: it is always 0 / OFF.', 'b: C51 is written but never read: this logic does nothing.', 'b: T5 is written but never read: this logic does nothing.',
    'a: Y001 can never turn on: every way to switch it on needs C50, which nothing writes.'],
    'HMI ranges and counters are left out');
}
console.log('address stability tests passed');
