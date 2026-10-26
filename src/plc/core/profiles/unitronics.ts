/**
 * Unitronics: the hardware side shared by the UniStream (UniLogic) and Vision / Samba (VisiLogic) profiles —
 * CPU models from the catalog (src/electrical/catalogs/unitronics.ts), neutral addressing, analog channels.
 *
 * The program is written in the app's neutral memory (X/Y by slot, C, T, CT, DS, DD, DF) like every profile;
 * the exporters map it onto UniLogic tags (unilogic.ts) or VisiLogic operands (visilogic.ts).
 * - On-board points X001… / Y001… (Unitronics CPUs have up to 22 on board, so a slot holds up to 32 points);
 *   module slot k (Uni-I/O module, Vision snap-in) = Xk01… / Yk01….
 * - Vision / Samba analog inputs use digital input terminals (ratings.analogSharedWith, e.g. I14 / I15 on a
 *   V350-35-TR34): while such a channel is used, that digital input is not given out.
 */
import type { AddressInfo, AnalogChannel, CpuModel, ModuleSlot } from '../profile';
import type { AnalogRange } from '../../../types/io';
import type { CatalogPart } from '../../../electrical/types';
import { getPart } from '../../../electrical/catalog';
import { parseAddress as neutralParse } from './click';
import { platformById } from '../platforms';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function cpuModel(pn: string): CpuModel {
  const p = getPart(pn);
  const r = p?.ratings ?? {};
  const di = num(r.discreteInputs), dq = num(r.discreteOutputs), ai = num(r.analogInputs), aq = num(r.analogOutputs);
  const io = di || dq ? `${di} DI / ${dq} DO${ai ? ` / ${ai} analog in` : ''}${aq ? ` / ${aq} analog out` : ''}` : 'no on-board I/O';
  const outs = r.outputStyle === 'relay' ? ', relay out' : r.outputStyle === 'sourcing' ? ', sourcing out' : '';
  const screen = r.builtInPanel === 'yes' ? `, built-in ${r.displayIn}" touch screen` : '';
  const eth = num(r.ethernetPorts) > 0 ? ', Ethernet' : '';
  const platformId = String(r.plcDrivers ?? '') || (p?.family === 'Samba' ? 'unitronics-samba' : p?.family === 'Vision' ? 'unitronics-vision' : 'unitronics-unistream');
  return {
    id: pn, label: `${pn} — ${p?.family ?? 'Unitronics'}${screen}, ${io}${outs}${eth}`, builtInInputs: di, builtInOutputs: dq, platformId,
    notes: String(r.expansion ?? ''),
  };
}

export const UNISTREAM_CPUS: CpuModel[] = (platformById('unitronics-unistream')?.cpus ?? []).map(cpuModel);
export const VISION_CPUS: CpuModel[] = [...(platformById('unitronics-vision')?.cpus ?? []), ...(platformById('unitronics-samba')?.cpus ?? [])].map(cpuModel);

const IO_RE = /^([XY])([0-8])(\d\d)$/;

/** Neutral memory with up to 32 points per slot (on-board Vision I/O has 22). */
export function unitronicsParse(raw: string): AddressInfo | null {
  const io = IO_RE.exec(raw.trim().toUpperCase());
  if (io) { const n = Number(io[3]); return n >= 1 && n <= 32 ? { kind: io[1] === 'X' ? 'input' : 'output', isBit: true } : null; }
  return neutralParse(raw);
}

/** Signal ranges named in a datasheet range text ("0-10V, 0-20mA, 4-20mA"). */
function rangesOf(text: unknown): AnalogRange[] {
  const t = String(text ?? '').replace(/\s+/g, '').toLowerCase();
  const out: AnalogRange[] = [];
  if (/(^|[^.\d])0-10v/.test(t)) out.push('0-10V');
  if (/0-20ma/.test(t)) out.push('0-20mA');
  // "4-20mA implemented using the 0-20mA range" (UIA-0402N) still accepts a 4-20 mA transmitter.
  if (/4-20ma/.test(t) || /0-20ma/.test(t)) out.push('4-20mA');
  return out;
}

/**
 * Analog channels: CPU on-board first, then modules in slot order (inputs before outputs), each a DF register.
 * Terminals: the datasheet's names where it gives them (UniStream "AI0", shared Vision input "I14"), else
 * the channel number.
 */
export function unitronicsAnalogChannels(c: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 0;
  const cpu = getPart(c.id);
  const r = cpu?.ratings ?? {};
  const shared = String(r.analogSharedWith ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const inRanges = rangesOf(r.analogInputRange);
  for (let i = 0; i < num(r.analogInputs); i++) {
    const sh = shared[i];
    out.push({
      kind: 'input', slot: 0, channel: i + 1, partNumber: c.id, label: sh ? `CPU analog ${i} (input ${sh})` : `CPU AI${i}`,
      ranges: inRanges.length ? inRanges : ['0-10V'], terminals: [sh ?? `AI${i}`], address: `DF${++df}`,
      ...(sh ? { sharesInput: `X0${String(Number(sh.slice(1)) + 1).padStart(2, '0')}` } : {}),
    });
  }
  for (let i = 0; i < num(r.analogOutputs); i++) out.push({ kind: 'output', slot: 0, channel: i + 1, partNumber: c.id, label: `CPU AO${i}`, ranges: rangesOf(r.analogOutputRange), terminals: [`AO${i}`], address: `DF${++df}` });
  modules.forEach((m, k) => {
    const mr = getPart(m.partNumber)?.ratings ?? {};
    const ri = rangesOf(mr.analogInputRange), ro = rangesOf(mr.analogOutputRange);
    for (let i = 0; i < (m.analogInputs ?? 0); i++) out.push({ kind: 'input', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Slot ${k + 1} AI${i}`, ranges: ri.length ? ri : ['0-10V'], terminals: [`AI${i}`], address: `DF${++df}` });
    for (let i = 0; i < (m.analogOutputs ?? 0); i++) out.push({ kind: 'output', slot: k + 1, channel: i + 1, partNumber: m.partNumber, label: `Slot ${k + 1} AO${i}`, ranges: ro.length ? ro : ['0-10V'], terminals: [`AO${i}`], address: `DF${++df}` });
  });
  return out;
}

/** Neutral addresses of the small npn transistor outputs of mostly-relay CPUs / modules (ratings.npnOutputs): given out last. */
export function npnOutputsLast(c: CpuModel, modules: ModuleSlot[]): Set<string> {
  const out = new Set<string>();
  const add = (pn: string, slot: number) => {
    for (const o of String(getPart(pn)?.ratings.npnOutputs ?? '').split(',').map((x) => x.trim()).filter(Boolean)) out.add(`Y${slot}${String(Number(o.slice(1)) + 1).padStart(2, '0')}`);
  };
  add(c.id, 0);
  modules.forEach((m, k) => add(m.partNumber, k + 1));
  return out;
}

/** Physical point of a neutral X/Y address: CPU on-board (slot 0) or module slot k, point index from 0. */
export function pointOf(base: string): { isInput: boolean; slot: number; index: number } | null {
  const m = IO_RE.exec(base.toUpperCase());
  return m ? { isInput: m[1] === 'X', slot: Number(m[2]), index: Number(m[3]) - 1 } : null;
}

export const cpuPart = (cpuId: string | undefined): CatalogPart | undefined => (cpuId ? getPart(cpuId) : undefined);
