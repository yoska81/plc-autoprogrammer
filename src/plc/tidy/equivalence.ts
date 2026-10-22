/**
 * Same behaviour? The original and the reorganized program run side by side in the simulator on the same input
 * sequences, and everything the machine or another device can see is compared scan by scan: the outputs, what the
 * HMI or another device reads, and every timer's and counter's done bit and value.
 *  - every input toggled on its own, with time to let every timer run out;
 *  - seeded random sequences (several inputs at once, random time steps, power cycles);
 *  - extra sequences given by the caller (the machine model's cycle).
 * The inputs are what the program reads but never writes (X terminals, HMI commands and setpoints).
 */
import { createSimulator, isBitAddress, isWordAddress, type SimOptions, type Simulator } from '../sim/engine';
import { rungWrites, type LadderProgram } from '../core/ladder';
import { rungDeps } from './deps';
import { buildMachineModel, machineInputs, stepMachine, type MachineModel, type SimIOPoint } from '../sim/machineModel';

export interface Difference { sequence: string; scan: number; timeMs: number; address: string; original: boolean | number; reorganized: boolean | number }

export interface EquivalenceResult {
  /** Input sequences run and scans compared. */
  sequences: number;
  /** Of them: each input on its own, random, given by the caller, closed loop with the machine. */
  kinds: { inputs: number; random: number; given: number; machine: number };
  scans: number;
  /** Addresses compared every scan. */
  observed: number;
  /** The first differences found (empty: same behaviour). */
  differences: Difference[];
  /** Rungs neither run can simulate (kept instructions of another PLC): they are compared only by being unchanged. */
  notSimulated: number;
  /** The time budget ran out before every sequence ran. */
  stoppedEarly: boolean;
  /** Compared values that never changed during the check (not exercised: a difference there would not show). */
  unexercised: string[];
}

export interface EquivalenceOptions {
  /** Addresses compared besides the outputs, timers and counters (what the HMI or another device reads). */
  observe?: string[];
  /** Inputs besides what the program reads and never writes. */
  inputs?: string[];
  /** Random sequences (default 200) and their length in steps (default 60). */
  random?: number;
  steps?: number;
  seed?: number;
  scanMs?: number;
  /** Stop after this long (ms of real time; default 20 s) and say so. */
  budgetMs?: number;
  /** Extra sequences: each step sets inputs, then runs dtMs. */
  sequences?: { name: string; steps: { set?: Record<string, boolean | number>; dtMs: number }[] }[];
  sim?: SimOptions;
  /**
   * The I/O list for the plant model: closed-loop sequences where the machine answers the outputs (cylinders reach
   * their sensors, conveyors carry parts) while seeded random operator actions press buttons, turn selectors,
   * sometimes an E-stop or a stuck sensor, and HMI commands. Default 60 sequences of 80 steps.
   */
  plant?: SimIOPoint[];
  plantSequences?: number;
  /** Stop at this many differences (default 5). */
  maxDifferences?: number;
  /** Called as each sequence starts: how many have run, of how many. */
  onProgress?: (done: number, total: number) => void;
}

/** Small seeded generator (mulberry32): the same sequences every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SYSTEM = /^(SC|SD)\d+$/;

/** What the program reads but never writes: its inputs. */
export function programInputs(p: LadderProgram): string[] {
  const reads = new Set<string>(), writes = new Set<string>();
  // What the rungs really write (rungDeps counts every operand as written, for the order).
  for (const r of p.rungs) {
    rungDeps(r).reads.forEach((a) => reads.add(a));
    for (const w of rungWrites(r)) {
      const a = w.trim().toUpperCase();
      writes.add(a);
      const t = /^(T|CT)(\d+)$/.exec(a);
      if (t) writes.add(`${t[1] === 'T' ? 'TD' : 'CTD'}${t[2]}`);
    }
  }
  return [...reads].filter((a) => !writes.has(a) && !SYSTEM.test(a) && /^[A-Z]+\d+$/.test(a)).sort();
}

/**
 * Everything compared: the outputs of either program, the timers and counters (done bit and value) both still run,
 * and what the caller adds (what the HMI or another device reads). A timer or counter only the original has was
 * removed as dead code: nothing outside the PLC reads it, or it would be among the caller's addresses.
 */
function observedOf(a: LadderProgram, b: LadderProgram, extra: string[]): string[] {
  const out = new Set<string>(extra.map((x) => x.trim().toUpperCase()));
  const written = (p: LadderProgram) => new Set(p.rungs.flatMap((r) => [...rungDeps(r).writes]));
  const wa = written(a), wb = written(b);
  for (const w of new Set([...wa, ...wb])) {
    if (/^Y\d+$/.test(w) || (/^(T|TD|CT|CTD)\d+$/.test(w) && wa.has(w) && wb.has(w))) out.add(w);
  }
  return [...out].sort();
}

/** Constants a word input is compared with (and one either side): the values worth trying. */
function interestingValues(p: LadderProgram, address: string): number[] {
  const vals = new Set<number>([0, 1]);
  for (const r of p.rungs) for (const b of r.branches) for (const el of b) {
    if (el.type !== 'CMP') continue;
    const other = el.left.trim().toUpperCase() === address ? el.right : el.right.trim().toUpperCase() === address ? el.left : null;
    const n = other !== null ? Number(other) : NaN;
    if (Number.isFinite(n)) [n - 1, n, n + 1].forEach((v) => vals.add(v));
  }
  return [...vals];
}

/** The longest timer preset written as a constant (ms), so a toggle waits for every timer to run out. */
function longestTimer(p: LadderProgram): number {
  const unit: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
  let max = 1000;
  for (const r of p.rungs) for (const o of r.outputs) if (o.type === 'TMR') { const n = Number(o.preset); if (Number.isFinite(n)) max = Math.max(max, n * (unit[o.unit] ?? 1000)); }
  return Math.min(max, 24 * 3_600_000);
}

export function checkEquivalence(original: LadderProgram, reorganized: LadderProgram, o: EquivalenceOptions = {}): EquivalenceResult {
  const scanMs = o.scanMs ?? 10;
  const maxDiff = o.maxDifferences ?? 5;
  const started = Date.now();
  const budget = o.budgetMs ?? 20_000;
  const inputs = [...new Set([...programInputs(original), ...programInputs(reorganized), ...(o.inputs ?? []).map((x) => x.trim().toUpperCase())])];
  const observed = observedOf(original, reorganized, o.observe ?? []);
  const observedBit = observed.map(isBitAddress);
  const notSimulated = reorganized.rungs.filter((r) => rungDeps(r).barrier).length;
  const differences: Difference[] = [];
  let sequences = 0, scans = 0, stoppedEarly = false;
  // The first value seen of each compared address, and the ones that took another value at least once.
  const first = new Map<string, boolean | number>(), changed = new Set<string>();
  const longest = longestTimer(original);

  const total = inputs.length + (o.random ?? 200) + (o.sequences?.length ?? 0) + (o.plant?.length ? o.plantSequences ?? 60 : 0);
  let begun = 0;
  const run = (name: string, drive: (step: (set: Record<string, boolean | number>, dtMs: number) => boolean, reset: () => void, models: [MachineModel, MachineModel] | null) => void, withPlant = false) => {
    if (differences.length >= maxDiff) return;
    if (Date.now() - started > budget) { stoppedEarly = true; return; }
    o.onProgress?.(begun++, total);
    const a = createSimulator(original, { ...o.sim, lean: true }), b = createSimulator(reorganized, { ...o.sim, lean: true });
    // The machine, one per program (the same devices in the same state while the programs agree).
    const models: [MachineModel, MachineModel] | null = withPlant && o.plant ? [buildMachineModel(o.plant, []), buildMachineModel(o.plant, [])] : null;
    if (models) { for (const [k, v] of machineInputs(models[0])) a.setInput(k, v); for (const [k, v] of machineInputs(models[1])) b.setInput(k, v); }
    let scan = 0;
    const compare = (x: Simulator, y: Simulator): boolean => {
      for (let k = 0; k < observed.length; k++) {
        const addr = observed[k];
        // Straight from memory (what read() returns for a bit or a register).
        const va = observedBit[k] ? x.state.bits.get(addr) ?? false : x.state.words.get(addr) ?? 0;
        const vb = observedBit[k] ? y.state.bits.get(addr) ?? false : y.state.words.get(addr) ?? 0;
        if (va !== (first.get(addr) ?? va)) changed.add(addr); else if (!first.has(addr)) first.set(addr, va);
        if (va !== vb && !(typeof va === 'number' && typeof vb === 'number' && Math.abs(va - vb) < 1e-9)) {
          differences.push({ sequence: name, scan, timeMs: x.state.timeMs, address: addr, original: va, reorganized: vb });
          return false;
        }
      }
      return true;
    };
    const step = (set: Record<string, boolean | number>, dtMs: number): boolean => {
      for (const [k, v] of Object.entries(set)) { a.write(k, v); b.write(k, v); }
      // Long waits in bigger scans (a timer's 10 min is not 60 000 scans); each scan compared.
      let left = Math.max(scanMs, dtMs);
      while (left > 0) {
        const dt = left > 20 * scanMs ? Math.max(scanMs, Math.floor(left / 10)) : scanMs;
        if (models) {
          for (const [k, v] of stepMachine(models[0], a.outputs(), dt, (x) => a.readWord(x))) a.setInput(k, v);
          for (const [k, v] of stepMachine(models[1], b.outputs(), dt, (x) => b.readWord(x))) b.setInput(k, v);
        }
        a.step(dt); b.step(dt); scan++; scans++; left -= dt;
        if (!compare(a, b)) return false;
      }
      return true;
    };
    const reset = () => { a.reset(); b.reset(); };
    sequences++;
    drive(step, reset, models);
  };

  // The sequences of each kind in a queue. Each input on its own first (short, and every input changes at least
  // once), then the others in turn (one of each kind, again): a check that stops at its time limit has run some of
  // every kind, not only the first.
  const queues: (() => void)[][] = [[], [], [], []];
  const ran = [0, 0, 0, 0];
  const queue = (k: number, ...args: Parameters<typeof run>) => { queues[k].push(() => { const n = sequences; run(...args); ran[k] += sequences - n; }); };

  // Every input on its own: on (long enough for every timer), off; a word through the values it is compared with.
  for (const i of inputs) {
    queue(0, `${i} on its own`, (step) => {
      if (isWordAddress(i)) { for (const v of interestingValues(original, i)) if (!step({ [i]: v }, longest + scanMs)) return; step({ [i]: 0 }, scanMs); return; }
      if (step({ [i]: true }, scanMs) && step({}, longest + scanMs) && step({ [i]: false }, scanMs)) step({}, longest + scanMs);
    });
  }
  // Seeded random sequences: a few inputs change at once, random time steps, sometimes a power cycle.
  const rand = rng(o.seed ?? 1);
  const words = new Map(inputs.filter(isWordAddress).map((i) => [i, interestingValues(original, i)] as const));
  for (let s = 0; s < (o.random ?? 200); s++) {
    queue(1, `random sequence ${s + 1}`, (step, reset) => {
      for (let k = 0; k < (o.steps ?? 60); k++) {
        const set: Record<string, boolean | number> = {};
        for (let c = 0; c < 1 + Math.floor(rand() * 3) && inputs.length; c++) {
          const i = inputs[Math.floor(rand() * inputs.length)];
          const w = words.get(i);
          set[i] = w ? w[Math.floor(rand() * w.length)] : rand() < 0.5;
        }
        if (rand() < 0.01) reset();
        const dt = rand() < 0.1 ? Math.floor(rand() * Math.min(longest, 60_000)) : scanMs * (1 + Math.floor(rand() * 5));
        if (!step(set, dt)) return;
      }
      // Held long enough for every timer (run-hours timers included) to run out in the state reached.
      step({}, longest + scanMs);
    });
  }
  for (const q of o.sequences ?? []) queue(2, q.name, (step) => { for (const st of q.steps) if (!step(st.set ?? {}, st.dtMs)) return; });
  // Closed loop with the machine: operator actions on the devices (the same in both machines), HMI commands, now and
  // then an E-stop or a sensor that sticks; the machine answers the outputs.
  if (o.plant?.length) {
    const prand = rng((o.seed ?? 1) + 7919);
    const modelInputs = new Set(machineInputs(buildMachineModel(o.plant, [])).keys());
    const commands = inputs.filter((i) => !modelInputs.has(i));
    for (let s = 0; s < (o.plantSequences ?? 60); s++) {
      queue(3, `machine sequence ${s + 1}`, (step, _reset, models) => {
        if (!models) return;
        const act = () => {
          const kinds = models[0].devices.map((d, i) => ({ d, i })).filter(({ d }) => d.kind === 'pushbutton' || d.kind === 'selector' || d.kind === 'estop' || d.kind === 'sensor');
          const pick = kinds[Math.floor(prand() * kinds.length)];
          if (!pick) return;
          const rare = prand();
          for (const m of models) {
            const d = m.devices[pick.i];
            if (d.kind === 'pushbutton') d.state.pressed = !d.state.pressed;
            else if (d.kind === 'selector') d.state.on = !d.state.on;
            else if (d.kind === 'estop' && rare < 0.15) d.state.pressed = !d.state.pressed;
            else if (d.kind === 'sensor' && rare < 0.1) d.bypass = d.bypass?.on ? undefined : { on: true, value: rare < 0.05 };
          }
        };
        for (let k = 0; k < 80; k++) {
          const set: Record<string, boolean | number> = {};
          if (prand() < 0.6) act();
          if (commands.length && prand() < 0.4) {
            const i = commands[Math.floor(prand() * commands.length)];
            const w = words.get(i);
            set[i] = w ? w[Math.floor(prand() * w.length)] : prand() < 0.5;
          }
          if (!step(set, prand() < 0.15 ? Math.floor(prand() * Math.min(longest, 30_000)) : scanMs * (5 + Math.floor(prand() * 50)))) return;
        }
        step({}, longest + scanMs);
      }, true);
    }
  }

  queues[0].forEach((f) => f());
  for (let k = 0; queues.some((q) => k < q.length); k++) for (const q of queues.slice(1)) q[k]?.();

  return { sequences, kinds: { inputs: ran[0], random: ran[1], given: ran[2], machine: ran[3] }, scans, observed: observed.length, differences, notSimulated, stoppedEarly, unexercised: observed.filter((a) => !changed.has(a)) };
}

/**
 * One line for the user: "Same behaviour in 412 test sequences (0 differences)" or the first differences. Testing
 * shows sameness only over what was tested: what was not simulated is listed, never "identical" or "proven".
 */
function kindsText(r: EquivalenceResult): string {
  const k = r.kinds;
  return [k.inputs && `${k.inputs} with one input changed`, k.random && `${k.random} random`, k.given && `${k.given} given`, k.machine && `${k.machine} with the machine model answering`].filter(Boolean).join(', ');
}

export function equivalenceSummary(r: EquivalenceResult): string {
  const said = r.differences.length
    ? `Different behaviour: ${r.differences.map((d) => `${d.address} is ${d.original} in the original but ${d.reorganized} in the reorganized program (${d.sequence}, scan ${d.scan})`).join('; ')}.`
    : `Same behaviour in ${r.sequences.toLocaleString('en-US')} test sequences (0 differences). Details: ${kindsText(r)}; ${r.scans.toLocaleString('en-US')} scans, ${r.observed.toLocaleString('en-US')} values compared every scan.`;
  return [said, r.notSimulated ? `Not simulated: ${r.notSimulated} ${r.notSimulated === 1 ? 'rung' : 'rungs'} with instructions kept from the old PLC (left exactly as they were, in place); motion / axis registers and communications are not simulated either.` : 'Not simulated: motion / axis registers and communications.', r.stoppedEarly ? 'The check stopped at its time limit before every sequence ran.' : '', !r.differences.length && r.unexercised.length ? `Never changed during the check, so a difference there would not show: ${r.unexercised.slice(0, 8).join(', ')}${r.unexercised.length > 8 ? ` and ${r.unexercised.length - 8} more` : ''}.` : ''].filter(Boolean).join(' ');
}
