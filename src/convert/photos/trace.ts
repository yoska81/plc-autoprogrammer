import type { CatalogCategory, CatalogPart, FieldDeviceType } from '../../electrical/types';
import type { Confidence } from '../../lib/ai/importAI';
import { itemCategory, itemPart, type ReviewItem } from './items';

/**
 * Wiring from wire numbers: a wire number read at two places (a PLC terminal and a contactor coil, a
 * terminal strip and a module input) is one wire between them. From the photos' ferrule labels this
 * gives the connections that are traceable and, through the PLC's terminals, the I/O list: each PLC
 * input / output with the panel device or terminal-strip point it is wired to. A wire that leaves the
 * cabinet (only on a terminal strip) is an I/O point whose field device the photos can't show: it is
 * asked on the Machine description page.
 */

export interface WireEnd { tag: string; terminal: string; category: CatalogCategory | 'strip' }
export interface TracedWire { wire: string; ends: WireEnd[] }

export interface TracedIO {
  /** PLC address (CLICK style: X001, Y002, X101 for slot 1). */
  address: string;
  type: 'input' | 'output';
  wire: string;
  /** The panel device at the other end, '' when the wire only reaches a terminal strip (field device). */
  deviceTag: string;
  deviceType: FieldDeviceType;
  /** Terminal-strip point on the way out to the field, e.g. "TB1-3". */
  via: string;
  description: string;
  confidence: Confidence;
}

/** Same wire number however it was written ("1001", " 1001 ", "W1001" stays different). */
const normWire = (w: string) => w.trim().toUpperCase();

/** Every wire number seen at two or more places (confirmed or still pending items; rejected ones are not in the cabinet). */
export function traceWires(items: ReviewItem[], tagOf: (it: ReviewItem) => string): TracedWire[] {
  const nets = new Map<string, TracedWire>();
  const add = (wire: string, end: WireEnd) => {
    const k = normWire(wire);
    if (!k) return;
    const n = nets.get(k) ?? { wire: wire.trim(), ends: [] };
    if (!n.ends.some((e) => e.tag === end.tag && e.terminal === end.terminal)) n.ends.push(end);
    nets.set(k, n);
  };
  for (const it of items.filter((x) => x.status !== 'rejected')) {
    const tag = tagOf(it);
    if (it.kind === 'strip') for (const t of it.strip!.terminals) add(t.wire, { tag, terminal: t.terminal, category: 'strip' });
    else for (const w of it.device!.wires) add(w.wire, { tag, terminal: w.terminal, category: itemCategory(it) });
  }
  return [...nets.values()].filter((n) => n.ends.length >= 2).sort((a, b) => a.wire.localeCompare(b.wire, undefined, { numeric: true }));
}

/** Wire numbers read at one place only (the other end is not in the photos). */
export function singleWires(items: ReviewItem[], tagOf: (it: ReviewItem) => string): { wire: string; at: string }[] {
  const seen = new Map<string, { wire: string; at: string[] }>();
  for (const it of items.filter((x) => x.status !== 'rejected')) {
    const tag = tagOf(it);
    const list = it.kind === 'strip' ? it.strip!.terminals : it.device!.wires;
    for (const w of list) {
      const k = normWire(w.wire);
      if (!k) continue;
      const e = seen.get(k) ?? { wire: w.wire.trim(), at: [] };
      if (!e.at.includes(`${tag}:${w.terminal}`)) e.at.push(`${tag}:${w.terminal}`);
      seen.set(k, e);
    }
  }
  return [...seen.values()].filter((e) => e.at.length === 1).map((e) => ({ wire: e.wire, at: e.at[0] })).sort((a, b) => a.wire.localeCompare(b.wire, undefined, { numeric: true }));
}

/** Field device type of a panel device a PLC terminal drives or reads. */
function deviceTypeOf(cat: CatalogCategory | 'strip', terminal: string, type: 'input' | 'output'): FieldDeviceType {
  if (type === 'output') return cat === 'contactor' ? 'contactor-coil' : cat === 'relay' ? 'relay-coil' : cat === 'vfd' ? 'vfd-input' : cat === 'pilotLight' ? 'pilot-light' : cat === 'stackLight' ? 'stack-light' : 'other';
  if (cat === 'safetyRelay') return 'safety-relay-output';
  if (cat === 'pushbutton') return /NC|2$/i.test(terminal) ? 'pushbutton-nc' : 'pushbutton-no';
  if (cat === 'estop') return 'estop-contact';
  if (cat === 'selector') return 'selector';
  return 'other';
}

const pad3 = (n: number) => String(n).padStart(3, '0');

/**
 * The PLC address of a terminal: the CPU's X1 / Y2 (CLICK: X001 / Y002), an I/O module's point n in
 * slot s (X/Y s0n, e.g. X101). Null when the terminal is not an I/O point (power, common).
 */
export function plcAddress(terminal: string, cat: CatalogCategory, slot: number, moduleKind: 'input' | 'output' | null): { address: string; type: 'input' | 'output' } | null {
  const t = terminal.trim().toUpperCase();
  const xy = /^%?([XYIQ])\s*0*(\d{1,3})$/.exec(t);
  if (cat === 'plc') {
    if (!xy) return null;
    const type = xy[1] === 'X' || xy[1] === 'I' ? 'input' : 'output';
    return { address: `${type === 'input' ? 'X' : 'Y'}${pad3(Number(xy[2]))}`, type };
  }
  if (cat === 'plcModule' && moduleKind) {
    const n = xy ? Number(xy[2]) : /^\d{1,2}$/.test(t) ? Number(t) : NaN;
    if (!Number.isFinite(n) || n < 1) return null;
    return { address: `${moduleKind === 'input' ? 'X' : 'Y'}${slot}${String(n).padStart(2, '0')}`, type: moduleKind };
  }
  return null;
}

/** The I/O list the traceable wires show (one point per PLC terminal with a wire number). */
export function traceIO(items: ReviewItem[], wires: TracedWire[], tagOf: (it: ReviewItem) => string, getPart: (pn: string) => CatalogPart | undefined): TracedIO[] {
  const kept = items.filter((x) => x.status !== 'rejected' && x.kind === 'device');
  const modules = kept.filter((it) => itemCategory(it) === 'plcModule').sort((a, b) => a.device!.rail - b.device!.rail || a.device!.order - b.device!.order);
  const kindOf = (it: ReviewItem): 'input' | 'output' | null => {
    const r = getPart(itemPart(it))?.ratings as Record<string, unknown> | undefined;
    if (r?.inputs) return 'input';
    if (r?.outputs) return 'output';
    const d = `${it.device!.ratings} ${itemPart(it)}`;
    return /\binput|N[DA]\d/i.test(d) ? 'input' : /\boutput|T[DR]\d|RLY/i.test(d) ? 'output' : null;
  };
  const plcs = kept.filter((it) => ['plc', 'plcModule'].includes(itemCategory(it)));
  const out: TracedIO[] = [];
  for (const it of plcs) {
    const cat = itemCategory(it);
    const slot = cat === 'plcModule' ? modules.indexOf(it) + 1 : 0;
    const tag = tagOf(it);
    for (const w of it.device!.wires) {
      const a = plcAddress(w.terminal, cat, slot, cat === 'plcModule' ? kindOf(it) : null);
      if (!a) continue;
      const net = wires.find((n) => normWire(n.wire) === normWire(w.wire));
      const others = (net?.ends ?? []).filter((e) => e.tag !== tag);
      const dev = others.find((e) => e.category !== 'strip');
      const strip = others.find((e) => e.category === 'strip');
      const via = strip ? `${strip.tag}-${strip.terminal}` : '';
      out.push({
        address: a.address, type: a.type, wire: w.wire, via,
        deviceTag: dev?.tag ?? '', deviceType: dev ? deviceTypeOf(dev.category, dev.terminal, a.type) : 'other',
        description: dev ? `${dev.tag} ${a.type === 'output' && /coil|^A\d/i.test(dev.terminal) ? `${dev.category} coil` : dev.category} (wire ${w.wire})` : via ? `Field device on ${via} (wire ${w.wire})` : `Wire ${w.wire} — other end not visible`,
        confidence: dev ? 'high' : via ? 'medium' : 'low',
      });
    }
  }
  return out.sort((x, y) => x.address.localeCompare(y.address, undefined, { numeric: true }));
}

/** What the trace can't tell: the field device behind each terminal-strip point, wires seen at one end only. */
export function traceQuestions(io: TracedIO[]): string[] {
  return io.filter((p) => !p.deviceTag).map((p) => (p.via
    ? `Cabinet photos: which field device is wired to ${p.via} (wire ${p.wire}, PLC ${p.type} ${p.address})?`
    : `Cabinet photos: where does wire ${p.wire} from PLC ${p.type} ${p.address} go?`));
}
