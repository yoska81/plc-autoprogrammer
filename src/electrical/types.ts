/**
 * Electrical design model. The AI fills the engineering decisions (parts,
 * sizes, what each I/O point is wired to); code derives wire numbers,
 * terminals and drawings from it so the sheet set is always consistent.
 * North American practice (NFPA 79 / UL 508A style), AutomationDirect parts.
 */

export type CatalogCategory =
  | 'enclosure' | 'disconnect' | 'breaker' | 'fuse' | 'powerSupply'
  | 'contactor' | 'overload' | 'motorProtector' | 'vfd'
  | 'relay' | 'safetyRelay' | 'terminal' | 'terminalAccessory'
  | 'pushbutton' | 'estop' | 'pilotLight' | 'selector' | 'stackLight'
  | 'plc' | 'plcModule' | 'hmi' | 'sensor' | 'solenoidValve'
  | 'dinRail' | 'wireDuct' | 'groundBar' | 'fan' | 'other';

/** Where the part is mounted; drives which layout sheet it appears on. */
export type MountLocation = 'backplate' | 'door' | 'field';

/** Catalog a part comes from (brand / supplier); see src/electrical/catalogs. */
export type VendorId = 'automationdirect' | 'allen-bradley' | 'siemens' | 'schneider' | 'yaskawa' | 'ifm' | 'hoffman' | 'rittal'
  | 'omron' | 'mitsubishi' | 'delta' | 'weintek' | 'redlion' | 'maple' | 'proface';

export interface CatalogPart {
  /** Manufacturer / supplier part number, exactly as on the source page. */
  partNumber: string;
  /** Catalog the part belongs to (set by src/electrical/catalogs; AutomationDirect when absent). */
  vendor?: VendorId;
  /** Product family, e.g. "Micro850", "SIRIUS 3RT2". */
  family?: string;
  category: CatalogCategory;
  description: string;
  manufacturer: string;
  /** Product page used to verify the part. */
  url: string;
  mount: MountLocation;
  /** Mounting footprint in mm (width along the DIN rail × height), for layout. */
  widthMm?: number;
  heightMm?: number;
  /** Key ratings used for selection, e.g. { amps: 10, poles: 1, coil: '24VDC', hp480: 5 }. */
  ratings: Record<string, string | number>;
  /** false = some data (ratings/dimensions) still needs checking against the datasheet. */
  verified: boolean;
  /** When not verified: what still needs checking. */
  verify?: string;
}

export type SupplyVoltage = '120VAC-1PH' | '208VAC-3PH' | '240VAC-3PH' | '480VAC-3PH' | '600VAC-3PH'
  // IEC supplies (50 Hz): 400/230 V 3-phase + N, 230 V single-phase, 690 V 3-phase (see src/standards/regions.ts).
  | '400VAC-3PH' | '230VAC-1PH' | '690VAC-3PH';
export type EnclosureRating = 'NEMA 1' | 'NEMA 12' | 'NEMA 4' | 'NEMA 4X';

/** What the designer decides before generation. */
export interface DesignInputs {
  supply: SupplyVoltage;
  enclosureRating: EnclosureRating;
  /** Extra requirements in plain words (spare space, HMI, stack light, standards...). */
  notes: string;
  motors: MotorSpec[];
  /** Parts the designer already chose; the AI must use them. */
  requiredParts: { partNumber: string; quantity: number }[];
}

export type StarterType = 'contactor-overload' | 'motor-protector' | 'vfd';

export interface MotorSpec {
  tag: string;            // "M1"
  description: string;    // "Conveyor 1 motor"
  hp: number;
  voltage: SupplyVoltage;
  starter: StarterType;
  reversing: boolean;
}

/** One placed component in the design (BOM line + drawing symbol). */
export interface DesignComponent {
  /** Device tag on the drawings, e.g. "CB1", "K1", "PS1", "PB2". */
  tag: string;
  partNumber: string;
  quantity: number;
  /** What it does in this machine. */
  function: string;
  /** Motor it belongs to, for motor circuit sheets. */
  motorTag?: string | null;
}

export type FieldDeviceType =
  | 'pushbutton-no' | 'pushbutton-nc' | 'selector' | 'estop-contact'
  | 'sensor-pnp' | 'sensor-npn' | 'limit-switch' | 'pressure-switch' | 'safety-relay-output'
  | 'contactor-coil' | 'relay-coil' | 'solenoid' | 'pilot-light' | 'stack-light' | 'vfd-input' | 'other';

/** How one PLC I/O point is wired in the field. */
export interface IOWiring {
  /** PLC address, e.g. "X001". */
  address: string;
  /** Field device tag, e.g. "PB1", "PRS3", "SOL2". */
  deviceTag: string;
  deviceType: FieldDeviceType;
  description: string;
  /** Where the device is: "Cabinet door", or a machine zone like "Infeed conveyor". */
  location?: string;
  /** Safety relay whose N.O. safety output is in series with this PLC output (e.g. a two-hand relay enabling the closing stroke). */
  safetyContact?: string;
}

/** Field junction box collecting devices of one machine zone. */
export interface JunctionBox {
  tag: string;          // "JB1"
  location: string;     // machine zone
  /** Catalog part number of the box when one is chosen. */
  partNumber?: string | null;
}

/**
 * Machine (field) wiring: everything outside the cabinet. Device locations
 * come from IOWiring.location; motors from inputs.motors (+ motorLocations).
 */
export interface MachineWiring {
  /** Machine zones in order, e.g. ["Infeed conveyor", "Pusher station"]. */
  zones: string[];
  junctionBoxes: JunctionBox[];
  /** Motor tag -> zone. */
  motorLocations: Record<string, string>;
  /** Device tag -> junction box tag, or null for a home-run cable to the cabinet. */
  routing: Record<string, string | null>;
}

export interface ElectricalDesign {
  inputs: DesignInputs;
  components: DesignComponent[];
  ioWiring: IOWiring[];
  /** Design notes and assumptions for the engineer to check. */
  notes: string[];
  /** The notes that are questions / assumptions for the customer (the rest are technical issues for the design review). Absent on older designs. */
  askUser?: string[];
  /** Field wiring outside the cabinet; derived with defaults when absent. */
  machine?: MachineWiring;
  generatedAt: string;
}
