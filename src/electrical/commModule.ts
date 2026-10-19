/**
 * The PLC-side communication module a touch panel needs to reach its PLC (a serial-only panel on an S7-1200 needs a
 * CM 1243-5, a GT21 on an FX5U an FX5-232-BD …: plcModuleFor / plcModulePart, src/plc/core/platforms.ts). It is a part
 * of the design (BOM line, price, current), never an I/O module: it never goes into the project's I/O `modules` list,
 * so no I/O address moves (category 'commModule', not 'plcModule').
 */
import { PLATFORMS, plcModuleFor, plcModulePart } from '../plc/core/platforms';
import type { CatalogPart, DesignComponent } from './types';

export function commModulesFor(hmiPn: string | null | undefined, cpuPn: string, getPart: (pn: string) => CatalogPart | undefined, nextTag: (prefix: string) => string): { components: DesignComponent[]; notes: string[] } {
  const hmi = hmiPn ? getPart(hmiPn) : undefined;
  const platform = PLATFORMS.find((p) => p.cpus.includes(cpuPn));
  if (!hmi || !platform) return { components: [], notes: [] };
  const text = plcModuleFor(hmi, platform.id);
  if (!text) return { components: [], notes: [] };
  const pn = plcModulePart(hmi, platform.id);
  if (!pn) return { components: [], notes: [`PLC needs: ${text} for the ${hmi.partNumber} touch panel — not in the catalog yet; add it to the order.`] };
  const part = getPart(pn);
  return {
    components: [{ tag: nextTag('CM'), partNumber: pn, quantity: 1, function: `Communication module for the ${hmi.partNumber} touch panel (${text})${part?.ratings.inCpu === 'yes' ? ' — fits inside the CPU' : ''}`, motorTag: null }],
    notes: [],
  };
}
