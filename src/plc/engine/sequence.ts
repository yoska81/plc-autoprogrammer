/**
 * The automatic cycle as a step sequence: a list of steps, each with the actuator actions it holds ON,
 * what it waits for (sensor ON / OFF, a time) and a timeout. The AI fills it from the specification in a
 * small schema (../ai/cycleAI.ts); without the AI a default sequence is read from the I/O list and the
 * spec's words. `compileSequence` turns it into the "cycle" block of the rule-based program: a step
 * register (0 idle, 10, 20…), one transition rung per step (written last step first, so every step
 * lasts at least one scan), step timers, step timeouts and a cycle counter.
 */
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, Rung, TagDefinition } from '../core/ladder';
import { rungWrites } from '../core/ladder';
import type { HmiContent } from '../../hmi/engine';
import { buildProgram, type ProgramInput, type ProgramResult } from './program';

export type StepWhat = 'run' | 'reverse' | 'extend' | 'retract';
export interface StepAction { actuator: string; what: StepWhat }
/** One condition: an input ON / OFF, or a time in the step. */
export interface StepWait { input?: string; on?: boolean; seconds?: number }
export interface CycleStep {
  name: string;
  /** Request bits held ON during the step. */
  actions: StepAction[];
  /** All must be true to go to the next step; empty = next scan. */
  waitFor: StepWait[];
  /** Fault when the step lasts longer (seconds); null = waits as long as needed (e.g. for the next part). */
  timeoutSec: number | null;
}
export interface CycleSequence { steps: CycleStep[]; questions: string[]; source: 'ai' | 'rules' }

export const STEP_REGISTER = 'DS1150';

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const CMP = (left: string, op: CompareOp, right: string): LadderElement => ({ type: 'CMP', left, op, right });

/** Feedback words (same as the program's timeout logic and the simulator's plant model). */
const EXT_FB = /\b(extended|advanced|down|closed|clamped|out|forward|lowered)\b/i;
const RET_FB = /\b(retracted|returned|up|open(ed)?|unclamped|home|back|raised)\b/i;

/** Default sequence from the I/O list and the spec's words (no AI): feed / wait for a part, then each cylinder out and back, in the order the spec names them. */
export function defaultSequence(c: HmiContent, spec: string): CycleSequence {
  const questions: string[] = [];
  const s = spec.toLowerCase();
  const at = (name: string) => { const i = s.indexOf(name.toLowerCase().split(' ')[0]); return i < 0 ? Infinity : i; };
  const motors = c.actuators.filter((a) => (a.kind === 'motor' || a.kind === 'drive') && a.run);
  const cylinders = c.actuators.filter((a) => a.kind === 'cylinder' && a.extend).sort((a, b) => at(a.name) - at(b.name));
  const run: StepAction[] = motors.map((m) => ({ actuator: m.name, what: 'run' }));
  const steps: CycleStep[] = [];
  if (c.partSensor) steps.push({ name: run.length ? `Feed until a part is at ${c.partSensor.description}` : `Wait for a part at ${c.partSensor.description}`, actions: run, waitFor: [{ input: c.partSensor.address, on: true }], timeoutSec: null });
  else if (run.length && cylinders.length) steps.push({ name: `Run ${motors.map((m) => m.name).join(', ')}`, actions: run, waitFor: [{ seconds: 2 }], timeoutSec: null });
  const dwell = /\b(dwell|seal\w*|press\w*|hold)\b/.exec(s);
  const dwellSec = Number(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/.exec(s.slice(Math.max(0, (dwell?.index ?? 0) - 60), (dwell?.index ?? 0) + 80))?.[1] ?? 2);
  for (const cyl of cylinders) {
    const ext = cyl.feedback.find((f) => EXT_FB.test(f.description));
    const ret = cyl.feedback.find((f) => f !== ext && RET_FB.test(f.description));
    const outWord = /\b(down|close|clamp|lower)/i.exec(cyl.extend!.description)?.[1] ?? 'extend';
    const backWord = cyl.retract ? (/\b(up|open|unclamp|raise)/i.exec(cyl.retract.description)?.[1] ?? 'retract') : 'retract';
    steps.push({ name: `${cyl.name} ${outWord}${ext ? ` until ${ext.description}` : ''}`, actions: [{ actuator: cyl.name, what: 'extend' }], waitFor: [ext ? { input: ext.address, on: true } : { seconds: 1 }], timeoutSec: ext ? 5 : null });
    if (dwell && cylinders.indexOf(cyl) === 0) {
      steps.push({ name: `${dwell[1][0].toUpperCase()}${dwell[1].slice(1)} ${dwellSec} s`, actions: cyl.retract ? [] : [{ actuator: cyl.name, what: 'extend' }], waitFor: [{ seconds: dwellSec }], timeoutSec: null });
      questions.push(`Default cycle: ${dwell[1]} time ${dwellSec} s after ${cyl.name} ${outWord} — confirm.`);
    }
    steps.push({ name: `${cyl.name} ${backWord}${ret ? ` until ${ret.description}` : ''}`, actions: cyl.retract ? [{ actuator: cyl.name, what: 'retract' }] : [], waitFor: [ret ? { input: ret.address, on: true } : { seconds: 1 }], timeoutSec: ret ? 5 : null });
  }
  if (steps.length) questions.unshift(`The automatic cycle was built from the I/O list (${steps.map((x) => x.name).join(' → ')}); describe the cycle in the specification, or edit the steps, if it is different.`);
  return { steps, questions, source: 'rules' };
}

/** Problems with a sequence (unknown actuators / inputs, steps that would loop every scan). */
export function checkSequence(seq: CycleSequence, base: ProgramResult, inputs: Set<string>): string[] {
  const out: string[] = [];
  if (!seq.steps.length && base.autoBits.length) out.push('no steps');
  seq.steps.forEach((st, i) => {
    for (const a of st.actions) if (!base.autoBits.some((b) => b.actuator === a.actuator && b.what === a.what)) out.push(`step ${i + 1}: no request bit for "${a.actuator} ${a.what}"`);
    for (const w of st.waitFor) {
      if (w.input && !inputs.has(w.input.toUpperCase())) out.push(`step ${i + 1}: ${w.input} is not an input`);
      if (!w.input && !(w.seconds && w.seconds > 0)) out.push(`step ${i + 1}: a wait needs an input or a time`);
    }
  });
  if (seq.steps.length && seq.steps.every((s) => !s.waitFor.length)) out.push('no step waits for anything: the cycle would repeat every scan');
  return out;
}

/** The sequence as the program's "cycle" block, merged into the rule-based program. */
export function compileSequence(seq: CycleSequence, base: ProgramResult, opts: { alarm?: string; countReset?: string; stateWord?: string; states?: { value: number; text: string }[] } = {}): { program: LadderProgram; cycleCounter: string } {
  const S = STEP_REGISTER;
  const RUN = 'C2', SAFE = 'C1', RESET = 'C7';
  const p = base.program;
  const used = new Set(p.rungs.flatMap((r) => [...rungWrites(r), ...r.outputs.map((o) => ('address' in o ? o.address : ''))]));
  let t = 1; while (used.has(`T${t}`)) t++;
  let ct = 1; while (used.has(`CT${ct}`)) ct++;
  const timer = () => { while (used.has(`T${t}`)) t++; used.add(`T${t}`); return `T${t++}`; };
  const counter = `CT${ct}`;
  const tags: TagDefinition[] = [{ address: S, nickname: 'Step_Cycle', comment: 'Automatic cycle step (0 idle, 10, 20…)' }, { address: counter, nickname: 'Cnt_Cycles', comment: 'Completed automatic cycles' }];
  const rungs: Rung[] = [];
  let n = 0;
  const R = (comment: string, branches: LadderElement[][], outputs: LadderOutput[]) => rungs.push({ id: `r_cycle_${++n}`, block: 'cycle', comment, branches, outputs });
  const v = (i: number) => String((i + 1) * 10);
  const steps = seq.steps;
  if (steps.length) {
    R('Cycle not running: step 0 (idle)', [[NC(RUN)]], [{ type: 'COPY', source: '0', dest: S }]);
    R(`Cycle start: step 10 — ${steps[0].name}`, [[NO(RUN), CMP(S, '==', '0')]], [{ type: 'COPY', source: '10', dest: S }]);
    // Step timers (timed waits) and step timeouts.
    const delay = new Map<number, string>(), tmo = new Map<number, string>();
    steps.forEach((st, i) => {
      const sec = st.waitFor.find((w) => w.seconds)?.seconds;
      if (sec) { const tm = timer(); delay.set(i, tm); tags.push({ address: tm, nickname: `Tmr_Step_${v(i)}`, comment: `Step ${v(i)} time` }); R(`Step ${v(i)} time: ${sec} s`, [[CMP(S, '==', v(i))]], [{ type: 'TMR', address: tm, mode: 'ON_DELAY', preset: String(sec), unit: 'sec', accumulate: false, resetAddress: null }]); }
      if (st.timeoutSec && opts.alarm) { const tm = timer(); tmo.set(i, tm); tags.push({ address: tm, nickname: `Tmr_Step_${v(i)}_Tmo`, comment: `Step ${v(i)} timeout` }); R(`Step ${v(i)} timeout: ${st.timeoutSec} s`, [[CMP(S, '==', v(i))]], [{ type: 'TMR', address: tm, mode: 'ON_DELAY', preset: String(st.timeoutSec), unit: 'sec', accumulate: false, resetAddress: null }]); }
    });
    if (!tmo.size && opts.alarm) R('No step has a timeout: the step-timeout alarm stays off', [[NC('SC1')]], [{ type: 'SET', address: opts.alarm }]);
    if (!tmo.size && opts.alarm) R('Step timeout reset: Reset while the cycle is stopped', [[NO(RESET), NC(RUN)]], [{ type: 'RST', address: opts.alarm }]);
    if (tmo.size && opts.alarm) {
      R('A cycle step did not finish in time: latched (stops the cycle)', [...tmo.values()].map((tm) => [NO(tm)]), [{ type: 'SET', address: opts.alarm }]);
      R('Step timeout reset: Reset while the cycle is stopped', [[NO(RESET), NC(RUN)]], [{ type: 'RST', address: opts.alarm }]);
    }
    // Transitions, last step first: a step entered this scan is checked on the next one.
    for (let i = steps.length - 1; i >= 0; i--) {
      const st = steps[i];
      const conds = st.waitFor.flatMap((w) => (w.input ? [w.on === false ? NC(w.input) : NO(w.input)] : w.seconds ? [NO(delay.get(i)!)] : []));
      const last = i === steps.length - 1;
      R(`Step ${v(i)} — ${st.name}: done ${st.waitFor.length ? `when ${st.waitFor.map((w) => (w.input ? `${w.input} ${w.on === false ? 'OFF' : 'ON'}` : `${w.seconds} s`)).join(' and ')}` : 'at once'} → ${last ? 'cycle complete, back to step 10' : `step ${v(i + 1)}`}`,
        [[NO(RUN), NO(SAFE), CMP(S, '==', v(i)), ...conds]],
        [{ type: 'COPY', source: last ? '10' : v(i + 1), dest: S }, ...(last ? [{ type: 'CNT', address: counter, direction: 'UP', preset: '32767', resetAddress: opts.countReset ?? 'C98' } as LadderOutput] : [])]);
    }
  }
  // Request bits: ON in the steps that list them (one OUT each).
  for (const b of base.autoBits) {
    const inSteps = steps.map((st, i) => (st.actions.some((a) => a.actuator === b.actuator && a.what === b.what) ? i : -1)).filter((i) => i >= 0);
    R(inSteps.length ? `${b.actuator} ${b.what}: in step${inSteps.length > 1 ? 's' : ''} ${inSteps.map(v).join(', ')}` : `${b.actuator} ${b.what}: not used by the automatic cycle`,
      inSteps.length ? inSteps.map((i) => [CMP(S, '==', v(i))]) : [[NC('SC1')]], [{ type: 'OUT', address: b.bit }]);
  }
  // Step states of the machine-state word (the status block writes Running before and Manual / Faulted / Safety after).
  const stateRungs: Rung[] = [];
  if (opts.stateWord) for (const s of opts.states ?? []) {
    if (/^(running|stopped|idle|manual|fault|safety)/i.test(s.text)) continue;
    const key = s.text.toLowerCase().split(/\s+/)[0].replace(/ing$/, '');
    const i = steps.findIndex((st) => st.name.toLowerCase().includes(key));
    if (i >= 0) stateRungs.push({ id: `r_state_step_${s.value}`, block: 'status', comment: `Machine state ${s.value} ${s.text}: step ${v(i)}`, branches: [[NO(RUN), CMP(S, '==', v(i))]], outputs: [{ type: 'COPY', source: String(s.value), dest: opts.stateWord }] });
  }
  // Put the block in place of the rules' default cycle; step timeouts count as a fault.
  const others = p.rungs.filter((r) => r.block !== 'cycle').map((r) => (opts.alarm && /^Any fault/.test(r.comment) ? { ...r, branches: [...r.branches.filter((b) => !(b.length === 1 && b[0].type === 'NC' && (b[0] as { address: string }).address === 'SC1')), [NO(opts.alarm)]] } : r));
  const first = p.rungs.findIndex((r) => r.block === 'cycle');
  const at = first < 0 ? others.length : first;
  const merged = [...others.slice(0, at), ...rungs, ...others.slice(at)];
  const runIdx = merged.findIndex((r) => /^Machine state \d+ Running/.test(r.comment));
  if (runIdx >= 0) merged.splice(runIdx + 1, 0, ...stateRungs);
  return {
    program: { ...p, rungs: merged, tags: [...p.tags, ...tags.filter((x) => !p.tags.some((y) => y.address === x.address))], sequence: seq },
    cycleCounter: counter,
  };
}

/** Rows of the step table on the Program page. */
export function sequenceTable(seq: CycleSequence): { step: string; does: string; waits: string; timeout: string }[] {
  return seq.steps.map((st, i) => ({
    step: String((i + 1) * 10),
    does: st.actions.length ? st.actions.map((a) => `${a.actuator} ${a.what}`).join(', ') : '—',
    waits: st.waitFor.length ? st.waitFor.map((w) => (w.input ? `${w.input} ${w.on === false ? 'OFF' : 'ON'}` : `${w.seconds} s`)).join(' and ') : 'nothing',
    timeout: st.timeoutSec ? `${st.timeoutSec} s` : '—',
  }));
}

/**
 * The whole rule-based program: the standard blocks plus the cycle compiled from `sequence` (the AI's) or
 * the default sequence read from the I/O list and the spec.
 */
export function programWithCycle(input: ProgramInput & { spec: string; sequence?: CycleSequence }): { program: LadderProgram; sequence: CycleSequence; cycleCounter: string; notes: string[]; base: ProgramResult } {
  const base = buildProgram(input);
  const role = (r: string) => (input.hmiTags?.find((t) => t.role === r) ?? undefined)?.address;
  const sequence = input.sequence ?? defaultSequence(input.content, input.spec);
  const alarm = role('alarm:step') ?? base.roles.get('alarm:step');
  const { program, cycleCounter } = compileSequence(sequence, base, {
    alarm, countReset: role('cmd:countreset') ?? base.roles.get('cmd:countreset'), stateWord: role('word:state') ?? base.roles.get('word:state'), states: input.content.states,
  });
  const notes = base.notes.filter((n) => !/automatic sequence .* not written yet/i.test(n) || !sequence.steps.length);
  return { program, sequence, cycleCounter, notes: [...notes, ...sequence.questions], base };
}
