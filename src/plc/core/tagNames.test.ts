/// <reference types="node" />
/**
 * PLC tag names for HMI binding. Run with:  npx tsx src/plc/core/tagNames.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram } from './ladder';
import type { ExportContext, ModuleSlot } from './profile';
import { plcTagNames } from './tagNames';
import { logixProfile } from './profiles/logix';
import { micro800Profile } from './profiles/micro800';
import { siemensProfile } from './profiles/siemens';
import { clickProfile } from './profiles/click';
import { buildL5x } from './profiles/l5x';
import { buildScl } from './profiles/siemens';
import type { IOPoint } from '../../types/io';

const program: LadderProgram = {
  tags: [{ address: 'C1', nickname: 'Run', comment: '' }, { address: 'T1', nickname: 'Jam_Timer', comment: '' }, { address: 'CT1', nickname: 'Parts', comment: '' }],
  rungs: [
    { id: 'r1', comment: '', branches: [[{ type: 'NO', address: 'C1001' }], [{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', comment: '', branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r3', comment: '', branches: [[{ type: 'RISE', address: 'T1' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '10', resetAddress: null }, { type: 'COPY', source: 'CTD1', dest: 'DS1101' }] },
  ],
};
// HMI tags: C1001 (used by the ladder) and DS1001 (setpoint the ladder doesn't use yet)
const extraTags = [
  { address: 'C1001', nickname: 'HMI_Start', comment: 'HMI: Start button' },
  { address: 'DS1001', nickname: 'HMI_Speed_SP', comment: 'HMI: speed' },
  { address: 'DS1101', nickname: 'HMI_Count', comment: 'HMI: count' },
];
const ctx = (modules: ModuleSlot[] = []): ExportContext => ({ io: [] as IOPoint[], addresses: new Map(), labels: new Map(), header: 'x', extraTags, cpuId: undefined, modules, now: new Date(0) });

// Logix: names as in the L5X; HMI-only DS1001 is created as a controller tag
const lx = plcTagNames(logixProfile, program, ctx());
assert.deepEqual(lx.get('C1001'), { name: 'HMI_Start', scope: 'Controller', dataType: 'BOOL' });
assert.deepEqual(lx.get('DS1001'), { name: 'HMI_Speed_SP', scope: 'Controller', dataType: 'DINT' });
assert.equal(lx.get('T1')?.name, 'Jam_Timer.DN');
assert.equal(lx.get('TD1')?.name, 'Jam_Timer.ACC');
assert.equal(lx.get('CTD1')?.name, 'Parts.ACC');
const l5x = buildL5x(program, ctx());
for (const n of ['HMI_Start', 'HMI_Speed_SP', 'HMI_Count', 'Jam_Timer']) assert.ok(l5x.includes(`<Tag Name="${n}"`), `${n} in the L5X`);

// Micro800
const mc = plcTagNames(micro800Profile, program, ctx());
assert.deepEqual(mc.get('DS1001'), { name: 'HMI_Speed_SP', scope: 'Program', dataType: 'DINT' });
assert.equal(mc.get('T1')?.name, 'Jam_Timer.Q');
assert.equal(mc.get('TD1')?.name, 'Jam_Timer.ET');
assert.ok(![...mc.keys()].some((k) => /^RT_/.test(k)), 'edge instances are not HMI tags');

// Siemens: DB path the HMI binds to
const s7 = plcTagNames(siemensProfile, program, ctx());
assert.deepEqual(s7.get('C1001'), { name: '"Machine_DB".HMI_Start', scope: 'Machine_DB', dataType: 'Bool' });
assert.equal(s7.get('DS1101')?.name, '"Machine_DB".HMI_Count');
assert.equal(s7.get('CTD1')?.name, '"Machine_DB".Parts.CV');
assert.ok(buildScl(program, ctx()).scl.includes('      HMI_Speed_SP : DInt;'), 'HMI-only tag declared in the FB');

// CLICK: the address is the tag
const ck = plcTagNames(clickProfile, program, ctx());
assert.deepEqual(ck.get('DS1001'), { name: 'DS1001', scope: 'CLICK', dataType: 'INT' });
console.log('tag name tests passed');
