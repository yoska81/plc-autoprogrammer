/// <reference types="node" />
/**
 * The user's roll former (cn-rollformer, Debug 1's converted I/O): its servo drive U2 is one drive with the tag
 * it has in the drawings. SON (DI1), CAM engage (DI7), ready (DO1), cut (DO3) and alarm (DO5) are its signals,
 * wired to the terminals the drawing names. The Reset pushbutton (it also resets the servo alarm) and the servo
 * enable selector are operator devices, not drive signals.
 * Run with:  npx tsx src/electrical/rollformerServo.test.ts
 */
import assert from 'node:assert/strict';
import { CN_ROLLFORMER_IO } from '../plc/engine/__fixtures__/cnRollformerIo';
import { driveTagLead, isServoPoint, motionDesign, servoRole } from './motion';
import { servoControls } from './servoWiring';
import { SUREServo2 } from './motion';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import type { IOPoint } from '../types/io';

const io = CN_ROLLFORMER_IO.map((p, i) => ({ id: `r${i}`, description: p.description, type: p.type, category: p.category, deviceType: p.deviceType })) as IOPoint[];
const profile = getProfile('click');
const addresses = resolveAddresses(profile, getCpu(profile, 'C0-11DD2E-D'), io, []);
const A = (re: RegExp) => addresses.get(io.find((p) => re.test(p.description))!.id)!;

assert.equal(driveTagLead('U2 DI1 SON'), 'U2');
assert.equal(driveTagLead('Reset (复位): safety relay and servo alarm reset'), null);
const servo = io.filter(isServoPoint).map((p) => `${p.description} → ${servoRole(p)}`);
assert.deepEqual(servo, ['U2 ready (DO1) → ready', 'U2 cut (DO3) → driveOutput', 'U2 alarm (DO5) → alarm', 'U2 DI1 SON → enable', 'U2 DI7 CAM engage → cam'], servo.join(' | '));

let n = 0;
const m = motionDesign({ io, addresses, supply: '240VAC-3PH', nextTag: (p: string) => `${p}${++n}` });
assert.deepEqual(m.axes.map((a) => [a.key, a.drive]), [['U2', 'U2']], 'one drive, tagged U2 as drawn — not a new axis');
assert.ok(!m.ioWiring.some((w) => /Reset|selector/i.test(w.description)), 'operator devices are not drive signals');

// Terminals: the drawn DI / DO when the function has no default pin; SON on its default DI1 pin.
const wiring = m.ioWiring.map((w) => ({ address: w.address, type: (/^X/.test(w.address) ? 'input' : 'output') as 'input' | 'output', description: w.description, deviceTag: w.deviceTag, deviceType: w.deviceType }));
const { axes } = servoControls([{ key: 'U2', drive: { tag: 'U2', partNumber: 'SV2A-2040' }, pins: SUREServo2 } as never], wiring, 'sinking', '0V', null, 'no-relay', 'PE', 1);
const term = (re: RegExp) => axes[0].terminals.find((t) => t.address === A(re))?.terminal;
assert.equal(term(/DI1 SON/), SUREServo2.di.enable, 'SON on the drive\'s servo-on pin');
assert.equal(term(/DI7 CAM/), 'DI7', 'CAM engage on the DI the drawing names');
assert.equal(term(/U2 cut/), 'DO3', 'cut on DO3');
assert.equal(term(/U2 ready/), SUREServo2.do.ready![1], 'ready on its default DO pin');

console.log('roll former servo tests passed');
