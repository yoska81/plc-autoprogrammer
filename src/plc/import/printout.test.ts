/// <reference types="node" />
/**
 * Printout reading → program: names and I/O from the reading, a CLICK program keeps its terminals on a
 * CLICK, unreadable rungs become questions, instructions it can't express stay RAW.
 * Run with:  npx tsx src/plc/import/printout.test.ts
 */
import assert from 'node:assert/strict';
import { normalizeReading, printoutToForeign, PRINTOUT_SCHEMA, type PrintoutReading } from './printout';
import { convertForeign } from './convert';
import { planUpgrade, questionsFor } from './upgrade';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import type { IOPoint } from '../../types/io';

const reading: PrintoutReading = normalizeReading({
  plc: { maker: 'AutomationDirect', model: 'CLICK C0-02DD1-D', profileId: 'click' },
  projectName: 'Pusher cell',
  tags: [
    { name: 'Start_PB', address: 'X001', description: 'Start pushbutton', io: 'input', analog: false },
    { name: 'Stop_PB', address: 'X002', description: 'Stop pushbutton (NC)', io: 'input', analog: false },
    { name: 'Part_Sensor', address: 'X005', description: 'Part at end of conveyor', io: 'input', analog: false },
    { name: 'Conveyor_Motor', address: 'Y001', description: 'Conveyor motor', io: 'output', analog: false },
    { name: 'Pusher', address: 'Y003', description: 'Pusher valve', io: 'output', analog: false },
    { name: 'Running', address: 'C1', description: 'Machine running', io: 'internal', analog: false },
  ],
  routines: [{
    name: 'Main',
    rungs: [
      { id: '', number: '1', page: 1, comment: 'Run latch', branches: [[{ type: 'NO', address: 'Start_PB' }, { type: 'NC', address: 'Stop_PB' }], [{ type: 'NO', address: 'Running' }, { type: 'NC', address: 'Stop_PB' }]], outputs: [{ type: 'OUT', address: 'Running' }], confidence: 'high', doubt: '' },
      { id: '', number: '2', page: 1, comment: '', branches: [[{ type: 'NO', address: 'Running' }]], outputs: [{ type: 'OUT', address: 'Conveyor_Motor' }], confidence: 'high', doubt: '' },
      { id: '', number: '3', page: 2, comment: 'Push the part', branches: [[{ type: 'NO', address: 'Running' }, { type: 'NO', address: 'Part_Sensor' }]], outputs: [{ type: 'OUT', address: 'Pusher' }, { type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }], confidence: 'low', doubt: 'the timer preset could be 3 or 8' },
      { id: '', number: '4', page: 2, comment: '', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'RAW', vendor: 'click', text: 'SHIFT REGISTER C10..C20' }], confidence: 'medium', doubt: 'shift register range partly cut off' },
    ],
  }],
  notes: ['Page 3 was blank.'],
});

assert.deepEqual(reading.routines[0].rungs.map((r) => r.id), ['main_1', 'main_2', 'main_3', 'main_4']);
assert.ok(JSON.stringify(PRINTOUT_SCHEMA).includes('"RAW"'), 'the AI can keep instructions as printed');

const imp = convertForeign(printoutToForeign(reading), 'pusher.pdf');
assert.equal(imp.source.format, 'printout');
assert.equal(imp.io.length, 5);
assert.equal(imp.report.converted, 3, 'the shift register rung is kept as printed');
assert.ok(imp.report.notConverted.some((n) => n.kept && /SHIFT REGISTER/.test(n.text)));
const q = questionsFor(imp);
assert.ok(q.some((x) => /Hard to read: rung 3 on page 2 \(Main\): the timer preset could be 3 or 8/.test(x)), 'low-confidence rung asked on the Machine description page');

// Back on a CLICK: the same terminals (X005 stays X005 although X003 / X004 are not used).
const plan = planUpgrade(imp, 'logix');
assert.equal(plan.plcId, 'click');
let i = 0, o = 0;
const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++o).padStart(3, '0')}` }));
const profile = getProfile('click');
const addr = resolveAddresses(profile, getCpu(profile, plan.cpuId), io, moduleSlots(plan.modules));
assert.deepEqual(io.map((p) => addr.get(p.id)), ['X001', 'X002', 'X005', 'Y001', 'Y003']);
assert.ok(plan.program.tags.some((t) => t.nickname === 'Part_Sensor' && t.address === 'X005'));

console.log('printout.test: all passed');
