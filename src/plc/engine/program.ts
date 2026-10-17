/**
 * Rule-based PLC program: the standard blocks every machine needs, built from the HMI content (the
 * actuators, sensors and safety read from the I/O list — src/hmi/engine/content.ts) and the HMI's tag
 * list, in the neutral (CLICK-style) memory every profile exports. Safety & modes, Alarms, one block
 * per actuator (timeouts, auto request bits), Manual (permits, hold-to-run requests), Outputs (one coil
 * per output, always gated by Safety OK) and HMI & status (state word, heartbeat, counters, run hours,
 * service, rate). The machine's own automatic cycle — when each actuator moves — is the only part the
 * rules leave to the AI (./cycleAI.ts): it writes the "cycle" block that sets the auto request bits.
 */
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, ProgramBlock, Rung, TagDefinition } from '../core/ladder';
import type { HmiAlarm, HmiScreen, HmiTag } from '../../hmi/types';
import { inferRoles } from '../../hmi/engine/roles';
import { TWO_HAND_RE } from '../../electrical/engine/machineModel';
import { planHmiTags, type HmiActuator, type HmiContent, type HmiPoint } from '../../hmi/engine';

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const RISE = (address: string): LadderElement => ({ type: 'RISE', address });
const CMP = (left: string, op: CompareOp, right: string): LadderElement => ({ type: 'CMP', left, op, right });
const OUT = (address: string): LadderOutput => ({ type: 'OUT', address });
const SET = (address: string): LadderOutput => ({ type: 'SET', address });
const RST = (address: string): LadderOutput => ({ type: 'RST', address });
const COPY = (source: string, dest: string): LadderOutput => ({ type: 'COPY', source, dest });
const MATH = (dest: string, expression: string): LadderOutput => ({ type: 'MATH', dest, expression });
const TMR = (address: string, preset: string, unit: 'sec' | 'ms' = 'sec', accumulate = false, resetAddress: string | null = null): LadderOutput =>
  ({ type: 'TMR', address, mode: 'ON_DELAY', preset, unit, accumulate, resetAddress });

/** Which feedback input says "extended" and which "retracted" (by the words in their descriptions). */
const EXT_FB = /\b(extended|advanced|down|closed|clamped|out|forward|in position)\b/i;
const RET_FB = /\b(retracted|returned|up|open(ed)?|unclamped|home|back|in)\b/i;
function feedbackOf(a: HmiActuator): { ext?: HmiPoint; ret?: HmiPoint } {
  const ext = a.feedback.find((f) => EXT_FB.test(f.description));
  const ret = a.feedback.find((f) => f !== ext && RET_FB.test(f.description));
  return { ext, ret };
}

export interface ProgramInput {
  content: HmiContent;
  /** The HMI's tags (rule-based HMIs carry roles; older ones get roles inferred); missing → the plan the HMI engine would make. */
  hmiTags?: HmiTag[];
  /** The HMI's screens and alarms (button interlocks name the permits, the alarm list names the alarms). */
  hmiScreens?: HmiScreen[];
  hmiAlarms?: HmiAlarm[];
}

export interface ProgramResult {
  program: LadderProgram;
  /** Internal request bits the cycle block (AI) sets, per actuator output. */
  autoBits: { actuator: string; output: string; bit: string; what: string }[];
  /** Internal bits / registers the cycle block may use freely. */
  free: { bits: string; steps: string; timers: string };
  notes: string[];
  /** HMI tag address per role (the HMI's own, else the plan's). */
  roles: Map<string, string>;
  /** Internal machine bits (the cycle template uses them). */
  internal: { safe: string; run: string; fault: string; reset: string };
  /** Every address in use (HMI and program): the cycle template allocates around them. */
  taken: Set<string>;
  /** HMI tags no rule implements (also checker errors when the HMI is passed to the checker). */
  unmatched: HmiTag[];
  /** What the automatic cycle needs from the standard blocks: bits that must be ON before each cycle starts
   *  (two-hand start, temperature ready), the two-hand inputs (released during the closing stroke aborts it)
   *  and the dwell-time setpoint (ms) of its timed step. */
  cycle: { startConds: string[]; twoHand?: string[]; dwellSp?: string; /** Actuator whose extend is the closing stroke the two-hand control guards. */ closing?: string };
}

export function buildProgram(input: ProgramInput): ProgramResult {
  const c = input.content;
  const notes: string[] = [];
  // Address stability: every function the HMI already has keeps its address (roles inferred for older
  // HMIs); functions it lacks get free addresses — never one the HMI uses for something else.
  const hmiTags = input.hmiTags ?? [];
  const inferred = inferRoles(hmiTags, { content: c, screens: input.hmiScreens, alarms: input.hmiAlarms });
  const taken = new Set(hmiTags.map((t) => t.address.toUpperCase()));
  const plan = planHmiTags(c, { reuse: new Map(inferred.tags.filter((t) => t.role).map((t) => [t.role!, t] as const)), taken });
  const byRole = new Map<string, HmiTag>();
  for (const t of plan.tags) if (t.role) byRole.set(t.role, t);
  for (const t of inferred.tags) if (t.role) byRole.set(t.role, t);
  for (const t of plan.tags) taken.add(t.address.toUpperCase());
  const tag = (role: string) => byRole.get(role)?.address;
  const must = (role: string) => {
    const a = tag(role);
    if (!a) throw new Error(`No HMI tag for ${role}`);
    return a;
  };

  // Internal memory (neutral CLICK-style), allocated around every address the HMI uses: machine bits from C1,
  // request bits from C20, timers from T1, never a T / CT whose TD / CTD the HMI shows for something else.
  let nextBit = 1;
  const freeBit = () => { let a: string; do { a = `C${nextBit++}`; } while (taken.has(a)); taken.add(a); return a; };
  const SAFE = tag('int:safety') ?? freeBit(), RUN = tag('int:running') ?? freeBit();
  taken.add(SAFE); taken.add(RUN);
  const FAULT = freeBit(), BATCH = freeBit(), HOUR = freeBit(), PULSE = freeBit(), RESET = freeBit();
  nextBit = Math.max(nextBit, 20);
  let nextTimer = 1;
  const bit = freeBit;
  // Internal float registers above the HMI's DF101-DF200.
  let nextDf = 201;
  const freeDf = () => { let a: string; do { a = `DF${nextDf++}`; } while (taken.has(a)); taken.add(a); return a; };
  const timer = () => { let a: string; do { a = `T${nextTimer++}`; } while (taken.has(a) || taken.has(`TD${a.slice(1)}`)); taken.add(a); return a; };
  const tags: TagDefinition[] = [];
  const nick = (address: string, nickname: string, comment: string) => { if (!tags.some((t) => t.address === address)) tags.push({ address, nickname: nickname.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24), comment }); };
  const rungs: Rung[] = [];
  let n = 0;
  const R = (block: string, comment: string, branches: LadderElement[][], outputs: LadderOutput[]) => rungs.push({ id: `r_${block}_${++n}`, block, comment, branches, outputs });

  const inputs = c.io.filter((p) => p.type === 'input');
  // A panel Start button (two-hand start buttons start each cycle, they do not arm the machine).
  const startPb = inputs.find((p) => /\bstart\b/i.test(p.description) && !TWO_HAND_RE.test(p.description));
  const stopPb = inputs.find((p) => /\bstop\b/i.test(p.description) && !/e-?stop|emergency/i.test(p.description));
  const resetPb = inputs.find((p) => /\breset\b/i.test(p.description) && !/safety/i.test(p.description));
  const start = must('cmd:start'), stop = must('cmd:stop'), reset = must('cmd:reset'), manualSel = must('cmd:manual');
  const manual = must('sts:manual'), running = must('sts:running'), heartbeat = must('sts:heartbeat'), state = must('word:state');

  const blocks: ProgramBlock[] = [
    { id: 'safety', name: 'Safety & modes', description: 'First-scan defaults, Safety OK, Auto/Manual mode and the cycle start/stop seal-in.' },
    { id: 'alarms', name: 'Alarms', description: 'One bit per alarm: faults latch and stop the cycle, Reset clears them once the cause is gone.' },
  ];

  // ---- Safety & modes
  const sp = (role: string, min: number, max: number, def: number, what: string) => {
    const a = tag(role);
    if (a) R('safety', `First scan: ${what} outside ${min}-${max} is loaded with the default ${def}`, [[NO('SC2'), CMP(a, '<', String(min))], [NO('SC2'), CMP(a, '>', String(max))]], [COPY(String(def), a)]);
  };
  for (const a of c.actuators) {
    const key = (a.extend ?? a.run)?.address;
    if (key) sp(`sp:timeout:${key}`, 1, 30, 3, `${a.name} timeout (s)`);
    // A speed below 10% of the range (e.g. 0 Hz from a fresh PLC) counts as not set: load the mid-range default.
    if (a.speedRef) sp(`sp:speed:${a.speedRef.address}`, a.speedRef.min + (a.speedRef.max - a.speedRef.min) * 0.1, a.speedRef.max, Math.round((a.speedRef.min + a.speedRef.max) / 2), `${a.name} speed`);
  }
  for (const an of c.analogs.filter((x) => x.kind === 'input')) {
    const span = an.max - an.min;
    // A high limit in the bottom 10% of the range (0 from a fresh PLC) counts as not set: it would alarm at once.
    sp(`sp:high:${an.address}`, an.min + span * 0.1, an.max, an.min + span * 0.9, `${an.name} high limit`);
    sp(`sp:low:${an.address}`, an.min, an.max, an.min + span * 0.1, `${an.name} low limit`);
  }
  if (c.process?.temp) sp(`sp:temp:${c.process.temp.pv.address}`, c.process.temp.pv.min + 1, c.process.temp.pv.max, c.process.temp.default, `${c.process.temp.pv.name} setpoint`);
  if (c.process?.dwell) sp('sp:dwell', 100, 10000, c.process.dwell.defaultMs, `${c.process.dwell.name} (ms)`);
  sp('sp:batch', 0, 9999, 0, 'batch target');
  sp('sp:serviceinterval', 50, 2000, 500, 'service interval (h)');
  if (c.safetyOk) R('safety', `Safety OK from the safety relay (${c.safetyOk.description})`, [[NO(c.safetyOk.address)]], [OUT(SAFE)]);
  else { R('safety', 'Safety OK: no safety relay input in the I/O list — always ON until one is added (see notes)', [[NO('SC1')]], [OUT(SAFE)]); notes.push('No "Safety OK" input from the safety relay: the program treats safety as always OK. Add the input to the I/O list and regenerate.'); }
  nick(SAFE, 'Safety_OK', 'Safety relay healthy');
  R('safety', 'Reset command: HMI Reset' + (resetPb ? ` or the ${resetPb.description}` : ''), [[NO(reset)], ...(resetPb ? [[NO(resetPb.address)]] : [])], [OUT(RESET)]);
  nick(RESET, 'Cmd_Reset', 'Reset from the HMI or the panel');
  R('safety', 'Manual mode request is refused while the cycle runs: the HMI toggle is reset', [[NO(RUN), NO(manualSel)]], [RST(manualSel)]);
  R('safety', 'Manual mode active: HMI Manual selected and the cycle stopped', [[NO(manualSel), NC(RUN)]], [OUT(manual)]);
  const stopChain = [...(stopPb ? [NO(stopPb.address)] : []), NC(stop), NO(SAFE), NC(FAULT), NC(manual), NC(BATCH)];
  R('safety', `Cycle running: ${startPb ? `${startPb.description} or ` : ''}HMI Start seals in; ${stopPb ? `${stopPb.description} (NC), ` : ''}HMI Stop, safety loss, a fault, Manual mode or batch complete drops it`,
    [...(startPb ? [[RISE(startPb.address), ...stopChain]] : []), [RISE(start), ...stopChain], [NO(RUN), ...stopChain]], [OUT(RUN)]);
  nick(RUN, 'Cycle_Running', 'Automatic cycle running');
  // Two-hand start: Start (HMI / panel) only arms the cycle; each cycle starts with both two-hand buttons, and both
  // must have been released since the last start (anti-tie-down). The two-hand relay enforces the 0.5 s simultaneity.
  const cycleStart: string[] = [];
  let twoHand: string[] | undefined;
  if (c.twoHand?.length) {
    twoHand = c.twoHand.map((p) => p.address);
    const ARM = bit(), GO = bit();
    R('safety', `Two-hand start armed: both buttons released (${twoHand.join(', ')}) — anti-tie-down`, [twoHand.map(NC)], [SET(ARM)]);
    R('safety', `Two-hand start: both buttons pressed after being released, cycle armed by Start`, [[NO(RUN), NO(ARM), ...twoHand.map(NO)]], [OUT(GO)]);
    R('safety', 'Two-hand start used: both buttons must be released before the next cycle', [[NO(GO)]], [RST(ARM)]);
    nick(ARM, 'Two_Hand_Armed', 'Both two-hand buttons released since the last start'); nick(GO, 'Two_Hand_Start', 'Two-hand start (one scan)');
    cycleStart.push(GO);
  }
  if (running !== RUN) R('safety', 'Running status for the HMI', [[NO(RUN)]], [OUT(running)]);

  // ---- Per actuator: request bits, timeouts, faults
  const autoBits: ProgramResult['autoBits'] = [];
  const req = new Map<string, { auto: string; manual?: string }>(); // output address -> request bits
  const faultBits: string[] = [];
  const alarm = (role: string) => tag(role);
  for (const a of c.actuators) {
    const id = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || `act${blocks.length}`;
    blocks.push({ id, name: a.name, description: `${a.name} (${a.kind}): automatic request bits set by the cycle, ${a.kind === 'cylinder' ? 'position timeouts' : a.fault ? 'fault' : 'output'}.` });
    for (const out of [a.run, a.reverse, a.extend, a.retract].filter((p): p is HmiPoint => !!p)) {
      const auto = bit();
      const what = out === a.reverse ? 'reverse' : out === a.retract ? 'retract' : a.kind === 'cylinder' ? 'extend' : 'run';
      nick(auto, `Auto_${a.name}_${what}`, `Automatic ${what} request for ${a.name} (set by the cycle block)`);
      req.set(out.address, { auto });
      if (a.kind !== 'valve' && a.kind !== 'heater') autoBits.push({ actuator: a.name, output: out.address, bit: auto, what });
    }
    if (a.kind === 'cylinder') {
      const key = (a.extend ?? a.run)!.address;
      const fb = feedbackOf(a);
      const sp = tag(`sp:timeout:${key}`) ?? '3';
      const alm = alarm(`alarm:timeout:${key}`);
      const ext = a.extend!.address, ret = a.retract?.address;
      // The HMI may show the extend timeout timer (e.g. TD1 "Push_Timer"): use that timer.
      const shown = tag(`timer:timeout:${key}`);
      const tExt = shown ? `T${shown.slice(2)}` : timer(), tRet = timer();
      // Only while Safety OK: with the air dumped a cylinder may sag, which is not a timeout.
      if (fb.ext) R(id, `${a.name}: extend timeout — valve on but not at ${fb.ext.description} within the setpoint`, [[NO(SAFE), NO(ext), NC(fb.ext.address)]], [TMR(tExt, sp)]);
      if (fb.ret) R(id, `${a.name}: retract timeout — valve${ret ? ` ${ret} on` : ' off'} but not at ${fb.ret.description} within the setpoint`, [[NO(SAFE), ret ? NO(ret) : NC(ext), NC(fb.ret.address)]], [TMR(tRet, sp)]);
      if (alm && (fb.ext || fb.ret)) {
        R('alarms', `${a.name} did not reach its position in time: latched`, [...(fb.ext ? [[NO(tExt)]] : []), ...(fb.ret ? [[NO(tRet)]] : [])], [SET(alm)]);
        R('alarms', `${a.name} timeout reset: Reset once the valve is off`, [[NO(RESET), NC(ext), ...(ret ? [NC(ret)] : [])]], [RST(alm)]);
        faultBits.push(alm);
      }
      nick(tExt, `Tmr_${a.name}_Ext`, `${a.name} extend timeout`); nick(tRet, `Tmr_${a.name}_Ret`, `${a.name} retract timeout`);
    }
    if (a.fault) {
      const alm = alarm(`alarm:fault:${a.fault.address}`);
      if (alm) {
        R('alarms', `${a.name} ${a.kind === 'drive' ? 'drive fault' : 'overload tripped'} (${a.fault.description}): latched`, [[NO(a.fault.address)]], [SET(alm)]);
        R('alarms', `${a.name} fault reset: Reset once ${a.fault.description} is off`, [[NO(RESET), NC(a.fault.address)]], [RST(alm)]);
        faultBits.push(alm);
      }
    }
  }
  for (const ai of c.alarmInputs ?? []) {
    const alm = alarm(`alarm:input:${ai.point.address}`);
    if (!alm) continue;
    const active = ai.activeWhen ? NO(ai.point.address) : NC(ai.point.address), clear = ai.activeWhen ? NC(ai.point.address) : NO(ai.point.address);
    if (ai.severity === 'alarm') {
      R('alarms', `${ai.text} (${ai.point.description} ${ai.activeWhen ? 'ON' : 'OFF'}): latched, stops the cycle`, [[active]], [SET(alm)]);
      R('alarms', `${ai.text} reset: Reset once ${ai.point.description} is ${ai.activeWhen ? 'OFF' : 'ON'} again`, [[NO(RESET), clear]], [RST(alm)]);
      faultBits.push(alm);
    } else R('alarms', `${ai.text} warning while ${ai.point.description} is ${ai.activeWhen ? 'ON' : 'OFF'}`, [[active]], [OUT(alm)]);
  }
  const safetyAlarm = alarm('alarm:safety');
  if (safetyAlarm) R('alarms', 'Safety circuit open alarm while Safety OK is off', [[NC(SAFE)]], [OUT(safetyAlarm)]);
  for (const an of c.analogs.filter((x) => x.kind === 'input')) {
    const hi = tag(`sp:high:${an.address}`), lo = tag(`sp:low:${an.address}`), aHi = alarm(`alarm:high:${an.address}`), aLo = alarm(`alarm:low:${an.address}`);
    if (hi && aHi) R('alarms', `${an.name} high warning: value at or above the high limit`, [[CMP(an.address, '>=', hi)]], [OUT(aHi)]);
    if (lo && aLo) R('alarms', `${an.name} low warning: value at or below the low limit`, [[CMP(an.address, '<=', lo)]], [OUT(aLo)]);
  }
  // Any latched fault stops the cycle.
  R('alarms', `Any fault (stops the cycle): ${faultBits.length ? faultBits.join(', ') : 'none latched yet'}`, faultBits.length ? faultBits.map((f) => [NO(f)]) : [[NC('SC1')]], [OUT(FAULT)]);
  nick(FAULT, 'Any_Fault', 'A latched fault: stops the cycle');

  // ---- Manual: permits and hold-to-run requests
  // Jog-able actuators: the ones the HMI has hold-to-run buttons for (whatever the content says).
  const manualActs = c.actuators.filter((a) => [a.run, a.reverse, a.extend, a.retract].some((o) => o && tag(`jog:${o.address}`)));
  if (manualActs.some((a) => [a.run, a.reverse, a.extend, a.retract].some((o) => o && tag(`jog:${o.address}`)))) {
    blocks.push({ id: 'manual', name: 'Manual', description: 'Permits and hold-to-run requests from the HMI Manual screen.' });
    const allOuts = manualActs.flatMap((a) => [a.run, a.reverse, a.extend, a.retract].filter((p): p is HmiPoint => !!p));
    const earlier: string[] = [];
    for (const a of manualActs) for (const out of [a.run, a.reverse, a.extend, a.retract].filter((p): p is HmiPoint => !!p)) {
      const jog = tag(`jog:${out.address}`), permit = tag(`permit:${out.address}`);
      if (!jog || !permit) continue;
      const others = allOuts.filter((o) => o.address !== out.address && ![a.run, a.reverse, a.extend, a.retract].includes(o)).map((o) => o.address);
      const opposite = out === a.extend ? a.retract : out === a.retract ? a.extend : out === a.run ? a.reverse : out === a.reverse ? a.run : undefined;
      // The HMI button's word ("Jog", "Extend", "Close") from its tag name.
      const word = (byRole.get(`jog:${out.address}`)?.name ?? '').replace(/^HMI_/, '').split('_').slice(-1)[0] || out.description;
      R('manual', `${a.name}: ${word} permitted — Manual mode, Safety OK${others.length ? ', no other motion' : ''}${opposite ? `, ${opposite.description} off` : ''}${a.fault ? ', no fault' : ''}`,
        [[NO(manual), NO(SAFE), ...others.map(NC), ...(opposite ? [NC(opposite.address)] : []), ...(a.fault && alarm(`alarm:fault:${a.fault.address}`) ? [NC(alarm(`alarm:fault:${a.fault.address}`)!)] : [])]], [OUT(permit)]);
      const m = bit();
      R('manual', `${a.name}: manual ${word} (${out.description}) while the HMI button is held and permitted${earlier.length ? ' (an earlier jog has priority)' : ''}`, [[NO(jog), NO(permit), ...earlier.map(NC)]], [OUT(m)]);
      nick(m, `Man_${a.name}_${out.address}`, `Manual request ${out.description}`);
      earlier.push(m);
      req.get(out.address)!.manual = m;
    }
  }

  // ---- Outputs: one coil per output, every motion output gated by Safety OK
  blocks.push({ id: 'outputs', name: 'Outputs', description: 'One coil per output: automatic or manual request, gated by Safety OK and the actuator\'s fault.' });
  for (const a of c.actuators) {
    const faultAlm = a.fault ? alarm(`alarm:fault:${a.fault.address}`) : undefined;
    for (const out of [a.run, a.reverse, a.extend, a.retract].filter((p): p is HmiPoint => !!p)) {
      const r = req.get(out.address)!;
      const opposite = out === a.extend ? a.retract : out === a.retract ? a.extend : out === a.run ? a.reverse : out === a.reverse ? a.run : undefined;
      if (a.kind === 'valve') { R('outputs', `${out.description}: on only while Safety OK (loss of safety exhausts the air)`, [[NO(SAFE)]], [OUT(out.address)]); continue; }
      if (a.kind === 'heater') {
        // Overtemperature: an analog temperature high alarm switches the heater off (a temperature switch is shown as its feedback).
        const overTemp = c.analogs.filter((x) => x.kind === 'input' && /\b(temp\w*)\b/i.test(x.name)).map((x) => alarm(`alarm:high:${x.address}`)).filter((x): x is string => !!x);
        const tc = c.process?.temp, tsp = tc && tc.heater.address === out.address ? tag(`sp:temp:${tc.pv.address}`) : undefined;
        if (tc && tsp) {
          // On / off control with a 2-unit hysteresis on the temperature setpoint (time-proportioned PID is a later refinement).
          const HEAT = bit(), READY = bit(), lo = bit(), hi = bit();
          const bandLo = freeDf(), readyLo = freeDf(), readyHi = freeDf();
          R('outputs', `${a.name}: band limits from the setpoint (heat below SP - 2, ready within SP +/- 5)`, [[NO('SC1')]], [MATH(bandLo, `${tsp} - 2`), MATH(readyLo, `${tsp} - 5`), MATH(readyHi, `${tsp} + 5`)]);
          nick(bandLo, `Heat_On_Below_${a.name}`, 'Heat demand on below'); nick(readyLo, `Ready_Low_${a.name}`, 'Ready band low'); nick(readyHi, `Ready_High_${a.name}`, 'Ready band high');
          R('outputs', `${a.name}: below the setpoint by 2 ${tc.pv.units} or more`, [[CMP(tc.pv.address, '<', bandLo)]], [OUT(lo)]);
          R('outputs', `${a.name}: at or above the setpoint`, [[CMP(tc.pv.address, '>=', tsp)]], [OUT(hi)]);
          R('outputs', `${a.name}: heat demand ON below the band`, [[NO(lo)]], [SET(HEAT)]);
          R('outputs', `${a.name}: heat demand OFF at the setpoint`, [[NO(hi)]], [RST(HEAT)]);
          R('outputs', `${out.description}: heat demand, Safety OK, no fault${overTemp.length ? ', no overtemperature' : ''} (heats while stopped too — confirm)`, [[NO(HEAT), NO(SAFE), NC(FAULT), ...overTemp.map(NC)]], [OUT(out.address)]);
          R('outputs', `${a.name} ready: within 5 ${tc.pv.units} of the setpoint (each cycle waits for it)`, [[CMP(tc.pv.address, '>=', readyLo), CMP(tc.pv.address, '<=', readyHi)]], [OUT(READY)]);
          nick(HEAT, `Heat_${a.name}`, `Heat demand ${a.name}`); nick(READY, `Temp_Ready_${a.name}`, `${a.name} at temperature`); nick(lo, `Temp_Low_${a.name}`, 'Below the band'); nick(hi, `Temp_At_SP_${a.name}`, 'At the setpoint');
          cycleStart.push(READY);
        } else R('outputs', `${out.description}: on while Safety OK and no fault${overTemp.length ? ', off on overtemperature' : ''} (confirm the heater may stay on while stopped)`, [[NO(SAFE), NC(FAULT), ...overTemp.map(NC)]], [OUT(out.address)]);
        continue;
      }
      const gate = [NO(SAFE), ...(faultAlm ? [NC(faultAlm)] : []), ...(opposite ? [NC(opposite.address)] : [])];
      R('outputs', `${out.description}: automatic (cycle running) or manual request, Safety OK${faultAlm ? ', no fault' : ''}${opposite ? `, never with ${opposite.description}` : ''}`,
        [[NO(r.auto), NO(RUN), ...gate], ...(r.manual ? [[NO(r.manual), ...gate]] : [])], [OUT(out.address)]);
    }
    if (a.speedRef) {
      const spd = tag(`sp:speed:${a.speedRef.address}`);
      const runOut = a.run?.address;
      if (spd && runOut) {
        R('outputs', `${a.name} speed reference: the HMI setpoint while running`, [[NO(runOut)]], [COPY(spd, a.speedRef.address)]);
        R('outputs', `${a.name} speed reference: 0 when stopped`, [[NC(runOut)]], [COPY('0', a.speedRef.address)]);
      }
    }
  }
  // Lights and indicators by their words; other outputs are left to the cycle block.
  const actOuts = new Set(c.actuators.flatMap((a) => [a.run, a.reverse, a.extend, a.retract].filter(Boolean).map((p) => p!.address)));
  for (const o of c.io.filter((p) => p.type === 'output' && !actOuts.has(p.address))) {
    const d = o.description;
    if (/\b(fault|alarm|red)\b/i.test(d)) R('outputs', `${d}: any alarm or safety open`, [[NO(FAULT)], [NC(SAFE)]], [OUT(o.address)]);
    else if (/\b(run\w*|green)\b/i.test(d)) R('outputs', `${d}: cycle running`, [[NO(RUN)]], [OUT(o.address)]);
    else if (/\b(amber|yellow|manual|warning)\b/i.test(d)) R('outputs', `${d}: Manual mode`, [[NO(manual)]], [OUT(o.address)]);
    else notes.push(`${o.address} ${d}: no rule drives it; the cycle block (AI) or you must add its rung.`);
  }

  // ---- HMI & status
  blocks.push({ id: 'status', name: 'HMI & status', description: 'Heartbeat, machine state word, counters, run hours, service and rate.' });
  R('status', 'One-scan pulse on each rising edge of the 1 s system clock SC7', [[RISE('SC7')]], [OUT(PULSE)]);
  R('status', 'PLC heartbeat for the HMI: changes state every second', [[NO(PULSE), NC(heartbeat)], [NC(PULSE), NO(heartbeat)]], [OUT(heartbeat)]);
  nick(PULSE, 'Pulse_1s', 'One scan every second');
  // State word: lowest priority first, so the highest applicable state wins.
  const cond = (text: string): LadderElement[] | null => {
    const t = text.toLowerCase();
    if (/^stopped|^idle/.test(t)) return [NO('SC1')];
    if (/^running|^auto/.test(t)) return [NO(RUN)];
    if (/^manual/.test(t)) return [NO(manual)];
    if (/fault|alarm/.test(t)) return [NO(FAULT)];
    if (/safety|e-?stop/.test(t)) return [NC(SAFE)];
    return null;
  };
  const prio = (text: string) => { const t = text.toLowerCase(); return /^stopped|^idle/.test(t) ? 0 : /^running|^auto/.test(t) ? 1 : /^manual/.test(t) ? 3 : /fault|alarm/.test(t) ? 4 : /safety|e-?stop/.test(t) ? 5 : 2; };
  const stepStates: string[] = [];
  for (const s of [...c.states].sort((x, y) => prio(x.text) - prio(y.text))) {
    const k = cond(s.text);
    if (k) R('status', `Machine state ${s.value} ${s.text}${prio(s.text) === 0 ? ' (default, overwritten below by higher states)' : ''}`, [k], [COPY(String(s.value), state)]);
    else stepStates.push(`${s.value} ${s.text}`);
  }
  if (stepStates.length) notes.push(`Machine states ${stepStates.join(', ')} are cycle steps: the cycle block writes them to ${state}.`);
  const count = tag('word:count');
  if (count && c.partSensor) {
    const resetC = must('cmd:countreset');
    R('status', `Part counter: each part at ${c.partSensor.description}, reset from the HMI`, [[NO(c.partSensor.address)]], [{ type: 'CNT', address: `CT${count.slice(3)}`, direction: 'UP', preset: '9999', resetAddress: resetC }]);
    const batch = tag('sp:batch');
    if (batch) { R('status', 'Batch complete: a batch target is set and the part count reached it', [[CMP(batch, '>', '0'), CMP(count, '>=', batch)]], [OUT(BATCH)]); nick(BATCH, 'Batch_Done', 'Batch target reached'); }
    const rate = tag('word:rate');
    if (rate) {
      const tw = timer();
      R('status', 'Rate window timer: 10 s, restarts itself', [[NC(tw)]], [TMR(tw, '10')]);
      R('status', 'Every 10 s: shift the six 10 s buckets and store the parts counted in the last 10 s', [[NO(tw)]],
        [COPY('DS1125', 'DS1126'), COPY('DS1124', 'DS1125'), COPY('DS1123', 'DS1124'), COPY('DS1122', 'DS1123'), COPY('DS1121', 'DS1122'), MATH('DS1121', `${count} - DS1119`), COPY(count, 'DS1119')]);
      R('status', 'A count reset makes the newest bucket negative: count it as 0', [[NO(tw), CMP('DS1121', '<', '0')]], [COPY('0', 'DS1121')]);
      R('status', `Parts per minute ${rate}: the six 10 s buckets`, [[NO(tw)]], [MATH(rate, 'DS1121 + DS1122 + DS1123 + DS1124 + DS1125 + DS1126')]);
      nick(tw, 'Tmr_Rate', '10 s rate window');
    }
  }
  if (!tag('word:count') || !c.partSensor) R('status', 'No batch counting (no part sensor)', [[NC('SC1')]], [OUT(BATCH)]);
  const hours = tag('word:runhours'), since = tag('word:sinceservice'), interval = tag('sp:serviceinterval'), done = tag('cmd:servicedone'), due = alarm('alarm:servicedue');
  if (hours && since) {
    const th = timer();
    R('status', 'Run-hour timer: accumulates while the cycle runs, restarts after each full hour', [[NO(RUN)]], [TMR(th, '3600', 'sec', true, HOUR)]);
    R('status', 'One full run hour reached', [[NO(th)]], [OUT(HOUR)]);
    R('status', 'Add the hour to the run hours and the hours since service', [[NO(HOUR)]], [MATH(hours, `${hours} + 1`), MATH(since, `${since} + 1`)]);
    nick(th, 'Tmr_Run_Hour', 'Run-hour timer'); nick(HOUR, 'Run_Hour_Pulse', 'One run hour reached');
    if (done) R('status', 'HMI Service Done clears the hours since service', [[NO(done)]], [COPY('0', since)]);
    if (due && interval) R('alarms', 'Service due warning: hours since service reached the service interval', [[CMP(since, '>=', interval), CMP(interval, '>', '0')]], [OUT(due)]);
  }

  // HMI tags no role matches: a counter whose description names its output ("counts each Y002 rising edge;
  // reset by C1008") is implemented at the HMI's own address; the rest are reported, never reused.
  const unmatched: HmiTag[] = [];
  const handled = new Set<string>();
  for (const t of inferred.unmatched) {
    const a = t.address.toUpperCase();
    const ctd = /^CTD(\d+)$/.exec(a);
    const y = /\b(Y\d{3})\b/i.exec(t.description)?.[1]?.toUpperCase();
    if (ctd && y && c.io.some((p) => p.address === y)) {
      const rst = /\b(C\d{3,4})\b/.exec(t.description.replace(new RegExp(`\\bC${ctd[1]}\\b`), ''))?.[1]?.toUpperCase();
      R('status', `${t.name}: counts each time ${y} turns on (HMI counter ${a})${rst ? `, reset by ${rst}` : ''}`, [[NO(y)]], [{ type: 'CNT', address: `CT${ctd[1]}`, direction: 'UP', preset: '32767', resetAddress: rst ?? null }]);
      handled.add(a); if (rst) handled.add(rst);
    }
  }
  for (const t of inferred.unmatched) if (!handled.has(t.address.toUpperCase()) && t.address.toUpperCase() !== SAFE && t.address.toUpperCase() !== RUN) unmatched.push(t);
  if (unmatched.length) notes.push(`HMI tags the program does not implement (they would stay 0 / do nothing — change them on the HMI or add the logic): ${unmatched.map((t) => `${t.address} ${t.name}`).join(', ')}.`);

  // The cycle block (AI) goes between the actuator blocks and Manual; until then the auto requests stay off.
  blocks.splice(2, 0, { id: 'cycle', name: 'Cycle', description: 'The machine\'s automatic sequence: sets the automatic request bits while the cycle runs.' });
  // Default cycle (no AI): motors and drives run while the cycle runs; cylinders wait for the real sequence.
  const runBits = autoBits.filter((b) => b.what === 'run');
  const idle = autoBits.filter((b) => b.what !== 'run');
  if (runBits.length) R('cycle', `Default cycle: ${runBits.map((b) => b.actuator).join(', ')} run${runBits.length > 1 ? '' : 's'} whenever the cycle runs (the machine's own sequence replaces this)`, [[NO(RUN)]], runBits.map((b) => OUT(b.bit)));
  if (idle.length) R('cycle', `Automatic sequence not written yet: ${idle.map((b) => `${b.actuator} ${b.what}`).join(', ')} stay off in Auto (the AI or you write this block)`, [[NC('SC1')]], idle.map((b) => OUT(b.bit)));
  if (idle.length) notes.push(`The automatic sequence for ${[...new Set(idle.map((b) => b.actuator))].join(', ')} is not written yet: those actuators move only in Manual until the cycle block is written.`);

  // Rungs in block order (the program reads top to bottom).
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  rungs.sort((x, y) => (order.get(x.block ?? '') ?? 99) - (order.get(y.block ?? '') ?? 99));
  return {
    program: { blocks: blocks.filter((b) => rungs.some((r) => r.block === b.id)), rungs, tags },
    autoBits,
    roles: new Map([...byRole].map(([k, t]) => [k, t.address])),
    internal: { safe: SAFE, run: RUN, fault: FAULT, reset: RESET },
    taken,
    unmatched,
    cycle: {
      startConds: cycleStart, ...(twoHand ? { twoHand } : {}), ...(tag('sp:dwell') ? { dwellSp: tag('sp:dwell') } : {}),
      ...(twoHand ? { closing: c.actuators.find((a) => a.kind === 'cylinder' && /\b(down|close|closing|lower|clamp|press)\b/i.test(a.extend?.description ?? ''))?.name } : {}),
    },
    free: { bits: `C${Math.max(nextBit, 60)}-C99`, steps: 'DS1150-DS1159', timers: `T${nextTimer + 10}-T${nextTimer + 29}` },
    notes,
  };
}
