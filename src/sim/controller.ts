/**
 * Glue between the scan engine, the machine model and a UI: owns the run loop
 * (requestAnimationFrame, fixed 10 ms simulated scans), the event log and an
 * immutable snapshot for React (`useSyncExternalStore`).
 */
import type { IOWiring } from '../electrical/types';
import type { LadderProgram } from '../plc/ladder';
import { createSimulator, normAddress } from './engine';
import type { CounterState, RungPower, Simulator, TimerState } from './engine';
import { addPart, buildMachineModel, machineInputs, removePart, stepMachine } from './machineModel';
import type { MachineModel, SimDevice, SimIOPoint } from './machineModel';

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

export interface SimSnapshot {
  running: boolean;
  speed: number;
  timeMs: number;
  scanCount: number;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  /** Field input values incl. forces (what the X terminals see right now). */
  inputs: Map<string, boolean>;
  forces: Map<string, boolean>;
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
  private logId = 0;
  private pressScan = new Map<string, number>();
  private pendingRelease = new Set<string>();
  readonly handle: SimHandle;

  constructor(program: LadderProgram, io: SimIOPoint[], wiring: IOWiring[]) {
    this.io = io;
    this.wiring = wiring;
    this.sim = createSimulator(program);
    this.machine = buildMachineModel(io, wiring);
    this.syncInputs();
    this.snap = this.buildSnapshot();
    this.handle = {
      read: (a) => this.sim.read(a),
      write: (a, v) => { this.sim.write(a, v); this.emit(); },
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
      speed: this.speed,
      timeMs: st.timeMs,
      scanCount: st.scanCount,
      bits: new Map(st.bits),
      words: new Map(st.words),
      inputs,
      forces: new Map(st.forces),
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

  private scan() {
    for (const [a, v] of stepMachine(this.machine, (a) => this.sim.readBit(a), SCAN_MS)) this.sim.setInput(a, v);
    const changes = this.sim.step(SCAN_MS);
    for (const c of changes) {
      if (!LOGGED.test(c.address)) continue;
      this.log.unshift({ id: ++this.logId, timeMs: c.timeMs, address: c.address, value: c.value });
    }
    if (this.log.length > MAX_LOG) this.log.length = MAX_LOG;
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
  }

  stepOnce() {
    this.scan();
    this.emit();
  }

  /** Run `ms` of simulated time immediately (tests, "fast forward"). */
  advance(ms: number) {
    for (let t = 0; t < ms; t += SCAN_MS) this.scan();
    this.emit();
  }

  reset() {
    this.sim.reset();
    this.machine = buildMachineModel(this.io, this.wiring);
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

  /** Force a bit (null removes the force). */
  force(address: string, value: boolean | null) {
    this.sim.force(normAddress(address), value);
    this.emit();
  }

  write(address: string, value: boolean | number) {
    this.handle.write(address, value);
  }
}
