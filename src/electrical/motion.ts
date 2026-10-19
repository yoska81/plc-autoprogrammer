/**
 * Motion and new sensors in the electrical design: servo axes (drive + motor, branch protection, EMI filter,
 * braking resistor, STO from the safety relay, pulse/direction and drive I/O to the PLC, power and feedback
 * cables), incremental encoders on the PLC's high-speed inputs, and ultrasonic sensors (4-20 mA / 0-10 V on
 * an analog input, or PNP/NPN on a discrete one).
 *
 * The engine (src/electrical/engine) calls `motionDesign` before it wires the other I/O points: the points
 * this module claims are left out of the motor and device rules. Parts come from the catalog only (rating
 * keys below); anything the catalog cannot cover becomes a note, never an invented part.
 *
 * Catalog rating keys read here (the catalog's motion parts):
 *   servo drive  — category 'servoDrive': series, ratedWatts, inputVolts ('200-230 VAC' …), inputPhases ('1/3' | '3'),
 *                  inputAmps / inputAmpsNote ("2.8A at 230 VAC with 3-phase input"), breakerAmps (when the maker
 *                  states one), controlCircuitVolts ('L1C/L2C from AC supply' | '24 VDC'), pairsWith (motors)
 *   servo motor  — category 'servoMotor' (field): ratedWatts, pairsWith (drives), brake ('yes' | 'no')
 *   cables       — category 'other', kind 'servo cable' (cableType 'power' | 'brake') / 'encoder cable': forMotor, lengthM, flex
 *   EMI filter   — kind 'emc-filter' with amps (a line filter; ferrite rings are not counted);
 *   braking resistor — kind 'braking-resistor': forDrive, ohms, watts
 *   encoder      — category 'encoder': ppr, outputs ('A, B, Z'), outputType ('totem pole' | 'open collector' | 'line driver'), supplyVolts
 *   ultrasonic   — category 'sensor', type 'ultrasonic': output ('4-20 mA' | '0-10 V' | 'PNP' | 'NPN' | '4-20 mA + PNP'), rangeMaxMm
 * (The older keys kind 'servo-drive' / 'servo-motor' / 'servo-power-cable' / 'servo-feedback-cable' are read too.)
 *
 * SureServo2 (SV2A) terminals: SureServo2 User Manual 2nd Ed. Rev C, ch. 3 (cdn.automationdirect.com/static/
 * manuals/sureservo2manual/ch3.pdf): main circuit R/S/T, control power L1c/L2c (230 V drives), regenerative
 * resistor P3–D (built-in, shorted) or P3–C (external), motor U/V/W; CN1 pin table 3.4.1 (PULSE 43 / /PULSE 41,
 * SIGN 36 / /SIGN 37, PULL HI_P 39 / PULL HI_S 35, COM+ 11, DI1- 9 … DO5+ 28 / DO5- 27); default DI/DO 3.4.2
 * (DI1 SON, DI5 ARST; DO1 SRDY, DO2 ZSPD, DO3 HOME, DO4 TPOS, DO5 ALRM); CN10 STO 3.10 (3 STO_A+, 4 /STO_A,
 * 5 STO_B+, 6 /STO_B, 7 FDBK+, 8 FDBK-). Open-collector pulses: max 200 kHz, with PULL HI to the external 24 V.
 */
import { ALL_PARTS, DEFAULT_PREFERENCE, partsFor, type VendorPreference } from './catalogs';
import { SUPPLY_INFO, type Region } from '../standards/regions';
import type { CatalogPart, DesignComponent, FieldDeviceType, IOWiring, SupplyVoltage } from './types';
import type { IOPoint } from '../types/io';
import { pointsFromText } from './highSpeedIo';
import { axesFromSpec, isNetworkServoProject, isNetworkServoText, type NetworkAxisInput } from './mechatrolink';

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};
const kind = (p: CatalogPart) => String(p.ratings.kind ?? '');

// ---------------------------------------------------------------------------------------------------------
// Which I/O points are motion points

export type ServoRole = 'pulse' | 'direction' | 'enable' | 'reset' | 'cam' | 'ready' | 'alarm' | 'inPosition' | 'homed' | 'zeroSpeed' | 'driveOutput';

const SERVO_RE = /\bservo\b|\baxis\s*\d+\b/i;
/** Axis limit / home sensors are field sensors (the device rules wire them), not drive signals. */
const AXIS_SENSOR_RE = /\b(limit|overtravel|home (sensor|switch|prox))\b/i;
const ENCODER_RE = /\bencoder\b/i;
const ULTRASONIC_RE = /\bultra-?sonic\b/i;

export function servoRole(p: Pick<IOPoint, 'type' | 'description'>): ServoRole | null {
  const d = p.description;
  if (p.type === 'output') {
    if (/\b(pulse|step)\b/i.test(d)) return 'pulse';
    if (/\b(direction|dir|sign)\b/i.test(d)) return 'direction';
    if (/\b(reset|arst)\b/i.test(d)) return 'reset';
    if (/\b(servo on|enable|son)\b/i.test(d)) return 'enable';
    // Electronic cam / gear engage ("U2 DI7 CAM engage"): the drive follows its master encoder while it is on.
    if (/\be-?cam\b|\bcam\s+(engage|enable|on|start)\b|\belectronic\s+gear|\bgear(ing)?\s+(engage|in|on)\b|\bsync\w*\s+(engage|start|on)\b/i.test(d)) return 'cam';
    return null;
  }
  if (/\b(alarm|fault|alrm)\b/i.test(d)) return 'alarm';
  if (/\b(ready|srdy)\b/i.test(d)) return 'ready';
  if (/\b(in[ -]?position|tpos|target position)\b/i.test(d)) return 'inPosition';
  if (/\b(home|homing) (complete|completed|done)\b/i.test(d)) return 'homed';
  if (/\bzero speed\b/i.test(d)) return 'zeroSpeed';
  // Any other programmable output of the drive into the PLC ("U2 cut (DO3)"): wired to that DO.
  if (/\bDO\d\b/i.test(d)) return 'driveOutput';
  return null;
}

/** The drive's own tag when the description starts with it ("U2 DI1 SON", "U2 ready (DO1)"): one drive, not a new axis. */
export const driveTagLead = (description: string) => /^(U|SD|SV|SVD|A)\d+\b/i.exec(description.trim())?.[0].toUpperCase() ?? null;

/** Axis key of a servo point: the drive tag it starts with ("U2 …" → "U2"), "Axis 2 …" → "2", else the servo's own name, else "1". */
export function axisKey(description: string): string {
  const lead = driveTagLead(description);
  if (lead) return lead;
  const m = /\baxis\s*(\d+)\b/i.exec(description) ?? /\bservo\s*(\d+)\b/i.exec(description);
  return m ? m[1] : '1';
}

// Operator devices (a Reset that also resets the servo alarm, the servo enable selector) are field devices, not drive signals.
const OPERATOR_RE = /^(pushbutton|selector|estop|e-stop)/;
export const isServoPoint = (p: IOPoint) => p.signal !== 'analog' && (p.category === 'Servo/Axis' || SERVO_RE.test(p.description) || driveTagLead(p.description) !== null && /\b(DI|DO)\d\b/i.test(p.description))
  && !AXIS_SENSOR_RE.test(p.description) && !OPERATOR_RE.test(p.deviceType ?? '') && servoRole(p) !== null;
export const isEncoderPoint = (p: IOPoint) => p.type === 'input' && p.signal !== 'analog' && ENCODER_RE.test(p.description);
export const isUltrasonicPoint = (p: IOPoint) => p.type === 'input' && ULTRASONIC_RE.test(p.description);

/** A supply range ("10-30 VDC", "12-24 VDC", "24 VDC") that takes the panel's 24 V. */
const covers24 = (t: string) => { const m = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/.exec(t); return m ? Number(m[1]) <= 24 && Number(m[2]) >= 24 : /\b24\b/.test(t); };

/** Encoder channel of a point: "Encoder A" / "phase B" / "Z (index)". */
export function encoderChannel(description: string): 'A' | 'B' | 'Z' | null {
  const m = /\b(?:channel|ch|phase)?\s*([ABZ])\b(?![-/])/i.exec(description.replace(/\bencoder\b/i, ''));
  if (m) return m[1].toUpperCase() as 'A' | 'B' | 'Z';
  return /\b(index|marker)\b/i.test(description) ? 'Z' : null;
}

// ---------------------------------------------------------------------------------------------------------
// Drive terminals (per drive family)

export interface ServoPins {
  family: string;
  /** Main circuit and control power. */
  power: { line: string[]; control: string[]; motor: string[]; regen: { p: string; d: string; c: string } };
  pulse: { plus: string; minus: string; pullHi: string };
  direction: { plus: string; minus: string; pullHi: string };
  /** Input common (24 V for NPN / sinking, 0 V for PNP / sourcing). */
  com: string;
  /** Default DI function → terminal (the DI- pin). */
  di: Partial<Record<ServoRole, string>>;
  /** Default DO function → [DO+, DO-]. */
  do: Partial<Record<ServoRole, [string, string]>>;
  /** Every programmable DIn: its pin and the parameter that sets its function; DOn: [DO+, DO-]. */
  diPins: Record<number, { pin: string; param: string }>;
  doPins: Record<number, [string, string]>;
  /** Factory functions of the DIs / DOs (a signal put on one of them repurposes it). */
  diFactory: Record<number, string>;
  doFactory: Record<number, string>;
  sto: { aPlus: string; aMinus: string; bPlus: string; bMinus: string; fbPlus: string; fbMinus: string };
  /** The maker's names for the two STO channels and the feedback, the bypass to remove, and the connector header (default: SureServo2's). */
  stoNames?: { a: string; b: string; fb: string; bypass: string; connector: string; fbNote: string };
  /** Network-commanded drive (no pulse / direction): its network and the in / out connectors of the daisy chain. */
  network?: { name: string; in: string; out: string };
  /** Two-axis drive: the second axis's motor terminals (power.motor are axis A's). */
  motorB?: string[];
  /** Max pulse frequency with open-collector outputs (kHz). */
  maxPulseKhzOC: number;
  source: string;
}

export const SUREServo2: ServoPins = {
  family: 'SureServo2',
  power: { line: ['R', 'S', 'T'], control: ['L1C', 'L2C'], motor: ['U', 'V', 'W'], regen: { p: 'P3', d: 'D', c: 'C' } },
  pulse: { plus: 'CN1-43', minus: 'CN1-41', pullHi: 'CN1-39' },
  direction: { plus: 'CN1-36', minus: 'CN1-37', pullHi: 'CN1-35' },
  com: 'CN1-11',
  di: { enable: 'CN1-9', reset: 'CN1-33' },
  do: { ready: ['CN1-7', 'CN1-6'], zeroSpeed: ['CN1-5', 'CN1-4'], homed: ['CN1-3', 'CN1-2'], inPosition: ['CN1-1', 'CN1-26'], alarm: ['CN1-28', 'CN1-27'] },
  // CN1 table and DI function parameters (manual ch. 3).
  diPins: { 1: { pin: 'CN1-9', param: 'P2.010' }, 2: { pin: 'CN1-10', param: 'P2.011' }, 3: { pin: 'CN1-34', param: 'P2.012' }, 4: { pin: 'CN1-8', param: 'P2.013' }, 5: { pin: 'CN1-33', param: 'P2.014' },
    6: { pin: 'CN1-32', param: 'P2.015' }, 7: { pin: 'CN1-31', param: 'P2.016' }, 8: { pin: 'CN1-30', param: 'P2.017' }, 9: { pin: 'CN1-29', param: 'P2.036' }, 10: { pin: 'CN1-38', param: 'P2.037' } },
  doPins: { 1: ['CN1-7', 'CN1-6'], 2: ['CN1-5', 'CN1-4'], 3: ['CN1-3', 'CN1-2'], 4: ['CN1-1', 'CN1-26'], 5: ['CN1-28', 'CN1-27'] },
  diFactory: { 1: 'SON (servo on)', 5: 'ARST (alarm reset)', 6: 'NL (negative limit)', 7: 'PL (positive limit)' },
  doFactory: { 1: 'SRDY (servo ready)', 2: 'ZSPD (zero speed)', 3: 'HOME (homing done)', 4: 'TPOS (in position)', 5: 'ALRM (servo alarm)' },
  sto: { aPlus: 'CN10-3', aMinus: 'CN10-4', bPlus: 'CN10-5', bMinus: 'CN10-6', fbPlus: 'CN10-7', fbMinus: 'CN10-8' },
  maxPulseKhzOC: 200,
  source: 'SureServo2 User Manual 2nd Ed. Rev C, ch. 3 (3.4.1 CN1 pins, 3.4.2 default DI/DO, 3.10 CN10 STO)',
};

/**
 * Yaskawa MECHATROLINK-III SERVOPACKs (no pulse / direction: the axis is commanded over the network). Main circuit
 * L1/L2/L3, control power L1C/L2C, regenerative resistor B1/+ - B2 (external) with B2-B3 shorted for the built-in
 * one, motor U/V/W (SGD7W: UA/VA/WA and UB/VB/WB). CN8 safety: 3 /HWBB1-, 4 /HWBB1+, 5 /HWBB2-, 6 /HWBB2+,
 * 7 EDM1-, 8 EDM1+ (pins 1-2 not used); EDM1 is a source transistor output, ON when both /HWBB inputs are OFF
 * (base block), 30 VDC 50 mA max — like SureServo2's FDBK it is closed while torque is off, so it sits in the safety
 * relay's S33-S34 feedback loop. MECHATROLINK-III in CN6A / out CN6B, max 50 m between stations, no terminator.
 * Sources: SGD7S ML-III manual SIEP S800001 28 (4.3.1 terminals, 4.3.5 regenerative resistors, 4.6 CN8, 4.7
 * MECHATROLINK-III cables), SGD7W ML-III manual SIEP S800001 29 (UA/VA/WA, UB/VB/WB), SGD7W HWBB option SIEP S800001 72,
 * Sigma-V catalog KAEP S800000 42 (SGDV 400 V: 24 VDC control power, CN8 HWBB).
 */
const YASKAWA_STO = { aPlus: 'CN8-4', aMinus: 'CN8-3', bPlus: 'CN8-6', bMinus: 'CN8-5', fbPlus: 'CN8-8', fbMinus: 'CN8-7' };
const YASKAWA_STO_NAMES = {
  a: '/HWBB1', b: '/HWBB2', fb: 'EDM1', bypass: 'the CN8 safety jumper connector (JZSP-CVH05-E)', connector: 'CN8',
  fbNote: 'EDM1 is a transistor output (30 VDC, 50 mA max, 1.5 V drop): confirm the safety relay\'s feedback input takes a semiconductor contact (Yaskawa: PLe / SIL3 needs EDM1 monitored)',
};
const NO_PULSE = { plus: '', minus: '', pullHi: '' };
export const SIGMA7_ML3: ServoPins = {
  family: 'Sigma-7 MECHATROLINK-III',
  power: { line: ['L1', 'L2', 'L3'], control: ['L1C', 'L2C'], motor: ['U', 'V', 'W'], regen: { p: 'B1/+', d: 'B3', c: 'B2' } },
  pulse: NO_PULSE, direction: NO_PULSE, com: '', di: {}, do: {}, diPins: {}, doPins: {}, diFactory: {}, doFactory: {},
  sto: YASKAWA_STO, stoNames: YASKAWA_STO_NAMES, network: { name: 'MECHATROLINK-III', in: 'CN6A', out: 'CN6B' },
  maxPulseKhzOC: 0,
  source: 'Yaskawa SIEP S800001 28 (4.3 main circuit, 4.6 CN8 HWBB, 4.7 MECHATROLINK-III)',
};
export const SIGMA7W_ML3: ServoPins = {
  ...SIGMA7_ML3, family: 'Sigma-7W MECHATROLINK-III (2 axes)',
  power: { ...SIGMA7_ML3.power, motor: ['UA', 'VA', 'WA'] }, motorB: ['UB', 'VB', 'WB'],
  source: 'Yaskawa SIEP S800001 29 (main circuit, UA/VA/WA - UB/VB/WB), SIEP S800001 72 (HWBB option 700, one CN8 for both axes)',
};
export const SIGMAV_ML3_400V: ServoPins = {
  ...SIGMA7_ML3, family: 'Sigma-V 400 V MECHATROLINK-III',
  power: { line: ['L1', 'L2', 'L3'], control: ['24V', '0V'], motor: ['U', 'V', 'W'], regen: { p: 'B1/+', d: 'B2', c: 'B2' } },
  source: 'Yaskawa Sigma-V catalog KAEP S800000 42 / manual SIEP S800000 64 (400 V SGDV: 24 VDC control, CN8 HWBB)',
};

/** Terminal map of a servo drive part (null: family not known — the drawings then show signal names only). */
export function servoPins(p: CatalogPart | undefined): ServoPins | null {
  if (!p) return null;
  const id = `${p.ratings.series ?? ''} ${p.family ?? ''} ${p.partNumber}`;
  if (/sureservo\s*2|^SV2A-/i.test(id)) return SUREServo2;
  if (/MECHATROLINK-III/i.test(String(p.ratings.network ?? '')) && p.ratings.sto === 'yes') {
    if (/^SGD7W-/.test(p.partNumber)) return SIGMA7W_ML3;
    if (/^SGD7S-/.test(p.partNumber)) return SIGMA7_ML3;
    if (/^SGDV-\d{3}D/.test(p.partNumber)) return SIGMAV_ML3_400V;
  }
  return null;
}

export const isServoDrive = (p: CatalogPart | undefined) => !!p && (p.category === 'servoDrive' || kind(p) === 'servo-drive');
export const isServoMotor = (p: CatalogPart | undefined) => !!p && (p.category === 'servoMotor' || kind(p) === 'servo-motor');
const listOf = (v: unknown) => String(v ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
/** Cable kind of a part: motor power, holding brake or encoder feedback (null: not a servo cable). */
export function servoCableKind(p: CatalogPart | undefined): 'power' | 'brake' | 'feedback' | null {
  if (!p) return null;
  const k = kind(p), t = String(p.ratings.cableType ?? '');
  if (k === 'servo-power-cable' || (k === 'servo cable' && t === 'power')) return 'power';
  if (k === 'servo cable' && t === 'brake') return 'brake';
  if (k === 'servo-feedback-cable' || k === 'encoder cable') return 'feedback';
  return null;
}
/** Supply class of a drive: 230 or 460 V (from a number or the "200-230 VAC" text). */
export function voltClass(p: CatalogPart): number | undefined {
  const v = p.ratings.inputVolts;
  const nums = String(v ?? '').match(/\d{3}/g)?.map(Number) ?? (typeof v === 'number' ? [v] : []);
  if (nums.some((n) => n >= 380)) return 460;
  if (nums.some((n) => n >= 200)) return 230;
  return undefined;
}
/** Drive input current for the supply: inputAmps, else the maker's note ("2.8A at 230 VAC with 3-phase input", "AD page: 1.5A"). */
export function driveInputAmps(p: CatalogPart, phases: 1 | 3): number | undefined {
  const a = num(p.ratings.inputAmps);
  if (a !== undefined) return a;
  const note = String(p.ratings.inputAmpsNote ?? '');
  const ph = new RegExp(`([\\d.]+)\\s*A at 2\\d0 VAC with ${phases}-phase`, 'i').exec(note);
  if (ph) return Number(ph[1]);
  const one = /AD page:\s*([\d.]+)\s*A\b(?![^.]*at)/i.exec(note);
  return one ? Number(one[1]) : undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Design

export interface ServoAxis {
  key: string;
  /** Tags: drive, motor, branch protection, EMI filter, braking resistor. */
  drive: string;
  motor?: string;
  protection?: string;
  filter?: string;
  brakingResistor?: string;
  /** PLC signals by role (address, description). */
  signals: { role: ServoRole; address: string; description: string }[];
  /** Watts the axis was sized for and whether that was assumed. */
  watts: number;
  assumed: boolean;
}

export interface MotionInput {
  io: IOPoint[];
  addresses: Map<string, string>;
  supply: SupplyVoltage;
  region?: Region;
  pref?: VendorPreference;
  /** Specification text (axis power, vertical axes). */
  spec?: string;
  /** Device tag allocator shared with the engine. */
  nextTag: (prefix: string) => string;
  /** Candidate parts (tests pass their own); default: the catalog. */
  parts?: CatalogPart[];
  /** Parts not in the catalog yet, added to it (tests: stand-ins until the catalog has them). */
  extraParts?: CatalogPart[];
  /** The project's PLC CPU: a MECHATROLINK-III controller commands its axes over the network (no pulse / direction). */
  cpu?: CatalogPart;
  /** The project's network axis list (imported program / PLC page); without it the axes are read from the spec. */
  networkAxes?: NetworkAxisInput[];
}

export interface MotionResult {
  components: DesignComponent[];
  ioWiring: IOWiring[];
  notes: string[];
  askUser: string[];
  /** I/O point ids this module wired (the engine leaves them out). */
  claimed: Set<string>;
  axes: ServoAxis[];
  /** Line current of the servo drives (A): a continuous load for the main disconnect. */
  loadA: number;
  /** Servo axes over MECHATROLINK-III: the motor rules must not turn a servo axis into a VFD motor. */
  networkServo?: boolean;
  /** The I/O descriptions taken as MECHATROLINK-III servo signals (a motor read from one of them is no AC motor). */
  networkSignals?: string[];
}

/**
 * 24 VDC control input current of drives whose control circuit runs on 24 V: ratings.controlInputAmps, else
 * AutomationDirect's SureServo2 460 V spec table ("Control Power Input Current", ss2drives.pdf).
 */
const SV2_460_CONTROL_A: Record<string, number> = {
  'SV2A-4040': 1.17, 'SV2A-4075': 1.17, 'SV2A-4150': 1.17, 'SV2A-4200': 1.35, 'SV2A-4300': 1.63, 'SV2A-4550': 1.91, 'SV2A-4750': 1.91, 'SV2A-4F00': 4.26,
};
export function controlInputAmps(p: CatalogPart): number {
  if (!/24\s*V?DC/i.test(String(p.ratings.controlCircuitVolts ?? ''))) return 0;
  return num(p.ratings.controlInputAmps) ?? SV2_460_CONTROL_A[p.partNumber] ?? 0;
}

const comp = (tag: string, partNumber: string, quantity: number, fn: string, motorTag: string | null = null): DesignComponent => ({ tag, partNumber, quantity, function: fn, motorTag });

/** Candidates: the project's preferred vendors first, then everything (motion parts may come from one maker only). */
function candidates(parts: CatalogPart[] | undefined, pref: VendorPreference, ok: (p: CatalogPart) => boolean, extra: CatalogPart[] = []): CatalogPart[] {
  if (parts) return [...parts, ...extra].filter(ok);
  const preferred = (['servoDrive', 'servoMotor', 'encoder', 'sensor', 'breaker', 'other'] as const).flatMap((c) => partsFor(c, pref).parts).filter(ok);
  const seen = new Set(preferred.map((p) => p.partNumber));
  return [...preferred, ...[...ALL_PARTS, ...extra].filter((p) => ok(p) && !seen.has(p.partNumber))];
}

/** Axis power from the I/O descriptions or the spec: "Axis 1 … 400 W" / "0.75 kW"; null when not stated. */
export function axisWatts(key: string, texts: string[]): number | null {
  for (const t of texts) {
    if (key !== '1' && !new RegExp(`\\baxis\\s*${key}\\b`, 'i').test(t)) continue;
    const m = /(\d+(?:\.\d+)?)\s*(kw|w)\b/i.exec(t);
    if (m) return Number(m[1]) * (/kw/i.test(m[2]) ? 1000 : 1);
  }
  return null;
}

export function motionDesign(input: MotionInput): MotionResult {
  const pref = input.pref ?? DEFAULT_PREFERENCE;
  const out: MotionResult = { components: [], ioWiring: [], notes: [], askUser: [], claimed: new Set(), axes: [], loadA: 0 };
  const addr = (p: IOPoint) => input.addresses.get(p.id) ?? '';
  // As the engine's Picker: the first (preferred) vendor that has a fitting part, its smallest.
  const pick = (ok: (p: CatalogPart) => boolean, size: (p: CatalogPart) => number = () => 0): CatalogPart | undefined => {
    const all = candidates(input.parts, pref, ok, input.extraParts);
    const v = all[0]?.vendor ?? 'automationdirect';
    return all.filter((p) => (p.vendor ?? 'automationdirect') === v).sort((a, b) => size(a) - size(b))[0];
  };
  const info = SUPPLY_INFO[input.supply];

  // ---- Servo axes over MECHATROLINK-III (Yaskawa MP3300): from the axis list, not from I/O points
  const network = isNetworkServoProject(input.cpu, input.networkAxes);
  if (network) networkServos(input, out, pick);

  // ---- Servo axes
  const servoPoints = network ? [] : input.io.filter(isServoPoint);
  const byAxis = new Map<string, IOPoint[]>();
  for (const p of servoPoints) byAxis.set(axisKey(p.description), [...(byAxis.get(axisKey(p.description)) ?? []), p]);
  for (const [key, pts] of byAxis) {
    const texts = [...pts.map((p) => p.description), ...(input.spec ?? '').split(/\n|\.\s/)];
    const stated = axisWatts(key, texts);
    const watts = stated ?? 400;
    const vertical = texts.some((t) => new RegExp(`\\baxis\\s*${key}\\b.*\\b(vertical|z[- ]axis|lift|hoist)\\b|\\b(vertical|z[- ]axis)\\b.*\\baxis\\s*${key}\\b`, 'i').test(t));
    const v = info.volts;
    const cls = v >= 380 ? 460 : 230;
    const drive = pick((p) => isServoDrive(p) && (num(p.ratings.ratedWatts) ?? 0) >= watts && (voltClass(p) ?? cls) === cls
      && (info.phases === 3 || /1/.test(String(p.ratings.inputPhases ?? '1'))), (p) => num(p.ratings.ratedWatts) ?? 0);
    const axis: ServoAxis = { key, drive: '', signals: [], watts, assumed: stated === null };
    if (stated === null) out.askUser.push(`Axis ${key}: servo sized for ${watts} W — size it from the load (torque, inertia, speed) and confirm the motor and drive.`);
    if (!drive) {
      out.notes.push(`Axis ${key}: no servo drive in the catalog for ${watts} W at ${info.label} — select a servo drive and motor (pulse/direction input, STO).`);
    } else {
      const series = String(drive.ratings.series ?? drive.family ?? '');
      // A drive already named in the drawings ("U2") keeps its tag.
      const dt = /^\d+$/.test(key) ? input.nextTag('SVD') : key;
      axis.drive = dt;
      const motorTag = `AX${key}`;
      // Branch protection: the maker's recommended breaker, else 1.25 x the drive's input current.
      const inA = driveInputAmps(drive, info.phases === 3 ? 3 : 1);
      const needA = num(drive.ratings.breakerAmps) ?? (inA !== undefined ? inA * 1.25 : undefined);
      const poles = info.phases === 3 ? 3 : 2;
      const cb = needA === undefined ? undefined : pick((p) => p.category === 'breaker' && num(p.ratings.poles) === poles && (num(p.ratings.amps) ?? 0) >= needA
        && String(p.ratings.branchRated ?? 'yes') !== 'no' && (num(String(p.ratings.volts ?? '').match(/\d{3}/)?.[0]) ?? 600) >= v, (p) => num(p.ratings.amps) ?? 0);
      if (cb) {
        axis.protection = input.nextTag('CB');
        out.components.push(comp(axis.protection, cb.partNumber, 1, `Axis ${key} servo drive branch protection — ${num(cb.ratings.amps)} A >= ${needA!.toFixed(1)} A (${drive.ratings.breakerAmps !== undefined ? 'maker\'s recommended breaker' : '1.25 x drive input current'})`, motorTag));
      } else out.notes.push(`Axis ${key} (${drive.partNumber}): select the branch protection${needA !== undefined ? ` (>= ${needA.toFixed(1)} A, ${poles}-pole)` : ' from the drive manual'}.`);
      const filt = pick((p) => kind(p) === 'emc-filter' && num(p.ratings.amps) !== undefined && num(p.ratings.amps)! >= (inA ?? 0) && (num(p.ratings.volts) ?? 0) >= v, (p) => num(p.ratings.amps) ?? 0);
      if (filt) { axis.filter = input.nextTag('FL'); out.components.push(comp(axis.filter, filt.partNumber, 1, `Axis ${key} EMI filter on the drive input (as in the drive manual's wiring diagrams)`, motorTag)); }
      else out.notes.push(`Axis ${key}: the ${series || 'servo'} manual shows an EMI filter on the drive input — add one if the site needs it (CE / sensitive equipment nearby).`);
      out.loadA += inA ?? watts / (info.volts * (info.phases === 3 ? 1.732 : 1) * 0.85);
      if (/24\s*V?DC/i.test(String(drive.ratings.controlCircuitVolts ?? '')) && !controlInputAmps(drive)) out.notes.push(`Axis ${key} (${drive.partNumber}): the control circuit runs on 24 VDC — add its current (spec sheet) to the 24 V supply.`);
      // Branch protection: the manual's table (ch. 2.5) gives the maximum breaker / Class CC or J fuse per drive.
      out.notes.push(`Axis ${key} (${drive.partNumber}): check the branch breaker against the maximum in the drive manual's circuit breaker and fuse table (Class CC / J fuses are an alternative).`);
      out.components.push(comp(dt, drive.partNumber, 1, `Axis ${key} servo drive — ${num(drive.ratings.ratedWatts)} W >= ${watts} W${axis.assumed ? ' (assumed)' : ''}; pulse/direction from the PLC, STO from the safety relay`, motorTag));
      // The drive's own motors (pairsWith), the smallest that carries the axis; a holding brake on a vertical axis only.
      const pairs = listOf(drive.ratings.pairsWith);
      const fits = (p: CatalogPart) => isServoMotor(p) && (num(p.ratings.ratedWatts) ?? 0) >= watts
        && (pairs.length ? pairs.includes(p.partNumber) : listOf(p.ratings.pairsWith ?? p.ratings.forDrive).some((x) => x === drive.partNumber || (!!series && x.includes(series))));
      const brake = (p: CatalogPart) => /yes/i.test(String(p.ratings.brake ?? ''));
      const motor = pick((p) => fits(p) && brake(p) === vertical, (p) => num(p.ratings.ratedWatts) ?? 0) ?? pick(fits, (p) => num(p.ratings.ratedWatts) ?? 0);
      if (motor) {
        axis.motor = input.nextTag('SM');
        out.components.push(comp(axis.motor, motor.partNumber, 1, `Axis ${key} servo motor — ${num(motor.ratings.ratedWatts)} W${/yes/i.test(String(motor.ratings.brake ?? '')) ? ', holding brake 24 VDC' : ''}`, motorTag));
        // Shortest standard length, non-flex first (a moving axis needs the flex version: note).
        const cable = (k: 'power' | 'feedback') => pick((p) => servoCableKind(p) === k && listOf(p.ratings.forMotor ?? p.ratings.forPart).some((x) => x === motor.partNumber || motor.partNumber.startsWith(x)),
          (p) => (/yes/i.test(String(p.ratings.flex ?? '')) ? 1000 : 0) + (num(p.ratings.lengthM) ?? 0));
        for (const [k, what] of [['power', `motor power cable (U/V/W/PE${brake(motor) ? ' + brake' : ''})`], ['feedback', 'encoder feedback cable (CN2)']] as const) {
          const c = cable(k);
          if (c) out.components.push(comp(input.nextTag('SVC'), c.partNumber, 1, `Axis ${key} ${what}${num(c.ratings.lengthM) ? `, ${num(c.ratings.lengthM)} m — confirm the routed length` : ''}${/yes/i.test(String(c.ratings.flex ?? '')) ? ', flex' : '; use the flex version in a cable chain'}`, motorTag));
          else out.notes.push(`Axis ${key}: select the ${what} for ${motor.partNumber} (length from the machine layout).`);
        }
      } else out.notes.push(`Axis ${key}: no servo motor in the catalog matching ${drive.partNumber} — select the motor (and its power and feedback cables).`);
      if (vertical) {
        const br = pick((p) => kind(p) === 'braking-resistor' && String(p.ratings.forDrive ?? '').split(/[,;]\s*/).some((x) => x === drive.partNumber || (series && x.includes(series))), (p) => num(p.ratings.watts) ?? 0);
        if (br) { axis.brakingResistor = input.nextTag('BR'); out.components.push(comp(axis.brakingResistor, br.partNumber, 1, `Axis ${key} external regenerative (braking) resistor — vertical axis; P3-D jumper removed, resistor on P3-C`, motorTag)); }
        else out.notes.push(`Axis ${key}: vertical axis — size an external regenerative resistor (P3-C, P3-D jumper removed) and use a motor with holding brake, per the drive manual.`);
      }
    }
    for (const p of pts) {
      const role = servoRole(p)!;
      const a = addr(p);
      out.claimed.add(p.id);
      if (!a) continue;
      axis.signals.push({ role, address: a, description: p.description });
      out.ioWiring.push({ address: a, deviceTag: axis.drive || `SVD?${key}`, deviceType: 'servo-drive', description: p.description, location: 'Cabinet' });
    }
    const has = (r: ServoRole) => axis.signals.some((s) => s.role === r);
    if (!has('pulse') || !has('direction')) out.notes.push(`Axis ${key}: no ${!has('pulse') ? 'pulse' : 'direction'} output in the I/O list — position control needs pulse and direction outputs (CLICK PLUS: a C2-14D1 option-slot module, pulses on its Y1 / Y3 / Y5 — Y001 / Y003 / Y005, the option slot is slot 0).`);
    out.axes.push(axis);
  }

  // ---- Encoders (one per name: "Encoder A/B/Z" = one encoder; "Line 2 encoder A" a second one)
  const encPoints = input.io.filter(isEncoderPoint);
  const encGroups = new Map<string, IOPoint[]>();
  for (const p of encPoints) {
    const name = p.description.replace(/\b(channel|ch|phase)?\s*[ABZ]\b(?![-/])|\b(index|marker|pulse|input|signal)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
    encGroups.set(name, [...(encGroups.get(name) ?? []), p]);
  }
  for (const [, pts] of encGroups) {
    const isEnc = (p: CatalogPart) => p.category === 'encoder' || (p.category === 'sensor' && kind(p) === 'encoder');
    const outType = (p: CatalogPart) => String(p.ratings.outputType ?? p.ratings.output ?? '');
    // 24 V push-pull / open-collector (a 5 V line driver needs a receiver before the PLC); 1000 PPR or the nearest.
    const enc = pick((p) => isEnc(p) && !/line[- ]?driver/i.test(outType(p)) && covers24(String(p.ratings.supplyVolts ?? '24')), (p) => Math.abs((num(p.ratings.ppr) ?? 0) - 1000) + (/push[- ]?pull|totem/i.test(outType(p)) ? 0 : 0.5));
    const tag = input.nextTag('SE'); // ISA-5.1 speed element (ENC1 is the enclosure)
    if (enc) out.components.push(comp(tag, enc.partNumber, 1, `Incremental encoder, ${enc.ratings.ppr ?? '?'} PPR, ${outType(enc)} — channels ${pts.map((p) => encoderChannel(p.description) ?? '?').join('/')} to PLC high-speed inputs, 24 VDC supply, shielded cable (shield to PE at the cabinet end only)`));
    else out.notes.push(`${tag}: no 24 V push-pull / open-collector encoder in the catalog — select one (a 5 V line-driver encoder needs a line receiver before the PLC inputs).`);
    for (const p of pts) {
      out.claimed.add(p.id);
      const a = addr(p);
      if (a) out.ioWiring.push({ address: a, deviceTag: tag, deviceType: 'encoder', description: p.description });
    }
  }

  // ---- Ultrasonic sensors
  for (const p of input.io.filter(isUltrasonicPoint)) {
    const analog = p.signal === 'analog';
    const range = p.analog?.range ?? '4-20mA';
    const want = analog ? range.replace(/\s/g, '').toLowerCase() : /npn/i.test(p.description) ? 'npn' : 'pnp';
    const s = pick((q) => q.category === 'sensor' && (String(q.ratings.type ?? '') === 'ultrasonic' || kind(q) === 'ultrasonic') && String(q.ratings.output ?? '').replace(/\s/g, '').toLowerCase().includes(want), (q) => num(q.ratings.rangeMaxMm) ?? 0);
    const tag = input.nextTag(analog ? (/\blevel\b/i.test(p.description) ? 'LT' : 'ZT') : 'US');
    if (s) out.components.push(comp(tag, s.partNumber, 1, `Ultrasonic sensor — ${s.ratings.output}${s.ratings.rangeMaxMm ? `, up to ${s.ratings.rangeMaxMm} mm` : ''}: ${p.description}`));
    else out.notes.push(`${tag} (${p.description}): no ${analog ? range : want.toUpperCase()} ultrasonic sensor in the catalog — select one.`);
    out.claimed.add(p.id);
    const a = addr(p);
    if (a) out.ioWiring.push({ address: a, deviceTag: tag, deviceType: 'ultrasonic', description: p.description });
  }
  return out;
}

/**
 * MECHATROLINK-III axes: one SERVOPACK with safe torque off per axis, or one two-axis SGD7W for two neighbouring axes;
 * the motor the axis list names (else the drive's own motor for the axis power), its power and encoder cables, the
 * branch protection, and one MECHATROLINK-III cable per link of the daisy chain (CPU PORT1 → first drive CN6A, CN6B →
 * next drive CN6A …; no terminator). Drives that do not take the panel supply get a note (200 V Sigma-7 on 480 V).
 */
function networkServos(input: MotionInput, out: MotionResult, pick: (ok: (p: CatalogPart) => boolean, size?: (p: CatalogPart) => number) => CatalogPart | undefined) {
  out.networkServo = true;
  // I/O points that name a servo drive or axis: their signals go over MECHATROLINK-III — no field wiring, never a VFD.
  const netPoints = input.io.filter((p) => p.signal !== 'analog' && isNetworkServoText(p.description));
  for (const p of netPoints) out.claimed.add(p.id);
  out.networkSignals = netPoints.map((p) => p.description);
  if (netPoints.length) out.notes.push(`${netPoints.length} I/O point${netPoints.length > 1 ? 's name' : ' names'} a servo drive or axis (${netPoints.slice(0, 4).map((p) => p.description).join(', ')}${netPoints.length > 4 ? '…' : ''}): on MECHATROLINK-III these signals go over the network to the SERVOPACKs — not wired as field I/O, and never a VFD. If one is a separate AC motor on a VFD, name it "VFD" in its description.`);
  const all = input.networkAxes?.length ? input.networkAxes : axesFromSpec(input.spec ?? '');
  const info = SUPPLY_INFO[input.supply];
  const cls = info.volts >= 380 ? 460 : 230;
  const cpuAxes = num(input.cpu?.ratings.axes);
  const virtual = all.filter((a) => a.kind === 'virtual');
  const axes = all.filter((a) => a.kind !== 'virtual');
  if (virtual.length) out.notes.push(`${virtual.map((a) => a.name).join(', ')}: virtual axis (SVR) — no drive or motor.`);
  if (!axes.length) { out.notes.push(`${input.cpu?.partNumber}: no servo axes in the axis list or the specification — add them on the PLC page (or import the program) to get the SERVOPACKs, motors and the MECHATROLINK-III chain.`); return; }
  if (cpuAxes !== undefined && axes.length > cpuAxes) out.notes.push(`${axes.length} servo axes, but the ${input.cpu?.partNumber} commands ${cpuAxes}: choose the 32-axis CPU (-2-E) or add an SVC-01 module.`);
  const catalog = (pn?: string) => (pn ? [...ALL_PARTS, ...(input.extraParts ?? [])].find((p) => p.partNumber === pn) : undefined);
  const netDrive = (p: CatalogPart) => isServoDrive(p) && /MECHATROLINK-III/i.test(String(p.ratings.network ?? '')) && p.ratings.sto === 'yes';
  const motorW = (a: NetworkAxisInput) => a.watts ?? num(catalog(a.motorPartNumber)?.ratings.ratedWatts);
  const fitsSupply = (p: CatalogPart) => (voltClass(p) ?? cls) === cls && (info.phases === 3 || /1/.test(String(p.ratings.inputPhases ?? '')));
  // Only verified, current SERVOPACKs are chosen for a new axis; a legacy one (SGDV, no 1:1 replacement) only when the
  // axis list names it ("keep existing"). An unverified part only when nothing verified fits, and then with a warning.
  const current = (p: CatalogPart) => !/legacy/i.test(String(p.ratings.lifecycle ?? ''));
  const sizedBy = (watts: number, axesPer: number, supplyOk: boolean, ok: (p: CatalogPart) => boolean) => pick((p) => netDrive(p) && current(p) && ok(p) && (num(p.ratings.axes) ?? 1) === axesPer && (num(p.ratings.ratedWatts) ?? 0) >= watts && (!supplyOk || fitsSupply(p)), (p) => num(p.ratings.ratedWatts) ?? 0);
  const sized = (watts: number, axesPer: number, supplyOk: boolean) => {
    const v = sizedBy(watts, axesPer, supplyOk, (p) => p.verified);
    if (v) return v;
    const u = sizedBy(watts, axesPer, supplyOk, () => true);
    if (u) out.notes.push(`${u.partNumber}: chosen although its catalog data is not fully verified (${u.verify ?? 'see the catalog'}) — check it against the Yaskawa manual before ordering.`);
    return u;
  };
  const listOfPairs = (d: CatalogPart) => listOf(d.ratings.pairsWith);
  const units: { drive?: CatalogPart; axes: NetworkAxisInput[]; watts: number[] }[] = [];
  for (let i = 0; i < axes.length; i++) {
    const a = axes[i], b = axes[i + 1];
    const wa = motorW(a) ?? 400;
    if (a.watts === undefined && motorW(a) === undefined) out.askUser.push(`${a.name}: servo sized for ${wa} W — size it from the load (torque, inertia, speed) and confirm the motor and SERVOPACK.`);
    const given = catalog(a.drivePartNumber);
    if (a.drivePartNumber && !given) out.notes.push(`${a.name}: ${a.drivePartNumber} is not in the catalog — check the SERVOPACK model; a catalog drive is used instead.`);
    if (given && (num(given.ratings.axes) ?? 1) === 2 && b && b.drivePartNumber === given.partNumber) { units.push({ drive: given, axes: [a, b], watts: [wa, motorW(b) ?? 400] }); i++; continue; }
    if (given) { units.push({ drive: given, axes: [a], watts: [wa] }); continue; }
    // No model named: two neighbouring axes share a two-axis SGD7W when one carries both, else one SGD7S each.
    if (b && !b.drivePartNumber) {
      const wb = motorW(b) ?? 400;
      const dual = sized(Math.max(wa, wb), 2, true) ?? sized(Math.max(wa, wb), 2, false);
      if (dual) { units.push({ drive: dual, axes: [a, b], watts: [wa, wb] }); i++; continue; }
    }
    units.push({ drive: sized(wa, 1, true) ?? sized(wa, 1, false), axes: [a], watts: [wa] });
  }
  let prev = `PLC:M-III PORT1`;
  let links = 0;
  for (const u of units) {
    const keys = u.axes.map((a) => String(a.axis)).join('+');
    const motorTag = `AX${keys}`;
    const names = u.axes.map((a) => a.name).join(' / ');
    if (!u.drive) { out.notes.push(`${names}: no MECHATROLINK-III SERVOPACK with safe torque off in the catalog for ${Math.max(...u.watts)} W — select one.`); continue; }
    const d = u.drive;
    const dt = input.nextTag('SVD');
    const two = u.axes.length === 2;
    if (!fitsSupply(d)) out.notes.push(`${dt} ${d.partNumber}: takes ${d.ratings.inputVolts} (${d.ratings.inputPhases}-phase), not the ${info.label} supply — feed it from a ${voltClass(d) === 230 ? '200-240 V' : '380-480 V'} transformer sized for the servo load.`);
    if (/legacy/i.test(String(d.ratings.lifecycle ?? ''))) out.notes.push(`${dt} ${d.partNumber}: ${d.ratings.lifecycle} — kept because the axis list names it (existing machine); Yaskawa names no 1:1 replacement, so a new machine needs the Sigma-7 drive and motor chosen again from the load.`);
    if (!d.verified) out.notes.push(`${dt} ${d.partNumber}: catalog data not fully verified — ${d.verify ?? 'check it against the Yaskawa manual'}.`);
    // Branch protection: 1.25 x the input current (the maker's table in the manual gives the maximum).
    const inA = driveInputAmps(d, info.phases === 3 ? 3 : 1);
    const needA = num(d.ratings.breakerAmps) ?? (inA !== undefined ? inA * 1.25 : undefined);
    const poles = info.phases === 3 ? 3 : 2;
    const cb = needA === undefined ? undefined : pick((p) => p.category === 'breaker' && num(p.ratings.poles) === poles && (num(p.ratings.amps) ?? 0) >= needA
      && String(p.ratings.branchRated ?? 'yes') !== 'no' && (num(String(p.ratings.volts ?? '').match(/\d{3}/)?.[0]) ?? 600) >= info.volts, (p) => num(p.ratings.amps) ?? 0);
    if (cb) out.components.push(comp(input.nextTag('CB'), cb.partNumber, 1, `${names} SERVOPACK branch protection — ${num(cb.ratings.amps)} A >= ${needA!.toFixed(1)} A (1.25 x drive input current); check it against the SERVOPACK manual's breaker / fuse table`, motorTag));
    else out.notes.push(`${dt} ${d.partNumber}: select the branch protection${needA !== undefined ? ` (>= ${needA.toFixed(1)} A, ${poles}-pole)` : ' from the SERVOPACK manual'}.`);
    out.loadA += inA ?? (num(d.ratings.ratedWatts) ?? 400) * u.axes.length / (info.volts * (info.phases === 3 ? 1.732 : 1) * 0.85);
    out.components.push(comp(dt, d.partNumber, 1, `${names} SERVOPACK${two ? ' (two axes: A = ' + u.axes[0].name + ', B = ' + u.axes[1].name + ')' : ''} — ${num(d.ratings.ratedWatts)} W${two ? ' per axis' : ''}; MECHATROLINK-III ${prev.replace(/^PLC:/, 'from the CPU ')} → CN6A; safe torque off (HWBB) from the safety relay`, motorTag));
    if (/24\s*V?DC/i.test(String(d.ratings.controlCircuitVolts ?? ''))) out.notes.push(`${dt} ${d.partNumber}: control power 24 VDC — add its current (SERVOPACK manual) to the 24 V supply.`);
    // MECHATROLINK-III link into this drive: 1 m in the panel (confirm the routed length; max 50 m).
    const cable = pick((p) => kind(p) === 'network-cable' && /MECHATROLINK-III/i.test(String(p.ratings.network ?? '')), (p) => num(p.ratings.lengthM) ?? 0);
    links++;
    if (cable) out.components.push(comp(input.nextTag('NW'), cable.partNumber, 1, `MECHATROLINK-III cable ${prev.replace(/^PLC:/, 'CPU ')} → ${dt} CN6A, ${num(cable.ratings.lengthM)} m — confirm the routed length (max 50 m between stations)`));
    else out.notes.push(`MECHATROLINK-III cable ${prev} → ${dt} CN6A: select the cable.`);
    prev = `${dt}:CN6B`;
    u.axes.forEach((a, k) => {
      const vertical = /\b(vertical|z[- ]axis|lift|hoist)\b/i.test(a.name);
      const given = catalog(a.motorPartNumber);
      const fits = (p: CatalogPart) => isServoMotor(p) && (num(p.ratings.ratedWatts) ?? 0) >= u.watts[k] && (listOfPairs(d).includes(p.partNumber) || listOf(p.ratings.pairsWith).includes(d.partNumber));
      const fitsV = (p: CatalogPart) => fits(p) && p.verified;
      const motor = given ?? pick((p) => fitsV(p) && /yes/i.test(String(p.ratings.brake ?? '')) === vertical, (p) => num(p.ratings.ratedWatts) ?? 0) ?? pick(fitsV, (p) => num(p.ratings.ratedWatts) ?? 0)
        ?? pick(fits, (p) => num(p.ratings.ratedWatts) ?? 0);
      if (motor && !motor.verified && !given) out.notes.push(`${motor.partNumber}: chosen although its catalog data is not fully verified (${motor.verify ?? 'see the catalog'}) — check it before ordering.`);
      if (a.motorPartNumber && !given) out.notes.push(`${a.name}: motor ${a.motorPartNumber} is not in the catalog — check the model.`);
      if (!motor) { out.notes.push(`${a.name}: no servo motor in the catalog for ${d.partNumber} — select the motor and its cables.`); return; }
      const side = two ? ` (axis ${k === 0 ? 'A' : 'B'})` : '';
      out.components.push(comp(input.nextTag('SM'), motor.partNumber, 1, `${a.name} servo motor${side} — ${num(motor.ratings.ratedWatts)} W${/yes/i.test(String(motor.ratings.brake ?? '')) ? ', holding brake 24 VDC' : ''}`, motorTag));
      for (const [ck, what] of [['power', `motor power cable${/yes/i.test(String(motor.ratings.brake ?? '')) ? ' with brake' : ''}`], ['feedback', 'encoder cable']] as const) {
        const c = pick((p) => servoCableKind(p) === ck && listOf(p.ratings.forMotor).includes(motor.partNumber), (p) => (/yes/i.test(String(p.ratings.flex ?? '')) ? 1000 : 0) + (num(p.ratings.lengthM) ?? 0));
        if (c) out.components.push(comp(input.nextTag('SVC'), c.partNumber, 1, `${a.name}${side} ${what}, ${num(c.ratings.lengthM)} m — confirm the routed length; use the flex version in a cable chain`, motorTag));
        else out.notes.push(`${a.name}: select the ${what} for ${motor.partNumber} (length from the machine layout).`);
      }
    });
  }
  if (links) out.notes.push(`MECHATROLINK-III: ${links} link${links > 1 ? 's' : ''} from the CPU's PORT1 through ${units.filter((u) => u.drive).length} SERVOPACK${units.length > 1 ? 's' : ''} (CN6A in, CN6B out); the last CN6B stays open — MECHATROLINK-III needs no terminator.`);
}

/** Device type of a motion point for the I/O sheets (null = not a motion point). */
export function motionDeviceType(p: IOPoint): FieldDeviceType | null {
  if (isServoPoint(p)) return 'servo-drive';
  if (isEncoderPoint(p)) return 'encoder';
  if (isUltrasonicPoint(p)) return 'ultrasonic';
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// PLC motion capability (high-speed inputs, pulse outputs), from the makers' sheets.

export interface PlcMotion { hsInputs: string[]; hsKhz?: number; pulseOutputs: string[]; note?: string }

/** A module in a PLC slot, as the electrical model groups the I/O (slot 1 = first module after the CPU). */
export interface SlotPart { slot: number; part?: CatalogPart }

/**
 * High-speed inputs and pulse outputs of a CPU, from its catalog ratings (hscInputs / hscMaxKHz, ptoAxes /
 * ptoOutputs, ptoNote; source in hscSource). CLICK PLUS has none of its own: they are on the option-slot module
 * (C2-14D1 / C2-08D1-…: pulses on its Y1 / Y3 / Y5, high-speed inputs X1-X8), so they are read from that
 * module at the slot the app addresses it in (Y001 / Y003 / Y005, the option slot is slot 0). Without such a module there are
 * no pulse outputs. Null when the catalog says nothing about high-speed I/O for this CPU (not checked).
 */
export function plcMotion(cpu: CatalogPart | undefined, slots: SlotPart[] = []): PlcMotion | null {
  const r = cpu?.ratings ?? {};
  if (r.hscInputs === undefined && r.ptoAxes === undefined && r.ptoNote === undefined) return null;
  // The points come from the ratings text (highSpeedIo.ts reads it the same way): "Y1, Y3, Y5" on the module's slot.
  if (/option slot/i.test(String(r.hscInputs ?? r.ptoOutputs ?? ''))) {
    const opt = slots.find((x) => /option slot/i.test(String(x.part?.ratings.moduleType ?? '')));
    const mr = opt?.part?.ratings ?? {};
    return {
      hsInputs: opt ? pointsFromText(String(mr.hscInputs ?? ''), 'X', opt.slot) : [], hsKhz: num(mr.hscMaxKHz),
      pulseOutputs: opt ? pointsFromText(String(mr.ptoOutputs ?? ''), 'Y', opt.slot) : [],
      note: r.ptoNote ? String(r.ptoNote) : undefined,
    };
  }
  return {
    hsInputs: pointsFromText(String(r.hscInputs ?? ''), 'X'), hsKhz: num(r.hscMaxKHz),
    pulseOutputs: pointsFromText(String(r.ptoOutputs ?? ''), 'Y'), note: r.ptoNote ? String(r.ptoNote) : undefined,
  };
}

/** Warnings for encoder channels off the high-speed inputs and pulse/direction on a PLC without pulse outputs. */
export function motionWarnings(cpu: CatalogPart | undefined, cpuPn: string, io: { address: string; deviceType: string; description: string; deviceTag: string }[], slots: SlotPart[] = []): string[] {
  const cap = plcMotion(cpu, slots);
  if (!cap) return [];
  const w: string[] = [];
  const slow = io.filter((p) => p.deviceType === 'encoder' && !cap.hsInputs.includes(p.address.toUpperCase()));
  if (slow.length) {
    w.push(cap.hsInputs.length
      ? `${slow.map((p) => `${p.deviceTag} ${p.address}`).join(', ')}: encoder channel not on a high-speed input of the ${cpuPn} (${cap.hsInputs[0]}–${cap.hsInputs[cap.hsInputs.length - 1]}${cap.hsKhz ? `, ${cap.hsKhz} kHz` : ''}) — move it there.`
      : `${slow.map((p) => `${p.deviceTag} ${p.address}`).join(', ')}: the ${cpuPn} has no high-speed inputs for an encoder — choose a CPU with high-speed counters.`);
  }
  const pulses = io.filter((p) => p.deviceType === 'servo-drive' && servoRole({ type: 'output', description: p.description }) === 'pulse');
  const off = pulses.filter((p) => !cap.pulseOutputs.includes(p.address.toUpperCase()));
  if (off.length) {
    w.push(cap.pulseOutputs.length
      ? `${off.map((p) => `${p.deviceTag} ${p.address}`).join(', ')}: pulse output not on a pulse-train output of the ${cpuPn} (${cap.pulseOutputs.join(' / ')}) — move it there.`
      : `${off.map((p) => `${p.deviceTag} ${p.address}`).join(', ')}: the ${cpuPn} has no pulse-train output — use a C2-14D1 / C2-14D2 / C2-08D1 option-slot module on a CLICK PLUS CPU (pulses on its Y1 / Y3 / Y5), or command the servo over Modbus.`);
  }
  return w;
}
