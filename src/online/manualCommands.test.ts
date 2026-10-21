/// <reference types="node" />
/**
 * Manual commands and "Follow this rung" against a Modbus TCP server emulating a CLICK:
 * only the program's HMI command bits are offered, hold-to-run writes ON then OFF in order, a release always
 * goes out (also with writes switched off in between), disconnect releases everything held, every write is
 * logged, the rung view follows the live values, stale when the PLC stops answering.
 * Run with:  npx tsx src/online/manualCommands.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { ModbusBridge } from '../desktop/bridge';
import { LADDER, HMI } from '../preview/sampleProject';
import { followRung, hmiCommands, HoldQueue, isStale } from './manualCommands';
import { rungPowerFromValues } from './power';
import { connectPlc, disconnectPlc, pressCommand, releaseCommand, setCommandBridge, useOnlineStore } from './useOnline';

const require = createRequire(import.meta.url);
const { fakeServer } = require('../../e2e/fake-modbus.cjs');
const { createModbusClient } = require('../../electron/modbus.cjs');
const until = async (cond: () => boolean, ms = 3000) => { for (let t = 0; t < ms && !cond(); t += 20) await new Promise((r) => setTimeout(r, 20)); return cond(); };

// 1. Which bits are commands: the example's momentary HMI buttons the program reads; not the Manual-mode toggle (C1005),
//    not bits the program never reads, never X / Y.
const cmds = hmiCommands(LADDER, HMI);
const addrs = cmds.map((c) => c.address);
for (const a of ['C1001', 'C1002', 'C1003', 'C1004', 'C1006', 'C1007']) assert.ok(addrs.includes(a), `${a} offered`);
assert.ok(!addrs.includes('C1005'), 'Manual-mode toggle is not a hold-to-run command');
assert.ok(addrs.every((a) => /^C\d+$/.test(a)), 'only C bits');
const jog = cmds.find((c) => c.address === 'C1006')!;
assert.equal(jog.interlock, 'C1204');
assert.equal(jog.label, 'Jog Conveyor');
assert.match(jog.usedBy[0], /jog/i);
// A momentary button on a Y output, or on a C bit the program never reads, is not offered.
const extra = { ...HMI, screens: [{ ...HMI.screens[0], elements: [...HMI.screens[0].elements,
  { ...HMI.screens[0].elements[0], id: 'zy', kind: 'button' as const, action: 'momentary' as const, address: 'Y001' },
  { ...HMI.screens[0].elements[0], id: 'zc', kind: 'button' as const, action: 'momentary' as const, address: 'C1999' }] }, ...HMI.screens.slice(1)] };
const extraAddrs = hmiCommands(LADDER, extra).map((c) => c.address);
assert.ok(!extraAddrs.includes('Y001') && !extraAddrs.includes('C1999'));
console.log('ok  commands:', addrs.join(', '));

// 2. Hold queue: a quick press / release writes ON then OFF, never OFF first; a failed ON does not block the OFF.
{
  const log: string[] = [];
  let fail = true;
  const q = new HoldQueue(async (a, v) => { await new Promise((r) => setTimeout(r, v ? 30 : 1)); if (fail && v) { fail = false; throw new Error('x'); } log.push(`${a}=${v}`); });
  void q.press('c1');
  await q.release('C1');
  assert.deepEqual(log, ['C1=false'], 'failed ON, OFF still written');
  void q.press('C2'); void q.press('C2');
  void q.press('C3');
  await q.releaseAll();
  assert.deepEqual(log, ['C1=false', 'C2=true', 'C3=true', 'C2=false', 'C3=false']);
  assert.equal(q.held.size, 0);
  console.log('ok  hold queue order');
}

// 3. Against the fake CLICK.
const srv = fakeServer();
const port: number = await srv.listen();
const bridge = createModbusClient() as ModbusBridge;
setCommandBridge(() => bridge);
useOnlineStore.getState().setSettings({ host: '127.0.0.1', port, timeoutMs: 500, pollMs: 100 });
const C = (n: number) => 16384 + n - 1;
const all = ['X003', 'C1', 'C1006', 'C1204', 'C21', 'Y001', 'Y002', 'X006', 'C1201'];
void connectPlc(all, bridge);
assert.ok(await until(() => useOnlineStore.getState().polls > 0), 'connected and polling');

// Writes off: a press writes nothing (logged as refused).
await pressCommand('C1006');
assert.equal(srv.mem.coils[C(1006)], 0, 'nothing written with writes off');
await releaseCommand('C1006');
assert.ok(useOnlineStore.getState().writes.some((w) => !w.ok && w.address === 'C1006'), 'refused press logged');

useOnlineStore.getState().setAllowWrites(true);
await pressCommand('C1006');
assert.equal(srv.mem.coils[C(1006)], 1, 'held: ON');
assert.deepEqual(useOnlineStore.getState().held, ['C1006']);
// Writes switched off while held: the release still goes out.
useOnlineStore.getState().setAllowWrites(false);
await releaseCommand('C1006');
assert.equal(srv.mem.coils[C(1006)], 0, 'released: OFF even with writes switched off');
assert.deepEqual(useOnlineStore.getState().held, []);
const fcs = srv.state.log.filter((l: { fc: number }) => l.fc === 5).map((l: { address: number; value: boolean }) => `${l.address - 16383}=${l.value}`);
assert.deepEqual(fcs, ['1006=true', '1006=false'], 'exactly ON then OFF on the wire');
const okLog = useOnlineStore.getState().writes.filter((w) => w.ok).map((w) => w.value);
assert.deepEqual(okLog, ['OFF (released)', 'ON (held)'], 'every write logged, newest first');
console.log('ok  hold-to-run ON / OFF on the PLC, logged');

// Disconnect while held: OFF goes out before the connection closes.
useOnlineStore.getState().setAllowWrites(true);
await pressCommand('C1007');
assert.equal(srv.mem.coils[C(1007)], 1);
await disconnectPlc(bridge);
assert.equal(srv.mem.coils[C(1007)], 0, 'disconnect released the held command');
assert.deepEqual(useOnlineStore.getState().held, []);
console.log('ok  disconnect releases held commands');

// 4. Follow this rung: the jog request rung with live values.
srv.mem.coils[C(1006)] = 1; srv.mem.coils[C(1204)] = 0;
void connectPlc(all, bridge);
assert.ok(await until(() => useOnlineStore.getState().bits.get('C1006') === true));
const rung = LADDER.rungs.find((r) => r.id === 'r_jog_req')!;
let st = useOnlineStore.getState();
let rows = followRung(rung, rungPowerFromValues(LADDER, st.bits, st.words).get(rung.id), st.bits, st.words);
assert.deepEqual(rows.map((r) => [r.text, r.value, r.closed, r.powered]), [['NO C1006', 'ON', true, true], ['NO C1204', 'OFF', false, false], ['Coil C21', 'OFF', false, false]]);
srv.mem.coils[C(1204)] = 1; srv.mem.coils[C(21)] = 1;
assert.ok(await until(() => useOnlineStore.getState().bits.get('C1204') === true && useOnlineStore.getState().bits.get('C21') === true));
st = useOnlineStore.getState();
rows = followRung(rung, rungPowerFromValues(LADDER, st.bits, st.words).get(rung.id), st.bits, st.words);
assert.deepEqual(rows.map((r) => r.powered), [true, true, true]);
assert.ok(!rows[2].differs);
// The PLC's C21 OFF while the rung is true (another rung writes it): flagged.
srv.mem.coils[C(21)] = 0;
assert.ok(await until(() => useOnlineStore.getState().bits.get('C21') === false));
st = useOnlineStore.getState();
rows = followRung(rung, rungPowerFromValues(LADDER, st.bits, st.words).get(rung.id), st.bits, st.words);
assert.equal(rows[2].differs, true);
console.log('ok  follow this rung');

// 5. Stale: not connected, or no good read for 3 polls + the timeout.
assert.equal(isStale('connected', Date.now(), Date.now(), 100, 500), false);
assert.equal(isStale('connected', 1000, 1000 + 801, 100, 500), true);
assert.equal(isStale('error', Date.now(), Date.now(), 100, 500), true);
await disconnectPlc(bridge);
st = useOnlineStore.getState();
assert.equal(isStale(st.status, st.lastUpdate, Date.now(), st.settings.pollMs, st.settings.timeoutMs), true);
console.log('ok  stale');

await srv.close();
console.log('manual commands: all passed');
process.exit(0);
