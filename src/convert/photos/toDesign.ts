import type { CatalogCategory, CatalogPart, DesignComponent, DesignInputs, ElectricalDesign } from '../../electrical/types';
import type { PhotoReading } from './recognise';
import { closest, itemCategory, itemPart, itemTag, type ReviewItem } from './items';
import type { Sighting } from './recognise';

export { itemCategory, itemPart, itemTag, type ReviewItem, type ReviewStatus } from './items';
import type { DrawnComponent, DrawnRatings, ExistingMachine } from '../types';
import { normalizeMachine } from '../derive';
import { CATALOG } from '../../electrical/catalog';
import type { IOCategory, IOPoint } from '../../types/io';
import { traceIO, traceQuestions, traceWires, type TracedIO } from './trace';

/**
 * The REVIEW step and its result. Every recognised device and terminal strip is an item the user
 * confirms, corrects (tag, part number, kind) or rejects; the confirmed ones become an as-built
 * electrical design: the parts (matched to the catalog where the nameplate number is in it), the
 * DIN rails in the photographed order (ElectricalDesign.asBuilt), and what could not be seen as
 * questions for the Machine description page.
 */

/** Review items for a (merged) reading: high-confidence items start confirmed, the rest wait for the user. */
export function reviewItems(r: PhotoReading): ReviewItem[] {
  return [
    ...r.devices.map((d, i): ReviewItem => ({ key: `d${i}`, kind: 'device', device: d, status: d.confidence === 'high' && d.partNumber ? 'confirmed' : 'pending' })),
    ...r.strips.map((s, i): ReviewItem => ({ key: `s${i}`, kind: 'strip', strip: s, status: s.confidence === 'high' ? 'confirmed' : 'pending' })),
  ];
}

const PREFIX: Partial<Record<CatalogCategory, string>> = {
  disconnect: 'DS', breaker: 'CB', fuse: 'FU', powerSupply: 'PS', contactor: 'K', overload: 'OL', motorProtector: 'MP',
  vfd: 'VFD', relay: 'CR', safetyRelay: 'SR', plc: 'PLC', plcModule: 'IO', terminal: 'TB', pushbutton: 'PB', estop: 'ES',
  pilotLight: 'PL', selector: 'SS', stackLight: 'LT', hmi: 'HMI', fan: 'FAN', enclosure: 'ENC', groundBar: 'GND',
};

/** Part numbers compared without case, spaces, dots, dashes or slashes ("SC-E02PG-24VDC" = "SCE02PG 24VDC"). */
const squash = (pn: string) => pn.toUpperCase().replace(/[\s.\-_/]+/g, '');
let squashed: Map<string, CatalogPart> | null = null;

/** The catalog part a nameplate number names: exact first, then ignoring case, spaces, dots and dashes. */
export function matchPart(pn: string, getPart: (pn: string) => CatalogPart | undefined, catalog: CatalogPart[] = CATALOG): CatalogPart | undefined {
  if (!pn.trim()) return undefined;
  const exact = getPart(pn.trim());
  if (exact) return exact;
  if (!squashed) squashed = new Map(catalog.map((p) => [squash(p.partNumber), p]));
  return squashed.get(squash(pn));
}

/** I/O list category of a traced point (by what it is wired to). */
function ioCategory(p: TracedIO): IOCategory {
  if (p.deviceType === 'safety-relay-output' || p.deviceType === 'estop-contact') return 'Safety';
  if (/pushbutton|selector|pilot|stack/.test(p.deviceType)) return 'Operator/HMI';
  return 'Station 1';
}

/** Traced I/O as I/O list points with their PLC address as read. */
export const tracedPoints = (io: TracedIO[]): Omit<IOPoint, 'id'>[] =>
  io.map((p) => ({ description: p.description, type: p.type, category: ioCategory(p), plcAddress: p.address, deviceType: p.deviceType }));

export interface AsBuiltResult {
  design: ElectricalDesign;
  /** The I/O list the traceable wires show (PLC address as read), and every traced wire. */
  io: TracedIO[];
  /** For the Machine description page: what the photos could not show. */
  questions: string[];
  /** Confirmed devices whose part number is not in the catalog (kept as read, marked "verify"). */
  notInCatalog: string[];
}

/**
 * A tag of its kind for each item without a label (CB3, K2 …), never one the photos already show; the
 * same for every output of one review (rejected items take no number).
 */
export function tagger(all: ReviewItem[]) {
  const items = all.filter((it) => it.status !== 'rejected');
  const used = new Set(items.map(itemTag).filter(Boolean).map((t) => t.toUpperCase()));
  // Numbered up front in review order, so every output gives an unlabelled device the same tag.
  const given = new Map<string, string>();
  for (const it of items) {
    if (itemTag(it)) continue;
    const p = PREFIX[itemCategory(it)] ?? 'D';
    let n = 1;
    while (used.has(`${p}${n}`)) n++;
    used.add(`${p}${n}`);
    given.set(it.key, `${p}${n}`);
  }
  return (it: ReviewItem) => itemTag(it) || given.get(it.key) || '';
}

export function asBuiltDesign(items: ReviewItem[], reading: PhotoReading, base: DesignInputs, getPart: (pn: string) => CatalogPart | undefined, now = new Date().toISOString()): AsBuiltResult {
  const confirmed = items.filter((it) => it.status === 'confirmed');
  // One tagger for both outputs (and the review): unlabelled devices get the same tag everywhere.
  const tagOf = tagger(items);
  const components: DesignComponent[] = [];
  const notInCatalog: string[] = [];
  const placed: { rail: number; order: number; tag: string }[] = [];
  for (const it of confirmed) {
    const cat = itemCategory(it);
    const tag = tagOf(it);
    if (it.kind === 'strip') {
      const s = it.strip!;
      if (s.rail) placed.push({ rail: s.rail, order: s.order, tag });
      continue;
    }
    const d = it.device!;
    const read = itemPart(it);
    const part = matchPart(read, getPart);
    if (read && !part) notInCatalog.push(`${tag} ${read}`);
    const nameplate = [d.manufacturer, read, d.ratings].filter(Boolean).join(' ');
    components.push({ tag, partNumber: part?.partNumber ?? read, quantity: 1, function: `${nameplate || 'Device'} (as-built from photos — verify)`, ...(part ? {} : { category: cat }) });
    if (d.rail) placed.push({ rail: d.rail, order: d.order, tag });
  }
  const railNos = [...new Set(placed.map((p) => p.rail))].sort((a, b) => a - b);
  const rails = railNos.map((r) => placed.filter((p) => p.rail === r).sort((a, b) => a.order - b.order).map((p) => p.tag));
  const pending = items.filter((it) => it.status === 'pending');
  const wires = traceWires(confirmed, tagOf);
  const io = traceIO(confirmed, wires, tagOf, getPart);
  const questions = [
    ...reading.unseen.map((u) => `Cabinet photos: ${u}`),
    ...traceQuestions(io),
    ...pending.map((it) => `Cabinet photos: ${it.kind === 'strip' ? 'terminal strip' : 'device'} ${itemTag(it) || '(no label)'}${itemPart(it) ? ` ${itemPart(it)}` : ''} on rail ${it.device?.rail ?? it.strip?.rail ?? '?'} could not be confirmed from the photos — what is it?`),
  ];
  const notes = [
    'As-built from photos — verify every part number, rating and wire on the cabinet before relying on these drawings.',
    ...(notInCatalog.length ? [`Not in the parts catalog (kept as read from the nameplate): ${notInCatalog.join(', ')}.`] : []),
  ];
  return {
    design: {
      inputs: base, components, notes, askUser: questions, generatedAt: now,
      ioWiring: io.map((p) => ({ address: p.address, deviceTag: p.deviceTag || p.via || `W${p.wire}`, deviceType: p.deviceType, description: p.description, location: p.deviceTag ? 'Cabinet' : 'Field (not in the photos)' })),
      asBuilt: { source: 'photos', rails, wires: wires.map((w) => ({ wire: w.wire, ends: w.ends.map((e) => `${e.tag}:${e.terminal}`) })) },
    },
    io,
    questions,
    notInCatalog,
  };
}

/** Ratings printed on a nameplate, in the drawings reader's shape (null when not printed). */
export function nameplateRatings(text: string): DrawnRatings {
  const n = (re: RegExp) => { const m = re.exec(text); return m ? Number(m[1]) : null; };
  const range = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*A\b/i.exec(text);
  const out = /(\d+(?:\.\d+)?)\s*V\s*DC\b[^\d]*(\d+(?:\.\d+)?)\s*A\b/i.exec(text);
  const coil = /(\d+)\s*V\s*(AC|DC)\s*coil|coil\s*(\d+)\s*V\s*(AC|DC)/i.exec(text);
  return {
    amps: range ? null : n(/(\d+(?:\.\d+)?)\s*A\b/) ?? n(/\b[BCD](\d+)\b/),
    poles: n(/(\d)\s*-?\s*pole/i),
    coilVoltage: coil ? `${coil[1] ?? coil[3]}V${(coil[2] ?? coil[4]).toUpperCase()}` : null,
    kA: n(/(\d+(?:\.\d+)?)\s*kA\b/i),
    curve: /\b([BCD])\d+\b/.exec(text)?.[1] ?? null,
    minAmps: range ? Number(range[1]) : null,
    maxAmps: range ? Number(range[2]) : null,
    kw: n(/(\d+(?:\.\d+)?)\s*kW\b/i),
    outputVolts: out ? Number(out[1]) : null,
    outputAmps: out ? Number(out[2]) : null,
  };
}

/**
 * The reviewed photos as an existing machine (src/convert/types.ts), for the shared review →
 * conversion → rebuild path of the Import page: the devices with their nameplates and where they
 * were seen, the terminal strips' wire numbers as text, and the questions the photos leave open.
 * Rejected items are left out; unconfirmed ones go in with their own confidence (the shared review
 * asks the user about low-confidence readings).
 */
export function photosToMachine(items: ReviewItem[], reading: PhotoReading, note = '', getPart: (pn: string) => CatalogPart | undefined = () => undefined): ExistingMachine {
  const kept = items.filter((it) => it.status !== 'rejected');
  const tagOf = tagger(items);
  const wires = traceWires(kept, tagOf);
  const io = traceIO(kept, wires, tagOf, getPart);
  const where = (s: { seen: Sighting[]; rail: number; order: number }) => `photo ${(closest(s.seen)?.photo ?? 0) + 1}${s.rail ? `, rail ${s.rail}, position ${s.order}` : ', door / wall'}`;
  const components: DrawnComponent[] = kept.filter((it) => it.kind === 'device').map((it) => {
    const d = it.device!;
    return {
      tag: tagOf(it), partNumber: itemPart(it) || null, manufacturer: d.manufacturer || null,
      description: [d.manufacturer, itemPart(it), d.ratings].filter(Boolean).join(' ') || itemCategory(it),
      category: itemCategory(it), ratings: nameplateRatings(d.ratings), source: where(d),
      confidence: it.status === 'confirmed' ? 'high' : d.confidence,
      wires: d.wires, photos: d.seen,
    };
  });
  const plcDev = kept.find((it) => itemCategory(it) === 'plc');
  const terminals = kept.filter((it) => it.kind === 'strip').flatMap((it) => it.strip!.terminals.map((t) => ({ strip: tagOf(it), terminal: t.terminal, wire: t.wire })));
  return normalizeMachine({
    summary: reading.summary,
    drawingStandard: 'other',
    language: 'English',
    plc: plcDev ? { vendor: plcDev.device!.manufacturer, model: itemPart(plcDev), cpuPartNumber: itemPart(plcDev) || null } : null,
    modules: kept.filter((it) => itemCategory(it) === 'plcModule').map((it, i) => ({ slot: i + 1, partNumber: itemPart(it), description: it.device!.ratings })),
    components,
    io: io.map((p) => ({ address: p.address, description: p.description, type: p.type, category: ioCategory(p), deviceTag: p.deviceTag || null, deviceType: p.deviceType, confidence: p.confidence, source: `wire ${p.wire}${p.via ? ` via ${p.via}` : ''} (photos)` })),
    spec: { utilities: note.trim() } as ExistingMachine['spec'],
    terminals,
    wiring: wires.map((w) => ({ wire: w.wire, ends: w.ends.map((e) => `${e.tag}:${e.terminal}`) })),
    questions: [...reading.unseen, ...traceQuestions(io).map((q) => q.replace(/^Cabinet photos: /, ''))].map((text) => ({ text, section: 'other' as const, assumption: null })),
    uncertainties: ['As-built from photos: wiring behind ducts and covered nameplates could not be read — verify on the cabinet.'],
  });
}
