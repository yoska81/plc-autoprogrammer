/// <reference types="node" />
/**
 * Rule-based PLC program: every standard block from the I/O list and the HMI tags, checker clean, every
 * HMI tag implemented, every motion output gated by Safety OK, and it runs in the simulator. The AI
 * cycle block is checked before it is used. Goldens: __fixtures__/program-*.txt.
 * Run with:  npx tsx src/plc/engine/program.test.ts      (UPDATE=1 regenerates the goldens)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgram } from './program';
import { checkSequence, programWithCycle, sequenceTable, type CycleSequence } from './sequence';
import { buildHmi, defaultHmiContent } from '../../hmi/engine';
import { generateRuleBasedProgram } from '../ai/cycleAI';
import { setClaudeInterceptor } from '../../lib/ai/anthropic';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { validateProgram } from '../core/validate';
import { rungAddresses, rungWrites, type LadderProgram } from '../core/ladder';
import { createSimulator } from '../sim/engine';
import { buildMachineModel, machineInputs, resetSafetyRelay, stepMachine } from '../sim/machineModel';
import type { IOPoint } from '../../types/io';
import type { HmiDesign } from '../../hmi/types';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
type P = Pick<IOPoint, 'description' | 'type'> & Partial<IOPoint>;
const pt = (description: string, type: 'input' | 'output', extra: Partial<IOPoint> = {}): P => ({ description, type, ...extra });
const profile = getProfile('click');

function project(points: P[], cpuId = 'C0-10DD1E-D', modules: string[] = []) {
  const io = points.map((p, i) => ({ category: p.type === 'output' && /conveyor|belt/i.test(p.description) ? 'Conveyor' : 'Operator/HMI', ...p, id: `p${i}` })) as IOPoint[];
  const cpu = getCpu(profile, cpuId);
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const content = defaultHmiContent({ io, addresses, machineName: 'M' });
  const hmi = buildHmi(content, { partNumber: 'P', widthPx: 800, heightPx: 480, now: 'T' });
  return { io, cpu, addresses, content, hmi };
}

/** The design review's program and HMI rules (src/review/checks.ts), applied here. */
function reviewProblems(p: LadderProgram, io: IOPoint[], addresses: Map<string, string>, hmi: HmiDesign): string[] {
  const out: string[] = [];
  const writes = new Set(p.rungs.flatMap(rungWrites).map((w) => w.toUpperCase()));
  for (const r of p.rungs) for (const o of r.outputs) { if (o.type === 'TMR') writes.add(`TD${o.address.slice(1)}`); if (o.type === 'CNT') writes.add(`CTD${o.address.slice(2)}`); }
  const reads = new Set(p.rungs.flatMap((r) => r.branches.flat().flatMap((e) => (e.type === 'CMP' ? [e.left, e.right] : [e.address]))
    .concat(r.outputs.flatMap((o) => (o.type === 'COPY' ? [o.source] : o.type === 'MATH' ? (o.expression.match(/[A-Z]+\d+/g) ?? []) : o.type === 'TMR' || o.type === 'CNT' ? [o.preset, o.resetAddress ?? ''] : [])))).map((a) => a.toUpperCase()));
  const sets = new Set(p.rungs.flatMap((r) => r.outputs.filter((o) => o.type === 'SET').map((o) => (o as { address: string }).address)));
  const resets = new Set(p.rungs.flatMap((r) => r.outputs.filter((o) => o.type === 'RST').map((o) => (o as { address: string }).address)));
  for (const t of hmi.tags) {
    if (/^[XY]\d/.test(t.address) || /^DF\d$/.test(t.address)) continue;
    if (t.access === 'read' && !writes.has(t.address)) out.push(`HMI tag ${t.address} ${t.name} never written`);
    if (t.access !== 'read' && !reads.has(t.address)) out.push(`HMI command ${t.address} ${t.name} never read`);
  }
  for (const a of hmi.alarms) { if (!writes.has(a.address)) out.push(`alarm ${a.address} never set`); else if (sets.has(a.address) && !resets.has(a.address)) out.push(`alarm ${a.address} never reset`); }
  for (const s of hmi.screens) for (const e of s.elements) if (e.interlock && !writes.has(e.interlock)) out.push(`permit ${e.interlock} never written`);
  // Outputs driven, and motion outputs depend on the safety input.
  const writers = new Map<string, string[]>();
  for (const r of p.rungs) for (const w of rungWrites(r)) writers.set(w, [...(writers.get(w) ?? []), ...rungAddresses(r)]);
  const deps = (a: string) => { const seen = new Set<string>(); const todo = [a]; while (todo.length) for (const d of writers.get(todo.pop()!) ?? []) if (!seen.has(d)) { seen.add(d); todo.push(d); } return seen; };
  const safety = io.filter((q) => q.type === 'input' && /safety|e-?stop/i.test(q.description)).map((q) => addresses.get(q.id)!);
  for (const q of io.filter((x) => x.type === 'output' && x.signal !== 'analog')) {
    const a = addresses.get(q.id)!;
    if (!writes.has(a)) out.push(`output ${a} ${q.description} never driven`);
    else if (safety.length && !/light|lamp|stack/i.test(q.description) && !safety.some((s) => deps(a).has(s))) out.push(`output ${a} ${q.description} not gated by Safety OK`);
  }
  return out;
}

function golden(name: string, p: LadderProgram, notes: string[]) {
  const g = [...(p.blocks ?? []).map((b) => `block ${b.id} "${b.name}"`), '',
    ...p.rungs.map((r) => `[${r.block}] ${r.comment}\n    ${r.branches.map((b) => b.map((e) => (e.type === 'CMP' ? `${e.left}${e.op}${e.right}` : `${e.type}:${e.address}`)).join(' ')).join(' | ') || '(always)'}  ->  ${r.outputs.map((o) => (o.type === 'TMR' ? `TMR ${o.address} ${o.preset}${o.unit}` : o.type === 'CNT' ? `CNT ${o.address} rst ${o.resetAddress}` : o.type === 'COPY' ? `COPY ${o.source}->${o.dest}` : o.type === 'MATH' ? `MATH ${o.dest}=${o.expression}` : `${o.type} ${o.address}`)).join(', ')}`),
    '', ...p.tags.map((t) => `${t.address} ${t.nickname}: ${t.comment}`), '', ...notes.map((n) => `note: ${n}`), ''].join('\n');
  const file = path.join(FIX, `program-${name}.txt`);
  if (process.env.UPDATE) { fs.mkdirSync(FIX, { recursive: true }); fs.writeFileSync(file, g); }
  assert.equal(g, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), `program-${name}: golden differs (UPDATE=1 to regenerate after an intended change)`);
}

const EXAMPLE = [
  pt('E-Stop OK (safety relay)', 'input'), pt('Start Button', 'input'), pt('Stop Button', 'input'), pt('Part at end photo-eye', 'input'),
  pt('Pusher extended', 'input'), pt('Pusher retracted', 'input'), pt('Conveyor motor contactor', 'output'), pt('Pusher solenoid', 'output'), pt('Main air dump valve', 'output'),
];
const BIG = [
  pt('Safety OK', 'input'), pt('Start PB', 'input'), pt('Stop PB', 'input'), pt('Reset PB', 'input'),
  ...Array.from({ length: 10 }, (_, i) => pt(`Zone ${Math.ceil((i + 1) / 5)} part present ${i + 1}`, 'input', { deviceType: 'sensor-pnp' })),
  ...[1, 2, 3].map((n) => pt(`Belt ${n} VFD fault`, 'input')), pt('Gripper closed', 'input'), pt('Gripper open', 'input'),
  ...[1, 2, 3].map((n) => pt(`Belt ${n} VFD run`, 'output')), pt('Belt 1 VFD reverse', 'output'), pt('Gripper close solenoid', 'output'), pt('Gripper open solenoid', 'output'),
  pt('Running light', 'output'), pt('Fault light', 'output'),
  pt('Belt 1 speed reference', 'output', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 60, units: 'Hz' } }),
  pt('Tank level', 'input', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }),
];
const SEALING = [
  pt('Safety OK', 'input'), pt('Start PB', 'input'), pt('Head up sensor', 'input'), pt('Head down sensor', 'input'), pt('Sealing bar temperature OK', 'input'),
  pt('Unwinder motor run', 'output'), pt('Heater contactor', 'output'), pt('Head down solenoid', 'output'), pt('Head up solenoid', 'output'),
];

const SPECS: Record<string, string> = {
  example: 'Conveyor brings parts to the end photo-eye; the pusher pushes each part off and retracts.',
  big: 'Belts feed parts to the gripper; the gripper closes and opens for each part.',
  sealing: 'Film comes off the unwinder; the head comes down, seals for the dwell time of 2 s and goes up.',
};
const CASES = [['example', EXAMPLE, 'C0-10DD1E-D', []], ['big', BIG, 'C0-11DD1E-D', ['C0-16ND3', 'C0-08TD1', 'C0-04AD-1', 'C0-04DA-1']], ['sealing', SEALING, 'C0-10DD1E-D', []]] as const;

for (const [name, points, cpu, modules] of CASES) {
  const pr = project([...points], cpu, [...modules]);
  const t0 = performance.now();
  const r = programWithCycle({ content: pr.content, hmiTags: pr.hmi.tags, spec: SPECS[name] });
  assert.ok(performance.now() - t0 < 200, 'built in milliseconds');
  assert.ok(r.sequence.steps.length >= 2, `${name}: a default cycle`);
  assert.deepEqual(checkSequence(r.sequence, r.base, new Set(pr.content.io.filter((p) => p.type === 'input').map((p) => p.address))), []);
  const ioSet = new Set([...pr.addresses.values()]);
  const issues = validateProgram(r.program, profile, ioSet);
  assert.deepEqual(issues.map((i) => `${i.severity}: ${i.message}`), [], `${name}: checker issues`);
  assert.deepEqual(reviewProblems(r.program, pr.io, pr.addresses, pr.hmi), [], `${name}: design review problems`);
  assert.equal(new Set(r.program.rungs.map((x) => x.id)).size, r.program.rungs.length, 'unique rung ids');
  assert.equal(sequenceTable(r.sequence).length, r.sequence.steps.length);
  golden(name, r.program, [...r.notes, ...sequenceTable(r.sequence).map((x) => `step ${x.step}: ${x.does} | waits ${x.waits} | timeout ${x.timeout}`)]);
}

/** Closed loop: the generated program against the simulator's plant model (cylinders, conveyors, parts, drives). */
function closedLoop(name: string, sequence?: CycleSequence) {
  const [, points, cpu, modules] = CASES.find((x) => x[0] === name)!;
  const pr = project([...points], cpu, [...modules]);
  const r = programWithCycle({ content: pr.content, hmiTags: pr.hmi.tags, spec: SPECS[name], sequence });
  const sim = createSimulator(r.program);
  const m = buildMachineModel(pr.io.map((p) => ({ address: pr.addresses.get(p.id)!, description: p.description, type: p.type, category: p.category, ...(p.signal === 'analog' && p.analog ? { analog: p.analog } : {}) })), []);
  for (const [a, v] of machineInputs(m)) sim.setInput(a, v);
  const scan = (ms: number) => { for (let t = 0; t < ms; t += 10) { for (const [a, v] of stepMachine(m, sim.outputs(), 10, (x) => sim.readWord(x))) sim.setInput(a, v); sim.step(10); } };
  const tag = (role: string) => pr.hmi.tags.find((t) => t.role === role)!.address;
  const cycles = () => sim.readWord(`CTD${r.cycleCounter.slice(2)}`);
  const press = (role: string) => { sim.write(tag(role), true); scan(100); sim.write(tag(role), false); scan(100); };
  return { sim, m, r, pr, scan, tag, cycles, press };
}

// ACCEPTANCE: Start in Auto runs full automatic cycles; every step is reached and the cycle count increments.
for (const name of ['example', 'sealing', 'big']) {
  const { sim, r, scan, cycles, press, tag } = closedLoop(name);
  scan(200);
  press('cmd:start');
  assert.equal(sim.readBit(tag('sts:running')), true, `${name}: running after Start`);
  const seen = new Set<number>();
  for (let t = 0; t < 120_000 && cycles() < 3; t += 20) { scan(20); seen.add(sim.readWord('DS1150')); }
  const want = r.sequence.steps.map((_, i) => (i + 1) * 10);
  assert.deepEqual(want.filter((v) => !seen.has(v)), [], `${name}: every step reached (${r.sequence.steps.map((x) => x.name).join(' → ')})`);
  assert.ok(cycles() >= 3, `${name}: 3 cycles completed (got ${cycles()})`);
  assert.equal(sim.readBit('C3'), false, `${name}: no fault`);
  console.log(`  ${name}: ${cycles()} automatic cycles, steps ${[...seen].filter((v) => v).sort((a, b) => a - b).join(', ')}`);
}

// FAULT: a position sensor that never comes on -> timeout alarm stops the cycle -> sensor back + Reset -> Start runs again.
for (const [name, sensor] of [['example', 'X005'], ['sealing', 'X004']] as const) {
  const { sim, scan, cycles, press, tag, pr } = closedLoop(name);
  assert.ok(pr.content.io.some((p) => p.address === sensor), `${name}: ${sensor} exists`);
  scan(200);
  press('cmd:start');
  sim.force(sensor, false);
  for (let t = 0; t < 30_000 && !sim.readBit('C3'); t += 50) scan(50);
  assert.equal(sim.readBit('C3'), true, `${name}: missing ${sensor} -> fault`);
  const latched = pr.hmi.alarms.filter((a) => sim.readBit(a.address)).map((a) => a.message);
  assert.ok(latched.some((m) => /in time/.test(m)), `${name}: timeout alarm (${latched.join('; ')})`);
  assert.equal(sim.readBit(tag('sts:running')), false, `${name}: the cycle stopped`);
  sim.force(sensor, null);
  scan(2000);
  press('cmd:reset');
  assert.equal(sim.readBit('C3'), false, `${name}: Reset clears the fault once the sensor is back`);
  const before = cycles();
  press('cmd:start');
  for (let t = 0; t < 60_000 && cycles() <= before; t += 50) scan(50);
  assert.ok(cycles() > before, `${name}: runs again after Reset and Start`);
}

// The example's safety and manual behaviour.
{
  const { sim, scan, press, tag, m } = closedLoop('example');
  const estop = m.devices.find((d) => d.kind === 'estop');
  assert.ok(estop && estop.kind === 'estop');
  scan(200);
  press('cmd:start');
  scan(500);
  assert.equal(sim.readBit('Y001'), true, 'conveyor feeds in step 10');
  assert.equal(sim.readWord(tag('word:state')), 1, 'state Running');
  estop.state.pressed = true; scan(100);
  assert.equal(sim.readBit('Y001'), false, 'safety loss stops the conveyor');
  assert.equal(sim.readBit(tag('alarm:safety')), true, 'safety open alarm');
  assert.equal(sim.readWord(tag('word:state')), 4, 'state Safety Stop');
  estop.state.pressed = false; scan(300);
  assert.equal(sim.readBit(tag('alarm:safety')), true, 'the safety relay waits for its manual reset');
  resetSafetyRelay(m, m.devices.find((d) => d.kind === 'safetyRelay')!.id); scan(100);
  assert.equal(sim.readBit(tag('alarm:safety')), false, 'relay reset: safety OK');
  assert.equal(sim.readBit('Y001'), false, 'no restart by itself');
  sim.write(tag('cmd:manual'), true); scan(100);
  assert.equal(sim.readBit(tag('sts:manual')), true, 'Manual mode');
  sim.write(tag('jog:Y002'), true); scan(100);
  assert.equal(sim.readBit('Y002'), true, 'hold-to-run extend while permitted');
  sim.write(tag('jog:Y002'), false); scan(100);
  assert.equal(sim.readBit('Y002'), false, 'stops on release');
}

// Pipeline: AI fails -> default cycle with a note; recorded steps -> used; bad steps -> default kept.
{
  const pr = project(SEALING);
  const ctx = { profile, cpu: pr.cpu, io: pr.io, addresses: pr.addresses };
  const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'low' as const };
  setClaudeInterceptor(async () => { throw new Error('Anthropic API is overloaded'); });
  const failed = await generateRuleBasedProgram({ ai, ctx, spec: SPECS.sealing, hmi: pr.hmi });
  assert.equal(failed.source, 'rules');
  assert.match(failed.notes[0], /could not write the cycle/);
  assert.ok(failed.sequence.steps.length >= 3);
  let prompt = 0;
  const steps = [
    { name: 'Feed film', actions: [{ actuator: 'Unwinder', what: 'run' }], waitFor: [{ input: null, on: true, seconds: 1.5 }], timeoutSec: null },
    { name: 'Head down', actions: [{ actuator: 'Head', what: 'extend' }], waitFor: [{ input: 'X004', on: true, seconds: null }], timeoutSec: 4 },
    { name: 'Sealing', actions: [], waitFor: [{ input: null, on: true, seconds: 2 }], timeoutSec: null },
    { name: 'Head up', actions: [{ actuator: 'Head', what: 'retract' }], waitFor: [{ input: 'X003', on: true, seconds: null }], timeoutSec: 4 },
  ];
  setClaudeInterceptor(async (o) => { prompt = o.system.length + JSON.stringify(o.messages).length + JSON.stringify(o.schema).length; return { reasoning: null, text: JSON.stringify({ explanation: 'Feed, head down, seal 2 s, head up.', steps, questions: ['Seal time?'] }) }; });
  const good = await generateRuleBasedProgram({ ai, ctx, spec: SPECS.sealing, hmi: pr.hmi });
  assert.equal(good.source, 'ai', good.aiError);
  assert.deepEqual(good.sequence.steps.map((x) => x.name), ['Feed film', 'Head down', 'Sealing', 'Head up']);
  assert.ok(good.program.rungs.some((x) => /Step 30 — Sealing/.test(x.comment)));
  assert.deepEqual(validateProgram(good.program, profile, new Set(pr.addresses.values())).filter((i) => i.severity === 'error'), []);
  // The AI's sequence also runs the plant.
  const loop = closedLoop('sealing', good.sequence);
  loop.scan(200); loop.press('cmd:start');
  for (let t = 0; t < 60_000 && loop.cycles() < 2; t += 20) loop.scan(20);
  assert.ok(loop.cycles() >= 2, 'the AI cycle runs in the simulator');
  setClaudeInterceptor(async () => ({ reasoning: null, text: JSON.stringify({ explanation: '', steps: [{ name: 'Bad', actions: [{ actuator: 'Robot', what: 'run' }], waitFor: [], timeoutSec: null }], questions: [] }) }));
  const bad = await generateRuleBasedProgram({ ai, ctx, spec: SPECS.sealing, hmi: pr.hmi });
  setClaudeInterceptor(null);
  assert.equal(bad.source, 'rules');
  assert.match(bad.notes[0], /not used: step 1: no request bit for "Robot run"/);
  console.log(`cycle prompt ${prompt} chars (~${Math.round(prompt / 4)} tokens)`);
}
// Analog outputs are always written (user-journey QA): a drive speed reference in rpm / % / mA from its HMI
// speed setpoint while the drive runs (0 stopped); any other analog output from its own HMI setpoint while
// Safety OK. A machine without a step sequence still writes the HMI's step-timeout alarm.
{
  const ma = (units: string, max: number): IOPoint['analog'] => ({ range: '4-20mA', min: 0, max, units });
  const skid = project([
    pt('Start button', 'input', { deviceType: 'pushbutton-no' }), pt('Stop button', 'input', { deviceType: 'pushbutton-nc' }), pt('Safety OK', 'input', { deviceType: 'safety-relay-output' }),
    pt('Pump 1 VFD fault', 'input', { deviceType: 'vfd-input' }), pt('Pump 2 VFD fault', 'input', { deviceType: 'vfd-input' }),
    pt('Pump 1 VFD run', 'output', { deviceType: 'vfd-input' }), pt('Pump 2 VFD run', 'output', { deviceType: 'vfd-input' }),
    pt('Pump 1 speed reference', 'output', { signal: 'analog', analog: ma('rpm', 1750) }), pt('Pump 2 speed reference', 'output', { signal: 'analog', analog: ma('%', 100) }),
    pt('Bypass valve position', 'output', { signal: 'analog', analog: ma('%', 100) }),
  ], 'C0-10DD1E-D', ['C0-04DA-1']);
  const r = programWithCycle({ content: skid.content, hmiTags: skid.hmi.tags, hmiScreens: skid.hmi.screens, hmiAlarms: skid.hmi.alarms, spec: 'Pump skid: two pumps on VFDs, a bypass valve.' });
  const A = (re: RegExp) => skid.addresses.get(skid.io.find((p) => re.test(p.description))!.id)!;
  const writes = new Set(r.program.rungs.flatMap((g) => rungWrites(g).map((w) => w.toUpperCase())));
  for (const re of [/Pump 1 speed/, /Pump 2 speed/, /Bypass valve/]) assert.ok(writes.has(A(re)), `analog output ${re} written`);
  assert.deepEqual(skid.content.actuators.filter((a) => a.kind === 'drive').map((a) => `${a.name}:${a.speedRef?.address}`), [`Pump 1:${A(/Pump 1 speed/)}`, `Pump 2:${A(/Pump 2 speed/)}`], 'speed references in rpm and % belong to their drives');
  const role = (x: string) => skid.hmi.tags.find((t) => t.role === x)?.address;
  const valveSp = role(`sp:ao:${A(/Bypass valve/)}`);
  assert.ok(valveSp && skid.hmi.screens.some((s) => s.elements.some((e) => e.kind === 'numeric-entry' && e.address === valveSp)), 'valve setpoint on the HMI Setup screen');
  assert.equal(r.sequence.steps.length, 0, 'no step sequence on this machine');
  assert.ok(writes.has(role('alarm:step')!), 'step-timeout alarm written without a step sequence');
  assert.deepEqual(validateProgram(r.program, profile, new Set(skid.addresses.values()), skid.hmi).filter((i) => i.severity === 'error').map((i) => i.message), [], 'checker clean with the HMI');
  // In the simulator: the valve follows its setpoint while Safety OK, 0 % without; the speed reference only while its pump runs.
  const sim = createSimulator(r.program);
  sim.setInput(A(/Safety OK/), true);
  sim.write(valveSp!, 40); sim.step(100);
  assert.equal(sim.readWord(A(/Bypass valve/)), 40, 'valve = setpoint while Safety OK');
  sim.setInput(A(/Safety OK/), false); sim.step(100);
  assert.equal(sim.readWord(A(/Bypass valve/)), 0, 'valve at the bottom of its range without Safety OK');
  assert.equal(sim.readWord(A(/Pump 1 speed/)), 0, 'speed reference 0 while the pump is stopped');
}
void buildProgram;
console.log('program engine tests passed');
