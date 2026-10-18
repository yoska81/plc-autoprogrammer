/**
 * Test fixture for motion: one servo axis, one encoder, one 4-20 mA ultrasonic level sensor on the example
 * conveyor. The servo and its cables are real catalog parts; the encoder and ultrasonic sensor are STAND-INS ("STUB-…")
 * until the catalog has one — never use it in a design. Ratings follow the keys in src/electrical/motion.ts.
 */
import type { CatalogPart } from './types';

const stub = (partNumber: string, category: CatalogPart['category'], description: string, mount: CatalogPart['mount'], ratings: CatalogPart['ratings'], w?: number, h?: number): CatalogPart => ({
  partNumber, category, description: `TEST STAND-IN — ${description}`, manufacturer: 'AutomationDirect', url: 'https://www.automationdirect.com/', mount,
  widthMm: w, heightMm: h, ratings, verified: false, verify: 'test stand-in, not a real part', vendor: 'automationdirect',
});

export const MOTION_STUB_PARTS: CatalogPart[] = [
  // No UL encoder or ultrasonic sensor in the catalog yet (same rating keys as the catalog's motion parts).
  stub('STUB-ENC-1000-24', 'encoder', 'incremental shaft encoder 1000 P/R, A, B, Z, totem pole, 12-24 VDC', 'field', { ppr: 1000, outputs: 'A, B, Z', outputType: 'totem pole', supplyVolts: '12-24 VDC' }),
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
