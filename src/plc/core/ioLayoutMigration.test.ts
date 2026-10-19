/// <reference types="node" />
/**
 * Saved CLICK PLUS projects (side manager's must-fix). Before the option-slot module became slot 0, the app
 * numbered every module from slot 1. A project saved then (C2-03CPU, a C0-16ND3 stackable listed first and a
 * C2-14D1 option module) has the stackable at X101–X116 and the option module at X201… / Y201…. Opened now,
 * every point stays on the same physical terminal:
 *   - the stackable's points stay X101…: they get fixed addresses, since the option module now takes X001… first;
 *   - the option module's X201 / Y201 become X001 / Y001;
 *   - a manual address is translated (X205 = the option module's X5 → X005, never the stackable's X105);
 *   - a pulse output is not moved off its wired terminal: the notice says to move it to a pulse-train output.
 * The program, its saved versions and the HMI follow, once, with a notice and a backup.
 * Run with:  npx tsx src/plc/core/ioLayoutMigration.test.ts
 */
import assert from 'node:assert/strict';
import { addProjectFromData, listSavedWork } from '../../store/useProjectsStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useHmiStore } from '../../store/useHmiStore';
import { IO_LAYOUT_VERSION, useProjectStore } from '../../store/useProjectStore';
import { useIOStore } from '../../store/useIOStore';
import { useNoticeStore } from '../../store/useNoticeStore';
import { ioAddresses } from './ioChange';
import '../../hmi/ioParticipant';
import type { LadderProgram } from './ladder';
import type { IOPoint } from '../../types/io';

const io: IOPoint[] = [
  { id: 'I001', description: 'Start Button', type: 'input', category: 'Operator/HMI' },
  ...Array.from({ length: 15 }, (_, i) => ({ id: `I${String(i + 2).padStart(3, '0')}`, description: `Sensor ${i + 2}`, type: 'input' as const, category: 'Station 1' as const })),
  { id: 'I017', description: 'Part sensor (option module X1)', type: 'input', category: 'Product Detection' },
  { id: 'I018', description: 'Door switch', type: 'input', category: 'Safety', plcAddress: 'X205' },
  { id: 'Q001', description: 'Conveyor motor', type: 'output', category: 'Conveyor' },
];
// The old layout: C0-16ND3 = slot 1 (X101–X116), C2-14D1 = slot 2 (X201…, Y201…); I018 typed by hand as X205.
const oldProgram: LadderProgram = {
  rungs: [{ id: 'r1', comment: 'Start the conveyor', branches: [[{ type: 'NO', address: 'X101' }, { type: 'NO', address: 'X201' }, { type: 'NO', address: 'X205' }]], outputs: [{ type: 'OUT', address: 'Y201' }] }],
  tags: [],
};
const oldHmi = {
  hmiPartNumber: 'CM5-T7W', generatedAt: '2026-01-01', notes: [], alarms: [],
  tags: [{ name: 'Part', address: 'X201', dataType: 'bool', access: 'read', description: 'Part sensor X201' }],
  screens: [{ id: 's1', name: 'Main', elements: [{ id: 'e1', kind: 'indicator', label: 'Start', x: 0, y: 0, w: 10, h: 10, address: 'X101' }, { id: 'e2', kind: 'indicator', label: 'Door', x: 0, y: 20, w: 10, h: 10, address: 'X205' }] }],
};
const data = (extra: Record<string, unknown> = {}) => ({
  plc: { plcId: 'click', cpuId: 'C2-03CPU', modules: ['C0-16ND3', 'C2-14D1'], recommendation: null, info: {}, ...extra },
  io: { projectIO: io },
  program: { ladder: oldProgram, versions: [{ id: 'v1', label: 'old', at: '2026-01-01', program: oldProgram }], projectName: 'Old CLICK PLUS' },
  hmi: { design: oldHmi, hmiPartNumber: 'CM5-T7W', explanation: null },
});

// Node has no browser storage: an in-memory one, so the backup can be checked.
// Like the browser's: the stored items are the object's own keys (listSavedWork reads Object.keys(localStorage)).
const ls: Record<string, string> = {};
Object.defineProperties(ls, {
  getItem: { value: (k: string) => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null) },
  setItem: { value: (k: string, v: string) => { ls[k] = String(v); } },
  removeItem: { value: (k: string) => { delete ls[k]; } },
});
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls });
const backups = listSavedWork().filter((w) => w.kind === 'backup').length;
addProjectFromData('Old CLICK PLUS', data());
const now = ioAddresses(useIOStore.getState().projectIO);
// Same terminals: the stackable keeps X101…, the option module's X201 / X205 / Y201 are X001 / X005 / Y001 now.
assert.deepEqual(['I001', 'I016', 'I017', 'I018', 'Q001'].map((id) => now.get(id)), ['X101', 'X116', 'X001', 'X005', 'Y001'], 'every point on its old terminal');
assert.equal(useIOStore.getState().projectIO.find((p) => p.id === 'I018')!.plcAddress, 'X005', 'the manual X205 (option module X5) is translated, not left on the stackable\'s X105');
const rung = useProgramStore.getState().ladder.rungs[0];
assert.deepEqual(rung.branches[0].map((e) => ('address' in e ? e.address : '')), ['X101', 'X001', 'X005'], 'the program reads the same terminals');
assert.deepEqual(rung.outputs.map((o) => ('address' in o ? o.address : '')), ['Y001']);
assert.deepEqual(useProgramStore.getState().versions[0].program.rungs[0].branches, rung.branches, 'the saved version too');
const hmi = useHmiStore.getState().design!;
assert.deepEqual(hmi.screens[0].elements.map((e) => e.address), ['X101', 'X005'], 'the HMI lamps still show Start and Door');
assert.equal(hmi.tags[0].address, 'X001');
assert.equal(useProjectStore.getState().ioLayoutVersion, IO_LAYOUT_VERSION, 'marked with the current layout');
const i001 = useIOStore.getState().projectIO.find((p) => p.id === 'I001')!;
assert.equal(i001.addressNote, 'kept on its wired terminal (migration)', 'the I/O list says why the address is fixed');
assert.equal(useIOStore.getState().projectIO.find((p) => p.id === 'I018')!.addressNote, undefined, 'a translated manual address is the user\'s own');
useIOStore.getState().setPlcAddress('I001', 'X101');
assert.equal(useIOStore.getState().projectIO.find((p) => p.id === 'I001')!.addressNote, undefined, 'the user\'s own address: no note');
const notice = useNoticeStore.getState().message ?? '';
assert.match(notice, /older CLICK PLUS addressing/);
assert.match(notice, /fixed address on their old terminal: I001 Start Button → X101/, 'the notice lists the fixed addresses');
assert.ok(listSavedWork().some((w) => w.kind === 'backup' && /CLICK PLUS address migration/.test(w.reason ?? '')) && listSavedWork().filter((w) => w.kind === 'backup').length > backups, 'a backup was kept before migrating');

// Once only: a project with the current layout is not migrated.
const before = useProgramStore.getState().ladder;
useNoticeStore.getState().clear();
addProjectFromData('Copy', { ...data({ ioLayoutVersion: IO_LAYOUT_VERSION }), program: { ladder: before, versions: [], projectName: 'Copy' } });
assert.equal(JSON.stringify(useProgramStore.getState().ladder), JSON.stringify(before), 'a project with the current layout is not migrated');
assert.equal(useNoticeStore.getState().message, null);

// Saved by a build that marked the slot-0 layout with ioLayout: 'click-slot0' (before ioLayoutVersion): already
// the current layout, never migrated a second time.
useNoticeStore.getState().clear();
addProjectFromData('Marked', { ...data({ ioLayout: 'click-slot0' }), program: { ladder: before, versions: [], projectName: 'Marked' } });
assert.equal(JSON.stringify(useProgramStore.getState().ladder), JSON.stringify(before), 'ioLayout click-slot0 is the current layout');
assert.equal(useNoticeStore.getState().message, null);

// A servo pulse output wired (in the old layout) to the option module's Y202: it stays there — the new automatic
// addressing would put it on Y001 and shift the other outputs — and the notice says to move it to a pulse output.
useNoticeStore.getState().clear();
const pulseIo: IOPoint[] = [
  { id: 'Q001', description: 'Conveyor motor', type: 'output', category: 'Conveyor' },
  { id: 'Q002', description: 'Axis 1 servo pulse', type: 'output', category: 'Servo/Axis' },
  { id: 'Q003', description: 'Axis 1 servo direction', type: 'output', category: 'Servo/Axis' },
];
addProjectFromData('Old pulse', { plc: { plcId: 'click', cpuId: 'C2-03CPU', modules: ['C2-14D1'], recommendation: null, info: {} }, io: { projectIO: pulseIo }, program: { ladder: { rungs: [], tags: [] }, versions: [], projectName: 'Old pulse' } });
const p2 = ioAddresses(useIOStore.getState().projectIO);
assert.deepEqual(['Q001', 'Q002', 'Q003'].map((id) => p2.get(id)), ['Y001', 'Y002', 'Y003'], 'every output stays on its wired terminal');
assert.match(useNoticeStore.getState().message ?? '', /Pulse output not on a pulse-train output \(Y001 \/ Y003 \/ Y005\): Q002 Axis 1 servo pulse \(Y002\)/, useNoticeStore.getState().message ?? '');

console.log('ioLayout migration tests passed');
