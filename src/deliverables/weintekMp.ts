/**
 * Weintek / Maple (EasyBuilder Pro) panels on a Yaskawa MP controller: each HMI tag as the address EasyBuilder Pro's
 * driver takes, from the MPE720 register the PLC program uses (MB000100, MW00100, IB00000 …).
 *
 * The driver per family and its address table, from the makers' connection guides:
 *   MP2000 — "YASKAWA MP Series Memobus (Ethernet)" (Weintek PLC Connection Guide; port 502, 218IF-02):
 *            MB DDDDDh 0–65534F · IB HHHHH 0–A7FFF (read only) · IW HHHH 0–A7FF (read only) · IL / IF HHHH (read only)
 *            · MW DDDDD 0–65534 · ML / MF DDDDD 0–65533. No O, S or G registers.
 *   MP3000 — "YASKAWA MP3000 Series - Extension" (Maple Systems EBPro guide): SB DDDDDh 0–65534f · IB / OB HHHHHh
 *            0–27ffff · MB DDDDDDDh 0–1048575f · GB DDDDDDDh 0–2097151f · SW DDDDD · IW / OW HHHHH 0–27fff
 *            · MW DDDDDDD 0–1048575 · GW DDDDDDD 0–2097151. No L / F types: a 32-bit register is its first word,
 *            read with a 32-bit data format.
 * The rows follow the Address Tag Library's fields (EasyBuilder Pro user manual ch. 16: Name, Comment, Device,
 * Address mode, Address type, Address). Weintek does not publish the CSV column order of its import, so the
 * README says to export one tag from EasyBuilder Pro and match its columns.
 */
import type { ProjectSnapshot } from './collect';
import { getHmi, hmiMaker } from '../hmi/hmiCatalog';
import { platformOf } from '../plc/core/fit';
import { hmiTagRows } from './hmiTags';

export type MpFamily = 'yaskawa-mp2000' | 'yaskawa-mp3000';

export const WEINTEK_MP_DRIVER: Record<MpFamily, string> = {
  'yaskawa-mp2000': 'YASKAWA MP Series Memobus (Ethernet)',
  'yaskawa-mp3000': 'YASKAWA MP3000 Series - Extension',
};

export type WeintekAddress =
  | { mode: 'Bit' | 'Word'; type: string; address: string; readOnly: boolean; note?: string }
  | { error: string };

interface Area { digits: number; hex: boolean; max: number; readOnly?: boolean; as?: string; note?: string }
/** Per family, per MPE720 register type (area + B / W / L / F): how the driver writes the word number. */
const AREAS: Record<MpFamily, Record<string, Area>> = {
  'yaskawa-mp2000': {
    MB: { digits: 5, hex: false, max: 65534 }, MW: { digits: 5, hex: false, max: 65534 },
    ML: { digits: 5, hex: false, max: 65533 }, MF: { digits: 5, hex: false, max: 65533 },
    IB: { digits: 4, hex: true, max: 0xa7ff, readOnly: true }, IW: { digits: 4, hex: true, max: 0xa7ff, readOnly: true },
    IL: { digits: 4, hex: true, max: 0xa7ff, readOnly: true }, IF: { digits: 4, hex: true, max: 0xa7ff, readOnly: true },
  },
  'yaskawa-mp3000': {
    SB: { digits: 5, hex: false, max: 65534 }, SW: { digits: 5, hex: false, max: 65534 },
    MB: { digits: 7, hex: false, max: 1048575 }, MW: { digits: 7, hex: false, max: 1048575 },
    GB: { digits: 7, hex: false, max: 2097151 }, GW: { digits: 7, hex: false, max: 2097151 },
    IB: { digits: 5, hex: true, max: 0x27fff }, IW: { digits: 5, hex: true, max: 0x27fff },
    OB: { digits: 5, hex: true, max: 0x27fff }, OW: { digits: 5, hex: true, max: 0x27fff },
    ML: { digits: 7, hex: false, max: 1048574, as: 'MW', note: '32-bit: set the object\'s data format to 32-bit' },
    MF: { digits: 7, hex: false, max: 1048574, as: 'MW', note: '32-bit float: set the object\'s data format to 32-bit float' },
    IL: { digits: 5, hex: true, max: 0x27ffe, as: 'IW', note: '32-bit: set the object\'s data format to 32-bit' },
    IF: { digits: 5, hex: true, max: 0x27ffe, as: 'IW', note: '32-bit float: set the object\'s data format to 32-bit float' },
    OL: { digits: 5, hex: true, max: 0x27ffe, as: 'OW', note: '32-bit: set the object\'s data format to 32-bit' },
    OF: { digits: 5, hex: true, max: 0x27ffe, as: 'OW', note: '32-bit float: set the object\'s data format to 32-bit float' },
  },
};

/** An MPE720 register (MB000100, MW00100, IB0000F, OW1000 …) as the EasyBuilder Pro driver's address. */
export function mpToWeintek(register: string, family: MpFamily): WeintekAddress {
  const m = /^([MISOG])([BWLF])([0-9A-F]+)$/i.exec(register.trim());
  if (!m) return { error: `${register} is not an MP register` };
  const key = `${m[1]}${m[2]}`.toUpperCase();
  const area = AREAS[family][key];
  if (!area) return { error: `${key} registers are not on the ${WEINTEK_MP_DRIVER[family]} driver: use an M register the program copies to or from` };
  const bit = m[2].toUpperCase() === 'B';
  const digits = m[3].toUpperCase();
  const wordText = bit ? digits.slice(0, -1) : digits;
  const bitText = bit ? digits.slice(-1) : '';
  const word = area.hex ? parseInt(wordText || '0', 16) : Number(wordText || '0');
  if (!Number.isFinite(word) || (!area.hex && !/^\d*$/.test(wordText))) return { error: `${register}: the word number is not ${area.hex ? 'hexadecimal' : 'decimal'}` };
  if (word > area.max) return { error: `${register}: word ${wordText} is beyond the driver's range (${area.hex ? area.max.toString(16).toUpperCase() : area.max})` };
  const w = area.hex ? word.toString(16).toUpperCase().padStart(area.digits, '0') : String(word).padStart(area.digits, '0');
  return { mode: bit ? 'Bit' : 'Word', type: area.as ?? key, address: `${w}${bitText}`, readOnly: Boolean(area.readOnly), ...(area.note ? { note: area.note } : {}) };
}

/** The project's MP family when its panel is programmed in EasyBuilder Pro (Weintek, Maple); else null. */
export function weintekMpFamily(p: ProjectSnapshot): MpFamily | null {
  const m = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (!m || !(/EasyBuilder Pro/i.test(m.software ?? '') || /Weintek|Maple/i.test(hmiMaker(m)))) return null;
  const id = platformOf(p.cpu.id)?.id;
  return id === 'yaskawa-mp2000' || id === 'yaskawa-mp3000' ? id : null;
}

export interface WeintekTagRow { name: string; comment: string; device: string; mode: string; type: string; address: string; problem: string }

/** Every HMI tag with its EasyBuilder Pro address; a tag the driver cannot reach says why instead. */
export function weintekTagRows(p: ProjectSnapshot, family: MpFamily): WeintekTagRow[] {
  return hmiTagRows(p).map((r) => {
    const register = (r.plcIo || r.plcTag).replace(/^"[^"]*"\./, '');
    const w = mpToWeintek(register, family);
    const comment = [r.description, 'error' in w ? '' : w.readOnly ? 'read only' : '', 'error' in w ? '' : w.note ?? ''].filter(Boolean).join(' · ');
    return 'error' in w
      ? { name: r.name, comment, device: WEINTEK_MP_DRIVER[family], mode: '', type: '', address: '', problem: w.error }
      : { name: r.name, comment, device: WEINTEK_MP_DRIVER[family], mode: w.mode, type: w.type, address: w.address, problem: '' };
  });
}

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** The Address Tag Library rows as CSV (tags the driver cannot reach are left out; the README lists them). */
export function weintekTagCsv(p: ProjectSnapshot, family: MpFamily): string {
  const head = ['Name', 'Comment', 'Device', 'Address mode', 'Address type', 'Address'];
  const rows = weintekTagRows(p, family).filter((r) => !r.problem);
  return [head.map(cell).join(','), ...rows.map((r) => [r.name, r.comment, r.device, r.mode, r.type, r.address].map(cell).join(','))].join('\r\n');
}

/** README lines for the Weintek tag file. */
export function weintekReadme(p: ProjectSnapshot, family: MpFamily): string[] {
  const rows = weintekTagRows(p, family);
  const bad = rows.filter((r) => r.problem);
  return [
    '',
    `EasyBuilder Pro address tags (${p.fileBase}_weintek_tags.csv), for the "${WEINTEK_MP_DRIVER[family]}" driver:`,
    `- One row per HMI tag: Name, Comment, Device, Address mode (Bit / Word), Address type (MB, MW, IB …) and Address in the driver's format.`,
    '- Weintek does not publish the column order of the Address Tag Library CSV import. In EasyBuilder Pro, add one tag by hand, Export CSV, and arrange these columns the same way before Import CSV.',
    '- Device: rename it to the name of the PLC in your project\'s Device list.',
    ...(bad.length ? [`- Not on this driver (bind them by hand or map them to M registers in the program): ${bad.map((r) => `${r.name} (${r.problem})`).join('; ')}.`] : []),
  ];
}
