/// <reference types="node" />
/**
 * What Send to TIA Portal writes into TIA Portal: the CPU with its S7-1200 signal modules in slots 2…, the rest as
 * notes (ET 200SP on an S7-1500); the PLC tags are the .sdf export's, every one.
 * Run with:  npx tsx src/plc/tia/tiaSend.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { useProjectStore } from '../../store/useProjectStore';
import { siemensTagsSdf } from '../core/profiles/siemens';
import { tiaPlcRequest, tiaProjectName, tiaTagRows } from './tiaSend';

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

// S7-1500: the I/O is on ET 200SP, added in TIA Portal by hand for now
useProjectStore.getState().setPlc('siemens-s7', '6ES7511-1AL03-0AB0');
useProjectStore.setState({ modules: ['6ES7131-6BH01-0BA0'] });
p = collectProject();
const big = tiaPlcRequest(p);
assert.deepEqual(big.modules, []);
assert.match(big.notes[0], /ET 200SP I\/O is added in TIA Portal by hand/);
console.log('tiaSend.test: all passed');
