/// <reference types="node" />
/**
 * Printout reading → program: names and I/O from the reading, a CLICK program keeps its terminals on a
 * CLICK, unreadable rungs become questions, instructions it can't express stay RAW.
 * Run with:  npx tsx src/plc/import/printout.test.ts
 */
import assert from 'node:assert/strict';
import { mergeReadings, normalizeReading, printoutToForeign, PRINTOUT_SCHEMA, type PrintoutReading } from './printout';
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

// ── A malformed answer never breaks the review or the confirm ──
{
  const bad = normalizeReading({
    plc: { maker: 'x' }, tags: null,
    routines: [{ name: 'Main', rungs: [
      { number: 1, page: '2', comment: null, branches: [[{ type: 'NO' }, { type: 'NC', address: 'X002' }]], outputs: null, confidence: 'high', doubt: '' },
      { number: '2', page: 0, branches: 'nonsense', outputs: [{ type: 'OUT', address: 'Y001' }, { type: 'TMR' }], confidence: 'high' },
    ] }, null],
  });
  const [a, b] = bad.routines[0].rungs;
  assert.deepEqual(a.branches, [[{ type: 'NO', address: '?' }, { type: 'NC', address: 'X002' }]]);
  assert.deepEqual(a.outputs, []);
  assert.equal(a.confidence, 'low');
  assert.match(a.doubt, /contact could not be read.*no output/);
  assert.equal(a.page, 2);
  assert.deepEqual(b.branches, []);
  assert.deepEqual(b.outputs, [{ type: 'OUT', address: 'Y001' }]);
  assert.equal(b.confidence, 'low', 'a dropped output makes the rung hard to read');
  assert.equal(b.page, 1);
  assert.doesNotThrow(() => convertForeign(printoutToForeign(bad), 'bad.pdf'));
}

// ── "?" and names the tag list doesn't have are asked about, even when the AI was sure ──
{
  const r = normalizeReading({ ...reading, routines: [{ name: 'Main', rungs: [
    { number: '7', page: 3, comment: '', branches: [[{ type: 'NO', address: 'Ghost_Tag' }, { type: 'NO', address: '?' }]], outputs: [{ type: 'OUT', address: 'Pusher' }], confidence: 'high', doubt: '' },
  ] }] });
  const notes = printoutToForeign(r).notes;
  assert.ok(notes.some((n) => /^Hard to read: rung 7 on page 3 \(Main\): Ghost_Tag, \? are not in the printout's tag list or unreadable/.test(n)), notes.join(' | '));
}

// ── An address-only printout (no tag list): X / Y stay inputs / outputs ──
{
  const r = normalizeReading({ plc: { maker: 'AutomationDirect', model: 'CLICK', profileId: 'click' }, projectName: '', tags: [], notes: [], routines: [{ name: 'Main', rungs: [
    { number: '1', page: 1, comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }], confidence: 'high', doubt: '' },
  ] }] });
  const imp2 = convertForeign(printoutToForeign(r), 'a.pdf');
  assert.deepEqual(imp2.io.map((p) => `${p.original}:${p.type}`), ['X001:input', 'Y001:output']);
}

// ── Page batches read separately are one program (a routine continued on the next batch joined) ──
{
  const part = (rungs: string[], page: number, name = 'Main') => normalizeReading({ plc: { maker: 'Rockwell', model: '1769-L33ER', profileId: 'logix' }, projectName: 'P', tags: [{ name: 'A', address: '', description: '', io: 'internal', analog: false }], notes: [], routines: [{ name, rungs: rungs.map((n) => ({ number: n, page, comment: '', branches: [[{ type: 'NO', address: 'A' }]], outputs: [{ type: 'OUT', address: 'B' }], confidence: 'high', doubt: '' })) }] });
  const m = mergeReadings([part(['0', '1'], 20), part(['2'], 21), part(['0'], 22, 'Alarms')]);
  assert.deepEqual(m.routines.map((r) => `${r.name}:${r.rungs.map((g) => g.number).join(',')}`), ['Main:0,1,2', 'Alarms:0']);
  assert.equal(m.tags.length, 1);
  assert.equal(new Set(m.routines.flatMap((r) => r.rungs.map((g) => g.id))).size, 4, 'unique rung ids');
}

// Siemens addresses as printed without "%", and in German.
{
  const { ioOfAddress } = await import('./printout');
  assert.deepEqual(['I0.0', 'IW96', 'E1.3', 'EW64', 'Q0.1', 'QW80', 'A4.7', 'AW96', '%I0.2', 'X001', 'M10.0', 'MW4'].map(ioOfAddress), ['input', 'input', 'input', 'input', 'output', 'output', 'output', 'output', 'input', 'input', null, null]);
}

console.log('printout.test: all passed');
