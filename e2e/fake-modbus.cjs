// Fake Modbus TCP server for the desktop and Online page tests (FC 1–6, exceptions, silent and late modes).
// `state.log` records every request ({ fc, address, count } or, for writes, { fc, address, value }).
const net = require('node:net');

/** Minimal Modbus TCP server (FC 1–6). mode: 'normal' | 'silent' (never answers) | 'late' (answers after 300 ms). */
function fakeServer() {
  const mem = { coils: new Uint8Array(65536), discrete: new Uint8Array(65536), holding: new Uint16Array(65536), input: new Uint16Array(65536) };
  const state = { mode: 'normal', refuse: new Set(), units: [], sockets: new Set(), log: [] };
  const handle = (pdu) => {
    const fc = pdu[0];
    const ex = (c) => Buffer.from([fc | 0x80, c]);
    const a = pdu.readUInt16BE(1);
    const n = pdu.readUInt16BE(3);
    state.log.push(fc === 5 ? { fc, address: a, value: n === 0xff00 } : fc === 6 ? { fc, address: a, value: n } : { fc, address: a, count: n });
    if (state.refuse.has(a)) return ex(2);
    if (fc === 1 || fc === 2) {
      const src = fc === 1 ? mem.coils : mem.discrete;
      const out = Buffer.alloc(Math.ceil(n / 8));
      for (let i = 0; i < n; i++) if (src[a + i]) out[i >> 3] |= 1 << (i & 7);
      return Buffer.concat([Buffer.from([fc, out.length]), out]);
    }
    if (fc === 3 || fc === 4) {
      const src = fc === 3 ? mem.holding : mem.input;
      const out = Buffer.alloc(2 + 2 * n); out[0] = fc; out[1] = 2 * n;
      for (let i = 0; i < n; i++) out.writeUInt16BE(src[a + i], 2 + 2 * i);
      return out;
    }
    if (fc === 5) { mem.coils[a] = n === 0xff00 ? 1 : 0; return pdu.subarray(0, 5); }
    if (fc === 6) { mem.holding[a] = n; return pdu.subarray(0, 5); }
    return ex(1);
  };
  const server = net.createServer((sock) => {
    state.sockets.add(sock);
    sock.on('close', () => state.sockets.delete(sock));
    let buf = Buffer.alloc(0);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 7 && buf.length >= 6 + buf.readUInt16BE(4)) {
        const frame = buf.subarray(0, 6 + buf.readUInt16BE(4));
        buf = buf.subarray(frame.length);
        state.units.push(frame[6]);
        if (state.mode === 'silent') continue;
        const pdu = handle(frame.subarray(7));
        const head = Buffer.alloc(7); frame.copy(head, 0, 0, 4); head.writeUInt16BE(pdu.length + 1, 4); head[6] = frame[6];
        const reply = Buffer.concat([head, pdu]);
        if (state.mode === 'late') setTimeout(() => sock.write(reply), 300); else sock.write(reply);
      }
    });
    sock.on('error', () => {});
  });
  return {
    mem, state, server,
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port))),
    dropAll: () => { for (const s of state.sockets) s.destroy(); },
    close: () => new Promise((r) => { for (const s of state.sockets) s.destroy(); server.close(() => r()); }),
  };
}


module.exports = { fakeServer };
