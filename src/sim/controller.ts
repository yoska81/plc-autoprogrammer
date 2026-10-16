/**
 * Glue between the scan engine, the machine model and a UI: owns the run loop
 * (requestAnimationFrame, fixed 10 ms simulated scans), the event log and an
 * immutable snapshot for React (`useSyncExternalStore`).
 */
import type { IOWiring } from '../electrical/types';
import type { LadderProgram } from '../plc/ladder';
import { createSimulator, normAddress } from './engine';
import type { CounterState, RungPower, Simulator, TimerState } from './engine';
import { addPart, buildMachineModel, machineInputs, removePart, setDeviceBypass, stepMachine } from './machineModel';
import type { MachineModel, SimDevice, SimIOPoint } from './machineModel';
import { blockOfRung, externalSignals } from './blocks';
import type { ExternalSignal } from './blocks';

export const SCAN_MS = 10;
const MAX_LOG = 400;
/** Max scans per animation frame (keeps the tab responsive at 4x). */
const MAX_SCANS_PER_FRAME = 60;

/** Live access for HMI screens and other viewers. */
export interface SimHandle {
  read(address: string): boolean | number;
  /** Write a bit or word (HMI pushbuttons write C bits). X addresses set the field input. */
  write(address: string, value: boolean | number): void;
  /** Called after every UI update (each animation frame while running). Returns unsubscribe. */
  subscribe(cb: () => void): () => void;
}

export interface LogEntry { id: number; timeMs: number; address: string; value: boolean }

/** A signal from outside the selected block, held while the block is tested alone. */
export interface BlockSignal extends ExternalSignal { held: boolean }

export interface SimSnapshot {
  running: boolean;
  /** Simulated ms still to run in a "skip ahead" (0 = none). */
  skipLeftMs: number;
  speed: number;
  timeMs: number;
  scanCount: number;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  /** Field input values incl. forces (what the X terminals see right now). */
  inputs: Map<string, boolean>;
  /** Forces set by the engineer (bits and words). */
  forces: Map<string, boolean | number>;
  /** Values held because they come from outside the selected block. */
  holds: Map<string, boolean | number>;
  /** Rungs bypassed by the engineer. */
  rungBypass: Set<string>;
  /** Rungs skipped because "run selected block only" is on. */
  skippedRungs: Set<string>;
  /** Selected block id, null = whole program. */
  block: string | null;
  blockOnly: boolean;
  blockSignals: BlockSignal[];
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;
  power: Map<string, RungPower>;
  devices: SimDevice[];
  /** Newest first. */
  log: LogEntry[];
  errors: string[];
}

const LOGGED = /^(X|Y|C|T|CT)\d+$/;

export class SimController {
  readonly sim: Simulator;
  private readonly io: SimIOPoint[];
  private readonly wiring: IOWiring[];
  private machine: MachineModel;
  private listeners = new Set<() => void>();
  private snap: SimSnapshot;
  private running = false;
  private speed = 1;
  private raf = 0;
  private lastFrame = 0;
  private carryMs = 0;
  private log: LogEntry[] = [];
  private skipLeftMs = 0;
  private skipTimer: ReturnType<typeof setTimeout> | null = null;
  private logId = 0;
  private pressScan = new Map<string, number>();
  private pendingRelease = new Set<string>();
  /** HMI bits turned ON, with the scan they were turned on in. */
  private hmiPressScan = new Map<string, number>();
  /** HMI bits released before any scan saw them ON; turned OFF after the next scan. */
  private hmiPendingRelease = new Set<string>();
  private readonly program: LadderProgram;
  private userForces = new Map<string, boolean | number>();
  private rungBypass = new Set<string>();
  private block: string | null = null;
  private blockOnly = false;
  private blockSignals: BlockSignal[] = [];
  readonly handle: SimHandle;

  constructor(program: LadderProgram, io: SimIOPoint[], wiring: IOWiring[]) {
    this.program = program;
    this.io = io;
    this.wiring = wiring;
    this.sim = createSimulator(program);
    this.machine = buildMachineModel(io, wiring);
    this.syncInputs();
    this.snap = this.buildSnapshot();
    this.handle = {
      read: (a) => this.sim.read(a),
      write: (a, v) => { this.hmiWrite(a, v); this.emit(); },
      subscribe: this.subscribe,
    };
  }

  // ---- store protocol
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  };
  getSnapshot = (): SimSnapshot => this.snap;

  private emit() {
    this.snap = this.buildSnapshot();
    for (const l of this.listeners) l();
  }

  private buildSnapshot(): SimSnapshot {
    const st = this.sim.state;
    const inputs = new Map(st.inputs);
    for (const [a, v] of st.forces) if (a.startsWith('X')) inputs.set(a, v);
    const timers = new Map<string, TimerState>();
    for (const [a, t] of st.timers) timers.set(a, { ...t });
    const counters = new Map<string, CounterState>();
    for (const [a, c] of st.counters) counters.set(a, { ...c });
    return {
      running: this.running,
      skipLeftMs: this.skipLeftMs,
      speed: this.speed,
      timeMs: st.timeMs,
      scanCount: st.scanCount,
      bits: new Map(st.bits),
      words: new Map(st.words),
      inputs,
      forces: new Map(this.userForces),
      holds: this.holds(),
      rungBypass: new Set(this.rungBypass),
      skippedRungs: this.skipped(),
      block: this.block,
      blockOnly: this.blockOnly,
      blockSignals: this.blockSignals.map((b) => ({ ...b })),
      timers,
      counters,
      power: this.sim.rungPower(),
      devices: structuredClone(this.machine.devices),
      log: this.log.slice(),
      errors: st.errors.slice(),
    };
  }

  private syncInputs() {
    const now = machineInputs(this.machine);
    for (const [a, v] of now) this.sim.setInput(a, v);
    this.machine.inputs = now;
  }

  private scan(dt = SCAN_MS) {
    for (const [a, v] of stepMachine(this.machine, (a) => this.sim.readBit(a), dt)) this.sim.setInput(a, v);
    const changes = this.sim.step(dt);
    for (const c of changes) {
      if (!LOGGED.test(c.address)) continue;
      this.log.unshift({ id: ++this.logId, timeMs: c.timeMs, address: c.address, value: c.value });
    }
    if (this.log.length > MAX_LOG) this.log.length = MAX_LOG;
    if (this.hmiPendingRelease.size) {
      for (const a of this.hmiPendingRelease) this.sim.write(a, false);
      this.hmiPendingRelease.clear();
    }
    if (this.pendingRelease.size) {
      for (const id of this.pendingRelease) this.setPressed(id, false);
      this.pendingRelease.clear();
      this.syncInputs();
    }
  }

  // ---- run control
  private frame = (t: number) => {
    if (!this.running) return;
    const dt = Math.min(100, Math.max(0, t - this.lastFrame));
    this.lastFrame = t;
    this.carryMs += dt * this.speed;
    let n = 0;
    while (this.carryMs >= SCAN_MS && n < MAX_SCANS_PER_FRAME) { this.scan(); this.carryMs -= SCAN_MS; n++; }
    if (n === MAX_SCANS_PER_FRAME) this.carryMs = 0;
    this.emit();
    this.raf = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.carryMs = 0;
    this.raf = requestAnimationFrame(this.frame);
    this.emit();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  /** Stop the loop without notifying (unmount). */
  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.skipTimer) clearTimeout(this.skipTimer);
    this.skipTimer = null;
    this.skipLeftMs = 0;
  }

  /**
   * Fast-forward `ms` of simulated time (run hours, rates, service intervals)
   * in small slices so the page stays responsive. Long skips use 100 ms scans.
   */
  skipAhead(ms: number) {
    if (this.skipLeftMs > 0) return;
    const scanMs = ms > 60_000 ? 100 : SCAN_MS;
    const slice = scanMs * 2000;
    this.skipLeftMs = ms;
    const run = () => {
      const n = Math.min(slice, this.skipLeftMs);
      this.advance(n, scanMs);
      this.skipLeftMs -= n;
      if (this.skipLeftMs > 0) this.skipTimer = setTimeout(run, 0);
      else { this.skipTimer = null; this.emit(); }
    };
    this.emit();
    this.skipTimer = setTimeout(run, 0);
  }

  cancelSkip() {
    if (this.skipTimer) clearTimeout(this.skipTimer);
    this.skipTimer = null;
    this.skipLeftMs = 0;
    this.emit();
  }

  stepOnce() {
    this.scan();
    this.emit();
  }

  /**
   * Run `ms` of simulated time immediately (tests, "skip ahead"). `scanMs`
   * above 10 trades timing resolution for speed on long skips.
   */
  advance(ms: number, scanMs = SCAN_MS) {
    for (let t = 0; t < ms; t += scanMs) this.scan(scanMs);
    this.emit();
  }

  /**
   * HMI write. A momentary button that is pressed and released between two
   * scans stays ON for one scan, so the program always sees the press (a real
   * panel's touch also lasts longer than a PLC scan).
   */
  private hmiWrite(address: string, value: boolean | number) {
    const a = normAddress(address);
    if (typeof value === 'boolean' && /^C\d+$/.test(a)) {
      if (value) {
        this.hmiPendingRelease.delete(a);
        this.hmiPressScan.set(a, this.sim.state.scanCount);
      } else if (this.sim.readBit(a) && this.hmiPressScan.get(a) === this.sim.state.scanCount) {
        this.hmiPendingRelease.add(a);
        return;
      }
    }
    this.sim.write(a, value);
  }

  /** Power-cycle the PLC and reset the machine. Retentive memory (DS/DD/DF/DH registers, counters) is kept unless `clearRetentive`. */
  reset(clearRetentive = false) {
    if (this.skipTimer) clearTimeout(this.skipTimer);
    this.skipTimer = null;
    this.skipLeftMs = 0;
    this.sim.reset({ clearRetentive });
    this.hmiPressScan.clear();
    this.hmiPendingRelease.clear();
    const bypass = new Map(this.machine.devices.map((d) => [d.id, d.bypass]));
    this.machine = buildMachineModel(this.io, this.wiring);
    for (const d of this.machine.devices) { const b = bypass.get(d.id); if (b && d.bypass) d.bypass = { ...b }; }
    this.syncEngine();
    this.log = [];
    this.pressScan.clear();
    this.pendingRelease.clear();
    this.syncInputs();
    this.emit();
  }

  setSpeed(s: number) {
    this.speed = s;
    this.emit();
  }

  // ---- field device interaction
  private device(id: string) {
    return this.machine.devices.find((d) => d.id === id);
  }

  private setPressed(id: string, pressed: boolean) {
    const d = this.device(id);
    if (d?.kind === 'pushbutton') d.state.pressed = pressed;
  }

  /** Momentary pushbutton. A press is held for at least one scan, even when released at once. */
  press(id: string, pressed: boolean) {
    const d = this.device(id);
    if (d?.kind !== 'pushbutton') return;
    if (pressed) {
      this.pendingRelease.delete(id);
      this.pressScan.set(id, this.sim.state.scanCount);
      d.state.pressed = true;
    } else if (d.state.pressed) {
      if (this.pressScan.get(id) === this.sim.state.scanCount) this.pendingRelease.add(id);
      else d.state.pressed = false;
    }
    this.syncInputs();
    this.emit();
  }

  /** Toggle a latching device: E-stop, selector, manual sensor. */
  toggle(id: string) {
    const d = this.device(id);
    if (!d) return;
    if (d.kind === 'estop') d.state.pressed = !d.state.pressed;
    else if (d.kind === 'selector' || d.kind === 'sensor') d.state.on = !d.state.on;
    else return;
    this.syncInputs();
    this.emit();
  }

  addPart(conveyorId: string) { addPart(this.machine, conveyorId); this.syncInputs(); this.emit(); }
  removePart(conveyorId: string) { removePart(this.machine, conveyorId); this.syncInputs(); this.emit(); }

  // ---- forces, holds and bypasses
  private holds(): Map<string, boolean | number> {
    return new Map(this.blockSignals.filter((b) => b.held).map((b) => [b.address, b.value]));
  }

  private skipped(): Set<string> {
    if (!this.blockOnly || this.block === null) return new Set();
    return new Set(this.program.rungs.filter((r) => blockOfRung(this.program, r) !== this.block).map((r) => r.id));
  }

  /** Push forces/holds/rung bypasses into the engine (engineer forces win over holds). */
  private syncEngine() {
    this.sim.clearForces();
    for (const [a, v] of this.holds()) this.sim.force(a, v);
    for (const [a, v] of this.userForces) this.sim.force(a, v);
    const skip = this.skipped();
    for (const r of this.program.rungs) this.sim.bypassRung(r.id, this.rungBypass.has(r.id) || skip.has(r.id));
  }

  /** Force a bit ON/OFF or a word to a value (null removes the force). */
  force(address: string, value: boolean | number | null) {
    const a = normAddress(address);
    if (value === null) this.userForces.delete(a);
    else this.userForces.set(a, value);
    this.syncEngine();
    this.emit();
  }

  /** Skip a rung (its outputs hold their last value). */
  bypassRung(rungId: string, bypassed: boolean) {
    if (bypassed) this.rungBypass.add(rungId);
    else this.rungBypass.delete(rungId);
    this.syncEngine();
    this.emit();
  }

  /** Bypass a field device (healthy / held value instead of the plant model). */
  setDeviceBypass(id: string, on: boolean, value?: boolean) {
    setDeviceBypass(this.machine, id, on, value);
    this.syncInputs();
    this.emit();
  }

  /**
   * Focus on one block (null = whole program). Signals the block reads from
   * other blocks are held at healthy values until released.
   */
  selectBlock(blockId: string | null) {
    this.block = blockId;
    this.blockSignals = blockId === null ? [] : externalSignals(
      this.program, blockId,
      (a) => this.program.tags.find((t) => normAddress(t.address) === a)?.nickname ?? this.io.find((p) => normAddress(p.address) === a)?.description ?? '',
      (a) => this.sim.readWord(a),
    ).map((s) => ({ ...s, held: true }));
    if (blockId === null) this.blockOnly = false;
    this.syncEngine();
    this.emit();
  }

  /** Change one held signal: hold on/off and/or its value. */
  setHold(address: string, change: { held?: boolean; value?: boolean | number }) {
    const s = this.blockSignals.find((b) => b.address === address);
    if (!s) return;
    if (change.held !== undefined) s.held = change.held;
    if (change.value !== undefined) s.value = change.value;
    this.syncEngine();
    this.emit();
  }

  /** Execute only the selected block's rungs (others are bypassed). */
  setBlockOnly(on: boolean) {
    this.blockOnly = on && this.block !== null;
    this.syncEngine();
    this.emit();
  }

  /** Remove every force, hold, rung bypass, device bypass and block-only run. */
  clearAll() {
    this.userForces.clear();
    this.rungBypass.clear();
    for (const s of this.blockSignals) s.held = false;
    this.blockOnly = false;
    for (const d of this.machine.devices) if (d.bypass) d.bypass.on = false;
    this.syncEngine();
    this.syncInputs();
    this.emit();
  }

  write(address: string, value: boolean | number) {
    this.handle.write(address, value);
  }
}
