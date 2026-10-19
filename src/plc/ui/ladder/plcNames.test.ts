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

useProjectStore.getState().setPlc('logix', getProfile('logix').defaultCpuId);
const lx = lookup()!;
assert.equal(lx('C1')?.name, 'Safety_OK');
assert.equal(lx('T1')?.name, 'Push_Timeout.DN');
assert.equal(lx('SC2')?.name, 'S:FS');

console.log('plcNames tests passed');
