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
const { axes, wires } = servoControls([{ key: 'U2', drive: { tag: 'U2', partNumber: 'SV2A-2040' }, pins: SUREServo2 } as never], wiring, 'sinking', '0V', null, 'no-relay', 'PE', 1);
const term = (re: RegExp) => axes[0].terminals.find((t) => t.address === A(re))?.terminal;
assert.equal(term(/DI1 SON/), SUREServo2.di.enable, 'SON on the drive\'s servo-on pin');
assert.equal(term(/DI7 CAM/), 'CN1-31', 'CAM engage on the DI the drawing names: DI7 = CN1-31');
assert.ok(axes[0].notes.some((n) => /assign E-CAM engage to DI7 \(CN1-31, P2\.016\) — this repurposes its factory function PL/.test(n)), axes[0].notes.join(' | '));
assert.equal(term(/U2 cut/), 'CN1-2', 'cut on DO3: DO- (CN1-2) to the PLC input');
assert.ok(wires.some((w) => w.from === 'TB1 24+' && w.to === 'U2:CN1-3'), 'DO3+ (CN1-3) from 24 V');
assert.deepEqual(axes[0].pinClashes ?? [], [], 'no drive pin used twice');

// A drive that also reports homing done (default DO3 = HOME) and has cut on DO3: one pin, two signals — an error.
const clash = [...wiring, { address: 'X112', type: 'input' as const, description: 'U2 homing complete', deviceTag: 'U2', deviceType: 'servo-drive' }];
const { axes: ax2 } = servoControls([{ key: 'U2', drive: { tag: 'U2', partNumber: 'SV2A-2040' }, pins: SUREServo2 } as never], clash, 'sinking', '0V', null, 'no-relay', 'PE', 1);
assert.ok((ax2[0].pinClashes ?? []).some((c) => /drive pin CN1-3 has two signals/.test(c) && /U2 cut/.test(c) && /homing complete/.test(c)), (ax2[0].pinClashes ?? []).join(' | '));
assert.equal(term(/U2 ready/), SUREServo2.do.ready![1], 'ready on its default DO pin');

console.log('roll former servo tests passed');
