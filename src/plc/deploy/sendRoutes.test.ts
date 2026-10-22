/// <reference types="node" />
/**
 * "Send to PLC software": the flow per PLC, what to do where there is none, and the Test card.
 * Run with:  npx tsx src/plc/deploy/sendRoutes.test.ts
 */
import assert from 'node:assert/strict';
import { firstLine, noSendAdvice, sendRoute, type SendRoute } from './sendRoutes';
import { TEST_CARD } from './testCard';
import { PLC_PROFILES } from '../core/profiles';

const ALL = new Set<SendRoute>(['tia', 'click', 'codesys', 'studio5000']);

// One flow per brand the app sends to; none for the others.
assert.deepEqual(['siemens-s7', 'click', 'generic-st', 'logix', 'micro800', 'unitronics-unistream', 'unitronics-vision', 'yaskawa-mp'].map(sendRoute),
  ['tia', 'click', 'codesys', 'studio5000', null, null, null, null]);

// The desktop app with every bridge: the flow opens, no advice.
for (const id of ['siemens-s7', 'click', 'generic-st', 'logix']) assert.equal(noSendAdvice({ profileId: id, vendor: 'V' }, ALL), null, id);

// No route: says so, names the software, points at Load into PLC.
for (const [id, sw] of [['micro800', 'Connected Components Workbench'], ['unitronics-unistream', 'UniLogic'], ['unitronics-vision', 'VisiLogic']]) {
  const a = noSendAdvice({ profileId: id, vendor: 'V' }, ALL)!;
  assert.ok(a.startsWith(`${sw} has no way`) && a.includes('Load into PLC'), a);
}
// A brand not listed: the vendor's software, in words.
assert.match(noSendAdvice({ profileId: 'new-brand', vendor: 'Acme' }, ALL)!, /^The Acme programming software has no way/);

// Yaskawa (read only): choose the PLC to move it to.
assert.match(noSendAdvice({ profileId: 'yaskawa-mp', vendor: 'Yaskawa', readOnly: true }, ALL)!, /read only: choose the PLC to move it to first/);

// The web version: the desktop app for Windows; an older desktop app without that bridge: update it.
assert.match(noSendAdvice({ profileId: 'siemens-s7', vendor: 'Siemens' }, null)!, /^Sending to TIA Portal works in the ISA Auto Programmer desktop app for Windows/);
assert.match(noSendAdvice({ profileId: 'logix', vendor: 'Rockwell' }, new Set<SendRoute>(['tia', 'click']))!, /cannot send to Studio 5000 yet: update ISA Auto Programmer/);

// Every PLC the PLC page offers has an answer: a flow, or plain advice.
for (const p of PLC_PROFILES.filter((x) => x.available || x.readOnly)) {
  const a = noSendAdvice({ profileId: p.id, vendor: p.vendor, readOnly: p.readOnly }, ALL);
  assert.ok(sendRoute(p.id) ? a === null : Boolean(a), p.id);
}

// An error of several lines shows its first; one line as it is.
assert.equal(firstLine('TIA Portal reported: no.\n   at Siemens.Engineering.X()\n'), 'TIA Portal reported: no.');
assert.equal(firstLine('\n  Stopped, as you asked.'), 'Stopped, as you asked.');
assert.equal(firstLine('One line.'), 'One line.');

// The Test card: each brand the app sends to has its software, what to install, at most four clicks starting
// with the one button, and its log; the others point at Load into PLC (or, Yaskawa, the import), with no log.
const sending = TEST_CARD.filter((c) => c.log);
assert.deepEqual(sending.map((c) => c.log), ['tia-bridge.log', 'click-bridge.log', 'codesys-bridge.log', 'studio5000-bridge.log']);
for (const c of TEST_CARD) {
  assert.ok(c.install.length >= 1 && c.clicks.length >= 2 && c.clicks.length <= 4, c.brand);
  if (c.log) assert.match(c.clicks[0], /Send to PLC software/, c.brand);
  else assert.match(c.clicks.join(' '), /Load into PLC|Import › PLC program/, c.brand);
}
assert.ok(TEST_CARD.some((c) => /Micro800/.test(c.brand)) && TEST_CARD.some((c) => /Unitronics/.test(c.brand)) && TEST_CARD.some((c) => /Yaskawa/.test(c.brand)));

console.log('sendRoutes tests passed');
