// Minimal Modbus TCP client implementing the app's desktop bridge contract
// (window.isaDesktop.modbus — see src/online/bridge.ts). Node only (uses `net`):
// usable in the Electron main process and in tests.
// Addresses are 0-based protocol addresses. Requests run one at a time.
const net = require('net');

const EXCEPTIONS = { 1: 'illegal function', 2: 'illegal data address', 3: 'illegal data value', 4: 'server device failure', 6: 'server busy' };

function createModbusClient() {
  let sock = null;
  let opts = null;
  let tid = 0;
  let buf = Buffer.alloc(0);
  let pending = null; // { tid, resolve, reject, timer }
  let chain = Promise.resolve();
  const listeners = new Set();
  const emit = (s) => listeners.forEach((cb) => { try { cb(s); } catch { /* ignore */ } });

  const onData = (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 7) {
      const len = buf.readUInt16BE(4);
      if (buf.length < 6 + len) break;
      const frame = buf.subarray(0, 6 + len);
      buf = buf.subarray(6 + len);
      if (pending && frame.readUInt16BE(0) === pending.tid) {
        const p = pending; pending = null; clearTimeout(p.timer);
        const pdu = frame.subarray(7);
        if (pdu[0] & 0x80) p.reject(new Error(`Modbus exception ${pdu[1]} (${EXCEPTIONS[pdu[1]] ?? 'unknown'}) at ${p.address}`));
        else p.resolve(pdu);
      }
    }
  };
  const fail = (msg) => {
    if (pending) { const p = pending; pending = null; clearTimeout(p.timer); p.reject(new Error(msg)); }
  };

  function request(pdu, address) {
    const run = () => new Promise((resolve, reject) => {
      if (!sock) return reject(new Error('Not connected'));
      tid = (tid + 1) & 0xffff;
      const head = Buffer.alloc(7);
      head.writeUInt16BE(tid, 0); head.writeUInt16BE(0, 2); head.writeUInt16BE(pdu.length + 1, 4); head[6] = opts.unitId & 0xff;
      const timer = setTimeout(() => fail(`Timed out after ${opts.timeoutMs} ms`), opts.timeoutMs);
      pending = { tid, resolve, reject, timer, address };
      sock.write(Buffer.concat([head, pdu]));
    });
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
  const u16 = (...vals) => { const b = Buffer.alloc(2 * vals.length); vals.forEach((v, i) => b.writeUInt16BE(v & 0xffff, 2 * i)); return b; };
  const readBits = async (fc, address, count) => {
    const pdu = await request(Buffer.concat([Buffer.from([fc]), u16(address, count)]), address);
    return Array.from({ length: count }, (_, i) => Boolean((pdu[2 + (i >> 3)] >> (i & 7)) & 1));
  };
  const readRegs = async (fc, address, count) => {
    const pdu = await request(Buffer.concat([Buffer.from([fc]), u16(address, count)]), address);
    return Array.from({ length: count }, (_, i) => pdu.readUInt16BE(2 + 2 * i));
  };

  return {
    connect(o) {
      return new Promise((resolve) => {
        this.disconnect();
        opts = { host: o.host, port: o.port || 502, unitId: o.unitId ?? 1, timeoutMs: o.timeoutMs || 2000 };
        const s = net.createConnection({ host: opts.host, port: opts.port });
        const t = setTimeout(() => { s.destroy(); resolve({ ok: false, error: `No answer from ${opts.host}:${opts.port} within ${opts.timeoutMs} ms` }); }, opts.timeoutMs);
        s.once('connect', () => { clearTimeout(t); sock = s; buf = Buffer.alloc(0); emit({ connected: true }); resolve({ ok: true }); });
        s.on('data', onData);
        s.on('error', (e) => { clearTimeout(t); fail(e.message); if (sock !== s) resolve({ ok: false, error: e.message }); else emit({ connected: false, error: e.message }); });
        s.on('close', () => { if (sock === s) { sock = null; fail('Connection closed'); emit({ connected: false }); } });
      });
    },
    async disconnect() { if (sock) { const s = sock; sock = null; s.destroy(); } },
    readCoils: (a, n) => readBits(1, a, n),
    readDiscreteInputs: (a, n) => readBits(2, a, n),
    readHoldingRegisters: (a, n) => readRegs(3, a, n),
    readInputRegisters: (a, n) => readRegs(4, a, n),
    async writeCoil(a, v) { await request(Buffer.concat([Buffer.from([5]), u16(a, v ? 0xff00 : 0)]), a); },
    async writeRegister(a, v) { await request(Buffer.concat([Buffer.from([6]), u16(a, v)]), a); },
    onStatus(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

module.exports = { createModbusClient };
