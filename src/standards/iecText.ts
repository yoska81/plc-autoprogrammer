/** Drawing and document texts for IEC regions (IEC 60204-1 / IEC 61439); see regions.ts for sources. */
import { regionSpec, type Region } from './regions';

/** Wire colour legend, IEC 60204-1 §13.2.2–13.2.4. */
export const IEC_WIRE_COLORS: [string, string][] = [
  ['BK  BLACK', 'AC and DC power circuits'],
  ['RD  RED', 'AC control circuits'],
  ['BU  BLUE', 'DC control circuits (+24 V DC, 0 V, I/O)'],
  ['BU(LT)  LIGHT BLUE', 'Neutral conductor (N)'],
  ['GN/YE  GREEN-YELLOW', 'Protective conductor (PE) only'],
  ['OG  ORANGE', 'Interlock circuits supplied from an external source (stay live with the main switch off)'],
];

export interface CoverFacts {
  supply: string;
  threePhase: boolean;
  neutral: boolean;
  disconnect: string;
  supplies: string;
  enclosure: string;
  protection: string;
  transformer: string | null;
}

/** General notes on the cover sheet of an IEC drawing set. */
export function iecCoverNotes(region: Region | string | undefined, f: CoverFacts): string[] {
  const r = regionSpec(region);
  return [
    `SUPPLY: ${f.supply}${f.threePhase ? (f.neutral ? ', L1/L2/L3 + N + PE' : ', L1/L2/L3 + PE') : ', L + N + PE'}. EARTHING SYSTEM (TN-S / TN-C-S / TT) TO BE CONFIRMED BY THE SITE. MAIN SWITCH ${f.disconnect} LOCKABLE IN THE OFF POSITION (IEC 60204-1 5.3).`,
    `CONTROL VOLTAGE: 24 V DC PELV FROM ${f.supplies}. 0 V CONNECTED TO THE PROTECTIVE BONDING CIRCUIT AT ONE POINT (IEC 60204-1 9.4.3).`,
    `ENCLOSURE: ${f.enclosure} (IEC 60529). ASSEMBLY TO IEC 61439-1/-2: DESIGN VERIFICATION AND ROUTINE VERIFICATION BY THE PANEL BUILDER; RATING PLATE WITH SUPPLY, RATED CURRENT (InA) AND SHORT-CIRCUIT RATING (Icc / Icw).`,
    `MACHINE ELECTRICAL EQUIPMENT PER ${r.value === 'Israel' ? 'SI 60204-1 / IEC 60204-1' : 'IEC 60204-1'}; INSTALLATION PER ${r.codes.installation.toUpperCase()}.`,
    `PROTECTION: ${f.protection}. MCB CURVES: B RESISTIVE, C POWER SUPPLIES / GENERAL, D HIGH INRUSH (IEC 60898-1). MOTORS: MOTOR CIRCUIT BREAKERS SET TO THE RATED CURRENT (IEC 60947-2 / 60947-4-1).${f.transformer ? ` CONTROL TRANSFORMER ${f.transformer}, ONE SIDE OF THE SECONDARY CONNECTED TO PE.` : ''}`,
    'CONDUCTORS: COPPER, PVC 70 °C (H05V-K / H07V-K OR EQUIVALENT), SIZED PER IEC 60204-1 TABLE 6 AT 40 °C; MINIMUM 1,5 mm² POWER, 0,75 mm² CONTROL INSIDE THE ENCLOSURE (TABLE 5). SIZES IN mm².',
    'EVERY CONDUCTOR IDENTIFIED AT BOTH ENDS WITH ITS WIRE NUMBER (IEC 60204-1 13.2.1). COLOURS PER IEC 60204-1 13.2 (TABLE BELOW).',
    'FIELD WIRING VIA TERMINAL STRIPS; ~15% SPARE TERMINALS PROVIDED.',
    'EMERGENCY STOP: STOP CATEGORY 0 VIA SAFETY RELAY (IEC 60204-1 9.2.3.4.2, IEC 60947-5-5 DEVICES). REQUIRED PERFORMANCE LEVEL FROM THE RISK ASSESSMENT (EN ISO 12100); VERIFY TO EN ISO 13849-1 / -2 OR IEC 62061.',
    `CONFORMITY: ${r.marking.toUpperCase()}.`,
    'THIS DRAWING SET IS AI-GENERATED. ALL PARTS, RATINGS, WIRE SIZES AND LAYOUT MUST BE CHECKED AND APPROVED BY A QUALIFIED ENGINEER BEFORE PURCHASE, BUILD OR USE.',
  ];
}

/** IEC 81346-2 class letters used by the designations (src/standards/designations.ts). */
export const IEC_LETTERS: [RegExp, string, string][] = [
  [/^-B\d/, '-B', 'SENSOR / MEASURING (PROXIMITY, PHOTO-EYE, PRESSURE)'],
  [/^-F\d/, '-F', 'PROTECTION: FUSE, OVERLOAD RELAY'],
  [/^-K\d/, '-K', 'PROCESSING SIGNALS: RELAY, CONTACTOR, SAFETY RELAY, PLC'],
  [/^-M\d/, '-M', 'DRIVING MOTION: MOTOR, SOLENOID'],
  [/^-P\d/, '-P', 'PRESENTING INFORMATION: PILOT LIGHT, HMI'],
  [/^-Q\d/, '-Q', 'SWITCHING POWER: MAIN SWITCH, MCB, MOTOR CIRCUIT BREAKER'],
  [/^-S\d/, '-S', 'MANUAL CONTROL: PUSHBUTTON, SELECTOR, E-STOP'],
  [/^-T\d/, '-T', 'CONVERTING ENERGY: POWER SUPPLY, TRANSFORMER, DRIVE'],
  [/^-U\d/, '-U', 'ENCLOSURE, BACK PANEL, JUNCTION BOX'],
  [/^(-X|TB)\d/, '-X', 'TERMINALS (STRIPS KEEP TB1…)'],
];
