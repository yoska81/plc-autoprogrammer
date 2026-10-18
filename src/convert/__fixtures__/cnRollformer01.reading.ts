/**
 * What a correct reading of cn-rollformer-01 (HC-YX840-E01 rev B) looks like: the mocked AI answer for
 * the tests, written from the facts in cnRollformer01.facts.ts. Relay logic C1–C11 as circuits, no PLC,
 * a PNOZ s3 safety relay but no STO on either drive.
 */
import type { DrawnRatings, ExistingMachine } from '../types';

const r = (x: Partial<DrawnRatings> = {}): DrawnRatings => ({ amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null, ...x });
type Comp = ExistingMachine['components'][number];
const C = (tag: string, description: string, category: Comp['category'], source: string, more: Partial<Comp> = {}): Comp =>
  ({ tag, partNumber: null, manufacturer: null, description, category, ratings: r(), confidence: 'high', source, ...more });
type IO = ExistingMachine['io'][number];
const I = (deviceTag: string, address: string, description: string, deviceType: IO['deviceType'], category: IO['category'], source: string): IO =>
  ({ address, description, type: 'input', category, deviceTag, deviceType, confidence: 'high', source });
const O = (deviceTag: string, address: string, description: string, deviceType: IO['deviceType'], category: IO['category'], source: string): IO =>
  ({ address, description, type: 'output', category, deviceTag, deviceType, confidence: 'high', source });
type Circuit = ExistingMachine['circuits'][number];
const K = (output: string, fn: string, kind: Circuit['kind'], conditions: string[], devices: string[], source: string, more: Partial<Circuit> = {}): Circuit =>
  ({ output, function: fn, kind, conditions, devices, setting: null, logicIn: 'relays', confidence: 'high', source, ...more });

export const CN_ROLLFORMER_01_READING: ExistingMachine = {
  summary: 'Roll-forming line HC-YX840-E01: a 5.5 kW forming motor on a Delta VFD, a 2.2 kW hydraulic pump, and a 1.5 kW Delta servo flying shear (E-CAM) following a measuring-wheel encoder. No PLC: relay logic KA1–KA10, a cut watchdog timer and a batch counter, with a Pilz PNOZ s3 safety relay.',
  drawingStandard: 'GB',
  language: 'Chinese / English',
  plc: null,
  modules: [],
  supply: null,
  supplyDrawn: { volts: 380, hz: 50, phases: 3, text: '380 V 3P+N+PE 50 Hz TN-S at XT0, 5×10 mm²' },
  io: [
    I('SB0', 'KA0 S11-S12 / S21-S22', 'E-stop, operator desk (急停)', 'estop-contact', 'Safety', 'sheet 4'),
    I('SB10', 'KA0 S11-S12 / S21-S22', 'E-stop, run-out (急停)', 'estop-contact', 'Safety', 'sheet 4'),
    I('SQ5', 'KA0 S11-S12 / S21-S22', 'Shear guard switch (剪切防护)', 'limit-switch', 'Safety', 'sheet 4'),
    I('SB9', 'KA0 S33-S34 / U2 DI5', 'Reset (复位): safety relay and servo alarm reset', 'pushbutton-no', 'Safety', 'sheet 4'),
    I('SB1', 'KM1 coil', 'Pump start (油泵启动)', 'pushbutton-no', 'Operator/HMI', 'sheet 3'),
    I('SB2', 'KM1 coil', 'Pump stop (油泵停止)', 'pushbutton-nc', 'Operator/HMI', 'sheet 3'),
    I('SB3', 'KA1 coil', 'Line start (运行)', 'pushbutton-no', 'Operator/HMI', 'sheet 5'),
    I('SB4', 'KA1 coil', 'Line stop (停止)', 'pushbutton-nc', 'Operator/HMI', 'sheet 5'),
    I('SB5', 'KA2 coil', 'Jog forward (点动正转)', 'pushbutton-no', 'Operator/HMI', 'sheet 5'),
    I('SB6', 'KA3 coil', 'Jog reverse (点动反转)', 'pushbutton-no', 'Operator/HMI', 'sheet 5'),
    I('SB7', 'YV1 (wire 341)', 'Manual cut, line stopped only (手动剪切)', 'pushbutton-no', 'Operator/HMI', 'sheet 5'),
    I('SB8', 'H7CX RST', 'Counter reset (计数复位)', 'pushbutton-no', 'Operator/HMI', 'sheet 6'),
    I('SA1', 'KA4 coil', 'Servo enable selector (伺服使能)', 'selector', 'Servo/Axis', 'sheet 6'),
    I('SQ1', 'KA8 coil', 'Shear down limit (下限位)', 'limit-switch', 'Station 1', 'sheet 6'),
    I('SQ2', 'KA8 coil', 'Shear up limit (上限位)', 'limit-switch', 'Station 1', 'sheet 6'),
    I('SQ3', 'KA9 coil', 'Run-out end photo eye, NPN (出料到位)', 'sensor-npn', 'Product Detection', 'sheet 5'),
    I('SQ4', 'KA10 coil', 'Entry inductive sensor, NPN (有料检测)', 'sensor-npn', 'Product Detection', 'sheet 5'),
    I('B1', 'U2 CN5', 'Measuring-wheel encoder 1000 ppr, line driver', 'other', 'Servo/Axis', 'sheet 6'),
    I('U1', 'U1 RA/RB/RC', 'VFD relay output: healthy (RB-RC) / fault (RA-RC)', 'other', 'Conveyor', 'sheet 4'),
    I('U2', 'U2 DO1 / DO3 / DO5', 'Servo outputs: ready (DO1), cut (DO3), alarm (DO5)', 'other', 'Servo/Axis', 'sheet 6'),
    I('H7CX', 'H7CX OUT', 'Batch counter output: batch complete', 'other', 'Station 1', 'sheet 6'),
    O('HL1', 'HL1', 'Power on lamp', 'pilot-light', 'Operator/HMI', 'sheet 4'),
    O('HL2', 'KM1 63-64', 'Pump running lamp', 'pilot-light', 'Operator/HMI', 'sheet 4'),
    O('HL3', 'KA1 coil', 'Line running lamp', 'pilot-light', 'Operator/HMI', 'sheet 5'),
    O('HL4', 'KA6 21-24 / U1 RA-RC', 'Fault lamp', 'pilot-light', 'Operator/HMI', 'sheet 4'),
    O('HL5', 'H7CX OUT NO', 'Batch complete lamp', 'pilot-light', 'Operator/HMI', 'sheet 6'),
    O('YV1', 'KA7 / SB7', 'Shear down valve (剪切下)', 'solenoid', 'Station 1', 'sheet 6'),
    O('YV2', 'KA8 31-34', 'Shear up valve (剪切上)', 'solenoid', 'Station 1', 'sheet 6'),
  ],
  components: [
    C('QF0', 'Main switch 4P 40 A', 'disconnect', 'sheet 2', { manufacturer: 'CHINT', partNumber: 'NH2-125', ratings: r({ poles: 4, amps: 40 }) }),
    C('QF1', 'VFD breaker 3P C25', 'breaker', 'sheet 2', { manufacturer: 'CHINT', partNumber: 'NXB-63', ratings: r({ poles: 3, amps: 25, curve: 'C' }) }),
    C('QF2', 'Pump breaker 3P C10', 'breaker', 'sheet 2', { manufacturer: 'CHINT', partNumber: 'NXB-63', ratings: r({ poles: 3, amps: 10, curve: 'C' }) }),
    C('QF3', 'Servo breaker 2P C16', 'breaker', 'sheet 2', { manufacturer: 'CHINT', partNumber: 'NXB-63', ratings: r({ poles: 2, amps: 16, curve: 'C' }) }),
    C('QF5', 'Control breaker 220 VAC', 'breaker', 'sheet 2'),
    C('U1', 'VFD 5.5 kW for M1', 'vfd', 'sheet 3', { manufacturer: 'Delta', partNumber: 'VFD055E43A', ratings: r({ kw: 5.5 }) }),
    C('R1', 'Braking resistor for U1', 'other', 'sheet 3', { manufacturer: 'Delta', partNumber: 'BR1K0W075' }),
    C('U2', 'Servo drive 1.5 kW, E-CAM flying shear', 'other', 'sheet 3', { manufacturer: 'Delta', partNumber: 'ASD-A2-1521-L', ratings: r({ kw: 1.5 }) }),
    C('B1', 'Encoder 1000 ppr line driver', 'other', 'sheet 6', { manufacturer: 'Autonics', partNumber: 'E50S8-1000-6-L-5' }),
    C('KM1', 'Pump contactor, AC220V coil', 'contactor', 'sheet 3', { manufacturer: 'CHINT', partNumber: 'NXC-12', ratings: r({ coilVoltage: '220VAC', poles: 3, amps: 12 }) }),
    C('FR1', 'Pump overload 4–6 A, set 5 A', 'overload', 'sheet 3', { manufacturer: 'CHINT', partNumber: 'NXR-12', ratings: r({ minAmps: 4, maxAmps: 6 }) }),
    C('G1', '24 VDC power supply 120 W', 'powerSupply', 'sheet 2', { manufacturer: 'Mean Well', partNumber: 'NDR-120-24', ratings: r({ outputVolts: 24, outputAmps: 5 }) }),
    C('KA0', 'Safety relay', 'safetyRelay', 'sheet 4', { manufacturer: 'Pilz', partNumber: 'PNOZ s3' }),
    ...['KA1 Line run', 'KA2 Jog forward', 'KA3 Jog reverse', 'KA4 Servo ON', 'KA5 Servo ready', 'KA6 Servo alarm', 'KA7 Cut command', 'KA8 Cut return latch', 'KA9 Run-out overrun', 'KA10 Material present']
      .map((t) => C(t.split(' ')[0], `Relay 24 VDC: ${t.slice(t.indexOf(' ') + 1)}`, 'relay', 'sheets 5–6', { ratings: r({ coilVoltage: '24VDC' }) })),
    C('KT1', 'Cut watchdog timer 2 s', 'relay', 'sheet 6', { ratings: r({ coilVoltage: '24VDC' }) }),
    C('H7CX', 'Batch counter', 'other', 'sheet 6', { manufacturer: 'Omron', partNumber: 'H7CX-A4D' }),
    C('SB0', 'E-stop 2NC', 'estop', 'sheet 4', { manufacturer: 'Schneider', partNumber: 'XB2BS542' }),
    C('SB10', 'E-stop 2NC', 'estop', 'sheet 4', { manufacturer: 'Schneider', partNumber: 'XB2BS542' }),
    C('SQ5', 'Guard switch 2NC', 'sensor', 'sheet 4', { manufacturer: 'Schneider', partNumber: 'XCSPA791' }),
    C('YV1', 'Shear down valve', 'solenoidValve', 'sheet 6'),
    C('YV2', 'Shear up valve', 'solenoidValve', 'sheet 6'),
  ],
  motors: [
    { tag: 'M1', description: 'Forming motor YE3-132S-4 on VFD U1', kw: 5.5, hp: null, starter: 'vfd', reversing: true, kind: 'induction', confidence: 'high', source: 'sheet 3' },
    { tag: 'M2', description: 'Hydraulic pump, DOL on KM1', kw: 2.2, hp: null, starter: 'contactor-overload', reversing: false, kind: 'induction', confidence: 'high', source: 'sheet 3' },
    { tag: 'M3', description: 'Flying shear servo motor ECMA-E21315RS', kw: 1.5, hp: null, starter: null, reversing: true, kind: 'servo', confidence: 'high', source: 'sheet 3' },
  ],
  circuits: [
    K('KM1', 'Hydraulic pump: start SB1, stop SB2, held by KM1 13-14, only with the safety relay KA0 closed and the overload FR1 healthy', 'start-stop', ['KA0 13-14 (NO)', 'SB2 stop (NC)', 'SB1 start (NO) ∥ KM1 13-14 self-hold', 'FR1 95-96 (NC)'], ['KA0', 'SB2', 'SB1', 'KM1', 'FR1'], 'sheet 3 (C1)', { sealIn: 'KM1 13-14' }),
    K('KA1', 'Line run: start SB3, stop SB4, held by KA1 11-14; needs pump running, servo ready, no servo alarm, VFD healthy, cut watchdog OK, batch not complete, no overrun, material present', 'start-stop',
      ['SB4 stop (NC)', 'KM1 53-54 pump running (NO)', 'KA5 11-14 servo ready (NO)', 'KA6 11-12 no servo alarm (NC)', 'U1 RB-RC VFD healthy', 'KT1 15-16 cut watchdog (NC)', 'H7CX OUT batch not complete (NC)', 'KA9 11-12 no overrun (NC)', 'KA10 11-14 material present (NO)', 'SB3 start (NO) ∥ KA1 11-14 self-hold'],
      ['SB4', 'KM1', 'KA5', 'KA6', 'U1', 'KT1', 'H7CX', 'KA9', 'KA10', 'SB3', 'KA1', 'HL3'], 'sheet 5 (C2)', { sealIn: 'KA1 11-14' }),
    K('KA2', 'Jog forward while the line is stopped, interlocked with jog reverse', 'interlock', ['KA1 41-42 line not running (NC)', 'SB5 jog forward (NO)', 'KA3 11-12 (NC)'], ['KA1', 'SB5', 'KA3'], 'sheet 5 (C3)'),
    K('KA3', 'Jog reverse while the line is stopped, interlocked with jog forward', 'interlock', ['KA1 41-42 line not running (NC)', 'SB6 jog reverse (NO)', 'KA2 11-12 (NC)'], ['KA1', 'SB6', 'KA2'], 'sheet 5 (C3)'),
    K('KA4', 'Servo ON from the selector SA1; KA4 11-14 switches U2 DI1 SON', 'other', ['SA1 servo enable'], ['SA1', 'KA4', 'U2'], 'sheet 6 (C4)'),
    K('KA9', 'Run-out overrun from the photo eye SQ3', 'other', ['SQ3 run-out end'], ['SQ3', 'KA9'], 'sheet 5 (C5)'),
    K('KA10', 'Material present from the entry sensor SQ4', 'other', ['SQ4 entry sensor'], ['SQ4', 'KA10'], 'sheet 5 (C5)'),
    K('KA5', 'Servo ready from U2 DO1 SRDY', 'other', ['U2 DO1 SRDY'], ['U2', 'KA5'], 'sheet 6 (C6)'),
    K('KA6', 'Servo alarm from U2 DO5 ALRM', 'other', ['U2 DO5 ALRM'], ['U2', 'KA6'], 'sheet 6 (C6)'),
    K('KA7', 'Cut command from U2 DO3 (E-CAM cut point)', 'drive-logic', ['U2 DO3'], ['U2', 'KA7'], 'sheet 6 (C6)', { logicIn: 'drive' }),
    K('YV1', 'Shear down from the cut command or manual cut, until the cut return latch KA8', 'sequence', ['KA7 11-14 cut (NO) ∥ SB7 manual cut (wire 341)', 'KA8 11-12 (NC)'], ['KA7', 'SB7', 'KA8', 'YV1'], 'sheet 6 (C7)'),
    K('KT1', 'Cut watchdog: shear down longer than 2 s opens the line run circuit', 'timer', ['KA7 11-14 ∥ SB7', 'KA8 11-12 (NC)'], ['KA7', 'SB7', 'KA8', 'KT1'], 'sheet 6 (C7)', { setting: 'KT1 on-delay 2 s, contact 15-16 NC in KA1' }),
    K('KA8', 'Cut return latch: SQ1 at the bottom sets it, held by KA8 21-24 until SQ2 at the top', 'sequence', ['SQ1 shear down (NO) ∥ KA8 21-24 self-hold', 'SQ2 shear up (NC)'], ['SQ1', 'KA8', 'SQ2'], 'sheet 6 (C8)', { sealIn: 'KA8 21-24' }),
    K('YV2', 'Shear up while the return latch KA8 is set', 'sequence', ['KA8 31-34 (NO)'], ['KA8', 'YV2'], 'sheet 6 (C8)'),
    K('H7CX', 'Batch counter: counts cuts (KA8 41-44 to CP1), reset SB8; OUT NC stops the line, OUT NO lights HL5', 'counter', ['KA8 41-44 to CP1', 'SB8 to RST'], ['KA8', 'SB8', 'H7CX', 'HL5'], 'sheet 6 (C9)', { setting: 'batch quantity on the H7CX' }),
    K('HL4', 'Fault lamp: servo alarm or VFD fault', 'other', ['KA6 21-24 ∥ U1 RA-RC'], ['KA6', 'U1', 'HL4'], 'sheet 4 (C10)'),
    K('U1 MI1', 'VFD forward from line run or jog forward; MI2 reverse from jog reverse; MI3 jog speed from either jog', 'drive-logic', ['KA1 21-24 ∥ KA2 21-24 → MI1', 'KA3 21-24 → MI2', 'KA2 31-34 ∥ KA3 31-34 → MI3'], ['KA1', 'KA2', 'KA3', 'U1'], 'sheet 4 (C11)'),
    K('U2', 'Flying shear: E-CAM follows the measuring wheel B1 and cuts at the set length (300–6000 mm)', 'length', ['KA4 → DI1 SON', 'SB9 23-24 → DI5 ARST', 'KA1 31-34 → DI7 CAM engage', 'B1 → CN5'], ['KA4', 'SB9', 'KA1', 'B1', 'U2'], 'sheet 6', { logicIn: 'drive', setting: 'cut length 300–6000 mm in the drive' }),
  ],
  axes: [
    { tag: 'A1', description: 'Flying shear carriage (E-CAM): ball screw 20 mm lead, 500 mm stroke', driveTag: 'U2', drivePart: 'Delta ASD-A2-1521-L', motorTag: 'M3', motorKw: 1.5, encoder: 'measuring-wheel encoder B1 (200 mm wheel, 1000 ppr) on CN5', brakingResistor: null, signals: ['DI1 SON', 'DI5 ARST', 'DI7 CAM', 'DO1 SRDY', 'DO3 cut', 'DO5 ALRM'], confidence: 'high', source: 'sheet 6' },
  ],
  controller: 'relays',
  interlocks: [
    { description: 'Jog forward and jog reverse are cross-interlocked and work only with the line stopped', devices: ['KA2', 'KA3', 'KA1'] },
    { description: 'Manual cut SB7 only with the line stopped', devices: ['SB7', 'KA1'] },
  ],
  safety: {
    estops: ['SB0', 'SB10'], guards: ['SQ5'], safetyRelay: 'KA0 Pilz PNOZ s3', category: 'Cat 3 / PL d (claimed)', kind: 'safety-relay',
    description: 'SB0, SB10 and SQ5 in both channels of KA0; KA0 13-14 opens the KM1 coil, KA0 23-24 removes 24VS from the relays and valves. Manual monitored reset SB9 with KM1 feedback.',
    drives: [{ tag: 'U1', sto: 'none', stopsBy: 'single KA1 contact on MI1 (run command)' }, { tag: 'U2', sto: 'not-wired', stopsBy: 'single KA4 contact on DI1 SON' }],
  },
  spec: {
    overview: 'Roll-forming line with a servo flying shear cutting to length (300–6000 mm), a hydraulic shear and a batch counter.',
    sequence: 'Pump on (SB1), then line start (SB3) when the servo is ready and material is present; the servo follows the strip on its E-CAM and cuts at the set length; the shear returns on SQ1/SQ2; the counter stops the line at the batch quantity.',
    safety: 'Two E-stops and the shear guard on a Pilz PNOZ s3 (claimed Cat 3 / PL d).', guarding: 'Shear guard SQ5.', homing: '', modes: 'Run, jog forward / reverse, manual cut with the line stopped.',
    motion: 'Flying shear on Delta ASD-A2 E-CAM, master encoder B1 on a 200 mm wheel; cut length 300–6000 mm; line speed up to 30 m/min.',
    pneumatics: 'Hydraulic shear valves YV1 (down) and YV2 (up).', sensing: 'SQ1/SQ2 shear limits, SQ3 run-out photo eye, SQ4 entry sensor.', operator: 'SB1–SB9, SA1, lamps HL1–HL5.',
    alarms: 'Servo alarm, VFD fault (HL4), cut watchdog KT1.', utilities: '380 V 3P+N+PE 50 Hz; 220 VAC control; 24 VDC from G1.', other: '',
  },
  questions: [],
  uncertainties: [],
};
