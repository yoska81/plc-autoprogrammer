/**
 * Guided fault finding, rules only (works without an API key): the meter steps along the wiring path of one
 * PLC point, and the answer to each step decides the next one. The point where the reading changes from bad
 * to good is where the fault is: an open conductor between two hops, a device that does not switch, a dead
 * supply. The AI (when there is a key) only rephrases the steps and ranks causes; it never replaces this.
 */
import type { PathHop, WiringPath } from './wiringPath';

export type Symptom = 'never-on' | 'always-on' | 'flickers' | 'output-dead';
export type Answer = 'yes' | 'no' | 'skip';

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  'never-on': 'never comes ON',
  'always-on': 'is ON all the time',
  flickers: 'flickers / drops out',
  'output-dead': 'the PLC turns it ON but nothing happens',
};

export interface Step {
  id: string;
  part: 'prepare' | 'signal' | 'supply' | 'return' | 'wiggle';
  hop?: PathHop;
  /** The instruction, in plain words. */
  say: string;
  /** The answer buttons. */
  yes: string;
  no: string;
  /** A wiggle test: the live PLC watch can answer it. */
  wiggle?: boolean;
}

export interface Verdict {
  /** What is wrong, in plain words. */
  text: string;
  /** What to do about it. */
  fix: string;
  /** The hops the fault lies between (or the one hop). */
  hops: PathHop[];
  /** Wire number of the faulty conductor, when one is pointed at. */
  wire?: string;
}

export interface Session {
  path: WiringPath;
  symptom: Symptom;
  steps: Step[];
  /** Index of the current step. */
  at: number;
  answers: Answer[];
  verdict: Verdict | null;
}

const where = (h: PathHop) => `${h.label}${h.where ? ` (drawing ${h.where.sheet}${h.where.line ? `, line ${h.where.line}` : ''})` : ''}`;
const read = (h: PathHop, other = false) => {
  const m = h.measure;
  if (!m) return '';
  const val = other ? (m.otherwise ?? '').replace(/\s+(when|with|while|after|below|in the).*$/i, '') || 'about 0 V' : m.expect;
  return `Measure between ${m.between[0]} and ${m.between[1]}. Do you read ${val}?`;
};
const measurable = (h: PathHop) => Boolean(h.measure) && h.kind !== 'cable' && h.kind !== 'supply' && h.measure!.kind !== 'VAC';

function signalSteps(p: WiringPath, other: boolean): Step[] {
  return p.signal.filter(measurable).map((h, i) => ({ id: `sig${i}`, part: 'signal', hop: h, say: `Go to ${where(h)}. ${read(h, other)}`, yes: other ? 'Yes, about 0 V' : `Yes, ${h.measure!.expect}`, no: 'No' }));
}
function supplySteps(p: WiringPath): Step[] {
  // Mains hops are checked by a qualified person only: stop at the power supply output.
  const out: Step[] = [];
  for (const h of p.supply) {
    if (!measurable(h)) continue;
    out.push({ id: `sup${out.length}`, part: 'supply', hop: h, say: `Check the supply at ${where(h)}. ${read(h)}`, yes: `Yes, ${h.measure!.expect}`, no: 'No' });
    if (h.kind === 'source') break;
  }
  return out;
}

/** Start guided fault finding on one point. */
export function startSession(path: WiringPath, symptom: Symptom): Session {
  const dev = path.device || 'the device';
  const steps: Step[] = [];
  if (symptom === 'flickers') {
    steps.push({ id: 'prep', part: 'prepare', say: `Leave ${dev} in one state (do not operate it). The app watches ${path.address} while you wiggle each connection in turn.`, yes: 'Ready', no: 'Cancel' });
    path.signal.filter((h) => h.kind === 'terminal' || h.kind === 'junction-box' || h.kind === 'device' || h.kind === 'cable').forEach((h, i) => steps.push({
      id: `wig${i}`, part: 'wiggle', hop: h, wiggle: true,
      say: `Wiggle the wire at ${where(h)} for about 10 seconds. Did ${path.address} flicker?`, yes: 'Yes, it flickered', no: 'No, steady',
    }));
  } else if (symptom === 'always-on') {
    steps.push({ id: 'prep', part: 'prepare', say: `Make sure ${dev} is OFF (not pressed, nothing in front of it). ${path.address} still shows ON?`, yes: 'Yes, still ON', no: 'No, it is OFF now' });
    steps.push(...signalSteps(path, true));
  } else {
    const on = path.type === 'input' ? `Operate ${dev} (press it / put the target in front of it) and keep it ON.` : `Turn ${path.address} ON (run the machine to that step, or force it from the Monitor tab with writes allowed).`;
    steps.push({ id: 'prep', part: 'prepare', say: `${on} Ready?`, yes: 'Ready', no: 'Cancel' });
    steps.push(...signalSteps(path, false));
  }
  return { path, symptom, steps, at: 0, answers: [], verdict: null };
}

function between(a: PathHop | undefined, b: PathHop | undefined): Verdict {
  const hops = [a, b].filter(Boolean) as PathHop[];
  const wire = b?.wire ?? a?.wire;
  return {
    text: `Open connection on wire ${wire ?? ''} between ${a ? a.label : 'the PLC'} and ${b ? b.label : 'the device'}.`,
    fix: `Check both ends of that conductor: loose or missing screw, wire not in the terminal, broken core in the cable. Re-terminate it and measure again.`,
    hops, wire,
  };
}

/** Next step after an answer (the session is immutable). */
export function answer(s: Session, a: Answer): Session {
  const step = s.steps[s.at];
  const answers = [...s.answers, a];
  const done = (v: Verdict): Session => ({ ...s, answers, verdict: v, at: s.at });
  const next = (extra: Step[] = []): Session => {
    const steps = extra.length ? [...s.steps.slice(0, s.at + 1), ...extra, ...s.steps.slice(s.at + 1)] : s.steps;
    if (s.at + 1 >= steps.length) return { ...s, steps, answers, at: s.at, verdict: endOfSteps(s) };
    return { ...s, steps, answers, at: s.at + 1 };
  };
  if (!step) return s;
  const p = s.path;
  const dev = p.device || 'the device';
  // The last good / bad hop answered before this one (skipped steps are not evidence).
  const prevHop = () => {
    for (let i = s.at - 1; i >= 0; i--) if (s.answers[i] !== 'skip' && s.steps[i].hop) return s.steps[i].hop;
    return undefined;
  };

  if (step.part === 'prepare') {
    if (a === 'no') {
      if (s.symptom === 'always-on') return done({ text: `${p.address} goes OFF when ${dev} is OFF: the wiring and the PLC work.`, fix: `${dev} was ON (actuated) — check what operates it.`, hops: [] });
      return done({ text: 'Stopped.', fix: '', hops: [] });
    }
    return next();
  }

  if (step.part === 'wiggle') {
    if (a === 'yes') return done({ text: `Loose connection at ${step.hop!.label} on wire ${step.hop!.wire ?? ''}.`, fix: 'Tighten the terminal screw, re-strip and re-terminate the wire (or replace the connector / cable), then wiggle again.', hops: [step.hop!], wire: step.hop!.wire });
    return next();
  }

  if (s.symptom === 'always-on') {
    // Walking out from the PLC with the device OFF: the first place that reads 0 V has the short just before it.
    if (step.part === 'signal' && a === 'yes') {
      const h = step.hop!;
      if (h.kind === 'plc') return done({ text: `${p.address} reads 0 V at the PLC terminal but the PLC shows it ON.`, fix: 'Check for a force on that address in the PLC, the input LED, and the input module.', hops: [h] });
      return done({ text: `24 V reaches wire ${h.wire ?? ''} before ${h.label}: a short to 24 V between ${prevHop()?.label ?? 'the PLC'} and ${h.label}.`, fix: 'Look for damaged insulation, a stray strand or a wrong jumper on that stretch; disconnect it and check.', hops: [prevHop(), h].filter(Boolean) as PathHop[], wire: h.wire });
    }
    if (step.part === 'signal' && a === 'no' && step.hop!.kind === 'device') return done({ text: `${dev} gives 24 V while it should be OFF.`, fix: `${dev} is stuck ON or faulty (sensor seeing something, contact welded): replace or adjust it.`, hops: [step.hop!] });
    return next();
  }

  // never-on / output-dead
  const input = p.type === 'input';
  if (step.part === 'signal') {
    const h = step.hop!;
    if (input) {
      // Inputs: the signal comes from the device; the first good reading out from the PLC is just past the break.
      if (a === 'yes') {
        if (h.kind === 'plc') return done({ text: `24 V reaches the PLC terminal ${p.address}: the field wiring is good.`, fix: `If ${p.address} still shows OFF: check the input common (0 V on COM), the input LED, a force or the module.`, hops: [h] });
        return done(between(prevHop(), h));
      }
      if (a === 'no' && h.kind === 'device') return next(supplySteps(p));
      return next();
    }
    // Outputs: the PLC drives the load; the first bad reading out from the PLC is just past the break.
    if (a === 'no') {
      if (h.kind === 'plc') return done({ text: `${p.address} is ON in the program but its terminal does not switch.`, fix: 'Check the output supply (V+ / C terminal), the output LED and the module (a burnt output).', hops: [h] });
      const prev = prevHop();
      // Good at a series contact's input, bad after it: the contact is open.
      if (prev?.kind === 'contact') return done({ text: `${prev.tag} blocks the signal: ${prev.note ?? 'its contact is open'}`, fix: `Find out why ${prev.tag} is OFF (safety relay not reset, two-hand released, overload tripped…). If it is ON, its contact is faulty.`, hops: [prev, h] });
      return done(between(prev, h));
    }
    if (a === 'yes' && h.kind === 'device') {
      // Power reaches the load: its other side (supply for sinking, return for sourcing) or the load itself.
      const other = [...supplySteps(p), ...p.ret.filter(measurable).slice(0, 1).map((r, i) => ({ id: `ret${i}`, part: 'return' as const, hop: r, say: `Check the return at ${where(r)}. ${read(r)}`, yes: `Yes, ${r.measure!.expect}`, no: 'No' }))];
      if (!other.length) return done({ text: `The output reaches ${dev}, but ${dev} does not work.`, fix: `${dev} itself is faulty (open coil, stuck valve, drive not ready): check it and replace it.`, hops: [h] });
      return next(other);
    }
    return next();
  }

  if (step.part === 'supply' || step.part === 'return') {
    const h = step.hop!;
    const supplyHops = s.steps.filter((x) => x.part === step.part);
    const first = supplyHops[0] === step;
    if (a === 'yes') {
      if (first) return done(input
        ? { text: `${dev} has its supply but gives no signal.`, fix: `${dev} is not switching: check its LED, alignment / target, setting, or replace it.`, hops: [h] }
        : { text: `${dev} has power on both sides but does not work.`, fix: `${dev} itself is faulty (open coil, stuck spool, drive not ready): check and replace it.`, hops: [h] });
      const before = s.steps.slice(0, s.at).filter((x) => x.part === step.part && x.hop).pop()?.hop;
      return done({ ...between(h, before), text: `The supply is good at ${h.label} but missing at ${before?.label ?? dev}: open connection on wire ${before?.wire ?? h.wire ?? ''} between them.` });
    }
    if (a === 'no' && h.kind === 'source') return done({ text: `No output from ${h.tag}.`, fix: `${h.tag}: check its DC OK lamp, a short on its output (disconnect the loads one by one), its primary breaker / fuse${h.note ? '' : ''}. Mains checks only by a qualified person.`, hops: [h] });
    return next();
  }
  return next();
}

function endOfSteps(s: Session): Verdict {
  const skipped = s.answers.filter((a) => a === 'skip').length;
  return {
    text: skipped ? `Not found yet: ${skipped} step${skipped === 1 ? ' was' : 's were'} skipped.` : 'Every point along the path read as expected.',
    fix: skipped ? 'Go back and take the skipped readings.' : `The fault is probably not in the wiring of ${s.path.address}: check the PLC program, a force, or the device's settings.`,
    hops: [],
  };
}

/** The current step, or null when finished. */
export const currentStep = (s: Session): Step | null => (s.verdict ? null : s.steps[s.at] ?? null);
