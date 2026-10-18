/**
 * An existing machine read from its drawings (PDF / images / DXF): what the "Convert existing drawings"
 * and "Upgrade existing program" flows start from. ImportResult (src/lib/ai/importAI.ts) plus what a
 * conversion needs: the supply as drawn, component ratings, interlocks, the safety circuit, and the
 * machine description the AI writes from the drawings (gaps become questions on the description page).
 */
import type { ImportResult } from '../lib/ai/importAI';
import type { SpecSectionId } from '../spec/types';
import type { StarterType } from '../electrical/types';

/** Ratings read from the drawing or the part's legend (null when not printed). */
export interface DrawnRatings {
  amps: number | null;
  poles: number | null;
  /** Coil / control voltage as printed, e.g. "220VAC", "24VDC". */
  coilVoltage: string | null;
  /** Breaking capacity / interrupting rating in kA. */
  kA: number | null;
  /** Breaker trip curve (B, C, D). */
  curve: string | null;
  /** Overload / motor protector setting range, A. */
  minAmps: number | null;
  maxAmps: number | null;
  /** Motor or drive power in kW. */
  kw: number | null;
  /** Power supply output. */
  outputVolts: number | null;
  outputAmps: number | null;
}

export interface DrawnComponent {
  tag: string;
  partNumber: string | null;
  manufacturer: string | null;
  description: string;
  category: ImportResult['components'][number]['category'];
  ratings: DrawnRatings;
  confidence: 'high' | 'medium' | 'low';
  /** Where it was read, e.g. "sheet 1, column 3" or "parts list, row 5". */
  source: string;
  /** Wire numbers read at its terminals (cabinet photos). */
  wires?: { terminal: string; wire: string }[];
  /** Every photo it was seen in, with its box (fractions 0-1) — cabinet photos. */
  photos?: { photo: number; x: number; y: number; w: number; h: number }[];
}

export interface DrawnMotor {
  tag: string;
  description: string;
  kw: number | null;
  hp: number | null;
  starter: StarterType | null;
  reversing: boolean;
  /** A servo motor belongs to an axis (see axes), not to the panel's motor starters. */
  kind?: 'induction' | 'servo';
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

/** A servo axis: drive, motor, position feedback and what runs its logic. */
export interface DrawnAxis {
  tag: string;
  description: string;
  driveTag: string;
  drivePart: string | null;
  motorTag: string;
  motorKw: number | null;
  /** Extra position feedback, e.g. "line-length encoder on CN1-11/13". */
  encoder: string | null;
  brakingResistor: string | null;
  /** Drive I/O used, e.g. ["CN1-19 enable", "CN1-17 cutter down"]. */
  signals: string[];
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

/**
 * A control circuit read as a function: the coil, valve, lamp or drive input it drives and the contacts
 * that make it (start/stop with seal-in, interlocks, timers, counters, length controllers), or a function
 * a drive or controller does with its built-in logic (e.g. a servo drive's flying shear).
 */
/** One element of a coil's path from the left rail to the right rail, as drawn (old tags). */
export interface PathContact { t: 'contact'; tag: string; nc: boolean; terms: string | null; kind: 'pb' | 'relay' | 'timer' | 'limit' | 'ol' | 'selector' | 'safety' | 'other' }
export type PathEl =
  | PathContact
  | { t: 'coil'; tag: string; kind: 'relay' | 'contactor' | 'timer-on' | 'timer-off' | 'counter' | 'solenoid' | 'light' | 'drive-input'; preset: string | null; terms: string | null }
  /** Parallel paths (one level: contacts only), e.g. the start button with the seal-in across it. */
  | { t: 'branch'; paths: PathContact[][] };

export interface DrawnCircuit {
  /** Stable key (C1, C2… in the order read), for the review and the rungs of the new drawings. */
  id?: string;
  /** What it drives: the coil, valve, lamp or drive input, e.g. "KM2". */
  output: string;
  /** The function in plain words, e.g. "Oil pump runs while cutting is on and the main contactor is in". */
  function: string;
  kind: 'start-stop' | 'interlock' | 'timer' | 'counter' | 'length' | 'sequence' | 'drive-logic' | 'other';
  /** The contacts in the order drawn, in plain words, e.g. ["SA4 cutting on (NO)", "KM1 aux (NO)", "KM2 seal-in (NO)"]. */
  conditions: string[];
  /** The coil's path, left rail to right rail, contacts in series, branches in parallel; ends with the coil (or a drive input). */
  path?: PathEl[];
  /** The self-hold (seal-in) contact across the start, e.g. "KA1 11-14"; null when the coil has none. */
  sealIn?: string | null;
  /** Every device tag in the circuit, the output included. */
  devices: string[];
  /** Timer / counter / length setting as drawn, e.g. "KT1 on-delay 5 s"; null when none. */
  setting: string | null;
  /** Where the logic is: hardwired relays and contactors, or a drive's / controller's built-in logic. */
  logicIn: 'relays' | 'drive' | 'controller';
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

/** How a drive stops on an E-stop or guard. */
export interface DriveStop {
  tag: string;
  /** wired: its STO inputs are wired to the safety circuit; not-wired: it has STO but it is bridged / unused;
   * none: no STO on the drive; unknown: the drawings don't show it. */
  sto: 'wired' | 'not-wired' | 'none' | 'unknown';
  /** What stops it now, e.g. "single KA1 contact on MI1 (run command)". */
  stopsBy: string;
}

/** An I/O point as read; id: stable key for the review (addresses repeat on a machine without a PLC, e.g. "KM1 coil"). */
export type DrawnIO = ImportResult['io'][number] & { id?: string };

/** The review key of an I/O point: its id, else its place in the list. */
export const ioId = (p: DrawnIO, i: number) => p.id ?? `io${i + 1}`;

export interface ExistingMachine extends Omit<ImportResult, 'components' | 'motors' | 'io'> {
  io: DrawnIO[];
  /** Drawing convention the set follows. */
  drawingStandard: 'IEC' | 'GB' | 'JIS' | 'NFPA' | 'other';
  /** Main language of the drawing text, e.g. "Chinese", "English". */
  language: string;
  /** Supply exactly as drawn. */
  supplyDrawn: { volts: number | null; hz: number | null; phases: number | null; text: string };
  components: DrawnComponent[];
  motors: DrawnMotor[];
  /** Interlocks read from the wiring: contacts in series with coils, cross-interlocks, permissives. */
  interlocks: { description: string; devices: string[] }[];
  /** The control circuits, each as a function (on a machine without a PLC, this is its logic). */
  circuits: DrawnCircuit[];
  /** Servo axes (none: []). */
  axes: DrawnAxis[];
  /** What runs the machine's logic: a PLC, a servo drive's built-in controller, relays… */
  controller: 'plc' | 'servo-drive' | 'relays' | 'other';
  safety: {
    estops: string[];
    guards: string[];
    safetyRelay: string | null;
    /** Category / PL as drawn or inferred, e.g. "Cat 3", "PL d"; null when not shown. */
    category: string | null;
    /** safety-relay: a monitored safety relay; hardwired: the E-stop opens the power or control circuit itself;
     * control-only: the E-stop is just an input of a controller or drive (not a safety circuit). */
    kind: 'safety-relay' | 'hardwired' | 'control-only';
    description: string;
    /** How each drive (VFD, servo drive) is stopped: its Safe Torque Off wired to the safety circuit, or not. */
    drives: DriveStop[];
  };
  /** The machine description written from the drawings, one text per spec section ("" when nothing is known). */
  spec: Record<SpecSectionId, string>;
  /** What the drawings don't tell: asked on the Machine description page. */
  questions: { text: string; section: SpecSectionId; assumption: string | null }[];
  /** Terminal-strip points with the wire number read on each (cabinet photos). */
  terminals?: { strip: string; terminal: string; wire: string }[];
  /** Wires traced by their numbers: each wire's ends ("K1:A1", "TB1:3") — cabinet photos. */
  wiring?: { wire: string; ends: string[] }[];
}
