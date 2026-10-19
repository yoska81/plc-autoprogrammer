/// <reference types="node" />
/**
 * Siemens S7-1200 / S7-1500 profile + SCL / tag table exporter tests. Run with:  npx tsx src/plc/core/profiles/siemens.test.ts
 * Golden file: src/plc/core/profiles/__fixtures__/siemens_golden.scl (UPDATE_GOLDEN=1 rewrites it).
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LadderProgram } from '../ladder';
import type { ExportContext, ModuleSlot } from '../profile';
import { siemensProfile, siemensAddress, siemensAnalogChannels, buildScl, siemensTagsSdf, SIEMENS_CPUS } from './siemens';
import { validateProgram } from '../validate';
import type { IOPoint } from '../../../types/io';

const golden = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'siemens_golden.scl');
const cpu = SIEMENS_CPUS.find((c) => c.id === '6ES7214-1AG40-0XB0')!;
assert.equal(cpu.platformId, 'siemens-s7-1200');
const modules: ModuleSlot[] = [{ partNumber: '6ES7221-1BH32-0XB0', inputs: 16, outputs: 0 }, { partNumber: '6ES7232-4HB32-0XB0', inputs: 0, outputs: 0, analogOutputs: 2 }];

// onboard addresses are verified, module / analog defaults are marked inferred
assert.deepEqual(siemensAddress('X001', cpu, modules), { address: '%I0.0', inferred: false });
assert.deepEqual(siemensAddress('X014', cpu, modules), { address: '%I1.5', inferred: false });
assert.deepEqual(siemensAddress('Y010', cpu, modules), { address: '%Q1.1', inferred: false });
assert.deepEqual(siemensAddress('X101', cpu, modules), { address: '%I8.0', inferred: true });
const ch = siemensAnalogChannels(cpu, modules);
assert.deepEqual(ch.map((c) => `${c.address}:${c.kind}:${c.slot}`), ['DF1:input:0', 'DF2:input:0', 'DF3:output:2', 'DF4:output:2'], '1214C has 2 onboard AI (catalog), SM 1232 2 AQ');
assert.equal(siemensAddress('DF1', cpu, modules)?.address, '%IW64');
assert.equal(siemensAddress('DF3', cpu, modules)?.address, '%QW112');
const s1500 = SIEMENS_CPUS.find((c) => c.platformId === 'siemens-s7-1500')!;
const et: ModuleSlot[] = [{ partNumber: '6ES7131-6BH01-0BA0', inputs: 16, outputs: 0 }, { partNumber: '6ES7131-6BH01-0BA0', inputs: 16, outputs: 0 }];
assert.equal(siemensAddress('X201', s1500, et)?.address, '%I2.0', 'ET 200SP packed from byte 0');

const io: IOPoint[] = [
  { id: 'I001', description: 'Start PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I002', description: 'Stop PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I003', description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '0-10V', min: 0, max: 100, units: '%' } },
  { id: 'Q001', description: 'Pump run', type: 'output', category: 'Conveyor' },
  { id: 'Q002', description: 'Valve position', type: 'output', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } },
];
const addr = siemensProfile.autoAddresses(io, cpu, modules);
assert.deepEqual(io.map((p) => addr.get(p.id)), ['X001', 'X002', 'DF1', 'Y001', 'DF3']);

const program: LadderProgram = {
  tags: [{ address: 'C1', nickname: 'Run', comment: '' }, { address: 'T1', nickname: 'Fill_Timer', comment: '' }, { address: 'CT1', nickname: 'Cycles', comment: '' }, { address: 'DF101', nickname: 'Level_SP', comment: '%' }],
  rungs: [
    { id: 'r1', comment: 'Run seal-in', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'X002' }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', comment: '', branches: [[{ type: 'NO', address: 'C1' }, { type: 'CMP', left: 'DF1', op: '<', right: 'DF101' }]], outputs: [{ type: 'OUT', address: 'Y001' }, { type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '30', unit: 'sec', accumulate: true, resetAddress: 'X002' }] },
    { id: 'r3', comment: '', branches: [[{ type: 'RISE', address: 'Y001' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '1000', resetAddress: null }] },
    { id: 'r4', comment: 'Defaults', branches: [[{ type: 'NO', address: 'SC2' }]], outputs: [{ type: 'COPY', source: '80.0', dest: 'DF101' }] },
    { id: 'r5', comment: '', branches: [], outputs: [{ type: 'MATH', dest: 'DF3', expression: 'DF101 * 0.5' }] },
  ],
};
assert.deepEqual(validateProgram(program, siemensProfile, new Set(addr.values())).filter((i) => i.severity === 'error'), []);
const labels = new Map<string, string>(io.map((p) => [addr.get(p.id)!, p.description]));
const ctx: ExportContext = { io, addresses: addr, labels, header: 'Test skid — S7-1200 CPU 1214C', extraTags: [], cpuId: cpu.id, modules, projectName: 'Test skid' };
const { scl, tags, st } = buildScl(program, ctx);
assert.ok(scl.startsWith('﻿FUNCTION_BLOCK "Machine"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\n'), 'UTF-8 BOM, optimized FB');
const has = (s: string) => assert.ok(scl.includes(s), `missing: ${s}\n${scl}`);
has('#FirstScan := NOT #Initialized;');
has('#Start_PB := "Start_PB";');
has('#Tank_level := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Tank_level_raw", MAX := 27648), MAX := 100.0);');
has('#Run := (#Start_PB AND NOT #Stop_PB) OR (#Run AND NOT #Stop_PB);');
has('#Pump_run := #Run AND (#Tank_level < #Level_SP);');
has('#Fill_Timer(IN := #Run AND (#Tank_level < #Level_SP), R := #Stop_PB, PT := T#30000ms);');
has('#RT_1(CLK := #Pump_run);');
has('#Cycles(CU := #RT_1.Q, R := FALSE, PV := 1000);');
has('IF #FirstScan THEN #Level_SP := 80.0; END_IF;');
has('#Valve_position := #Level_SP * 0.5;');
has('"Pump_run" := #Pump_run;');
has('"Valve_position_raw" := REAL_TO_INT(SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0.0, VALUE := #Valve_position, MAX := 100.0), MAX := 27648.0));');
has('      Fill_Timer : TONR_TIME;');
has('      Cycles : CTU_DINT;');
has('      RT_1 : R_TRIG;');
has('DATA_BLOCK "Machine_DB"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\n"Machine"');
// Setpoints, counters (and run hours) are RETAIN statics: they survive a power cycle like CLICK's retentive memory.
has('   VAR RETAIN\n');
assert.ok(!scl.includes('NON_RETAIN'), 'the instance DB keeps the FB\'s retentivity');
has('ORGANIZATION_BLOCK "Main"\nTITLE = "Main Program Sweep (Cycle)"\n{ S7_Optimized_Access := \'TRUE\' }');
assert.deepEqual(st.warnings, []);
assert.deepEqual(tags.map((t) => `${t.name}=${t.address}:${t.type}${t.inferred ? '?' : ''}`), ['Start_PB=%I0.0:Bool', 'Stop_PB=%I0.1:Bool', 'Pump_run=%Q0.0:Bool', 'Tank_level_raw=%IW64:Int?', 'Valve_position_raw=%QW112:Int?']);
if (process.env.UPDATE_GOLDEN) { mkdirSync(dirname(golden), { recursive: true }); writeFileSync(golden, scl); }
assert.equal(scl, readFileSync(golden, 'utf8').replace(/\r\n/g, '\n'), 'SCL differs from the golden file (UPDATE_GOLDEN=1 to accept)');

const sdf = siemensTagsSdf(program, ctx);
assert.ok(sdf.startsWith('"Start_PB","%I0.0","Bool","True","True","False","Start PB","","True"\r\n'), sdf);
assert.ok(sdf.includes('"Tank_level_raw","%IW64","Int","True","True","False","Tank level (0-10V, raw 0…27648 = 0…100 %) — check against Device configuration","","True"'));

const bad: LadderProgram = { tags: [], rungs: [{ id: 'x', comment: '', branches: [[{ type: 'NO', address: 'SC19' }]], outputs: [{ type: 'OUT', address: 'C1' }] }] };
assert.match(validateProgram(bad, siemensProfile, new Set()).map((i) => i.message).join(' | '), /SC19: S7 has no equivalent/);
// Every tag name in the .sdf is unique: a used analog "Tank level" and an unused one with the same description.
{
  const twin: IOPoint = { id: 'I009', description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '0-10V', min: 0, max: 100, units: '%' } };
  const io2 = [...io, twin];
  const addr2 = siemensProfile.autoAddresses(io2, cpu, modules);
  const sdf = siemensTagsSdf(program, { ...ctx, io: io2, addresses: addr2, labels: new Map([...labels, [addr2.get('I009')!, twin.description]]) });
  const names = sdf.trim().split(/\r?\n/).map((l) => JSON.parse(`[${l}]`)[0] as string);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, `unique tag names: ${names.join(', ')}`);
  assert.ok(names.includes('Tank_level_raw') && names.some((n) => /^Tank_level_raw_\d$/.test(n)), names.join(', '));
}

// Comments in the program's own names: an HMI description quoting the app's operands is written with the SCL names.
{
  const withHmi = { ...ctx, extraTags: [{ address: 'C1001', nickname: 'HMI_Start', comment: 'Momentary Start: runs when Start PB (X001) is ON and Run (C1) is off; Fill_Timer TD1 below DF101; Cycles CTD1' }] };
  const out = buildScl(program, withHmi).scl;
  const decl = out.split('\n').find((l) => /^\s+HMI_Start : Bool;/.test(l)) ?? '';
  assert.match(decl, /Start PB \("Start_PB"\)/, decl);
  assert.match(decl, /Run \(#Run\) is off/);
  assert.match(decl, /#Fill_Timer\.ET below #Level_SP/);
  assert.match(decl, /#Cycles\.CV/);
  assert.ok(!/\b(X001|C1|TD1|DF101|CTD1)\b/.test(decl.split('//')[1] ?? ''), `no app operand left: ${decl}`);
}
// The user's own descriptions keep their words: "(cylinder C1, tank T1)" is not the program's C1 / T1.
{
  const own = { ...ctx, io: ctx.io.map((x, i) => (i === 0 ? { ...x, description: 'Pusher extended (cylinder C1, tank T1)' } : x)) };
  const desc = own.io[0];
  const out = buildScl(program, { ...own, extraTags: [{ address: 'C1001', nickname: 'HMI_Push', comment: `HMI: shows ${addr.get(desc.id)} (Pusher extended (cylinder C1, tank T1)) and Run (C1)` }] }).scl;
  assert.ok(out.includes('Pusher extended (cylinder C1, tank T1)'), 'the description as written');
  const decl = out.split('\n').find((l) => /^\s+HMI_Push : Bool;/.test(l)) ?? '';
  assert.match(decl, /\(Pusher extended \(cylinder C1, tank T1\)\) and Run \(#Run\)/, decl);
  assert.ok(!decl.includes(`shows ${addr.get(desc.id)} `), `the app's operand is renamed: ${decl}`);
}

// The example project on an S7-1214C: no app operand anywhere in the .scl outside the user's own I/O descriptions
// (the generator's tag and rung comments name the symbols too).
{
  const { seedSampleProject } = await import('../../../preview/sampleProject');
  const { applyEquipment } = await import('../../../spec/equipment');
  const { collectProject } = await import('../../../deliverables/collect');
  const { exportContext } = await import('../../../deliverables/exportContext');
  const warn = console.warn;
  console.warn = () => {};
  seedSampleProject();
  applyEquipment({ cpuId: '6ES7214-1AG40-0XB0', modules: [], hmiPartNumber: '6AV2123-2GB03-0AX0' }, null);
  const p = collectProject();
  console.warn = warn;
  let text = buildScl(p.ladder, exportContext(p)).scl;
  for (const x of [...p.io].sort((a, b) => b.description.length - a.description.length)) text = text.split(x.description).join('');
  const left = [...new Set(text.match(/\b(?:CTD|TD|CT|DS|DD|DH|DF|SC|SD|TXT|C|T|X|Y)\d+\b/g) ?? [])];
  assert.deepEqual(left, [], 'no app operand in the example\'s SCL outside the I/O descriptions');
}

// S7-1500 + ET 200SP: no on-board I/O. The real input X101 is %I0.0; a stale contact X001 in the program gets no
// hardware address (no second tag at %I0.0), it stays a static of the block, said in its comment.
{
  const c1500 = SIEMENS_CPUS.find((c) => c.id === '6ES7511-1AL03-0AB0')!;
  const et: ModuleSlot[] = [{ partNumber: '6ES7131-6BH01-0BA0', inputs: 16, outputs: 0 }, { partNumber: '6ES7132-6BH01-0BA0', inputs: 0, outputs: 16 }];
  assert.equal(siemensAddress('X001', c1500, et), null, 'no on-board terminal on an S7-1500');
  assert.equal(siemensAddress('X101', c1500, et)?.address, '%I0.0');
  const pts = [{ id: 'a', description: 'Start button', type: 'input', category: 'Operator/HMI' }, { id: 'b', description: 'Motor run', type: 'output', category: 'Motor' }] as IOPoint[];
  const adr = new Map([['a', 'X101'], ['b', 'Y101']]);
  const prog: LadderProgram = { tags: [], rungs: [{ id: 'r1', comment: '', branches: [[{ type: 'NO', address: 'X101' }, { type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y101' }] }] };
  const out = buildScl(prog, { io: pts, addresses: adr, labels: new Map([['X101', 'Start button'], ['Y101', 'Motor run']]), header: 'h', extraTags: [], cpuId: c1500.id, modules: et, projectName: 'p' });
  const at00 = out.tags.filter((t) => t.address === '%I0.0');
  assert.deepEqual(at00.map((t) => t.name), ['Start_button'], 'one tag at %I0.0');
  assert.ok(!out.tags.some((t) => /X001/.test(t.name)), out.tags.map((t) => `${t.name}@${t.address}`).join(', '));
  assert.match(out.scl, /: Bool;\s+\/\/ .*\(no I\/O point: not wired\)/, 'the stale contact is a static, said');
  assert.match(out.scl, /no I\/O point on this CPU/);
}

// A typed name for an unnamed register never takes the name of the user's own tag, whichever comes first in the
// program: C1 (no name) is met before C5 ("Flag_1"); the user's keeps Flag_1, the typed one becomes Flag_1_2.
{
  const prog: LadderProgram = { tags: [{ address: 'C5', nickname: 'Flag_1', comment: 'my flag' }], rungs: [{ id: 'r1', comment: '', branches: [[{ type: 'NO', address: 'C1' }, { type: 'NO', address: 'C5' }]], outputs: [{ type: 'OUT', address: 'C2' }] }] };
  const out = buildScl(prog, { ...ctx, extraTags: [] }).scl;
  assert.match(out, /^\s+Flag_1 : Bool;\s+\/\/ .*my flag/m, out.split('\n').filter((l) => /Flag_/.test(l)).join('\n'));
  assert.match(out, /^\s+Flag_1_2 : Bool;\s+\/\/ no name in the project/m);
}

console.log('siemens tests passed');
