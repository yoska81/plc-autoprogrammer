/**
 * What every later stage needs from the machine description, declared as data. The Machine
 * description page checks the description (and the answers already given) against this list and
 * asks each missing item there, grouped by topic, in one go; an answer that makes a follow-up
 * necessary (a VFD → its speed range) brings that follow-up right away. The later stages never ask:
 * they use a default and list it under "Assumptions used".
 */

export type NeedStage = 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';

export interface Need {
  id: string;
  stage: NeedStage;
  /** Group heading on the Machine description page. */
  topic: string;
  question: string;
  /** Asked only when the description mentions this (follow-ups and equipment-specific items). */
  when?: RegExp;
  /** The description or an answer already gives it. */
  covered: RegExp | ((t: SpecView) => boolean);
  /**
   * Later questions this item's answer settles (an engine note "Confirm the HMI password levels"
   * after the password question was answered). Narrow on purpose: a question about one motor's
   * supply is not settled by the site supply.
   */
  settles?: RegExp;
}

/** The description as the checklist reads it: every section and the Q&A as one text, plus the sections. */
export interface SpecView { text: string; sections: Record<string, string>; }

const MOTORS = /\bmotors?\b|\bconveyors?\b|\bpumps?\b|\bfans?\b|\bmixers?\b|\bwinders?\b|\bunwind|\bspindles?\b|\bblowers?\b|\bagitators?\b/i;
const has = (id: string) => (t: SpecView) => Boolean(t.sections[id]?.trim());

export const NEEDS: Need[] = [
  // Equipment
  { id: 'brand', stage: 'equipment', topic: 'Equipment', question: 'Which PLC and HMI brand should be used (e.g. Allen-Bradley, Siemens, AutomationDirect), or is any brand fine?',
    covered: /allen[- ]?bradley|rockwell|siemens|automation ?direct|\bclick\b|omron|mitsubishi|schneider|beckhoff|productivity|compactlogix|controllogix|micro ?8\d0|\bs7-?\d|yaskawa|mpe720|any brand|no preference/i,
    settles: /\b(plc|hmi|controller)\b.*\b(brand|make|manufacturer|vendor)\b|\bbrand\b.*\b(plc|hmi)\b/i },
  // I/O
  { id: 'sensor-type', stage: 'io', topic: 'Sensors and I/O', question: 'Which 24 VDC sensor outputs are used: PNP (sourcing) or NPN (sinking)?',
    covered: /\bpnp\b|\bnpn\b|sourcing|sinking/i, settles: /\b(pnp|npn|sourcing|sinking)\b/i },
  { id: 'spares', stage: 'io', topic: 'Sensors and I/O', question: 'How many spare I/O points should the PLC have (e.g. 20 % spare)?',
    covered: /\bspares?\b.*\b(i\/?o|inputs?|outputs?|points?|%)|\b(i\/?o|inputs?|outputs?)\b.*\bspares?\b/i, settles: /\bspare (i\/?o|inputs?|outputs?|points?|capacity)\b/i },
  // Electrical: power and motors
  { id: 'supply', stage: 'electrical', topic: 'Power and motors', question: 'What is the incoming supply: voltage, phases and frequency (e.g. 480 VAC 3-phase 60 Hz)?',
    covered: /\b(110|115|120|200|208|220|230|240|380|400|415|440|460|480|575|600|690)\s*-?\s*v(ac|olts?)?\b/i,
    settles: /\b(site|plant|incoming|main|mains|available|line)\s+(power\s+)?supply\b(?!.*\bmotor\b)|^\W*(what|which|confirm)\b[^.]*\bsupply voltage\b(?!.*\bmotor\b)/i },
  { id: 'motor-nameplates', stage: 'electrical', topic: 'Power and motors', when: MOTORS, question: 'For each motor: nameplate power (kW or HP), voltage and full-load current (FLA)?',
    covered: /\b(fla|full[- ]load (current|amps?))\b|\bnameplate\b.*\b\d+(\.\d+)?\s*a\b/i },
  { id: 'starters', stage: 'electrical', topic: 'Power and motors', when: MOTORS, question: 'Which motors run on a VFD (variable speed) and which on a direct-on-line starter (contactor + overload)?',
    covered: /\bvfds?\b|variable[- ](speed|frequency)|\bdrives?\b|across[- ]the[- ]line|direct[- ]on[- ]line|\bdol\b|soft[- ]?starter|contactor/i },
  { id: 'vfd-speed', stage: 'electrical', topic: 'Power and motors', when: /\bvfds?\b|variable[- ](speed|frequency)|\binverter\b/i, question: 'For each VFD motor: speed range (min/max Hz or %), ramp times, and is the speed set on the HMI or fixed?',
    covered: /\b\d+(\.\d+)?\s*(hz|%)\b.*\b(speed|ramp)|\b(speed|ramp)\b.*\b\d+(\.\d+)?\s*(hz|%|s)\b|\bramp\b/i },
  { id: 'heaters', stage: 'electrical', topic: 'Power and motors', when: /\bheat(er|ers|ing)?\b|\boven\b|\bsealing (jaw|head|bar)\b/i, question: 'For each heater: power (kW), voltage, and switching (contactor or solid-state relay)?',
    covered: /\b\d+(\.\d+)?\s*k?w\b[^.]*\bheat|\bheat\w*[^.]*\b\d+(\.\d+)?\s*k?w\b/i },
  // Electrical: panel
  { id: 'enclosure', stage: 'electrical', topic: 'Control panel', question: 'Enclosure rating and material (e.g. NEMA 12 painted steel, NEMA 4X stainless, IP54)?',
    covered: /\bnema\s*\d|\bip\s?\d\d\b|\btype\s*(1|4x?|12)\s+enclosure/i, settles: /\benclosure (rating|type|material)\b/i },
  { id: 'sccr', stage: 'electrical', topic: 'Control panel', question: 'Available fault current at the panel feeder (kA), or the SCCR the panel must have?',
    covered: /\bsccr\b|\b\d+(\.\d+)?\s*ka\b|fault current|short[- ]circuit (current|rating)|not known/i, settles: /\bsccr\b|\bavailable fault current\b|\bshort[- ]circuit current rating\b/i },
  { id: 'standards', stage: 'electrical', topic: 'Control panel', question: 'Which standards must the machine meet (e.g. NFPA 79 and UL 508A, CSA, or CE / IEC 60204-1)?',
    covered: /nfpa|ul ?508|iec ?60204|\bce\b|\bcsa\b|\bukca\b/i, settles: /\b(which|what) (electrical )?(standards?|codes?)\b/i },
  { id: 'location', stage: 'electrical', topic: 'Control panel', question: 'Where is the panel installed (indoor / outdoor), and what are the ambient temperature range and the dust and wash-down conditions?',
    covered: /\bambient\b|°\s?[cf]\b|\bdeg(rees)?\s?[cf]\b|\bindoors?\b|\boutdoors?\b|wash[- ]?down/i, settles: /\bambient\b|\b(indoor|outdoor)\b|wash[- ]?down/i },
  // HMI
  { id: 'hmi-size', stage: 'hmi', topic: 'Operator panel (HMI)', question: 'Which HMI screen size (e.g. 7", 10" or 15"), or no HMI (pushbuttons only)?',
    covered: /\b\d{1,2}(\.\d)?\s*("|”|-?\s?inch|in\b)|\bno hmi\b|without (an )?hmi/i, settles: /\bhmi\b.*\b(size|inch)\b|\bscreen size\b/i },
  { id: 'hmi-look', stage: 'hmi', topic: 'Operator panel (HMI)', question: 'HMI look: a company colour scheme or style to follow, and password levels for operator / maintenance / engineer?',
    covered: /\b(colou?rs?|theme|style|branding)\b[^.]*\b(hmi|screens?)\b|\b(hmi|screens?)\b[^.]*\b(colou?rs?|theme|style)\b|\bpasswords?\b|\baccess levels?\b/i,
    settles: /\bpasswords?\b|\baccess levels?\b|\buser levels?\b/i },
  // Program
  { id: 'cycle', stage: 'program', topic: 'Program', question: 'Describe the automatic cycle step by step: what moves, in which order, and what each step waits for.',
    covered: has('sequence'), settles: /\bdescribe the (automatic )?cycle\b|\bcycle was built from\b/i },
  { id: 'timings', stage: 'program', topic: 'Program', question: 'Timings: target cycle time, step timeouts (how long before a jam / fault alarm) and any delays?',
    covered: /\b\d+(\.\d+)?\s*(s|sec|secs|seconds?|ms|min|minutes?)\b|\btimeouts?\b|\bcycle time\b|\bppm\b|per minute/i },
  { id: 'setpoints', stage: 'program', topic: 'Program', question: 'Which values must the operator adjust (speeds, counts, temperatures, times), with their ranges?',
    covered: /\bsetpoints?\b|\badjustable\b|\brecipes?\b|\boperator (can )?(set|adjust|change)s?\b/i, settles: /\bsetpoints?\b.*\b(adjust|operator)|\bwhich values\b.*\badjust/i },
  { id: 'modes', stage: 'program', topic: 'Program', question: 'Which operating modes are needed (Auto, Manual / jog, Setup, single cycle) and how does the operator switch?',
    covered: (t) => Boolean(t.sections.modes?.trim()) || /\bmanual\b[^.]*\bauto|\bauto(matic)?\b[^.]*\bmanual\b|\bjog\b/i.test(t.text) },
];

/** The checklist items the description does not cover yet (with follow-ups that apply), in checklist order. */
export function missingNeeds(view: SpecView): Need[] {
  if (!Object.entries(view.sections).some(([k, v]) => k !== 'qa' && v?.trim())) return [];
  return NEEDS.filter((n) => (!n.when || n.when.test(view.text)) && !(typeof n.covered === 'function' ? n.covered(view) : n.covered.test(view.text)));
}

export const NEED_TOPICS = [...new Set(NEEDS.map((n) => n.topic))];
