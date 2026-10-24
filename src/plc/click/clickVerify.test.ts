/// <reference types="node" />
/**
 * Send to CLICK, the check: the export / print plans (the file name typed, Save left to the user, nothing that
 * saves), nicknames compared, rungs compared by their addresses in order against a printout's text (a missing or
 * wrong address named by its rung; the printout's page headers and nicknames do not matter).
 * Run with:  npx tsx src/plc/click/clickVerify.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram } from '../core/ladder';
import { saveSteps } from './clickPlan';
import { addressesIn, compareNicknames, compareRungs, crossReference, exportNicknamesPlan, nicknamesOf, printLadderPlan, rungAddressesInOrder } from './clickVerify';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { clickNicknameCsv } from '../core/clickExport';

const folder = 'C:\\Users\\tech\\AppData\\Local\\Temp\\isa-click';
for (const plan of [exportNicknamesPlan(folder, 'click_nicknames.csv'), printLadderPlan(folder, 'click_ladder.pdf')]) {
  assert.deepEqual(saveSteps(plan), [], 'nothing that saves');
  assert.ok(plan.some((s) => s.do === 'setText' && /isa-click\\click_/.test(s.text ?? '')), 'the file name in the bridge folder typed');
  const turn = plan.find((s) => s.do === 'waitGone')!;
  assert.match(turn.say!, /Your turn: press Save/);
}

// nicknames
assert.deepEqual([...nicknamesOf('"Address","Data Type","Nickname","Initial Value"\r\n"X001","BIT","Start, PB","0"\r\nc1,BIT,Run,0\r\n')], [['X001', 'Start, PB'], ['C1', 'Run']]);
const n = compareNicknames('Address,Nickname\nX001,Start\nX002,Stop\nC1,Run', 'Nickname,Address\nStart,X001\nHalt,X002');
assert.equal(n.checked, 3);
assert.deepEqual(n.missing, ['C1']);
assert.deepEqual(n.different, [{ address: 'X002', ours: 'Stop', click: 'Halt' }]);

// addresses in text: CLICK spellings, three-digit I/O
assert.deepEqual(addressesIn('Rung 3  X1 Start  NC X002  T1 TD1 CTD2 DS10 C100 OUT Y001 (Motor) Page 2 of 9 SC2'), ['X001', 'X002', 'T1', 'TD1', 'CTD2', 'DS10', 'C100', 'Y001', 'SC2']);

// rungs: the printout of what was entered, with page furniture and nicknames between
const prog: LadderProgram = { tags: [], rungs: [
  { id: 'a', comment: 'Motor run', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'X002' }], [{ type: 'NO', address: 'Y001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
  { id: 'b', comment: '', branches: [[{ type: 'CMP', left: 'DS1', op: '>=', right: '10' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '500', unit: 'ms', accumulate: false, resetAddress: null }] },
  { id: 'c', comment: '', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'SET', address: 'C5' }] },
] };
assert.deepEqual(rungAddressesInOrder(prog).map((r) => r.addresses), [['X001', 'X002', 'Y001', 'Y001'], ['DS1', 'T1'], ['T1', 'C5']]);
const good = 'Conveyor.ckp  Page 1\n1  X001 Start  X002 Stop  Y001 Motor  Y001\n2  DS1 >= 10   T1 500 ms\n3  T1  SET C5\nEND';
assert.deepEqual(compareRungs(prog, good), { rungs: 3, ok: 3, differences: [], extra: [] });
// rung 2 entered with the wrong register, rung 3's coil missing
const bad = '1  X001 X002 Y001 Y001\n2  DS2 >= 10  T1\n3  T1\nEND';
const r = compareRungs(prog, bad);
assert.equal(r.ok, 1);
assert.deepEqual(r.differences, [{ rung: 2, missing: ['DS1'] }, { rung: 3, missing: ['C5'] }]);
assert.deepEqual(r.extra, ['DS2']);

// the example program against a "printout" of itself: all rungs match
seedSampleProject();
const p = collectProject();
const printed = rungAddressesInOrder(p.ladder).map((x) => `${x.rung}  ${x.addresses.join(' ')}`).join('\n');
const all = compareRungs(p.ladder, `Page 1\n${printed}\nEND`);
assert.equal(all.ok, all.rungs);
assert.equal(all.rungs, p.ladder.rungs.length);
// CLICK 4.00's printed Cross Reference (text; its ladder prints as a picture): each rung's addresses in that rung
const xrefOf = (rows: { rung: number; addresses: string[] }[]) => ['NewProject1', 'Cross Reference(Page 1 of 1)', 'Address Nickname DataType ProgramName Rung Row Column Instruction',
  ...rows.flatMap((r, i) => r.addresses.map((a) => `${a} Some_Name ${/^(DS|CTD)/.test(a) ? 'Integer' : 'Bit'} Main Program ${i + 1} 1 A Contact (NO)`))].join('\n');
const inOrder = rungAddressesInOrder(p.ladder);
assert.equal(crossReference(xrefOf(inOrder)).length, inOrder.flatMap((r) => r.addresses).length, 'every use read');
const xok = compareRungs(p.ladder, xrefOf(inOrder));
assert.equal(xok.ok, xok.rungs, 'the Cross Reference of the project itself fits');
assert.deepEqual(xok.extra, []);
// a timer's current value (T1 → TD1) is part of its box, not an extra
const withTd = inOrder.map((r) => ({ ...r, addresses: [...r.addresses, ...r.addresses.filter((a) => /^T\d/.test(a)).map((a) => a.replace('T', 'TD'))] }));
assert.ok(withTd.some((r) => r.addresses.some((a) => a.startsWith('TD'))));
assert.deepEqual(compareRungs(p.ladder, xrefOf(withTd)).extra, []);
const wrong = inOrder.map((r, i) => (i === 3 ? { ...r, addresses: ['X009', ...r.addresses.slice(1)] } : r));
const xbad = compareRungs(p.ladder, xrefOf(wrong));
assert.deepEqual(xbad.differences, [{ rung: 4, missing: [inOrder[3].addresses[0]] }], 'a wrong address in rung 4 is named');
assert.deepEqual(xbad.extra, ['X009 (rung 4)']);

// our nickname CSV against itself
const csv = clickNicknameCsv(p.ladder, p.io, p.addresses);
const self = compareNicknames(csv, csv);
assert.ok(self.checked > 10 && !self.missing.length && !self.different.length);
console.log(`clickVerify.test: all passed (${all.rungs} example rungs, ${self.checked} nicknames)`);
