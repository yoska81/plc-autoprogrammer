/// <reference types="node" />
/**
 * Online (Modbus) tests against the fake Modbus TCP server. Run with:  npx tsx src/online/online.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clickModbus, isWritable, modbus984 } from './clickModbus';
import { planReads, pollOnce, decodeWord, encodeWord } from './poll';
import { rungPowerFromValues } from './power';
import type { ModbusBridge } from '../desktop/bridge';
import type { LadderProgram } from '../plc/core/ladder';

const require = createRequire(import.meta.url);
const { fakeServer } = require('../../e2e/fake-modbus.cjs');
const { createModbusClient } = require('../../electron/modbus.cjs');

// Address map (AutomationDirect: X001 = 100001, DS1 = 400001; StrideLinx appendix D offsets).
const r = (a: string) => clickModbus(a)!;
assert.deepEqual([r('X001').table, r('X001').register, modbus984(r('X001'))], ['discrete', 0, '100001']);
assert.equal(r('X016').register, 15);
assert.equal(r('X101').register, 32);
assert.equal(r('X816').register, 271);
assert.deepEqual([r('Y001').table, r('Y001').register], ['coil', 8192]);
assert.equal(r('Y116').register, 8239);
assert.equal(r('Y801').register, 8448);
assert.deepEqual([r('C1').register, r('C2000').register], [16384, 18383]);
assert.deepEqual([r('T1').table, r('T500').register, r('CT1').register, r('SC1').register], ['discrete', 45555, 49152, 61440]);
assert.deepEqual([r('DS1').table, r('DS1').register, modbus984(r('DS1')), r('DS4500').register], ['holding', 0, '400001', 4499]);
assert.deepEqual([r('DD1').register, r('DD1').words, r('DD1000').register], [16384, 2, 18382]);
assert.deepEqual([r('DH1').register, r('DF1').register, r('DF500').register, r('TD500').register, r('CTD250').register], [24576, 28672, 29670, 45555, 49650]);
assert.deepEqual([r('SD1').table, r('SD1').register], ['input', 61440]);
assert.equal(clickModbus('X017'), null, 'X017 does not exist');
assert.equal(clickModbus('TXT1'), null, 'TXT not documented');
assert.equal(r('c001').address, 'C001');
assert.ok(isWritable('C5') && isWritable('DS3') && !isWritable('Y001') && !isWritable('X001') && !isWritable('DD1'));

// Read planning: contiguous ranges, limits.
const blocks = planReads(['X001', 'X002', 'X101', 'Y001', 'C1', 'C3', 'DS1', 'DS2', 'DD1', 'T1'].map(r));
assert.equal(blocks.find((b) => b.table === 'discrete' && b.start === 0)!.count, 33, 'X001..X101 in one read (small gap)');
assert.ok(blocks.every((b) => b.count <= (b.table === 'coil' || b.table === 'discrete' ? 2000 : 125)));

// Decoding
assert.equal(decodeWord([0xffff], 'int16'), -1);
assert.equal(decodeWord([0x0001, 0x0002], 'int32'), 0x20001);
assert.equal(decodeWord([0x0002, 0x0001], 'int32', true), 0x20001);
assert.ok(Math.abs(decodeWord([0x0000, 0x3fc0], 'float') - 1.5) < 1e-6);
assert.equal(encodeWord(-1, 'int16'), 0xffff);

// Against the fake server through the desktop app's own Modbus client (electron/modbus.cjs).
const srv = fakeServer();
for (const a of [0, 32, 45056]) srv.mem.discrete[a] = 1;
for (const a of [8192, 16386]) srv.mem.coils[a] = 1;
Object.assign(srv.mem.holding, { 0: 0xfffe, 16384: 5, 16385: 1 });
const port = await srv.listen();
const bridge = createModbusClient() as ModbusBridge;
assert.deepEqual(await bridge.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 1000 }), { ok: true });
const res = await pollOnce(bridge, blocks);
assert.deepEqual([res.bits.get('X001'), res.bits.get('X002'), res.bits.get('X101'), res.bits.get('Y001'), res.bits.get('C3'), res.bits.get('T1')], [true, false, true, true, true, true]);
assert.deepEqual([res.words.get('DS1'), res.words.get('DD1')], [-2, 0x10005]);
// Writes only through the bridge's single-coil / single-register calls.
await bridge.writeCoil(r('C1').register, true);
await bridge.writeRegister(r('DS2').register, encodeWord(-5, 'int16'));
const res2 = await pollOnce(bridge, blocks);
assert.deepEqual([res2.bits.get('C1'), res2.words.get('DS2')], [true, -5]);
assert.deepEqual(srv.state.log.filter((l: { fc: number }) => l.fc === 5 || l.fc === 6).map((l: { fc: number; address: number }) => [l.fc, l.address]), [[5, 16384], [6, 1]]);
await bridge.disconnect();
await srv.close();

// Power flow from PLC values
const prog: LadderProgram = { tags: [], rungs: [{ id: 'r1', comment: '', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'C1' }]], outputs: [{ type: 'OUT', address: 'Y001' }] }] };
const pw = rungPowerFromValues(prog, new Map([['X001', true], ['C1', false]]), new Map());
assert.deepEqual([pw.get('r1')!.rungTrue, pw.get('r1')!.closed[0]], [true, [true, true]]);
console.log('online tests passed');
