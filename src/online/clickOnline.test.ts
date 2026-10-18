/// <reference types="node" />
/**
 * Online end to end against a Modbus TCP server emulating a CLICK (values at the CLICK Modbus map:
 * X / Y / C / T / CT / SC bits, DS / DF / TD registers), through the desktop app's Modbus client
 * (electron/modbus.cjs) and the Online store: Test connection (RUN / STOP / error, refused, no answer),
 * connect and poll, Set ON / OFF and Write (C, DS; never X / Y), Program check.
 * Run with:  npx tsx src/online/clickOnline.test.ts
 */
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
import type { ModbusBridge } from '../desktop/bridge';
import type { LadderProgram } from '../plc/core/ladder';
import { clickModbus } from './clickModbus';
import { connectPlc, disconnectPlc, useOnlineStore, writePlc } from './useOnline';
import { firstScanRanges, programCheck, testConnection } from './programCheck';

const require = createRequire(import.meta.url);
const { fakeServer } = require('../../e2e/fake-modbus.cjs');
const { createModbusClient } = require('../../electron/modbus.cjs');

/** A CLICK on the fake server: set any CLICK address; floats are written low word first (the app's default). */
function clickEmulator(srv: { mem: { coils: Uint8Array; discrete: Uint8Array; holding: Uint16Array; input: Uint16Array } }) {
  return {
    set(a: string, v: boolean | number) {
      const r = clickModbus(a)!;
      if (r.table === 'coil') srv.mem.coils[r.register] = v ? 1 : 0;
      else if (r.table === 'discrete') srv.mem.discrete[r.register] = v ? 1 : 0;
      else if (r.type === 'float') { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, Number(v)); srv.mem.holding[r.register] = b.getUint16(2); srv.mem.holding[r.register + 1] = b.getUint16(0); }
      else srv.mem.holding[r.register] = (Number(v) + 0x10000) & 0xffff;
    },
    get(a: string) { const r = clickModbus(a)!; return r.table === 'coil' ? Boolean(srv.mem.coils[r.register]) : srv.mem.holding[r.register]; },
  };
}
const until = async (cond: () => boolean, ms = 3000) => { for (let t = 0; t < ms && !cond(); t += 20) await new Promise((r) => setTimeout(r, 20)); return cond(); };

const srv = fakeServer();
const plc = clickEmulator(srv);
const port: number = await srv.listen();
const bridge = createModbusClient() as ModbusBridge;
const settings = { host: '127.0.0.1', port, unitId: 1, timeoutMs: 500 };

// ---- Test connection
plc.set('SC1', true); plc.set('SC10', true); plc.set('SC11', true);
let lines = await testConnection(bridge, settings, false, 'C0-11DD2E-D');
assert.deepEqual(lines.map((l) => l.ok), [true, true, true, null], lines.map((l) => l.text).join('\n'));
assert.match(lines[1].text, /in RUN \(SC11/);
assert.match(lines[3].text, /label on the CPU says C0-11DD2E-D/);
plc.set('SC11', false); plc.set('SC10', false); plc.set('SC19', true);
lines = await testConnection(bridge, settings, false, 'C0-11DD2E-D');
assert.match(lines[1].text, /in STOP .* put it in RUN/);
assert.equal(lines[1].ok, false);
assert.match(lines[2].text, /reports an error \(SC19/);
plc.set('SC11', true); plc.set('SC10', true); plc.set('SC19', false);
const closed: number = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => r(p)); }); });
lines = await testConnection(bridge, { ...settings, port: closed }, false, 'C0-11DD2E-D');
assert.equal(lines.length, 1); assert.match(lines[0].text, /connection refused/);
srv.state.mode = 'silent';
lines = await testConnection(bridge, settings, false, 'C0-11DD2E-D');
assert.match(lines.map((l) => l.text).join(' '), /Timed out|not with the CLICK system bits/, 'silent PLC: no answer reported');
srv.state.mode = 'normal';
assert.match((await testConnection(null, settings, false, 'x'))[0].text, /desktop app/);
console.log('  ok test connection: RUN / STOP / error / refused / no answer / browser');

// ---- Connect, poll the project's addresses
plc.set('X001', true); plc.set('X102', true); plc.set('Y001', true); plc.set('C1001', true); plc.set('T1', true); plc.set('CT1', true);
plc.set('DS1', 1234); plc.set('DS2', -5); plc.set('TD1', 42); plc.set('DF1', 12.5);
useOnlineStore.getState().setSettings({ ...settings, pollMs: 50, swapWords: false });
const addresses = ['X001', 'X002', 'X102', 'Y001', 'C1001', 'C1002', 'T1', 'CT1', 'DS1', 'DS2', 'TD1', 'DF1'];
void connectPlc(addresses, bridge);
assert.ok(await until(() => useOnlineStore.getState().polls > 1), `polling (${useOnlineStore.getState().error})`);
const s = useOnlineStore.getState();
assert.deepEqual(['X001', 'X002', 'X102', 'Y001', 'C1001', 'C1002', 'T1', 'CT1'].map((a) => s.bits.get(a)), [true, false, true, true, true, false, true, true]);
assert.deepEqual(['DS1', 'DS2', 'TD1'].map((a) => s.words.get(a)), [1234, -5, 42]);
assert.ok(Math.abs(s.words.get('DF1')! - 12.5) < 1e-6, 'float low word first');
console.log('  ok connect and poll X / Y / C / T / CT / DS / TD / DF');

// ---- Writes: only with "Allow writes", only C and DS
await assert.rejects(writePlc('C1002', true, bridge), /Writes are switched off/);
useOnlineStore.getState().setAllowWrites(true);
await writePlc('C1002', true, bridge); assert.equal(plc.get('C1002'), true, 'Set ON');
await writePlc('C1002', false, bridge); assert.equal(plc.get('C1002'), false, 'Set OFF');
await writePlc('DS2', 77, bridge); assert.equal(plc.get('DS2'), 77, 'Write DS');
await assert.rejects(writePlc('Y001', false, bridge), /only C bits and DS registers/);
await assert.rejects(writePlc('X001', false, bridge), /never X or Y/);
srv.state.refuse.add(clickModbus('DS3')!.register);
await assert.rejects(writePlc('DS3', 1, bridge), /Write to DS3 failed: Modbus exception 2 \(illegal data address\)/);
assert.ok(await until(() => useOnlineStore.getState().words.get('DS2') === 77), 'the poll shows the written value');
console.log('  ok Set ON / OFF and Write (C, DS), refusals in plain words');

// ---- Program check while connected
const program: LadderProgram = { tags: [], rungs: [
  { id: 'r1', comment: 'First scan: DS1 outside 1-30 is loaded with 3', branches: [[{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS1', op: '<', right: '1' }], [{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS1', op: '>', right: '30' }]], outputs: [{ type: 'COPY', source: '3', dest: 'DS1' }] },
  { id: 'r2', comment: 'First scan: DF1 outside 10-50 is loaded with 20', branches: [[{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DF1', op: '<', right: '10' }], [{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DF1', op: '>', right: '50' }]], outputs: [{ type: 'COPY', source: '20', dest: 'DF1' }] },
] };
assert.deepEqual(firstScanRanges(program), [{ address: 'DS1', min: 1, max: 30 }, { address: 'DF1', min: 10, max: 50 }]);
srv.state.refuse.add(clickModbus('C1002')!.register);
let pc = await programCheck(bridge, [...addresses, 'TXT1'], program);
assert.deepEqual(pc.refused.map((x) => x.address), ['C1002']);
assert.deepEqual(pc.missing, ['TXT1']);
assert.deepEqual(pc.outOfRange.map((x) => `${x.address}=${x.value}`), ['DS1=1234'], 'DS1 out of range: those rungs are not running');
assert.equal(pc.lines.at(-1)!.ok, false);
plc.set('DS1', 3); srv.state.refuse.clear();
pc = await programCheck(bridge, addresses, program);
assert.deepEqual([pc.refused.length, pc.outOfRange.length], [0, 0]);
assert.match(pc.lines.at(-1)!.text, /All 2 setpoints .* the program has run/);
lines = await testConnection(bridge, settings, true, 'C0-11DD2E-D');
assert.equal(lines[0].ok, true, 'test while connected');
assert.equal(useOnlineStore.getState().status, 'connected', 'Test connection while connected keeps the connection');
console.log('  ok program check: refused / no Modbus address / first-scan setpoints');

// ---- The PLC goes away: plain error, status error
srv.dropAll();
assert.ok(await until(() => useOnlineStore.getState().status === 'error'));
assert.match(useOnlineStore.getState().error ?? '', /Connection lost: .*closed/);
await disconnectPlc(bridge);
await srv.close();
console.log('clickOnline tests passed');
