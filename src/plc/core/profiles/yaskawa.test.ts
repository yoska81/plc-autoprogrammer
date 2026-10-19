/// <reference types="node" />
/**
 * Yaskawa MP2000 / MP3000 profile: MPE720's register forms (as the .YMW7 reader writes them), I / O by module,
 * the app's memory areas and how they move around an imported program's own registers (side manager's must-fix:
 * a new rung must never share memory with MB001000 / MW00010 … of the user's program).
 * Run with:  npx tsx src/plc/core/profiles/yaskawa.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile, PLC_PROFILES } from './index';
import {
  DEFAULT_MEMORY, YASKAWA_CPUS, allocateMemory, memoryOverlaps, mpRegister, mWords, nativeWords, yaskawaFamily, yaskawaIo, yaskawaMemory, yaskawaName, yaskawaProfile,
} from './yaskawa';
import type { ModuleSlot } from '../profile';
import type { LadderProgram } from '../ladder';
import { plcNameLookup } from '../plcNames';
import { validateProgram } from '../validate';

// MPE720 forms: I / O words in hex (4 digits), M words in decimal (5 digits), a bit as one hex digit.
assert.equal(mpRegister('I', 'B', 0, 0), 'IB00000');
assert.equal(mpRegister('I', 'B', 0x10, 15), 'IB0010F');
assert.equal(mpRegister('O', 'W', 0x8000), 'OW8000');
assert.equal(mpRegister('M', 'B', 1234, 0), 'MB012340');
assert.equal(mpRegister('M', 'B', 123, 10), 'MB00123A');
assert.equal(mpRegister('M', 'L', 6000), 'ML06000');
assert.deepEqual(mWords('MB012340'), [1234]);
assert.deepEqual(mWords('ML06000'), [6000, 6001]);
assert.equal(mWords('IB00000'), null, 'an I register is not M memory');

// The profile is listed and selectable (it was "coming soon").
assert.ok(PLC_PROFILES.includes(yaskawaProfile));
assert.equal(getProfile('yaskawa-mp').id, 'yaskawa-mp');
assert.deepEqual([...new Set(YASKAWA_CPUS.map((c) => yaskawaFamily(c.id)))].sort(), ['yaskawa-mp2000', 'yaskawa-mp3000'], 'one profile, two families (Dev 5\'s panel drivers)');

// I / O: two LIO modules by self-configuration (no catalog data: assumed): after the CPU-301's own registers
// (218IFD, MECHATROLINK-III I/O, M-EXECUTOR up to 0C3F), each module on a 16-word boundary.
const cpu301 = YASKAWA_CPUS[0];
const lio: ModuleSlot[] = [{ partNumber: 'LIO-A', inputs: 16, outputs: 16 }, { partNumber: 'LIO-B', inputs: 32, outputs: 32 }];
assert.deepEqual(yaskawaIo('X101', cpu301, lio), { register: 'IB0C400', assumed: true });
assert.equal(yaskawaIo('X116', cpu301, lio)?.register, 'IB0C40F');
assert.equal(yaskawaIo('X201', cpu301, lio)?.register, 'IB0C500', 'the second module on the next 16-word boundary');
assert.equal(yaskawaIo('X216', cpu301, lio)?.register, 'IB0C50F');
assert.equal(yaskawaIo('Y101', cpu301, lio)?.register, 'OB0C400', 'the same leading register for its outputs');
const mp2300 = YASKAWA_CPUS.find((c) => c.id === 'JEPMC-MP2300-E')!;
assert.deepEqual([yaskawaIo('X001', mp2300, [])?.register, yaskawaIo('X008', mp2300, [])?.register, yaskawaIo('Y001', mp2300, [])?.register], ['IB00000', 'IB00007', 'OB00010'], 'MP2300: built-in DI at IW0000, DO at OW0001');
assert.equal(yaskawaIo('X101', mp2300, [{ partNumber: 'LIO-A', inputs: 16, outputs: 16 }])?.register, 'IB00100', 'its first module after the built-in words, on a 16-word boundary');
assert.equal(yaskawaIo('X001', cpu301, lio), null, 'a CPU-301 has no I/O of its own');
assert.equal(yaskawaIo('X117', cpu301, lio), null, 'no 17th point on a 16-point module');
assert.equal(yaskawaProfile.ioTag!('X101', lio, cpu301.id), 'IB0C400');

// Memory with the defaults (a new project).
const regs = Object.fromEntries(['C1', 'C17', 'DS1', 'DD2', 'DH1', 'DF1', 'T1', 'TD3', 'CT1', 'CTD1', 'SC1', 'SC2'].map((a) => [a, yaskawaMemory(a)]));
assert.deepEqual(regs, {
  C1: 'MB000000', C17: 'MB000010', DS1: 'MW01000', DD2: 'ML06002', DH1: 'MW08000', DF1: 'MF08500',
  T1: 'MB095000', TD3: 'MW09702', CT1: 'MB096000', CTD1: 'ML10200', SC1: 'SB000004', SC2: 'SB000001',
});
assert.equal(yaskawaName('100', {}), '#100', 'constants');

// The side manager's case: an imported program uses MW00000–MW00020 and MB001000; the app adds a rung with C1, DS1, T1.
const imported: LadderProgram = {
  rungs: [{ id: 'r_app', comment: 'added by the app', branches: [[{ type: 'NO', address: 'C1' }, { type: 'CMP', left: 'DS1', op: '>', right: '5' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '100', unit: 'ms', accumulate: false, resetAddress: '' }] }],
  tags: [
    ...Array.from({ length: 21 }, (_, i) => ({ address: `DS${4000 + i}`, nickname: `Reg_${i}`, comment: '', native: `MW${String(i).padStart(5, '0')}` })),
    { address: 'C1500', nickname: 'Run', comment: '', native: 'MB001000' },
  ],
};
const used = nativeWords(imported.tags);
assert.ok(used.has(0) && used.has(20) && used.has(100), 'MW00000–MW00020 and MB001000 (MW00100) are the program\'s');
assert.ok(memoryOverlaps(imported).some((m) => /C1 is MB000000/.test(m)), 'with the defaults, C1 would share MW00000');
const layout = allocateMemory(used);
assert.notEqual(layout.C, DEFAULT_MEMORY.C, 'the C area moves off the program\'s registers');
assert.equal(layout.DS, DEFAULT_MEMORY.DS, 'areas that are free keep their default');
assert.deepEqual(memoryOverlaps(imported, layout), [], 'with the allocated layout nothing is shared');
for (const a of ['C1', 'DS1', 'T1', 'TD1']) for (const w of mWords(yaskawaMemory(a, layout)!)!) assert.ok(!used.has(w), `${a} lands on a free word`);
// The checker reports a clash as an error.
const errs = validateProgram(imported, yaskawaProfile, new Set(), undefined, {}).filter((i) => i.severity === 'error').map((i) => i.message);
assert.ok(errs.some((m) => /C1 is MB000000 in this project, which the program's MW00000 \(Reg_0\) already uses/.test(m)), errs.join(' | '));
assert.ok(!validateProgram(imported, yaskawaProfile, new Set(), undefined, { yaskawaMemory: layout }).some((i) => /already uses/.test(i.message)));
// Bits of one word are separate memory; a word over a bit is not.
const bits: LadderProgram = { rungs: [{ id: 'r', comment: '', branches: [[{ type: 'NO', address: 'C2' }]], outputs: [{ type: 'OUT', address: 'C3' }] }], tags: [{ address: 'X999', nickname: 'Own', comment: '', native: 'MB000000' }] };
assert.deepEqual(memoryOverlaps(bits), [], 'MB000001 / MB000002 next to the program\'s MB000000 are other bits');
assert.equal(memoryOverlaps({ ...bits, rungs: [{ ...bits.rungs[0], outputs: [{ type: 'OUT', address: 'C1' }] }] }).length, 1, 'C1 = MB000000, the same bit');

// The PLC names: the register is the name; an imported register stays as it was.
const named = plcNameLookup(yaskawaProfile, imported, { io: [], addresses: new Map([['I001', 'X101']]), labels: new Map(), header: '', extraTags: [], cpuId: cpu301.id, modules: lio, yaskawaMemory: layout })!;
assert.equal(named('X101')?.name, 'IB0C400');
assert.equal(named('C1500')?.name, 'MB001000', 'the program\'s own register');
assert.equal(named('DS1')?.name, 'MW01000');
assert.equal(named('C1')?.name, yaskawaMemory('C1', layout));

// The rules engine builds the same neutral program on Yaskawa as on CLICK (the example's points are X001–X006 /
// Y001–Y003 on both an MP2300 and the CLICK CPU): the safety logic (E-stop chain, a reset that never restarts) is the
// one already tested, and the checker finds nothing (SC2 = SB000001, SC7 = SB000012 are mapped).
{
  const { seedSampleProject } = await import('../../../preview/sampleProject');
  const { collectProject } = await import('../../../deliverables/collect');
  const { useProjectStore } = await import('../../../store/useProjectStore');
  const { generateRuleBasedProgram } = await import('../../ai/cycleAI');
  seedSampleProject();
  const build = async () => {
    const p = collectProject();
    const r = await generateRuleBasedProgram({ ctx: { profile: p.profile, cpu: p.cpu, io: p.io, addresses: p.addresses, wiring: new Map() }, spec: '', electrical: null, hmi: p.hmi, noPanel: false });
    return { p, program: r.program };
  };
  const click = await build();
  useProjectStore.getState().setPlc('yaskawa-mp', 'JEPMC-MP2300-E');
  const mp = await build();
  assert.deepEqual([...mp.p.addresses.values()], [...click.p.addresses.values()], 'the same neutral addresses');
  assert.deepEqual(mp.program.rungs, click.program.rungs, 'the same program as on CLICK');
  assert.deepEqual(validateProgram(mp.program, mp.p.profile, new Set([...mp.p.addresses.values()]), mp.p.hmi ?? undefined).filter((i) => i.severity === 'error').map((i) => i.message), [], 'no checker errors on Yaskawa');
}

console.log('yaskawa profile tests passed');
