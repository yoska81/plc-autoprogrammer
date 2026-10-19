/// <reference types="node" />
/**
 * The I/O list CSV: the program address of every point, and for a PLC with its own address format
 * (Siemens %I0.0 …) that address too, as the I/O list page shows it. CLICK files are unchanged.
 * Run with:  npx tsx src/deliverables/ioCsv.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from './collect';
import { ioCsv } from './files';
import { useProjectStore } from '../store/useProjectStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const cells = (line: string) => line.split(',').map((c) => c.replace(/^"|"$/g, ''));

seedSampleProject();
const click = ioCsv(collectProject()).split('\r\n');
assert.equal(click[0], 'ID,PLC Address,Type,Category,Description', 'CLICK: the header is unchanged');
assert.ok(cells(click[1])[1].match(/^[XY]\d{3}$/), `CLICK: the address as CLICK shows it (${click[1]})`);

useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
const p = collectProject();
const rows = ioCsv(p).split('\r\n');
assert.equal(rows[0], 'ID,PLC Address,Siemens Address,Type,Category,Description', 'Siemens: a Siemens Address column next to the program address');
assert.equal(rows.length, p.io.length + 1);
for (const r of rows.slice(1)) {
  const [id, program, native, type] = cells(r);
  if (!program) continue;
  assert.match(native, type === 'input' ? /^%I\d+\.\d$/ : /^%Q\d+\.\d$/, `${id}: ${program} → ${native}`);
}
// the same address the I/O list page shows (the profile's own mapping)
const first = p.io.find((x) => p.addresses.get(x.id))!;
assert.equal(cells(rows.find((r) => r.startsWith(`"${first.id}"`))!)[2], p.profile.ioTag!(p.addresses.get(first.id)!, [], p.cpu.id));
console.log(`io csv tests passed (${rows.length - 1} points)`);
