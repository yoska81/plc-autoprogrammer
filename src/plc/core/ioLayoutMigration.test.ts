/// <reference types="node" />
/**
 * Saved CLICK PLUS projects (side manager's must-fix): before the option-slot module became slot 0, the app
 * numbered every module from slot 1. A project saved then (C2-03CPU, a C0-16ND3 stackable and a C2-14D1 option
 * module) has its first stackable input at X101 and the option module at X201…. Opened now, the option module is
 * X001… and the stackable is X101…. Without a migration, the old program's "X101" would silently read another
 * input. On load, the program, its saved versions and the HMI move to the new addresses once, with a notice.
 * Run with:  npx tsx src/plc/core/ioLayoutMigration.test.ts
 */
import assert from 'node:assert/strict';
import { addProjectFromData } from '../../store/useProjectsStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useHmiStore } from '../../store/useHmiStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useIOStore } from '../../store/useIOStore';
import { useNoticeStore } from '../../store/useNoticeStore';
import { ioAddresses } from './ioChange';
import '../../hmi/ioParticipant';
import type { LadderProgram } from './ladder';
import type { IOPoint } from '../../types/io';

const io: IOPoint[] = [
  { id: 'I001', description: 'Start Button', type: 'input', category: 'Operator/HMI' },
  { id: 'I002', description: 'Part sensor', type: 'input', category: 'Product Detection' },
  ...Array.from({ length: 16 }, (_, i) => ({ id: `I${String(i + 3).padStart(3, '0')}`, description: `Sensor ${i + 3}`, type: 'input' as const, category: 'Station 1' as const })),
  { id: 'Q001', description: 'Conveyor motor', type: 'output', category: 'Conveyor' },
];
// The old layout: C0-16ND3 = slot 1 (X101–X116), C2-14D1 = slot 2 (X201…, Y201…).
const oldProgram: LadderProgram = {
  rungs: [{ id: 'r1', comment: 'Start the conveyor', branches: [[{ type: 'NO', address: 'X101' }, { type: 'NO', address: 'X201' }]], outputs: [{ type: 'OUT', address: 'Y201' }] }],
  tags: [],
};
const oldHmi = {
  hmiPartNumber: 'CM5-T7W', generatedAt: '2026-01-01', notes: [], alarms: [],
  tags: [{ name: 'Start_PB', address: 'X101', dataType: 'bool', access: 'read', description: 'Start Button X101' }],
  screens: [{ id: 's1', name: 'Main', elements: [{ id: 'e1', kind: 'indicator', label: 'Start', x: 0, y: 0, w: 10, h: 10, address: 'X101' }] }],
};
const data = {
  plc: { plcId: 'click', cpuId: 'C2-03CPU', modules: ['C0-16ND3', 'C2-14D1'], recommendation: null, info: {} },
  io: { projectIO: io },
  program: { ladder: oldProgram, versions: [{ id: 'v1', label: 'old', at: '2026-01-01', program: oldProgram }], projectName: 'Old CLICK PLUS' },
  hmi: { design: oldHmi, hmiPartNumber: 'CM5-T7W', explanation: null },
};

addProjectFromData('Old CLICK PLUS', data);
const now = ioAddresses(useIOStore.getState().projectIO);
assert.deepEqual(['I001', 'I002', 'I009', 'Q001'].map((id) => now.get(id)), ['X001', 'X002', 'X101', 'Y001'], 'the app numbers the option module first now');
const rung = useProgramStore.getState().ladder.rungs[0];
// X101 was I001 (Start, then on the stackable), X201 was I017 (the option module's first input), Y201 was Q001.
assert.deepEqual(rung.branches[0].map((e) => ('address' in e ? e.address : '')), [now.get('I001'), now.get('I017')], 'the program reads the same inputs as before');
assert.deepEqual(rung.outputs.map((o) => ('address' in o ? o.address : '')), [now.get('Q001')]);
assert.deepEqual(useProgramStore.getState().versions[0].program.rungs[0].branches, rung.branches, 'the saved version too');
const hmi = useHmiStore.getState().design!;
assert.equal(hmi.screens[0].elements[0].address, now.get('I001'), 'the HMI lamp still shows Start');
assert.equal(hmi.tags[0].address, now.get('I001'));
assert.equal(useProjectStore.getState().ioLayout, 'click-slot0', 'marked with the new layout');
assert.match(useNoticeStore.getState().message ?? '', /older CLICK PLUS addressing/, 'a notice says so');

// Once only: opening it again changes nothing.
const before = useProgramStore.getState().ladder;
useNoticeStore.getState().clear();
addProjectFromData('Copy', { ...data, plc: { ...data.plc, ioLayout: 'click-slot0' }, program: { ...data.program, ladder: before } });
assert.equal(JSON.stringify(useProgramStore.getState().ladder), JSON.stringify(before), 'a project with the new layout is not migrated');
assert.equal(useNoticeStore.getState().message, null);

console.log('ioLayout migration tests passed');
