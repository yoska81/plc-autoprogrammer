import type { CatalogPart } from './types';

/** Ratings where a higher number is the stronger part, with a plain-words label. */
const HIGHER_IS_STRONGER: { key: string; label: string; unit: string }[] = [
  { key: 'amps', label: 'current rating', unit: 'A' },
  { key: 'maxAmps', label: 'maximum current', unit: 'A' },
  { key: 'outputAmps', label: 'output current', unit: 'A' },
  { key: 'secondaryAmps', label: 'output current', unit: 'A' },
  { key: 'hp480', label: 'motor rating at 480 V', unit: 'hp' },
  { key: 'hp230', label: 'motor rating at 230 V', unit: 'hp' },
  { key: 'va', label: 'power', unit: 'VA' },
  { key: 'watts', label: 'power', unit: 'W' },
  { key: 'volts', label: 'voltage rating', unit: 'V' },
  { key: 'interruptingKA', label: 'interrupting rating', unit: 'kA' },
  { key: 'sccrKA', label: 'short-circuit rating', unit: 'kA' },
  { key: 'poles', label: 'number of poles', unit: '' },
  { key: 'contacts', label: 'number of contacts', unit: '' },
  { key: 'ports', label: 'number of ports', unit: '' },
  { key: 'widthIn', label: 'width', unit: 'in' },
  { key: 'heightIn', label: 'height', unit: 'in' },
  { key: 'depthIn', label: 'depth', unit: 'in' },
];

/** Ratings that must match exactly or the part does not work in this circuit. */
const MUST_MATCH: { key: string; label: string }[] = [
  { key: 'coilVoltage', label: 'coil voltage' },
  { key: 'outputVolts', label: 'output voltage' },
  { key: 'secondaryVolts', label: 'output voltage' },
  { key: 'fuseClass', label: 'fuse class' },
];

/** Enclosure protection, weakest to strongest. */
const NEMA_ORDER = ['1', '12', '4', '4X'];

export interface Strength { ok: boolean; reason: string; better: boolean }

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null);

/**
 * Compare a candidate with the part the design uses now. Weaker on any key
 * rating (or incompatible) = not ok, with the reason in plain words; equal or
 * stronger everywhere = ok. `better` is set when it is stronger somewhere.
 */
export function compareStrength(current: CatalogPart, candidate: CatalogPart): Strength {
  if (candidate.partNumber === current.partNumber) return { ok: true, reason: 'Current part', better: false };
  const a = current.ratings;
  const b = candidate.ratings;
  for (const m of MUST_MATCH) {
    if (a[m.key] !== undefined && b[m.key] !== undefined && String(a[m.key]) !== String(b[m.key])) {
      return { ok: false, reason: `Different ${m.label} (${b[m.key]} instead of ${a[m.key]})`, better: false };
    }
  }
  let better = false;
  for (const h of HIGHER_IS_STRONGER) {
    const x = num(a[h.key]);
    const y = num(b[h.key]);
    if (x === null || y === null) continue;
    if (y < x) return { ok: false, reason: `Lower ${h.label}: ${y}${h.unit && ' ' + h.unit} vs ${x}${h.unit && ' ' + h.unit}`, better: false };
    if (y > x) better = true;
  }
  const na = NEMA_ORDER.indexOf(String(a.nema ?? '').replace(/^NEMA\s*/i, ''));
  const nb = NEMA_ORDER.indexOf(String(b.nema ?? '').replace(/^NEMA\s*/i, ''));
  if (na >= 0 && nb >= 0) {
    if (nb < na) return { ok: false, reason: `Lower protection: NEMA ${NEMA_ORDER[nb]} vs NEMA ${NEMA_ORDER[na]}`, better: false };
    if (nb > na) better = true;
  }
  return { ok: true, reason: better ? 'Stronger' : 'Equivalent', better };
}

/** Same kind of part within a catalog group (an enclosure is not swapped for a subpanel, a fuse for a fuse holder). */
export function sameKind(a: CatalogPart, b: CatalogPart): boolean {
  return a.category === b.category && subKind(a) === subKind(b);
}

function subKind(p: CatalogPart): string {
  const r = p.ratings;
  if (r.kind !== undefined) return String(r.kind);
  if (p.category === 'fuse') return r.poles !== undefined || /holder|fuse ?block|carrier/i.test(p.description) ? 'holder' : 'cartridge';
  // Mixed groups: only parts of the same family/type are interchangeable.
  if (p.category === 'other' || p.category === 'terminalAccessory') return String(r.type ?? r.family ?? p.partNumber);
  return '';
}

/** Short summary of the ratings that matter for choosing, for tables. */
export function keyRatings(p: CatalogPart): string {
  const r = p.ratings;
  const out: string[] = [];
  for (const h of HIGHER_IS_STRONGER) if (r[h.key] !== undefined) out.push(`${r[h.key]}${h.unit && ' ' + h.unit}${h.key === 'poles' ? ' pole' : h.key === 'contacts' ? ' contacts' : h.key === 'ports' ? ' ports' : ''}`);
  for (const m of MUST_MATCH) if (r[m.key] !== undefined) out.push(String(r[m.key]));
  if (r.nema !== undefined) out.push(`NEMA ${String(r.nema).replace(/^NEMA\s*/i, '')}`);
  return out.slice(0, 6).join(' · ');
}
