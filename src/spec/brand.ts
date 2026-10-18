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

/**
 * A maker's name counts only right next to a PLC word: "Siemens PLC", "Allen-Bradley controllers", "PLC: Siemens",
 * "the PLC is a Siemens". A Siemens motor started by the PLC, or a Siemens drive next to an Allen-Bradley PLC, is
 * not a Siemens PLC.
 */
const PLC_WORD = '(?:plcs?|controllers?|cpus?|processors?)';
const plcNear = (maker: string) => new RegExp(`\\b(?:${maker})\\s+${PLC_WORD}\\b|\\b${PLC_WORD}\\s*(?:[:=\\-–]|\\bis\\b|\\bwill be\\b|\\bmust be\\b)?\\s*(?:an?\\s+)?(?:${maker})\\b`, 'i');

/** Brand or family names in a machine description, by PLC profile. Family names (S7-1200, CompactLogix) are PLCs. */
const NAMED: [RegExp, string[]][] = [
  [/\bs7[-\s]?1[25]00\b|\b(simatic|siemens) s7\b|\btia portal\b/i, ['siemens-s7']],
  [plcNear('siemens'), ['siemens-s7']],
  [plcNear('allen[-\\s]?bradley|rockwell'), ['logix', 'micro800']],
  [/\b(compact|control)logix\b|\bstudio 5000\b/i, ['logix']],
  [/\bmicro ?8[2-7]0\b|\bmicro ?800\b|\bconnected components workbench\b/i, ['micro800']],
  [/\bunitronics\b|\bunistream\b|\bunilogic\b|\bvisilogic\b/i, ['unitronics-unistream', 'unitronics-vision']],
  [/\bclick (plc|plus)\b/i, ['click']],
  [plcNear('automation ?direct'), ['click']],
];

/** PLC brands and families this tool cannot program yet: named, they are said, never silently replaced. */
const UNSUPPORTED: [RegExp, string][] = [
  [/\bmelsec\b|\bfx5u?c?\b|\bfx3[gu]\b|\biq-[rf]\b|\bgx works\b/i, 'Mitsubishi'],
  [plcNear('mitsubishi(?: electric)?'), 'Mitsubishi'],
  [/\bsysmac\b|\bcp[12]e\b|\bnx1p2?\b|\bnj50\d\b|\bcx-programmer\b/i, 'Omron'],
  [plcNear('omron'), 'Omron'],
  [/\bmodicon\b|\bm2[2-6]1\b|\bm[345]80\b|\bsomachine\b|\becostruxure machine expert\b/i, 'Schneider Electric'],
  [plcNear('schneider(?: electric)?|telemecanique'), 'Schneider Electric'],
  [/\btwincat\b|\bcx[5-9]\d{3}\b/i, 'Beckhoff'],
  [plcNear('beckhoff'), 'Beckhoff'],
  [/\blogo!|\bsiemens logo\b/i, 'Siemens LOGO!'],
  [/\bdelta (dvp|as[23]00)\b|\bisplsoft\b/i, 'Delta'],
  [plcNear('delta'), 'Delta'],
  [plcNear('keyence'), 'Keyence'],
  [plcNear('b&r|b and r'), 'B&R'],
  [plcNear('wago'), 'WAGO'],
];

/** PLC brands named in the description that this tool cannot program yet ("Mitsubishi", "Siemens LOGO!"). */
export function unsupportedBrands(specText: string): string[] {
  return [...new Set(UNSUPPORTED.filter(([re]) => re.test(specText)).map(([, b]) => b))];
}

/** Plain step message for an unsupported brand: "Mitsubishi PLC isn't supported yet — using CLICK." (null when none). */
export function unsupportedNote(specText: string, usingName: string): string | null {
  const b = unsupportedBrands(specText);
  if (!b.length || requestedProfiles(specText, []).length) return null;
  return `${b.join(' / ')} PLC${b.length > 1 ? "s aren't" : " isn't"} supported yet — using ${usingName}.`;
}

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

/**
 * The project's own PLC vendor preference: empty when it was never set, and when it is the untouched default
 * (AutomationDirect alone, which older projects saved on any edit of the Brand preference card). The default is
 * not a request: it never moves a Siemens or Logix project back to CLICK.
 */
export const plcPreferenceOf = (plc: string[] | undefined): string[] => (!plc || (plc.length === 1 && plc[0] === 'automationdirect') ? [] : plc);
export const plcPreference = (): string[] => plcPreferenceOf(useProjectStore.getState().info.vendors?.plc);

/** Why the project's PLC is not the brand asked for ("The description asks for Siemens S7; …"), or null. */
export function brandMismatch(specText: string, preferredPlcVendors: string[], plcId: string): string | null {
  const asked = requestedProfiles(specText, preferredPlcVendors);
  if (!asked.length || asked.some((p) => p.id === plcId)) return null;
  const now = PLC_PROFILES.find((p) => p.id === plcId);
  const names = [...new Set(asked.map((p) => `${p.vendor} ${p.name}`))].join(' or ');
  return `The ${requestedProfiles(specText, []).length ? 'description' : 'Brand preference'} asks for ${names}; the project's PLC is ${now ? `${now.vendor} ${now.name}` : plcId}.`;
}
