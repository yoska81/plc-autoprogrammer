/**
 * Guided fault finding, rules only (works without an API key): the meter steps along the wiring path of one
 * PLC point, and the answer to each step decides the next one. The point where the reading changes from bad
 * to good is where the fault is: an open conductor between two hops, a device that does not switch, a dead
 * supply, an open 0 V return or module common. The AI (when there is a key) only rephrases the steps and
 * ranks causes; it never replaces this.
 */
import type { Measure, PathHop, WiringPath } from './wiringPath';

export type Symptom = 'never-on' | 'always-on' | 'flickers' | 'output-dead' | 'analog-wrong';
export type Answer = 'yes' | 'no' | 'skip';

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  'never-on': 'never comes ON',
  'always-on': 'is ON all the time',
  flickers: 'flickers / drops out',
  'output-dead': 'the PLC turns it ON but nothing happens',
  'analog-wrong': 'reads wrong or out of range',
};

/** The symptoms that fit a point. */
export const symptomsFor = (p: WiringPath): Symptom[] => (p.analog ? ['analog-wrong'] : p.type === 'output' ? ['output-dead'] : ['never-on', 'always-on', 'flickers']);

export type StepPart = 'prepare' | 'signal' | 'supply' | 'return' | 'common' | 'wiggle' | 'isolate' | 'analog';

export interface Step {
  id: string;
  part: StepPart;
  hop?: PathHop;
  /** The instruction, in plain words. */
  say: string;
  /** The answer buttons. */
  yes: string;
  no: string;
  /** A wiggle test: the live PLC watch can answer it. */
  wiggle?: boolean;
  /** First step of a chain: what a good reading here means (a verdict, or the next chain to check). */
  okVerdict?: Verdict;
  okNext?: Step[];
  /** Analog flow: the verdict for yes / no, or the steps that follow. */
  onYes?: Verdict | Step[];
  onNo?: Verdict | Step[];
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

const LOCKOUT = 'Switch off and lock out first. ';
const lockout = LOCKOUT.toLowerCase();
const where = (h: PathHop) => `${h.label}${h.where ? ` (drawing ${h.where.sheet}${h.where.line ? `, line ${h.where.line}` : ''})` : ''}`;
const meter = (m: Measure) => ({
  VDC: 'Meter on DC volts.', VAC: 'Meter on AC volts.', mV: 'Meter on DC millivolts.', mA: '',
  continuity: 'Power OFF and locked out, meter on continuity.',
}[m.kind]);
const otherVal = (m: Measure) => (m.otherwise ?? '').replace(/\s+(when|with|while|after|below|in the|:).*$/i, '') || 'about 0 V';
/** The reading to take, in the words shown and spoken: meter setting, where, in what state, what to expect. */
export function readingText(h: PathHop, other = false): string {
  const m = h.measure;
  if (!m) return '';
  if (m.kind === 'mA') return `Break the loop at ${m.between[0]} and put the meter in SERIES on its mA range — never across the terminals (that shorts the transmitter). Do you read ${m.expect}?`;
  const when = !other && m.when ? `, ${m.when}` : '';
  return `${meter(m)} Measure between ${m.between[0]} and ${m.between[1]}${when}. Do you read ${other ? otherVal(m) : m.expect}?`;
}
const measurable = (h: PathHop) => Boolean(h.measure) && h.kind !== 'cable' && h.kind !== 'supply' && h.measure!.kind !== 'VAC';
const yesOf = (h: PathHop) => `Yes, ${h.measure!.expect.replace(/\s*\(.*$/, '')}`;

/** The chains checked after the signal: the device feed, the device's 0 V return and the module's common. */
export function chains(p: WiringPath) {
  const sinking = p.type === 'output' && p.signal[0]?.measure?.expect === 'about 0 V';
  // The power supply ends every chain (its +V / −V reading is the same from either side).
  const src = (hs: PathHop[]) => hs.filter((h) => h.kind === 'source').slice(0, 1);
  const retSource = src(p.ret).length ? src(p.ret) : src(p.supply);
  const sourcing = p.type === 'output' && !sinking;
  // An NPN input group has its common on 24+ (it is in the supply list), a PNP one on 0 V.
  const comOnPlus = p.type === 'input' && p.supply.some((h) => h.common);
  return {
    sinking,
    npn: p.type === 'input' && p.signal[0]?.measure?.expect === 'about 0 V',
    // The load / device feed: a sourcing output's load is fed by the output itself.
    feed: sourcing ? [] : p.supply.filter((h) => !h.common),
    // The device's own 0 V; a sinking output's load returns through the PLC instead.
    ret: sinking ? [] : p.ret.filter((h) => !h.common),
    // What the PLC module itself needs: its common to 0 V, or a sourcing module's output supply.
    common: sourcing ? p.supply : comOnPlus ? [...p.supply.filter((h) => h.common), ...(src(p.supply).length ? src(p.supply) : retSource)] : [...p.ret.filter((h) => h.common), ...retSource],
  };
}

function chainSteps(hops: PathHop[], part: 'supply' | 'return' | 'common', ok: Verdict | Step[]): Step[] {
  const what = { supply: 'the supply', return: 'the 0 V return', common: 'the module common' }[part];
  const out: Step[] = [];
  for (const h of hops) {
    if (!measurable(h)) continue;
    out.push({ id: `${part}${out.length}`, part, hop: h, say: `Check ${what} at ${where(h)}. ${readingText(h)}`, yes: yesOf(h), no: 'No' });
    if (h.kind === 'source') break;
  }
  if (out[0]) { if (Array.isArray(ok)) out[0].okNext = ok; else out[0].okVerdict = ok; }
  return out;
}

function analogSteps(p: WiringPath): Step[] {
  const dev = p.device || 'the transmitter';
  const mA = p.signal.find((h) => h.measure?.kind === 'mA');
  const mV = p.signal.find((h) => h.measure?.kind === 'mV');
  const across = p.signal.find((h) => h.kind === 'device' && h.measure?.kind === 'VDC');
  const plcHop = p.signal.find((h) => h.kind === 'plc');
  const prep: Step = { id: 'prep', part: 'prepare', say: `Note the value ${p.address} shows now and what it should be. The steps check the loop from the PLC out to ${dev}. Ready?`, yes: 'Ready', no: 'Cancel' };
  const setting = (h?: PathHop): Verdict => ({ text: 'The signal reaches the PLC module correctly: the wiring is good.', fix: `Check the channel setup of ${p.address}: signal type and range, scaling (engineering units), filter.`, hops: h ? [h] : [] });
  if (mV) {
    const ends = p.signal.filter((h) => h.kind === 'terminal');
    const names = ends.map((h) => `${h.tag}-${h.terminal}`).join(' and ') || dev;
    const ohms: Step = {
      id: 'tcohm', part: 'analog', hop: p.signal.find((h) => h.kind === 'device'),
      say: `Lift the two thermocouple wires at ${names}. Meter on ohms across the two thermocouple wires: do you read a few ohms?`, yes: 'Yes, a few ohms', no: 'No, open (OL)',
      onYes: { text: `${dev} and its extension cable are continuous but give no voltage at ${names}: the wires are shorted together or reversed, or the bar is at panel temperature.`, fix: `${LOCKOUT}Check the thermocouple polarity (+ / −) and the cable for a crushed spot, then check again with the bar hot.`, hops: [...ends, ...p.signal.filter((h) => h.kind === 'device')], wire: ends[0]?.wire },
      onNo: { text: `${dev} or its extension cable is open (burnt-out thermocouple or a broken wire).`, fix: `${LOCKOUT}Replace the thermocouple (same type), or find the break in its extension cable.`, hops: p.signal.filter((h) => h.kind === 'device' || h.kind === 'cable'), wire: p.signal.find((h) => h.kind === 'cable')?.wire },
    };
    // A good reading at the terminal strip does not prove the wires on to the module: measure there too.
    const mod = p.signal.filter((h) => h.kind === 'plc');
    const modPins = mod.map((h) => `${h.tag}:${h.terminal}`);
    const atModule: Step = {
      id: 'tcmod', part: 'analog', hop: mod[0], say: `Meter on DC millivolts. Measure at the module itself, between ${modPins.join(' and ')}. Do you read the same few millivolts?`, yes: 'Yes, the same', no: 'No (0 or very high)',
      onYes: setting(mod[0]),
      onNo: { text: `The thermocouple voltage reaches ${names} but not the module: the wiring between them is open or loose.`, fix: `${LOCKOUT}Re-terminate the thermocouple wires between ${names} and ${modPins.join(' / ')} (+ to CH+, − to CH−, thermocouple wire all the way) and check again.`, hops: [...ends, ...mod], wire: mod[0]?.wire },
    };
    return [prep, { id: 'tc', part: 'analog', hop: mV, say: `Go to ${where(ends[0] ?? mV)}. ${readingText(mV)}`, yes: 'Yes, a few mV', no: 'No (0 or very high)', onYes: [atModule], onNo: [ohms] }];
  }
  if (mA && across) {
    const plus = [...p.signal].reverse().find((h) => h.kind === 'terminal');
    const loopOk: Verdict = { text: `24 V reaches the loop at ${plus?.label ?? 'its + terminal'} but not across ${dev}: the loop is open between ${dev} and the PLC module.`, fix: `${LOCKOUT}Check the cable cores and the terminals between ${dev} and ${p.address}; re-terminate and check again.`, hops: p.signal.filter((h) => h.kind !== 'device' && h.kind !== 'cable'), wire: mA.wire };
    const loopV: Step[] = plus ? [{
      id: 'loopv', part: 'analog', hop: plus, say: `Meter on DC volts. Measure the loop supply between ${plus.tag}-${plus.terminal} and ${p.reference}. Do you read 24 VDC?`, yes: 'Yes, 24 VDC', no: 'No',
      onYes: loopOk,
      onNo: chainSteps(p.supply, 'supply', { text: `The loop supply is good at the power supply but missing at ${plus.label}.`, fix: `${LOCKOUT}Check the 24 V wire to ${plus.label} and its fuse / terminal.`, hops: [plus], wire: plus.wire }),
    }] : [];
    const current: Step = {
      id: 'ma', part: 'analog', hop: mA, say: readingText(mA), yes: yesOf(mA), no: 'No (0 mA or wrong)',
      onYes: setting(plcHop),
      onNo: { text: `${dev} has its loop voltage but does not set the right current.`, fix: `Check ${dev}: its range setting, the process itself, the + / − wiring. If all are right, ${lockout}replace it.`, hops: [across] },
    };
    return [prep, {
      id: 'across', part: 'analog', hop: across, say: `Go to ${where(across)}. ${readingText(across)}`, yes: 'Yes, 12–24 VDC', no: 'No, about 0 V',
      onYes: [current],
      onNo: loopV.length ? loopV : { text: `No loop voltage across ${dev}.`, fix: `${LOCKOUT}Check the loop supply and the loop wiring.`, hops: [across] },
    }];
  }
  // Voltage inputs and analog outputs: walk the signal out from the PLC like a discrete input.
  return [prep, ...p.signal.filter(measurable).map((h, i): Step => ({ id: `sig${i}`, part: 'signal', hop: h, say: `Go to ${where(h)}. ${readingText(h)}`, yes: yesOf(h), no: 'No' }))];
}

/** Start guided fault finding on one point. */
export function startSession(path: WiringPath, symptom: Symptom): Session {
  const dev = path.device || 'the device';
  const steps: Step[] = [];
  const signalSteps = (other: boolean) => path.signal.filter(measurable).map((h, i): Step => ({ id: `sig${i}`, part: 'signal', hop: h, say: `Go to ${where(h)}. ${readingText(h, other)}`, yes: other ? `Yes, ${otherVal(h.measure!)}` : yesOf(h), no: 'No' }));
  if (path.analog) {
    steps.push(...analogSteps(path));
  } else if (symptom === 'flickers') {
    steps.push({ id: 'prep', part: 'prepare', say: `Leave ${dev} in one state (do not operate it). The app watches ${path.address} while you wiggle each connection in turn.`, yes: 'Ready', no: 'Cancel' });
    path.signal.filter((h) => h.kind === 'terminal' || h.kind === 'junction-box' || h.kind === 'device' || h.kind === 'cable').forEach((h, i) => steps.push({
      id: `wig${i}`, part: 'wiggle', hop: h, wiggle: true,
      say: `Wiggle the wire at ${where(h)} for about 10 seconds. Did ${path.address} flicker?`, yes: 'Yes, it flickered', no: 'No, steady',
    }));
  } else if (symptom === 'always-on') {
    steps.push({ id: 'prep', part: 'prepare', say: `Make sure ${dev} is OFF (not pressed, nothing in front of it). ${path.address} still shows ON?`, yes: 'Yes, still ON', no: 'No, it is OFF now' });
    steps.push(...signalSteps(true));
  } else {
    const cond = path.signal[0]?.measure?.when.replace(/^when /, '') ?? '';
    const on = path.type === 'input'
      ? `Make ${dev} turn ${path.address} ON${cond && !/the device is ON/.test(cond) ? ` (${cond})` : ''} and keep it so.`
      : `Keep everyone clear first — the machine will move. Then turn ${path.address} ON: run the machine to that step, or force it from the Monitor tab with writes allowed.`;
    steps.push({ id: 'prep', part: 'prepare', say: `${on} Ready?`, yes: 'Ready', no: 'Cancel' });
    steps.push(...signalSteps(false));
  }
  return { path, symptom, steps, at: 0, answers: [], verdict: null };
}

function between(a: PathHop | undefined, b: PathHop | undefined): Verdict {
  const hops = [a, b].filter(Boolean) as PathHop[];
  const wire = b?.wire ?? a?.wire;
  return {
    text: `Open connection on wire ${wire ?? ''} between ${a ? a.label : 'the PLC'} and ${b ? b.label : 'the device'}.`,
    fix: `${LOCKOUT}Check both ends of that conductor: loose or missing screw, wire not in the terminal, broken core in the cable. Re-terminate it and measure again.`,
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
    if (s.at + 1 >= steps.length) return { ...s, steps, answers, at: s.at, verdict: endOfSteps(s, answers) };
    return { ...s, steps, answers, at: s.at + 1 };
  };
  const then = (r: Verdict | Step[] | undefined) => (!r ? next() : Array.isArray(r) ? next(r) : done(r));
  if (!step) return s;
  const p = s.path;
  const dev = p.device || 'the device';
  const ch = chains(p);
  // The last hop of the same walk answered before this one (skipped steps are not evidence).
  const prevHop = () => {
    for (let i = s.at - 1; i >= 0; i--) if (s.answers[i] !== 'skip' && s.steps[i].hop && s.steps[i].part === step.part) return s.steps[i].hop;
    return undefined;
  };

  if (step.part === 'prepare') {
    if (a === 'no') {
      if (s.symptom === 'always-on') return done({ text: `${p.address} goes OFF when ${dev} is OFF: the wiring and the PLC work.`, fix: `${dev} was ON (actuated) — check what operates it.`, hops: [] });
      return done({ text: 'Stopped.', fix: '', hops: [] });
    }
    return next();
  }

  if (step.part === 'analog') return a === 'skip' ? next() : then(a === 'yes' ? step.onYes : step.onNo);

  if (step.part === 'wiggle') {
    if (a === 'yes') return done({ text: `Loose connection at ${step.hop!.label} on wire ${step.hop!.wire ?? ''}.`, fix: `${LOCKOUT}Tighten the terminal screw, re-strip and re-terminate the wire (or replace the connector / cable), then wiggle again.`, hops: [step.hop!], wire: step.hop!.wire });
    return next();
  }

  if (step.part === 'isolate') {
    const h = step.hop!;
    if (a === 'yes') {
      const on = p.signal.filter((x) => x.wire && x.wire === h.wire);
      return done({ text: `Wire ${h.wire ?? ''} is shorted to ${ch.npn ? '0 V' : '24 V'} between the PLC and ${h.tag}: ${p.address} stays ON with ${h.tag} disconnected.`, fix: `${LOCKOUT}Disconnect that wire at each terminal in turn to find the stretch; look for damaged insulation, a stray strand or a wrong jumper. Then put the wire back on the device.`, hops: on.length ? on : [h], wire: h.wire });
    }
    if (a === 'no') return done({ text: `${dev} gives ${ch.npn ? '0 V' : '24 V'} (ON) while it should be OFF.`, fix: `${dev} is stuck ON or faulty (sensor seeing something, contact welded): ${lockout}replace or adjust it, then put the wire back.`, hops: [h] });
    return next();
  }

  if (step.part === 'supply' || step.part === 'return' || step.part === 'common') {
    const h = step.hop!;
    if (a === 'yes') {
      if (step.okNext?.length) return next(step.okNext);
      if (step.okVerdict) return done(step.okVerdict);
      const before = s.steps.slice(0, s.at).filter((x, i) => x.part === step.part && x.hop && s.answers[i] === 'no').pop()?.hop;
      const what = { supply: 'supply', return: '0 V return', common: 'module common' }[step.part];
      return done({ ...between(h, before), text: `The ${what} is good at ${h.label} but missing at ${before?.label ?? dev}: open connection on wire ${before?.wire ?? h.wire ?? ''} between them.` });
    }
    if (a === 'no' && h.kind === 'source') return done({ text: `No output from ${h.tag}.`, fix: `${h.tag}: check its DC OK lamp first. ${LOCKOUT}Then look for a short on its output (disconnect the loads one by one) and check its primary breaker / fuse. Mains checks only by a qualified person.`, hops: [h] });
    return next();
  }

  // A PNP input is ON at 24 V (a short to 24 V holds it ON); an NPN input is ON at 0 V (a short to 0 V does).
  const onV = ch.npn ? '0 V' : '24 V', offV = ch.npn ? '24 V' : '0 V';
  if (s.symptom === 'always-on') {
    // Walking out from the PLC with the device OFF: the first place that reads the OFF value has the short just before it.
    if (step.part === 'signal' && a === 'yes') {
      const h = step.hop!;
      if (h.kind === 'plc') return done({ text: `${p.address} reads ${offV} (OFF) at the PLC terminal but the PLC shows it ON.`, fix: 'Check for a force on that address in the PLC, the input LED, and the input module.', hops: [h] });
      return done({ text: `${onV} reaches wire ${h.wire ?? ''} before ${h.label}: a short to ${onV} between ${prevHop()?.label ?? 'the PLC'} and ${h.label}.`, fix: `${LOCKOUT}Look for damaged insulation, a stray strand or a wrong jumper on that stretch; disconnect it and check.`, hops: [prevHop(), h].filter(Boolean) as PathHop[], wire: h.wire });
    }
    if (step.part === 'signal' && a === 'no' && step.hop!.kind === 'device') {
      // The ON value all the way out to the device: the device itself, or the wire shorted. Take the wire off the device to tell.
      const h = step.hop!;
      return next([{ id: 'iso', part: 'isolate', hop: h, say: `${LOCKOUT}Take wire ${h.wire ?? ''} off ${h.tag}${h.terminal ? ` terminal ${h.terminal}` : ''} and tape the end, then switch back on. Does ${p.address} still show ON?`, yes: 'Yes, still ON', no: 'No, it went OFF' }]);
    }
    return next();
  }

  // never-on / output-dead
  if (step.part !== 'signal') return next();
  const h = step.hop!;
  if (p.type === 'input') {
    // Inputs: the signal comes from the device; the first good reading out from the PLC is just past the break.
    if (a === 'yes') {
      if (h.kind !== 'plc') return done(between(prevHop(), h));
      const ok: Verdict = { text: `The PLC terminal ${p.address} reads ${onV} (ON) and its common is connected: the field wiring is good.`, fix: `If ${p.address} still shows OFF: check the input LED, a force on the address, the input settings or the module.`, hops: [h] };
      const com = chainSteps(ch.common, 'common', ok);
      return com.length ? next(com) : done(ok);
    }
    if (a === 'no' && h.kind === 'device') {
      const ok: Verdict = { text: `${dev} has 24 V and 0 V but gives no signal.`, fix: `${dev} is not switching: check its LED, alignment / target, setting; ${lockout}replace it if it still does not switch.`, hops: [h] };
      const ret = chainSteps(ch.ret, 'return', ok);
      const sup = chainSteps(ch.feed, 'supply', ret.length ? ret : ok);
      return sup.length ? next(sup) : ret.length ? next(ret) : done(ok);
    }
    return next();
  }
  // Outputs: the PLC drives the load; the first bad reading out from the PLC is just past the break.
  if (a === 'no') {
    if (h.kind === 'plc') {
      const ok: Verdict = { text: `${p.address} has its ${ch.sinking ? 'common' : 'output supply'} but the terminal does not switch.`, fix: `Check that ${p.address} is really ON (output LED, Monitor tab). If it is, the output is burnt: ${lockout}move the load to a spare output or replace the module.`, hops: [h] };
      const com = chainSteps(ch.common, 'common', ok);
      return com.length ? next(com) : done(ok);
    }
    const prev = prevHop();
    // Good at a series contact's input, bad after it: the contact is open.
    if (prev?.kind === 'contact') return done({ text: `${prev.tag} blocks the signal: ${prev.note ?? 'its contact is open'}`, fix: `Find out why ${prev.tag} is OFF (safety relay not reset, two-hand released, overload tripped…). If it is ON, its contact is faulty.`, hops: [prev, h] });
    return done(between(prev, h));
  }
  if (a === 'yes' && h.kind === 'device') {
    // The output reaches the load: its other side (the feed of a sinking output's load, the 0 V of a sourcing one) or the load itself.
    const ok: Verdict = { text: `${dev} has power on both sides but does not work.`, fix: `${dev} itself is faulty (open coil, stuck spool, drive not ready): check it; ${lockout}replace it.`, hops: [h] };
    const other = ch.sinking ? chainSteps(ch.feed, 'supply', ok) : chainSteps(ch.ret, 'return', ok);
    return other.length ? next(other) : done(ok);
  }
  return next();
}

function endOfSteps(s: Session, answers: Answer[] = s.answers): Verdict {
  const skipped = answers.filter((a) => a === 'skip').length;
  return {
    text: skipped ? `Not found yet: ${skipped} step${skipped === 1 ? ' was' : 's were'} skipped.` : 'Every point along the path read as expected.',
    fix: skipped ? 'Use Back to take the skipped readings.' : `The fault is probably not in the wiring of ${s.path.address}: check the PLC program, a force, or the device's settings. If a reading looked doubtful, use Back and measure again.`,
    hops: [],
  };
}

/** The current step, or null when finished. */
export const currentStep = (s: Session): Step | null => (s.verdict ? null : s.steps[s.at] ?? null);

/** One answer back: the session replayed without the last answer (a misread meter, a wrong button). */
export function back(s: Session): Session {
  let r = startSession(s.path, s.symptom);
  for (const a of s.answers.slice(0, -1)) r = answer(r, a);
  return r;
}
