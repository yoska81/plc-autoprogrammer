/// <reference types="node" />
/**
 * Panel roles of an imported program: the program's own addresses for start / stop / reset / running / faults /
 * counters / setpoints, and what a panel would need that the program does not have.
 * Run with:  npx tsx src/plc/import/hmiRoles.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { panelTags, programRoles, type Role } from './hmiRoles';

const here = dirname(fileURLToPath(import.meta.url));
const roles = (...names: string[]) => programRoles(planUpgrade(importProgramFiles(names.map((n) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(here, '__fixtures__', n)))) }))).program, 'click').program);
const nicks = (xs: Role[]) => xs.map((x) => x.nickname);

{
  const r = roles('capper.L5X');
  assert.deepEqual([nicks(r.start), nicks(r.stop), nicks(r.estop), nicks(r.running), nicks(r.faults)], [['Start_PB'], ['Stop_PB'], ['EStop_OK'], ['Machine_Running'], ['Fault_Latch']]);
  assert.deepEqual(nicks(r.reset), ['Reset_PB_HMI'], 'a bit the old panel wrote is the panel Reset');
  assert.match(r.reset[0].why, /never sets .* the panel writes it/);
  assert.deepEqual(nicks(r.counters), ['Bottle_Count']);
  assert.deepEqual(nicks(r.setpoints), ['Capper.Torque_SP']);
  assert.ok(r.missing.some((m) => /Start_PB \(a physical input\)\. A panel button needs its own PLC bit wired in parallel/.test(m)));
}
{
  const r = roles('Mixer.scl', 'PLC_Tags_Mixer.csv');
  assert.deepEqual([nicks(r.start), nicks(r.stop)], [['Start'], ['Stop']], 'the FB inputs "from the HMI" are the panel buttons');
  assert.ok(!r.missing.some((m) => /parallel/.test(m)), 'no PLC change needed for start / stop');
  assert.ok(r.missing.some((m) => /No fault or alarm bits/.test(m)));
}
{
  const r = roles('CAPPER_MAIN.csv', 'CAPPER_DeviceComment.csv');
  assert.deepEqual(nicks(r.reset), ['Reset_PB']);
  assert.deepEqual(nicks(r.counters), ['Reject_Count', 'Good_Count']);
  assert.deepEqual(nicks(r.setpoints), ['Batch_Size']);
  assert.ok(r.faults.length >= 1);
}

// The panel builder's tags (Dev 5's build.ts roles).
{
  const capper = panelTags(roles('capper.L5X'));
  const by = (t: { role: string; name: string; address: string; access: string }) => `${t.role}=${t.name}@${t.access}`;
  assert.deepEqual(capper.tags.map(by).filter((x) => !x.startsWith('word:count') && !x.startsWith('sp:batch')), ['cmd:reset=Reset_PB_HMI@read-write', 'sts:running=Machine_Running@read']);
  assert.deepEqual(capper.parallelTo.map((p) => `${p.role}=${p.nickname}`), ['cmd:start=Start_PB', 'cmd:stop=Stop_PB'], 'physical inputs: a parallel panel bit, never written');
  assert.ok(!capper.tags.some((t) => /^X/.test(t.address) && t.access !== 'read'), 'no input is ever written');
  assert.ok(!capper.tags.some((t) => t.role === 'alarm:safety'), 'EStop_OK (ON = OK) is not an alarm bit');
  const count = capper.tags.find((t) => t.role === 'word:count')!;
  assert.match(count.address, /^CTD\d+$/);
  assert.equal(count.dataType, 'INT2');
  const mixer = panelTags(roles('Mixer.scl', 'PLC_Tags_Mixer.csv'));
  assert.deepEqual(mixer.tags.map((t) => t.role), ['cmd:start', 'cmd:stop'], 'the old panel bits are written directly');
  assert.deepEqual(mixer.parallelTo, []);
  const gx = panelTags(roles('CAPPER_MAIN.csv', 'CAPPER_DeviceComment.csv'));
  assert.deepEqual(gx.tags.filter((t) => t.role === 'word:count' || t.role === 'sp:batch').map((t) => `${t.role}=${t.name}@${t.address}`), ['word:count=Good_Count@CTD2', 'sp:batch=Batch_Size@DS1'], 'the production count, not the reject counter');
  assert.deepEqual(gx.parallelTo.map((p) => p.role), ['cmd:start', 'cmd:stop', 'cmd:reset']);
}

// ── Review: the real fixtures (fixtures/import) ──
{
  const real = (dir: string, ...names: string[]) => programRoles(planUpgrade(importProgramFiles(names.map((n) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(here, '..', '..', '..', 'fixtures', 'import', dir, n)))) }))).program, 'click').program);
  const pal = real('ab-palletizer-01', 'Palletizer_PL01.L5X');
  assert.deepEqual(nicks(pal.stop), ['Stop_PB'], 'a prox at the case stop is not a Stop button; E_Stop_OK is the e-stop');
  assert.deepEqual(nicks(pal.estop), ['E_Stop_OK']);
  for (const n of ['Infeed_Case_PE', 'Infeed_OL_OK', 'Light_Red', 'Horn']) assert.ok(!nicks(pal.faults).includes(n), `${n} is not a fault bit`);
  assert.ok(nicks(pal.faults).includes('Fault_Latched'));
  assert.equal(panelTags(pal).tags.find((t) => t.role === 'word:count')?.name, 'Pallet_Count', 'the top of the counter chain, not Case_Ctr');
  const mix = real('siemens-mixer-01', 'MixTank_MT01.xml');
  for (const n of ['Agitator_OL_OK', 'Lamp_Fault']) assert.ok(!nicks(mix.faults).includes(n), `${n} is not a fault bit`);
  for (const n of ['Level_Pct', 'Temp_C']) assert.ok(!nicks(mix.setpoints).includes(n), `${n} is measured (written in the kept code), not a setpoint`);
  assert.ok(nicks(mix.setpoints).includes('SP_Temp'));
  assert.deepEqual(mix.alarms.slice(0, 2).map((a) => `${a.nickname}: ${a.text}`), ['Alm_EStop: Emergency stop', 'Alm_AgitOverload: Agitator motor overload'], 'the alarm bits with their own text');
  const cap = real('mitsubishi-capper-01', 'CAPPER_MAIN.csv', 'CAPPER_DeviceComment.csv');
  assert.ok(cap.alarms.length >= 5 && cap.alarms.every((a) => !/^Original:/.test(a.text)), cap.alarms.map((a) => a.text).join(' | '));
  assert.equal(cap.alarms[0].text, 'Emergency stop');
}

// Array alarm bits with no comment of their own (Alm[0].3) take the comment of the rung that sets them.
{
  const f = join(here, '..', '..', '..', 'fixtures', 'import', 'ab-palletizer-01', 'Palletizer_PL01.L5X');
  const pal = programRoles(planUpgrade(importProgramFiles([{ name: 'Palletizer_PL01.L5X', text: fileText('Palletizer_PL01.L5X', new Uint8Array(readFileSync(f))) }]).program, 'click').program);
  const text = (n: string) => pal.alarms.find((a) => a.nickname === n)?.text;
  assert.equal(text('Alm[0].0'), 'E-stop');
  assert.equal(text('Alm[0].3'), 'Infeed overload');
  assert.equal(text('Alm[0].8'), 'Elevator raise timeout');
  assert.ok(pal.alarms.every((a) => !/^Alm\[|^Alarm \d+:/.test(a.text)), pal.alarms.map((a) => a.text).join(' | '));
}

// A rung that writes two fault bits gives its comment to neither (each keeps its own name).
{
  const prog = { tags: [{ address: 'C1', nickname: 'Overload_1_Alarm', comment: '' }, { address: 'C2', nickname: 'Overload_2_Alarm', comment: '' }], rungs: [
    { id: 'r1', comment: 'Alarms section: overloads', branches: [[{ type: 'NO' as const, address: 'X001' }]], outputs: [{ type: 'SET' as const, address: 'C1' }, { type: 'SET' as const, address: 'C2' }] },
  ] };
  const r = programRoles(prog as never);
  assert.equal(r.alarms.length, 2, 'both bits are alarms');
  assert.ok(r.alarms.every((a) => a.text !== 'Alarms section: overloads'), r.alarms.map((a) => a.text).join(' | '));
}

// One fault bit with its fault lamp, or the same bit as OUT and SET: still one fault bit, the rung's comment is its text.
{
  const prog = { tags: [{ address: 'C1', nickname: 'Overload_Alarm', comment: '' }, { address: 'C2', nickname: 'Fault_Lamp', comment: '' }], rungs: [
    { id: 'r1', comment: 'Infeed motor overload', branches: [[{ type: 'NO' as const, address: 'X001' }]], outputs: [{ type: 'SET' as const, address: 'C1' }, { type: 'OUT' as const, address: 'C2' }, { type: 'OUT' as const, address: 'C1' }] },
  ] };
  const r = programRoles(prog as never);
  assert.equal(r.alarms.find((x) => x.address === 'C1')?.text, 'Infeed motor overload', r.alarms.map((x) => `${x.address}=${x.text}`).join(' | '));
}

console.log('hmiRoles.test: all passed');
