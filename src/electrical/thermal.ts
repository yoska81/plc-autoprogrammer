import type { CatalogCategory, CatalogPart } from './types';

/**
 * Cabinet heat and temperature rise (painted steel enclosure, wall-mounted or floor-standing), shared by the
 * calculations document and the enclosure machining (filter-fan cutouts).
 */

// Typical values used when the catalog doesn't publish one (labelled as estimates).
export const HEAT_W: Partial<Record<CatalogCategory, number>> = {
  plc: 5, plcModule: 2, safetyRelay: 2, relay: 0.6, contactor: 2.5, overload: 2, motorProtector: 3, breaker: 1.5, terminal: 0.1,
};

/** Highest temperature rise above room temperature accepted without ventilation, °C. */
export const ALLOWED_RISE_C = 15;
/** Heat transfer of painted sheet steel to still air, W/m²K. */
const K_STEEL = 5.5;
/** Air volume factor for filter fans at sea level, m³·K/(W·h) (V = f · P / ΔT). */
const AIR_FACTOR = 3.1;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

export interface HeatLine { item: string; value: string; basis: string; estimate: boolean }

export interface CabinetHeat {
  lines: HeatLine[];
  watts: number;
  enclosure?: CatalogPart;
  /** Effective surface area (back, and a floor-standing enclosure's bottom, not counted), m². */
  area: number | null;
  /** Temperature rise above room temperature, °C. */
  rise: number | null;
  /** Filter fan needed to keep the rise at ALLOWED_RISE_C: heat it must carry out and the air flow. */
  ventilation: { wattsToRemove: number; airflowM3h: number } | null;
}

/** Heat of the back-panel parts (and the door HMI) and the resulting cabinet temperature rise. */
export function cabinetHeat(
  components: { tag: string; partNumber: string; quantity: number }[],
  getPart: (pn: string) => CatalogPart | undefined,
  hmi?: { partNumber: string; sizeIn: number },
): CabinetHeat {
  const lines: HeatLine[] = [];
  let watts = 0;
  let enclosure: CatalogPart | undefined;
  for (const c of components) {
    const part = getPart(c.partNumber);
    if (part?.category === 'enclosure' && part.ratings.kind === 'enclosure') enclosure ??= part;
    if (!part || part.mount !== 'backplate') continue;
    let w: number | null = null;
    let basis = '';
    if (part.category === 'powerSupply' && num(part.ratings.watts)) { w = num(part.ratings.watts)! * 0.12; basis = '~12% loss of rated output'; }
    else if (part.category === 'vfd') { const hp = num(part.ratings.hp480 ?? part.ratings.hp230 ?? part.ratings.hp) ?? 1; w = hp * 746 * 0.04; basis = '~4% of drive rating'; }
    else if (part.ratings.kind === 'transformer' && num(part.ratings.va)) { w = num(part.ratings.va)! * 0.05; basis = '~5% of VA'; }
    else if (HEAT_W[part.category] !== undefined) { w = HEAT_W[part.category]!; basis = 'typical'; }
    if (w === null) continue;
    w *= c.quantity;
    watts += w;
    lines.push({ item: `${c.tag} ${part.partNumber}${c.quantity > 1 ? ` x${c.quantity}` : ''}`, value: `${w.toFixed(1)} W`, basis, estimate: true });
  }
  if (hmi) {
    // The HMI electronics sit inside the door: its power ends up as heat in the cabinet.
    const w = (hmi.sizeIn >= 10 ? 1.0 : 0.6) * 24;
    watts += w;
    lines.push({ item: `HMI ${hmi.partNumber} (door)`, value: `${w.toFixed(1)} W`, basis: 'supply current x 24 V (typical)', estimate: true });
  }
  if (!enclosure) return { lines, watts, area: null, rise: null, ventilation: null };
  const h = (num(enclosure.ratings.heightIn) ?? 24) * 0.0254, w = (num(enclosure.ratings.widthIn) ?? 20) * 0.0254, d = (num(enclosure.ratings.depthIn) ?? 8) * 0.0254;
  // Back not counted (IEC/TR 60890 style effective area, simplified); a floor-standing enclosure's bottom
  // sits on the floor or its stands and does not count either.
  const floor = enclosure.ratings.mounting === 'floor';
  const area = h * w + 2 * h * d + (floor ? 1 : 2) * w * d;
  const rise = watts / (K_STEEL * area);
  const wattsToRemove = watts - K_STEEL * area * ALLOWED_RISE_C;
  return {
    lines, watts, enclosure, area, rise,
    ventilation: rise > ALLOWED_RISE_C ? { wattsToRemove, airflowM3h: (AIR_FACTOR * wattsToRemove) / ALLOWED_RISE_C } : null,
  };
}
