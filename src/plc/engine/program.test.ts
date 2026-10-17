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
import { buildHmi, defaultHmiContent } from '../../hmi/engine';
import { generateRuleBasedProgram, mergeCycle } from '../ai/cycleAI';
import { setClaudeInterceptor } from '../../lib/ai/anthropic';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { validateProgram } from '../core/validate';
import { rungAddresses, rungWrites, type LadderProgram } from '../core/ladder';
import { createSimulator } from '../sim/engine';
import type { IOPoint } from '../../types/io';
import type { HmiDesign } from '../../hmi/types';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
type P = Pick<IOPoint, 'description' | 'type'> & Partial<IOPoint>;
const pt = (description: string, type: 'input' | 'output', extra: Partial<IOPoint> = {}): P => ({ description, type, ...extra });
const profile = getProfile('click');

function project(points: P[], cpuId = 'C0-10DD1E-D', modules: string[] = []) {
  const io = points.map((p, i) => ({ category: 'Operator/HMI', ...p, id: `p${i}` })) as IOPoint[];
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

for (const [name, points, cpu, modules] of [['example', EXAMPLE, 'C0-10DD1E-D', []], ['big', BIG, 'C0-11DD1E-D', ['C0-16ND3', 'C0-08TD1', 'C0-04AD-1', 'C0-04DA-1']], ['sealing', SEALING, 'C0-10DD1E-D', []]] as const) {
  const pr = project([...points], cpu, [...modules]);
  const t0 = performance.now();
  const r = buildProgram({ content: pr.content, hmiTags: pr.hmi.tags });
  assert.ok(performance.now() - t0 < 200, 'built in milliseconds');
  const ioSet = new Set([...pr.addresses.values()]);
  const issues = validateProgram(r.program, profile, ioSet);
  assert.deepEqual(issues.map((i) => `${i.severity}: ${i.message}`), [], `${name}: checker issues`);
  assert.deepEqual(reviewProblems(r.program, pr.io, pr.addresses, pr.hmi), [], `${name}: design review problems`);
  assert.equal(new Set(r.program.rungs.map((x) => x.id)).size, r.program.rungs.length, 'unique rung ids');
  golden(name, r.program, r.notes);
}

// The example runs: Start -> conveyor runs (default cycle); E-stop -> everything off, safety alarm; Manual jog with the permit.
{
  const pr = project(EXAMPLE);
  const { program } = buildProgram({ content: pr.content, hmiTags: pr.hmi.tags });
  const tag = (role: string) => pr.hmi.tags.find((t) => t.role === role)!.address;
  const sim = createSimulator(program);
  sim.setInput('X001', true); sim.setInput('X003', true); sim.setInput('X006', true); // safety OK, stop PB (NC) closed, pusher retracted
  sim.run(200);
  assert.equal(sim.readBit('Y003'), true, 'air dump valve follows Safety OK');
  sim.write(tag('cmd:start'), true); sim.run(100); sim.write(tag('cmd:start'), false); sim.run(100);
  assert.equal(sim.readBit('Y001'), true, 'conveyor runs after HMI Start');
  assert.equal(sim.readWord(tag('word:state')), 1, 'state Running');
  sim.setInput('X001', false); sim.run(100);
  assert.equal(sim.readBit('Y001'), false, 'safety loss stops the conveyor');
  assert.equal(sim.readBit(tag('alarm:safety')), true, 'safety open alarm');
  assert.equal(sim.readWord(tag('word:state')), 4, 'state Safety Stop');
  sim.setInput('X001', true); sim.run(100);
  assert.equal(sim.readBit('Y001'), false, 'no restart by itself');
  sim.write(tag('cmd:manual'), true); sim.run(100);
  assert.equal(sim.readBit(tag('sts:manual')), true, 'Manual mode');
  sim.write(tag('jog:Y002'), true); sim.run(100);
  assert.equal(sim.readBit('Y002'), true, 'hold-to-run extend while permitted');
  sim.write(tag('jog:Y002'), false); sim.run(100);
  assert.equal(sim.readBit('Y002'), false, 'stops on release');
  // Extended feedback never comes -> timeout alarm after the 3 s default setpoint.
  sim.write(tag('jog:Y002'), true); sim.setInput('X006', false); sim.run(3500);
  assert.equal(sim.readBit(tag('alarm:timeout:Y002')), true, 'pusher timeout alarm');
}

// The AI cycle block: accepted when it keeps to its bits; rejected (rules kept) when it writes an output.
{
  const pr = project(SEALING);
  const base = buildProgram({ content: pr.content, hmiTags: pr.hmi.tags });
  const head = base.autoBits.find((b) => b.what === 'extend')!;
  const good = mergeCycle(base, { rungs: [{ id: 'x', comment: 'Step 10: head down', branches: [[{ type: 'NO', address: 'C2' }, { type: 'CMP', left: 'DS1150', op: '==', right: '10' }]], outputs: [{ type: 'OUT', address: head.bit }] }], tags: [] }, undefined, () => []);
  assert.deepEqual(good.problems, []);
  assert.ok(good.program.rungs.some((r) => r.id === 'r_cycle_1' && r.block === 'cycle'));
  const bad = mergeCycle(base, { rungs: [{ id: 'x', comment: 'bad', branches: [[]], outputs: [{ type: 'OUT', address: 'Y002' }] }], tags: [] }, undefined, () => []);
  assert.match(bad.problems[0], /writes Y002/);
  assert.equal(bad.program, base.program);
}

// Pipeline: AI fails -> rules program with a note; recorded cycle -> used.
{
  const pr = project(SEALING);
  const ctx = { profile, cpu: pr.cpu, io: pr.io, addresses: pr.addresses };
  const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'low' as const };
  setClaudeInterceptor(async () => { throw new Error('Anthropic API is overloaded'); });
  const failed = await generateRuleBasedProgram({ ai, ctx, spec: 'Sealing head', hmi: pr.hmi });
  assert.equal(failed.source, 'rules');
  assert.match(failed.notes[0], /could not write the cycle/);
  let prompt = 0;
  setClaudeInterceptor(async (o) => {
    prompt = o.system.length + JSON.stringify(o.messages).length + JSON.stringify(o.schema).length;
    const down = failed.program.tags.find((t) => /Auto_Head_extend/.test(t.nickname))!.address;
    const up = failed.program.tags.find((t) => /Auto_Head_retract/.test(t.nickname))!.address;
    const unw = failed.program.tags.find((t) => /Auto_Unwinder_run/.test(t.nickname))!.address;
    return { reasoning: null, text: JSON.stringify({ explanation: 'Head down, dwell 2 s, head up; the unwinder runs while the head is up.', tags: [{ address: 'T25', nickname: 'Tmr_Dwell', comment: 'Seal dwell' }], rungs: [
      { id: 'a', block: 'cycle', comment: 'Step 0 when not running', branches: [[{ type: 'NC', address: 'C2' }]], outputs: [{ type: 'COPY', source: '0', dest: 'DS1150' }] },
      { id: 'b', block: 'cycle', comment: 'Step 10: head down until down', branches: [[{ type: 'NO', address: 'C2' }, { type: 'CMP', left: 'DS1150', op: '==', right: '10' }]], outputs: [{ type: 'OUT', address: down }] },
      { id: 'c', block: 'cycle', comment: 'Step 20: dwell', branches: [[{ type: 'CMP', left: 'DS1150', op: '==', right: '20' }]], outputs: [{ type: 'TMR', address: 'T25', mode: 'ON_DELAY', preset: '2', unit: 'sec', accumulate: false, resetAddress: null }] },
      { id: 'd', block: 'cycle', comment: 'Step 30: head up', branches: [[{ type: 'CMP', left: 'DS1150', op: '==', right: '30' }]], outputs: [{ type: 'OUT', address: up }] },
      { id: 'e', block: 'cycle', comment: 'Unwinder runs while the head is up and the cycle runs', branches: [[{ type: 'NO', address: 'C2' }, { type: 'NO', address: 'X003' }]], outputs: [{ type: 'OUT', address: unw }] },
    ] }) };
  });
  const good = await generateRuleBasedProgram({ ai, ctx, spec: 'Sealing head', hmi: pr.hmi });
  setClaudeInterceptor(null);
  assert.equal(good.source, 'ai', good.aiError);
  assert.ok(good.program.rungs.some((r) => /Step 20: dwell/.test(r.comment)));
  assert.ok(!good.program.rungs.some((r) => /not written yet/.test(r.comment)));
  assert.deepEqual(validateProgram(good.program, profile, new Set(pr.addresses.values())).filter((i) => i.severity === 'error'), []);
  console.log(`cycle prompt ${prompt} chars (~${Math.round(prompt / 4)} tokens)`);
}
console.log('program engine tests passed');
