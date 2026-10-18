/**
 * Motion limits of the chosen PLC: servo / stepper axes on pulse-train (PTO) outputs and encoders on high-speed
 * counters (HSC). The PLC's part ratings (src/electrical/catalogs, from the maker's manuals) give what it can do:
 *   hscQuadratureChannels / hscQuadratureZChannels  quadrature A-B / A-B+Z counters
 *   hscMaxKHz                                      highest count rate
 *   ptoAxes / ptoMaxKHz                            pulse-train axes and their highest pulse rate
 *   hscViaOptionSlot                               high-speed I/O only on the option module in a given slot
 * An application beyond them (more axes or encoders, too high a rate, coordinated / interpolated moves) is never
 * generated silently: the result says what does not fit and what would (CLICK PLUS with a slot-0 high-speed module,
 * a Productivity / BRX PLC, or a servo drive with its own indexer).
 */
import type { CatalogPart } from '../../electrical/types';

type Point = { description: string; type: string; category?: string };

export interface MotionNeed {
  /** Axes driven by pulse / direction (or CW / CCW) outputs from the PLC. */
  ptoAxes: { name: string; maxKHz?: number }[];
  /** Encoders counted by the PLC (quadrature; withZ = also a marker / index channel). */
  encoders: { name: string; withZ: boolean; maxKHz?: number }[];
  /** Coordinated motion the spec / I/O asks for: linear interpolation (axes moving on one vector), or nonlinear
   *  (circular / contouring, electronic gearing or camming). */
  coordinated: 'linear' | 'nonlinear' | null;
}

export interface MotionFit {
  ok: boolean;
  need: MotionNeed;
  /** What does not fit, one plain sentence each. */
  problems: string[];
  /** What would fit, when something does not. */
  recommend: string[];
  /** Configuration the user must do in the PLC software (e.g. the option module in slot 0). */
  notes: string[];
}

const AXIS_RE = /\b(servo|stepper|axis)\b/i;
const ENCODER_RE = /\bencoder\b/i;
const PULSE_RE = /\b(pulse|step|cw|ccw|pul)\b/i;
const groupOf = (d: string) => (/\baxis\s*(\d+|[xyzuvw])\b/i.exec(d)?.[1] ?? /\b([xyzuvw])[- ]axis\b/i.exec(d)?.[1] ?? /\b(?:servo|stepper|encoder)\s*(\d+)\b/i.exec(d)?.[1] ?? '1').toUpperCase();

/** Pulse rate in kHz from "1000 PPR … 3000 rpm" / "10000 pulses/rev at 600 rpm" / "50 kHz" in a description or the spec. */
export function rateKHz(text: string): number | undefined {
  const khz = /(\d+(?:\.\d+)?)\s*khz\b/i.exec(text);
  if (khz) return Number(khz[1]);
  const ppr = /(\d+(?:\.\d+)?)\s*(?:ppr|pulses?\s*(?:\/|per)\s*rev(?:olution)?|counts?\s*(?:\/|per)\s*rev|steps?\s*(?:\/|per)\s*rev)\b/i.exec(text);
  const rpm = /(\d+(?:\.\d+)?)\s*(?:rpm|r\/min)\b/i.exec(text);
  if (ppr && rpm) {
    // Quadrature counted ×4 when the text says so (×1 otherwise: the PLC counts A edges unless set to ×4).
    const mult = /\b(x|×)\s*4\b|\bquadrature\s*x?4\b/i.test(text) ? 4 : 1;
    return (Number(ppr[1]) * Number(rpm[1]) * mult) / 60 / 1000;
  }
  return undefined;
}

/** The motion an I/O list (and spec) needs. */
export function motionNeed(io: Point[], spec = ''): MotionNeed {
  const axes = new Map<string, Point[]>();
  for (const p of io) if ((p.category === 'Servo/Axis' || AXIS_RE.test(p.description)) && !ENCODER_RE.test(p.description)) axes.set(groupOf(p.description), [...(axes.get(groupOf(p.description)) ?? []), p]);
  const ptoAxes = [...axes].filter(([, ps]) => ps.some((p) => p.type === 'output' && PULSE_RE.test(p.description)))
    .map(([k, ps]) => ({ name: `Axis ${k}`, maxKHz: ps.map((p) => rateKHz(p.description)).find((x) => x !== undefined) }));
  const encs = new Map<string, Point[]>();
  for (const p of io) if (p.type === 'input' && ENCODER_RE.test(p.description) && !/\b(ok|fault|alarm|error)\b/i.test(p.description)) encs.set(groupOf(p.description), [...(encs.get(groupOf(p.description)) ?? []), p]);
  const encoders = [...encs].map(([k, ps]) => ({
    name: `Encoder ${k}`, withZ: ps.some((p) => /\b(z|index|marker)\b/i.test(p.description)),
    maxKHz: ps.map((p) => rateKHz(p.description)).find((x) => x !== undefined) ?? rateKHz(spec),
  }));
  const text = spec + ' ' + io.map((p) => p.description).join(' ');
  const coordinated = /\b(circular (?:interpolation|moves?)|arcs?|contouring|electronic (?:cam|gear\w*)|camming|flying (?:shear|saw) sync\w*)\b/i.test(text) ? 'nonlinear'
    : /\b(interpolat\w*|coordinated (?:motion|moves?)|gantry|vector moves?)\b/i.test(text) ? 'linear' : null;
  return { ptoAxes, encoders, coordinated };
}

/** Does the PLC (its part) cover the motion the I/O list needs? */
export function motionFit(io: Point[], cpu: CatalogPart | undefined, spec = ''): MotionFit {
  const need = motionNeed(io, spec);
  const problems: string[] = [], recommend: string[] = [], notes: string[] = [];
  const r = (cpu?.ratings ?? {}) as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : Number(r[k]) || 0);
  const name = cpu?.partNumber ?? 'the PLC';
  const family = String(r.family ?? '');
  const clickPlus = /CLICK PLUS/i.test(family), click = /^CLICK$/i.test(family);
  if (!need.ptoAxes.length && !need.encoders.length && !need.coordinated) return { ok: true, need, problems, recommend, notes };

  const pto = n('ptoAxes'), ptoKHz = n('ptoMaxKHz');
  // CLICK PLUS Position Move: one axis, or up to 3 axes together on one vector ("using Interpolation", CLICK help
  // topic 296); no circular moves, gearing or camming.
  const linearAxes = clickPlus ? Math.min(3, pto) : 0;
  if (need.coordinated === 'nonlinear') problems.push(`The machine needs circular moves, electronic gearing or camming: ${name} ${clickPlus ? 'only moves axes on straight-line vectors (up to 3 axes interpolated)' : 'has no coordinated motion'}.`);
  else if (need.coordinated === 'linear' && !linearAxes) problems.push(`The machine needs interpolated (coordinated) moves: ${name} has no coordinated motion.`);
  else if (need.coordinated === 'linear' && need.ptoAxes.length > linearAxes) problems.push(`${need.ptoAxes.length} axes must move together; ${name} interpolates up to ${linearAxes}.`);
  if (need.ptoAxes.length > pto) problems.push(pto ? `${need.ptoAxes.length} pulse-train axes needed; ${name} gives ${pto}.` : `${need.ptoAxes.length} pulse-train axis${need.ptoAxes.length > 1 ? 'es' : ''} needed; ${name} has no pulse-train (PTO) outputs.`);
  for (const a of need.ptoAxes) if (a.maxKHz && ptoKHz && a.maxKHz > ptoKHz) problems.push(`${a.name} needs ${a.maxKHz.toFixed(1)} kHz of pulses; ${name} gives up to ${ptoKHz} kHz.`);
  const quad = n('hscQuadratureChannels'), quadZ = n('hscQuadratureZChannels'), hscKHz = n('hscMaxKHz');
  const withZ = need.encoders.filter((e) => e.withZ).length;
  if (need.encoders.length > quad) problems.push(quad ? `${need.encoders.length} encoders needed; ${name} counts up to ${quad} quadrature encoders.` : `${need.encoders.length} encoder${need.encoders.length > 1 ? 's' : ''} needed; ${name} has no high-speed counters.`);
  else if (withZ > quadZ) problems.push(`${withZ} encoders with a Z (index) channel needed; ${name} counts up to ${quadZ} with Z.`);
  for (const e of need.encoders) if (e.maxKHz && hscKHz && e.maxKHz > hscKHz) problems.push(`${e.name} gives ${e.maxKHz.toFixed(1)} kHz; ${name}'s high-speed counters take up to ${hscKHz} kHz.`);

  if (r.hscViaOptionSlot && (need.ptoAxes.length || need.encoders.length)) notes.push(`High-speed I/O on ${name} is only on the option-slot module in ${String(r.hscViaOptionSlot).replace(/ only$/i, '')}: ${String(r.ptoOutputs ?? r.hscInputs ?? '')}. Configure the counters / pulse outputs there in the PLC software.`);
  if (problems.length) {
    if (click && need.coordinated !== 'nonlinear') recommend.push('CLICK PLUS (C2-01CPU / C2-03CPU) with a C2-14D1 / C2-14D2 (3 pulse axes, 8 high-speed inputs) or C2-08D1-4VC / C2-08D2-4VC (2 axes, 4 inputs) in option slot 0.');
    if (need.coordinated === 'nonlinear' || need.ptoAxes.length > 3 || (clickPlus && problems.length)) recommend.push('A PLC with motion control (Productivity2000 / Productivity3000 or BRX with high-speed I/O) for more axes or coordinated moves.');
    recommend.push('Or a servo drive with its own indexer (e.g. SureServo2 in position-register mode), started by discrete outputs or Modbus, so the PLC needs no pulse outputs.');
  }
  return { ok: !problems.length, need, problems, recommend, notes };
}
