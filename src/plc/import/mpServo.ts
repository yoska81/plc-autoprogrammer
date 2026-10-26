/**
 * Yaskawa MP motion registers (IW / OW / IL / OL 8000 and up): each MECHATROLINK axis has 80h words, and each
 * motion circuit (SVC / SVB line) 800h, from 8000h: base = 8000h + (circuit - 1) × 800h + (axis - 1) × 80h
 * (MP2000 Series SVC-01 Motion Module User's Manual, SIEP C880700 41). IW / IL are the axis's monitors, OW / OL its
 * settings. They drive the servo through the motion module: on another PLC they are not memory but the axis
 * itself, so a rung using them needs the axis set up there (its motion objects), not a copy of the register.
 */

/** The few registers whose meaning the manual's examples confirm; the others are named by their offset. */
const KNOWN: Record<string, string> = {
  OW00: 'run commands (servo ON …)',
  OW08: 'motion command',
  IW00: 'run status',
  IW08: 'motion command response',
  IW0C: 'position status (DEN, POSCOMP)',
  IL10: 'target position (CPOS)',
  IL16: 'actual position (APOS)',
};

export interface ServoRegister {
  register: string;
  circuit: number;
  axis: number;
  /** Offset in the axis's block, two hex digits ("08"). */
  offset: string;
  kind: 'setting' | 'monitor';
  /** "motion command", or "setting OW+1C" when the manual's examples do not name it. */
  what: string;
}

/** A motion register (IW8008, OL801C, IB80000 …), or null. */
export function servoRegister(name: string): ServoRegister | null {
  const m = /^([IO])([BWLF])([89A-F][0-9A-F]{3})([0-9A-F])?$/i.exec(name.trim());
  if (!m) return null;
  const word = parseInt(m[3], 16) - 0x8000;
  const io = m[1].toUpperCase(), width = m[2].toUpperCase();
  const offset = (word % 0x80).toString(16).toUpperCase().padStart(2, '0');
  const kind = io === 'O' ? 'setting' : 'monitor';
  const key = `${io}${width === 'B' ? 'W' : width}${offset}`;
  return {
    register: name.trim().toUpperCase(), circuit: Math.floor(word / 0x800) + 1, axis: Math.floor((word % 0x800) / 0x80) + 1, offset, kind,
    what: KNOWN[key] ?? `${kind} ${io}${width}+${offset}`,
  };
}

/** "Servo axis 1 (circuit 1): motion command (OW8008)". */
export function servoComment(r: ServoRegister): string {
  return `Servo axis ${r.axis} (circuit ${r.circuit}): ${r.what} (${r.register})`;
}

/** Per axis, the motion registers a program uses (sorted), for the import notes and the remake. */
export function servoAxesUsed(names: Iterable<string>): { circuit: number; axis: number; registers: ServoRegister[] }[] {
  const by = new Map<string, { circuit: number; axis: number; registers: ServoRegister[] }>();
  for (const n of names) {
    const r = servoRegister(n);
    if (!r) continue;
    const k = `${r.circuit}.${r.axis}`;
    const e = by.get(k) ?? { circuit: r.circuit, axis: r.axis, registers: [] };
    if (!e.registers.some((x) => x.register === r.register)) e.registers.push(r);
    by.set(k, e);
  }
  return [...by.values()].sort((a, b) => a.circuit - b.circuit || a.axis - b.axis).map((e) => ({ ...e, registers: e.registers.sort((a, b) => a.register.localeCompare(b.register)) }));
}
