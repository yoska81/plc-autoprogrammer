/**
 * The PLC's motion in the simulator: the pulse-train instructions (Home / Velocity Move / Position Move, CLICK help
 * 294–296) and the axes' position, as the PLC would run them, written into the simulated memory each step.
 *   enable rising edge  Complete / Success / Error cleared, Busy on (CLICK: they stay on until re-enabled)
 *   Home                1 s of homing, then position 0, Success
 *   Velocity Move       runs at its signed target velocity while enabled (stops when disabled)
 *   Position Move       travels to its target at its velocity, then Success
 *   limit switch        a move into an active limit stops with Error and code 103
 * Accelerations are taken as instant (positions are what the program reads).
 */
import type { ProgramMotion } from '../core/ladder';
import type { Simulator } from './engine';

export interface MotionSimState { axes: Map<number, { pos: number; vel: number; homeMs: number }>; lastEnable: Map<string, boolean> }

export function createMotionSim(): MotionSimState {
  return { axes: new Map(), lastEnable: new Map() };
}

export function stepMotion(sim: Simulator, motion: ProgramMotion | undefined, dtMs: number, st: MotionSimState): void {
  if (!motion) return;
  const dt = dtMs / 1000;
  for (const ax of motion.axes) if (!st.axes.has(ax.axis)) st.axes.set(ax.axis, { pos: 0, vel: 0, homeMs: 0 });
  for (const ax of motion.axes) st.axes.get(ax.axis)!.vel = 0;
  for (const i of motion.instructions) {
    const a = st.axes.get(i.axis);
    const ax = motion.axes.find((x) => x.axis === i.axis);
    if (!a || !ax) continue;
    const en = sim.readBit(i.enable), was = st.lastEnable.get(i.enable) ?? false;
    st.lastEnable.set(i.enable, en);
    if (en && !was) { for (const b of [i.complete, i.success, i.error]) sim.write(b, false); sim.write(i.errorCode, 0); sim.write(i.busy, true); a.homeMs = 0; }
    if (!en) { if (sim.readBit(i.busy)) { sim.write(i.busy, false); sim.write(i.complete, true); } continue; }
    if (!sim.readBit(i.busy)) continue;
    const limit = (v: number) => (v > 0 && ax.limitPos && sim.readBit(ax.limitPos)) || (v < 0 && ax.limitNeg && sim.readBit(ax.limitNeg));
    const fail = (code: number) => { sim.write(i.busy, false); sim.write(i.complete, true); sim.write(i.error, true); sim.write(i.errorCode, code); };
    const succeed = () => { sim.write(i.busy, false); sim.write(i.complete, true); sim.write(i.success, true); };
    if (i.kind === 'home') {
      a.homeMs += dtMs;
      if (a.homeMs >= 1000) { a.pos = 0; succeed(); }
    } else if (i.kind === 'velocity') {
      const v = sim.readWord(i.target!);
      if (limit(v)) { fail(103); continue; }
      a.vel = v; a.pos += v * dt;
    } else {
      const target = sim.readWord(i.target!), speed = Math.abs(sim.readWord(i.velocity!)) || 1;
      const d = target - a.pos, v = Math.sign(d) * speed;
      if (limit(v)) { fail(103); continue; }
      if (Math.abs(d) <= speed * dt) { a.pos = target; succeed(); } else { a.vel = v; a.pos += v * dt; }
    }
  }
  for (const ax of motion.axes) {
    const a = st.axes.get(ax.axis)!;
    sim.write(ax.position, Math.round(a.pos));
    sim.write(ax.velocity, Math.round(a.vel));
  }
}
