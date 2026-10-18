/// <reference types="node" />
/**
 * "Load into PLC" guide and the CLICK rung entry sheet. Run with:  npx tsx src/plc/deploy/loadGuide.test.ts
 */
import assert from 'node:assert/strict';
import { loadGuide, type LoadGuideInput } from './loadGuide';
import { clickEntryBlocks, clickEntrySheetHtml, clickEntryText } from '../core/clickEntrySheet';
import { clickRungListing } from '../core/clickExport';
import type { LadderProgram } from '../core/ladder';

const base = (profileId: string, files: string[], extra: Partial<LoadGuideInput> = {}): LoadGuideInput => ({
  profileId, profileName: 'P', vendor: 'V', cpuId: 'C0-11DD2E-D', modules: ['C0-16ND3', 'C0-08TD1'], fileBase: 'Sealing_Head', files, errors: 0, ...extra,
});

// CLICK: install → hardware → nicknames → rungs → network → write + RUN → Online; every step's files exist.
const clickFiles = ['Sealing_Head_CLICK_entry_sheet.html', 'Sealing_Head_rungs.txt', 'Sealing_Head_nicknames.csv', 'Sealing_Head_program.json'];
const click = loadGuide(base('click', clickFiles));
assert.deepEqual(click.map((s) => s.title), [
  'Install CLICK Programming Software (free)', 'New project with this hardware', 'Import the nicknames', 'Type in the rungs',
  "Connect the PC to the PLC's network", 'Write the project into the PLC and switch to RUN', 'Check it in this app (Online)',
]);
for (const s of click) for (const f of s.files ?? []) assert.ok(clickFiles.includes(f), `${s.title}: ${f} is in the package`);
assert.deepEqual(click[2].files, ['Sealing_Head_nicknames.csv']);
assert.deepEqual(click[3].files, ['Sealing_Head_CLICK_entry_sheet.html', 'Sealing_Head_rungs.txt']);
assert.ok(click[1].text.join(' ').includes('• CPU C0-11DD2E-D') && click[1].text.includes('• slot 2: C0-08TD1'), 'hardware in slot order');
assert.match(click[4].text.join(' '), /192\.168\.0\.10, subnet mask 255\.255\.0\.0/);
assert.match(click[5].text.join(' '), /PLC > Write Project into PLC/);
assert.ok(click[6].online && click[0].link?.url.startsWith('https://www.automationdirect.com/'));
assert.match(loadGuide(base('click', clickFiles, { errors: 2 }))[3].text.join(' '), /checker finds 2 errors/);
// Other brands: their import path and their files.
assert.deepEqual(loadGuide(base('logix', ['M.L5X', 'M_logix_io.csv', 'M_program.json'])).flatMap((s) => s.files ?? []), ['M.L5X', 'M_logix_io.csv']);
assert.match(loadGuide(base('siemens-s7', ['M_s7.scl', 'M_PLCTags.sdf']))[0].text[0], /Generate blocks from source/);
assert.match(loadGuide(base('micro800', ['M_micro800.st', 'M_micro800_variables.csv']))[0].text[0], /paste the \.st file/);
const uni = loadGuide(base('unitronics-unistream', ['M_unilogic.st', 'M_unilogic_io_links.csv', 'M_program.json'], { importSteps: ['Import ST Code From File …', 'Call Machine_Logic …'] }));
assert.deepEqual(uni.map((s) => s.text[0]), ['Import ST Code From File …', 'Call Machine_Logic …']);
assert.deepEqual(uni[0].files, ['M_unilogic.st', 'M_unilogic_io_links.csv']);
console.log('  ok load guide per brand');

// Entry sheet: block by block, real rung numbers, row / column, every dialog field.
const program: LadderProgram = {
  blocks: [{ id: 'b1', name: 'Safety & modes', description: 'Seal-in' }, { id: 'b2', name: 'Cycle', description: '' }],
  tags: [{ address: 'DS1', nickname: 'Seal_Time', comment: 'ms' }],
  rungs: [
    { id: 'r1', block: 'b1', comment: 'Seal-in', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'X002' }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r2', block: 'b2', comment: 'Seal time', branches: [[{ type: 'NO', address: 'C1' }, { type: 'CMP', left: 'DS1150', op: '==', right: '30' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1', unit: 'ms', accumulate: false, resetAddress: null }] },
    { id: 'r3', block: 'b1', comment: 'Cycle count', branches: [[{ type: 'RISE', address: 'T1' }]], outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '9999', resetAddress: 'C1003' }, { type: 'COPY', source: '0', dest: 'DS2' }] },
  ],
};
const labels = new Map([['X001', 'Start PB'], ['C1', 'Run'], ['DS1', 'Seal time']]);
const blocks = clickEntryBlocks(program, labels);
assert.deepEqual(blocks.map((b) => `${b.name}:${b.rungs.map((r) => r.number).join(',')}`), ['Safety & modes:1,3', 'Cycle:2'], 'blocks in order, real rung numbers');
const txt = clickEntryText(program, labels, 'Sealing Head');
for (const s of [
  '[ ] Rung 1 — Seal-in',
  'Row 1: col 1 NO contact (normally open) [Address: X001 (Start PB)]  →  col 2 NC contact (normally closed) [Address: X002]',
  'Row 2 (parallel): col 1 NO contact (normally open) [Address: C1 (Run)]',
  'Output 1: Out coil [Address: C1 (Run)]',
  'col 2 Compare contact [Value A: DS1150 · Operator: = (equal) · Value B: 30]',
  'Output 1: Timer [Timer number: T1 · Type: On-delay · Setpoint: DS1 (Seal time) · Unit: msec · Current value: reset when the input goes OFF]',
  'col 1 Edge contact — Rising [Address: T1]',
  'Output 1: Counter [Counter number: CT1 · Count: Up · Setpoint: 9999]',
  'Reset input (second input line of the Counter box): NO contact C1003',
  'Output 2 (stacked below): Copy — Single copy [Source: 0 · Destination: DS2]',
  '[ ] Rung 4 — END instruction',
]) assert.ok(txt.includes(s), `entry text missing: ${s}\n${txt}`);
assert.ok(clickRungListing(program, labels, 'Sealing Head').startsWith(txt.trimEnd()), 'the rung listing is the entry text');
const html = clickEntrySheetHtml(program, labels, 'Sealing Head', ['CPU C0-11DD2E-D']);
assert.equal((html.match(/type="checkbox"/g) ?? []).length, 4, 'one box per rung + END');
assert.ok(html.includes('<th>Column 2</th>') && html.includes('Row 2<br><small>parallel</small>') && html.includes('Hardware in the project (in this order): CPU C0-11DD2E-D'));
assert.ok(!/<script/i.test(html) && html.includes('&amp; modes'), 'escaped, no script');
console.log('loadGuide tests passed');
