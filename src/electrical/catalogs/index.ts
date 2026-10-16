import type { CatalogCategory, CatalogPart, VendorId } from '../types';
import { AUTOMATIONDIRECT } from './automationdirect';
import { ALLEN_BRADLEY } from './allenBradley';
import { SIEMENS } from './siemens';
import { SCHNEIDER } from './schneider';
import { YASKAWA } from './yaskawa';
import { IFM } from './ifm';
import { HOFFMAN } from './hoffman';
import { RITTAL } from './rittal';
import { OMRON } from './omron';

/**
 * Multi-vendor catalogs. One file per vendor in this folder, same rule for
 * all: only part numbers seen on the manufacturer's (or a distributor's)
 * page, with that page in `url`; `verified: false` + `verify` when a rating
 * still needs checking. Nothing is pattern-completed or guessed.
 *
 * A project chooses vendors per equipment group ("preferred brand /
 * customer standard", mixed allowed). Categories a chosen vendor does not
 * offer fall back to AutomationDirect, which stays the default for everything.
 */

/** Equipment groups a vendor preference is set for. */
export type VendorGroup = 'plc' | 'hmi' | 'drives' | 'panel' | 'field' | 'enclosure';

export const GROUP_TITLE: Record<VendorGroup, string> = {
  plc: 'PLC and I/O',
  hmi: 'Operator panel (HMI)',
  drives: 'Motor drives (VFD)',
  panel: 'Panel parts (contactors, breakers, power supply, safety relay, terminals, pushbuttons)',
  field: 'Sensors and field devices',
  enclosure: 'Enclosure',
};

export const GROUP_OF: Record<CatalogCategory, VendorGroup> = {
  plc: 'plc', plcModule: 'plc',
  hmi: 'hmi',
  vfd: 'drives',
  sensor: 'field', solenoidValve: 'field',
  enclosure: 'enclosure',
  disconnect: 'panel', breaker: 'panel', fuse: 'panel', powerSupply: 'panel', contactor: 'panel', overload: 'panel',
  motorProtector: 'panel', relay: 'panel', safetyRelay: 'panel', terminal: 'panel', terminalAccessory: 'panel',
  pushbutton: 'panel', estop: 'panel', pilotLight: 'panel', selector: 'panel', stackLight: 'panel',
  dinRail: 'panel', wireDuct: 'panel', groundBar: 'panel', fan: 'panel', other: 'panel',
};

export interface Vendor {
  id: VendorId;
  name: string;
  /** Who the parts are ordered from (purchasing groups by this). */
  supplier: string;
  parts: CatalogPart[];
  /** Facts the electrical AI needs to combine this vendor's parts correctly. */
  notes: string;
  /** Group of the vendor's 'other' parts (accessories: drive option cards, sensor cables …); default panel parts. */
  otherGroup?: VendorGroup;
}

const tag = (vendor: VendorId, parts: CatalogPart[]) => parts.map((p) => ({ ...p, vendor }));

export const VENDORS: Vendor[] = [
  {
    id: 'automationdirect', name: 'AutomationDirect', supplier: 'AutomationDirect', parts: tag('automationdirect', AUTOMATIONDIRECT),
    notes: 'An enclosure needs its matching subpanel (enclosure category, ratings kind=subpanel). The rotary disconnect needs its switch, a handle and a shaft. A reversing starter is two contactors plus SZ-RM, SZ-ERW1A and SZ-ERW1B. For a dual-channel E-stop into a safety relay, add an ECX1030-2 contact block to the E-stop, and the yellow "EMERGENCY STOP" legend plate ECX1651 under every E-stop operator. Order terminal end covers/brackets and markers with the terminal blocks.',
  },
  {
    id: 'allen-bradley', name: 'Allen-Bradley', supplier: 'Allen-Bradley (Rockwell Automation distributor)', parts: tag('allen-bradley', ALLEN_BRADLEY),
    notes: '100-C contactors: "EJ" = 24 VDC electronic coil, last two digits = auxiliary contacts (10 = 1 N.O., 01 = 1 N.C.). E100 overloads 193-1EE_B mount directly on 100-C09…C23 only. 140MT-C3E motor protectors: choose the current range that contains the motor FLA. 1489-M 2- and 3-pole breakers are 480Y/277 VAC slash rated: only on a solidly grounded wye supply. 800F operators are complete units (operator, latch and contact block); P_PN3_ pilot lights have a 24 V AC/DC LED. 1492-J terminals need a 1492-EBJ3 end barrier at the end of each group and 1492-EAJ35 end anchors. Micro850 expansion I/O (2085-…) needs a 2085-ECR end cap and does not fit the Micro820 (2080 plug-ins only). Compact 5000 (5069) I/O modules need one 5069-RTB18-SCREW each; the controller and 5069-FPD need 5069-RTB64-SCREW. PowerFlex 525 has EtherNet/IP and Safe Torque Off built in. Guardmaster 440R safety relays run on 24 VDC.',
  },
  {
    id: 'siemens', name: 'Siemens', supplier: 'Siemens (distributor)', parts: tag('siemens', SIEMENS),
    notes: 'SIRIUS 3RT2 contactors: "-1BB4x" = 24 VDC coil; S00 (3RT201x) end in -1BB41 (1 N.O. aux), S0 (3RT202x) in -1BB40 (1 N.O. + 1 N.C.). 3RU2116 overloads mount on S00 contactors, 3RU2126 on S0. 3RV2 motor starter protectors: choose the range containing the motor FLA. For UL panels use 5SJ4 breakers (UL 489): -7HG41 = 240 V, -7HG42 = 480Y/277 V (wye systems only); 5SY4 is only UL 1077 supplementary and not branch rated. S7-1500 CPUs need a SIMATIC Memory Card. ET 200SP: the IM 155-6 PN ST needs a BusAdapter; use a light BaseUnit (-0DA0) first after the IM and at each new 24 V load group, dark BaseUnits (-0BA0) after that. 8WH terminal strips need an end plate (8WH9000-1PA00) and end retainers (8WH9150-0CA00). 3SU1 operators listed are complete units; 3SU1102-6AA…-1AA0 pilot lights are 24 V AC/DC. 3SK1 safety relays run on 24 VDC.',
  },
  {
    id: 'schneider', name: 'Schneider Electric', supplier: 'Schneider Electric (distributor)', parts: tag('schneider', SCHNEIDER),
    notes: 'TeSys Deca LC1D…BD = 24 VDC coil, built-in 1 N.O. + 1 N.C. auxiliary contact. LRD overloads mount directly on LC1D; choose the range containing the motor FLA. GV2ME motor circuit breakers are for group motor installation together with an LC1D contactor (not UL Type E); a UL Type E self-protected starter is the GV2P with a GV2GH7 line spacer. Multi9 C60BP breakers are UL 489; 2- and 3-pole are 480Y/277 V (wye only). ATV320 has Modbus and CANopen built in (EtherNet/IP needs an option card); ATV630 has Modbus TCP Ethernet built in. M221 / M241 take up to 7 local TM3 modules. Pair the XB5AS8444 (2 N.C.) E-stop with the XPSUAF13AP safety relay (2 channels, 3 N.O. safety outputs, 24 V AC/DC). Linergy NSYTRV terminals: end cover NSYTRAC22 and end stops NSYTRAAB35. The Harmony GTU is two parts ordered together: HMIG3U box + HMIDT732 display.',
  },
  {
    id: 'yaskawa', name: 'Yaskawa', supplier: 'Yaskawa (distributor)', parts: tag('yaskawa', YASKAWA), otherGroup: 'drives',
    notes: 'GA500 / GA800 US model numbers; size the drive by output current (Normal Duty hp480 / hp230, Heavy Duty *HD). Network option cards are not in the catalog: when the drive must be on EtherNet/IP or PROFINET, say in "notes" that the option card (and on the GA500 the JOHB-GA50 carrier) is ordered with the drive.',
  },
  {
    id: 'ifm', name: 'ifm', supplier: 'ifm (distributor)', parts: tag('ifm', IFM), otherGroup: 'field',
    notes: 'Inductive sensors have 3-pin M12 connectors (cable EVC042 is a 3-pin patch cord); photoelectric sensors are 4-pin M12 (cables EVC001 / EVC002 / EVC004). IO-Link masters: AL1120 / AL1122 / AL1320 / AL1920 are EtherNet/IP, AL1100 / AL1102 are PROFINET; AL1920 is the IP20 master for inside the cabinet, the others mount in the field. Only the O5D100 has IO-Link; the others are plain PNP switching sensors.',
  },
  {
    id: 'hoffman', name: 'nVent HOFFMAN', supplier: 'nVent HOFFMAN (distributor)', parts: tag('hoffman', HOFFMAN),
    notes: 'Every Hoffman enclosure needs its matching subpanel (A…P…, catalogued as enclosure kind=subpanel; the enclosure names it in ratings.subpanel).',
  },
  {
    id: 'rittal', name: 'Rittal', supplier: 'Rittal (distributor)', parts: tag('rittal', RITTAL),
    notes: 'Rittal AX enclosures include their mounting panel: no separate subpanel part.',
  },
  {
    id: 'omron', name: 'Omron', supplier: 'Omron (distributor)', parts: tag('omron', OMRON),
    notes: 'Omron part codes: "DT" = sinking (NPN) transistor outputs, "DT1" = sourcing (PNP), "-D" = 24 VDC supply. CP2E-N20 takes no expansion units; CP2E / CP1E N30/40/60 take up to 3 CP1W expansion units. CP1E has no built-in Ethernet (needs a CP1W-CIF41 option board). NX1P2 takes up to 8 NX I/O units; the NX bus I/O power comes from an NX-PF0630 power supply unit, not from the CPU; the NX-END02 end cover ships with the CPU. 3G3M1 drives: size by heavy-duty current; Modbus RS-485 and Safe Torque Off built in.',
  },
];

export const vendorById = (id: VendorId | undefined): Vendor | undefined => VENDORS.find((v) => v.id === (id ?? 'automationdirect'));

/** Every part of every vendor. */
export const ALL_PARTS: CatalogPart[] = VENDORS.flatMap((v) => v.parts);

/** Equipment group a part belongs to (a vendor's accessories go with its main group). */
export function groupOfPart(p: CatalogPart): VendorGroup {
  if (p.category === 'other') {
    const g = vendorById(p.vendor)?.otherGroup;
    if (g) return g;
  }
  return GROUP_OF[p.category];
}

/** Groups a vendor offers. AutomationDirect offers every group (CLICK PLCs and C-more HMIs are its defaults). */
export function groupsOf(id: VendorId): VendorGroup[] {
  if (id === 'automationdirect') return Object.keys(GROUP_TITLE) as VendorGroup[];
  const v = vendorById(id);
  return v ? [...new Set(v.parts.map(groupOfPart))] : [];
}

/** Preferred vendors per group, in order of preference (several = mixed / customer standard list). */
export type VendorPreference = Record<VendorGroup, VendorId[]>;

export const DEFAULT_PREFERENCE: VendorPreference = {
  plc: ['automationdirect'], hmi: ['automationdirect'], drives: ['automationdirect'],
  panel: ['automationdirect'], field: ['automationdirect'], enclosure: ['automationdirect'],
};

/** A stored preference completed with the defaults (older projects have none). */
export function normalizePreference(p: Partial<VendorPreference> | undefined | null): VendorPreference {
  const out = { ...DEFAULT_PREFERENCE };
  for (const g of Object.keys(DEFAULT_PREFERENCE) as VendorGroup[]) {
    const list = (p?.[g] ?? []).filter((id) => VENDORS.some((v) => v.id === id));
    if (list.length) out[g] = [...new Set(list)];
  }
  return out;
}

/**
 * Parts of one category from the preferred vendors (in preference order).
 * When none of them offers the category, AutomationDirect's parts are used
 * (`fallback: true`) so a design can always be completed.
 */
export function partsFor(category: CatalogCategory, pref: VendorPreference = DEFAULT_PREFERENCE): { parts: CatalogPart[]; fallback: boolean } {
  const vendors = pref[GROUP_OF[category]];
  const allowed = (p: CatalogPart) => pref[groupOfPart(p)].includes(p.vendor ?? 'automationdirect');
  // In preference order of the category's group, then any other allowed vendor (accessories of another group).
  const rank = (p: CatalogPart) => { const i = vendors.indexOf(p.vendor ?? 'automationdirect'); return i < 0 ? vendors.length : i; };
  const parts = ALL_PARTS.filter((p) => p.category === category && allowed(p)).map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
  if (parts.some((p) => vendors.includes(p.vendor ?? 'automationdirect')) || vendors.includes('automationdirect')) return { parts, fallback: false };
  return { parts: [...parts, ...(vendorById('automationdirect')?.parts ?? []).filter((p) => p.category === category)], fallback: true };
}

/** The catalog a project may use: every category, from its preferred vendors (with the fallback). */
export function catalogFor(pref: VendorPreference = DEFAULT_PREFERENCE): CatalogPart[] {
  const cats = [...new Set(ALL_PARTS.map((p) => p.category))];
  return cats.flatMap((c) => partsFor(c, pref).parts);
}

/** Categories where the preferred vendors offer nothing and AutomationDirect is used instead. */
export function fallbackCategories(pref: VendorPreference): CatalogCategory[] {
  const cats = [...new Set(ALL_PARTS.map((p) => p.category))];
  return cats.filter((c) => partsFor(c, pref).fallback);
}

/** Supplier to order a part from. */
export const supplierOfPart = (p: CatalogPart | undefined): string | undefined => (p ? vendorById(p.vendor)?.supplier : undefined);

/** Plain-English rule shown with the brand choice. */
export const CATALOG_GROUPS_NOTE = 'Only real part numbers checked on the maker\'s own page or datasheet are offered.';
