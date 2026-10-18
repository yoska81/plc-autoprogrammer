import type { CatalogCategory, CatalogPart, DesignComponent, DesignInputs, ElectricalDesign } from '../../electrical/types';
import type { PhotoDevice, PhotoReading, TerminalStrip } from './recognise';

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
