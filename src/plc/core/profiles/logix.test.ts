/// <reference types="node" />
/**
 * Allen-Bradley Logix profile + L5X exporter tests. Run with:  npx tsx src/plc/core/profiles/logix.test.ts
 * Golden file: src/plc/core/profiles/__fixtures__/logix_golden.L5X (UPDATE_GOLDEN=1 rewrites it).
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LadderProgram, Rung } from '../ladder';
import type { ExportContext, ModuleSlot } from '../profile';
import { logixProfile, logixIoTag, logixAnalogChannels, LOGIX_CPUS } from './logix';
import { toLogix, logixName } from './logixExport';
import { buildL5x, logixIoMapping, l5xDate } from './l5x';
import { validateProgram } from '../validate';
import type { IOPoint } from '../../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const golden = join(here, '__fixtures__', 'logix_golden.L5X');

const modules: ModuleSlot[] = [
  { partNumber: '5069-IB16', inputs: 16, outputs: 0 },
  { partNumber: '5069-OB16', inputs: 0, outputs: 16 },
  { partNumber: '5069-IF8', inputs: 0, outputs: 0, analogInputs: 8 },
];

// --- profile: addressing and module tags
const io: IOPoint[] = [
  { id: 'I001', description: 'Start PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I002', description: 'Stop PB', type: 'input', category: 'Operator/HMI' },
  { id: 'I003', description: 'Part sensor', type: 'input', category: 'Product Detection' },
  { id: 'I004', description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } },
  { id: 'Q001', description: 'Conveyor run', type: 'output', category: 'Conveyor' },
  { id: 'Q002', description: 'Alarm light', type: 'output', category: 'Operator/HMI' },
];
const cpu = LOGIX_CPUS[1];
const addr = logixProfile.autoAddresses(io, cpu, modules);
assert.deepEqual(io.map((p) => addr.get(p.id)), ['X101', 'X102', 'X103', 'DF1', 'Y201', 'Y202'], 'no built-in I/O: slot 1 inputs, slot 2 outputs, analog DF');
assert.equal(logixIoTag('X101', modules), 'Local:1:I.Pt00.Data');
assert.equal(logixIoTag('Y216', modules), 'Local:2:O.Pt15.Data');
assert.equal(logixIoTag('DF1', modules), 'Local:3:I.Ch00.Data');
assert.equal(logixIoTag('C1', modules), null);
assert.equal(logixAnalogChannels(cpu, modules).length, 8);
assert.equal(logixProfile.dataTypeOf!('DS1'), 'DINT', 'Logix integers are DINT');
assert.equal(logixProfile.autoChoose, false, 'not picked by the equipment AI on its own');

// --- tag names
const used = new Set<string>();
assert.equal(logixName('Start PB (green)', used, 'X'), 'Start_PB_green');
assert.equal(logixName('Start PB (green)', used, 'X'), 'Start_PB_green_2');
assert.equal(logixName('3-way valve', used, 'X'), 'T_3_way_valve');
assert.ok(logixName('x'.repeat(60), used, 'X').length <= 40);

// --- program with every instruction kind
const program: LadderProgram = {
  blocks: [{ id: 'b1', name: 'Conveyor', description: '' }, { id: 'b2', name: 'Alarms & counts', description: '' }],
  tags: [
    { address: 'C1', nickname: 'Run_Latch', comment: 'Conveyor running' },
    { address: 'T1', nickname: 'Jam_Timer', comment: 'Part stuck' },
    { address: 'T2', nickname: 'Run_Hours_Tmr', comment: '' },
    { address: 'CT1', nickname: 'Part_Count', comment: '' },
    { address: 'DS1', nickname: 'Jam_Time_SP', comment: 'seconds' },
    { address: 'DS2', nickname: 'Batch_Target', comment: '' },
    { address: 'DF101', nickname: 'Level_High_SP', comment: '%' },
    { address: 'C2', nickname: 'Level_High', comment: '' },
  ],
  rungs: [
    { id: 'r1', block: 'b1', comment: 'Start / stop seal-in', branches: [[{ type: 'NO', address: 'X101' }, { type: 'NC', address: 'X102' }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'X102' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', block: 'b1', comment: '', branches: [[{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'T1' }]], outputs: [{ type: 'OUT', address: 'Y201' }] },
    { id: 'r3', block: 'b1', comment: 'Jam timer, setpoint in seconds from the HMI', branches: [[{ type: 'NO', address: 'C1' }, { type: 'NO', address: 'X103' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r4', block: 'b1', comment: 'Run hours (retentive)', branches: [[{ type: 'NO', address: 'Y201' }]], outputs: [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '3600', unit: 'sec', accumulate: true, resetAddress: 'X102' }] },
    { id: 'r5', block: 'b2', comment: 'Count parts', branches: [[{ type: 'RISE', address: 'X103' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: 'DS2', resetAddress: 'SC2' }] },
    { id: 'r6', block: 'b2', comment: '', branches: [[{ type: 'CMP', left: 'DF1', op: '>=', right: 'DF101' }]], outputs: [{ type: 'OUT', address: 'C2' }] },
    { id: 'r7', block: 'b2', comment: 'Defaults on the first scan', branches: [[{ type: 'NO', address: 'SC2' }]], outputs: [{ type: 'COPY', source: '10', dest: 'DS1' }, { type: 'COPY', source: '90.0', dest: 'DF101' }] },
    { id: 'r8', block: 'b2', comment: 'Alarm light flashes', branches: [[{ type: 'NO', address: 'C2' }, { type: 'NO', address: 'SC7' }], [{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'OUT', address: 'Y202' }] },
    { id: 'r9', block: 'b2', comment: '', branches: [[{ type: 'NO', address: 'SC1' }]], outputs: [{ type: 'MATH', dest: 'DS3', expression: 'TD1 + CTD1 * 2' }] },
    { id: 'r10', block: 'b2', comment: 'Reset count', branches: [[{ type: 'FALL', address: 'C1' }]], outputs: [{ type: 'RST', address: 'CT1' }, { type: 'SET', address: 'C3' }] },
  ],
};
assert.deepEqual(validateProgram(program, logixProfile, new Set(addr.values())).filter((i) => i.severity === 'error'), [], 'valid on the Logix profile');

const labels = new Map<string, string>(io.map((p) => [addr.get(p.id)!, p.description]));
const ctx: ExportContext = { io, addresses: addr, labels, header: 'Test cell — CompactLogix 5380 5069-L310ER', extraTags: [], cpuId: cpu.id, modules, projectName: 'Test cell', now: new Date(Date.UTC(2026, 9, 16, 12, 0, 0)) };
const lx = toLogix(program, ctx, logixIoTag);
// Every wired I/O point is a controller tag (an alias of its terminal), used by the program or not.
{
  const unused = { id: 'I099', description: 'Spare door switch', type: 'input', category: 'Station 1' } as IOPoint;
  const addr2 = new Map(addr);
  addr2.set('I099', 'X116');
  const t = toLogix(program, { ...ctx, io: [...io, unused], addresses: addr2, labels: new Map([...labels, ['X116', unused.description]]) }, logixIoTag).tags;
  const tag = t.find((x) => x.name === 'Spare_door_switch');
  assert.ok(tag && tag.aliasFor && /:I\./.test(tag.aliasFor), `unused input is an alias tag (${JSON.stringify(tag)})`);
  for (const p of io) assert.ok(t.some((x) => x.base === addr.get(p.id)?.toUpperCase()), `${p.id} has a tag`);
}
// A point on a slot with no module is a plain tag (Studio 5000 refuses an alias to a module that is not configured).
{
  const t = toLogix(program, { ...ctx, modules: [] }, logixIoTag).tags;
  const onEmpty = t.filter((x) => /^[XY][1-9]\d\d$/.test(x.base ?? ''));
  assert.ok(onEmpty.length > 0 && onEmpty.every((x) => !x.aliasFor), onEmpty.map((x) => `${x.base}→${x.aliasFor}`).join(', '));
}
const all = lx.routines.flatMap((r) => r.rungs.map((g) => g.text));
const has = (t: string) => assert.ok(all.includes(t), `missing rung ${t}\n${all.join('\n')}`);
has('[XIC(Start_PB),XIC(Run_Latch)]XIO(Stop_PB)OTE(Run_Latch);'); // shared conditions behind the branch
has('XIC(Run_Latch)XIO(Jam_Timer.DN)OTE(Conveyor_run);');
has('CPT(Jam_Timer.PRE,Jam_Time_SP*1000);');
has('XIC(Run_Latch)XIC(Part_sensor)TON(Jam_Timer,0,0);');
has('XIC(Conveyor_run)RTO(Run_Hours_Tmr,3600000,0);');
has('XIC(Stop_PB)RES(Run_Hours_Tmr);');
has('MOV(Batch_Target,Part_Count.PRE);');
has('XIC(Part_sensor)ONS(ONS_1)CTU(Part_Count,0,0);');
has('XIC(S:FS)RES(Part_Count);');
has('GEQ(Tank_level,Level_High_SP)OTE(Level_High);');
has('XIC(S:FS)[MOV(10,Jam_Time_SP),MOV(90.0,Level_High_SP)];');
has('[XIC(Level_High)XIC(Clock_1s),XIC(Jam_Timer.DN)]OTE(Alarm_light);');
has('CPT(DS3,(Jam_Timer.ACC/1000) + Part_Count.ACC * 2);');
has('XIO(Run_Latch)ONS(ONS_2)[RES(Part_Count),OTL(C3)];');
const main = lx.routines[0];
assert.equal(main.name, 'MainRoutine');
assert.deepEqual(main.rungs.map((r) => r.text), ['XIO(Clock_1s_Tmr.DN)TON(Clock_1s_Tmr,1000,0);', 'LES(Clock_1s_Tmr.ACC,500)OTE(Clock_1s);', 'JSR(Conveyor,0);', 'JSR(Alarms_counts,0);']);
const tag = (n: string) => lx.tags.find((t) => t.name === n);
assert.deepEqual([tag('Start_PB')?.dataType, tag('Start_PB')?.aliasFor], ['BOOL', 'Local:1:I.Pt00.Data']);
assert.deepEqual([tag('Tank_level')?.dataType, tag('Tank_level')?.aliasFor], ['REAL', 'Local:3:I.Ch00.Data']);
assert.equal(tag('Jam_Timer')?.dataType, 'TIMER');
assert.equal(tag('Part_Count')?.dataType, 'COUNTER');
assert.equal(tag('Jam_Time_SP')?.dataType, 'DINT');
assert.equal(tag('Level_High_SP')?.dataType, 'REAL');
assert.deepEqual(lx.warnings, []);

// --- L5X file: well-formed, structure per 1756-RM014D, golden
assert.equal(l5xDate(ctx.now!), 'Fri Oct 16 12:00:00 2026');
const xml = buildL5x(program, ctx);
function balanced(s: string) {
  const stack: string[] = [];
  const body = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?xml[^>]*\?>/, '');
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], `unbalanced </${m[2]}>`);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, [], 'all elements closed');
}
balanced(xml);
const order = ['<RedundancyInfo', '<Security', '<SafetyInfo', '<DataTypes', '<Tags>', '<Programs>', '<Tasks>'].map((t) => xml.indexOf(t));
assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'controller children in the prescribed order');
assert.match(xml, /<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="33.11" TargetName="Test_cell" TargetType="Controller" ContainsContext="false"/);
assert.match(xml, /ProcessorType="5069-L310ER"/);
assert.match(xml, /<Rung Number="0" Type="N">\n\s+<Comment><!\[CDATA\[Start \/ stop seal-in\]\]><\/Comment>\n\s+<Text><!\[CDATA\[\[XIC\(Start_PB\)/);
if (process.env.UPDATE_GOLDEN) { mkdirSync(dirname(golden), { recursive: true }); writeFileSync(golden, xml); }
assert.equal(xml, readFileSync(golden, 'utf8').replace(/\r\n/g, '\n'), 'L5X differs from the golden file (UPDATE_GOLDEN=1 to accept)');

// --- I/O mapping file (manual ch. 21 ALIAS records)
const map = logixIoMapping(program, ctx);
assert.ok(map.includes('ALIAS,"","Start_PB","Start PB","","Local:1:I.Pt00.Data",""'), map);
assert.ok(map.includes('REMARK,"XIC(Local:1:I.Pt00.Data)OTE(Start_PB);"'));
assert.ok(map.includes('REMARK,"XIC(Conveyor_run)OTE(Local:2:O.Pt00.Data);"'));
assert.ok(map.includes('REMARK,"MOV(Local:3:I.Ch00.Data,Tank_level);"'));

// --- checker: CLICK-only operands are refused on Logix
const bad: LadderProgram = { tags: [], rungs: [{ id: 'x', comment: '', branches: [[{ type: 'NO', address: 'SC19' }, { type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'C1' }] }] };
const msgs = validateProgram(bad, logixProfile, new Set()).map((i) => i.message).join(' | ');
assert.match(msgs, /SC19: Logix has no equivalent/);
assert.match(msgs, /no embedded I\/O/);

// --- branch factoring: only plain contacts move out of a branch; a repeated one-shot or kept instruction stays in each leg
{
  const raw = (text: string) => ({ type: 'RAW' as const, vendor: 'logix', text });
  const p2: LadderProgram = { tags: [], rungs: [
    { id: 'f1', comment: '', branches: [[{ type: 'NO', address: 'C1' }, raw('OSR(a,b)'), { type: 'NO', address: 'C3' }], [{ type: 'NO', address: 'C2' }, raw('OSR(a,b)'), { type: 'NO', address: 'C3' }]], outputs: [{ type: 'OUT', address: 'C20' }] },
    { id: 'f2', comment: '', branches: [[raw('JSR(Sub,0)')], [raw('JSR(Sub,0)')]], outputs: [{ type: 'OUT', address: 'C21' }] },
  ] };
  const t = toLogix(p2, ctx, logixIoTag).routines.flatMap((r) => r.rungs.map((g) => g.text));
  assert.ok(t.some((x) => /^\[XIC\(C1\)OSR\(a,b\),XIC\(C2\)OSR\(a,b\)\]XIC\(C3\)OTE\(C20\);$/.test(x)), `one-shot must stay in each leg\n${t.join('\n')}`);
  assert.ok(t.some((x) => x === '[JSR(Sub,0),JSR(Sub,0)]OTE(C21);'), `repeated JSR legs must both stay\n${t.join('\n')}`);
}

// ── CompactLogix 5370 (1769): Local:<slot>:I.Data.<bit>, analog Ch<n>Data, embedded I/O on L1 / L2 ──
{
  const m1769 = [{ partNumber: '1769-IQ16', inputs: 16, outputs: 0 }, { partNumber: '1769-OB16', inputs: 0, outputs: 16 }, { partNumber: '1769-IF4', inputs: 0, outputs: 0, analogInputs: 4 }];
  assert.equal(logixIoTag('X101', m1769, '1769-L33ER'), 'Local:1:I.Data.0');
  assert.equal(logixIoTag('Y216', m1769, '1769-L33ER'), 'Local:2:O.Data.15');
  assert.equal(logixIoTag('X001', m1769, '1769-L33ER'), null, 'an L3 has no embedded I/O');
  const df = logixAnalogChannels(LOGIX_CPUS.find((c) => c.id === '1769-L33ER')!, m1769)[0].address;
  assert.equal(logixIoTag(df, m1769, '1769-L33ER'), 'Local:3:I.Ch0Data');
  // L2 with embedded discrete I/O and analog (QBFC1B): embedded in slots 1 / 2, modules after them.
  assert.equal(logixIoTag('X003', [], '1769-L24ER-QBFC1B'), 'Local:1:I.Data.2');
  assert.equal(logixIoTag('Y016', [], '1769-L24ER-QBFC1B'), 'Local:1:O.Data.15');
  const l2 = LOGIX_CPUS.find((c) => c.id === '1769-L24ER-QBFC1B')!;
  assert.equal(logixIoTag(logixAnalogChannels(l2, [])[0].address, [], l2.id), 'Local:2:I.Ch0Data');
  assert.equal(logixIoTag('X101', [m1769[0]], l2.id), 'Local:4:I.Data.0');
  // An L1 expands with 1734 POINT I/O: no 1769 module tags after it, only its embedded I/O.
  assert.equal(logixIoTag('X003', [], '1769-L16ER-BB1B'), 'Local:1:I.Data.2');
  assert.equal(logixIoTag('X101', [m1769[0]], '1769-L16ER-BB1B'), null);
  // 5069 stays as it was.
  assert.equal(logixIoTag('X101', modules), 'Local:1:I.Pt00.Data');
  // Embedded I/O is allowed where the I/O list assigns it (an L2), an error where the CPU has none.
  const rung: Rung = { id: 'r', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] };
  assert.equal(logixProfile.checkRung!(rung, { ioAddresses: new Set(['X001', 'Y001']) }).length, 0);
  assert.match(logixProfile.checkRung!(rung, { ioAddresses: new Set() }).map((i) => i.message).join(), /X001: this CompactLogix has no embedded I\/O/);
}

// Accented letters keep their letter: "Ölstand" → Olstand, "Straße" → Strasse (never O_lstand).
assert.equal(logixName('Ölstand', new Set(), 'X'), 'Olstand');
assert.equal(logixName('Straße Förderband', new Set(), 'X'), 'Strasse_Forderband');
assert.equal(logixName('Température', new Set(), 'X'), 'Temperature');

console.log('logix tests passed');
