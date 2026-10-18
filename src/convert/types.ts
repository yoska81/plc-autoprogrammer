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

export interface ExistingMachine extends Omit<ImportResult, 'components' | 'motors'> {
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
  };
  /** The machine description written from the drawings, one text per spec section ("" when nothing is known). */
  spec: Record<SpecSectionId, string>;
  /** What the drawings don't tell: asked on the Machine description page. */
  questions: { text: string; section: SpecSectionId; assumption: string | null }[];
}
