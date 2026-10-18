/**
 * Test fixture for motion (src/electrical/motion.test.ts, tools/harness rules-servo): one servo axis, one line
 * encoder and one 4-20 mA ultrasonic level sensor; the parts come from the catalog.
 */

/** The servo machine: [description, type, category, signal?] */
export const SERVO_IO: [string, 'input' | 'output', string, ('analog')?][] = [
  // Encoder first: CLICK high-speed inputs are X001–X004.
  ['Line encoder A', 'input', 'Machine/Process'], ['Line encoder B', 'input', 'Machine/Process'],
  ['Safety relay OK (E-stop)', 'input', 'Safety'], ['Start PB', 'input', 'Operator/HMI'], ['Stop PB', 'input', 'Operator/HMI'],
  ['Axis 1 servo ready', 'input', 'Servo/Axis'], ['Axis 1 servo alarm', 'input', 'Servo/Axis'], ['Axis 1 in position', 'input', 'Servo/Axis'],
  ['Axis 1 pulse', 'output', 'Servo/Axis'], ['Axis 1 direction', 'output', 'Servo/Axis'], ['Axis 1 servo on', 'output', 'Servo/Axis'], ['Axis 1 alarm reset', 'output', 'Servo/Axis'],
  ['Hopper level ultrasonic sensor', 'input', 'Analog/Process', 'analog'],
];
