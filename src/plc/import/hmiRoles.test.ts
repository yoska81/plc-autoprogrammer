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
import { programRoles, type Role } from './hmiRoles';

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

console.log('hmiRoles.test: all passed');
