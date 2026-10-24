import type { ModbusRef, ModbusTable, ModbusType } from './poll';

/**
 * CLICK PLC address → Modbus TCP (0-based protocol address), from
 * AutomationDirect's documentation:
 *  - StrideLinx Cloud 2.0 User Manual, Appendix D "StrideLinx Modbus to AutomationDirect PLC
 *    Address Maps – CLICK PLCs": https://cdn.automationdirect.com/static/manuals/seslvpn2userm/appxd.pdf
 *    (X/Y rows: 32 addresses per slot, 16 used; its Y216 / Y301 / YD8 rows are typos — the
 *    slot × 32 pattern used everywhere else is applied here).
 *  - CLICK help, Address Picker (X001 = 100001, FC 02): https://cdn.automationdirect.com/static/helpfiles/click/Content/072.htm
 *  - CLICK help, Modbus TCP send / receive (function codes per memory type):
 *    https://cdn.automationdirect.com/static/helpfiles/click/Content/213.htm and 214.htm
 *  - CLICK hardware manual C0-USER-M ch. 4 "Modbus Addressing" (DS1 = 400001, FC 03/06/16):
 *    https://www.automationdirect.com/static/manuals/c0userm/ch4.pdf
 * Not documented by AutomationDirect and therefore not supported: TXT addresses. The word
 * order of 32-bit values (DD, DF, CTD) is not documented either; it is a setting on the page.
 */

interface Area { table: ModbusTable; base: number; type: ModbusType; words: 1 | 2; slotted?: boolean; first?: number }

const AREAS: Record<string, Area> = {
  X: { table: 'discrete', base: 0, type: 'bit', words: 1, slotted: true },
  Y: { table: 'coil', base: 8192, type: 'bit', words: 1, slotted: true },
  C: { table: 'coil', base: 16384, type: 'bit', words: 1 },
  T: { table: 'discrete', base: 45056, type: 'bit', words: 1 },
  CT: { table: 'discrete', base: 49152, type: 'bit', words: 1 },
  SC: { table: 'discrete', base: 61440, type: 'bit', words: 1 },
  DS: { table: 'holding', base: 0, type: 'int16', words: 1 },
  DD: { table: 'holding', base: 16384, type: 'int32', words: 2 },
  DH: { table: 'holding', base: 24576, type: 'hex', words: 1 },
  DF: { table: 'holding', base: 28672, type: 'float', words: 2 },
  TD: { table: 'holding', base: 45056, type: 'int16', words: 1 },
  CTD: { table: 'holding', base: 49152, type: 'int32', words: 2 },
  // The manual's table starts at "SD0"; CLICK numbers system data SD1..SD1000, so SD1 is taken as 61440.
  SD: { table: 'input', base: 61440, type: 'int16', words: 1 },
}

/** Memory types the Online page may write (behind "Allow writes"): internal bits and data registers only, never X / Y. */
export const WRITABLE = new Set(['C', 'DS']);

export function parseClick(address: string): { type: string; n: number } | null {
  const m = /^(CTD|CT|SC|SD|DS|DD|DH|DF|TD|X|Y|C|T)0*(\d+)$/i.exec(address.trim());
  return m ? { type: m[1].toUpperCase(), n: Number(m[2]) } : null;
}

/** Modbus location of a CLICK address, or null when it has no documented Modbus address. */
export function clickModbus(address: string): ModbusRef | null {
  const p = parseClick(address);
  if (!p) return null;
  const a = AREAS[p.type];
  if (!a || p.n < 1) return null;
  let offset: number;
  if (a.slotted) {
    // X001..X016 = CPU (slot 0), X101..X116 = slot 1 ... X816.
    const slot = Math.floor(p.n / 100), pt = p.n % 100;
    if (pt < 1 || pt > 16 || slot > 8) return null;
    offset = slot * 32 + (pt - 1);
  } else {
    offset = (p.n - 1) * a.words;
  }
  const register = a.base + offset;
  if (register > 0xffff) return null;
  return { address: address.trim().toUpperCase(), table: a.table, register, type: a.type, words: a.words };
}

/** 984-style number shown to the technician (e.g. X001 = 100001, DS1 = 400001). */
export function modbus984(r: ModbusRef): string {
  const prefix = { coil: 0, discrete: 1, input: 3, holding: 4 }[r.table];
  return `${prefix}${String(r.register + 1).padStart(5, '0')}`;
}

export const isWritable = (address: string) => WRITABLE.has(parseClick(address)?.type ?? '');
