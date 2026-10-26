/// <reference types="node" />
/**
 * Redlines / field changes on the example project: notes become design edits where the app can make
 * them, the rest is recorded; applying bumps the revision and writes the change list into it.
 * Run with:  npx tsx src/redlines/redlines.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { useElectricalStore } from '../store/useElectricalStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { collectProject } from '../deliverables/collect';
import { getPart } from '../electrical/catalog';
import { changeContext, applyRedlines, previewEdits } from './apply';
import { nextRev, parseChange } from './fieldChange';
import { redlinesFor, useRedlineStore } from './useRedlineStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
const ctx = changeContext();
const design = ctx.design!;
const k1 = design.components.find((c) => c.tag === 'K1')!;
const other = design.components.map((c) => c.partNumber).find((pn) => pn !== k1.partNumber && getPart(pn)?.category === getPart(k1.partNumber)?.category)
  ?? design.components.find((c) => c.partNumber !== k1.partNumber)!.partNumber;
const pe = design.ioWiring.find((w) => /^PE/.test(w.deviceTag))!;
const inAddr = (desc: RegExp) => ctx.addresses.get(ctx.io.find((p) => desc.test(p.description))!.id)!;
const x3 = inAddr(/Stop Button/);

// Parsing: what the app can edit itself.
assert.deepEqual(parseChange('M1 is 3 HP', ctx), [{ kind: 'motor-hp', tag: 'M1', hp: 3 }]);
assert.deepEqual(parseChange('m1 now 2.2 kW on a VFD', ctx), [{ kind: 'motor-hp', tag: 'M1', hp: 2.95 }, { kind: 'motor-starter', tag: 'M1', starter: 'vfd' }]);
assert.deepEqual(parseChange(`Replace K1 with ${other}`, ctx), [{ kind: 'part', tag: 'K1', partNumber: other }]);
assert.deepEqual(parseChange('Replace K1 with NOT-A-PART-123', ctx), [], 'unknown part: by hand');
assert.deepEqual(parseChange(`Move ${pe.deviceTag} to the infeed side`, ctx), [{ kind: 'device-location', tag: pe.deviceTag, location: 'Infeed side' }]);
assert.deepEqual(parseChange(`${x3} description: Stop pushbutton (NC)`, ctx), [{ kind: 'io-description', address: x3, description: 'Stop pushbutton (NC)' }]);
assert.deepEqual(parseChange('Add a second E-stop at the infeed', ctx), [], 'not something the app edits: recorded only');
assert.equal(nextRev([]), 'A');
assert.equal(nextRev([{ rev: 'B' }]), 'C');
assert.equal(nextRev([{ rev: '0' }]), '1');

// Mark on a sheet + field changes, then apply.
const pid = useProjectsStore.getState().activeId;
const store = useRedlineStore.getState();
store.add(pid, { at: { kind: 'sheet', sheet: 3, drawingNo: 'E03', title: 'Motor circuits', x: 0.4, y: 0.55 }, note: 'M1 is 3 HP', by: 'JT' });
store.add(pid, { at: { kind: 'form' }, note: `Replace K1 with ${other}`, by: 'JT' });
store.add(pid, { at: { kind: 'form' }, note: `${x3} description: Stop pushbutton (NC). Move ${pe.deviceTag} to the infeed side.`, by: 'JT' });
store.add(pid, { at: { kind: 'form' }, note: 'Add a second E-stop at the infeed', by: 'JT' });
assert.equal(previewEdits(redlinesFor(pid)).size, 4);
const revsBefore = useProjectStore.getState().info.revisions.length;
const expectRev = nextRev(useProjectStore.getState().info.revisions);
const r = applyRedlines({ by: 'JT', date: '2026-10-17' })!;
assert.deepEqual(r, { rev: expectRev, applied: 3, manual: 1 });

// The design edits were made.
const el = useElectricalStore.getState();
assert.equal(el.inputs.motors.find((m) => m.tag === 'M1')?.hp, 3);
assert.equal(el.design!.inputs.motors.find((m) => m.tag === 'M1')?.hp, 3);
assert.equal(el.design!.components.find((c) => c.tag === 'K1')?.partNumber, other);
assert.equal(el.design!.ioWiring.find((w) => w.deviceTag === pe.deviceTag)?.location, 'Infeed side');
const snap = collectProject();
assert.equal(useIOStore.getState().projectIO.find((p) => snap.addresses.get(p.id) === x3)?.description, 'Stop pushbutton (NC)');

// The revision was bumped with the change list (document control).
const revs = useProjectStore.getState().info.revisions;
assert.equal(revs.length, revsBefore + 1);
const cur = revs[revs.length - 1];
assert.equal(cur.rev, expectRev);
assert.equal(cur.by, 'JT');
assert.match(cur.description, /Field changes \(4 redlines\)/);
assert.equal(cur.changes?.length, 4);
assert.match(cur.changes![0], /^Sheet 3 \(E03\): M1 is 3 HP → M1 power set to 3 HP/);
assert.match(cur.changes![3], /Add a second E-stop at the infeed → to be edited by hand/);
// The redlines are closed with their revision; nothing is applied twice.
assert.deepEqual(redlinesFor(pid).map((x) => [x.status, x.rev]), [['applied', expectRev], ['applied', expectRev], ['applied', expectRev], ['manual', expectRev]]);
assert.equal(applyRedlines({ by: 'JT' }), null);
console.log('redline tests passed');
