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
import { inPlcNames, openPlcChanges, plcChangesFor, programUse, type UpgradeRoles } from './upgradeHmi';
import { defaultHmiContent } from './content';
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
  alarms: [{ address: 'C20', nickname: 'Safety_Fault', why: 'latched', text: 'Safety fault' }, { address: 'C30', nickname: 'Alm_Jam', why: 'a fault bit', text: 'Infeed jam' }],
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
// The program's own alarms are on the alarm list once, with their texts.
assert.equal(d.alarms.filter((a) => a.address === 'C20').length, 1);
assert.equal(d.alarms.find((a) => a.address === 'C30')?.message, 'Infeed jam');
assert.equal(d.tags.find((t) => t.address === 'C30')?.role, 'alarm:program:C30');
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

// A counter preset fixed in the rung: the HMI batch setpoint replaces the constant.
const batch = await generateRuleBasedHmi({ io: p0.io, addresses: p0.addresses, machineName: 'Capper', spec: '', panel: { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 }, now: 'T', program: imported });
const withCount = { ...batch.design, tags: [...batch.design.tags, { role: 'sp:batch', address: 'DS1199', name: 'SP_Batch', dataType: 'INT' as const, access: 'read-write' as const, description: 'Batch size.' }] };
const constChange = plcChangesFor(withCount, imported, { tags: [], constPresets: [{ address: 'CT1', nickname: 'Bottle_Count', preset: '500' }] }).find((c) => c.address === 'DS1199');
assert.match(constChange!.change, /preset of Bottle_Count \(CT1\) instead of the fixed 500/);

// The HMI Stop counts as wired in only as a normally-closed contact in the run latch, not on any read.
const stopTag = byRole('cmd:stop')!;
const readOnly: LadderProgram = structuredClone(done);
readOnly.rungs.push(rung('lamp', [[{ type: 'NO', address: stopTag.address }]], [{ type: 'OUT', address: 'C40' }]));
assert.ok(openPlcChanges(d, readOnly).some((c) => c.address === stopTag.address), 'a plain read of the HMI Stop is not the change');
const wired: LadderProgram = structuredClone(done);
for (const b of wired.rungs[0].branches) b.push({ type: 'NC', address: stopTag.address });
assert.ok(!openPlcChanges(d, wired).some((c) => c.address === stopTag.address), 'NC in the run latch is the change');

// The program's own alarm on the same input is used, not a second HMI alarm: its rung reads the safety input.
assert.equal(byRole('alarm:safety')?.address, 'C20');
assert.equal(d.alarms.filter((a) => /Safety circuit open/.test(a.message)).length, 0, 'no second safety alarm');
assert.equal(d.alarms.find((a) => a.address === 'C20')?.message, 'Safety fault', "the program's text");

// A word cleared with MOV / COPY clears its bits: "Alm[0].3" of "Alm[0]".
const words: LadderProgram = { tags: [{ address: 'DS4', nickname: 'Alm[0]', comment: '' }, { address: 'C8', nickname: 'Alm[0].0', comment: '' }, { address: 'C9', nickname: 'Other', comment: '' }],
  rungs: [rung('clr', [[{ type: 'NO', address: 'X1' }]], [{ type: 'COPY', source: '0', dest: 'DS4' }])] };
const use = programUse(words);
assert.ok(use.resets.has('C8') && !use.resets.has('C9'));

// Change texts in the PLC's own names: Logix tags, TIA DB members and %I inputs; unknown stays as it is.
const logix = (a: string) => ({ C1001: { name: 'HMI_Start' }, X102: { name: 'Start_PB', io: 'Local:1:I.Pt01.Data' }, C1003: { name: 'HMI_Manual_Select' } } as Record<string, { name: string; io?: string }>)[a] ?? { name: '' };
assert.equal(inPlcNames('Add HMI_Start (C1001) in parallel with Start_PB (X102); needs C1003 ON.', logix), 'Add HMI_Start in parallel with Start_PB; needs HMI_Manual_Select ON.');
const tia = (a: string) => ({ C1001: { name: '"Machine_DB".HMI_Start' }, X001: { name: '"Machine_DB".Start_PB', io: '%I0.0' } } as Record<string, { name: string; io?: string }>)[a] ?? { name: '' };
assert.equal(inPlcNames('Add HMI_Start (C1001) in parallel with Start_PB (X001), Y9 (Y009).', tia), 'Add "Machine_DB".HMI_Start in parallel with Start_PB (%I0.0), Y9 (Y009).');

// A counter is named as the counter, not its done bit (Logix .DN, TIA .Q); its value word keeps its member.
const counters = (a: string) => ({ CT3: { name: 'Pallet_Count.DN' }, CTD3: { name: 'Pallet_Count.ACC' }, CT1: { name: '"Machine_DB".C_Batch.Q' } } as Record<string, { name: string; io?: string }>)[a] ?? { name: '' };
assert.equal(inPlcNames('Momentary: resets the part counter CT3; preset of Pallet_Count (CT3); value CTD3; TIA CT1.', counters),
  'Momentary: resets the part counter Pallet_Count; preset of Pallet_Count; value Pallet_Count.ACC; TIA "Machine_DB".C_Batch.');

// An "… OK" input whose note names an over-temperature: ON is healthy, so the alarm is OFF and says "tripped".
const ok = defaultHmiContent({
  io: [{ id: 'e', description: 'Emergency stop OK (safety relay)', type: 'input', category: 'Safety' }, { id: 'a', description: 'Heater safety thermostat TSH102 OK (opens on over-temperature)', type: 'input', category: 'Analog/Process' }],
  addresses: new Map([['e', 'X001'], ['a', 'X010']]), machineName: 'M',
});
const okAlarm = ok.alarmInputs?.find((a) => a.point.address === 'X010');
assert.deepEqual([okAlarm?.text, okAlarm?.activeWhen], ['Heater safety thermostat TSH102 tripped', false]);

console.log(`upgrade HMI: ${changes.length} PLC changes listed once; roles bound to C1 / C20 / C21; Start/Stop beside the wired buttons`);
