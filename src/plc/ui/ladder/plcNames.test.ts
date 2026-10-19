/// <reference types="node" />
/**
 * The Program page and the Simulator show the PLC's own names (Dev 3's Siemens walk-through): on the example
 * project switched to Siemens S7, an I/O point is its PLC tag "Name" at %I0.0, internal memory is a member of
 * the program block (#Safety_OK, #Push_Timeout.Q), SC2 is #FirstScan — the names of the exported SCL; on
 * Logix the controller tags (Safety_OK, Push_Timeout.DN, S:FS); on CLICK nothing changes.
 * Run with:  npx tsx src/plc/ui/ladder/plcNames.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../../preview/sampleProject';
import { collectProject } from '../../../deliverables/collect';
import { exportContext } from '../../../deliverables/exportContext';
import { useProjectStore } from '../../../store/useProjectStore';
import { useIOStore } from '../../../store/useIOStore';
import { withIoRemap } from '../../core/ioChange';
import { getProfile } from '../../core/profiles';
import { plcNameLookup } from './plcNames';
import { withPlcNames } from './mnemonics';
import { withPlcNamesAndIo } from '../../core/plcNames';
import { machineSpecText } from '../../../deliverables/machineSpec';
import { tagTable } from '../../../deliverables/docs/program';

seedSampleProject();
const lookup = () => { const p = collectProject(); return plcNameLookup(p.profile, p.ladder, exportContext(p)); };
assert.equal(lookup(), undefined, 'CLICK: the operands as they are');

useProjectStore.getState().setPlc('siemens-s7', getProfile('siemens-s7').defaultCpuId);
const s7 = lookup()!;
const io = collectProject().io, addr = collectProject().addresses;
const estop = addr.get(io.find((p) => /E-Stop OK/i.test(p.description))!.id)!;
assert.deepEqual(s7(estop), { name: '"E_Stop_OK_safety_relay"', io: '%I0.0' }, 'an input: its PLC tag at %I0.0');
assert.equal(s7('C1')?.name, '#Safety_OK', 'internal memory: a member of the program block');
assert.equal(s7('T1')?.name, '#Push_Timeout.Q', 'a timer\'s done bit');
assert.equal(s7('SC2')?.name, '#FirstScan');
assert.equal(s7('C1001')?.name, '#HMI_Start', 'an HMI command, named as the HMI tag');
assert.equal(withPlcNames('DS1001 < 1', s7), '#SP_Pusher_Timeout < 1', 'operands inside a compare');

// The printout / listing lines and the exported spec and tag table use the same names (and the PLC's address).
assert.equal(withPlcNamesAndIo(`Contact NO ${estop} (E-Stop OK)`, s7), 'Contact NO "E_Stop_OK_safety_relay" %I0.0 (E-Stop OK)');
const spec = machineSpecText(collectProject());
assert.match(spec, /\| PLC tag \| PLC address \|/, 'spec.md I/O table: PLC tag and address columns');
assert.match(spec, /"E_Stop_OK_safety_relay" \| %I0\.0/);
assert.ok(!/\| X001 \|/.test(spec), 'no CLICK address in the spec\'s I/O table');
const tt = tagTable(collectProject());
assert.deepEqual(tt.columns.slice(0, 2).map((c) => c.header), ['PLC tag', 'PLC address']);
assert.ok(tt.rows.some((r) => Array.isArray(r) && r[0] === '#Safety_OK'), 'the tag table lists #Safety_OK');

// Main's review: points the program does not use and analog channels have their PLC tag and address too.
useIOStore.getState().importPoints([
  { description: 'Spare sensor', type: 'input', category: 'Spare' },
  { description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 500, units: 'gal' } },
], false);
// On the 1214C's first onboard AI (DF1, %IW64).
useIOStore.getState().setPlcAddress(collectProject().io.find((x) => x.description === 'Tank level')!.id, 'DF1');
const pointAt = (d: string) => { const p = collectProject(); return p.addresses.get(p.io.find((x) => x.description === d)!.id)!; };
const spare = pointAt('Spare sensor'), tank = pointAt('Tank level');
assert.equal(tank, 'DF1');
const s7Spare = lookup()!(spare);
assert.equal(s7Spare?.name, '"Spare_sensor"', 'an unused input: its PLC tag from the tag table');
assert.match(s7Spare?.io ?? '', /^%I\d+\.\d$/, 'with its address');
const s7TankUnused = lookup()!(tank);
assert.equal(s7TankUnused?.io, '%IW64', 'an unused analog input: its input word');
{
  // In use, the program reads the scaled value (#Tank_level); the PLC address is its raw word's.
  const p = collectProject();
  const program = { ...p.ladder, rungs: [...p.ladder.rungs, { id: 'r-tank', comment: '', branches: [[{ type: 'CMP' as const, left: tank, op: '>' as const, right: '450' }]], outputs: [{ type: 'OUT' as const, address: 'C200' }] }] };
  const n = plcNameLookup(p.profile, program, exportContext(p))!(tank);
  assert.equal(n?.name, '#Tank_level', 'the program\'s scaled value');
  assert.equal(n?.io, s7TankUnused?.io, 'at the raw word\'s address');
  const spec = machineSpecText({ ...p, ladder: program });
  assert.match(spec, new RegExp(`"Spare_sensor" \\| ${s7Spare!.io!.replace(/\./g, '\\.')} `), 'spec.md: the unused input has its address');
  assert.match(spec, new RegExp(`#Tank_level \\| ${n!.io} `), 'spec.md: the analog input has its address');
}
{
  // A stale contact on an address no point is on (X001 on an S7-1500 + ET 200SP, inputs from X101) gets no borrowed %I0.0.
  // As the PLC page does it: the program follows its points to X101…
  withIoRemap(() => useProjectStore.setState({ plcId: 'siemens-s7', cpuId: '6ES7511-1AL03-0AB0', modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'] }));
  const p = collectProject();
  assert.ok([...p.addresses.values()].includes('X101') && ![...p.addresses.values()].includes('X001'), 'the 1500 inputs start at X101');
  const program = { ...p.ladder, tags: [...p.ladder.tags, { address: 'X001', nickname: 'Old_Start', comment: '' }], rungs: [...p.ladder.rungs, { id: 'r-stale', comment: '', branches: [[{ type: 'NO' as const, address: 'X001' }]], outputs: [{ type: 'OUT' as const, address: 'C201' }] }] };
  const n = plcNameLookup(p.profile, program, exportContext(p))!;
  assert.equal(n('X101')?.io, '%I0.0', 'the real point is %I0.0');
  assert.equal(n('X001')?.io, undefined, 'the stale contact: no address');
  assert.equal(n('X001')?.name, '"Old_Start"', 'still named by its tag');
  assert.equal(withPlcNamesAndIo('Contact NO X001', n), 'Contact NO "Old_Start"');
}
// The user's own words in a listing line are not renamed ("C1 motor" is a description, not the app's C1).
assert.equal(withPlcNamesAndIo('Output: Y001 (C1 motor)', s7, ['C1 motor']).includes('(C1 motor)'), true);

useProjectStore.getState().setPlc('logix', getProfile('logix').defaultCpuId);
const lx = lookup()!;
assert.equal(lx('C1')?.name, 'Safety_OK');
assert.equal(lx('T1')?.name, 'Push_Timeout.DN');
assert.equal(lx('SC2')?.name, 'S:FS');
const lxSpare = lx(pointAt('Spare sensor'));
assert.equal(lxSpare?.name, 'Spare_sensor', 'Logix: an unused input is its alias tag');
assert.match(lxSpare?.io ?? '', /^Local:/, 'aliased to its module point');

console.log('plcNames tests passed');
