/// <reference types="node" />
/**
 * Unitronics profiles: CPU models from the catalog, neutral addressing (shared analog inputs, snap-in and
 * module slots), VisiLogic operand mapping and limits, and the export round trips (UniLogic ST declarations
 * cover every identifier the code uses; the VisiLogic listing / operand file name every operand once).
 * Run with:  npx tsx src/plc/core/profiles/unitronics.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram } from '../ladder';
import type { ExportContext } from '../profile';
import type { IOPoint } from '../../../types/io';
import { resolveAddresses } from '../profile';
import { moduleSlots } from '../modules';
import { validateProgram } from '../validate';
import { getCpu, getProfile } from '.';
import { UNISTREAM_CPUS, VISION_CPUS, unitronicsAnalogChannels } from './unitronics';
import { buildUniLogicSt, uniLogicIoLinks, unistreamProfile } from './unilogic';
import { visiIo, visiLimits, visiLogicListing, visiLogicOperandsCsv, visiOperands, visionProfile, visiTime } from './visilogic';
import { cpuFit, hmiFit, modulesToFit, type Need } from '../fit';
import { getHmi } from '../../../hmi/hmiCatalog';
import { plcTagNames } from '../tagNames';

// ---- CPU models and platforms
assert.equal(getProfile('unitronics-unistream'), unistreamProfile);
assert.equal(getProfile('unitronics-vision'), visionProfile);
assert.deepEqual(UNISTREAM_CPUS.map((c) => c.id), ['US5-B5-B1', 'US5-B10-TR22', 'US7-B5-B1', 'US7-B10-TR22', 'US10-B5-B1', 'US10-B10-TR22', 'US15-B10-B1', 'USC-B10-TR22', 'USC-P-B10']);
const v350 = getCpu(visionProfile, 'V350-35-TR34');
assert.equal(v350.builtInInputs, 22);
assert.equal(v350.builtInOutputs, 12);
assert.equal(v350.platformId, 'unitronics-vision');
assert.equal(getCpu(visionProfile, 'SM70-J-T20').platformId, 'unitronics-samba');
assert.match(getCpu(unistreamProfile, 'US7-B10-TR22').label, /built-in 7" touch screen, 10 DI \/ 10 DO \/ 2 analog in, relay out, Ethernet/);
assert.ok(VISION_CPUS.every((c) => c.platformId === 'unitronics-vision' || c.platformId === 'unitronics-samba'));

const need = (o: Partial<Need>): Need => ({ digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0, ethernetHmi: false, minHmiSizeIn: null, ...o });
// Two of the V350's 22 inputs are its analog inputs.
assert.ok(cpuFit(v350, [], need({ digitalInputs: 22 })).ok, '22 DI, no analog');
assert.ok(cpuFit(v350, [], need({ digitalInputs: 20, analogInputs: 2 })).ok, '20 DI + 2 AI');
const f = cpuFit(v350, [], need({ digitalInputs: 21, analogInputs: 2 }));
assert.ok(!f.ok && /Only 20 inputs \(2 used as analog inputs\)/.test(f.reason!), f.reason ?? '');
// Snap-in CPUs: the V700 needs its snap-in; Samba takes no modules.
const v700 = getCpu(visionProfile, 'V700-T20BJ');
assert.ok(!cpuFit(v700, [], need({ digitalInputs: 10, digitalOutputs: 8 })).ok);
assert.deepEqual(modulesToFit(v700.id, [], need({ digitalInputs: 10, digitalOutputs: 8, analogInputs: 2, analogOutputs: 2 })), ['V200-18-E3XB']);
assert.ok(!cpuFit(v700, ['V200-18-E3XB', 'V200-18-E1B'], need({ digitalInputs: 10 })).ok, 'one snap-in only');
assert.ok(!cpuFit(v350, ['V200-18-E1B'], need({ digitalInputs: 10 })).ok, 'no snap-in on a V350');
assert.equal(modulesToFit('SM70-J-T20', [], need({ digitalInputs: 13 })), null, 'Samba: no expansion');
// UniStream: modules on the built-in models.
assert.ok(modulesToFit('US7-B10-TR22', [], need({ digitalInputs: 16, digitalOutputs: 12 }))?.length);

// Built-in screen: the CPU part is its own panel (800x480 7"), only with that CPU.
const screen = getHmi('US7-B10-TR22');
assert.ok(screen && screen.widthPx === 800 && screen.heightPx === 480 && screen.sizeIn === 7, 'US7 built-in screen');
assert.ok(hmiFit(screen!, need({ ethernetHmi: true }), 'US7-B10-TR22').ok, 'its own screen');
assert.match(hmiFit(screen!, need({}), 'US10-B10-TR22').reason ?? '', /Built into the US7-B10-TR22/);
assert.equal(getHmi('JZ20-R31'), undefined, 'Jazz text display is not a designable panel');
assert.ok(getHmi('USP-104-B10') && hmiFit(getHmi('USP-104-B10')!, need({}), 'USC-P-B10').ok, 'USP panel with the panel CPU');

// ---- Addressing
const io: IOPoint[] = [
  ...Array.from({ length: 15 }, (_, i): IOPoint => ({ id: `i${i}`, description: `Sensor ${i + 1}`, type: 'input', category: 'Product Detection' })),
  { id: 'a1', description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } },
  { id: 'i15', description: 'Start PB', type: 'input', category: 'Operator/HMI' },
  { id: 'q1', description: 'Pump run', type: 'output', category: 'Analog/Process' },
  { id: 'q2', description: 'Alarm light', type: 'output', category: 'Operator/HMI' },
];
const addr = resolveAddresses(visionProfile, v350, io, []);
assert.equal(addr.get('a1'), 'DF1', 'analog in → DF1');
assert.equal(addr.get('i13'), 'X014', 'I 13');
assert.equal(addr.get('i14'), 'X016', 'X015 (I 14) is the analog input: skipped');
assert.equal(addr.get('i15'), 'X017');
assert.deepEqual([addr.get('q1'), addr.get('q2')], ['Y005', 'Y006'], 'V350-TR34: relays O4… first, the npn O0–O3 last');
assert.equal(visiIo('X016', v350.id), 'I 15');
assert.equal(visiIo('Y001', v350.id), 'O 0');
assert.equal(visiIo('X103', v350.id), 'I 34', 'expansion module 0 point 2: 32 + 0·16 + 2');
assert.equal(visiIo('X101', v700.id), 'I 0', 'snap-in on a CPU without on-board I/O: low addresses');
assert.equal(visiIo('X203', v700.id), 'I 34', 'first expansion module after the snap-in');
assert.deepEqual(unitronicsAnalogChannels(v350, []).map((c) => `${c.label}:${c.terminals[0]}:${c.sharesInput}`), ['CPU analog 0 (input I14):I14:X015', 'CPU analog 1 (input I15):I15:X016']);
const us7 = getCpu(unistreamProfile, 'US7-B10-TR22');
const usAddr = resolveAddresses(unistreamProfile, us7, [...io, ...Array.from({ length: 4 }, (_, i): IOPoint => ({ id: `y${i}`, description: `Valve ${i + 1}`, type: 'output', category: 'Pneumatic' }))], moduleSlots(['UID-0808T']));
assert.equal(usAddr.get('i9'), 'X010');
assert.equal(usAddr.get('i10'), 'X101', 'past the 10 on-board inputs: module 1');
assert.equal(usAddr.get('a1'), 'DF1', 'TR22 on-board AI0 (own terminal, no shared input)');
assert.equal(usAddr.get('i14'), 'X105');
assert.equal(unistreamProfile.parseAddress('X022')?.kind, 'input');
assert.equal(unistreamProfile.parseAddress('X033'), null);

// ---- Program
const makeProgram = (a: Map<string, string>): LadderProgram => { const [startPb, pump, alarm] = ['i15', 'q1', 'q2'].map((k) => a.get(k)!); return ({
  blocks: [{ id: 'b1', name: 'Pump', description: '' }],
  tags: [
    { address: 'C1', nickname: 'Run_Latch', comment: '' }, { address: 'T1', nickname: 'Dry_Run_Tmr', comment: '' },
    { address: 'T2', nickname: 'Run_Hours', comment: '' }, { address: 'T3', nickname: 'Light_Off_Delay', comment: '' },
    { address: 'CT1', nickname: 'Start_Count', comment: '' }, { address: 'DS1', nickname: 'Dry_Run_SP', comment: 's' },
    { address: 'DF101', nickname: 'Level_Low_SP', comment: '%' },
  ],
  rungs: [
    { id: 'r1', block: 'b1', comment: 'Seal-in', branches: [[{ type: 'NO', address: startPb }, { type: 'NC', address: 'T1' }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'T1' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', block: 'b1', comment: '', branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'OUT', address: pump }] },
    { id: 'r3', block: 'b1', comment: 'Dry run', branches: [[{ type: 'NO', address: 'C1' }, { type: 'CMP', left: 'DF1', op: '<', right: 'DF101' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r4', block: 'b1', comment: 'Run hours', branches: [[{ type: 'NO', address: pump }]], outputs: [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '3600', unit: 'sec', accumulate: true, resetAddress: 'X001' }] },
    { id: 'r5', block: 'b1', comment: 'Starts', branches: [[{ type: 'RISE', address: 'C1' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '1000', resetAddress: 'X002' }] },
    { id: 'r6', comment: 'Alarm light stays on 5 s', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'TMR', address: 'T3', mode: 'OFF_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r7', comment: '', branches: [[{ type: 'NO', address: 'T3' }, { type: 'NO', address: 'SC7' }]], outputs: [{ type: 'OUT', address: alarm }] },
    { id: 'r8', comment: 'Defaults', branches: [[{ type: 'NO', address: 'SC2' }]], outputs: [{ type: 'COPY', source: '10', dest: 'DS1' }, { type: 'MATH', dest: 'DS2', expression: 'TD2 / 60 + CTD1' }] },
  ],
}); };
let program = makeProgram(addr);
const ioSet = new Set(addr.values());
assert.deepEqual(validateProgram(program, visionProfile, ioSet).filter((i) => i.severity === 'error'), [], 'Vision checker');
assert.ok(validateProgram(program, visionProfile, ioSet).some((i) => /no off-delay timer/.test(i.message)), 'off-delay warning');
assert.deepEqual(validateProgram(program, unistreamProfile, ioSet).filter((i) => i.severity === 'error'), [], 'UniStream checker');
const labels = new Map(io.map((p) => [addr.get(p.id)!, p.description]));
const ctx = (cpuId: string, a = addr, modules: string[] = []): ExportContext => ({ io, addresses: a, labels: new Map(io.map((p) => [a.get(p.id)!, p.description])), header: `Pump skid — ${cpuId}`, extraTags: [{ address: 'C1001', nickname: 'HMI_Start', comment: 'HMI' }], cpuId, modules: moduleSlots(modules), projectName: 'Pump skid', now: new Date(0) });
void labels;

// ---- VisiLogic: every operand mapped once, inside the limits, back from the listing and the operand file.
const vctx = ctx(v350.id);
const map = visiOperands(program, vctx);
assert.deepEqual(map.errors, []);
const expect: Record<string, string> = { X017: 'I 16', X001: 'I 0', X002: 'I 1', Y005: 'O 4', Y006: 'O 5', C1: 'MB 0', C1001: 'MB 1', DS1: 'MI 0', DS2: 'MI 1', DF1: 'MF 0', DF101: 'MF 1', T1: 'T 0', T2: 'T 1', T3: 'T 2', CT1: 'C 0', SC2: 'SB 2', SC7: 'SB 3' };
for (const [b, op] of Object.entries(expect)) assert.equal(map.byBase.get(b)?.operand, op, `${b} → ${op}`);
assert.equal(map.analogRaw.get('DF1')?.operand, 'MI 2', 'analog raw value linked to an MI');
assert.equal(map.offDelay.get('T3')?.operand, 'MB 2', 'off-delay output bit');
const listing = visiLogicListing(program, vctx);
// Round trip: the operand map in the listing reads back to the same mapping, one operand per address.
const back = new Map([...listing.matchAll(/^(\w+ \d+)\s+([A-Z]+\d+)\s+(.+)$/gm)].map((m) => [m[2], m[1]]));
for (const [b, v] of map.byBase) assert.equal(back.get(b), v.operand, `listing operand map ${b}`);
assert.equal(new Set(back.values()).size, back.size, 'no operand used twice');
const has = (s: string) => assert.ok(listing.includes(s), `listing missing: ${s}\n${listing}`);
has('[Direct contact I 16 (Start PB)] AND [Inverted contact T 0 (Dry_Run_Tmr)]');
has('→ Timer coil T 0 (TD, on-delay), preset from MI 0 (Dry_Run_SP) × 100 (10 ms units)');
has('→ Timer coil T 1 (TA, accumulating), preset 01:00:00.00');
has('→ Reset coil T 1');
has('[Positive transition contact MB 0 (Run_Latch)]');
has('→ Increment C 0 (counts rising edges; counter preset 1000)');
has('→ Set coil MB 2 (Light_Off_Delay_Q, off-delay output)');
has('→ Timer coil T 2 (TD, on-delay), preset 00:00:05.00');
has('[Direct contact MB 2 (Light_Off_Delay_Q)] AND [Direct contact SB 3 (1-second pulse)]');
has('[Less than: MF 0 (Tank level) , MF 1 (Level_Low_SP)]');
has('Linearization: MI 2');
has('Math: MI 1 := T 1 elapsed (preset − current, 10 ms units) / 60 + C 0 current value');
assert.ok(!/ERROR/.test(listing), 'no limit errors on the V350');
const csv = visiLogicOperandsCsv(program, vctx).split('\r\n');
assert.equal(csv[1], '"Address","MB","MI","ML","MF","T","C","I","O"', 'header in row 2');
assert.equal(csv[2], '0,"Run_Latch","Dry_Run_SP","","Tank_level","Dry_Run_Tmr","Start_Count","Sensor_1",""');
assert.equal(visiTime(359_999_990), '99:59:59.99');
assert.deepEqual(visiLimits('SM43-J-T20'), { MB: 512, MI: 256, ML: 32, MF: 24, T: 32, C: 16 });
// Samba limits: 17 counters do not fit (16).
const many: LadderProgram = { blocks: [], tags: [], rungs: Array.from({ length: 17 }, (_, i) => ({ id: `c${i}`, comment: '', branches: [[{ type: 'NO' as const, address: 'X001' }]], outputs: [{ type: 'CNT' as const, address: `CT${i + 1}`, direction: 'UP' as const, preset: '5', resetAddress: null }] })) };
assert.match(visiLogicListing(many, ctx('SM43-J-T20')), /ERROR: Uses 17 C operands; the SM43-J-T20 has 16/);
assert.match(visiLogicListing(many, ctx('V350-35-TR34')), /^(?![\s\S]*ERROR)/, 'V350 has 32 counters');
const vNames = plcTagNames(visionProfile, program, vctx);
assert.equal(vNames.get('C1001')?.name, 'MB 1');
assert.equal(vNames.get('T3')?.name, 'MB 2', 'an off-delay timer is read through its output bit');

// ---- UniLogic: global declarations cover every identifier in the code; I/O link list.
const uctx = ctx(us7.id, usAddr, ['UID-0808T']);
program = makeProgram(usAddr);
const { st } = buildUniLogicSt(program, uctx);
const section = (re: RegExp) => [...st.matchAll(re)].flatMap((m) => m[1].split('\n').map((l) => /^\s*(\w+)\s*:\s*(\w+);/.exec(l)).filter(Boolean).map((m) => [m![1], m![2]] as const));
const globals = new Map([...section(/VAR_GLOBAL\n([\s\S]*?)END_VAR/g), ...section(/VAR_GLOBAL RETAIN\n([\s\S]*?)END_VAR/g)]);
const external = new Map(section(/VAR_EXTERNAL\n([\s\S]*?)END_VAR/g));
assert.deepEqual([...external].sort(), [...globals].sort(), 'VAR_EXTERNAL = VAR_GLOBAL');
const code = st.slice(st.indexOf('END_VAR', st.indexOf('VAR_EXTERNAL')) + 7, st.indexOf('END_FUNCTION')).replace(/\(\*[\s\S]*?\*\)/g, '');
const KEYWORDS = new Set(['IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'IN', 'PT', 'Q', 'ET', 'CU', 'CD', 'R', 'LD', 'PV', 'CV', 'CLK', 'TO_TIME', 'TO_DINT', 'TO_INT', 'Machine_Logic']);
for (const id of new Set(code.match(/\b[A-Za-z_]\w*\b/g) ?? [])) if (!KEYWORDS.has(id) && !/^T$|^ms$/.test(id)) assert.ok(globals.has(id), `undeclared identifier ${id}`);
for (const [n] of globals) assert.match(n, /^[A-Za-z_][A-Za-z0-9_]*$/, `UniLogic identifier ${n}`);
assert.ok(![...globals.values()].some((t) => /^(RTO|TONR|LREAL|WORD|DWORD|BYTE)$/.test(t)), 'only UniLogic types');
assert.equal(globals.get('Run_Hours'), 'BOOL', 'accumulating timer emulated: done bit');
assert.equal(globals.get('T2_TON'), 'TON');
assert.ok(/VAR_GLOBAL RETAIN[\s\S]*T2_ACC : DINT[\s\S]*END_VAR/.test(st), 'run-hour accumulator is retained');
assert.ok(st.includes('Start_Count(CU := RT_1.Q, R := Sensor_2, PV := 1000);'), st);
assert.ok(st.includes('Dry_Run_Tmr(IN := Run_Latch AND (Tank_level < Level_Low_SP), PT := TO_TIME(Dry_Run_SP * 1000));'), st);
assert.ok(st.includes('FirstScan := NOT Initialized;'));
assert.ok(st.includes('FUNCTION Machine_Logic : BOOL') && st.trimEnd().endsWith('END_FUNCTION'));
const links = uniLogicIoLinks(program, uctx).split('\r\n');
assert.ok(links.some((l) => l.startsWith('"Pump_run","BOOL","Output","US7-B10-TR22 on-board output 0","O0"')), links.join('\n'));
assert.ok(links.some((l) => l.startsWith('"Tank_level","REAL","Analog input","US7-B10-TR22 on-board AI0","AI0"') && /0…100 %/.test(l)), links.join('\n'));
assert.ok(links.some((l) => l.startsWith('"Start_PB","BOOL","Input","Slot 1 UID-0808T input ')), links.join('\n'));
const uNames = plcTagNames(unistreamProfile, program, uctx);
assert.equal(uNames.get('T2')?.name, 'Run_Hours');
assert.equal(uNames.get('TD2')?.name, 'T2_ET');
assert.equal(uNames.get('T1')?.name, 'Dry_Run_Tmr.Q');
if (process.env.DUMP_ST) console.log(st);
console.log('unitronics profile tests passed');
