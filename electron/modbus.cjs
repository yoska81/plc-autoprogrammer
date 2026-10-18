// Modbus TCP client for the desktop app's "Connect to PLC" (main process only).
// Raw sockets on purpose: the protocol subset needed (FC 1–6) is ~150 lines, and the common
// libraries pull in native serial-port modules that complicate the Windows installer.
// Contract: src/desktop/bridge.ts (ModbusBridge). 0-based protocol addresses; one request at a
// time; no retries (the page polls); every failure is a plain-English message.
const net = require('node:net');

const EXCEPTIONS = {
  1: 'illegal function', 2: 'illegal data address', 3: 'illegal data value', 4: 'server device failure',
  5: 'acknowledge', 6: 'server busy', 8: 'memory parity error', 10: 'gateway path unavailable', 11: 'gateway target did not respond',
};

/** Plain-English text for a socket error while connecting. */
function connectError(err, host, port, timeoutMs) {
  const where = `${host}:${port}`;
  switch (err && err.code) {
    case 'ECONNREFUSED': return `Nothing answered at ${where} (connection refused). Check the PLC's IP address and that its Modbus TCP server is enabled (CLICK: port 502).`;
    case 'EHOSTUNREACH': case 'ENETUNREACH': return `Can't reach ${host}. Check the Ethernet cable and that this PC has an address in the PLC's subnet (CLICK default 192.168.0.10, mask 255.255.0.0).`;
    case 'ENOTFOUND': case 'EAI_AGAIN': return `"${host}" is not a known address. Enter the PLC's IP address, e.g. 192.168.0.10.`;
    case 'ETIMEDOUT': return `No answer from ${where} within ${timeoutMs} ms. Check the PLC's IP address, that this PC is in the same subnet, and that a firewall on this PC does not block TCP port ${port} (allow ISA Auto Programmer in Windows Defender Firewall).`;
    case 'ECONNRESET': return `The PLC at ${where} closed the connection.`;
    default: return `Could not connect to ${where}: ${err && err.message ? err.message : String(err)}`;
  }
}

function createModbusClient(onStatus) {
  let sock = null;
  let opts = null;
  let tid = 0;
  let buf = Buffer.alloc(0);
  let pending = null; // { tid, fc, address, resolve, reject, timer }
  let chain = Promise.resolve();

  const status = (s) => { try { onStatus?.(s); } catch { /* ignore */ } };
  const fail = (msg) => {
    if (!pending) return;
    const p = pending; pending = null; clearTimeout(p.timer); p.reject(new Error(msg));
  };

  const onData = (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 7) {
      const len = buf.readUInt16BE(4);
      if (len < 2 || len > 260) { buf = Buffer.alloc(0); fail('The PLC sent a malformed Modbus frame.'); return; }
      if (buf.length < 6 + len) return;
      const frame = buf.subarray(0, 6 + len);
      buf = buf.subarray(6 + len);
      // Answers to a request that already timed out carry an old transaction id: ignore them.
      if (!pending || frame.readUInt16BE(0) !== pending.tid) continue;
      const p = pending; pending = null; clearTimeout(p.timer);
      const pdu = frame.subarray(7);
      if (pdu[0] === (p.fc | 0x80)) p.reject(new Error(`Modbus exception ${pdu[1]} (${EXCEPTIONS[pdu[1]] ?? 'unknown'}) at ${p.address}`));
      else if (pdu[0] !== p.fc) p.reject(new Error(`The PLC answered function ${pdu[0]} to a function ${p.fc} request.`));
      else p.resolve(pdu);
    }
  };

  function request(fc, address, body) {
    const run = () => new Promise((resolve, reject) => {
      if (!sock) return reject(new Error('Not connected'));
      tid = (tid + 1) & 0xffff;
      const pdu = Buffer.concat([Buffer.from([fc]), body]);
      const head = Buffer.alloc(7);
      head.writeUInt16BE(tid, 0); head.writeUInt16BE(0, 2); head.writeUInt16BE(pdu.length + 1, 4); head[6] = opts.unitId;
      pending = { tid, fc, address, resolve, reject, timer: setTimeout(() => fail(`Timed out after ${opts.timeoutMs} ms`), opts.timeoutMs) };
      sock.write(Buffer.concat([head, pdu]));
    });
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
  const u16 = (...v) => { const b = Buffer.alloc(2 * v.length); v.forEach((x, i) => b.writeUInt16BE(x & 0xffff, 2 * i)); return b; };

  async function readBits(fc, address, count) {
    const pdu = await request(fc, address, u16(address, count));
    if (pdu.length < 2 + Math.ceil(count / 8)) throw new Error('The PLC sent a short answer.');
    return Array.from({ length: count }, (_, i) => Boolean((pdu[2 + (i >> 3)] >> (i & 7)) & 1));
  }
  async function readRegs(fc, address, count) {
    const pdu = await request(fc, address, u16(address, count));
    if (pdu.length < 2 + 2 * count) throw new Error('The PLC sent a short answer.');
    return Array.from({ length: count }, (_, i) => pdu.readUInt16BE(2 + 2 * i));
  }

  function drop() {
    if (!sock) return;
    const s = sock; sock = null;
    s.removeAllListeners('close');
    s.destroy();
    fail('Not connected');
  }

  return {
    connect(o) {
      drop();
      opts = o;
      return new Promise((resolve) => {
        let settled = false;
        const s = net.createConnection({ host: o.host, port: o.port });
        s.setNoDelay(true);
        const t = setTimeout(() => { if (!settled) { settled = true; s.destroy(); resolve({ ok: false, error: connectError({ code: 'ETIMEDOUT' }, o.host, o.port, o.timeoutMs) }); } }, o.timeoutMs);
        s.once('connect', () => {
          if (settled) return;
          settled = true; clearTimeout(t);
          sock = s; buf = Buffer.alloc(0);
          status({ connected: true });
          resolve({ ok: true });
        });
        s.on('data', onData);
        s.on('error', (e) => {
          if (!settled) { settled = true; clearTimeout(t); resolve({ ok: false, error: connectError(e, o.host, o.port, o.timeoutMs) }); return; }
          if (sock === s) fail(connectError(e, o.host, o.port, o.timeoutMs));
        });
        s.on('close', () => {
          if (sock !== s) return;
          sock = null;
          fail('The connection to the PLC was closed.');
          status({ connected: false, error: 'The connection to the PLC was closed.' });
        });
      });
    },
    async disconnect() {
      const was = Boolean(sock);
      drop();
      if (was) status({ connected: false });
    },
    readCoils: (a, n) => readBits(1, a, n),
    readDiscreteInputs: (a, n) => readBits(2, a, n),
    readHoldingRegisters: (a, n) => readRegs(3, a, n),
    readInputRegisters: (a, n) => readRegs(4, a, n),
    async writeCoil(a, v) { await request(5, a, u16(a, v ? 0xff00 : 0)); },
    async writeRegister(a, v) { await request(6, a, u16(a, v)); },
  };
}

// ── Argument checks (the page is not trusted with raw values) ──
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
function checkConnect(o) {
  if (!o || typeof o !== 'object') throw new Error('Missing connection settings.');
  const host = typeof o.host === 'string' ? o.host.trim() : '';
  if (!host || host.length > 253 || /[\s/\\]/.test(host)) throw new Error('Enter the PLC\'s IP address, e.g. 192.168.0.10.');
  const port = o.port === undefined ? 502 : Number(o.port);
  if (!isInt(port, 1, 65535)) throw new Error('The port must be a number from 1 to 65535 (Modbus TCP uses 502).');
  const unitId = o.unitId === undefined ? 1 : Number(o.unitId);
  if (!isInt(unitId, 0, 247)) throw new Error('The unit ID must be a number from 0 to 247 (CLICK: 1).');
  const timeoutMs = o.timeoutMs === undefined ? 2000 : Number(o.timeoutMs);
  if (!isInt(timeoutMs, 100, 60000)) throw new Error('The timeout must be between 100 and 60000 ms.');
  return { host, port, unitId, timeoutMs };
}
function checkRead(address, count, max) {
  if (!isInt(address, 0, 65535)) throw new Error(`Address ${address} is outside 0–65535.`);
  if (!isInt(count, 1, max)) throw new Error(`Count must be 1–${max} per request (got ${count}).`);
  if (address + count > 65536) throw new Error(`Addresses ${address}–${address + count - 1} run past 65535.`);
}

/** Wires the client to IPC: one connection per window. */
function registerModbusIpc(ipcMain) {
  const clients = new Map(); // webContents id → client
  const clientFor = (wc) => {
    let c = clients.get(wc.id);
    if (!c) {
      c = createModbusClient((s) => { if (!wc.isDestroyed()) wc.send('isa:modbus-status', s); });
      clients.set(wc.id, c);
      wc.once('destroyed', () => { void c.disconnect(); clients.delete(wc.id); });
    }
    return c;
  };
  ipcMain.handle('isa:modbus', async (e, op, args = []) => {
    try {
      const c = clientFor(e.sender);
      switch (op) {
        case 'connect': return { ok: true, value: await c.connect(checkConnect(args[0])) };
        case 'disconnect': await c.disconnect(); return { ok: true };
        case 'readCoils': checkRead(args[0], args[1], 2000); return { ok: true, value: await c.readCoils(args[0], args[1]) };
        case 'readDiscreteInputs': checkRead(args[0], args[1], 2000); return { ok: true, value: await c.readDiscreteInputs(args[0], args[1]) };
        case 'readHoldingRegisters': checkRead(args[0], args[1], 125); return { ok: true, value: await c.readHoldingRegisters(args[0], args[1]) };
        case 'readInputRegisters': checkRead(args[0], args[1], 125); return { ok: true, value: await c.readInputRegisters(args[0], args[1]) };
        case 'writeCoil':
          checkRead(args[0], 1, 1);
          if (typeof args[1] !== 'boolean') throw new Error('A coil is written ON (true) or OFF (false).');
          await c.writeCoil(args[0], args[1]); return { ok: true };
        case 'writeRegister':
          checkRead(args[0], 1, 1);
          if (!isInt(args[1], 0, 65535)) throw new Error(`A register holds 0–65535 (got ${args[1]}).`);
          await c.writeRegister(args[0], args[1]); return { ok: true };
        default: throw new Error(`Unknown Modbus operation "${op}".`);
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

module.exports = { createModbusClient, registerModbusIpc, checkConnect };
