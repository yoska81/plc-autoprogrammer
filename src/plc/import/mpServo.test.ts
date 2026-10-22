/**
 * Yaskawa MP motion registers (mpServo.ts): which axis a register belongs to, by the SVC-01 manual's layout
 * (8000h + (circuit - 1) × 800h + (axis - 1) × 80h), and what the few confirmed ones are.
 * Run with:  npx tsx src/plc/import/mpServo.test.ts
 */
import assert from 'node:assert/strict';
import { servoAxesUsed, servoComment, servoRegister } from './mpServo';

const r = (n: string) => { const x = servoRegister(n); return x && [x.circuit, x.axis, x.offset, x.kind, x.what]; };
assert.deepEqual(r('OW8008'), [1, 1, '08', 'setting', 'motion command']);
assert.deepEqual(r('IL8016'), [1, 1, '16', 'monitor', 'actual position (APOS)']);
assert.deepEqual(r('OL809C'), [1, 2, '1C', 'setting', 'setting OL+1C'], 'axis 2 starts at 8080h; an offset the manual\'s examples do not name');
assert.deepEqual(r('IW8380'), [1, 8, '00', 'monitor', 'run status'], 'axis 8 of circuit 1');
assert.deepEqual(r('IL8810'), [2, 1, '10', 'monitor', 'target position (CPOS)'], 'circuit 2 starts at 8800h');
assert.deepEqual(r('IB80000'), [1, 1, '00', 'monitor', 'run status'], 'a bit of a monitor word');
assert.equal(servoRegister('OW7FFF'), null, 'below 8000h: I/O');
assert.equal(servoRegister('MW00010'), null);
assert.equal(servoRegister('DS1'), null);
assert.equal(servoComment(servoRegister('OW8088')!), 'Servo axis 2 (circuit 1): motion command (OW8088)');
assert.deepEqual(servoAxesUsed(['OW8008', 'IL8016', 'OW8008', 'OW8088', 'MW00010']).map((a) => [a.circuit, a.axis, a.registers.map((x) => x.register)]), [[1, 1, ['IL8016', 'OW8008']], [1, 2, ['OW8088']]]);

console.log('mp servo register tests passed');
