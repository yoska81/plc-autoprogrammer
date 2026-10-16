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
  | 'bar';            // bar graph of a register

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
  style: 'normal' | 'ok' | 'warning' | 'alarm';
  units: string | null;
  min: number | null;
  max: number | null;
  /** Hold-to-run, password, confirm, etc. */
  note: string | null;
}

export interface HmiScreen {
  id: string;
  name: string;
  purpose: string;
  elements: HmiElement[];
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
  generatedAt: string;
}
