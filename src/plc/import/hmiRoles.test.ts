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

console.log('hmiRoles.test: all passed');
