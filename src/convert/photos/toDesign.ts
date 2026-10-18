import type { CatalogCategory, CatalogPart, DesignComponent, DesignInputs, ElectricalDesign } from '../../electrical/types';
import type { PhotoDevice, PhotoReading, TerminalStrip } from './recognise';
import type { DrawnComponent, DrawnRatings, ExistingMachine } from '../types';
import { normalizeMachine } from '../derive';

/**
 * The REVIEW step and its result. Every recognised device and terminal strip is an item the user
 * confirms, corrects (tag, part number, kind) or rejects; the confirmed ones become an as-built
 * electrical design: the parts (matched to the catalog where the nameplate number is in it), the
 * DIN rails in the photographed order (ElectricalDesign.asBuilt), and what could not be seen as
 * questions for the Machine description page.
 */

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export interface ReviewItem {
  key: string;
  kind: 'device' | 'strip';
  device?: PhotoDevice;
  strip?: TerminalStrip;
  status: ReviewStatus;
  /** The user's corrections. */
  tag?: string;
  partNumber?: string;
  category?: CatalogCategory;
}

/** Review items for a (merged) reading: high-confidence items start confirmed, the rest wait for the user. */
export function reviewItems(r: PhotoReading): ReviewItem[] {
  return [
    ...r.devices.map((d, i): ReviewItem => ({ key: `d${i}`, kind: 'device', device: d, status: d.confidence === 'high' && d.partNumber ? 'confirmed' : 'pending' })),
    ...r.strips.map((s, i): ReviewItem => ({ key: `s${i}`, kind: 'strip', strip: s, status: s.confidence === 'high' ? 'confirmed' : 'pending' })),
  ];
}

export const itemTag = (it: ReviewItem) => (it.tag ?? it.device?.tag ?? it.strip?.tag ?? '').trim();
export const itemPart = (it: ReviewItem) => (it.partNumber ?? it.device?.partNumber ?? '').trim();
export const itemCategory = (it: ReviewItem): CatalogCategory => it.category ?? it.device?.category ?? 'terminal';

const PREFIX: Partial<Record<CatalogCategory, string>> = {
  disconnect: 'DS', breaker: 'CB', fuse: 'FU', powerSupply: 'PS', contactor: 'K', overload: 'OL', motorProtector: 'MP',
  vfd: 'VFD', relay: 'CR', safetyRelay: 'SR', plc: 'PLC', plcModule: 'IO', terminal: 'TB', pushbutton: 'PB', estop: 'ES',
  pilotLight: 'PL', selector: 'SS', stackLight: 'LT', hmi: 'HMI', fan: 'FAN', enclosure: 'ENC', groundBar: 'GND',
};

/** The catalog part a nameplate number names (exact, then without spaces / dots / case). */
export function matchPart(pn: string, getPart: (pn: string) => CatalogPart | undefined): CatalogPart | undefined {
  if (!pn) return undefined;
  return getPart(pn) ?? getPart(pn.toUpperCase()) ?? getPart(pn.replace(/[\s.]+/g, '')) ?? getPart(pn.toUpperCase().replace(/[\s.]+/g, ''));
}

export interface AsBuiltResult {
  design: ElectricalDesign;
  /** For the Machine description page: what the photos could not show. */
  questions: string[];
  /** Confirmed devices whose part number is not in the catalog (kept as read, marked "verify"). */
  notInCatalog: string[];
}

export function asBuiltDesign(items: ReviewItem[], reading: PhotoReading, base: DesignInputs, getPart: (pn: string) => CatalogPart | undefined, now = new Date().toISOString()): AsBuiltResult {
  const confirmed = items.filter((it) => it.status === 'confirmed');
  const used = new Set(confirmed.map(itemTag).filter(Boolean).map((t) => t.toUpperCase()));
  const nextTag = (cat: CatalogCategory) => {
    const p = PREFIX[cat] ?? 'D';
    let n = 1;
    while (used.has(`${p}${n}`)) n++;
    used.add(`${p}${n}`);
    return `${p}${n}`;
  };
  const components: DesignComponent[] = [];
  const notInCatalog: string[] = [];
  const placed: { rail: number; order: number; tag: string }[] = [];
  for (const it of confirmed) {
    const cat = itemCategory(it);
    const tag = itemTag(it) || nextTag(cat);
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
  const questions = [
    ...reading.unseen.map((u) => `Cabinet photos: ${u}`),
    ...pending.map((it) => `Cabinet photos: ${it.kind === 'strip' ? 'terminal strip' : 'device'} ${itemTag(it) || '(no label)'}${itemPart(it) ? ` ${itemPart(it)}` : ''} on rail ${it.device?.rail ?? it.strip?.rail ?? '?'} could not be confirmed from the photos — what is it?`),
  ];
  const notes = [
    'As-built from photos — verify every part number, rating and wire on the cabinet before relying on these drawings.',
    ...(notInCatalog.length ? [`Not in the parts catalog (kept as read from the nameplate): ${notInCatalog.join(', ')}.`] : []),
  ];
  return {
    design: {
      inputs: base, components, ioWiring: [], notes, askUser: questions, asBuilt: { source: 'photos', rails }, generatedAt: now,
    },
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
export function photosToMachine(items: ReviewItem[], reading: PhotoReading, note = ''): ExistingMachine {
  const kept = items.filter((it) => it.status !== 'rejected');
  const where = (s: { seen: { photo: number }[]; rail: number; order: number }) => `photo ${(s.seen[0]?.photo ?? 0) + 1}${s.rail ? `, rail ${s.rail}, position ${s.order}` : ', door / wall'}`;
  const components: DrawnComponent[] = kept.filter((it) => it.kind === 'device').map((it) => {
    const d = it.device!;
    return {
      tag: itemTag(it), partNumber: itemPart(it) || null, manufacturer: d.manufacturer || null,
      description: [d.manufacturer, itemPart(it), d.ratings].filter(Boolean).join(' ') || itemCategory(it),
      category: itemCategory(it), ratings: nameplateRatings(d.ratings), source: where(d),
      confidence: it.status === 'confirmed' ? 'high' : d.confidence,
    };
  });
  const plcDev = kept.find((it) => itemCategory(it) === 'plc');
  const strips = kept.filter((it) => it.kind === 'strip').map((it) => `${itemTag(it) || 'Terminal strip'}: ${it.strip!.terminals.map((t) => `${t.terminal} = wire ${t.wire}`).join(', ')}`);
  return normalizeMachine({
    summary: reading.summary,
    drawingStandard: 'other',
    language: 'English',
    plc: plcDev ? { vendor: plcDev.device!.manufacturer, model: itemPart(plcDev), cpuPartNumber: itemPart(plcDev) || null } : null,
    modules: kept.filter((it) => itemCategory(it) === 'plcModule').map((it, i) => ({ slot: i + 1, partNumber: itemPart(it), description: it.device!.ratings })),
    components,
    spec: { utilities: [note.trim(), strips.length ? `Terminal strips as photographed:\n${strips.join('\n')}` : ''].filter(Boolean).join('\n') } as ExistingMachine['spec'],
    questions: reading.unseen.map((text) => ({ text, section: 'other' as const, assumption: null })),
    uncertainties: ['As-built from photos: wiring behind ducts and covered nameplates could not be read — verify on the cabinet.'],
  });
}
