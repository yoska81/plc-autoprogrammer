/**
 * What-if compare: the project designed again in memory with one change (supply voltage, PLC, brand of the
 * panel parts or enclosure, enclosure rating), side by side with the same project as it is — cost, enclosure
 * size, heat, lead time and part count. Both sides come from the rule-based engine so the comparison is fair;
 * nothing in the project changes until "Apply this option".
 */
import { generateDefaultDesign, type EngineInput } from '../engine';
import { VENDORS, type VendorPreference } from '../catalogs';
import type { DrawingContext } from '../derive';
import { getCpu, PLC_PROFILES } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { analogSetup } from '../../plc/core/analog';
import { modulesToFit, type Need } from '../../plc/core/fit';
import { regionSpec, SUPPLY_INFO } from '../../standards/regions';
import type { CatalogCategory, EnclosureRating, SupplyVoltage } from '../types';
import { designFacts, type DesignFacts } from './facts';

export type BaseInput = Omit<EngineInput, 'model'> & { spec: string; plcId: string };

export type WhatIfKind = 'supply' | 'plc' | 'brand' | 'enclosure';

export const KIND_TITLE: Record<WhatIfKind, string> = {
  supply: 'Supply voltage', plc: 'PLC', brand: 'Brand', enclosure: 'Enclosure rating',
};

/** The one change of an option; "Apply this option" writes exactly these into the project. */
export interface Change {
  supply?: SupplyVoltage;
  enclosureRating?: EnclosureRating;
  pref?: VendorPreference;
  plc?: { plcId: string; cpuId: string; modules: string[] };
}

export interface WhatIfOption { id: string; kind: WhatIfKind; label: string; change: Change }

export interface WhatIfResult {
  option: WhatIfOption | null;
  ctx: DrawingContext;
  facts: DesignFacts;
  /** Design notes that matter for the choice (parts the catalog could not cover…). */
  gaps: string[];
  layoutOk: boolean;
}

const ENCLOSURES: EnclosureRating[] = ['NEMA 12', 'NEMA 4', 'NEMA 4X', 'NEMA 1'];
const PANEL_CATS: CatalogCategory[] = ['contactor', 'breaker', 'powerSupply'];

export function needOf(base: BaseInput): Need {
  const n = (type: string, analog: boolean) => base.io.filter((p) => p.type === type && (p.signal === 'analog') === analog).length;
  return { digitalInputs: n('input', false), digitalOutputs: n('output', false), analogInputs: n('input', true), analogOutputs: n('output', true), ethernetHmi: Boolean(base.hmiPartNumber), minHmiSizeIn: null };
}

/** Options worth comparing for this project (each differs from it in one thing). */
export function whatIfOptions(base: BaseInput): WhatIfOption[] {
  const out: WhatIfOption[] = [];
  const pref = base.pref!;
  for (const s of regionSpec(base.region).supplies) {
    if (s !== base.inputs.supply) out.push({ id: `supply:${s}`, kind: 'supply', label: SUPPLY_INFO[s].label, change: { supply: s } });
  }
  const need = needOf(base);
  for (const profile of PLC_PROFILES) {
    if (!profile.available || profile.id === base.plcId || profile.id === 'generic-st') continue;
    for (const cpu of profile.cpuModels) {
      const mods = modulesToFit(cpu.id, [], need);
      if (!mods) continue;
      out.push({ id: `plc:${cpu.id}`, kind: 'plc', label: `${profile.vendor} ${profile.name} (${cpu.id}${mods.length ? ` + ${mods.length} module${mods.length > 1 ? 's' : ''}` : ''})`, change: { plc: { plcId: profile.id, cpuId: cpu.id, modules: mods } } });
      break;
    }
  }
  const offers = (id: string, cats: CatalogCategory[]) => cats.every((c) => VENDORS.find((v) => v.id === id)?.parts.some((p) => p.category === c));
  for (const v of VENDORS) {
    if (offers(v.id, PANEL_CATS) && pref.panel[0] !== v.id) out.push({ id: `brand:panel:${v.id}`, kind: 'brand', label: `${v.name} panel parts`, change: { pref: { ...pref, panel: [v.id] } } });
  }
  for (const v of VENDORS) {
    if (v.parts.some((p) => p.category === 'enclosure' && p.ratings.kind === 'enclosure') && pref.enclosure[0] !== v.id) out.push({ id: `brand:enclosure:${v.id}`, kind: 'brand', label: `${v.name} enclosure`, change: { pref: { ...pref, enclosure: [v.id] } } });
  }
  for (const e of ENCLOSURES) if (e !== base.inputs.enclosureRating) out.push({ id: `enclosure:${e}`, kind: 'enclosure', label: e, change: { enclosureRating: e } });
  return out;
}

/** The engine input with the option's change applied. */
export function withChange(base: BaseInput, change: Change): BaseInput {
  let next: BaseInput = { ...base, inputs: { ...base.inputs } };
  if (change.supply) next.inputs = { ...next.inputs, supply: change.supply, motors: next.inputs.motors.map((m) => ({ ...m, voltage: change.supply! })) };
  if (change.enclosureRating) next.inputs = { ...next.inputs, enclosureRating: change.enclosureRating };
  if (change.pref) next.pref = change.pref;
  if (change.plc) {
    const profile = PLC_PROFILES.find((p) => p.id === change.plc!.plcId)!;
    const cpu = getCpu(profile, change.plc.cpuId);
    // Addresses typed for the old PLC do not apply to the new one.
    const io = base.io.map((p) => ({ ...p, plcAddress: undefined }));
    const slots = moduleSlots(change.plc.modules);
    // The old PLC's CPU and modules leave the designer's required parts.
    const requiredParts = next.inputs.requiredParts.filter((r) => { const c = base.getPart(r.partNumber)?.category; return c !== 'plc' && c !== 'plcModule'; });
    next = {
      ...next, io, plcId: profile.id, modules: change.plc.modules, addresses: resolveAddresses(profile, cpu, io, slots), analog: analogSetup(profile, cpu, slots, io),
      plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label }, inputs: { ...next.inputs, requiredParts },
    };
  }
  return next;
}

const GAP_RE = /^(No |no catalog|.*: no (catalog|branch|24 VDC|overload|motor protector)|.*select (a|one|them|the|primary|branch))/;

export function runDesign(base: BaseInput, option: WhatIfOption | null): WhatIfResult {
  const input = option ? withChange(base, option.change) : base;
  const r = generateDefaultDesign(input);
  const ctx: DrawingContext = {
    projectName: input.projectName ?? 'Machine', design: r.design, getPart: input.getPart, plc: input.plc, region: input.region,
    hmiPartNumber: input.hmiPartNumber, analog: input.analog,
    io: input.io.map((p) => ({ address: input.addresses.get(p.id) ?? '', description: p.description, type: p.type })),
  };
  return { option, ctx, facts: designFacts(ctx), gaps: r.design.notes.filter((n) => GAP_RE.test(n)), layoutOk: r.layoutOk };
}

/** Plain-words differences of an option against the project as it is. */
export function differences(a: DesignFacts, b: DesignFacts): string[] {
  const out: string[] = [];
  const dc = b.cost - a.cost;
  if (Math.abs(dc) >= 0.01) out.push(`${dc < 0 ? 'Saves' : 'Adds'} $${Math.abs(dc).toFixed(2)}${b.unpriced !== a.unpriced ? ` (${b.unpriced} part${b.unpriced !== 1 ? 's' : ''} still without a price)` : ''}`);
  if (b.enclosure.text !== a.enclosure.text) out.push(`Enclosure ${b.enclosure.areaIn2 < a.enclosure.areaIn2 ? 'smaller' : b.enclosure.areaIn2 > a.enclosure.areaIn2 ? 'larger' : 'changes'}: ${b.enclosure.text}`);
  if (Math.abs(b.heatW - a.heatW) >= 1) out.push(`${b.heatW < a.heatW ? 'Less' : 'More'} heat: ${b.heatW} W`);
  if (b.lead !== a.lead) out.push(`Slowest part: ${b.lead === 'stock' ? 'everything in stock' : b.lead === 'short' ? '1-3 weeks' : '4+ weeks'}`);
  if (b.pieces !== a.pieces) out.push(`${b.pieces < a.pieces ? 'Fewer' : 'More'} parts: ${b.pieces}`);
  return out;
}
