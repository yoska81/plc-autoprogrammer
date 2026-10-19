// npx tsx src/spec/stages.test.ts — stage staleness when the PLC (and so the I/O addresses) changes.
import assert from 'node:assert/strict';
import { addressFingerprint, computeStages, ioFingerprint } from './useStages';
import { modulesToFit } from '../plc/core/fit';
import { hardwareShortfall, needFromIo } from './equipmentRules';
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
// The installation region: only the electrical design depends on it.
const regionRun = computeStages({ fp: { ...fp(click), region: 'EU' }, sources: Object.fromEntries(Object.entries(sources(click)).map(([k, v]) => [k, { ...v, region: 'US' }])), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true });
assert.equal(regionRun.electrical.reason, 'Out of date: the installation region changed.');
assert.equal(regionRun.hmi.status, 'ready');
assert.equal(regionRun.program.status, 'ready');
// Q&A staleness per stage: an HMI answer stales the HMI and the program only; an assumption the
// stages already used stales nothing.
{
  const { fingerprint } = await import('./types');
  const base = { overview: 'x', qa: 'Q (Machine description): Speed?\nA: 10 ppm' } as unknown as SpecSections;
  const withHmi = { ...base, qa: `${base.qa}\nQ (HMI): Which screen first?\nA: Main` } as unknown as SpecSections;
  const withAssumed = { ...base, qa: `${base.qa}\nQ (Electrical design): Enclosure?\nA: (AI's assumption: NEMA 12)` } as unknown as SpecSections;
  const built = (sp: SpecSections) => ({ specFp: fingerprint(sp), spec: sp, ioFp: ioFingerprint(io), hmiFp: 'h', at: '' });
  const all = (sp: SpecSections) => ({ equipment: built(sp), io: built(sp), electrical: built(sp), hmi: built(sp), program: built(sp) });
  const st = (now: SpecSections) => computeStages({ fp: { spec: now, specFp: fingerprint(now), ioFp: ioFingerprint(io), hmiFp: 'h' }, sources: all(base), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true });
  const h = st(withHmi);
  assert.deepEqual(['equipment', 'io', 'electrical', 'hmi', 'program'].map((k) => h[k as 'hmi'].status), ['ready', 'ready', 'ready', 'stale', 'stale'], 'an HMI answer: HMI and program only');
  const a = st(withAssumed);
  assert.ok(['equipment', 'io', 'electrical', 'hmi', 'program'].every((k) => a[k as 'hmi'].status === 'ready'), "using the AI's assumption stales nothing");
  const spec2 = { ...base, qa: 'Q (Machine description): Speed?\nA: 20 ppm' } as unknown as SpecSections;
  assert.ok(['equipment', 'io', 'electrical', 'hmi', 'program'].every((k) => st(spec2)[k as 'hmi'].status === 'stale'), 'a description answer stales every stage');
}

// A machine without a touch panel (equipment chosen with "No touch panel"): the HMI stage is done, not "to do".
{
  const noPanel = computeStages({ fp: fp(click), sources: sources(click), ioCount: 3, hasDesign: true, hasHmi: false, hasProgram: true, noHmi: true });
  assert.equal(noPanel.hmi.status, 'ready', 'no HMI on this machine: nothing to design');
  const notChosen = computeStages({ fp: fp(click), sources: sources(click), ioCount: 3, hasDesign: true, hasHmi: false, hasProgram: true });
  assert.equal(notChosen.hmi.status, 'empty', 'an HMI not designed yet is still to do');
}

// The PLC must hold the I/O list: a CPU with no built-in I/O and no modules is short, and the Equipment stage says so.
{
  const short = hardwareShortfall('5069-L310ER', [], io);
  assert.ok(short, 'no built-in I/O and no modules: short');
  assert.equal(hardwareShortfall('5069-L310ER', ['5069-IB16', '5069-OB16'], io), null, 'with modules it holds the list');
  assert.equal(hardwareShortfall('5069-L310ER', [], []), null, 'no I/O list yet: nothing to check');
  const mods = modulesToFit('5069-L310ER', [], needFromIo(io, false, 0));
  assert.ok(mods?.length && hardwareShortfall('5069-L310ER', mods, io) === null, 'modules are found that fit');
  const st = computeStages({ fp: fp(click), sources: sources(click), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true, hardwareShort: short });
  assert.equal(st.equipment.status, 'stale');
  assert.match(st.equipment.reason ?? '', /cannot hold the I\/O list/);
  const ok = computeStages({ fp: fp(click), sources: sources(click), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true, hardwareShort: null });
  assert.notEqual(ok.equipment.status, 'stale');
}

// Another PLC brand than the one asked for: Equipment is out of date (Update all chooses it again), with the reason.
{
  const st = computeStages({ fp: fp(click), sources: sources(click), ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true, otherBrand: "The description asks for Siemens S7-1200 / S7-1500; the project's PLC is AutomationDirect CLICK." });
  assert.equal(st.equipment.status, 'stale');
  assert.match(st.equipment.reason ?? '', /asks for Siemens.*Equipment page/);
}

// Screens laid out for one panel and scaled to another: the HMI stage is out of date and says what to do.
{
  const laidOut = Object.fromEntries(Object.entries(sources(click)).map(([k, v]) => [k, k === 'hmi' ? { ...v, panel: 'CM5-T7W' } : v]));
  const moved = computeStages({ fp: { ...fp(click), panel: 'CM5-T4W' }, sources: laidOut, ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true });
  assert.equal(moved.hmi.status, 'stale');
  assert.match(moved.hmi.reason ?? '', /touch panel changed .*CM5-T7W.*Redesign screens.*CM5-T4W/);
  const same = computeStages({ fp: { ...fp(click), panel: 'CM5-T7W' }, sources: laidOut, ioCount: 3, hasDesign: true, hasHmi: true, hasProgram: true });
  assert.equal(same.hmi.status, 'ready', 'back on the panel it was laid out for');
}

console.log('stage tests passed');
