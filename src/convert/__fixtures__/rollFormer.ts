/**
 * The acceptance case (mirrors a real drawing a user sent): "5.5成型机1.5追剪切断", a roll-forming machine
 * with a 5.5 kW main motor on a VFD and a 1.5 kW servo flying shear (chase cut), drawn as one DWG with
 * six sheets side by side in model space. There is no PLC: the servo drive's built-in controller and a
 * touch panel run it. The E-stop only goes into a VFD input (not a safety circuit). One sheet title says
 * 220 V, the power sheet shows 3-phase + N: the supply is a question. This is what a good AI reads from
 * e2e/fixtures/convert/roll-former.dxf; e2e/convert.e2e.cjs uses it as the mocked answer.
 */
import type { ExistingMachine } from '../types';

const r = (o: Partial<ExistingMachine['components'][number]['ratings']> = {}) => ({ amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null, ...o });

export const ROLL_FORMER: ExistingMachine = {
  summary: 'Roll-forming machine with a flying shear (5.5成型机1.5追剪切断): a 5.5 kW forming motor on a VFD pulls the strip through the rolls, a 1.5 kW servo chases the strip and a hydraulic cutter cuts it to length, measured by a line-length encoder. No PLC: the servo drive\'s built-in controller and a 24 V touch panel run the machine.',
  drawingStandard: 'GB',
  language: 'Chinese',
  plc: null,
  modules: [],
  supply: null,
  supplyDrawn: { volts: 380, hz: 50, phases: 3, text: '3-phase + N, QF1 4P, 10 mm² (one sheet title says 220V)' },
  io: [
    { address: 'VFD DI3', description: 'Emergency stop (急停)', type: 'input', category: 'Safety', deviceTag: 'SB3', deviceType: 'estop-contact', confidence: 'high', source: 'sheet 6, operator panel' },
    { address: 'KM1 coil', description: 'Main power start (启动)', type: 'input', category: 'Operator/HMI', deviceTag: 'SB2', deviceType: 'pushbutton-no', confidence: 'high', source: 'sheet 1, column 4' },
    { address: 'KM1 coil ', description: 'Main power stop (停止)', type: 'input', category: 'Operator/HMI', deviceTag: 'SB1', deviceType: 'pushbutton-nc', confidence: 'high', source: 'sheet 1, column 4' },
    { address: 'VFD DI1', description: 'Forming forward (SA1 正转)', type: 'input', category: 'Operator/HMI', deviceTag: 'SA1', deviceType: 'selector', confidence: 'high', source: 'sheet 6, SA1' },
    { address: 'VFD DI2', description: 'Forming reverse (SA1 反转)', type: 'input', category: 'Operator/HMI', deviceTag: 'SA1', deviceType: 'selector', confidence: 'high', source: 'sheet 6, SA1' },
    { address: 'Servo CN1-19', description: 'Servo enable (使能) switch', type: 'input', category: 'Servo/Axis', deviceTag: 'SA2', deviceType: 'selector', confidence: 'high', source: 'sheet 3, CN1-19' },
    { address: 'SA4', description: 'Cutting on (剪切) switch, starts the oil pump', type: 'input', category: 'Operator/HMI', deviceTag: 'SA4', deviceType: 'selector', confidence: 'high', source: 'sheet 6, SA4' },
    { address: 'SA3', description: 'Control power on (电源) switch', type: 'input', category: 'Operator/HMI', deviceTag: 'SA3', deviceType: 'selector', confidence: 'high', source: 'sheet 6, SA3' },
    { address: 'Servo CN1-21', description: 'Shear origin (原点信号)', type: 'input', category: 'Servo/Axis', deviceTag: null, deviceType: 'sensor-pnp', confidence: 'medium', source: 'sheet 3, CN1-21' },
    { address: 'Servo CN1-6', description: 'Servo alarm (报警输出)', type: 'input', category: 'Servo/Axis', deviceTag: 'SD1', deviceType: 'other', confidence: 'high', source: 'sheet 3, CN1-6' },
    { address: 'Pendant yellow', description: 'Pendant forward (遥控正转)', type: 'input', category: 'Operator/HMI', deviceTag: null, deviceType: 'pushbutton-no', confidence: 'medium', source: 'sheet 5, pendant cable' },
    { address: 'Pendant green', description: 'Pendant reverse (遥控反转)', type: 'input', category: 'Operator/HMI', deviceTag: null, deviceType: 'pushbutton-no', confidence: 'low', source: 'sheet 5, pendant cable (colour partly legible)' },
    { address: 'Servo CN1-17', description: 'Cutter down (刀下) via relay KA1 to valve YV1', type: 'output', category: 'Station 1', deviceTag: 'KA1', deviceType: 'relay-coil', confidence: 'high', source: 'sheet 3, CN1-17' },
    { address: 'Servo CN1-1', description: 'Cutter up (刀上) via relay KA2 to valve YV2', type: 'output', category: 'Station 1', deviceTag: 'KA2', deviceType: 'relay-coil', confidence: 'high', source: 'sheet 3, CN1-1' },
    { address: 'KM2 coil', description: 'Oil pump contactor (油泵)', type: 'output', category: 'Station 1', deviceTag: 'KM2', deviceType: 'contactor-coil', confidence: 'high', source: 'sheet 2, column 5' },
    { address: 'VFD run', description: 'Forming motor run (VFD forward / reverse)', type: 'output', category: 'Conveyor', deviceTag: 'VF1', deviceType: 'vfd-input', confidence: 'medium', source: 'sheet 2, VFD' },
  ],
  components: [
    { tag: 'QF1', partNumber: null, manufacturer: null, description: 'Main breaker 4P (总开关), 10 mm² incoming', category: 'breaker', ratings: r({ poles: 4 }), confidence: 'high', source: 'sheet 1, column 1' },
    { tag: 'KM1', partNumber: null, manufacturer: null, description: 'Main contactor, coil 230 V L11-N1, start SB2 / stop SB1 with seal-in', category: 'contactor', ratings: r({ coilVoltage: '230VAC', poles: 3 }), confidence: 'high', source: 'sheet 1, column 4' },
    { tag: 'VF1', partNumber: null, manufacturer: null, description: 'VFD 5.5 kW for the forming motor (变频器), speed pot on AI1', category: 'vfd', ratings: r({ kw: 5.5 }), confidence: 'high', source: 'sheet 2, column 2' },
    { tag: 'KM2', partNumber: null, manufacturer: null, description: 'Oil pump contactor, coil 230 V via SA4 + seal-in', category: 'contactor', ratings: r({ coilVoltage: '230VAC', poles: 3 }), confidence: 'high', source: 'sheet 2, column 5' },
    { tag: 'SD1', partNumber: null, manufacturer: null, description: 'Servo drive for the flying shear (伺服驱动器), built-in controller', category: 'other', ratings: r({ kw: 1.5 }), confidence: 'high', source: 'sheet 3' },
    { tag: 'R1', partNumber: null, manufacturer: null, description: 'Braking resistor on P/C (制动电阻)', category: 'other', ratings: r(), confidence: 'high', source: 'sheet 3, P/C' },
    { tag: 'PG1', partNumber: null, manufacturer: null, description: 'Line-length encoder, phase A/B to CN1-11/13 (编码器)', category: 'other', ratings: r(), confidence: 'high', source: 'sheet 3, CN1-11/13' },
    { tag: 'PS1', partNumber: null, manufacturer: null, description: '24 V 100 W power supply from L21-N1', category: 'powerSupply', ratings: r({ outputVolts: 24, outputAmps: 4.2 }), confidence: 'high', source: 'sheet 4' },
    { tag: 'KA1', partNumber: null, manufacturer: null, description: 'Relay 24 V, cutter down (switches L11 230 V to valve 100)', category: 'relay', ratings: r({ coilVoltage: '24VDC' }), confidence: 'high', source: 'sheet 4' },
    { tag: 'KA2', partNumber: null, manufacturer: null, description: 'Relay 24 V, cutter up (switches L11 230 V to valve 101)', category: 'relay', ratings: r({ coilVoltage: '24VDC' }), confidence: 'high', source: 'sheet 4' },
    { tag: 'YV1', partNumber: null, manufacturer: null, description: 'Hydraulic valve cutter down (100), 230 VAC', category: 'solenoidValve', ratings: r({ coilVoltage: '230VAC' }), confidence: 'high', source: 'sheet 4' },
    { tag: 'YV2', partNumber: null, manufacturer: null, description: 'Hydraulic valve cutter up (101), 230 VAC', category: 'solenoidValve', ratings: r({ coilVoltage: '230VAC' }), confidence: 'high', source: 'sheet 4' },
    { tag: 'HMI', partNumber: null, manufacturer: null, description: 'Touch panel 24 V (触摸屏)', category: 'hmi', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'RP1', partNumber: null, manufacturer: null, description: 'Speed pot (调速) on VFD AI1 / +10 V / GND', category: 'other', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'SA1', partNumber: null, manufacturer: null, description: 'Selector FWD / STOP / REV', category: 'selector', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'SA2', partNumber: null, manufacturer: null, description: 'Selector servo enable', category: 'selector', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'SA3', partNumber: null, manufacturer: null, description: 'Selector control power', category: 'selector', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'SA4', partNumber: null, manufacturer: null, description: 'Selector cutting (oil pump)', category: 'selector', ratings: r(), confidence: 'high', source: 'sheet 6' },
    { tag: 'SB1', partNumber: null, manufacturer: null, description: 'Stop button', category: 'pushbutton', ratings: r(), confidence: 'high', source: 'sheet 1' },
    { tag: 'SB2', partNumber: null, manufacturer: null, description: 'Start button', category: 'pushbutton', ratings: r(), confidence: 'high', source: 'sheet 1' },
    { tag: 'SB3', partNumber: null, manufacturer: null, description: 'Emergency stop (急停)', category: 'estop', ratings: r(), confidence: 'high', source: 'sheet 6' },
  ],
  motors: [
    { tag: 'M1', description: 'Forming main motor (成型主电机), on VFD VF1', kw: 5.5, hp: null, starter: 'vfd', reversing: true, kind: 'induction', confidence: 'high', source: 'sheet 2, U1 V1 W1' },
    { tag: 'M2', description: 'Cut-off oil pump motor (切断油泵)', kw: null, hp: null, starter: 'contactor-overload', reversing: false, kind: 'induction', confidence: 'medium', source: 'sheet 2, U2 V2 W2 (no power printed)' },
    { tag: 'M3', description: 'Flying shear servo motor (伺服切断)', kw: 1.5, hp: null, starter: null, reversing: true, kind: 'servo', confidence: 'high', source: 'sheet 3, U/V/W' },
  ],
  axes: [
    { tag: 'A1', description: 'Flying shear (追剪): chases the strip and cuts to length', driveTag: 'SD1', drivePart: null, motorTag: 'M3', motorKw: 1.5, encoder: 'line-length encoder PG1 on CN1-11/13 (A/B)', brakingResistor: 'R1 on P/C', signals: ['CN1-19 enable', 'CN1-21 origin', 'CN1-17 cutter down', 'CN1-1 cutter up', 'CN1-6 alarm'], confidence: 'high', source: 'sheet 3' },
  ],
  controller: 'servo-drive',
  interlocks: [
    { description: 'The oil pump KM2 runs only with the cutting switch SA4 on and the main contactor KM1 in', devices: ['KM2', 'SA4', 'KM1'] },
    { description: 'Cutter down and cutter up valves are driven only by the servo drive outputs, through relays KA1 and KA2', devices: ['KA1', 'KA2', 'YV1', 'YV2'] },
  ],
  safety: {
    estops: ['SB3'],
    guards: [],
    safetyRelay: null,
    category: null,
    kind: 'control-only',
    description: 'The E-stop SB3 only goes into VFD input DI3: it stops the forming motor through the VFD program. It does not remove power from the servo, the oil pump or the cutter valves.',
  },
  spec: {
    overview: 'Roll-forming machine: a 5.5 kW forming motor on a VFD drives the rolls; a flying shear on a 1.5 kW servo chases the strip and a hydraulic cutter cuts it to the length measured by a line-length encoder.',
    sequence: '1. Control power on (SA3), main contactor KM1 started with SB2 (stop SB1).\n2. Forming runs forward or reverse with SA1; speed from the pot RP1.\n3. With cutting on (SA4) the oil pump runs; the servo (enabled by SA2) follows the strip from the origin, cutter down (KA1/YV1) at the cut length, cutter up (KA2/YV2), returns.',
    safety: 'E-stop SB3 on the panel goes only into VFD input DI3.',
    guarding: '',
    homing: 'The shear goes to its origin signal (CN1-21) before cutting.',
    modes: 'Forming forward / stop / reverse (SA1); cutting on / off (SA4); servo enable (SA2); remote pendant with forward / reverse.',
    motion: 'M1 forming motor 5.5 kW on VFD VF1 (forward / reverse, speed pot). M2 oil pump on KM2 (power not printed). Servo axis A1: drive SD1 with built-in controller, 1.5 kW servo M3, braking resistor R1, line-length encoder PG1.',
    pneumatics: 'Hydraulic cutter: valve YV1 cutter down (100), YV2 cutter up (101), 230 VAC coils switched by relays KA1 / KA2.',
    sensing: 'Line-length encoder on the strip (to the servo drive), shear origin signal.',
    operator: 'Touch panel 24 V (cut length, quantity), speed pot RP1, SA1 FWD/STOP/REV, SA2 servo enable, SA3 control power, SA4 cutting, SB1 stop, SB2 start, SB3 E-stop; remote pendant (forward / reverse).',
    alarms: 'Servo alarm (CN1-6).',
    utilities: '3-phase + N supply on main breaker QF1 4P (10 mm²); one sheet title says 220 V. 230 V control (L11-N1), 24 V supply PS1 100 W.',
    other: '',
  },
  questions: [
    { text: 'Is the supply 380 V 3-phase + N (as the power sheet shows) or 220 V (as one sheet title says)?', section: 'utilities', assumption: '380 V 3-phase + N, 50 Hz' },
    { text: 'What is the oil pump motor power? It is not printed on the drawings.', section: 'motion', assumption: '1.5 kW' },
    { text: 'What cut-length accuracy and line speed must the flying shear hold?', section: 'motion', assumption: null },
  ],
  uncertainties: ['Pendant wire colours partly legible (green / yellow).'],
};
