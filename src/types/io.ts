export type IOType = 'input' | 'output';

export type IOCategory =
  | 'Safety'
  | 'Operator/HMI'
  | 'External Machine'
  | 'Product Detection'
  | 'Conveyor'
  | 'Pneumatic'
  | 'Vacuum'
  | 'Servo/Axis'
  | 'Station 1'
  | 'Station 2'
  | 'Analog/Process'
  | 'Spare';

export interface IOPoint {
  id: string;
  description: string;
  type: IOType;
  category: IOCategory;
  /** Set when the point was imported from the template library. */
  templateId?: string;
  /** Manual PLC address override (e.g. "X103"); empty = assigned automatically. */
  plcAddress?: string;
  /** Field device type when known (from the spec or the electrical design), e.g. "sensor-pnp". */
  deviceType?: string;
  /** "analog" = 4-20 mA / 0-10 V signal on an analog channel (CLICK: a DF register); missing = discrete on/off. */
  signal?: 'discrete' | 'analog';
  /** Analog signal range and engineering-unit scaling (analog points only). */
  analog?: AnalogSpec;
}

/** Signal of an analog point; 'thermocouple' = a thermocouple wired straight to a thermocouple input module (no loop supply). */
export type AnalogRange = '4-20mA' | '0-20mA' | '0-5V' | '0-10V' | 'thermocouple';
export const ANALOG_RANGES: AnalogRange[] = ['4-20mA', '0-20mA', '0-5V', '0-10V', 'thermocouple'];

/** Physical range and the engineering units it is scaled to (configured in the PLC's analog setup). */
export interface AnalogSpec {
  range: AnalogRange;
  /** Engineering value at the bottom / top of the range, e.g. 0 and 500 (gal). */
  min: number;
  max: number;
  units: string;
  /** The range was assumed (an imported program did not say it): shown as "to check" until someone sets it. */
  assumed?: boolean;
}

export const isAnalog = (p: Pick<IOPoint, 'signal'>) => p.signal === 'analog';

const BARE_TC_RE = /thermocouple|\bT\/C\b|\btype [JKTENRSB]\b/i;
const LOOP_RE = /transmitter|transducer|\bmA\b|\d\s*-\s*\d+\s*(m?A|V)\b/i;

/**
 * The range an analog point is given when it is generated, imported or first made analog: a bare thermocouple
 * ("Seal bar temperature (thermocouple)", "type J") becomes 'thermocouple' instead of the 4-20 mA default, so it
 * lands on a thermocouple input (only a 'thermocouple' range may). A transmitter / mA / V description, or any range
 * other than the 4-20 mA default, is kept as it is.
 */
export function analogRangeFor(description: string, range: AnalogRange): AnalogRange {
  return range === '4-20mA' && BARE_TC_RE.test(description) && !LOOP_RE.test(description) ? 'thermocouple' : range;
}

/** An analog spec with its range set by analogRangeFor. */
export const withAnalogRange = (description: string, a: AnalogSpec): AnalogSpec => {
  const range = analogRangeFor(description, a.range);
  return range === a.range ? a : { ...a, range, ...(range === 'thermocouple' && a.units === '%' ? { units: '°C' } : {}) };
};

export interface TemplatePoint {
  templateId: string;
  description: string;
  type: IOType;
  category: IOCategory;
}
