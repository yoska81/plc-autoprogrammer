/// <reference types="node" />
/**
 * What Send to TIA Portal writes into TIA Portal: the CPU with its S7-1200 signal modules in slots 2…, the rest as
 * notes (ET 200SP on an S7-1500); the PLC tags are the .sdf export's, every one; the blocks are the LAD export's for
 * the open TIA Portal's version, in import order, and a compile message's block and network leads back to its rung.
 * Run with:  npx tsx src/plc/tia/tiaSend.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { useProjectStore } from '../../store/useProjectStore';
import { siemensTagsSdf } from '../core/profiles/siemens';
import { buildTiaLad } from '../core/profiles/siemensLad';
import { tiaBlocks, tiaBlockVersion, tiaPlcRequest, tiaProjectName, tiaTagRows } from './tiaSend';

seedSampleProject();
useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
useProjectStore.setState({ modules: ['6ES7221-1BH32-0XB0', '6ES7232-4HB32-0XB0', '6ES7241-1CH32-0XB0'] });
let p = collectProject();

const plc = tiaPlcRequest(p);
assert.equal(plc.orderNumber, '6ES7214-1AG40-0XB0');
assert.deepEqual(plc.modules, [{ orderNumber: '6ES7221-1BH32-0XB0', slot: 2 }, { orderNumber: '6ES7232-4HB32-0XB0', slot: 3 }]);
assert.match(plc.notes.join(' '), /6ES7241-1CH32-0XB0: add it in TIA Portal \(Device view\) by hand/);

const tags = tiaTagRows(p);
assert.ok(tags.length > 5, `${tags.length} tags`);
assert.ok(tags.every((t) => t.name && /^(Bool|Int)$/.test(t.dataType) && /^%[IQM]/.test(t.logicalAddress)), JSON.stringify(tags.slice(0, 3)));
assert.equal(new Set(tags.map((t) => t.name)).size, tags.length, 'no two tags share a name');
// the same tags as the .sdf export, line for line
const sdf = siemensTagsSdf(p.ladder, exportContext(p)).trim().split(/\r?\n/);
assert.equal(sdf.length, tags.length);
for (const t of tags) assert.ok(sdf.some((l) => l.startsWith(`"${t.name}"`) && l.includes(t.logicalAddress)), t.name);
assert.equal(tiaProjectName('Bottle line: 2/B'), 'Bottle_line_2_B');
assert.equal(tiaProjectName('  '), 'Machine');

// the blocks for the open TIA Portal: its own version, the newest for a newer one, none before V16
assert.equal(tiaBlockVersion('V19'), 'V19');
assert.equal(tiaBlockVersion('V18 Update 3'), 'V18');
assert.equal(tiaBlockVersion('21.0'), 'V20');
assert.equal(tiaBlockVersion('V15.1'), null);
const blocks = tiaBlocks(p, 'V19');
const names = blocks.files.map((f) => f.name);
assert.equal(names[0], 'Machine_DB.xml');
assert.equal(names[1], 'Machine_tia_helpers.scl');
assert.equal(names[names.length - 1], 'Main.xml');
assert.deepEqual(new Set(names), new Set(buildTiaLad(p.ladder, exportContext(p), 'Machine', 'V19').files.map((f) => f.name)), 'every file of the export');
assert.ok(blocks.files.every((f) => !f.text.startsWith('\uFEFF')), 'no byte-order mark (the bridge writes its own)');
assert.ok(blocks.files.filter((f) => f.kind === 'xml').every((f) => /<Engineering version="V19"/.test(f.text)), 'V19 SimaticML');
assert.equal(blocks.files.filter((f) => f.kind === 'scl').length, 1);
assert.equal(blocks.rungs, p.ladder.rungs.length);
// network n of an FC is that block's n-th rung
const fcs = names.filter((n) => !/^(Machine_DB|Main)\.xml$|\.scl$/.test(n)).map((n) => n.replace(/\.xml$/, ''));
const firstBlock = p.ladder.rungs[0].block ?? '';
const ofFirst = p.ladder.rungs.flatMap((r, k) => ((r.block ?? '') === firstBlock ? [k + 1] : []));
assert.equal(blocks.rungOf(fcs[0], 1), ofFirst[0]);
assert.equal(blocks.rungOf(fcs[0], ofFirst.length), ofFirst[ofFirst.length - 1]);
assert.equal(blocks.rungOf(fcs[0], ofFirst.length + 1), null);
assert.equal(blocks.rungOf('Main', 1), null);
assert.equal(blocks.rungOf(fcs[0], null), null);
if (fcs.length > 1) {
  const second = p.ladder.rungs.findIndex((r) => (r.block ?? '') !== firstBlock);
  assert.ok(second >= 0 && blocks.rungOf(fcs[1], 1) !== null, 'the second block\'s first rung');
}

// S7-1500: the I/O is on ET 200SP, added in TIA Portal by hand for now
useProjectStore.getState().setPlc('siemens-s7', '6ES7511-1AL03-0AB0');
useProjectStore.setState({ modules: ['6ES7131-6BH01-0BA0'] });
p = collectProject();
const big = tiaPlcRequest(p);
assert.deepEqual(big.modules, []);
assert.match(big.notes[0], /ET 200SP I\/O is added in TIA Portal by hand/);
console.log('tiaSend.test: all passed');
