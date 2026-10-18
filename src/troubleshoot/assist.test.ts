/// <reference types="node" />
/**
 * Fault finding help, rules first: free text → point and symptom, likely causes from the wiring path and the
 * fault log; the AI only chooses among the rule answers or rewords a step without losing a reading.
 * Run with:  npx tsx src/troubleshoot/assist.test.ts
 */
import assert from 'node:assert/strict';
import { aiMatchSymptom, aiPlainStep, aiRankCauses, matchMachineSymptom, matchSymptom, mustKeep, rankCauses, type Ask, type AssistHop, type AssistPath } from './assist';

const hop = (kind: string, tag: string, label: string, location: AssistHop['location'] = 'cabinet', wire?: string): AssistHop => ({ kind, tag, label, location, ...(wire ? { wire } : {}) });
const input = (address: string, description: string, device: string, field = true): AssistPath => ({
  address, description, type: 'input', analog: false, device,
  signal: [hop('plc', 'PLC', `PLC ${address}`, 'cabinet', address), hop('terminal', 'TB2', 'TB2-1', 'cabinet', address), ...(field ? [hop('cable', 'W002', 'Cable W002', 'field', address)] : []), hop('device', device, device, field ? 'field' : 'door', address)],
  supply: [hop('protection', 'F2', 'Fuse F2'), hop('source', 'PS1', 'PS1 +V')], ret: [hop('source', 'PS1', 'PS1 0V')],
});
const paths: AssistPath[] = [
  input('X001', 'Start pushbutton', 'PB1', false),
  input('X002', 'Stop pushbutton', 'PB2', false),
  input('X004', 'Box stop photo eye', 'PE1'),
  input('X005', 'Case at pusher proximity sensor', 'PX2'),
  { address: 'Y001', description: 'Conveyor motor', type: 'output', analog: false, device: 'M1', signal: [hop('plc', 'PLC', 'PLC Y001'), hop('contact', 'K1', 'Relay K1 contact'), hop('cable', 'W010', 'Cable W010', 'field', 'Y001'), hop('device', 'M1', 'M1', 'field')], supply: [hop('protection', 'OL1', 'Overload OL1'), hop('protection', 'CB3', 'Breaker CB3'), hop('source', 'PS1', 'PS1')], ret: [] },
  { address: 'Y003', description: 'Pusher valve', type: 'output', analog: false, device: 'SV1', signal: [hop('plc', 'PLC', 'PLC Y003'), hop('device', 'SV1', 'SV1', 'field')], supply: [], ret: [] },
  { address: 'DF1', description: 'Tank level', type: 'input', analog: true, device: 'LT1', signal: [hop('plc', 'PLC', 'PLC AD1'), hop('cable', 'W020', 'Cable W020', 'field'), hop('device', 'LT1', 'LT1', 'field')], supply: [], ret: [] },
];
const top = (text: string) => { const m = matchSymptom(text, paths)[0]; return m ? `${m.address} ${m.symptom}` : 'none'; };

// ── Free text → point + symptom ──
assert.equal(top('the box stop eye never comes on'), 'X004 never-on');
assert.equal(top('X4 keeps flickering'), 'X004 flickers', 'X4 = X004');
assert.equal(top('x 4 is on all the time'), 'X004 always-on', 'dictated "x 4"');
assert.equal(top("conveyor motor won't start"), 'Y001 output-dead');
assert.equal(top('the conveyor never comes on'), 'Y001 output-dead', '"never on" about an output: the PLC turns it on, nothing happens');
assert.equal(top('pusher does not extend'), 'Y003 output-dead');
assert.equal(top('PE1 drops out sometimes'), 'X004 flickers', 'by the device tag');
assert.equal(top('tank level reads wrong'), 'DF1 analog-wrong');
assert.equal(top('el motor del conveyor no arranca'), 'Y001 output-dead', 'Spanish');
assert.equal(top('case sensor not working'), 'X005 never-on', 'a general "not working" gets the usual check');
assert.equal(top('the coffee machine is broken'), 'none', 'nothing on the machine matches');
{
  const m = matchSymptom('stop button stuck on', paths);
  assert.equal(m[0].address, 'X002');
  assert.match(m[0].why, /Stop pushbutton \(X002\): matches "Stop/);
  assert.ok(m[0].score > 0.5);
  assert.ok(!m.some((x) => x.address === 'X004' && x.score >= m[0].score), '"stop" alone (box stop) ranks below "stop button"');
}

// ── Likely causes ──
{
  const pe = paths[2];
  const c = rankCauses(pe, 'never-on');
  assert.equal(c[0].id, 'device', 'a photo eye: alignment / dirt first');
  assert.match(c[0].text, /PE1 \(photo eye\) does not switch/);
  assert.ok(c.some((x) => x.id === 'wire' && /wire X004/.test(x.text)));
  assert.ok(c.some((x) => x.id === 'supply' && /F2/.test(x.why)));
  // Flickers: a loose terminal first.
  assert.equal(rankCauses(pe, 'flickers')[0].id, 'loose');
  // The fault log: an open wire found twice before on this point comes first, practice faults do not count.
  const log = [
    { address: 'X004', date: '2026-09-01 10:00', found: 'Open on wire X004 between TB2-1 and PE1', fix: 'Remake the joint' },
    { address: 'X4', date: '2026-10-02 08:30', found: 'Open on wire X004 in the cable W002', fix: 'Replace the cable' },
    { address: 'X004', date: '2026-10-03 08:30', found: 'Device does not switch', fix: 'Replace PE1', practice: true },
    { address: 'X005', date: '2026-10-04 08:30', found: 'Device does not switch', fix: 'Replace' },
  ];
  const h = rankCauses(pe, 'never-on', log);
  assert.equal(h[0].id, 'wire');
  assert.match(h[0].why, /^Found here 2 times before \(last 2026-10-02: Open on wire X004 in the cable W002\)/);
  // A motor that does nothing: its overload and breaker are named.
  const m = rankCauses(paths[4], 'output-dead');
  assert.ok(m.some((x) => x.id === 'supply' && /OL1, CB3/.test(x.text)));
  assert.ok(m.some((x) => x.id === 'contact' && /Relay K1/.test(x.text)));
  assert.equal(rankCauses(paths[6], 'analog-wrong')[0].id, 'setting');
}

// ── The AI only chooses among the rule answers ──
const asks = (reply: string | Error): Ask => async () => { if (reply instanceof Error) throw reply; return reply; };
{
  const text = 'it stopped working after the cleaning';
  const rules = matchSymptom('box stop and case sensor', paths);
  assert.equal((await aiMatchSymptom(asks('{"address":"X005","symptom":"flickers"}'), text, paths, rules))[0].address, 'X005', 'a pick from the list is taken');
  assert.deepEqual(await aiMatchSymptom(asks('{"address":"X099","symptom":"never-on"}'), text, paths, rules), rules, 'a point not in the list: the rules stand');
  assert.deepEqual(await aiMatchSymptom(asks('{"address":"X005","symptom":"output-dead"}'), text, paths, rules), rules, 'a symptom that does not fit the point: the rules stand');
  assert.deepEqual(await aiMatchSymptom(asks(new Error('offline')), text, paths, rules), rules, 'no network: the rules stand');
  assert.deepEqual(await aiMatchSymptom(asks('not json'), text, paths, rules), rules);
  // Nothing matched by the rules: the AI may pick among all points.
  assert.equal((await aiMatchSymptom(asks('{"address":"Y003","symptom":"output-dead"}'), 'the thing that pushes boxes off', paths, []))[0].address, 'Y003');
}
{
  const causes = rankCauses(paths[2], 'never-on');
  const r = await aiRankCauses(asks('{"order":["supply","invented","supply","device"]}'), paths[2], 'never-on', causes);
  assert.deepEqual(r.map((c) => c.id).slice(0, 2), ['supply', 'device'], 'reordered');
  assert.equal(r.length, causes.length, 'nothing invented, nothing dropped');
  assert.deepEqual(new Set(r.map((c) => c.id)), new Set(causes.map((c) => c.id)));
  assert.deepEqual(await aiRankCauses(asks(new Error('x')), paths[2], 'never-on', causes), causes);
}
{
  const say = 'Switch off and lock out first. Power OFF and locked out, meter on continuity. Measure between TB2-1 and PE1 pin 4. Do you read about 0 Ω?';
  assert.ok(mustKeep(say).includes('TB2-1') && mustKeep(say).includes('lock out') && mustKeep(say).includes('continuity'));
  // The AI only ever sees the non-safety sentences; the safety ones stay word for word, in place.
  let seen = '';
  const reply = (sentences: string[]): Ask => async (_s, user) => { seen = user; return JSON.stringify({ sentences }); };
  const plain = await aiPlainStep(reply(['Touch the meter leads to TB2-1 and PE1 pin 4.', 'Does it beep (about 0 Ω)?']), say);
  assert.equal(plain, 'Switch off and lock out first. Power OFF and locked out, meter on continuity. Touch the meter leads to TB2-1 and PE1 pin 4. Does it beep (about 0 Ω)?');
  assert.ok(!/lock|power/i.test(seen), `safety sentences are never sent: ${seen}`);
  assert.equal(await aiPlainStep(reply(['Check the wire with a meter.', 'Beep?']), say), say, 'a rewording that loses the terminals is dropped');
  assert.equal(await aiPlainStep(reply(['Touch TB2-1 and PE1 pin 4.']), say), say, 'a sentence missing: the rule text');
  const volts = 'Meter on DC volts. Measure between TB2-1 and TB1 0V, with the sensor seeing a part. Do you read 24 VDC?';
  assert.equal(await aiPlainStep(reply(['TB2-1 to TB1 0V, part in front of the sensor.', '12 VDC?']), volts), volts, 'a changed reading is dropped');
  assert.equal(await aiPlainStep(asks(new Error('x')), volts), volts);
  // Review: rewordings that reverse or loosen a warning never get through, whatever their wording.
  for (const bad of ['Do not lock out for this one.', 'There is no need to switch off.', 'You can leave power on.', 'Leave the machine running while you measure.', 'Lockout only if you want.', 'Power can stay ON.']) {
    assert.equal(await aiPlainStep(reply([`${bad} Touch TB2-1 and PE1 pin 4.`, 'Does it beep (about 0 Ω)?']), say), say, bad);
  }
  // A step that is all safety is never sent at all.
  let asked = false;
  assert.equal(await aiPlainStep(async () => { asked = true; return '{}'; }, 'Switch off and lock out first.'), 'Switch off and lock out first.');
  assert.equal(asked, false);
}

// ── Dev 2's routing: a machine function that won't go, or a stuck step, goes to "why is it stuck?" first ──
{
  const steps = [{ n: 10, name: 'Fill' }, { n: 20, name: 'Mix' }, { n: 30, name: 'Drain' }];
  assert.deepEqual(matchSymptom("conveyor motor won't start", paths, steps)[0].target, { output: 'Y001' });
  assert.deepEqual(matchSymptom('the machine stops at step 20', paths, steps)[0].target, { step: 20 });
  assert.deepEqual(matchSymptom('it stops at drain every time', paths, steps)[0].target, { step: 30 });
  assert.equal(matchSymptom('X4 never comes on', paths, steps)[0].target, undefined, 'a plain point symptom goes straight to the wiring steps');
}

// ── Dev 1's device faults replace the general device cause; machine-level symptoms ──
{
  const faults = [{ title: 'No output when target present', causes: ['Lens dirty or misaligned', 'Sensitivity set too low'], fix: ['Clean and align'], source: 'https://example.com/e3z.pdf p.12' }];
  const c = rankCauses(paths[2], 'never-on', [], faults);
  assert.deepEqual(c.slice(0, 2).map((x) => x.text), ['PE1: Lens dirty or misaligned', 'PE1: Sensitivity set too low']);
  assert.match(c[0].why, /maker's manual: https:\/\/example.com\/e3z.pdf p.12/);
  assert.ok(!c.some((x) => /does not switch: misaligned/.test(x.text)), 'the general device cause is replaced');
  // A small map of the same shape as Dev 1's (their data is passed in by the app once it lands).
  const cause = (rank: number, text: string) => ({ rank, cause: text, devices: {}, checks: [`check ${text}`], fix: [], source: 'test' });
  const maps = [{ machineType: 'roll-former', title: 'Roll former', aliases: ['roll former', 'flying shear'], sources: [], symptoms: [
    { id: 'cut-length-wrong', symptom: 'Cut length wrong (parts too long or too short)', aliases: ['length drifts'], causes: [cause(2, 'B'), cause(1, 'A')] },
    { id: 'shear-does-not-fire', symptom: 'Shear does not cut', aliases: ['misses cuts'], causes: [cause(1, 'C')] },
  ] }];
  const m = matchMachineSymptom('the parts are too long', 'Roll former line 2', maps);
  assert.equal(m?.symptom.id, 'cut-length-wrong');
  assert.deepEqual(m!.causes.map((c) => c.cause), ['A', 'B'], 'causes most likely first');
  assert.equal(matchMachineSymptom('the parts are too long', 'Bottle capper', maps), null, 'no map for this machine type');
  assert.equal(matchMachineSymptom('shear misses cuts sometimes', 'flying shear', maps)?.symptom.id, 'shear-does-not-fire');
  assert.equal(matchMachineSymptom('the parts are too long', 'Roll former'), null, 'no knowledge loaded: nothing, never a guess');
}

console.log('assist.test: all passed');
