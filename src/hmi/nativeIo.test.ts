/// <reference types="node" />
/**
 * The I/O names the HMI's screens are drawn with: the PLC's own on an S7 / Micro800 / Unitronics, the app's on
 * CLICK and where the PLC's name is too long for a lamp (Logix); only the project's real I/O points get one; the
 * saved design keeps the app's addresses. Run with:  npx tsx src/hmi/nativeIo.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile } from '../plc/core/profiles';
import { nativeIoLabel, nativeScreen, screenIoName } from './nativeIo';
import type { HmiScreen } from './types';

const io = new Set(['X001', 'X002', 'Y001', 'Y002']);
const of = (id: string, cpuId?: string, modules: { partNumber: string; inputs: number; outputs: number }[] = []) => {
  const p = getProfile(id);
  return screenIoName(p, p.cpuModels.find((c) => c.id === cpuId) ?? p.cpuModels.find((c) => c.builtInInputs > 0) ?? p.cpuModels[0], modules, io);
};
assert.equal(of('click'), undefined, 'CLICK names I/O as the app does');
const s7 = of('siemens-s7', '6ES7214-1AG40-0XB0')!;
assert.equal(s7('X001'), '%I0.0');
assert.equal(s7('y002'), '%Q0.1');
assert.equal(s7('X016'), null, 'not an I/O point of the project: no borrowed name');
assert.equal(s7('C1001'), null, 'memory keeps the app name on the screen');
assert.equal(of('micro800')!('X001'), '_IO_EM_DI_00');
assert.equal(of('logix')!('X001'), null, 'Local:1:I.Data.0 is too long for a lamp label');
// S7-1500 + ET 200SP: the project's CPU and modules decide the byte (X101 is %I0.0 there; X001 is no point).
const s1500 = getProfile('siemens-s7').cpuModels.find((c) => c.platformId === 'siemens-s7-1500')!.id;
const s7p = getProfile('siemens-s7');
const et = screenIoName(s7p, s7p.cpuModels.find((c) => c.id === s1500)!, [{ partNumber: 'DI16', inputs: 16, outputs: 0 }], new Set(['X101']))!;
assert.equal(et('X101'), '%I0.0');
assert.equal(et('X001'), null, 'a stale X001 does not show X101\'s %I0.0');

// Labels as drawn; the saved screen is not changed.
assert.equal(nativeIoLabel('X001 Start PB', s7), '%I0.0 Start PB');
assert.equal(nativeIoLabel('Inputs (CPU)  X001–X002', s7), 'Inputs (CPU)  %I0.0–%I0.1');
assert.equal(nativeIoLabel('X016 spare, C1001', s7), 'X016 spare, C1001');
assert.equal(nativeIoLabel('X001 Start PB', undefined), 'X001 Start PB');
const saved: HmiScreen = { id: 'd', name: 'Diagnostics', purpose: '', elements: [{ id: 'l', kind: 'indicator', label: 'X001 Start PB', x: 0, y: 0, w: 10, h: 10 } as HmiScreen['elements'][number]] };
assert.equal(nativeScreen(saved, s7).elements[0].label, '%I0.0 Start PB');
assert.equal(saved.elements[0].label, 'X001 Start PB', 'the saved design keeps the app address');
assert.equal(nativeScreen(saved, undefined), saved);
console.log('HMI native I/O name tests passed');
