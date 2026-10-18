/// <reference types="node" />
/**
 * HMI for an upgraded (imported) program: the screens use the program's own addresses for the roles it
 * has; a wired Start / Stop gets an HMI bit added beside it; what the program lacks is one list of PLC
 * changes, shown once on the review page (not a major per tag), and it shrinks as the program gets them.
 * Run with:  npx tsx src/hmi/engine/upgradeHmi.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { checksFor } from '../../review/actions';
import { useProgramStore } from '../../store/useProgramStore';
import { useHmiStore } from '../../store/useHmiStore';
import { generateRuleBasedHmi } from '../../lib/ai/hmiContentAI';
import { openPlcChanges, type UpgradeRoles } from './upgradeHmi';
import type { LadderProgram, Rung } from '../../plc/core/ladder';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
const p0 = collectProject();
const addr = (re: RegExp) => p0.addresses.get(p0.io.find((x) => re.test(x.description))!.id)!;
const [safety, start, stop, motor] = [addr(/E-Stop/i), addr(/^Start/i), addr(/^Stop/i), addr(/Conveyor motor/i)];

// The imported program: a sealed run coil from the wired buttons, a motor overload alarm, a part counter.
const rung = (id: string, branches: Rung['branches'], outputs: Rung['outputs']): Rung => ({ id, comment: id, branches, outputs });
const imported: LadderProgram = {
  tags: [],
  rungs: [
    rung('run', [[{ type: 'NO', address: start }, { type: 'NC', address: stop }, { type: 'NO', address: safety }], [{ type: 'NO', address: 'C1' }, { type: 'NC', address: stop }, { type: 'NO', address: safety }]], [{ type: 'OUT', address: 'C1' }]),
    rung('motor', [[{ type: 'NO', address: 'C1' }]], [{ type: 'OUT', address: motor }]),
    rung('fault', [[{ type: 'NC', address: safety }]], [{ type: 'SET', address: 'C20' }]),
    rung('clear', [[{ type: 'NO', address: 'C21' }]], [{ type: 'RST', address: 'C20' }]),
  ],
};
const roles: UpgradeRoles = {
  tags: [
    { role: 'sts:running', address: 'C1', name: 'Running', dataType: 'BIT', access: 'read', description: 'Run seal coil.' },
    { role: 'alarm:safety', address: 'C20', name: 'Safety_Fault', dataType: 'BIT', access: 'read', description: 'Latched when the safety circuit opens.' },
    { role: 'cmd:reset', address: 'C21', name: 'Fault_Reset', dataType: 'BIT', access: 'write', description: 'Clears the safety fault.' },
  ],
  parallelTo: [{ role: 'cmd:start', address: start, nickname: 'Start_PB' }, { role: 'cmd:stop', address: stop, nickname: 'Stop_PB' }],
  missing: ['No machine-state word: the HMI header shows the state from a new register (listed in the PLC changes).'],
};

useProgramStore.setState({ ladder: imported });
const r = await generateRuleBasedHmi({
  io: p0.io, addresses: p0.addresses, machineName: 'Capper', spec: '', panel: { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 }, now: 'T',
  program: imported, upgradeRoles: roles,
});
const d = r.design;
const byRole = (role: string) => d.tags.find((t) => t.role === role);

// The program's own addresses are used for the roles it has.
assert.equal(byRole('sts:running')?.address, 'C1');
assert.equal(byRole('alarm:safety')?.address, 'C20');
assert.equal(byRole('cmd:reset')?.address, 'C21');
assert.equal(byRole('cmd:reset')?.name, 'Fault_Reset');
// None of those is a change; a wired Start / Stop gets its own bit, added beside the button.
const changes = d.plcChanges ?? [];
assert.ok(!changes.some((c) => ['C1', 'C20', 'C21'].includes(c.address)), JSON.stringify(changes.slice(0, 3)));
const startTag = byRole('cmd:start')!;
assert.match(changes.find((c) => c.address === startTag.address)!.change, new RegExp(`in parallel with Start_PB \\(${start}\\)`));
assert.match(changes.find((c) => c.address === byRole('cmd:stop')!.address)!.change, /normally-closed contact .* in series with Stop_PB/);
assert.ok(d.notes.some((n) => /need a change in the PLC program/.test(n)));
assert.ok(d.notes.includes(roles.missing![0]));

// Review: one finding with the list, no finding per tag.
useHmiStore.getState().setDesign(d, null);
let found = checksFor(collectProject());
const hmiIds = found.filter((f) => f.area === 'hmi').map((f) => f.id);
assert.ok(hmiIds.includes('hmi-plc-changes'), hmiIds.join(', '));
assert.deepEqual(hmiIds.filter((id) => /^(hmi-unwritten|hmi-unused|alm-unset|alm-noreset|hmi-interlock):/.test(id)), []);
const one = found.find((f) => f.id === 'hmi-plc-changes')!;
assert.match(one.title, new RegExp(`needs ${changes.length} change`));
assert.match(one.detail, /in parallel with Start_PB/);

// The user adds the HMI Start in parallel: that change leaves the list.
const done: LadderProgram = structuredClone(imported);
done.rungs[0].branches.push([{ type: 'NO', address: startTag.address }, { type: 'NC', address: stop }, { type: 'NO', address: safety }]);
useProgramStore.setState({ ladder: done });
assert.equal(openPlcChanges(d, done).length, changes.length - 1);
found = checksFor(collectProject());
assert.match(found.find((f) => f.id === 'hmi-plc-changes')!.title, new RegExp(`needs ${changes.length - 1} change`));

// Without upgrade roles nothing changes: no list, the usual per-tag checks.
const plain = await generateRuleBasedHmi({ io: p0.io, addresses: p0.addresses, machineName: 'Capper', spec: '', panel: { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 }, now: 'T', program: imported });
assert.equal(plain.design.plcChanges, undefined);
assert.equal(plain.design.tags.find((t) => t.role === 'sts:running')?.address.startsWith('C12'), true);

console.log(`upgrade HMI: ${changes.length} PLC changes listed once; roles bound to C1 / C20 / C21; Start/Stop beside the wired buttons`);
