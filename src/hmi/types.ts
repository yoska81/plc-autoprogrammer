/**
 * HMI design: screens laid out in the panel's native pixels, every element
 * bound to a PLC address. HMI-driven bits use C memory (X inputs can't be
 * written), and the PLC program is generated with these tags in mind.
 */

export type HmiElementKind =
  | 'button'          // momentary/set/reset/toggle a PLC bit
  | 'nav'             // go to another screen
  | 'indicator'       // lamp showing a bit
  | 'numeric'         // display a register value
  | 'numeric-entry'   // operator enters a register value (setpoint)
  | 'text'            // static label
  | 'alarm-banner'    // shows active alarm messages
  | 'bar'             // bar graph of a register
  | 'header'          // title bar: machine name, screen name, mode, alarm count, date/time
  | 'multistate'      // register/bit value mapped to state texts and colours (mode, sequence step)
  | 'alarm-list'      // table of alarms (active first, then history)
  | 'datetime'        // panel clock
  | 'trend'           // sparkline of a register over time
  | 'machine'         // simple machine schematic: symbols bound to bits
  | 'panel';          // titled group frame drawn behind the elements it contains

export const HMI_ELEMENT_KINDS: HmiElementKind[] = [
  'header', 'panel', 'button', 'nav', 'indicator', 'multistate', 'numeric', 'numeric-entry', 'bar', 'trend',
  'machine', 'alarm-list', 'alarm-banner', 'datetime', 'text',
];

export const MACHINE_SYMBOL_KINDS: MachineSymbolKind[] = ['conveyor', 'motor', 'cylinder', 'sensor', 'valve', 'pump', 'tank', 'light', 'part', 'station'];

export type HmiStyle = 'normal' | 'ok' | 'warning' | 'alarm';

/** Who may operate an element / open a screen (C-more password groups). */
export type AccessLevel = 'operator' | 'maintenance' | 'engineer';

/** One state of a multistate display (also used for the header's mode text). */
export interface HmiState {
  value: number;
  text: string;
  style: HmiStyle;
}

export type MachineSymbolKind = 'conveyor' | 'motor' | 'cylinder' | 'sensor' | 'valve' | 'pump' | 'tank' | 'light' | 'part' | 'station';

/** A symbol inside a 'machine' element; x/y/w/h are relative to the element's top-left corner. */
export interface MachineSymbol {
  kind: MachineSymbolKind;
  label: string;
  /** Bit that shows the symbol active (running, extended, detecting, present). */
  address: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ButtonAction = 'momentary' | 'set' | 'reset' | 'toggle';

export interface HmiElement {
  id: string;
  kind: HmiElementKind;
  label: string;
  /** Position and size in the HMI's native pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** PLC address read/written by the element, e.g. "C101", "DS10". */
  address: string | null;
  action: ButtonAction | null;
  /** For nav buttons. */
  targetScreenId: string | null;
  /** Text when the bit is ON / OFF (indicators, toggle buttons). */
  onText: string | null;
  offText: string | null;
  /** 'normal' | 'warning' | 'alarm' | 'ok' — colors follow ISA-101 style. */
  style: HmiStyle;
  units: string | null;
  min: number | null;
  max: number | null;
  /** Hold-to-run, password, confirm, etc. */
  note: string | null;
  /** Multistate (and header mode) texts per value of `address`. */
  states?: HmiState[];
  /** Access level needed to operate it; 'operator' (or missing) means no password. */
  level?: AccessLevel;
  /** Permissive bit: the button is only enabled while this bit is ON (shown on the button). */
  interlock?: string | null;
  /** Symbols of a 'machine' element. */
  symbols?: MachineSymbol[];
}

export interface HmiScreen {
  id: string;
  name: string;
  purpose: string;
  elements: HmiElement[];
  /** Password level needed to open the screen. */
  level?: AccessLevel;
}

export interface HmiAlarm {
  address: string;
  message: string;
  severity: 'alarm' | 'warning';
}

export interface HmiTag {
  name: string;
  address: string;
  dataType: 'BIT' | 'INT' | 'INT2' | 'FLOAT';
  access: 'read' | 'write' | 'read-write';
  description: string;
}

export interface HmiDesign {
  hmiPartNumber: string;
  screens: HmiScreen[];
  alarms: HmiAlarm[];
  tags: HmiTag[];
  notes: string[];
  /** The notes that are questions / assumptions for the customer (the rest are technical issues for the design review). Absent on older designs. */
  askUser?: string[];
  generatedAt: string;
  /** Machine name shown in the header bar. */
  machineName?: string;
}
