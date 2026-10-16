// Small Modbus TCP server for testing the Online page without a real PLC.
// Supports FC 1, 2, 3, 4, 5, 6 (and 15/16 for completeness). Memory: 65536 coils,
// discrete inputs, holding and input registers, all starting at 0.
//   node tools/modbus/fake-server.cjs [--port 5020] [--seed seed.json]
// seed.json: { "coils": { "16384": true }, "discrete": { "0": true }, "holding": { "0": 42 }, "input": { } }
// Also usable from tests: const { createFakeModbus } = require('./fake-server.cjs').
const net = require('net');

function createFakeModbus(seed = {}) {
  const mem = {
    coils: new Uint8Array(65536), discrete: new Uint8Array(65536),
    holding: new Uint16Array(65536), input: new Uint16Array(65536),
  };
  for (const [k, v] of Object.entries(seed.coils ?? {})) mem.coils[+k] = v ? 1 : 0;
  for (const [k, v] of Object.entries(seed.discrete ?? {})) mem.discrete[+k] = v ? 1 : 0;
  for (const [k, v] of Object.entries(seed.holding ?? {})) mem.holding[+k] = v & 0xffff;
  for (const [k, v] of Object.entries(seed.input ?? {})) mem.input[+k] = v & 0xffff;
  /** Every request, for assertions: { fc, address, count|value }. */
  const log = [];
  /** Addresses that answer with exception 2 (illegal data address), e.g. to imitate a PLC that refuses a write. */
  const refuse = { coils: new Set(), holding: new Set() };

  const packBits = (arr, addr, n) => {
    const out = Buffer.alloc(Math.ceil(n / 8));
    for (let i = 0; i < n; i++) if (arr[addr + i]) out[i >> 3] |= 1 << (i & 7);
    return out;
  };
  function handle(pdu) {
    const fc = pdu[0];
    const ex = (code) => Buffer.from([fc | 0x80, code]);
    const addr = pdu.readUInt16BE(1);
    switch (fc) {
      case 1: case 2: {
        const n = pdu.readUInt16BE(3);
        log.push({ fc, address: addr, count: n });
        if (n < 1 || n > 2000 || addr + n > 65536) return ex(3);
        const bits = packBits(fc === 1 ? mem.coils : mem.discrete, addr, n);
        return Buffer.concat([Buffer.from([fc, bits.length]), bits]);
      }
      case 3: case 4: {
        const n = pdu.readUInt16BE(3);
        log.push({ fc, address: addr, count: n });
        if (n < 1 || n > 125 || addr + n > 65536) return ex(3);
        const out = Buffer.alloc(2 + 2 * n);
        out[0] = fc; out[1] = 2 * n;
        const src = fc === 3 ? mem.holding : mem.input;
        for (let i = 0; i < n; i++) out.writeUInt16BE(src[addr + i], 2 + 2 * i);
        return out;
      }
      case 5: {
        const v = pdu.readUInt16BE(3);
        log.push({ fc, address: addr, value: v === 0xff00 });
        if (v !== 0xff00 && v !== 0) return ex(3);
        if (refuse.coils.has(addr)) return ex(2);
        mem.coils[addr] = v === 0xff00 ? 1 : 0;
        return pdu.subarray(0, 5);
      }
      case 6: {
        const v = pdu.readUInt16BE(3);
        log.push({ fc, address: addr, value: v });
        if (refuse.holding.has(addr)) return ex(2);
        mem.holding[addr] = v;
        return pdu.subarray(0, 5);
      }
      case 15: {
        const n = pdu.readUInt16BE(3);
        for (let i = 0; i < n; i++) mem.coils[addr + i] = (pdu[6 + (i >> 3)] >> (i & 7)) & 1;
        log.push({ fc, address: addr, count: n });
        return pdu.subarray(0, 5);
      }
      case 16: {
        const n = pdu.readUInt16BE(3);
        for (let i = 0; i < n; i++) mem.holding[addr + i] = pdu.readUInt16BE(6 + 2 * i);
        log.push({ fc, address: addr, count: n });
        return pdu.subarray(0, 5);
      }
      default: return ex(1);
    }
  }
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 7) {
        const len = buf.readUInt16BE(4);
        if (buf.length < 6 + len) break;
        const frame = buf.subarray(0, 6 + len);
        buf = buf.subarray(6 + len);
        const pdu = handle(frame.subarray(7));
        const head = Buffer.alloc(7);
        frame.copy(head, 0, 0, 4);
        head.writeUInt16BE(pdu.length + 1, 4);
        head[6] = frame[6];
        sock.write(Buffer.concat([head, pdu]));
      }
    });
    sock.on('error', () => {});
  });
  return {
    mem, log, refuse, server,
    listen: (port = 0) => new Promise((r) => server.listen(port, '127.0.0.1', () => r(server.address().port))),
    close: () => new Promise((r) => server.close(() => r())),
  };
}

module.exports = { createFakeModbus };

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = Number(args[args.indexOf('--port') + 1]) || 5020;
  const seedPath = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : null;
  const seed = seedPath ? JSON.parse(require('fs').readFileSync(seedPath, 'utf8')) : {};
  const s = createFakeModbus(seed);
  s.listen(port).then((p) => console.log(`fake Modbus TCP server on 127.0.0.1:${p}`));
}
