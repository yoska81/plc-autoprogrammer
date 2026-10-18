/**
 * The PLC brand the customer asked for: named in the machine description ("Siemens S7-1200", "CompactLogix"), or set
 * in the project's Brand preference. The Equipment AI chooses from it, Update all keeps to it, and the Equipment
 * stage is out of date while the project's PLC is another brand.
 */
import { PLC_PROFILES } from '../plc/core/profiles';
import type { PlcProfile } from '../plc/core/profile';
import { platformOf } from '../plc/core/fit';
import { useProjectStore } from '../store/useProjectStore';

/** Catalog vendor of a PLC profile (CLICK has no multi-vendor platform: AutomationDirect). */
const vendorOf = (p: PlcProfile) => platformOf(p.cpuModels[0]?.id ?? '')?.vendor ?? (p.id === 'click' ? 'automationdirect' : '');

/** A maker's name counts only next to a PLC word in the same sentence: a Siemens motor or an Allen-Bradley drive is not a PLC. */
const plcNear = (maker: string) => new RegExp(`\\b(${maker})\\b[^.;\\n]{0,50}\\b(plc|controller|cpu|processor)s?\\b|\\b(plc|controller|cpu|processor)s?\\b[^.;\\n]{0,50}\\b(${maker})\\b`, 'i');

/** Brand or family names in a machine description, by PLC profile. Family names (S7-1200, CompactLogix) are PLCs. */
const NAMED: [RegExp, string[]][] = [
  [/\bs7[-\s]?1[25]00\b|\bsimatic s7\b|\btia portal\b/i, ['siemens-s7']],
  [plcNear('siemens'), ['siemens-s7']],
  [plcNear('allen[-\\s]?bradley|rockwell'), ['logix', 'micro800']],
  [/\b(compact|control)logix\b|\bstudio 5000\b/i, ['logix']],
  [/\bmicro ?8[2-7]0\b|\bmicro ?800\b|\bconnected components workbench\b/i, ['micro800']],
  [/\bunitronics\b|\bunistream\b|\bunilogic\b|\bvisilogic\b/i, ['unitronics-unistream', 'unitronics-vision']],
  [/\bclick (plc|plus)\b/i, ['click']],
  [plcNear('automation ?direct'), ['click']],
];

/**
 * PLCs the customer asked for: a brand named in the description (that brand only), else the project's PLC vendor
 * preference (Brand preference) when one of its vendors has a PLC here. Empty when neither says anything.
 */
export function requestedProfiles(specText: string, preferredPlcVendors: string[]): PlcProfile[] {
  const all = PLC_PROFILES.filter((p) => p.available && p.language === 'ladder');
  const named = new Set(NAMED.filter(([re]) => re.test(specText)).flatMap(([, ids]) => ids));
  if (named.size) return all.filter((p) => named.has(p.id));
  return [...new Set(preferredPlcVendors.flatMap((v) => all.filter((p) => vendorOf(p) === v)))];
}

/** PLCs the AI may choose from: the ones asked for, else the PLCs the tool picks on its own (CLICK). */
export function choosableProfiles(specText: string, preferredPlcVendors: string[]): PlcProfile[] {
  const asked = requestedProfiles(specText, preferredPlcVendors);
  return asked.length ? asked : PLC_PROFILES.filter((p) => p.available && p.language === 'ladder' && p.autoChoose !== false);
}

/** The project's own PLC vendor preference (empty when it was never set; the default is not a request). */
export const plcPreference = (): string[] => useProjectStore.getState().info.vendors?.plc ?? [];

/** Why the project's PLC is not the brand asked for ("The description asks for Siemens S7; …"), or null. */
export function brandMismatch(specText: string, preferredPlcVendors: string[], plcId: string): string | null {
  const asked = requestedProfiles(specText, preferredPlcVendors);
  if (!asked.length || asked.some((p) => p.id === plcId)) return null;
  const now = PLC_PROFILES.find((p) => p.id === plcId);
  const names = [...new Set(asked.map((p) => `${p.vendor} ${p.name}`))].join(' or ');
  return `The ${requestedProfiles(specText, []).length ? 'description' : 'Brand preference'} asks for ${names}; the project's PLC is ${now ? `${now.vendor} ${now.name}` : plcId}.`;
}
