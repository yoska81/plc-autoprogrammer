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

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};
const kind = (p: CatalogPart) => String(p.ratings.kind ?? '');

// ---------------------------------------------------------------------------------------------------------
// Which I/O points are motion points

export type ServoRole = 'pulse' | 'direction' | 'enable' | 'reset' | 'ready' | 'alarm' | 'inPosition' | 'homed' | 'zeroSpeed';

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
    return null;
  }
  if (/\b(alarm|fault|alrm)\b/i.test(d)) return 'alarm';
  if (/\b(ready|srdy)\b/i.test(d)) return 'ready';
  if (/\b(in[ -]?position|tpos|target position)\b/i.test(d)) return 'inPosition';
  if (/\b(home|homing) (complete|completed|done)\b/i.test(d)) return 'homed';
  if (/\bzero speed\b/i.test(d)) return 'zeroSpeed';
  return null;
}

/** Axis key of a servo point: "Axis 2 …" → "2", else the servo's own name, else "1". */
export function axisKey(description: string): string {
  const m = /\baxis\s*(\d+)\b/i.exec(description) ?? /\bservo\s*(\d+)\b/i.exec(description);
  return m ? m[1] : '1';
}

export const isServoPoint = (p: IOPoint) => p.signal !== 'analog' && (p.category === 'Servo/Axis' || SERVO_RE.test(p.description))
  && !AXIS_SENSOR_RE.test(p.description) && servoRole(p) !== null;
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
  sto: { aPlus: string; aMinus: string; bPlus: string; bMinus: string; fbPlus: string; fbMinus: string };
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
  sto: { aPlus: 'CN10-3', aMinus: 'CN10-4', bPlus: 'CN10-5', bMinus: 'CN10-6', fbPlus: 'CN10-7', fbMinus: 'CN10-8' },
  maxPulseKhzOC: 200,
  source: 'SureServo2 User Manual 2nd Ed. Rev C, ch. 3 (3.4.1 CN1 pins, 3.4.2 default DI/DO, 3.10 CN10 STO)',
};

/** Terminal map of a servo drive part (null: family not known — the drawings then show signal names only). */
export function servoPins(p: CatalogPart | undefined): ServoPins | null {
  if (!p) return null;
  return /sureservo\s*2|^SV2A-/i.test(`${p.ratings.series ?? ''} ${p.family ?? ''} ${p.partNumber}`) ? SUREServo2 : null;
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

  // ---- Servo axes
  const servoPoints = input.io.filter(isServoPoint);
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
      const dt = input.nextTag('SVD');
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
    if (!has('pulse') || !has('direction')) out.notes.push(`Axis ${key}: no ${!has('pulse') ? 'pulse' : 'direction'} output in the I/O list — position control needs pulse and direction outputs (CLICK PLUS: C2-14D1 option module, pulse on Y001 / Y003 / Y005).`);
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

/** "X001-X004" → X001, X002, X003, X004; "X1-X8" on slot 1 → X101 … X108 (the app's CLICK addressing: slot digit + point). */
function addressRange(text: string, slot = 0): string[] {
  const m = /([XY])0*(\d+)\s*-\s*[XY]?0*(\d+)/i.exec(text);
  if (!m) return [];
  const [, k, a, b] = m;
  return Array.from({ length: Number(b) - Number(a) + 1 }, (_, i) => `${k.toUpperCase()}${slot}${String(Number(a) + i).padStart(2, '0')}`);
}

/** A module in a PLC slot, as the electrical model groups the I/O (slot 1 = first module after the CPU). */
export interface SlotPart { slot: number; part?: CatalogPart }

/**
 * High-speed inputs and pulse outputs of a CPU, from its catalog ratings (hscInputs / hscMaxKHz, ptoAxes /
 * ptoOutputs, ptoNote; source in hscSource). CLICK PLUS has none of its own: they are on the option-slot module
 * (C2-14D1 / C2-08D1-…: pulses on its Y1 / Y3 / Y5, high-speed inputs X1-X8), so they are read from that
 * module at the slot the app addresses it in (Y101 / Y103 / Y105 in slot 1). Without such a module there are
 * no pulse outputs. Null when the catalog says nothing about high-speed I/O for this CPU (not checked).
 */
export function plcMotion(cpu: CatalogPart | undefined, slots: SlotPart[] = []): PlcMotion | null {
  const r = cpu?.ratings ?? {};
  if (r.hscInputs === undefined && r.ptoAxes === undefined && r.ptoNote === undefined) return null;
  if (/option slot/i.test(String(r.hscInputs ?? r.ptoOutputs ?? ''))) {
    const opt = slots.find((x) => /option slot/i.test(String(x.part?.ratings.moduleType ?? '')));
    const mr = opt?.part?.ratings ?? {};
    const axes = num(mr.ptoAxes) ?? 0;
    return {
      hsInputs: opt ? addressRange(String(mr.hscInputs ?? ''), opt.slot) : [], hsKhz: num(mr.hscMaxKHz),
      pulseOutputs: opt ? [1, 3, 5].slice(0, axes).map((n) => `Y${opt.slot}0${n}`) : [],
      note: r.ptoNote ? String(r.ptoNote) : undefined,
    };
  }
  const axes = num(r.ptoAxes) ?? 0;
  return {
    hsInputs: addressRange(String(r.hscInputs ?? '')), hsKhz: num(r.hscMaxKHz),
    pulseOutputs: ['Y001', 'Y003', 'Y005'].slice(0, axes), note: r.ptoNote ? String(r.ptoNote) : undefined,
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
