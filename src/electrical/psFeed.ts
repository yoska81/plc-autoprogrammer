/**
 * The AC voltage that feeds the design's 24 VDC supply: a control transformer's secondary when the design has one
 * (600 V supplies: 600:120 V), else the line itself (line-to-line on 3-phase). The part picker greys out supplies whose
 * input range does not take it (StrengthContext.feedVolts).
 */
import { SUPPLY_INFO } from '../standards/regions';
import type { CatalogPart, ElectricalDesign } from './types';

const num = (v: unknown) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : undefined; };

export function psFeedVolts(design: ElectricalDesign, getPart: (pn: string) => CatalogPart | undefined): number | undefined {
  const transformer = design.components.map((c) => getPart(c.partNumber)).find((p) => p?.ratings.kind === 'transformer');
  if (transformer) return num(String(transformer.ratings.secondaryVolts ?? '120').split('/')[0]) ?? 120;
  return SUPPLY_INFO[design.inputs.supply]?.volts;
}
