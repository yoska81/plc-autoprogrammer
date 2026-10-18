/**
 * Test fixture for motion: one servo axis, one encoder, one 4-20 mA ultrasonic level sensor on the example
 * conveyor. The motion parts are STAND-INS (part numbers "STUB-…") until the catalog has the real SureServo2 /
 * encoder / ultrasonic parts — never use them in a design. Ratings follow the keys in src/electrical/motion.ts.
 */
import type { CatalogPart } from './types';

const stub = (partNumber: string, category: CatalogPart['category'], description: string, mount: CatalogPart['mount'], ratings: CatalogPart['ratings'], w?: number, h?: number): CatalogPart => ({
  partNumber, category, description: `TEST STAND-IN — ${description}`, manufacturer: 'AutomationDirect', url: 'https://www.automationdirect.com/', mount,
  widthMm: w, heightMm: h, ratings, verified: false, verify: 'test stand-in, not a real part', vendor: 'automationdirect',
});

export const MOTION_STUB_PARTS: CatalogPart[] = [
  stub('STUB-SV2A-2040', 'vfd', 'SureServo2 400 W servo drive, 230 V 1/3-phase, pulse/direction, STO', 'backplate',
    { kind: 'servo-drive', series: 'SureServo2', ratedWatts: 400, inputVolts: 230, inputPhases: '1/3', inputAmps: 3.4, breakerAmps: 5, control: 'pulse', maxPulseKhzOC: 200 }, 55, 170),
  stub('STUB-SV2L-204B', 'other', 'SureServo2 400 W servo motor, 60 mm, with brake', 'field', { kind: 'servo-motor', ratedWatts: 400, forDrive: 'SureServo2', brake: 'yes' }),
  stub('STUB-SV2C-P1-3', 'other', 'SureServo2 motor power cable, 3 m', 'field', { kind: 'servo-power-cable', forMotor: 'STUB-SV2L', lengthM: 3 }),
  stub('STUB-SV2C-E1-3', 'other', 'SureServo2 encoder feedback cable, 3 m', 'field', { kind: 'servo-feedback-cable', forMotor: 'STUB-SV2L', lengthM: 3 }),
  stub('STUB-TRD-GK1000-RZ', 'sensor', 'incremental encoder 1000 PPR, 12-24 VDC push-pull, A/B/Z', 'field', { kind: 'encoder', ppr: 1000, output: 'push-pull', supplyVolts: '12-24' }),
  stub('STUB-UK30-4-20', 'sensor', 'ultrasonic sensor M30, 4-20 mA, 2 m range', 'field', { kind: 'ultrasonic', output: '4-20mA', rangeMaxMm: 2000, supplyVolts: '24' }),
];

export const stubPart = (pn: string) => MOTION_STUB_PARTS.find((p) => p.partNumber === pn);

/** The servo machine: [description, type, category, signal?] */
export const SERVO_IO: [string, 'input' | 'output', string, ('analog')?][] = [
  // Encoder first: CLICK high-speed inputs are X001–X004.
  ['Line encoder A', 'input', 'Machine/Process'], ['Line encoder B', 'input', 'Machine/Process'],
  ['Safety relay OK (E-stop)', 'input', 'Safety'], ['Start PB', 'input', 'Operator/HMI'], ['Stop PB', 'input', 'Operator/HMI'],
  ['Axis 1 servo ready', 'input', 'Servo/Axis'], ['Axis 1 servo alarm', 'input', 'Servo/Axis'], ['Axis 1 in position', 'input', 'Servo/Axis'],
  ['Axis 1 pulse', 'output', 'Servo/Axis'], ['Axis 1 direction', 'output', 'Servo/Axis'], ['Axis 1 servo on', 'output', 'Servo/Axis'], ['Axis 1 alarm reset', 'output', 'Servo/Axis'],
  ['Hopper level ultrasonic sensor', 'input', 'Analog/Process', 'analog'],
];
