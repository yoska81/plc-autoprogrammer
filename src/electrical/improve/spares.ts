/**
 * Recommended spare parts: the critical parts of the BOM (fuses, relays, contactors, power supply, PLC and
 * I/O modules, HMI, drives …) with a quantity from how critical the part is (does the machine stop without
 * it?) and how often that kind of part fails or wears. Classes and rates are typical industry starting points,
 * labelled so; parts come only from the BOM, never invented.
 */
import { billOfMaterials, buildModel, isFuseCartridge, type DrawingContext } from '../derive';
import type { CatalogCategory } from '../types';
import { leadOf, LEAD_LABEL, piecePrice, type LeadClass } from './facts';
import { getHmi } from '../../hmi/hmiCatalog';

export type Criticality = 'A' | 'B' | 'C';
export type FailureRate = 'high' | 'medium' | 'low';

export const CRITICALITY_LABEL: Record<Criticality, string> = { A: 'A — machine stops', B: 'B — runs degraded', C: 'C — minor' };
export const FAILURE_LABEL: Record<FailureRate, string> = { high: 'Often (wear / consumable)', medium: 'Sometimes', low: 'Rarely' };

interface Rule { crit: Criticality; rate: FailureRate; why: string }

const RULES: Partial<Record<CatalogCategory, Rule>> = {
  fuse: { crit: 'A', rate: 'high', why: 'Consumable: keep a full set per rating' },
  contactor: { crit: 'A', rate: 'high', why: 'Contacts and coil wear with every start' },
  relay: { crit: 'B', rate: 'high', why: 'Contacts wear' },
  powerSupply: { crit: 'A', rate: 'medium', why: 'No 24 V: the whole machine stops' },
  plc: { crit: 'A', rate: 'low', why: 'Single point of failure' },
  plcModule: { crit: 'A', rate: 'low', why: 'Machine stops without its I/O' },
  hmi: { crit: 'A', rate: 'low', why: 'Operator interface (keep the project backed up too)' },
  vfd: { crit: 'A', rate: 'low', why: 'Motor stops; drives take weeks to get' },
  safetyRelay: { crit: 'A', rate: 'low', why: 'Safety function: the machine cannot run without it' },
  motorProtector: { crit: 'A', rate: 'low', why: 'Protective device' },
  overload: { crit: 'B', rate: 'medium', why: 'Protective device, can be hard to get' },
  breaker: { crit: 'B', rate: 'low', why: 'Protective device: one per rating' },
  estop: { crit: 'A', rate: 'medium', why: 'Safety device, operator wear' },
  sensor: { crit: 'B', rate: 'high', why: 'Field device: knocks, dirt, cable damage' },
  solenoidValve: { crit: 'B', rate: 'medium', why: 'Coil and seals wear' },
  fan: { crit: 'B', rate: 'high', why: 'Wears (keep filter mats too)' },
  pushbutton: { crit: 'C', rate: 'medium', why: 'Operator wear' },
  selector: { crit: 'C', rate: 'medium', why: 'Operator wear' },
  pilotLight: { crit: 'C', rate: 'medium', why: 'LED / lamp failure' },
  stackLight: { crit: 'C', rate: 'medium', why: 'LED / lamp failure' },
};

/** Spares for `installed` pieces: more for parts that wear, at least two of a critical wear part used in several places. */
export function recommendedQty(category: CatalogCategory, installed: number, r: Pick<Rule, 'crit' | 'rate'>): number {
  if (category === 'fuse') return Math.max(installed, 3);
  if (r.rate === 'high') return Math.max(r.crit === 'A' && installed >= 2 ? 2 : 1, Math.ceil(installed * 0.2));
  if (r.rate === 'medium') return Math.max(1, Math.ceil(installed * 0.1));
  return r.crit === 'C' ? 0 : 1;
}

export interface SpareLine {
  partNumber: string;
  manufacturer: string;
  description: string;
  tags: string[];
  category: CatalogCategory;
  installed: number;
  criticality: Criticality;
  failure: FailureRate;
  qty: number;
  why: string;
  /** Per piece, when a verified price exists. */
  unitPrice?: number;
  extended?: number;
  lead: LeadClass;
}

export interface SpareList { lines: SpareLine[]; total: number; unpriced: number }

const CRIT_ORDER: Record<Criticality, number> = { A: 0, B: 1, C: 2 };

export function spareParts(ctx: DrawingContext): SpareList {
  const m = buildModel(ctx);
  const carts = new Set(m.rc.filter(isFuseCartridge).map((c) => c.partNumber));
  const lines: SpareLine[] = [];
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) {
    if (l.note || !l.partNumber || l.category === 'note') continue;
    const rule = RULES[l.category];
    if (!rule) continue;
    if (l.category === 'fuse' && !carts.has(l.partNumber)) continue; // holders are not spares
    const qty = recommendedQty(l.category, l.qty, rule);
    if (!qty) continue;
    const part = ctx.getPart(l.partNumber);
    const unit = piecePrice(l.partNumber, part);
    lines.push({
      partNumber: l.partNumber, manufacturer: l.manufacturer, description: l.description.replace(/\s+—\s+\d+ required by terminal plan$/, ''), tags: l.tags,
      category: l.category, installed: l.qty, criticality: rule.crit, failure: rule.rate, qty, why: rule.why,
      unitPrice: unit, extended: unit === undefined ? undefined : Math.round(unit * qty * 100) / 100,
      lead: part ? leadOf(part).cls : getHmi(l.partNumber) ? 'short' : 'stock',
    });
  }
  lines.sort((a, b) => CRIT_ORDER[a.criticality] - CRIT_ORDER[b.criticality]);
  return {
    lines,
    total: Math.round(lines.reduce((s, l) => s + (l.extended ?? 0), 0) * 100) / 100,
    unpriced: lines.filter((l) => l.extended === undefined).length,
  };
}

/** One "Reason" text for tables: class, how often it fails, why. */
export const spareReason = (l: SpareLine) => `${l.criticality === 'A' ? 'Critical' : l.criticality === 'B' ? 'Important' : 'Minor'} · fails ${l.failure === 'high' ? 'often' : l.failure === 'medium' ? 'sometimes' : 'rarely'} — ${l.why}`;

export const SPARES_BASIS = 'Criticality: A = the machine stops without it, B = it runs degraded, C = minor. Failure rate: typical for the kind of part (wear items and consumables fail often). Quantities are starting points: adjust them to the site, the number of machines and the supplier\'s lead time.';

export const leadText = (c: LeadClass) => LEAD_LABEL[c];
