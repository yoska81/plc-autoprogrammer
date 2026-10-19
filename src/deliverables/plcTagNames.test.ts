/// <reference types="node" />
/**
 * The PLC's I/O names in the HMI tag list (_hmi_tags.csv) and on the HMI page come only for the project's real I/O
 * points: on an S7-1500 + ET 200SP (inputs from X101) a stale HMI tag on X001 must not read %I0.0, which is X101's.
 *   npx tsx src/deliverables/plcTagNames.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from './collect';
import { plcTagNameOf } from './plcTagNames';
import { hmiTagRows } from './hmiTags';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
useProjectStore.setState({ plcId: 'siemens-s7', cpuId: '6ES7511-1AL03-0AB0', modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'] });
const d = useHmiStore.getState().design!;
useHmiStore.getState().setDesign({ ...d, tags: [...d.tags, { name: 'Old_Start', address: 'X001', dataType: 'BIT', access: 'read', description: 'left from the CLICK design' }] }, null);
const p = collectProject();
assert.ok([...p.addresses.values()].includes('X101') && ![...p.addresses.values()].includes('X001'), 'the 1500 inputs start at X101');
const of = plcTagNameOf(p);
assert.equal(of('X101').io, '%I0.0', 'a real point: its S7 address');
assert.equal(of('X001').io, undefined, 'a stale address: no borrowed %I0.0');
const rows = hmiTagRows(p);
assert.equal(rows.find((r) => r.name === 'Old_Start')?.plcIo, '', 'the CSV row of the stale tag has no I/O address');
assert.ok(!rows.some((r) => r.address !== 'X101' && r.plcIo === '%I0.0'), 'only X101 is %I0.0');
console.log('PLC tag names: only real I/O points get an I/O address');
