// Modbus TCP client of the desktop app (electron/modbus.cjs) against a fake server: reads, writes,
// exceptions, timeouts (and late answers ignored), dropped connection, argument checks, plain messages.
//   node e2e/modbus.test.cjs
const net = require('node:net');
const assert = require('node:assert/strict');
const { createModbusClient, checkConnect, registerModbusIpc } = require('../electron/modbus.cjs');
const { fakeServer } = require('./fake-modbus.cjs');

const rejects = async (p, re) => { await assert.rejects(p, (e) => { assert.match(e.message, re); return true; }); };
let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };

(async () => {
  const fake = fakeServer();
  const port = await fake.listen();
  const statuses = [];
  const c = createModbusClient((s) => statuses.push(s));

  // Connection problems in plain words
  const closedPort = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  let r = await c.connect({ host: '127.0.0.1', port: closedPort, unitId: 1, timeoutMs: 1000 });
  assert.equal(r.ok, false); assert.match(r.error, /connection refused.*Modbus TCP server is enabled/);
  ok(`refused: ${r.error}`);
  await rejects(c.readCoils(0, 1), /^Not connected$/);
  ok('read before connecting: Not connected');

  r = await c.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 500 });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(statuses.at(-1), { connected: true });
  ok('connect');

  // Reads and writes (CLICK: C1 = coil 16384, DS1 = holding register 0)
  fake.mem.coils[16384] = 1; fake.mem.coils[16386] = 1;
  fake.mem.discrete[0] = 1; fake.mem.discrete[9] = 1;
  fake.mem.holding[0] = 1234; fake.mem.input[5] = 65535;
  assert.deepEqual(await c.readCoils(16384, 3), [true, false, true]);
  assert.deepEqual((await c.readDiscreteInputs(0, 10)).map(Number).join(''), '1000000001');
  assert.deepEqual(await c.readHoldingRegisters(0, 2), [1234, 0]);
  assert.deepEqual(await c.readInputRegisters(5, 1), [65535]);
  ok('FC 1/2/3/4 reads');
  await c.writeCoil(16390, true); assert.equal(fake.mem.coils[16390], 1);
  await c.writeCoil(16390, false); assert.equal(fake.mem.coils[16390], 0);
  await c.writeRegister(10, 4321); assert.equal(fake.mem.holding[10], 4321);
  ok('FC 5/6 writes');
  const big = await c.readCoils(0, 2000); assert.equal(big.length, 2000);
  const regs = await c.readHoldingRegisters(0, 125); assert.equal(regs.length, 125);
  ok('max counts (2000 bits, 125 registers)');
  assert.ok(fake.state.units.every((u) => u === 1));
  ok('unit id sent');

  // Requests run one at a time, in order
  const many = await Promise.all([c.readHoldingRegisters(0, 1), c.readCoils(16384, 1), c.readHoldingRegisters(10, 1)]);
  assert.deepEqual(many, [[1234], [true], [4321]]);
  ok('queued requests answer in order');

  // Exception
  fake.state.refuse.add(16400);
  await rejects(c.writeCoil(16400, true), /^Modbus exception 2 \(illegal data address\) at 16400$/);
  ok('exception: Modbus exception 2 (illegal data address) at 16400');

  // Timeout; a late answer to the timed-out request is ignored, the next request gets its own answer
  fake.state.mode = 'late';
  const c2 = createModbusClient(() => {});
  await c2.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 150 });
  await rejects(c2.readHoldingRegisters(0, 1), /^Timed out after 150 ms$/);
  fake.state.mode = 'normal';
  fake.mem.holding[0] = 777;
  await new Promise((res) => setTimeout(res, 250)); // late answer (1234) arrives now
  assert.deepEqual(await c2.readHoldingRegisters(0, 1), [777]);
  await c2.disconnect();
  ok('timeout, late answer ignored');

  fake.state.mode = 'silent';
  const c3 = createModbusClient(() => {});
  await c3.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 200 });
  await rejects(c3.readCoils(0, 1), /^Timed out after 200 ms$/);
  await c3.disconnect();
  fake.state.mode = 'normal';
  ok('silent server: Timed out after 200 ms');

  // PLC drops the connection: pending and later requests fail, status reports it
  const before = statuses.length;
  fake.state.mode = 'silent';
  const pending = c.readCoils(0, 1);
  await new Promise((res) => setTimeout(res, 50));
  fake.dropAll();
  await rejects(pending, /connection to the PLC was closed/);
  await new Promise((res) => setTimeout(res, 50));
  assert.deepEqual(statuses.slice(before), [{ connected: false, error: 'The connection to the PLC was closed.' }]);
  await rejects(c.readCoils(0, 1), /^Not connected$/);
  fake.state.mode = 'normal';
  ok('dropped connection reported; then Not connected');

  // Reconnect works; disconnect
  assert.deepEqual(await c.connect({ host: '127.0.0.1', port, unitId: 1, timeoutMs: 500 }), { ok: true });
  assert.deepEqual(await c.readHoldingRegisters(0, 1), [777]);
  await c.disconnect();
  assert.deepEqual(statuses.at(-1), { connected: false });
  await rejects(c.readCoils(0, 1), /^Not connected$/);
  ok('reconnect, disconnect');

  // Argument checks (main process, via the IPC handler)
  const handlers = {};
  registerModbusIpc({ handle: (ch, fn) => { handlers[ch] = fn; } });
  const wc = { id: 1, isDestroyed: () => false, send: () => {}, once: () => {} };
  const call = (op, ...args) => handlers['isa:modbus']({ sender: wc }, op, args);
  for (const [o, re] of [
    [{ host: '', port: 502, unitId: 1, timeoutMs: 1000 }, /IP address/],
    [{ host: '10.0.0.1', port: 70000, unitId: 1, timeoutMs: 1000 }, /port must be/],
    [{ host: '10.0.0.1', port: 502, unitId: 300, timeoutMs: 1000 }, /unit ID/],
  ]) assert.match((await call('connect', o)).error, re);
  assert.deepEqual(checkConnect({ host: ' 192.168.0.10 ', port: 502, unitId: 0, timeoutMs: 2000 }), { host: '192.168.0.10', port: 502, unitId: 0, timeoutMs: 2000 });
  assert.match((await call('readCoils', 0, 2001)).error, /Count must be 1–2000/);
  assert.match((await call('readHoldingRegisters', 65535, 2)).error, /run past 65535/);
  assert.match((await call('writeRegister', 0, 70000)).error, /0–65535/);
  assert.match((await call('writeCoil', 0, 1)).error, /ON \(true\) or OFF \(false\)/);
  assert.match((await call('format', 0)).error, /Unknown Modbus operation/);
  assert.equal((await call('readCoils', 0, 1)).error, 'Not connected');
  r = await call('connect', { host: '127.0.0.1', port, unitId: 1, timeoutMs: 500 });
  assert.deepEqual(r, { ok: true, value: { ok: true } });
  assert.deepEqual(await call('readHoldingRegisters', 10, 1), { ok: true, value: [4321] });
  await call('disconnect');
  ok('argument checks and IPC results');

  await fake.close();
  console.log(`\n${passed} passed`);
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
