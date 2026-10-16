import type { ModbusBridge } from '../desktop/bridge';

/** Where a PLC address lives in the Modbus map. */
export type ModbusTable = 'coil' | 'discrete' | 'holding' | 'input';
export type ModbusType = 'bit' | 'int16' | 'uint16' | 'int32' | 'float' | 'hex';

export interface ModbusRef {
  /** PLC address as written in the program, e.g. "X001", "DS5". */
  address: string;
  table: ModbusTable;
  /** 0-based Modbus protocol address. */
  register: number;
  type: ModbusType;
  /** Registers used (2 for 32-bit values). */
  words: 1 | 2;
}

/** One Modbus read covering several addresses. */
export interface ReadBlock {
  table: ModbusTable;
  start: number;
  count: number;
  refs: ModbusRef[];
}

const MAX = { bit: 2000, reg: 125 };
/** Read across small gaps instead of making another request. */
const GAP = { bit: 32, reg: 8 };

/** Group addresses into as few reads as possible (contiguous ranges per table). */
export function planReads(refs: ModbusRef[]): ReadBlock[] {
  const out: ReadBlock[] = [];
  for (const table of ['discrete', 'coil', 'input', 'holding'] as ModbusTable[]) {
    const isBit = table === 'coil' || table === 'discrete';
    const list = refs.filter((r) => r.table === table).sort((a, b) => a.register - b.register);
    let cur: ReadBlock | null = null;
    for (const r of list) {
      const end = r.register + r.words;
      if (cur && r.register <= cur.start + cur.count + (isBit ? GAP.bit : GAP.reg) && end - cur.start <= (isBit ? MAX.bit : MAX.reg)) {
        cur.count = Math.max(cur.count, end - cur.start);
        cur.refs.push(r);
      } else {
        cur = { table, start: r.register, count: r.words, refs: [r] };
        out.push(cur);
      }
    }
  }
  return out;
}

/**
 * Decode 1 or 2 registers. The word order of 32-bit values is not documented
 * for CLICK; low word first is the usual case, `swapWords` reads high word first.
 */
export function decodeWord(regs: number[], type: ModbusType, swapWords = false): number {
  const lo = (swapWords ? regs[1] : regs[0]) ?? 0, hi = (swapWords ? regs[0] : regs[1]) ?? 0;
  switch (type) {
    case 'int16': return lo >= 0x8000 ? lo - 0x10000 : lo;
    case 'int32': { const v = (hi << 16) | lo; return v | 0; }
    case 'float': { const b = new DataView(new ArrayBuffer(4)); b.setUint16(0, hi); b.setUint16(2, lo); return b.getFloat32(0); }
    default: return lo;
  }
}

/** Encode a value for writing a single register (16-bit types only). */
export function encodeWord(value: number, type: ModbusType): number {
  if (type === 'int16') return (Math.max(-32768, Math.min(32767, Math.round(value))) + 0x10000) & 0xffff;
  return Math.max(0, Math.min(0xffff, Math.round(value)));
}

export interface PollResult {
  bits: Map<string, boolean>;
  words: Map<string, number>;
  /** Addresses whose read failed, with the reason. */
  failed: Map<string, string>;
}

/** Read every block once. A failing block only fails its own addresses. */
export async function pollOnce(bridge: ModbusBridge, blocks: ReadBlock[], swapWords = false): Promise<PollResult> {
  const res: PollResult = { bits: new Map(), words: new Map(), failed: new Map() };
  for (const b of blocks) {
    try {
      if (b.table === 'coil' || b.table === 'discrete') {
        const v = b.table === 'coil' ? await bridge.readCoils(b.start, b.count) : await bridge.readDiscreteInputs(b.start, b.count);
        for (const r of b.refs) res.bits.set(r.address, Boolean(v[r.register - b.start]));
      } else {
        const v = b.table === 'holding' ? await bridge.readHoldingRegisters(b.start, b.count) : await bridge.readInputRegisters(b.start, b.count);
        for (const r of b.refs) res.words.set(r.address, decodeWord(v.slice(r.register - b.start, r.register - b.start + r.words), r.type, swapWords));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const r of b.refs) res.failed.set(r.address, msg);
      if (/not connected|closed|timed out/i.test(msg)) throw e;
    }
  }
  return res;
}
