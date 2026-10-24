import assert from 'node:assert/strict';
import { looksLeftOver } from './leftovers';
const spec = 'Sealing head: a pneumatic cylinder lowers a heated sealing bar onto the film; heater with thermocouple; unwinder motor feeds the film.';
const notes = 'Conveyor cell: Start runs the conveyor while the E-stop circuit is healthy. When a part reaches the end photo-eye, stop the conveyor, extend the pusher, wait for the pusher-extended prox (fault after 3 s), retract and restart.';
const r = looksLeftOver(notes, spec); assert.ok(r.leftOver);
assert.ok(!looksLeftOver('Use DS1 as the step register for the sealing cycle', spec).leftOver);
assert.ok(looksLeftOver('Conveyor motor', spec, 1).leftOver);
assert.ok(!looksLeftOver('Unwinder motor', spec).leftOver);
console.log('ok');
