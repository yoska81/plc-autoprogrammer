/// <reference types="node" />
/**
 * Texts in the PLC's own names: only addresses a point is on get a terminal name; the user's words stay.
 * Run with:  npx tsx src/deliverables/plcNames.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from './collect';
import { inPlcNames, withNativeIo } from './plcNames';
import { applyEquipment } from '../spec/equipment';
import { unistreamProfile } from '../plc/core/profiles/unilogic';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
seedSampleProject();

// S7-1500 + ET 200SP: no on-board I/O, the first module's first input is %I0.0. An address no point is on
// (X001) gets no terminal; the point on X101 is %I0.0.
{
  applyEquipment({ cpuId: '6ES7511-1AL03-0AB0', modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'], hmiPartNumber: null }, null);
  const p = collectProject();
  const used = new Set([...p.addresses.values()]);
  assert.ok(!used.has('X001') && used.has('X101'), [...used].join(', '));
  const native = withNativeIo(p);
  assert.equal(native('X001 is not assigned to any I/O point.'), 'X001 is not assigned to any I/O point.');
  assert.equal(native('Input X101 is wired.'), 'Input X101 (%I0.0) is wired.');
  assert.equal(inPlcNames(p)('X001 and X101'), 'X001 and %I0.0');
}

// UniStream: UniLogic's words; no on-board terminal on a CPU without on-board I/O, none on an empty slot.
{
  const uid = [{ partNumber: 'UID-1600', inputs: 16, outputs: 0 }];
  assert.equal(unistreamProfile.ioTag?.('X001', uid, 'US5-B5-B1'), null, 'US5-B5-B1 has no on-board I/O');
  assert.equal(unistreamProfile.ioTag?.('X101', uid, 'US5-B5-B1'), 'slot 1 UID-1600 input 0');
  assert.equal(unistreamProfile.ioTag?.('X201', uid, 'US5-B5-B1'), null, 'no module in slot 2');
  assert.equal(unistreamProfile.ioTag?.('Y003', [], 'US5-B10-TR22'), 'on-board output 2');
}

console.log('plc names tests passed');
