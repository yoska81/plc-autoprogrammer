import { CATALOG } from './catalog';
import { parseVolts, supplyInputClass } from './strength';
import type { CatalogPart, VendorId } from './types';

/**
 * Cross-reference: the same function across brands. Parts are grouped by what
 * they do and their key rating (a 3-pole 9 A contactor, a 24 V 5 A power supply,
 * a 5 HP 480 V drive...), straight from the catalog ratings, so every row is real
 * catalog parts. `differences` says what changes when one is swapped for another
 * (coil voltage, footprint, SCCR, terminal style...), which is what the engine
 * must redo: wiring, back-panel layout and the panel SCCR.
 */

export type CrossFunction = 'contactor' | 'breaker' | 'motorProtector' | 'overload' | 'powerSupply' | 'ssr' | 'relay'
  | 'terminal' | 'plcIO' | 'hmi' | 'vfd' | 'enclosure' | 'fuse' | 'safetyRelay' | 'cooling';

export const FUNCTION_TITLE: Record<CrossFunction, string> = {
  contactor: 'Contactors', breaker: 'Circuit breakers', motorProtector: 'Motor protectors', overload: 'Overload relays',
  powerSupply: '24 V power supplies', ssr: 'Solid-state relays', relay: 'Control relays', terminal: 'Terminal blocks',
  plcIO: 'PLC I/O modules', hmi: 'Operator panels (HMI)', vfd: 'Drives (VFD)', enclosure: 'Enclosures', fuse: 'Fuses',
  safetyRelay: 'Safety relays', cooling: 'Enclosure cooling',
};

const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
/** IEC AC-3 contactor ratings: a 9 A and a 9.5 A contactor are the same size class. */
const CONTACTOR_A = [6, 7, 9, 12, 16, 18, 22, 25, 32, 38, 40, 50, 65, 80, 95, 115, 150];
const HP = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];
/** Cooling size classes: filter-fan airflow (CFM), air-conditioner capacity (W), heat-exchanger W/K. */
const CFM = [15, 25, 35, 50, 75, 100, 150, 200, 300, 400, 600];
const COOL_W = [300, 500, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5500];
const W_PER_K = [10, 20, 35, 50, 75];
const bucket = (x: number, steps: number[]) => steps.find((s) => s >= x * 0.95) ?? x;

/** Voltage class of a drive input: 240 V, 480 V or 600 V. */
const voltClass = (v: unknown) => {
  const ac = typeof v === 'number' ? v : parseVolts(v).ac ?? n(String(v ?? '').match(/\d+/)?.[0]);
  return ac === undefined ? undefined : ac <= 260 ? '240 V' : ac <= 520 ? '480 V' : '600 V';
};

/** Motor power of a drive in HP (from the HP rating at its voltage, or kW). */
function driveHp(r: CatalogPart['ratings']): number | undefined {
  const hp = n(r.hp480) ?? n(r.hp230) ?? n(r.hp575) ?? n(r.hp200) ?? n(r.hp1ph);
  if (hp !== undefined) return hp;
  const kw = n(r.kw);
  return kw === undefined ? undefined : bucket(kw / 0.746, HP);
}

/** The function a part performs and its rating key, e.g. ['contactor', '3P 9 A']. null = not cross-referenced. */
export function functionKey(p: CatalogPart): [CrossFunction, string] | null {
  const r = p.ratings;
  switch (p.category) {
    case 'contactor': {
      const a = n(r.amps), poles = n(r.poles);
      return a && poles ? ['contactor', `${poles}P ${bucket(a, CONTACTOR_A)} A`] : null;
    }
    case 'breaker': {
      const a = n(r.amps), poles = n(r.poles);
      if (!a || !poles) return null;
      const branch = /yes/i.test(String(r.branchRated ?? '')) || /489/.test(String(r.ul ?? '')) ? 'branch (UL 489)' : 'supplementary';
      return ['breaker', `${poles}P ${a} A curve ${r.curve ?? '?'} ${branch}`];
    }
    case 'motorProtector': {
      const lo = n(r.minAmps), hi = n(r.maxAmps);
      return lo !== undefined && hi !== undefined ? ['motorProtector', `${lo}-${hi} A`] : null;
    }
    case 'overload': {
      const lo = n(r.minAmps), hi = n(r.maxAmps);
      // Class "10A" (IEC 60947-4-1) and "10" are the same trip class.
      return lo !== undefined && hi !== undefined ? ['overload', `${lo}-${hi} A class ${String(r.tripClass ?? '?').replace(/^(\d+)A$/i, '$1')}`] : null;
    }
    case 'powerSupply': {
      const v = n(r.outputVolts), a = n(r.outputAmps);
      return v && a ? ['powerSupply', `${v} V ${a} A${supplyInputClass(r)}`] : null;
    }
    case 'relay': {
      if (r.switching !== undefined || r.loadVolts !== undefined) {
        const a = n(r.amps) ?? n(r.ampsAC1);
        return a ? ['ssr', `${r.phases ?? 1}-phase ${a} A`] : null;
      }
      return r.contacts ? ['relay', `${r.contacts} ${r.coilVoltage ?? r.coil ?? ''}`.trim()] : null;
    }
    case 'terminal': {
      // '2.5mm2', '2.5 mm²' and 2.5 are the same size.
      const mm = parseFloat(String(r.size ?? ''));
      const kind = /pe|ground/i.test(String(r.kind ?? '')) ? 'ground' : /fuse/i.test(String(r.kind ?? '')) ? 'fuse' : 'feed-through';
      return Number.isFinite(mm) ? ['terminal', `${mm} mm² ${kind}`] : null;
    }
    case 'plcModule': {
      const parts = [['inputs', 'DI'], ['outputs', 'DO'], ['analogInputs', 'AI'], ['analogOutputs', 'AO']]
        .map(([k, l]) => (n(r[k]) ? `${n(r[k])} ${l}` : '')).filter(Boolean);
      return parts.length ? ['plcIO', parts.join(' + ')] : null;
    }
    case 'hmi': {
      const d = n(r.displayIn);
      return d ? ['hmi', `${Math.round(d)} in`] : null;
    }
    case 'vfd': {
      const hp = driveHp(r), vc = voltClass(r.inputVolts);
      return hp && vc ? ['vfd', `${hp} HP ${vc}${String(r.inputPhases ?? '') === '1' ? ' 1-phase in' : ''}`] : null;
    }
    case 'enclosure':
      return r.kind === 'enclosure' && n(r.heightIn) && n(r.widthIn) ? ['enclosure', `${Math.round(Number(r.heightIn))}x${Math.round(Number(r.widthIn))} in`] : null;
    case 'fuse':
      return r.fuseClass && n(r.amps) && !/holder/i.test(p.description) ? ['fuse', `class ${r.fuseClass} ${r.amps} A`] : null;
    case 'fan': {
      // Exhaust grilles have no airflow of their own: they pair with a fan (pairsWith).
      const cfm = n(r.airflowCfm);
      return r.kind === 'filter fan' && cfm ? ['cooling', `filter fan up to ${bucket(cfm, CFM)} CFM ${/dc/i.test(String(r.volts ?? '')) ? '24 VDC' : 'AC'}`] : null;
    }
    case 'other': {
      // Air-conditioner capacity in W (BTU/h ÷ 3.412 when only BTU/h is published); nominal ratings, conditions differ by maker.
      const w = n(r.coolingW) ?? (n(r.coolingBtuh) !== undefined ? n(r.coolingBtuh)! / 3.412 : undefined), wk = n(r.wPerK);
      if (r.kind === 'air conditioner' && w) return ['cooling', `air conditioner up to ${bucket(w, COOL_W)} W`];
      if (r.kind === 'heat exchanger' && wk) return ['cooling', `heat exchanger up to ${bucket(wk, W_PER_K)} W/K`];
      return null;
    }
    case 'safetyRelay':
      return ['safetyRelay', String(r.application ?? 'safety relay').replace(/\s+/g, ' ').slice(0, 60)];
    default:
      return null;
  }
}

/** Plain-words differences a swap from `a` to `b` brings (empty = drop-in). */
export function differences(a: CatalogPart, b: CatalogPart): string[] {
  const ra = a.ratings, rb = b.ratings, out: string[] = [];
  const diff = (label: string, x: unknown, y: unknown) => { if (x !== undefined && y !== undefined && String(x) !== String(y)) out.push(`${label}: ${x} → ${y}`); };
  diff('Coil voltage', ra.coilVoltage ?? ra.coil, rb.coilVoltage ?? rb.coil);
  diff('Control voltage', ra.controlVolts, rb.controlVolts);
  diff('Rated current', ra.amps, rb.amps);
  diff('Voltage rating', ra.volts, rb.volts);
  diff('Interrupting rating (kA)', ra.interruptingKA, rb.interruptingKA);
  const sa = ra.sccrKA480 ?? ra.sccrKA, sb = rb.sccrKA480 ?? rb.sccrKA;
  if (sa !== undefined || sb !== undefined) diff('SCCR (kA)', sa ?? 'not published', sb ?? 'not published');
  if (a.widthMm && b.widthMm && a.heightMm && b.heightMm && (Math.abs(a.widthMm - b.widthMm) > 1 || Math.abs(a.heightMm - b.heightMm) > 1)) {
    out.push(`Footprint: ${a.widthMm}×${a.heightMm} → ${b.widthMm}×${b.heightMm} mm`);
  }
  diff('Terminal style', ra.terminals ?? ra.connection, rb.terminals ?? rb.connection);
  diff('Mounting', ra.mounting, rb.mounting);
  diff('Aux contacts', ra.aux, rb.aux);
  // Accessories (overloads, auxiliary blocks ...) mount only on what forUse names: a swap may need its host swapped too.
  diff('Mounts on', ra.forUse, rb.forUse);
  diff('Trip curve', ra.curve, rb.curve);
  diff('Network', ra.network, rb.network);
  diff('Airflow (CFM)', ra.airflowCfm, rb.airflowCfm);
  diff('Cooling', ra.coolingW ?? (ra.coolingBtuh && `${ra.coolingBtuh} BTU/h`), rb.coolingW ?? (rb.coolingBtuh && `${rb.coolingBtuh} BTU/h`));
  diff('Cutout (mm)', ra.cutoutWidthMm && `${ra.cutoutWidthMm}×${ra.cutoutHeightMm}`, rb.cutoutWidthMm && `${rb.cutoutWidthMm}×${rb.cutoutHeightMm}`);
  diff('Resolution', ra.resolutionPx, rb.resolutionPx);
  if ((a.family ?? '') !== (b.family ?? '') && a.family && b.family) out.push(`Family: ${a.family} → ${b.family}`);
  return out;
}

export interface CrossRefGroup {
  fn: CrossFunction;
  key: string;
  /** Catalog parts by brand (vendor id), in catalog order. */
  parts: Partial<Record<VendorId, string[]>>;
}

const vendorOf = (p: CatalogPart): VendorId => p.vendor ?? 'automationdirect';

/** The cross-reference table: every function/rating that two or more brands offer. */
export function crossReference(pool: CatalogPart[] = CATALOG): CrossRefGroup[] {
  const groups = new Map<string, CrossRefGroup>();
  for (const p of pool) {
    const fk = functionKey(p);
    if (!fk) continue;
    const id = fk.join('|');
    const g = groups.get(id) ?? { fn: fk[0], key: fk[1], parts: {} };
    (g.parts[vendorOf(p)] ??= []).push(p.partNumber);
    groups.set(id, g);
  }
  return [...groups.values()].filter((g) => Object.keys(g.parts).length >= 2);
}

/** Parts of other brands that do the same job as `p`, with what changes in a swap. */
export function equivalents(p: CatalogPart, pool: CatalogPart[] = CATALOG): { part: CatalogPart; differences: string[] }[] {
  const fk = functionKey(p);
  if (!fk) return [];
  const id = fk.join('|');
  return pool.filter((q) => q.partNumber !== p.partNumber && vendorOf(q) !== vendorOf(p) && functionKey(q)?.join('|') === id)
    .map((q) => ({ part: q, differences: differences(p, q) }));
}
