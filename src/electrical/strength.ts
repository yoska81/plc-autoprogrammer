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

/** Where the part sits in the design: the motor branch it protects, if any. */
export interface StrengthContext {
  motor?: { tag: string; fla: number; iec: boolean };
  /** AC volts feeding a power supply (the line, or the control transformer's secondary): candidates must accept it. */
  feedVolts?: number;
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null);

/**
 * Voltage rating in any of the catalog's spellings: 480, '600', '480Y/277 VAC/125 VDC', '240 VAC/125 VDC',
 * '10-36VDC', '24VAC/VDC'. Highest AC and DC value (a slash rating like 480Y/277 counts as 480 on a wye supply).
 */
export function parseVolts(v: unknown): { ac?: number; dc?: number } {
  if (typeof v === 'number') return { ac: v };
  if (typeof v !== 'string') return {};
  if (num(v) !== null) return { ac: Number(v) };
  const out: { ac?: number; dc?: number } = {};
  const add = (k: 'ac' | 'dc', x: number) => { out[k] = Math.max(out[k] ?? 0, x); };
  // Each value runs up to its unit: "480Y/277 VAC", "10-36VDC", "24VAC/VDC" (both), "600 V" (AC unless DC is said).
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)(?:\s*(?:Y\/|-|\u2013)\s*\d+(?:\.\d+)?)?\s*V?\s*(AC\s*\/\s*V?DC|AC|DC)?\b/gi)) {
    const x = Number(m[1]);
    const kind = (m[2] ?? '').toUpperCase().replace(/\s/g, '');
    const range = /^\d+(?:\.\d+)?\s*[-\u2013]\s*(\d+(?:\.\d+)?)/.exec(m[0]);
    const top = range ? Number(range[1]) : x;
    if (!kind && !/V/i.test(m[0])) continue;
    if (kind.includes('DC')) add('dc', top);
    if (kind.includes('AC') || !kind) add('ac', top);
  }
  return out;
}

/** NEC 240.6(A) standard sizes (fuses also 1, 3, 6, 10 A). */
const STD_A = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];

/**
 * NEC 430.52 / Table 430.52 maximum for a motor branch short-circuit device: inverse-time breaker 250 %,
 * time-delay fuse 175 %, non-time-delay fuse 300 % of the motor full-load current, next standard size up.
 */
export function motorBranchMaxA(p: CatalogPart, fla: number): number | null {
  if (p.category !== 'breaker' && !(p.category === 'fuse' && p.ratings.fuseClass !== undefined && subKind(p) === 'cartridge')) return null;
  const fuse = p.category === 'fuse';
  const pct = !fuse ? 2.5 : /time.?delay|dual/i.test(`${p.ratings.type ?? ''} ${p.ratings.speed ?? ''} ${p.description}`) ? 1.75 : 3;
  return [...(fuse ? [1, 3, 6, 10] : []), ...STD_A].find((s) => s >= fla * pct - 1e-9) ?? fla * pct;
}

/**
 * The input class of a power supply, so a swap never offers one that cannot take the feed: 3-phase 400-500 V,
 * 1/2-phase up to 480 V L-L (the highest AC volts in `inputVolts`, DC ranges ignored), DC in, or '' for the usual
 * 1-phase 100-240 V universal input.
 */
/** The AC parts of an input rating, with any DC ranges taken out: '90~264VAC / 127~370VDC' → '90~264VAC'. */
const acText = (txt: string) => txt.replace(/[\d.\s\-~…]+V\s?DC/gi, ' ');

export function supplyInputClass(r: CatalogPart['ratings']): string {
  const txt = String(r.inputVolts ?? '');
  const ac = acText(txt).match(/\d+(?:\.\d+)?(?=\s*(?:V\s?AC|VAC|V\b|L-L|L-N))|\d+(?=\s*[-~…]\s*\d)/gi);
  const max = Math.max(0, ...(ac ?? []).map(Number).filter((x) => x >= 24));
  if (String(r.phases ?? '').includes('3')) return ' 3-phase in';
  if (max > 300) return ' up to 480 V L-L in';
  if (!max && /dc/i.test(txt)) return ' DC in';
  return '';
}

/**
 * Does a supply's AC input take this feed? Ranges ("85-264 VAC", "90~264VAC", "3 x 340-575 VAC", "200-500VAC L-L")
 * must hold it; listed values ("120/230 VAC", "120/240VAC") within 10 %. undefined when the rating gives no AC volts.
 */
export function acceptsFeed(r: CatalogPart['ratings'], volts: number): boolean | undefined {
  const ac = acText(String(r.inputVolts ?? ''));
  const ranges = [...ac.matchAll(/(\d+(?:\.\d+)?)\s*V?\s*[-~…]\s*(\d+(?:\.\d+)?)\s*V/gi)].map((m) => [Number(m[1]), Number(m[2])]);
  if (ranges.length) return ranges.some(([lo, hi]) => lo <= volts && volts <= hi);
  const values = (ac.match(/\d+(?=\s*(?:\/|V\s?AC|VAC))/gi) ?? []).map(Number).filter((x) => x >= 24);
  return values.length ? values.some((x) => Math.abs(volts - x) <= x * 0.1) : undefined;
}

/**
 * Compare a candidate with the part the design uses now. Weaker on any key
 * rating (or incompatible) = not ok, with the reason in plain words; equal or
 * stronger everywhere = ok. `better` is set when it is stronger somewhere.
 */
export function compareStrength(current: CatalogPart, candidate: CatalogPart, ctx: StrengthContext = {}): Strength {
  if (candidate.partNumber === current.partNumber) return { ok: true, reason: 'Current part', better: false };
  const a = current.ratings;
  const b = candidate.ratings;
  // Branch protection bigger than the code allows for the motor it protects (US/Canada practice).
  const m = ctx.motor;
  const maxA = m && !m.iec ? motorBranchMaxA(candidate, m.fla) : null;
  const amps = num(b.amps);
  if (maxA !== null && amps !== null && amps > maxA) {
    return { ok: false, reason: `Too big for ${m!.tag}: max ${maxA} A (FLA ${m!.fla} A, NEC 430.52)`, better: false };
  }
  for (const m of MUST_MATCH) {
    if (a[m.key] !== undefined && b[m.key] !== undefined && String(a[m.key]) !== String(b[m.key])) {
      return { ok: false, reason: `Different ${m.label} (${b[m.key]} instead of ${a[m.key]})`, better: false };
    }
  }
  // A UL 98 / UL 489 supply disconnect is never swapped for a UL 508 motor disconnect (e.g. Siemens 3LD):
  // UL 508A accepts only the former as the supply-circuit disconnect.
  if (current.category === 'disconnect' && /^(98|489)$/.test(String(a.ul ?? '')) && String(b.ul ?? '') === '508') {
    return { ok: false, reason: `UL 508 motor disconnect only, not a supply disconnect (${b.ulUse ?? 'UL 508'})`, better: false };
  }
  // Power supplies: the candidate must accept the feed the design gives it, when known.
  if (candidate.category === 'powerSupply' && ctx.feedVolts && acceptsFeed(b, ctx.feedVolts) === false) {
    return { ok: false, reason: `Input ${b.inputVolts} does not take the ${ctx.feedVolts} V feed`, better: false };
  }
  // Power supplies: the candidate must take the same feed. A 480 V L-L supply can stand in for a 1-phase universal
  // or a 3-phase one; nothing else crosses input classes (a 90-264 VAC supply cannot be fed 480 V).
  if (current.category === 'powerSupply' && candidate.category === 'powerSupply') {
    const ci = supplyInputClass(a), ki = supplyInputClass(b);
    if (ci !== ki && !(ki === ' up to 480 V L-L in' && (ci === '' || ci === ' 3-phase in'))) {
      return { ok: false, reason: `Different input (${b.inputVolts ?? '?'} instead of ${a.inputVolts ?? '?'})`, better: false };
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
  // Voltage rating: compare AC with AC (or DC with DC when only DC is given).
  const va = parseVolts(a.volts ?? a.supplyVolts), vb = parseVolts(b.volts ?? b.supplyVolts);
  for (const k of ['ac', 'dc'] as const) {
    const x = va[k], y = vb[k];
    if (x === undefined) continue;
    if (y === undefined) { if (k === 'ac' && vb.dc !== undefined) return { ok: false, reason: `DC rated only (${b.volts}); this circuit needs ${x} V AC`, better: false }; continue; }
    if (y < x) return { ok: false, reason: `Lower voltage rating: ${y} V vs ${x} V ${k.toUpperCase()}`, better: false };
    if (y > x) better = true;
    break;
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
  // The unit is added only to bare numbers ('480Y/277 VAC' and '10-36VDC' already carry theirs).
  const withUnit = (v: string | number, unit: string) => (unit && num(v) !== null ? `${v} ${unit}` : String(v));
  for (const h of HIGHER_IS_STRONGER) if (r[h.key] !== undefined) out.push(`${withUnit(r[h.key], h.unit)}${h.key === 'poles' ? ' pole' : h.key === 'contacts' ? ' contacts' : h.key === 'ports' ? ' ports' : ''}`);
  const volts = r.volts ?? r.supplyVolts;
  if (volts !== undefined) out.push(withUnit(volts, 'V'));
  for (const m of MUST_MATCH) if (r[m.key] !== undefined) out.push(withUnit(r[m.key], /Volt/.test(m.key) ? 'V' : ''));
  if (r.nema !== undefined) out.push(`NEMA ${String(r.nema).replace(/^NEMA\s*/i, '')}`);
  return out.slice(0, 6).join(' · ');
}
