/**
 * Vendor-neutral ladder program model.
 *
 * A rung's input logic is an OR of ANDs: `branches` are parallel paths, and
 * each branch is a series of elements. Every boolean expression can be written
 * this way, and it maps directly onto how a ladder rung is drawn and entered.
 * The AI writes this structure (via a JSON schema), the UI draws and edits it,
 * and each PLC profile turns it into that PLC's own format.
 */

export type ContactType = 'NO' | 'NC' | 'RISE' | 'FALL';
export type CompareOp = '==' | '<>' | '>' | '>=' | '<' | '<=';

export interface ContactElement {
  type: ContactType;
  address: string;
}

export interface CompareElement {
  type: 'CMP';
  /** Register address or constant, e.g. "DS1" or "100". */
  left: string;
  op: CompareOp;
  right: string;
}

/**
 * An instruction of an imported program the app cannot draw or run (MSG, PID, a vendor block…),
 * kept as the original text so a re-export to the same PLC keeps it. As a contact it is open
 * (false) in the simulator; as an output it does nothing. `vendor` = the PLC profile id it came from.
 */
export interface RawInstruction {
  type: 'RAW';
  vendor: string;
  text: string;
  /** The original definitions the instruction needs, in the vendor's own format (Logix: <Tag>, <DataType>, <AddOnInstructionDefinition> XML). */
  decl?: string[];
}

export type LadderElement = ContactElement | CompareElement | RawInstruction;

export type TimerMode = 'ON_DELAY' | 'OFF_DELAY';
export type TimeUnit = 'ms' | 'sec' | 'min' | 'hour' | 'day';

export interface CoilOutput {
  type: 'OUT' | 'SET' | 'RST';
  address: string;
}

export interface TimerOutput {
  type: 'TMR';
  /** Timer bit address, e.g. "T1". */
  address: string;
  mode: TimerMode;
  /** Constant or register holding the setpoint. */
  preset: string;
  unit: TimeUnit;
  /** Retentive (accumulating) timer; needs resetAddress. */
  accumulate: boolean;
  resetAddress: string | null;
}

export interface CounterOutput {
  type: 'CNT';
  address: string;
  direction: 'UP' | 'DOWN';
  preset: string;
  /** Bit that resets the counter. */
  resetAddress: string | null;
}

export interface CopyOutput {
  type: 'COPY';
  source: string;
  dest: string;
}

export interface MathOutput {
  type: 'MATH';
  dest: string;
  /** Formula using register addresses, e.g. "DS1 + 1". */
  expression: string;
}

export type LadderOutput = CoilOutput | TimerOutput | CounterOutput | CopyOutput | MathOutput | RawInstruction;

export interface Rung {
  /** Stable id so edits and AI revisions can be diffed rung by rung. */
  id: string;
  /** Id of the machine block / section this rung belongs to (see LadderProgram.blocks). */
  block?: string;
  comment: string;
  /** Parallel branches (OR). Empty = rung always true. */
  branches: LadderElement[][];
  /** Output instructions, executed in parallel when the rung is true. */
  outputs: LadderOutput[];
}

export interface TagDefinition {
  address: string;
  nickname: string;
  comment: string;
}

/** A machine block (station / section) used to split big programs. */
export interface ProgramBlock {
  id: string;
  name: string;
  description: string;
}

export interface LadderProgram {
  rungs: Rung[];
  /** Blocks in program order; rungs without a block belong to "General". */
  blocks?: ProgramBlock[];
  /** Nicknames for internal memory the program uses (C, T, CT, DS ...). */
  tags: TagDefinition[];
  /** The automatic cycle as steps, when the program was built from the templates (shown as a table; exporters ignore it). */
  sequence?: import('../engine/sequence').CycleSequence;
  /** Motion the PLC runs itself (pulse-train axes, high-speed counters): set up in the PLC software, enabled by bits the rungs set. */
  motion?: ProgramMotion;
}

/**
 * A pulse-train (PTO) axis set up in the PLC's high-speed I/O (CLICK PLUS: High Speed I/O Setup, pulse on
 * Y001 / Y003 / Y005 of the slot-0 module, direction on any Y; CLICK help 292).
 */
export interface MotionAxis {
  /** PTO axis number (1–3). */
  axis: number;
  name: string;
  pulse: string;
  direction: string;
  /** DD registers the PLC writes: current position (pulses) and velocity (pulses/s). */
  position: string;
  velocity: string;
  /** Pulses per position unit (e.g. 200 pulses/mm) and the unit. */
  pulsesPerUnit: number;
  units: string;
  /** Limit switch inputs assigned to the axis (a limit faults the move: CLICK error 103). */
  limitPos?: string;
  limitNeg?: string;
}

/** A motion instruction the PLC runs (CLICK PLUS: Home / Velocity Move / Position Move for PTO Axis, help 294–296). */
export interface MotionInstruction {
  kind: 'home' | 'velocity' | 'position';
  axis: number;
  /** The bit the rungs set to run it. */
  enable: string;
  /** Status bits and the error code register the instruction writes. */
  busy: string;
  complete: string;
  success: string;
  error: string;
  errorCode: string;
  /** Position move: target (DD, pulses, ABS); velocity move: target velocity (DD, pulses/s, signed). */
  target?: string;
  /** Position move: velocity (DD, pulses/s). */
  velocity?: string;
  /** Acceleration / deceleration (pulses/s²). */
  accel: number;
  decel: number;
  /** Home: the switch input it searches for. */
  homeSwitch?: string;
}

/** A high-speed counter (encoder) set up in the PLC's high-speed I/O; it writes its count to a DD register. */
export interface HighSpeedCounter {
  name: string;
  channels: string[];
  quadrature: boolean;
  withZ: boolean;
  count: string;
}

export interface ProgramMotion { axes: MotionAxis[]; instructions: MotionInstruction[]; counters: HighSpeedCounter[] }

/** Registers and bits the PLC's motion (instructions, axes, counters) writes, not the rungs. */
export function motionWrites(m: ProgramMotion | undefined): string[] {
  if (!m) return [];
  return [...m.instructions.flatMap((i) => [i.busy, i.complete, i.success, i.error, i.errorCode]), ...m.axes.flatMap((a) => [a.position, a.velocity]), ...m.counters.map((c) => c.count)];
}

export const EMPTY_PROGRAM: LadderProgram = { rungs: [], tags: [] };

/**
 * Names in the text of a kept (Structured Text / SCL) instruction, with where they are: not quoted block
 * names, not members after a dot, not calls, not parameter names of a call (`(Raw := …`, `, OUT => …`).
 */
export function rawTextNames(text: string): { name: string; index: number }[] {
  const out: { name: string; index: number }[] = [];
  for (const m of text.matchAll(/(?<![\w."#])([A-Za-z_]\w*)(?![\w(])/g)) {
    const before = text.slice(0, m.index), after = text.slice(m.index + m[1].length);
    if (/[(,]\s*$/.test(before) && /^\s*(:=|=>)/.test(after)) continue;
    out.push({ name: m[1], index: m.index });
  }
  return out;
}

/** A RAW holding a whole block of Structured Text / SCL (FUNCTION … END_FUNCTION): exported as a block of its own. */
export const isBlockRaw = (r: RawInstruction): boolean => /^\s*(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK|DATA_BLOCK|TYPE)\b/i.test(r.text);

/** What an exporter writes for a RAW instruction of another PLC (never dropped silently). */
export const rawTodo = (r: RawInstruction): string => `TODO (from ${r.vendor}): ${r.text}`;

export function newRungId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

/** Addresses an input element reads (none for a RAW instruction). */
export function elementAddresses(e: LadderElement): string[] {
  return e.type === 'CMP' ? [e.left, e.right] : e.type === 'RAW' ? [] : [e.address];
}

/** Every address a rung reads or writes. */
export function rungAddresses(rung: Rung): string[] {
  const out: string[] = [];
  for (const branch of rung.branches) {
    for (const el of branch) {
      if (el.type === 'CMP') out.push(el.left, el.right);
      else if (el.type !== 'RAW') out.push(el.address);
    }
  }
  for (const o of rung.outputs) {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': out.push(o.address); break;
      case 'TMR': out.push(o.address, o.preset); if (o.resetAddress) out.push(o.resetAddress); break;
      case 'CNT': out.push(o.address, o.preset); if (o.resetAddress) out.push(o.resetAddress); break;
      case 'COPY': out.push(o.source, o.dest); break;
      case 'MATH': out.push(o.dest); break;
    }
  }
  return out;
}

/** Addresses written by the rung's outputs (used to find double coils). */
export function rungWrites(rung: Rung): string[] {
  return rung.outputs.flatMap((o) => {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': case 'TMR': case 'CNT': return [o.address];
      case 'COPY': return [o.dest];
      case 'MATH': return [o.dest];
      case 'RAW': return [];
    }
  });
}
