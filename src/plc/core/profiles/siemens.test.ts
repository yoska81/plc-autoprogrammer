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
has('DATA_BLOCK "Machine_DB"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n"Machine"');
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
console.log('siemens tests passed');
