/**
 * A machine without a PLC: a conveyor and a lubrication pump run by relays and a timer (Chinese GB
 * drawing). Start/stop with a seal-in, an end-of-travel limit switch, a pump started 5 s after the
 * conveyor by KT1, a run lamp. Used by the unit tests for "keep the relay logic" and "move it into a PLC".
 */
import type { DrawnRatings, ExistingMachine } from '../types';

const r = (x: Partial<DrawnRatings> = {}): DrawnRatings => ({ amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null, ...x });
const C = (tag: string, description: string, category: ExistingMachine['components'][number]['category'], ratings: DrawnRatings = r()) =>
  ({ tag, partNumber: null, manufacturer: null, description, category, ratings, confidence: 'high' as const, source: 'sheet 2' });

export const RELAY_CONVEYOR: ExistingMachine = {
  summary: 'Conveyor with a lubrication pump, run by relay logic: start / stop with a seal-in, a limit switch at the end of travel, the pump started 5 s after the conveyor.',
  drawingStandard: 'GB',
  language: 'Chinese',
  plc: null,
  modules: [],
  supply: null,
  supplyDrawn: { volts: 380, hz: 50, phases: 3, text: '3N~380V 50Hz' },
  io: [],
  components: [
    C('QF1', 'Main breaker 3P 16 A', 'breaker', r({ amps: 16, poles: 3 })),
    C('KM1', 'Conveyor contactor, coil 220 VAC', 'contactor', r({ coilVoltage: '220VAC', poles: 3, amps: 9 })),
    C('KM2', 'Pump contactor, coil 220 VAC', 'contactor', r({ coilVoltage: '220VAC', poles: 3, amps: 9 })),
    C('KT1', 'On-delay timer relay 220 VAC (时间继电器)', 'relay', r({ coilVoltage: '220VAC' })),
    C('SB1', 'Stop button (停止)', 'pushbutton'),
    C('SB2', 'Start button (启动)', 'pushbutton'),
    C('SQ1', 'End-of-travel limit switch (限位)', 'sensor'),
    C('HL1', 'Run lamp (运行)', 'pilotLight'),
  ],
  motors: [
    { tag: 'M1', description: 'Conveyor motor', kw: 1.5, hp: null, starter: 'contactor-overload', reversing: false, kind: 'induction', confidence: 'high', source: 'sheet 1' },
    { tag: 'M2', description: 'Lubrication pump', kw: 0.37, hp: null, starter: 'contactor-overload', reversing: false, kind: 'induction', confidence: 'high', source: 'sheet 1' },
  ],
  circuits: [
    { output: 'KM1', function: 'Conveyor runs from start SB2 until stop SB1 or the end-of-travel limit SQ1, held in by its seal-in', kind: 'start-stop', conditions: ['SB1 stop (NC)', 'SQ1 end of travel (NC)', 'SB2 start (NO)', 'KM1 seal-in (NO) across SB2'], devices: ['SB1', 'SQ1', 'SB2', 'KM1'], setting: null, logicIn: 'relays', confidence: 'high', source: 'sheet 2, line 3' },
    { output: 'KT1', function: 'Timer starts when the conveyor runs', kind: 'timer', conditions: ['KM1 aux (NO)'], devices: ['KM1', 'KT1'], setting: 'KT1 on-delay 5 s', logicIn: 'relays', confidence: 'high', source: 'sheet 2, line 5' },
    { output: 'KM2', function: 'Pump runs 5 s after the conveyor starts', kind: 'timer', conditions: ['KT1 delayed contact (NO)'], devices: ['KT1', 'KM2'], setting: 'KT1 on-delay 5 s', logicIn: 'relays', confidence: 'high', source: 'sheet 2, line 6' },
    { output: 'HL1', function: 'Run lamp on while the conveyor runs', kind: 'other', conditions: ['KM1 aux (NO)'], devices: ['KM1', 'HL1'], setting: null, logicIn: 'relays', confidence: 'high', source: 'sheet 2, line 7' },
  ],
  axes: [],
  controller: 'relays',
  interlocks: [],
  safety: { estops: [], guards: [], safetyRelay: null, category: null, kind: 'hardwired', description: 'The stop button opens the control circuit.', drives: [] },
  spec: {
    overview: 'Conveyor with a lubrication pump, run by relays.',
    utilities: '', safety: '', guarding: '', homing: '', modes: '', sequence: 'Start SB2 runs the conveyor; the pump follows after 5 s; stop SB1 or limit SQ1 stops it.', motion: '', pneumatics: '', sensing: '', operator: '', alarms: '', other: '',
  },
  questions: [],
  uncertainties: [],
};
