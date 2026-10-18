/**
 * Motion blocks of the rule-based program: one block per servo / stepper axis and per encoder, implementing the
 * HMI's roles (axis:<key>:… / enc:<key>:…, src/hmi/engine/build.ts).
 *
 * An axis on a pulse-train output is moved by the PLC's own motion instructions (CLICK PLUS: Home, Velocity Move
 * and Position Move for PTO Axis, help 294–296), set up in the PLC software and enabled by request bits these
 * rungs set; the instructions write their Busy / Complete / Success / Error bits and the axis's position and
 * velocity (declared in program.motion, so the checker, the CLICK entry sheet and the simulator know them).
 * The rungs do the supervision: drive enable only with Safety OK and no fault, the fault latch and its reset,
 * homed, the jog permit (Manual mode), jog and move requests (moves only once homed), position / speed in units.
 * An encoder's count (a high-speed counter writing a DD register) is scaled to units, with an offset for Zero
 * and a speed from its change every 100 ms.
 */
import type { CompareOp, LadderElement, LadderOutput, MotionAxis, MotionInstruction, HighSpeedCounter, ProgramBlock, ProgramMotion } from '../core/ladder';
import type { HmiContent, HmiPoint } from '../../hmi/engine';

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const CMP = (left: string, op: CompareOp, right: string): LadderElement => ({ type: 'CMP', left, op, right });
const OUT = (address: string): LadderOutput => ({ type: 'OUT', address });
const SET = (address: string): LadderOutput => ({ type: 'SET', address });
const RST = (address: string): LadderOutput => ({ type: 'RST', address });
const COPY = (source: string, dest: string): LadderOutput => ({ type: 'COPY', source, dest });
const MATH = (dest: string, expression: string): LadderOutput => ({ type: 'MATH', dest, expression });
const TMR = (address: string, preset: string, unit: 'sec' | 'ms'): LadderOutput => ({ type: 'TMR', address, mode: 'ON_DELAY', preset, unit, accumulate: false, resetAddress: null });

export interface MotionApi {
  R: (block: string, comment: string, branches: LadderElement[][], outputs: LadderOutput[]) => void;
  tag: (role: string) => string | undefined;
  bit: () => string;
  timer: () => string;
  freeDf: () => string;
  freeDd: () => string;
  freeDs: () => string;
  nick: (address: string, nickname: string, comment: string) => void;
  blocks: ProgramBlock[];
  notes: string[];
  faultBits: string[];
  SAFE: string; RESET: string; RUN: string; manual: string;
  panel: boolean;
}

const PULSE_RE = /\b(pulse|step|pul)\b/i;
const DIR_RE = /\bdir(ection)?\b/i;

/** Pulses per unit from the axis / encoder texts: "200 pulses/mm", or "10000 pulses/rev … 5 mm/rev" (default 1). */
export function pulsesPerUnit(texts: string[]): { ppu: number; known: boolean; unit?: string } {
  const t = texts.join(' ');
  const direct = /(\d+(?:\.\d+)?)\s*(?:pulses?|counts?|steps?)\s*(?:\/|per)\s*(mm|deg|in)\b/i.exec(t);
  if (direct) return { ppu: Number(direct[1]), known: true, unit: direct[2].toLowerCase() };
  const perRev = /(\d+(?:\.\d+)?)\s*(?:pulses?|counts?|steps?|ppr)\s*(?:(?:\/|per)\s*rev\w*)?/i.exec(t);
  const lead = /(\d+(?:\.\d+)?)\s*(mm|deg|in)\s*(?:\/|per)\s*rev\w*/i.exec(t);
  if (perRev && lead && /\b(rev|ppr)\b/i.test(perRev[0])) return { ppu: Number(perRev[1]) / Number(lead[1]), known: true, unit: lead[2].toLowerCase() };
  return { ppu: 1, known: false };
}

const fmt = (x: number) => String(Math.round(x * 10000) / 10000);

export function buildMotion(c: HmiContent, api: MotionApi): ProgramMotion | undefined {
  const axes = c.axes ?? [], encoders = c.encoders ?? [];
  if (!axes.length && !encoders.length) return undefined;
  const { R, tag, bit, nick, SAFE, RESET, RUN, manual } = api;
  const m: ProgramMotion = { axes: [], instructions: [], counters: [] };

  axes.forEach((ax, i) => {
    const k = ax.key, n = ax.name, id = `axis_${k.toLowerCase()}`;
    api.blocks.push({ id, name: n, description: `${n}: drive enable, fault, homing, jog and moves${ax.points.some((p) => PULSE_RE.test(p.description)) ? ' (PLC pulse-train axis)' : ''}.` });
    const outPts = ax.points.filter((p) => /^Y/i.test(p.address));
    const pulse = outPts.find((p) => PULSE_RE.test(p.description)), dir = outPts.find((p) => DIR_RE.test(p.description));
    const home = ax.points.find((p) => /\bhome\b/i.test(p.description) && /\b(sensor|switch|prox)\b/i.test(p.description) && /^X/i.test(p.address));
    const { ppu, known, unit } = pulsesPerUnit(ax.points.map((p) => p.description));
    // The position unit named with the scaling ("200 pulses/mm") wins over a guess from the words.
    const units = unit ?? ax.units;
    if (pulse && !known) api.notes.push(`${n}: pulses per ${units} not given in the I/O list — the program uses 1 pulse = 1 ${units}. Set the real value (pulses/rev ÷ ${units}/rev) in the scaling rungs.`);
    const a = (r: string) => tag(`axis:${k}:${r}`);
    const fault = tag(`alarm:axis:${k}:fault`) ?? bit();
    const enabled = a('enabled') ?? bit(), homed = a('homed') ?? bit(), moving = a('moving') ?? bit(), inPos = a('inpos') ?? bit(), jogPermit = a('jogpermit') ?? bit();
    const cmd = (r: string) => (api.panel ? a(r) : undefined);
    const enableCmd = cmd('enable'), homeCmd = cmd('home'), jogPos = cmd('jogpos'), jogNeg = cmd('jogneg'), moveCmd = cmd('move'), resetCmd = cmd('reset');
    const E = ax.enable?.address ?? bit();

    // Setpoints: a declared range with a safe default on the first scan.
    const sp = (role: string, def: number, max: number, what: string) => {
      const r = a(role) ?? api.freeDf();
      R(id, `First scan: ${n} ${what} outside 0.1-${max} is loaded with the default ${def}`, [[NO('SC2'), CMP(r, '<', '0.1')], [NO('SC2'), CMP(r, '>', String(max))]], [COPY(String(def), r)]);
      return r;
    };
    const speed = sp('speed', 10, 1000, `move speed (${units}/s)`), jogSpeed = sp('jogspeed', 5, 200, `jog speed (${units}/s)`);
    const target = a('target') ?? api.freeDf();

    // Enable, enabled, fault latch.
    R(id, `${n}: drive enable — ${enableCmd ? 'the enable command' : 'always'} while Safety OK and no fault`, [[...(enableCmd ? [NO(enableCmd)] : []), NO(SAFE), NC(fault)]], [OUT(E)]);
    R(id, `${n} enabled${ax.ready ? `: enable on and the drive reports ready (${ax.ready.description})` : ''}`, [[NO(E), ...(ax.ready ? [NO(ax.ready.address)] : [])]], [OUT(enabled)]);
    nick(E, `${n}_Enable_Out`, `${n} drive enable`);
    const instr = pulse ? { home: bits(api, `${n}_Home`), vel: bits(api, `${n}_Jog`), pos: bits(api, `${n}_Move`) } : null;
    const faults: LadderElement[][] = [...(ax.fault ? [[NO(ax.fault.address)]] : []), ...(instr ? [[NO(instr.home.error)], [NO(instr.vel.error)], [NO(instr.pos.error)]] : [])];
    if (faults.length) {
      R('alarms', `${n} fault: ${[ax.fault ? ax.fault.description : '', instr ? 'a motion instruction error' : ''].filter(Boolean).join(' or ')} — latched`, faults, [SET(fault)]);
      R('alarms', `${n} fault reset: ${resetCmd ? `${n} Reset or ` : ''}Reset once the drive fault is off`, [...(resetCmd ? [[NO(resetCmd), ...(ax.fault ? [NC(ax.fault.address)] : [])]] : []), [NO(RESET), ...(ax.fault ? [NC(ax.fault.address)] : [])]], [RST(fault)]);
      api.faultBits.push(fault);
    }
    nick(fault, `ALM_${n}_Fault`, `${n}: servo fault`);
    R(id, `${n} jog permit: Manual mode, Safety OK, enabled, no fault`, [[NO(manual), NO(SAFE), NO(enabled), NC(fault)]], [OUT(jogPermit)]);

    if (!pulse || !instr) {
      if (!pulse) api.notes.push(`${n}: no pulse output in the I/O list — the program enables the drive and watches its fault${ax.homed ? ' and home' : ''}; the drive moves it by its own I/O (indexer).`);
      if (ax.homed) R(id, `${n} homed: ${ax.homed.description}`, [[NO(ax.homed.address), NO(enabled)]], [OUT(homed)]);
      if (ax.inPos) R(id, `${n} in position: ${ax.inPos.description}`, [[NO(ax.inPos.address)]], [OUT(inPos)]);
      return;
    }
    if (!/^Y00[135]$/i.test(pulse.address)) api.notes.push(`${n}: its pulse output ${pulse.address} is not Y001 / Y003 / Y005 — CLICK PLUS pulse-train outputs are fixed to those points of the slot-0 module (CLICK help 292). Move the pulse wire there.`);
    const axisNo = i + 1;
    const posDD = api.freeDd(), velDD = api.freeDd(), tgtDD = api.freeDd(), spdDD = api.freeDd(), jogDD = api.freeDd();
    nick(posDD, `${n}_Pos_Pulses`, `${n} current position (pulses), written by the PLC's axis`); nick(velDD, `${n}_Vel_Pulses`, `${n} current velocity (pulses/s), written by the PLC's axis`);
    nick(tgtDD, `${n}_Target_Pulses`, `${n} move target (pulses)`); nick(spdDD, `${n}_Speed_Pulses`, `${n} move speed (pulses/s)`); nick(jogDD, `${n}_Jog_Pulses`, `${n} jog velocity (pulses/s, signed)`);
    const axis: MotionAxis = { axis: axisNo, name: n, pulse: pulse.address, direction: dir?.address ?? '', position: posDD, velocity: velDD, pulsesPerUnit: ppu, units: units,
      ...(ax.limitPos ? { limitPos: ax.limitPos.address } : {}), ...(ax.limitNeg ? { limitNeg: ax.limitNeg.address } : {}) };
    if (!dir) api.notes.push(`${n}: no direction output in the I/O list — the axis can only move one way. Add "${n} direction" on any Y.`);
    m.axes.push(axis);
    const accel = Math.max(1000, Math.round(ppu * 100)), decel = accel;

    // Homing: Home asks, the instruction runs while the request is on; Success = homed.
    R(id, `${n} home request: ${homeCmd ? 'Home' : 'the cycle sets it'} while enabled, no fault and the cycle stopped`, homeCmd ? [[NO(homeCmd), NO(enabled), NC(fault), NC(RUN)]] : [[NC('SC1')]], [SET(instr.home.enable)]);
    R(id, `${n} home request ends: homing complete, disabled or a fault`, [[NO(instr.home.complete)], [NC(enabled)], [NO(fault)]], [RST(instr.home.enable)]);
    R(id, `${n} homed: the Home instruction succeeded (lost when disabled or faulted)`, [[NO(instr.home.success)]], [SET(homed)]);
    R(id, `${n} not homed once disabled or faulted`, [[NC(enabled)], [NO(fault)]], [RST(homed)]);
    m.instructions.push({ kind: 'home', axis: axisNo, ...instr.home, accel, decel, ...(home ? { homeSwitch: home.address } : {}) });
    if (!home) api.notes.push(`${n}: no home switch in the I/O list — set the Home instruction to "set current position" (CLICK help 294) or add the switch.`);

    // Jog: Velocity Move at ± the jog speed while a jog button is held and permitted; each direction stops at its limit.
    const pul = `${jogSpeed} * ${fmt(ppu)}`;
    if (jogPos) R(id, `${n} jog +: velocity = jog speed × ${fmt(ppu)} pulses/${units}`, [[NO(jogPos), NO(jogPermit), ...(jogNeg ? [NC(jogNeg)] : []), ...(ax.limitPos ? [NC(ax.limitPos.address)] : [])]], [MATH(jogDD, pul)]);
    if (jogNeg) R(id, `${n} jog −: velocity = − jog speed × ${fmt(ppu)} pulses/${units}`, [[NO(jogNeg), NO(jogPermit), ...(jogPos ? [NC(jogPos)] : []), ...(ax.limitNeg ? [NC(ax.limitNeg.address)] : [])]], [MATH(jogDD, `0 - ${pul}`)]);
    R(id, `${n} jog request: a jog button held and permitted${ax.limitPos || ax.limitNeg ? ', not at that direction\'s limit' : ''} (release stops it)`,
      jogPos || jogNeg ? [...(jogPos ? [[NO(jogPos), NO(jogPermit), ...(ax.limitPos ? [NC(ax.limitPos.address)] : [])]] : []), ...(jogNeg ? [[NO(jogNeg), NO(jogPermit), ...(ax.limitNeg ? [NC(ax.limitNeg.address)] : [])]] : [])] : [[NC('SC1')]],
      [OUT(instr.vel.enable)]);
    m.instructions.push({ kind: 'velocity', axis: axisNo, ...instr.vel, target: jogDD, accel, decel });

    // Move: to the target at the move speed, only once homed, in Manual (the cycle uses the same request bit).
    R(id, `${n} move request: Move while enabled, homed, no fault, Manual mode — target and speed in pulses`, moveCmd ? [[NO(moveCmd), NO(enabled), NO(homed), NC(fault), NO(manual)]] : [[NC('SC1')]],
      [MATH(tgtDD, `${target} * ${fmt(ppu)}`), MATH(spdDD, `${speed} * ${fmt(ppu)}`), SET(instr.pos.enable)]);
    R(id, `${n} move request ends: move complete, disabled or a fault`, [[NO(instr.pos.complete)], [NC(enabled)], [NO(fault)]], [RST(instr.pos.enable)]);
    m.instructions.push({ kind: 'position', axis: axisNo, ...instr.pos, target: tgtDD, velocity: spdDD, accel, decel });

    // Status and readouts.
    R(id, `${n} moving: homing, jogging or moving`, [[NO(instr.home.busy)], [NO(instr.vel.busy)], [NO(instr.pos.busy)]], [OUT(moving)]);
    R(id, `${n} in position: the last move succeeded and nothing is moving`, [[NO(instr.pos.success), NC(moving)]], [OUT(inPos)]);
    const pos = a('pos') ?? api.freeDf(), act = a('actspeed') ?? api.freeDf();
    R(id, `${n} position (${units}) and speed (${units}/s) from the axis's pulses`, [[NO('SC1')]], [MATH(pos, `${posDD} / ${fmt(ppu)}`), MATH(act, `${velDD} / ${fmt(ppu)}`)]);
    if (!api.panel) api.notes.push(`No touch panel: ${n} homes / jogs / moves only from the cycle (its request bits ${instr.home.enable}, ${instr.vel.enable}, ${instr.pos.enable}) — add pushbuttons for manual setup if needed.`);
  });

  // Encoders: count → position in units with a Zero offset; speed from the change every 100 ms.
  encoders.forEach((en) => {
    const k = en.key, n = en.name, id = `enc_${k.toLowerCase()}`;
    const { ppu, known, unit } = pulsesPerUnit(en.channels.map((p) => p.description));
    const enUnits = unit ?? en.units;
    api.blocks.push({ id, name: n, description: `${n}: high-speed counter scaled to ${enUnits}, speed and zero.` });
    if (!known) api.notes.push(`${n}: counts per ${enUnits} not given in the I/O list — 1 count = 1 ${enUnits}. Set the real value in its scaling rung.`);
    const withZ = en.channels.some((p) => /\b(z|index|marker)\b/i.test(p.description));
    const count = api.freeDd(), offset = api.freeDd(), last = api.freeDd();
    nick(count, `${n.replace(/\s+/g, '_')}_Count`, `${n} count, written by the high-speed counter`); nick(offset, `${n.replace(/\s+/g, '_')}_Zero`, `${n} count at the last Zero`); nick(last, `${n.replace(/\s+/g, '_')}_Last`, `${n} count 100 ms ago`);
    const counter: HighSpeedCounter = { name: n, channels: en.channels.map((p: HmiPoint) => p.address), quadrature: en.channels.length >= 2, withZ, count };
    m.counters.push(counter);
    const pos = tag(`enc:${k}:pos`) ?? api.freeDf(), spd = tag(`enc:${k}:speed`) ?? api.freeDf(), zero = api.panel ? tag(`enc:${k}:zero`) : undefined;
    if (zero) R(id, `${n} zero: the current count becomes the zero point`, [[NO(zero)]], [COPY(count, offset)]);
    R(id, `${n} position (${enUnits}) = (count − zero) ÷ ${fmt(ppu)} counts/${enUnits}`, [[NO('SC1')]], [MATH(pos, `(${count} - ${offset}) / ${fmt(ppu)}`)]);
    const t = api.timer();
    R(id, `${n} speed window: 100 ms, restarts itself`, [[NC(t)]], [TMR(t, '100', 'ms')]);
    R(id, `${n} speed (${enUnits}/s) from the counts in the last 100 ms`, [[NO(t)]], [MATH(spd, `(${count} - ${last}) * 10 / ${fmt(ppu)}`), COPY(count, last)]);
    nick(t, `Tmr_${n.replace(/\s+/g, '_')}_Speed`, `${n} 100 ms speed window`);
  });
  return m;
}

/** The status bits and error register of one motion instruction (written by the instruction itself). */
function bits(api: MotionApi, name: string): Pick<MotionInstruction, 'enable' | 'busy' | 'complete' | 'success' | 'error' | 'errorCode'> {
  const b = { enable: api.bit(), busy: api.bit(), complete: api.bit(), success: api.bit(), error: api.bit(), errorCode: api.freeDs() };
  api.nick(b.enable, `${name}_Req`, `${name}: run request (enables the instruction)`);
  api.nick(b.busy, `${name}_Busy`, `${name}: Busy, written by the instruction`);
  api.nick(b.complete, `${name}_Cplt`, `${name}: Complete, written by the instruction`);
  api.nick(b.success, `${name}_OK`, `${name}: Success, written by the instruction`);
  api.nick(b.error, `${name}_Err`, `${name}: Error, written by the instruction`);
  api.nick(b.errorCode, `${name}_ErrCode`, `${name}: error code, written by the instruction (CLICK help 297)`);
  return b;
}
