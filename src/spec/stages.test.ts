// npx tsx src/spec/stages.test.ts — stage staleness when the PLC (and so the I/O addresses) changes.
import assert from 'node:assert/strict';
import { addressFingerprint, computeStages, ioFingerprint } from './useStages';
import type { IOPoint } from '../types/io';
import type { SpecSections } from './types';

const io = [
  { id: 'I001', description: 'Start', type: 'input', category: 'Operator/HMI' },
  { id: 'I002', description: 'Stop', type: 'input', category: 'Operator/HMI' },
  { id: 'Q001', description: 'Motor', type: 'output', category: 'Conveyor' },
] as IOPoint[];

// Same I/O list, different PLC: different addresses (X001 on CLICK, X101 on a CompactLogix with modules).
const click = addressFingerprint('click', 'C0-10DD1E-D', [], io);
assert.equal(click, addressFingerprint('click', 'C0-10DD1E-D', [], io), 'stable for the same PLC');
const logix = addressFingerprint('logix', '5069-L306ER', ['5069-IB16', '5069-OB16'], io);
assert.notEqual(click, logix, 'another PLC family renumbers the I/O');
assert.notEqual(click, addressFingerprint('click', 'C0-10DD1E-D', [], [...io, { ...io[0], id: 'I003', description: 'Reset' }]), 'a new point changes it too');

const spec = { overview: 'x' } as unknown as SpecSections;
const fp = (addrFp: string) => ({ spec, specFp: 's', ioFp: ioFingerprint(io), addrFp, hmiFp: 'h' });
const src = (addrFp?: string) => ({ specFp: 's', spec, ioFp: ioFingerprint(io), hmiFp: 'h', at: '', ...(addrFp ? { addrFp } : {}) });
const sources = (a?: string) => ({ equipment: src(a), io: src(a), electrical: src(a), hmi: src(a), program: src(a) });
const run = (srcFp: string | undefined, now: string, ioFp = ioFingerprint(io)) => computeStages({ fp: { ...fp(now), ioFp }, sources: sources(srcFp), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true });

const same = run(click, click);
assert.ok(['electrical', 'hmi', 'program'].every((k) => same[k as 'hmi'].status === 'ready'), 'nothing changed: ready');

const moved = run(click, logix);
for (const k of ['electrical', 'hmi', 'program'] as const) {
  assert.equal(moved[k].status, 'stale', `${k} out of date after the PLC change`);
  assert.match(moved[k].reason ?? '', /PLC or its I\/O addresses changed/);
}
assert.equal(moved.io.status, 'ready', 'the I/O list itself does not depend on the PLC');
assert.equal(moved.equipment.status, 'ready');

const old = run(undefined, logix);
assert.ok(['electrical', 'hmi', 'program'].every((k) => old[k as 'hmi'].status === 'ready'), 'stages made before the address fingerprint existed are not flagged');

const ioEdit = run(click, logix, 'other');
assert.equal(ioEdit.hmi.reason, 'Out of date: the I/O list changed.', 'an I/O list change is reported once');
console.log('stage tests passed');
