/// <reference types="node" />
/**
 * The I/O names the HMI's Diagnostics screen shows: the PLC's own on an S7 / Micro800 / Unitronics, the app's on
 * CLICK and where the PLC's name is too long for a lamp (Logix). Run with:  npx tsx src/hmi/nativeIo.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile } from '../plc/core/profiles';
import { screenIoName } from './nativeIo';
import { buildHmi } from './engine/build';
import { projectHmiContent } from '../lib/ai/hmiContentAI';
import type { IOPoint } from '../types/io';

const of = (id: string, cpuId?: string) => { const p = getProfile(id); return screenIoName(p, p.cpuModels.find((c) => c.id === cpuId) ?? p.cpuModels.find((c) => c.builtInInputs > 0) ?? p.cpuModels[0], []); };
assert.equal(of('click'), undefined, 'CLICK names I/O as the app does');
const s7 = of('siemens-s7', '6ES7214-1AG40-0XB0')!;
assert.equal(s7('X001'), '%I0.0');
assert.equal(s7('Y002'), '%Q0.1');
assert.equal(s7('C1001'), null, 'memory keeps the app name on the screen');
assert.equal(of('micro800')!('X001'), '_IO_EM_DI_00');
assert.equal(of('logix')!('X001'), null, 'Local:1:I.Data.0 is too long for a lamp label');

// The Diagnostics screen of a built HMI on an S7.
const io: IOPoint[] = [
  { id: 'a', description: 'Start PB', type: 'input' } as IOPoint,
  { id: 'b', description: 'Motor', type: 'output' } as IOPoint,
];
const content = projectHmiContent({ io, addresses: new Map([['a', 'X001'], ['b', 'Y001']]), machineName: 'Test', spec: '', panel: { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 } });
const labels = (ioName?: (a: string) => string | null) => buildHmi(content, { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480, now: 'T', ioName }).screens.flatMap((s) => s.elements.map((e) => e.label));
assert.ok(labels(s7).includes('%I0.0 Start PB') && labels(s7).some((l) => /^Inputs \(CPU\)\s+%I0\.0–%I0\.0$/.test(l)), 'S7: lamps and group titles in S7 addresses');
assert.ok(labels().includes('X001 Start PB'), 'without a name: the app address, as before');
console.log('HMI native I/O name tests passed');
