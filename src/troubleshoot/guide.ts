/**
 * Guided fault finding: from a why-stuck finding (whyStuck.ts) to the faulty wire, device or setting, one
 * question at a time. A finding whose next step is 'wiring' is walked along the point's wiring path (Debug 4's
 * src/troubleshoot/wiringPath.ts): every hop with a meter reading is one Yes / No / Didn't-check question.
 *   input that never arrives   PLC terminal → outward to the device: the fault is just inside the first hop that
 *                              reads right; a right reading at the PLC terminal means the PLC input / common.
 *                              Nothing right up to the device → the device's supply, then its return, then the device.
 *   input stuck ON             isolate: take the wire off at the device — still ON → the wiring is shorted, else the device.
 *   output ON, nothing moves   PLC terminal → outward to the load: the fault is just before the first hop that
 *                              reads wrong; wrong at the PLC terminal → the output's supply / common / fuse.
 *                              Right all the way to the load → its return, then the load itself.
 * Settings, logic, operator actions and timers end at once with their action (actions.ts). Rules only; pure.
 */
import type { Blocker, StuckContext, StuckTarget, Values, WhyStuck } from './whyStuck';
import { whyStuck } from './whyStuck';
import { clickEditSteps, nextAction, settingChange, type SettingChange } from './actions';
import type { LadderProgram } from '../plc/core/ladder';

/** The parts of Debug 4's PathHop / WiringPath the guide reads (structurally the same types). */
export interface GuideMeasure { between: [string, string]; kind: string; expect: string; when: string; otherwise?: string }
export interface GuideHop { kind: string; tag: string; terminal?: string; wire?: string; label: string; where: { sheet: string; line?: string } | null; location: string; measure?: GuideMeasure; note?: string }
export interface GuidePath { address: string; description: string; type: 'input' | 'output'; device: string; signal: GuideHop[]; supply: GuideHop[]; ret: GuideHop[]; reference: string }

export type Answer = 'yes' | 'no' | 'skip';
type PathName = 'signal' | 'supply' | 'ret';

export interface GuideStep {
  id: string;
  phase: 'plc' | 'signal' | 'supply' | 'return' | 'device' | 'isolate';
  /** The question: "Measure TB2-1 to TB1 0V with the sensor seeing a part: about 24 VDC?" */
  text: string;
  point: string;
  hop?: { path: PathName; index: number };
  measure?: GuideMeasure;
  where?: GuideHop['where'];
  /** Mains hops: the warning to show before the question. */
  danger?: string;
}

export interface GuideResult {
  text: string;
  point: string;
  hop?: { path: PathName; index: number };
  fix: string[];
  /** The span not narrowed down because steps were skipped. */
  unchecked?: string;
  /** Device faults for the device at fault (Dev 1's deviceFaults, through `deviceFaults`). */
  deviceFaults?: unknown[];
  settingChange?: SettingChange;
  editSteps?: string[];
}

interface Walk {
  path: PathName;
  /** Hop indexes with a reading, in walking order. */
  order: number[];
  at: number;
  /** Inputs: looking for the first right reading; outputs: the first wrong one. */
  lookFor: 'yes' | 'no';
  /** Last hop answered the other way (the fault is between it and the hop that answers lookFor). */
  last: number | null;
  skipped: number[];
}

export interface GuideState {
  why: WhyStuck;
  blocker: Blocker | null;
  path: GuidePath | null;
  step: GuideStep | null;
  history: { step: GuideStep; answer: Answer }[];
  result: GuideResult | null;
  /** Internal walk state. */
  walk: Walk | null;
  stage: 'plc' | 'isolate' | PathName | 'device' | 'done';
}

export interface GuideOptions {
  program: LadderProgram;
  values: Values;
  target: StuckTarget;
  ctx?: StuckContext;
  /** Wiring paths of the design (Debug 4's wiringPaths(ctx)), or a lookup by PLC point. */
  paths: GuidePath[] | ((point: string) => GuidePath | null);
  /** Which blocker to chase (index into why.blockers, default the most likely). */
  blocker?: number;
  /** Device faults for a device tag and symptom (Dev 1's faultsOfKind / faultsMatching on the design's part). */
  deviceFaults?: (deviceTag: string, symptom: 'no-input' | 'output-no-motion' | 'stuck-on') => unknown[];
}

const hopName = (h: GuideHop) => `${h.label}${h.wire ? ` (wire ${h.wire})` : ''}${h.where ? ` — ${h.where.sheet}${h.where.line ? ` line ${h.where.line}` : ''}` : ''}`;
const question = (m: GuideMeasure) => `Measure ${m.between[0]} to ${m.between[1]} (${m.kind})${m.when ? `, ${m.when}` : ''}: ${m.expect}?`;

/** Start: the finding, then the first question (or the result when there is nothing to measure). */
export function startGuide(o: GuideOptions): GuideState {
  const why = whyStuck(o.program, o.values, o.target, o.ctx);
  const blocker = why.blockers[o.blocker ?? 0] ?? null;
  const base: GuideState = { why, blocker, path: null, step: null, history: [], result: null, walk: null, stage: 'done' };
  if (!blocker) return { ...base, result: { text: why.summary, point: '', fix: [] } };
  if (blocker.next !== 'wiring') {
    const a = nextAction(blocker);
    const sc = blocker.kind === 'setting' ? settingChange(blocker, o.program) : null;
    return { ...base, result: { text: blocker.explain, point: blocker.point, fix: [a.text], ...(sc ? { settingChange: sc } : {}), ...(a.steps ? { editSteps: a.steps } : {}) } };
  }
  const path = typeof o.paths === 'function' ? o.paths(blocker.point) : o.paths.find((p) => p.address.toUpperCase() === blocker.point.toUpperCase()) ?? null;
  if (!path) return { ...base, result: { text: `${blocker.explain} The wiring of ${blocker.point} is not in the electrical design: follow its wire from the PLC terminal by hand.`, point: blocker.point, fix: [] } };
  const s: GuideState = { ...base, path, stage: 'plc' };
  const stuckOn = blocker.kind === 'input' && blocker.expected === false;
  const plc: GuideStep = path.type === 'input'
    ? stuckOn
      ? { id: 'isolate', phase: 'isolate', point: path.address, text: `Lock out the device side if needed, then take the signal wire off at ${path.device || 'the device'} (or unplug its cable). Is ${path.address} still ON on the PLC (its input LED)?` }
      : { id: 'plc', phase: 'plc', point: path.address, text: `Make ${path.device || 'the device'} detect / operate it. Is the input LED of ${path.address} ON on the PLC?` }
    : { id: 'plc', phase: 'plc', point: path.address, text: `Is the output LED of ${path.address} ON on the PLC?` };
  return { ...s, stage: stuckOn ? 'isolate' : 'plc', step: plc };
}

/** Next state for an answer to the current step (pure). */
export function answer(state: GuideState, a: Answer, o: Pick<GuideOptions, 'deviceFaults'> = {}): GuideState {
  if (!state.step || state.result || !state.path || !state.blocker) return state;
  const path = state.path;
  const s: GuideState = { ...state, history: [...state.history, { step: state.step, answer: a }] };
  const done = (r: GuideResult): GuideState => ({ ...s, step: null, stage: 'done', result: r });
  const device = (symptom: 'no-input' | 'output-no-motion' | 'stuck-on', text: string, fix: string[]): GuideState =>
    done({ text, point: path.address, fix, ...(path.device && o.deviceFaults ? { deviceFaults: o.deviceFaults(path.device, symptom) } : {}) });

  if (state.stage === 'isolate') {
    if (a === 'yes') return done({ text: `${path.address} stays ON with the device disconnected: the signal wire is shorted to 24 V between the PLC and ${path.device || 'the device'}, or the PLC input is faulty.`, point: path.address, fix: [`Check the signal wire of ${path.address} for a short to 24 V along its run: ${path.signal.map((h) => h.label).join(' → ')}.`, 'If the wire is fine: swap the wire to a spare input to test the PLC input.'] });
    if (a === 'no') return device('stuck-on', `${path.address} goes OFF with the device disconnected: the device itself is made (stuck sensor, a target in front of it, a held or broken button).`, [`Check ${path.device || 'the device'}: its target / mounting / LED; replace it if it stays ON with nothing in front of it.`]);
    return done({ text: 'Not checked: disconnect the device to tell a shorted wire from a stuck device.', point: path.address, fix: [] });
  }
  if (state.stage === 'plc') {
    if (path.type === 'input') {
      if (a === 'yes') return done({ text: `The input LED of ${path.address} is ON but the program sees it OFF: the program reads another address, the input is forced, or the PLC is not in RUN.`, point: path.address, fix: ['Check the address in the program against the I/O list, and remove any force (CLICK: Data View / Override).'] });
      return walkStart({ ...s, stage: 'signal' }, 'signal', 'yes', o);
    }
    if (a === 'no') return done({ text: `The output LED of ${path.address} is OFF: the program does not turn it on (or the PLC is not in RUN).`, point: path.address, fix: ['Go back to "Why is it stuck?" for this output: its rung is not true.'] });
    return walkStart({ ...s, stage: 'signal' }, 'signal', 'no', o);
  }
  // A meter reading along a path.
  return walkAnswer(s, a, o);
}

function measured(path: GuidePath, name: PathName): number[] {
  return path[name].map((h, i) => (h.measure ? i : -1)).filter((i) => i >= 0);
}

function stepFor(path: GuidePath, name: PathName, i: number): GuideStep {
  const h = path[name][i];
  const m = h.measure!;
  const danger = /\bDANGER\b/.test(m.when) || /\bVAC\b/.test(m.kind) ? 'Mains voltage: only a qualified person, with the right meter and PPE.' : undefined;
  return { id: `${name}:${i}`, phase: name === 'ret' ? 'return' : name, point: path.address, text: `${h.label}${h.where ? ` (${h.where.sheet}${h.where.line ? ` line ${h.where.line}` : ''})` : ''}. ${question(m)}`, hop: { path: name, index: i }, measure: m, where: h.where, ...(danger ? { danger } : {}) };
}

function walkStart(s: GuideState, name: PathName, lookFor: 'yes' | 'no', o: Pick<GuideOptions, 'deviceFaults'>): GuideState {
  const order = measured(s.path!, name);
  if (!order.length) return walkEnd({ ...s, walk: { path: name, order, at: 0, lookFor, last: null, skipped: [] } }, o);
  return { ...s, stage: name, walk: { path: name, order, at: 0, lookFor, last: null, skipped: [] }, step: stepFor(s.path!, name, order[0]) };
}

function walkAnswer(s: GuideState, a: Answer, o: Pick<GuideOptions, 'deviceFaults'>): GuideState {
  const w = s.walk!;
  const path = s.path!;
  const i = w.order[w.at];
  const hops = path[w.path];
  const done = (r: GuideResult): GuideState => ({ ...s, step: null, stage: 'done', result: r });
  if (a !== w.lookFor) {
    const next: Walk = { ...w, at: w.at + 1, ...(a === 'skip' ? { skipped: [...w.skipped, i] } : { last: i }) };
    if (next.at < w.order.length) return { ...s, walk: next, step: stepFor(path, w.path, w.order[next.at]) };
    return walkEnd({ ...s, walk: next }, o);
  }
  // The boundary: between the last hop answered the other way and this one.
  const first = w.at === 0;
  const here = hops[i];
  const prev = w.last !== null ? hops[w.last] : null;
  const unchecked = w.skipped.length ? { unchecked: `Skipped: ${w.skipped.map((k) => hops[k].label).join(', ')} — the fault may also be there.` } : {};
  const span = prev ? `between ${hopName(prev)} and ${hopName(here)}` : `at or before ${hopName(here)}`;
  const at = { path: w.path, index: i };
  const lost = (what: string) => done({ text: `${what} ${span}.`, point: path.address, hop: at, ...unchecked,
    fix: [`Check the wire${prev?.wire ? ` ${prev.wire}` : here.wire ? ` ${here.wire}` : ''} and its terminations ${span}: loose screw, broken core, wrong terminal${[here, prev].some((h) => h?.kind === 'protection') ? ', a tripped breaker / blown fuse' : ''}${[here, prev].some((h) => h?.kind === 'contact') ? ', an open series contact' : ''}.`] });
  if (w.path === 'signal') {
    if (path.type === 'input' && first) return done({ text: `The signal reaches the PLC terminal (${here.label}) but the input LED is OFF: the input's common (C1 / C2…) is open, the sensor type (PNP / NPN) does not match how the common is wired, or the input is faulty.`, point: path.address, hop: at,
      fix: ['Measure the input common against the supply reference; check the sinking / sourcing wiring of the common.', 'Move the wire to a spare input to test the PLC input.'] });
    if (path.type === 'output' && first) return walkStart({ ...s, stage: 'supply' }, 'supply', 'yes', o);
    return lost(path.type === 'input' ? 'The signal is lost' : 'The output voltage is lost');
  }
  if (w.path === 'supply') {
    if (first && path.type === 'input') return walkStart({ ...s, stage: 'ret' }, 'ret', 'no', o);
    if (first) return done({ text: `The output's supply is right but the PLC terminal ${path.address} has no voltage with its LED ON: the output point, its common or the module's fuse.`, point: path.address, hop: at,
      fix: ['Check the output common and the module fuse (if any); move the load to a spare output to test the point.'] });
    return lost('The supply is lost');
  }
  return lost('The return (0 V / neutral) is open');
}

/** A path walked to its end without finding the boundary. */
function walkEnd(s: GuideState, o: Pick<GuideOptions, 'deviceFaults'>): GuideState {
  const path = s.path!, w = s.walk!;
  const done = (r: GuideResult): GuideState => ({ ...s, step: null, stage: 'done', result: r });
  const withFaults = (symptom: 'no-input' | 'output-no-motion', r: GuideResult): GuideState => done({ ...r, ...(path.device && o.deviceFaults ? { deviceFaults: o.deviceFaults(path.device, symptom) } : {}) });
  const unchecked = w.skipped.length ? { unchecked: `Skipped: ${w.skipped.map((k) => path[w.path][k].label).join(', ')}.` } : {};
  if (w.path === 'signal') return path.type === 'input' ? walkStart({ ...s, stage: 'supply' }, 'supply', 'yes', o) : walkStart({ ...s, stage: 'ret' }, 'ret', 'no', o);
  if (w.path === 'supply') {
    if (!w.order.length) return path.type === 'input' ? walkStart({ ...s, stage: 'ret' }, 'ret', 'no', o) : done({ text: `The supply path of ${path.address} is not in the design: check the output's supply and common by hand.`, point: path.address, fix: [] });
    return done({ text: `No supply anywhere on the supply path of ${path.device || path.address}, up to its source: the power supply or its breaker / fuse.`, point: path.address, hop: { path: 'supply', index: w.order[w.order.length - 1] }, ...unchecked,
      fix: ['Check the power supply output and its input breaker / fuse; look for a short that trips it.'] });
  }
  if (path.type === 'input') return withFaults('no-input', { text: `${path.device || 'The device'} has its supply and its return but gives no signal: the device is faulty, mis-adjusted, or does not see its target.`, point: path.address, ...unchecked,
    fix: [`Check ${path.device || 'the device'}: its LED, target distance, alignment and type (PNP / NPN); replace it if it gives no output with its target in front of it.`] });
  return withFaults('output-no-motion', { text: `${path.device || 'The load'} gets its voltage and its return: the load itself does not work (coil, valve, motor, mechanical jam).`, point: path.address, ...unchecked,
    fix: [`Check ${path.device || 'the load'}: coil resistance, the manual override on a valve, the mechanism; replace the coil / device if it is open.`] });
}

/** Edit steps for a logic finding at a given rung (re-exported for the panel). */
export { clickEditSteps };
