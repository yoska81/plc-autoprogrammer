/// <reference types="node" />
/**
 * MPE720 registers as EasyBuilder Pro driver addresses, per the makers' connection guides: MP2000 on "YASKAWA MP
 * Series Memobus (Ethernet)", MP3000 on "YASKAWA MP3000 Series - Extension". Run with:  npx tsx src/deliverables/weintekMp.test.ts
 */
import assert from 'node:assert/strict';
import { mpToWeintek, type WeintekAddress } from './weintekMp';

const ok = (r: WeintekAddress) => { assert.ok(!('error' in r), 'error' in r ? r.error : ''); return r as Exclude<WeintekAddress, { error: string }>; };
const two = (reg: string) => ok(mpToWeintek(reg, 'yaskawa-mp2000'));
const three = (reg: string) => ok(mpToWeintek(reg, 'yaskawa-mp3000'));

// MP2000, Memobus: MB DDDDDh, MW / ML / MF DDDDD, IB HHHHH and IW HHHH read only; no O / S / G.
assert.deepEqual(two('MB000237'), { mode: 'Bit', type: 'MB', address: '000237', readOnly: false }, 'MB: word 23 (decimal), bit 7');
assert.deepEqual(two('MB65534F'), { mode: 'Bit', type: 'MB', address: '65534F', readOnly: false }, 'the top of the guide range');
assert.deepEqual(two('MW00100'), { mode: 'Word', type: 'MW', address: '00100', readOnly: false });
assert.deepEqual(two('ML00102'), { mode: 'Word', type: 'ML', address: '00102', readOnly: false });
assert.deepEqual(two('MF00200'), { mode: 'Word', type: 'MF', address: '00200', readOnly: false });
assert.deepEqual(two('IB0000F'), { mode: 'Bit', type: 'IB', address: '0000F', readOnly: true }, 'IB: hex word, bit F, read only');
assert.deepEqual(two('IW00A7'), { mode: 'Word', type: 'IW', address: '00A7', readOnly: true });
assert.match((mpToWeintek('MB655350', 'yaskawa-mp2000') as { error: string }).error, /beyond the driver's range \(65534\)/);
assert.match((mpToWeintek('IWA800', 'yaskawa-mp2000') as { error: string }).error, /beyond the driver's range \(A7FF\)/);
assert.match((mpToWeintek('OB00010', 'yaskawa-mp2000') as { error: string }).error, /OB registers are not on the YASKAWA MP Series Memobus \(Ethernet\) driver/);
assert.match((mpToWeintek('SW00010', 'yaskawa-mp2000') as { error: string }).error, /not on the/);

// MP3000, Extension: MB / MW DDDDDDD(h), SB / SW DDDDD(h), IB / OB HHHHHh, IW / OW HHHHH; L / F as their first word.
assert.deepEqual(three('MB000237'), { mode: 'Bit', type: 'MB', address: '00000237', readOnly: false }, 'seven decimal digits + bit');
assert.deepEqual(three('MW00100'), { mode: 'Word', type: 'MW', address: '0000100', readOnly: false });
assert.deepEqual(three('OB00012'), { mode: 'Bit', type: 'OB', address: '000012', readOnly: false }, 'outputs are on this driver');
assert.deepEqual(three('OW1000'), { mode: 'Word', type: 'OW', address: '01000', readOnly: false });
assert.deepEqual(three('SB000010'), { mode: 'Bit', type: 'SB', address: '000010', readOnly: false });
assert.equal(three('GW2097151').address, '2097151');
const ml = three('ML00102');
assert.equal(ml.type, 'MW'); assert.equal(ml.address, '0000102'); assert.match(ml.note ?? '', /32-bit/);
assert.match(three('MF00200').note ?? '', /32-bit float/);
assert.match((mpToWeintek('MW1048576', 'yaskawa-mp3000') as { error: string }).error, /range \(1048575\)/);

// Not an MP register.
assert.match((mpToWeintek('"Machine_DB".Run', 'yaskawa-mp3000') as { error: string }).error, /not an MP register/);
assert.match((mpToWeintek('MW0A', 'yaskawa-mp3000') as { error: string }).error, /not decimal/);
console.log('Weintek MP address tests passed');
