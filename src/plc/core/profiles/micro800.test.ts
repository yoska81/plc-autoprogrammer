/// <reference types="node" />
/**
 * Micro820 / Micro850 profile + Structured Text exporter tests. Run with:  npx tsx src/plc/core/profiles/micro800.test.ts
 * Golden file: src/plc/core/profiles/__fixtures__/micro800_golden.st (UPDATE_GOLDEN=1 rewrites it).
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LadderProgram } from '../ladder';
import type { ExportContext } from '../profile';
import { micro800Profile, micro800IoVar, toMicro800St, micro800VariablesCsv, MICRO800_CPUS } from './micro800';
import { validateProgram } from '../validate';
import type { IOPoint } from '../../../types/io';

const golden = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'micro800_golden.st');

const cpu = MICRO800_CPUS.find((c) => c.id === '2080-L50E-24QBB')!;
assert.equal(cpu.platformId, 'ab-micro850');
assert.equal(MICRO800_CPUS[0].platformId, 'ab-micro820');
const io: IOPoint[] = [
  { id: 'I001', description: 'Start PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I002', description: 'Stop PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I003', description: 'Part sensor', type: 'input', category: 'Product Detection' },
  { id: 'Q001', description: 'Conveyor run', type: 'output', category: 'Conveyor' },
  { id: 'Q002', description: 'Alarm light', type: 'output', category: 'Operator/HMI' },
];
const addr = micro800Profile.autoAddresses(io, cpu, []);
assert.deepEqual(io.map((p) => addr.get(p.id)), ['X001', 'X002', 'X003', 'Y001', 'Y002']);
assert.equal(micro800IoVar('X001'), '_IO_EM_DI_00');
assert.equal(micro800IoVar('Y010'), '_IO_EM_DO_09');
assert.equal(micro800IoVar('X101'), null, 'expansion I/O names are not documented');

const program: LadderProgram = {
  blocks: [{ id: 'b1', name: 'Conveyor', description: '' }],
  tags: [
    { address: 'C1', nickname: 'Run_Latch', comment: '' },
    { address: 'T1', nickname: 'Jam_Timer', comment: '' },
    { address: 'T2', nickname: 'Run_Hours', comment: '' },
    { address: 'CT1', nickname: 'Part_Count', comment: '' },
    { address: 'DS1', nickname: 'Jam_Time_SP', comment: 's' },
  ],
  rungs: [
    { id: 'r1', block: 'b1', comment: 'Seal-in', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'X002' }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', block: 'b1', comment: '', branches: [[{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'T1' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'r3', block: 'b1', comment: 'Jam timer', branches: [[{ type: 'NO', address: 'C1' }, { type: 'NO', address: 'X003' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r4', block: 'b1', comment: '', branches: [[{ type: 'NO', address: 'Y001' }]], outputs: [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '3600', unit: 'sec', accumulate: true, resetAddress: 'X002' }] },
    { id: 'r5', block: 'b1', comment: 'Count parts', branches: [[{ type: 'RISE', address: 'X003' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '100', resetAddress: 'SC2' }] },
    { id: 'r6', comment: '', branches: [[{ type: 'NO', address: 'SC2' }]], outputs: [{ type: 'COPY', source: '10', dest: 'DS1' }] },
    { id: 'r7', comment: '', branches: [[{ type: 'NO', address: 'SC7' }, { type: 'CMP', left: 'CTD1', op: '>=', right: '90' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'r8', comment: '', branches: [[{ type: 'FALL', address: 'C1' }]], outputs: [{ type: 'RST', address: 'CT1' }, { type: 'MATH', dest: 'DS2', expression: 'TD1 + 1' }] },
  ],
};
assert.deepEqual(validateProgram(program, micro800Profile, new Set(addr.values())).filter((i) => i.severity === 'error'), []);
const labels = new Map<string, string>(io.map((p) => [addr.get(p.id)!, p.description]));
const ctx: ExportContext = { io, addresses: addr, labels, header: 'Test cell — Micro850 2080-L50E-24QBB', extraTags: [], cpuId: cpu.id, modules: [], projectName: 'Test cell' };
const st = toMicro800St(program, ctx);
const has = (s: string) => assert.ok(st.body.includes(s), `missing: ${s}\n${st.body}`);
has('Start_PB := _IO_EM_DI_00;');
has('_IO_EM_DO_00 := Conveyor_run;');
has('Run_Latch := (Start_PB AND NOT Stop_PB) OR (Run_Latch AND NOT Stop_PB);');
has('Conveyor_run := Run_Latch AND NOT Jam_Timer.Q;');
has('Jam_Timer(IN := Run_Latch AND Part_sensor, PT := ANY_TO_TIME(Jam_Time_SP * 1000));');
has('Run_Hours(IN := Conveyor_run, RST := Stop_PB, PT := ANY_TO_TIME(3600000));');
has('RT_1(CLK := Part_sensor);');
has('Part_Count(CU := RT_1.Q, RESET := _SYSVA_FIRST_SCAN OR CT1_RST, PV := 100);');
has('CT1_RST := FALSE;');
has('IF _SYSVA_FIRST_SCAN THEN Jam_Time_SP := 10; END_IF;');
has('Alarm_light := Clock_1s AND (Part_Count.CV >= 90);');
has('IF FT_2.Q THEN CT1_RST := TRUE; END_IF;');
has('IF FT_2.Q THEN DS2 := (ANY_TO_DINT(Jam_Timer.ET) / 1000) + 1; END_IF;');
has('CLOCK_TMR(IN := NOT CLOCK_TMR.Q, PT := T#1s);');
assert.deepEqual(st.warnings, []);
const type = (n: string) => st.variables.find((x) => x.name === n)?.type;
assert.deepEqual(['Jam_Timer', 'Run_Hours', 'Part_Count', 'RT_1', 'FT_2', 'Jam_Time_SP', 'Run_Latch'].map(type), ['TON', 'RTO', 'CTU', 'R_TRIG', 'F_TRIG', 'DINT', 'BOOL']);
if (process.env.UPDATE_GOLDEN) { mkdirSync(dirname(golden), { recursive: true }); writeFileSync(golden, st.body); }
assert.equal(st.body, readFileSync(golden, 'utf8').replace(/\r\n/g, '\n'), 'ST differs from the golden file (UPDATE_GOLDEN=1 to accept)');
const csv = micro800VariablesCsv(program, ctx);
assert.ok(csv.startsWith('Name,Data Type,Comment,Micro800 I/O variable\r\n'));
assert.ok(csv.includes('"Start_PB","BOOL","Start PB","_IO_EM_DI_00"'));

// expansion point: a TODO, not an invented variable name
const exp = toMicro800St({ tags: [], rungs: [{ id: 'x', comment: '', branches: [[{ type: 'NO', address: 'X101' }]], outputs: [{ type: 'OUT', address: 'C1' }] }] }, { ...ctx, labels: new Map([['X101', 'Guard closed']]) });
assert.match(exp.body, /\(\* TODO map X101 \(expansion slot 1, point 00\) in CCW: Guard_closed := <expansion input>; \*\)/);
console.log('micro800 tests passed');
