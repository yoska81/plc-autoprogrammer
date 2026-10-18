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
export const vendorOf = (p: PlcProfile) => platformOf(p.cpuModels[0]?.id ?? '')?.vendor ?? (p.id === 'click' ? 'automationdirect' : '');

/**
 * A maker's name counts when it names the PLC: "Siemens PLC", "Rockwell Automation PLC", "Siemens 1214C PLC",
 * "Allen-Bradley's PLC", "Siemens-PLC" (up to two words between, none of them a device), or "PLC: Siemens",
 * "PLC (Siemens)", "PLC hardware: Allen-Bradley", "the PLC shall be Siemens", "SPS: Siemens". A Siemens motor started
 * by the PLC, or a Siemens drive next to an Allen-Bradley PLC, is not a Siemens PLC.
 */
const PLC_WORD = '(?:plcs?|controllers?|cpus?|processors?|sps|steuerung(?:en)?|automates?|aut[oó]matas?)';
const DEVICE = '(?:motors?|drives?|vfds?|inverters?|servos?|sensors?|valves?|hmis?|panels?|screens?|photo-?eyes?|switch(?:es)?|starters?|contactors?|relays?|encoders?|cylinders?|robots?|and|or|with|for)';
const LINK = String.raw`(?:\s*(?:\(|[:=–-]|\b(?:hardware|brand|make|maker|vendor|type|model|platform)\b|\b(?:shall|must|will|should|to)\s+be\b|\bis\b|\bby\b|\bfrom\b))`;
const plcNear = (maker: string) => new RegExp(
  String.raw`\b(?:${maker})(?:['’]s)?(?:[\s-]+(?!${DEVICE}\b)[\w./]+(?:-[\w./]+)*){0,2}?[\s-]+${PLC_WORD}\b`
  + String.raw`|\b${PLC_WORD}\b${LINK}{0,3}\s*(?:an?\s+|the\s+)?(?:${maker})\b`, 'i');

/** Makers with a PLC here, as their names appear in a description (for the "mentions but does not say" note). */
const SUPPORTED_MAKERS: [RegExp, string][] = [
  [/\bsiemens\b/i, 'Siemens'], [/\ballen[-\s]?bradley\b|\brockwell\b/i, 'Allen-Bradley'], [/\bautomation ?direct\b/i, 'AutomationDirect'],
];
const HAS_PLC_WORD = new RegExp(String.raw`\b${PLC_WORD}\b`, 'i');

/** Brand or family names in a machine description, by PLC profile. Family names (S7-1200, CompactLogix) are PLCs. */
const NAMED: [RegExp, string[]][] = [
  [/\bs7[-\s]?(1[25]|[34])00\b|\b(simatic|siemens) s7\b|\btia portal\b/i, ['siemens-s7']],
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
  [/\bproductivity ?(1000|2000|3000|suite)\b|\bbrx\b|\bdo-more\b/i, 'AutomationDirect Productivity / BRX / Do-more'],
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

/**
 * Plain step message about the PLC brand, so the PLC used is never a silent fallback (null when there is nothing
 * to say):
 * - a PLC brand this tool cannot program: "Mitsubishi PLC isn't supported yet — using AutomationDirect CLICK (C0-…).";
 * - a maker with a PLC here mentioned next to a PLC word without naming the PLC: "The description mentions Siemens
 *   but doesn't say the PLC is Siemens — using …. Set the PLC brand in Brand preference if that's wrong.";
 * - an S7-300 / S7-400 named: the program is written for the S7-1200 / S7-1500 (TIA Portal).
 */
export function brandNote(specText: string, usingName: string): string | null {
  const named = requestedProfiles(specText, []).length > 0;
  const out: string[] = [];
  const b = unsupportedBrands(specText);
  if (b.length && !named) out.push(`${b.join(' / ')} PLC${b.length > 1 ? "s aren't" : " isn't"} supported yet — using ${usingName}.`);
  else if (!named && HAS_PLC_WORD.test(specText)) {
    const makers = SUPPORTED_MAKERS.filter(([re]) => re.test(specText)).map(([, m]) => m);
    if (makers.length) out.push(`The description mentions ${makers.join(' and ')} but doesn't say the PLC is ${makers.join(' or ')} — using ${usingName}. Set the PLC brand in Brand preference if that's wrong.`);
  }
  if (/\bs7[-\s]?[34]00\b/i.test(specText)) out.push('The S7-300 / S7-400 named in the description is programmed here as an S7-1200 / S7-1500 (TIA Portal).');
  return out.length ? out.join(' ') : null;
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
 * (AutomationDirect alone, which older projects saved on any edit of the Brand preference card) unless the user
 * picked it (`plcChosen`). The default is not a request: it never moves a Siemens or Logix project back to CLICK.
 */
export const plcPreferenceOf = (plc: string[] | undefined, chosen = false): string[] => (!plc || (!chosen && plc.length === 1 && plc[0] === 'automationdirect') ? [] : plc);
export const plcPreference = (): string[] => { const i = useProjectStore.getState().info; return plcPreferenceOf(i.vendors?.plc, i.plcChosen); };

/** A catalog vendor whose PLCs this tool can program (Siemens, Allen-Bradley, Unitronics, AutomationDirect). */
export const hasPlcProfile = (vendorId: string) => PLC_PROFILES.some((p) => p.available && p.language === 'ladder' && vendorOf(p) === vendorId);

/** Why the project's PLC is not the brand asked for ("The description asks for Siemens S7; …"), or null. */
export function brandMismatch(specText: string, preferredPlcVendors: string[], plcId: string): string | null {
  const asked = requestedProfiles(specText, preferredPlcVendors);
  if (!asked.length || asked.some((p) => p.id === plcId)) return null;
  const now = PLC_PROFILES.find((p) => p.id === plcId);
  const names = [...new Set(asked.map((p) => `${p.vendor} ${p.name}`))].join(' or ');
  return `The ${requestedProfiles(specText, []).length ? 'description' : 'Brand preference'} asks for ${names}; the project's PLC is ${now ? `${now.vendor} ${now.name}` : plcId}.`;
}
