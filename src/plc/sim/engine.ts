/**
 * Deterministic CLICK-style PLC scan engine (no React, no timers).
 *
 * One call to `step(dt)` is one PLC scan:
 *   1. advance the clock and update system bits (SC1 / SC2 / SC7),
 *   2. copy the field inputs into the X input image and apply forces,
 *   3. solve every rung top to bottom; internal bits written by a rung are seen
 *      by the rungs below it in the same scan (CLICK immediate memory),
 *   4. re-apply forces; the Y image is then what the outputs show.
 *
 * Forces (and block "holds", which use the same mechanism) win everywhere: a
 * forced bit/word reads its forced value for the whole scan and program
 * writes to it are ignored. Bypassed rungs are not executed at all, so their
 * outputs hold their last value.
 *
 * Everything is in plain Maps so a UI, a test or an HMI can read it directly.
 */
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, Rung, TimeUnit } from '../core/ladder';
import type { SimSemantics } from '../core/profile';
import { CLICK_SIM, clickRetentive } from '../core/profiles/click';

export interface TimerState {
  /** Elapsed time in ms (internal resolution, TD shows it in the timer's unit). */
  accMs: number;
  /** Setpoint in ms, resolved on the last scan. */
  presetMs: number;
  done: boolean;
  mode: 'ON_DELAY' | 'OFF_DELAY';
  unit: TimeUnit;
}

export interface CounterState {
  value: number;
  preset: number;
  done: boolean;
  direction: 'UP' | 'DOWN';
}

export interface SimState {
  /** Bit memory: X, Y, C, T, CT, SC. */
  bits: Map<string, boolean>;
  /** Word memory: DS, DD, DF, DH, TD, CTD, SD. */
  words: Map<string, number>;
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;
  /** Field input values (what the wiring presents to the X terminals). */
  inputs: Map<string, boolean>;
  /** Forced bits: read as this value all scan; program writes are ignored. */
  forces: Map<string, boolean>;
  /** Forced words (DS, DD, DF ...). */
  wordForces: Map<string, number>;
  /** Rung ids that are not executed (outputs hold their last value). */
  bypassedRungs: Set<string>;
  scanCount: number;
  timeMs: number;
  /** Runtime problems (bad MATH formula ...), unique messages. */
  errors: string[];
}

export interface RungPower {
  /** Per element: power reaches the right side of this element. */
  branches: boolean[][];
  /** Per element: the contact itself is closed / the compare is true. */
  closed: boolean[][];
  rungTrue: boolean;
  /** Rung was skipped this scan (bypassed); the rest is the last executed state. */
  bypassed?: boolean;
}

export interface BitChange {
  address: string;
  value: boolean;
  timeMs: number;
}

export interface Simulator {
  readonly state: SimState;
  readonly program: LadderProgram;
  /** Set a field input (X). Takes effect on the next scan's input read. */
  setInput(address: string, value: boolean): void;
  /** Force a bit ON/OFF or a word to a number; null removes the force. */
  force(address: string, value: boolean | number | null): void;
  /** Remove every bit and word force. */
  clearForces(): void;
  /** Skip (true) or execute (false) a rung. */
  bypassRung(rungId: string, bypassed: boolean): void;
  readBit(address: string): boolean;
  readWord(address: string): number;
  /** Bit or word, depending on the address. Constants return their number. */
  read(address: string): boolean | number;
  /** Write memory directly (C bits from an HMI, DS registers ...). X goes to the input. */
  write(address: string, value: boolean | number): void;
  /** One scan. Returns the bits that changed (X/Y/C/T/CT). */
  step(dtMs?: number): BitChange[];
  /** Run scans for `ms` of simulated time. */
  run(ms: number, scanMs?: number): BitChange[];
  /**
   * Power-cycle: clear memory, inputs and the clock. Retentive memory (see
   * SimOptions.retentive) keeps its value unless `clearRetentive` is set.
   * Forces and rung bypasses are kept.
   */
  reset(opts?: { clearRetentive?: boolean }): void;
  /** Power flow of the last scan, per rung id. */
  rungPower(): Map<string, RungPower>;
  /** Current Y output image. */
  outputs(): Map<string, boolean>;
}

const UNIT_MS: Record<TimeUnit, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };
const TD_MAX = 32767;
const NUMBER_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
const WORD_RE = /^(CTD|TXT|DS|DD|DH|DF|TD|SD)\d+$/;
const BIT_RE = /^(X|Y|CT|C|T|SC)\d+$/;

export function normAddress(a: string): string {
  return a.trim().toUpperCase();
}

export function isConstant(a: string): boolean {
  return NUMBER_RE.test(a.trim());
}

export function isWordAddress(a: string): boolean {
  return WORD_RE.test(normAddress(a));
}

export function isBitAddress(a: string): boolean {
  return BIT_RE.test(normAddress(a));
}

export function unitMs(u: TimeUnit): number {
  return UNIT_MS[u] ?? 1000;
}

/** Store a number the way the register type holds it. */
function coerceWord(address: string, v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (address.startsWith('DF')) return v;
  const i = Math.trunc(v);
  if (address.startsWith('DS') || address.startsWith('TD') || address.startsWith('CTD')) {
    return ((((i + 32768) % 65536) + 65536) % 65536) - 32768;
  }
  if (address.startsWith('DH')) return ((i % 65536) + 65536) % 65536;
  return i | 0; // DD and others: 32-bit
}

// ---------------------------------------------------------------- MATH parser

type Expr = (read: (address: string) => number) => number;

/** Tiny recursive-descent parser: numbers, register addresses, + - * / MOD %, parentheses, unary minus. */
export function compileMath(src: string): Expr {
  const tokens = src.match(/\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z]+\d*|[()+\-*/%]|\S/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const fail = (msg: string): never => { throw new Error(`MATH "${src}": ${msg}`); };

  function primary(): Expr {
    const t = next();
    if (t === undefined) return fail('unexpected end');
    if (t === '(') {
      const e = expr();
      if (next() !== ')') fail('missing )');
      return e;
    }
    if (/^(\d|\.\d)/.test(t)) { const n = Number(t); return () => n; }
    const a = t.toUpperCase();
    if (/^[A-Z]+\d+$/.test(a)) return (read) => read(a);
    return fail(`unexpected "${t}"`);
  }
  function unary(): Expr {
    if (peek() === '-') { next(); const e = unary(); return (r) => -e(r); }
    if (peek() === '+') { next(); return unary(); }
    return primary();
  }
  function term(): Expr {
    let left = unary();
    for (;;) {
      const t = peek()?.toUpperCase();
      if (t !== '*' && t !== '/' && t !== '%' && t !== 'MOD') return left;
      next();
      const l = left, r = unary();
      if (t === '*') left = (rd) => l(rd) * r(rd);
      else if (t === '/') left = (rd) => { const d = r(rd); return d === 0 ? 0 : l(rd) / d; };
      else left = (rd) => { const d = r(rd); return d === 0 ? 0 : l(rd) % d; };
    }
  }
  function expr(): Expr {
    let left = term();
    for (;;) {
      const t = peek();
      if (t !== '+' && t !== '-') return left;
      next();
      const l = left, r = term();
      left = t === '+' ? (rd) => l(rd) + r(rd) : (rd) => l(rd) - r(rd);
    }
  }
  if (!tokens.length) fail('empty formula');
  const e = expr();
  if (pos < tokens.length) fail(`unexpected "${tokens[pos]}"`);
  return e;
}

function compare(l: number, op: CompareOp, r: number): boolean {
  switch (op) {
    case '==': return l === r;
    case '<>': return l !== r;
    case '>': return l > r;
    case '>=': return l >= r;
    case '<': return l < r;
    case '<=': return l <= r;
  }
}

// ---------------------------------------------------------------- simulator

function emptyState(): SimState {
  return {
    bits: new Map(), words: new Map(), timers: new Map(), counters: new Map(),
    inputs: new Map(), forces: new Map(), wordForces: new Map(), bypassedRungs: new Set(),
    scanCount: 0, timeMs: 0, errors: [],
  };
}

export interface SimOptions {
  /** Memory that survives a power cycle. Default: the scan semantics' rule (CLICK: DS, DD, DH, DF registers and counters CT / CTD). */
  retentive?: (address: string) => boolean;
  /** System bits and retentive defaults of the target PLC (default CLICK). */
  semantics?: SimSemantics;
}

export { clickRetentive };

export function createSimulator(program: LadderProgram, options: SimOptions = {}): Simulator {
  const sem = options.semantics ?? CLICK_SIM;
  const retentive = options.retentive ?? sem.retentive;
  const state = emptyState();
  /** Previous value per edge contact instance / counter instance. */
  let edges = new Map<string, boolean>();
  let power = new Map<string, RungPower>();
  const mathCache = new Map<string, Expr | Error>();

  const readBit = (raw: string): boolean => state.bits.get(normAddress(raw)) ?? false;
  const readWord = (raw: string): number => {
    const a = normAddress(raw);
    if (isConstant(a)) return Number(a);
    if (isBitAddress(a)) return readBit(a) ? 1 : 0;
    return state.words.get(a) ?? 0;
  };
  /** Program/HMI bit write; forced bits keep their forced value. */
  const setBit = (a: string, v: boolean) => { if (!state.forces.has(a)) state.bits.set(a, v); };
  const setWord = (a: string, v: number) => { if (!state.wordForces.has(a)) state.words.set(a, v); };
  const writeWord = (raw: string, v: number) => {
    const a = normAddress(raw);
    if (isBitAddress(a)) setBit(a, v !== 0);
    else setWord(a, coerceWord(a, v));
  };
  const addError = (msg: string) => { if (!state.errors.includes(msg)) state.errors.push(msg); };

  function evalElement(el: LadderElement, key: string): boolean {
    if (el.type === 'CMP') return compare(readWord(el.left), el.op, readWord(el.right));
    // An imported instruction the simulator doesn't know: open, so nothing behind it switches on.
    if (el.type === 'RAW') { addError(`Imported instruction not simulated: ${el.text} is taken as an open contact, so nothing after it in the rung turns on`); return false; }
    const v = readBit(el.address);
    switch (el.type) {
      case 'NO': return v;
      case 'NC': return !v;
      case 'RISE': case 'FALL': {
        const prev = edges.get(key) ?? false;
        edges.set(key, v);
        return el.type === 'RISE' ? v && !prev : !v && prev;
      }
    }
  }

  function solveRung(rung: Rung, ri: number): RungPower {
    const branches: boolean[][] = [];
    const closed: boolean[][] = [];
    let rungTrue = rung.branches.length === 0;
    rung.branches.forEach((br, b) => {
      let p = true;
      const pb: boolean[] = [];
      const cb: boolean[] = [];
      br.forEach((el, i) => {
        const c = evalElement(el, `${ri}:${rung.id}:${b}:${i}`); // evaluate all so edges track every scan
        p = p && c;
        cb.push(c);
        pb.push(p);
      });
      branches.push(pb);
      closed.push(cb);
      if (p) rungTrue = true;
    });
    return { branches, closed, rungTrue };
  }

  function execTimer(o: Extract<LadderOutput, { type: 'TMR' }>, on: boolean, dt: number) {
    const a = normAddress(o.address);
    const presetMs = Math.max(0, readWord(o.preset)) * unitMs(o.unit);
    let t = state.timers.get(a);
    if (!t) { t = { accMs: 0, presetMs, done: false, mode: o.mode, unit: o.unit }; state.timers.set(a, t); }
    t.presetMs = presetMs;
    t.mode = o.mode;
    t.unit = o.unit;
    const maxMs = TD_MAX * unitMs(o.unit);
    const resetOn = !!o.resetAddress && readBit(o.resetAddress);
    if (o.mode === 'ON_DELAY') {
      if (resetOn) { t.accMs = 0; t.done = false; }
      else if (on) { t.accMs = Math.min(maxMs, t.accMs + dt); t.done = t.accMs >= presetMs; }
      else if (!o.accumulate) { t.accMs = 0; t.done = false; }
    } else {
      if (on) { t.done = true; t.accMs = 0; }
      else if (t.done) {
        t.accMs = Math.min(maxMs, t.accMs + dt);
        if (t.accMs >= presetMs) { t.done = false; t.accMs = 0; }
      }
      if (resetOn && !on) { t.done = false; t.accMs = 0; }
    }
    setBit(a, t.done);
    setWord(`TD${a.slice(1)}`, Math.floor(t.accMs / unitMs(o.unit)));
  }

  function execCounter(o: Extract<LadderOutput, { type: 'CNT' }>, on: boolean, key: string) {
    const a = normAddress(o.address);
    const preset = readWord(o.preset);
    let c = state.counters.get(a);
    if (!c) {
      c = { value: o.direction === 'DOWN' ? preset : 0, preset, done: false, direction: o.direction };
      state.counters.set(a, c);
    }
    c.preset = preset;
    c.direction = o.direction;
    const prev = edges.get(key) ?? false;
    edges.set(key, on);
    if (o.resetAddress && readBit(o.resetAddress)) {
      c.value = o.direction === 'DOWN' ? preset : 0;
    } else if (on && !prev) {
      c.value += o.direction === 'DOWN' ? -1 : 1;
      c.value = Math.max(-2147483648, Math.min(2147483647, c.value));
    }
    c.done = o.direction === 'DOWN' ? c.value <= 0 : c.value >= preset;
    setBit(a, c.done);
    setWord(`CTD${a.slice(2)}`, c.value);
  }

  function execOutputs(rung: Rung, ri: number, on: boolean, dt: number) {
    rung.outputs.forEach((o, k) => {
      switch (o.type) {
        case 'OUT': setBit(normAddress(o.address), on); break;
        case 'SET': if (on) setBit(normAddress(o.address), true); break;
        case 'RST': if (on) setBit(normAddress(o.address), false); break;
        case 'TMR': execTimer(o, on, dt); break;
        case 'CNT': execCounter(o, on, `cnt:${ri}:${rung.id}:${k}`); break;
        case 'COPY': if (on) writeWord(o.dest, readWord(o.source)); break;
        case 'MATH': {
          if (!on) break;
          let f = mathCache.get(o.expression);
          if (!f) {
            try { f = compileMath(o.expression); } catch (e) { f = e instanceof Error ? e : new Error(String(e)); }
            mathCache.set(o.expression, f);
          }
          if (f instanceof Error) { addError(f.message); break; }
          writeWord(o.dest, f(readWord));
          break;
        }
        case 'RAW': if (on) addError(`Imported instruction not simulated: ${o.text} does nothing here`); break;
      }
    });
  }

  function applyForces() {
    for (const [a, v] of state.forces) state.bits.set(a, v);
    for (const [a, v] of state.wordForces) state.words.set(a, v);
  }

  function step(dtMs = 10): BitChange[] {
    const before = new Map(state.bits);
    state.timeMs += dtMs;
    // system bits
    if (sem.alwaysOn) state.bits.set(sem.alwaysOn, true);
    if (sem.firstScan) state.bits.set(sem.firstScan, state.scanCount === 0);
    if (sem.clock1s) state.bits.set(sem.clock1s, Math.floor(state.timeMs / 500) % 2 === 1);
    // input image
    for (const [a, v] of state.inputs) state.bits.set(a, v);
    applyForces();
    // logic
    const next = new Map<string, RungPower>();
    program.rungs.forEach((rung, ri) => {
      if (state.bypassedRungs.has(rung.id)) {
        const last = power.get(rung.id);
        next.set(rung.id, { branches: last?.branches ?? [], closed: last?.closed ?? [], rungTrue: last?.rungTrue ?? false, bypassed: true });
        return;
      }
      const p = solveRung(rung, ri);
      next.set(rung.id, p);
      execOutputs(rung, ri, p.rungTrue, dtMs);
    });
    power = next;
    applyForces();
    state.scanCount++;

    const changes: BitChange[] = [];
    for (const [a, v] of state.bits) {
      if (a.startsWith('SC')) continue;
      if ((before.get(a) ?? false) !== v) changes.push({ address: a, value: v, timeMs: state.timeMs });
    }
    return changes;
  }

  return {
    state,
    program,
    setInput(address, value) { state.inputs.set(normAddress(address), value); },
    force(address, value) {
      const a = normAddress(address);
      if (value === null) {
        state.forces.delete(a); state.wordForces.delete(a);
        if (a.startsWith('X')) state.bits.set(a, state.inputs.get(a) ?? false); // back to the field value
        return;
      }
      if (isBitAddress(a)) state.forces.set(a, typeof value === 'number' ? value !== 0 : value);
      else state.wordForces.set(a, coerceWord(a, typeof value === 'boolean' ? (value ? 1 : 0) : value));
      // show the forced value right away (also while paused); X stays a field input
      if (isBitAddress(a)) { if (!a.startsWith('X')) state.bits.set(a, state.forces.get(a)!); }
      else state.words.set(a, state.wordForces.get(a)!);
    },
    clearForces() {
      for (const a of state.forces.keys()) if (a.startsWith('X')) state.bits.set(a, state.inputs.get(a) ?? false);
      state.forces.clear(); state.wordForces.clear();
    },
    bypassRung(rungId, bypassed) {
      if (bypassed) state.bypassedRungs.add(rungId);
      else state.bypassedRungs.delete(rungId);
    },
    readBit,
    readWord,
    read(address) {
      const a = normAddress(address);
      return isBitAddress(a) ? readBit(a) : readWord(a);
    },
    write(address, value) {
      const a = normAddress(address);
      if (a.startsWith('X')) { state.inputs.set(a, !!value); return; }
      if (isBitAddress(a)) setBit(a, typeof value === 'number' ? value !== 0 : value);
      else writeWord(a, typeof value === 'boolean' ? (value ? 1 : 0) : value);
    },
    step,
    run(ms, scanMs = 10) {
      const out: BitChange[] = [];
      let left = ms;
      while (left > 1e-9) {
        const dt = Math.min(scanMs, left);
        out.push(...step(dt));
        left -= dt;
      }
      return out;
    },
    reset(opts = {}) {
      const fresh = emptyState();
      if (!opts.clearRetentive) {
        for (const [a, v] of state.words) if (retentive(a)) fresh.words.set(a, v);
        for (const [a, v] of state.bits) if (retentive(a)) fresh.bits.set(a, v);
        for (const [a, c] of state.counters) if (retentive(a)) fresh.counters.set(a, { ...c });
      }
      state.bits = fresh.bits; state.words = fresh.words; state.timers = fresh.timers;
      state.counters = fresh.counters; state.inputs = fresh.inputs;
      // forces and rung bypasses are test settings: they survive a PLC reset
      state.scanCount = 0; state.timeMs = 0; state.errors = [];
      edges = new Map();
      power = new Map();
    },
    rungPower: () => power,
    outputs() {
      const out = new Map<string, boolean>();
      for (const [a, v] of state.bits) if (a.startsWith('Y')) out.set(a, v);
      return out;
    },
  };
}
