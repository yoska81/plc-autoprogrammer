/// <reference types="node" />
/** Run with:  npx tsx src/electrical/inputVolts.test.ts */
import assert from 'node:assert/strict';
import { acInputRanges, takesAc } from './inputVolts';

assert.deepEqual(acInputRanges('100-120VAC L-N or 200-500VAC L-L'), [[200, 500]]);
assert.ok(takesAc('120/230 VAC', 240), '6EP3334-8SB00-0AY0 auto-range: 230 V nominal takes 240 V');
assert.ok(!takesAc('120/230 VAC', 480));
assert.ok(takesAc('85…265V AC', 240) && !takesAc('85…265V AC', 480), '1769-PA2 / PA4 form');
assert.ok(takesAc('85…265V AC or 170…265V AC, switch selectable', 240) && !takesAc('85…265V AC or 170…265V AC, switch selectable', 480), '1769-PA4');
assert.ok(takesAc('90~264VAC / 127~370VDC', 240) && !takesAc('90~264VAC / 127~370VDC', 370), 'the DC range is not an AC input');
assert.ok(takesAc('100-240 VAC', 240) && !takesAc('100-240 VAC', 480));
assert.ok(takesAc('3 x 400-500 VAC / 50-60 Hz nominal; range 320-600 VAC or 450-800 VDC', 480));
assert.ok(takesAc('100-240VAC (-15%/+10%), 110-250VDC', 208));
assert.ok(!takesAc('100-240VAC (-15%/+10%), 110-250VDC', 480));
assert.ok(takesAc('95-132 VAC 1-ph; 170-253 VAC 1/3-ph', 240));
assert.ok(takesAc('90-132 VAC, 180-264 VAC / 210-375 VDC (rated 115/230 VAC auto select)', 240) && !takesAc('90-132 VAC, 180-264 VAC / 210-375 VDC (rated 115/230 VAC auto select)', 480));
assert.ok(takesAc('24 VDC', 480), 'no AC input stated: nothing to judge');
console.log('inputVolts.test: ok');
