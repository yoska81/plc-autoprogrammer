import { CATALOG } from './catalog';
import type { CatalogPart, VendorId } from './types';

/**
 * Enclosure cooling from the catalog: the smallest filter fan (with its exhaust filter), air
 * conditioner or heat exchanger that carries the heat cabinetHeat() says must leave the cabinet.
 * Airflow is compared with filters fitted where the maker publishes it (AD "with filters", Rittal
 * "with 1 outlet filter", Hoffman TFP with one exhaust grille); capacities are the maker's nominal
 * figures. Nothing is picked from a guessed rating.
 */

const CFM_TO_M3H = 1.699;
const BTUH_TO_W = 1 / 3.412;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};
const vendorOf = (p: CatalogPart): VendorId => p.vendor ?? 'automationdirect';
const isDc = (p: CatalogPart) => /dc/i.test(String(p.ratings.volts ?? ''));

/** Current a 24 VDC filter fan draws from the control supply (catalog amps, else watts / 24 V); null for AC fans and other parts. */
export function dcFanAmps(p: CatalogPart | undefined): number | null {
  if (!p || p.category !== 'fan' || p.ratings.kind !== 'filter fan' || !isDc(p)) return null;
  const a = num(p.ratings.amps);
  if (a !== undefined) return a;
  const w = num(p.ratings.watts);
  return w !== undefined ? w / 24 : null;
}

/** Thermostat to switch a filter fan: a N.O. (close on rise) adjustable contact, the AutomationDirect one first. */
export function pickFanThermostat(pool: CatalogPart[] = CATALOG): CatalogPart | null {
  const ts = pool.filter((p) => p.ratings.kind === 'thermostat' && /N\.O\.\s*\(close on rise\)/i.test(String(p.ratings.contact ?? '')) && !/dual/i.test(String(p.ratings.contact ?? '')));
  return ts.sort((a, b) => Number(vendorOf(b) === 'automationdirect') - Number(vendorOf(a) === 'automationdirect') || Number(/deg C/i.test(String(b.ratings.contact))) - Number(/deg C/i.test(String(a.ratings.contact))))[0] ?? null;
}

/** Airflow of a filter fan in m³/h, with filters fitted where published. */
export function fanAirflowM3h(p: CatalogPart): number | undefined {
  const r = p.ratings;
  const withFilter = num(r.airflowM3hWithOutletFilter);
  if (withFilter !== undefined) return withFilter;
  const cfm = num(r.airflowCfmWithFilters) ?? num(r.airflowCfm);
  return cfm !== undefined ? cfm * CFM_TO_M3H : num(r.airflowM3h);
}

/** Cooling capacity of an air conditioner in W (BTU/h converted when only BTU/h is published). */
export function coolingWatts(p: CatalogPart): number | undefined {
  const w = num(p.ratings.coolingW);
  if (w !== undefined) return w;
  const btu = num(p.ratings.coolingBtuh);
  return btu !== undefined ? btu * BTUH_TO_W : undefined;
}

export interface CoolingOptions {
  /** Preferred makers, in order; the first maker with a fitting part wins. Default: any. */
  vendors?: VendorId[];
  /** Fan supply: '24VDC' or 'AC' (default AC). */
  supply?: 'AC' | '24VDC';
  /** Only parts whose `volts` mentions this, e.g. '115' or '230' (air conditioners, AC fans). */
  volts?: string;
  /** Enclosure type the part must keep, e.g. '12' or '4X': only parts whose `nema` names it. */
  nema?: string;
}

// A type that needs an accessory hood ("Type 4X ... and hose-proof hood", Rittal) does not count: the part alone does not keep it.
const keepsType = (p: CatalogPart, nema?: string) => !nema || String(p.ratings.nema ?? '').split(/(?=\bType\b)/i)
  .some((seg) => !/hood/i.test(seg) && new RegExp(`(^|[^0-9a-z])${nema}($|[^0-9a-z])`, 'i').test(seg));

const byVendor = (parts: CatalogPart[], vendors?: VendorId[]) => {
  if (!vendors?.length) return parts;
  for (const v of vendors) { const hit = parts.filter((p) => vendorOf(p) === v); if (hit.length) return hit; }
  return [];
};

/** Smallest filter fan that moves `airflowM3h` with filters, plus its exhaust filter (pairsWith). */
export function pickFilterFan(airflowM3h: number, opt: CoolingOptions = {}, pool: CatalogPart[] = CATALOG): { fan: CatalogPart; exhaust?: CatalogPart; airflowM3h: number } | null {
  const fans = pool.filter((p) => p.category === 'fan' && p.ratings.kind === 'filter fan'
    && isDc(p) === (opt.supply === '24VDC') && (!opt.volts || isDc(p) || String(p.ratings.volts).includes(opt.volts))
    && keepsType(p, opt.nema) && (fanAirflowM3h(p) ?? 0) >= airflowM3h);
  const best = byVendor(fans, opt.vendors).sort((a, b) => fanAirflowM3h(a)! - fanAirflowM3h(b)!)[0];
  if (!best) return null;
  const exPn = String(best.ratings.pairsWith ?? '').split(/,\s*/)[0];
  return { fan: best, exhaust: pool.find((p) => p.partNumber === exPn), airflowM3h: fanAirflowM3h(best)! };
}

/** Smallest air conditioner rated for at least `watts` of heat (closed cabinet, any ambient). */
export function pickAirConditioner(watts: number, opt: CoolingOptions = {}, pool: CatalogPart[] = CATALOG): CatalogPart | null {
  const ac = pool.filter((p) => p.category === 'other' && p.ratings.kind === 'air conditioner'
    && (!opt.volts || String(p.ratings.volts ?? '').includes(opt.volts)) && keepsType(p, opt.nema) && (coolingWatts(p) ?? 0) >= watts);
  return byVendor(ac, opt.vendors).sort((a, b) => coolingWatts(a)! - coolingWatts(b)!)[0] ?? null;
}

/** Smallest heat exchanger that carries `watts` at `deltaK` (inside minus ambient air, K): needs W/K ≥ watts / ΔT. */
export function pickHeatExchanger(watts: number, deltaK: number, opt: CoolingOptions = {}, pool: CatalogPart[] = CATALOG): CatalogPart | null {
  if (deltaK <= 0) return null;
  const hx = pool.filter((p) => p.category === 'other' && p.ratings.kind === 'heat exchanger'
    && (!opt.volts || String(p.ratings.volts ?? '').includes(opt.volts)) && keepsType(p, opt.nema) && (num(p.ratings.wPerK) ?? 0) * deltaK >= watts);
  return byVendor(hx, opt.vendors).sort((a, b) => num(a.ratings.wPerK)! - num(b.ratings.wPerK)!)[0] ?? null;
}
