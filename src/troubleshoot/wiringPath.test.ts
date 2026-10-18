/// <reference types="node" />
/**
 * Wiring path engine. Run with:  npx tsx src/troubleshoot/wiringPath.test.ts
 * The example conveyor (sample project) and the user's Sealing Head (CLICK C0-11DD2E-D + C0-08ND3 + C0-04THM,
 * NEMA 4X, VFD unwinder, heater with thermocouple, two-hand, light curtain, guard door).
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { buildModel } from '../electrical/derive';
import { circuitOf, partnerPins, prepareWiring, wiringPath, wiringPaths, type PathHop, type WiringPath } from './wiringPath';
import { withDrawingOptions } from '../standards/drawingOptions';
import { faultEffects, faultableWires } from './faults';
import { circuitFaultEffects, linksOf, oracleFor, showsSymptom, verdictNames, type CircuitFault } from './oracle';
import { chains } from './steps';
import { FlickerWatch, wiggleResult, wiggleSpots } from './watch';
import { answer, back, currentStep, startSession, type Answer, type Step } from './steps';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}
const all = (w: WiringPath): PathHop[] => [...w.signal, ...w.supply, ...w.ret];
const tags = (hs: PathHop[]) => hs.map((h) => h.tag);

import { sealingHead } from './testFixtures';

console.log('wiring path');

test('contact and pole partners', () => {
  assert.deepEqual(partnerPins('14'), ['13']);
  assert.deepEqual(partnerPins('23'), ['24']);
  assert.deepEqual(partnerPins('96'), ['95']);
  assert.deepEqual(partnerPins('A2'), ['A1']);
  assert.deepEqual(partnerPins('T1'), ['L1']);
  assert.deepEqual(partnerPins('NO'), ['C']);
  assert.deepEqual(partnerPins('BK'), ['BN']);
});

seedSampleProject();
const ex = collectProject().drawingCtx!;
const exPaths = wiringPaths(ex);

test('example: a path for every PLC point', () => {
  const m = buildModel(ex);
  assert.deepEqual(exPaths.map((p) => p.address).sort(), m.io.map((p) => p.address).sort());
  for (const w of exPaths) {
    assert.equal(w.signal[0].kind, 'plc', `${w.address} starts at the PLC`);
    assert.ok(w.signal.some((h) => h.kind === 'device'), `${w.address} reaches its device`);
    assert.ok(w.signal[0].where?.line, `${w.address}: PLC terminal has a drawing line`);
    assert.ok(w.signal[0].measure, `${w.address}: a reading at the PLC terminal`);
  }
});

test('example: photo-eye X004 through TB2, the trunk, JB1 and its cable, supplied from PS1 via CB2 and DS1', () => {
  const w = wiringPath(ex, 'X004')!;
  assert.deepEqual(tags(w.signal), ['PLC', 'TB2', 'W002', 'JB1', 'W003', 'PE1']);
  assert.equal(w.signal[1].terminal, '1');
  assert.equal(w.signal[0].measure!.expect, '24 VDC');
  assert.match(w.signal[0].measure!.when, /sensor detects/);
  assert.match(w.signal[0].measure!.otherwise!, /0 V/);
  assert.deepEqual(w.signal[0].measure!.between, ['PLC:X004', 'TB1 0V']);
  assert.ok(w.signal.find((h) => h.kind === 'junction-box')!.measure, 'the junction-box terminal is read too');
  // Place by place from the sensor's own feed pin to the supply, then (not measured) its mains side.
  assert.deepEqual(w.supply.map((h) => h.node ?? h.tag), ['PE1:BN', 'JB1:2', 'TB2-4', 'TB1 24+', 'TB1 0V', 'PS1:+V', 'CB2', 'DS1', 'SUPPLY']);
  assert.equal(w.supply[2].terminal, '4');
  assert.deepEqual(w.supply[4].measure!.between, ['TB1 24+', 'PS1 -V'], 'the 0 V lead is checked before the supply is blamed');
  assert.equal(w.supply[5].measure!.expect.startsWith('24 VDC'), true);
  assert.match(w.supply[6].measure!.expect, /480 VAC/);
  const ch = chains(w);
  assert.deepEqual(ch.common.map((h) => h.node), ['PLC:COM', 'TB1 0V', 'TB1 24+', 'PS1:-V'], 'the input common to the supply −V');
  assert.match(ch.common[0].label, /common of X004/);
  assert.deepEqual(ch.ret.map((h) => h.node), ['PE1:BU', 'JB1:3', 'TB2-5', 'TB1 0V', 'TB1 24+', 'PS1:-V']);
  assert.deepEqual(ch.ret[0].measure!.between, ['TB1 24+', 'PE1:BU'], 'a 0 V return is read from 24 V');
  assert.match(w.signal[0].where!.sheet, /-E-\d+$/);
  assert.equal(w.reference, 'TB1 0V');
});

test('example: NC stop button reads 24 V released, start button 24 V pressed', () => {
  assert.match(wiringPath(ex, 'X003')!.signal[0].measure!.when, /released/);
  assert.match(wiringPath(ex, 'X002')!.signal[0].measure!.when, /pressed/);
});

test('example: sinking output Y001 to the K1 coil, fed through the overload and the safety relay', () => {
  const w = wiringPath(ex, 'Y001')!;
  assert.deepEqual(tags(w.signal), ['PLC', 'K1']);
  assert.equal(w.signal[1].terminal, 'A2');
  assert.equal(w.signal[0].measure!.expect, 'about 0 V', 'a sinking output reads about 0 V when ON');
  assert.doesNotMatch(w.signal[0].measure!.when, /sinking|pulls/, 'no jargon');
  assert.deepEqual(tags(w.supply).slice(0, 8), ['K1', 'OL1', 'OL1', 'TB1', 'SR1', 'SR1', 'TB1', 'TB1']);
  assert.match(w.supply[0].measure!.expect, /24 VDC/, 'a reading at the coil A1');
  assert.ok(!w.supply.some((h) => /^M1-/.test(h.wire ?? '')), 'no motor power poles in the coil supply');
});

test('example: solenoid output Y002 into JB1, fed with 24+S through JB1:11 and TB3-2', () => {
  const w = wiringPath(ex, 'Y002')!;
  assert.deepEqual(tags(w.signal), ['PLC', 'TB3', 'W002', 'JB1', 'W006', 'SOL1']);
  assert.deepEqual(w.supply.slice(0, 3).map((h) => h.node), ['SOL1:A2', 'JB1:11', 'TB3-2']);
  assert.equal(w.supply[2].wire, '24+S');
  assert.match(w.supply[0].measure!.when, /while SR1 is ON/);
});

test('example: no hop without a label, every hop with a wire number', () => {
  for (const w of exPaths) for (const h of all(w)) {
    assert.ok(h.label && !/undefined|NaN/.test(h.label), `${w.address}: ${h.label}`);
    assert.ok(h.wire, `${w.address}: ${h.label} has a wire`);
  }
});

test('imported drawings: a wire list with other wire numbers is followed as given', () => {
  const m = buildModel(ex);
  const wires = m.wires.map((x) => ({ ...x, wire: x.wire === 'X004' ? '205' : x.wire === '24+' ? '201' : x.wire }));
  const w = wiringPath(ex, 'X004', { wires })!;
  assert.equal(w.signal[0].wire, '205');
  assert.deepEqual(tags(w.signal).filter((t) => t !== 'W002' && t !== 'W003' && t !== 'JB1'), ['PLC', 'TB2', 'PE1']);
  assert.equal(w.supply[0].wire, '201');
  assert.ok(w.supply.some((h) => h.kind === 'source' && h.tag === 'PS1'));
  assert.ok(!w.supply.some((h) => h.wire === '24+'), 'no wire number from the design\'s own cables');
});

const sh = sealingHead();
const shPaths = wiringPaths(sh);

test('Sealing Head: every point has a path to its device', () => {
  const m = buildModel(sh);
  assert.ok(shPaths.length >= m.io.length, `${shPaths.length} paths for ${m.io.length} points`);
  for (const w of shPaths) assert.ok(w.signal.length >= 2, `${w.address} ${w.description}: ${w.summary}`);
});

test('Sealing Head: thermocouple DF1 on C0-04THM — CH1+/CH1−, mV, no 24 V loop', () => {
  const w = shPaths.find((x) => x.analog && /thermocouple/i.test(x.description))!;
  assert.ok(w, 'thermocouple path');
  assert.equal(w.signal[0].measure!.kind, 'mV');
  assert.ok(w.signal.some((h) => /CH1\+|CH1-/.test(h.terminal ?? '')), w.summary);
  assert.ok(!all(w).some((h) => h.wire === '24+'), 'no loop supply on a thermocouple');
  assert.equal(w.supply.length, 0);
});

test('Sealing Head: solenoid output through the safety relay contact before the field', () => {
  const w = shPaths.find((x) => x.type === 'output' && /down solenoid/i.test(x.description))!;
  const contact = w.signal.find((h) => h.kind === 'contact');
  assert.ok(contact, `a series contact on ${w.summary}`);
  assert.match(contact!.note!, /closed only when/);
  assert.equal(w.signal[w.signal.length - 1].kind, 'device');
});

test('Sealing Head: VFD run output ends at the drive input', () => {
  const w = shPaths.find((x) => x.type === 'output' && /VFD run/i.test(x.description))!;
  assert.match(w.signal[w.signal.length - 1].tag, /^VFD/);
});

test('Sealing Head: sourcing outputs are fed from the module output supply (24+S)', () => {
  const w = shPaths.find((x) => x.type === 'output' && /heater on/i.test(x.description))!;
  assert.match(w.supply[0].label, /supply of the outputs/);
  assert.equal(w.supply[0].wire, '24+S');
  assert.ok(w.supply.some((h) => h.kind === 'source'), w.supply.map((h) => h.tag).join(' '));
  for (const h of w.supply) assert.ok(h.measure, `${h.label} has a reading`);
});

test('Sealing Head: the VFD run output does not wander into the motor power circuit', () => {
  const w = shPaths.find((x) => x.type === 'output' && /VFD run/i.test(x.description))!;
  assert.ok(!all(w).some((h) => /^M\d-/.test(h.wire ?? '')), w.supply.map((h) => `${h.tag}:${h.wire}`).join(' '));
});

test('Sealing Head: the thermocouple path ends at its field device', () => {
  const w = shPaths.find((x) => x.analog && /thermocouple/i.test(x.description))!;
  const dev = w.signal.find((h) => h.kind === 'device')!;
  assert.equal(dev.location, 'field');
  assert.match(dev.note ?? '', /must not be swapped/);
  // Out on + (CH1+ → TBA-1 → cable core), back on − (cable core → TBA-2 → CH1−).
  const order = w.signal.map((h) => `${h.kind}:${h.terminal ?? h.tag}`);
  assert.deepEqual(order.filter((x) => x.startsWith('plc') || x.startsWith('terminal')), ['plc:CH1+', 'terminal:1', 'terminal:2', 'plc:CH1-'], order.join(' '));
  assert.equal(w.signal.filter((h) => h.kind === 'cable').length, 2, 'both cores');
});

test('IEC designations: the example in Europe (-K2 PLC, -X2 terminals)', () => {
  const ctx = withDrawingOptions({ ...ex, region: 'EU' }, { region: 'EU' });
  const ps = wiringPaths(ctx);
  assert.ok(ps.length > 0);
  for (const w of ps) assert.ok(w.signal.length >= 2 && w.signal.some((h) => h.kind === 'device'), w.summary);
  const pe = wiringPath(ctx, 'X004')!;
  assert.match(pe.signal[0].tag, /^-K/, pe.summary);
  assert.ok(pe.signal.some((h) => h.kind === 'terminal' && /^-X/.test(h.tag)), pe.summary);
  assert.ok(pe.supply.some((h) => h.kind === 'source'), pe.summary);
});

test('review: sinking outputs return through the module common (open common = classic fault)', () => {
  for (const a of ['Y001', 'Y002', 'Y003']) {
    const w = wiringPath(ex, a)!;
    assert.ok(w.ret.length, `${a} has a return`);
    assert.match(w.ret[0].label, /common of/);
    assert.equal(w.ret[0].wire, '0V');
  }
});

test('review: a supply contact reads 24 V only while it is ON itself (SR1:14 drops after an E-stop)', () => {
  const w = shPaths.find((x) => x.supply.some((h) => h.tag === 'SR1' && h.terminal === '14'))!;
  const h = w.supply.find((x) => x.tag === 'SR1' && x.terminal === '14')!;
  assert.equal(h.kind, 'contact');
  assert.match(h.measure!.when, /SR1/, h.measure!.when);
});

test('review: supply contacts are kind contact (OL1:96)', () => {
  const ol = wiringPath(ex, 'Y001')!.supply.find((h) => h.tag === 'OL1')!;
  assert.equal(ol.kind, 'contact');
  assert.match(ol.note!, /not tripped/);
});

test('review: the supply chain goes through a fused terminal to the power supply', () => {
  const m = buildModel(ex);
  // The HMI feed: 24+ → TB1-12 (fused) → 24+H → HMI1. Make an input device fed from 24+H.
  const fused = m.strips.flatMap((s) => s.terminals).find((t) => t.fuse)!;
  const outNet = m.wires.find((w) => w.from === fused.label && w.wire !== '24+')!.wire;
  const wires = m.wires.map((w) => (w.wire === '24+' && w.to === 'PB1:C' ? { ...w, wire: outNet, from: fused.label } : w));
  const w = wiringPath(ex, 'X002', { wires })!;
  const kinds = w.supply.map((h) => `${h.kind}:${h.tag}`);
  assert.ok(kinds.some((k) => k.startsWith('protection:') && w.supply.some((h) => /Fused terminal/.test(h.label))), kinds.join(' '));
  assert.ok(w.supply.some((h) => h.kind === 'source' && h.tag === 'PS1'), kinds.join(' '));
});

test('review: 2-wire 4-20 mA loop — PLC hop on the channel, measured IN SERIES, never across', () => {
  const t = sealingHead(true);
  const w = wiringPaths(t).find((x) => x.analog)!;
  assert.equal(w.signal[0].kind, 'plc');
  assert.match(w.signal[0].terminal!, /^CH\d$/, w.signal[0].label);
  const m = w.signal[0].measure!;
  assert.equal(m.kind, 'mA');
  assert.match(m.when, /BROKEN.*SERIES.*never put the meter across/);
  const dev = w.signal.find((h) => h.kind === 'device')!;
  assert.equal(dev.measure!.kind, 'VDC', 'across the transmitter: volts only');
  assert.ok(w.supply.some((h) => h.kind === 'source'), w.supply.map((h) => h.tag).join(' '));
});

test('review: a device without a known partner pin does not mix two supply chains', () => {
  for (const w of shPaths) {
    const incoming = w.supply.filter((h) => h.kind === 'supply').length;
    assert.ok(incoming <= 1, `${w.address}: ${w.supply.map((h) => h.tag).join(' ')}`);
    const i = w.supply.findIndex((h) => h.kind === 'supply');
    assert.ok(i < 0 || i === w.supply.length - 1 || w.supply.slice(i + 1).every((h) => h.kind !== 'source'), `${w.address}: chain runs on past the incoming supply`);
  }
});

test('review: parallel devices on one input are all returned', () => {
  const m = buildModel(ex);
  const wires = [...m.wires, { wire: 'X002', from: 'PB3:NO', to: 'PLC:X002', color: 'BU', size: '18 AWG', function: 'parallel start' }];
  const w = wiringPath(ex, 'X002', { wires })!;
  assert.deepEqual(w.parallel.map((h) => h.tag), ['PB3']);
});

test('review: a PLC terminal with no wire returns the PLC hop and noWire', () => {
  const m = buildModel(ex);
  const w = wiringPath(ex, 'X004', { wires: m.wires.filter((x) => x.wire !== 'X004') })!;
  assert.equal(w.noWire, true);
  assert.equal(w.signal.length, 1);
  assert.equal(w.signal[0].kind, 'plc');
});

test('review: terminal and device hops on the I/O sheet carry the line', () => {
  const w = wiringPath(ex, 'X002')!;
  assert.ok(w.signal.every((h) => !h.where || h.where.line), w.signal.map((h) => `${h.tag} ${h.where?.sheet} ${h.where?.line}`).join(' | '));
});

test('review: a prepared context gives the same paths', () => {
  const prep = prepareWiring(ex);
  assert.deepEqual(wiringPath(prep, 'X004'), wiringPath(ex, 'X004'));
});

console.log('wiring faults');

test('an open photo-eye signal wire keeps only X004 OFF', () => {
  const e = faultEffects(exPaths, { wire: 'X004', kind: 'open' });
  assert.deepEqual(e.map((x) => `${x.address}=${x.reads}`), ['X004=false']);
  assert.match(e[0].why, /never turns ON/);
});

test('a signal wire shorted to 24 V keeps its input ON', () => {
  const e = faultEffects(exPaths, { wire: 'X005', kind: 'short-24V' });
  assert.deepEqual(e.map((x) => `${x.address}=${x.reads}`), ['X005=true']);
});

test('an open 24+S wire kills the loads fed through the safety relay, not the inputs on 24+', () => {
  const e = faultEffects(exPaths, { wire: '24+S', kind: 'open' });
  const addrs = e.map((x) => x.address);
  assert.ok(addrs.includes('Y001') && addrs.includes('Y002'), addrs.join(' '));
  assert.ok(!addrs.includes('X004'), 'photo-eye is on 24+');
  assert.ok(e.filter((x) => x.type === 'output').every((x) => x.reads === null));
});

test('24+ shorted to 0 V: everything on the supply dies', () => {
  const e = faultEffects(exPaths, { wire: '24+', kind: 'short-0V' });
  assert.equal(new Set(e.map((x) => x.address)).size, exPaths.length);
  assert.ok(e.filter((x) => x.type === 'input').every((x) => x.reads === false));
});

test('faultable wires: signal and supply wires, no mains or PE', () => {
  const ws = faultableWires(exPaths);
  const names = ws.map((x) => x.wire);
  for (const w of ['X004', 'Y002', '24+', '24+S', '0V']) assert.ok(names.includes(w), `${w} in ${names.join(' ')}`);
  assert.ok(!names.some((w) => /^(L1|L2|L3|PE)$/.test(w)));
  assert.deepEqual(ws.find((x) => x.wire === 'X004')!.points, ['X004']);
});

test('Sealing Head: an open thermocouple wire puts DF1 out of range', () => {
  const tc = shPaths.find((x) => x.analog)!;
  const e = faultEffects(shPaths, { wire: tc.signal[0].wire!, kind: 'open' });
  assert.ok(e.some((x) => x.address === tc.address && /out of range/.test(x.why)));
});

console.log('live watch');

test('flicker watch counts changes only', () => {
  const fw = new FlickerWatch();
  for (const [t, v] of [[0, false], [100, false], [200, true], [300, false], [400, true], [500, true]] as const) fw.feed('X003', v, t);
  assert.equal(fw.changesSince('X003', 0), 3);
  assert.equal(fw.changesSince('X003', 350), 1);
  assert.equal(fw.changesSince('X004', 0), 0);
});

test('wiggle at a terminal: loose with 2+ changes, steady otherwise', () => {
  const w = wiringPath(ex, 'X004')!;
  const spots = wiggleSpots(w);
  assert.deepEqual(spots.map((h) => h.tag), ['TB2', 'W002', 'JB1', 'W003', 'PE1']);
  const loose = wiggleResult(w, spots[0], 4);
  assert.equal(loose.verdict, 'loose');
  assert.match(loose.message, /X004 flickered 4 times while you wiggled TB2, terminal 1 → loose connection on wire X004/);
  assert.equal(wiggleResult(w, spots[0], 1).verdict, 'steady');
});

console.log('guided steps');

const play = (w: WiringPath, symptom: Parameters<typeof startSession>[1], answers: Answer[]) => {
  let s = startSession(w, symptom);
  const asked: string[] = [];
  for (const a of answers) { const st = currentStep(s); if (!st) break; asked.push(st.hop ? `${st.part}:${st.hop.tag}` : st.part); s = answer(s, a); }
  return { s, asked };
};
/** Answer every step by a rule (prepare is always answered yes). */
const playBy = (w: WiringPath, symptom: Parameters<typeof startSession>[1], rule: (st: Step) => Answer) => {
  let s = startSession(w, symptom);
  const asked: string[] = [];
  for (let i = 0; i < 60 && currentStep(s); i++) { const st = currentStep(s)!; asked.push(st.hop ? `${st.part}:${st.hop.node ?? st.hop.tag}` : st.part); s = answer(s, st.part === 'prepare' ? 'yes' : rule(st)); }
  return { s, asked };
};
// The meter readings the circuit itself gives with one conductor broken (circuit.ts solver), per design.
const circEx = circuitOf(ex), circSh = circuitOf(sh);
const linkAt = (cc: typeof circEx, a: string, b: string) => {
  const l = cc.circuit.links.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  assert.ok(l, `a conductor ${a} – ${b}`);
  return l!;
};
const byFault = (cc: typeof circEx, w: WiringPath, symptom: Parameters<typeof startSession>[1], f: CircuitFault) => {
  assert.ok(showsSymptom(cc.model, cc.circuit, w, f, symptom), `${f.label} gives "${symptom}" on ${w.address}`);
  const o = oracleFor(cc.model, cc.circuit, w, f, symptom)!;
  return playBy(w, symptom, (st) => (o.answer(st, symptom).yes ? 'yes' : 'no'));
};
const open = (cc: typeof circEx, a: string, b: string): CircuitFault => { const l = linkAt(cc, a, b); return { link: l.id, label: l.text }; };

test('photo-eye X004: trunk core W002/1 open between TB2-1 and JB1:1 → that core is named', () => {
  const w = wiringPath(ex, 'X004')!;
  const { s, asked } = byFault(circEx, w, 'never-on', open(circEx, 'TB2-1', 'JB1:1'));
  assert.deepEqual(asked, ['prepare', 'signal:PLC:X004', 'signal:TB2-1', 'signal:JB1:1']);
  assert.match(s.verdict!.text, /Open connection on wire X004 \(cable W002, core 1 BU\) between Terminal strip TB2, terminal 1 and Junction box JB1, terminal 1/);
  assert.equal(s.verdict!.wire, 'X004');
  assert.match(s.verdict!.fix, /^Switch off and lock out first\./);
});

test('photo-eye X004: the sensor feed core open between JB1:2 and PE1:BN → read at the sensor pin, the core named (not "replace the sensor")', () => {
  const w = wiringPath(ex, 'X004')!;
  assert.equal(w.supply[0].node, 'PE1:BN', 'the supply is read at the sensor\'s own feed pin first');
  const { s } = byFault(circEx, w, 'never-on', open(circEx, 'JB1:2', 'PE1:BN'));
  assert.match(s.verdict!.text, /supply is good at Junction box JB1, terminal 2 but missing at PE1.*terminal BN/);
  assert.match(s.verdict!.text, /wire 24\+ \(cable W003, core 1 BN\)/);
  assert.doesNotMatch(s.verdict!.text, /gives no signal/);
});

test('photo-eye X004: 0 V core open between TB2-5 and JB1:3 → the 0 V return named on that core', () => {
  const { s } = byFault(circEx, wiringPath(ex, 'X004')!, 'never-on', open(circEx, 'TB2-5', 'JB1:3'));
  assert.match(s.verdict!.text, /0 V return is good at Terminal strip TB2, terminal 5 but missing at Junction box JB1, terminal 3.*wire 0V \(cable W002, core 3/);
});

test('photo-eye X004: the strip jumper TB1 24+ → TB2-4 missing → the jumper is named', () => {
  const { s } = byFault(circEx, wiringPath(ex, 'X004')!, 'never-on', open(circEx, 'TB1 24+', 'TB2-4'));
  assert.match(s.verdict!.text, /the jumper TB1 24\+ → TB2-4/);
  assert.match(s.verdict!.fix, /jumper is loose or missing/);
});

test('the power-supply leads: an open PS1 −V → TB1 0V is named as the 0 V lead, an open PS1 +V → TB1 24+ as the 24 V lead', () => {
  const w = wiringPath(ex, 'X004')!;
  const zero = byFault(circEx, w, 'never-on', open(circEx, 'PS1:-V', 'TB1 0V')).s.verdict!;
  assert.equal(zero.wire, '0V', zero.text);
  assert.doesNotMatch(zero.text, /wire 24\+ between/);
  const plus = byFault(circEx, w, 'never-on', open(circEx, 'PS1:+V', 'TB1 24+')).s.verdict!;
  assert.equal(plus.wire, '24+', plus.text);
});

test('photo-eye X004 never ON: no signal anywhere, 24 V and 0 V good at the sensor pins → the sensor is not switching', () => {
  const { s, asked } = playBy(wiringPath(ex, 'X004')!, 'never-on', (st) => (st.part === 'signal' ? 'no' : 'yes'));
  assert.deepEqual(asked.slice(-2), ['supply:PE1:BN', 'return:PE1:BU']);
  assert.match(s.verdict!.text, /PE1 has 24 V and 0 V but gives no signal/);
});

test('input common: 24 V at X004 but the common reads 0 V from 24+ → open common', () => {
  const { s, asked } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'yes', 'no', 'yes']);
  assert.deepEqual(asked, ['prepare', 'signal:PLC', 'common:PLC', 'common:TB1']);
  assert.match(s.verdict!.text, /module common is good at Terminal strip TB1.* but missing at .*COM/);
});

test('sinking output Y001: the terminal does not pull down, common open → found on the common', () => {
  const { s, asked } = play(wiringPath(ex, 'Y001')!, 'output-dead', ['yes', 'no', 'no', 'yes']);
  assert.deepEqual(asked, ['prepare', 'signal:PLC', 'common:PLC', 'common:TB1']);
  assert.match(s.verdict!.text, /module common/);
});

test('safety wording: outputs warn the machine will move, repairs start with lock-out, readings name the meter setting', () => {
  const y = startSession(wiringPath(ex, 'Y002')!, 'output-dead');
  assert.match(y.steps[0].say, /Keep everyone clear first — the machine will move/);
  assert.match(y.steps[1].say, /^Go to .*Meter on DC volts\. Measure between PLC:Y002 and TB1 0V, with output Y002 ON/);
  assert.doesNotMatch(y.steps.map((x) => x.say).join(' '), /sinking|pulls to/);
  const { s } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'no', 'no', 'yes']);
  assert.match(s.verdict!.fix, /^Switch off and lock out first\./);
});

test('analog: 4-20 mA loop — volts across the transmitter first, the mA reading in SERIES in the main text', () => {
  const t = wiringPaths(sealingHead(true)).find((w) => w.analog)!;
  const s0 = startSession(t, 'analog-wrong');
  assert.doesNotMatch(s0.steps.map((x) => x.say).join(' '), /press it|put the target/);
  const { s, asked } = play(t, 'analog-wrong', ['yes', 'yes', 'no']);
  assert.deepEqual(asked, ['prepare', 'analog:TT1', 'analog:IO2']);
  assert.match(s.steps[2].say, /Break the loop at TBA-2 and put the meter in SERIES on its mA range — never across/);
  assert.match(s.verdict!.text, /TT1 has its loop voltage but does not set the right current/);
  const open = play(t, 'analog-wrong', ['yes', 'no', 'yes']).s;
  assert.match(open.verdict!.text, /24 V reaches the loop at .* but not across TT1/);
});

test('analog: thermocouple — mV at the module, else ohms across the lifted thermocouple', () => {
  const tc = shPaths.find((w) => w.analog)!;
  const { s, asked } = play(tc, 'analog-wrong', ['yes', 'no', 'no']);
  assert.deepEqual(asked, ['prepare', 'analog:IO2', 'analog:TT1']);
  assert.match(s.verdict!.text, /thermocouple or a broken wire|extension cable is open/);
});

test('Back: one answer back replays the session without it', () => {
  const w = wiringPath(ex, 'X004')!;
  const { s } = play(w, 'never-on', ['yes', 'no', 'no']);
  const b = back(s);
  assert.equal(b.answers.length, 2);
  assert.equal(currentStep(b)!.hop!.tag, 'TB2');
  assert.equal(back(back(b)).at, 0);
});

test('24 V at the PLC terminal → the wiring is good, check the PLC side', () => {
  const { s } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'yes', 'yes']);
  assert.match(s.verdict!.text, /field wiring is good/);
});

test('solenoid Y002: good out to SOL1 and on both its pins → the valve itself', () => {
  const { s, asked } = playBy(wiringPath(ex, 'Y002')!, 'output-dead', () => 'yes');
  assert.deepEqual(asked, ['prepare', 'signal:PLC:Y002', 'signal:TB3-1', 'signal:JB1:10', 'signal:SOL1:A1', 'supply:SOL1:A2']);
  assert.match(s.verdict!.text, /SOL1 has power on both sides but does not work/);
});

test('solenoid Y002: device cable core W006/1 open → named between JB1:10 and the valve', () => {
  const { s } = byFault(circEx, wiringPath(ex, 'Y002')!, 'output-dead', open(circEx, 'JB1:10', 'SOL1:A1'));
  assert.match(s.verdict!.text, /Open connection on wire Y002 \(cable W006, core 1 BU\) between Junction box JB1, terminal 10 and SOL1/);
});

test('junction-box loads: the valve supply is read at JB1 too — W006/2 open between JB1:11 and SOL1:A2 is named', () => {
  const w = wiringPath(ex, 'Y002')!;
  assert.ok(w.supply.some((h) => h.node === 'JB1:11' && h.measure), 'JB1:11 is a measured place');
  const { s } = byFault(circEx, w, 'output-dead', open(circEx, 'JB1:11', 'SOL1:A2'));
  assert.match(s.verdict!.text, /supply is good at Junction box JB1, terminal 11 but missing at SOL1/);
  assert.doesNotMatch(s.verdict!.text, /power on both sides/);
});

test('a supply through several wires (24+ → SR1 13-14 → 24+S → OL1 95-96 → K1): every place is read and the one open wire named', () => {
  const w = wiringPath(ex, 'Y001')!;
  const nodes = w.supply.map((h) => h.node);
  for (const n of ['K1:A1', 'OL1:96', 'OL1:95', 'TB1 24+S', 'SR1:14', 'SR1:13', 'TB1 24+', 'PS1:+V']) assert.ok(nodes.includes(n), `${n} in ${nodes.join(' ')}`);
  assert.equal(w.supply.find((h) => h.node === 'OL1:96')!.kind, 'contact');
  assert.match(w.supply.find((h) => h.node === 'OL1:96')!.note!, /not tripped/);
  const { s } = byFault(circEx, w, 'output-dead', open(circEx, 'TB1 24+S', 'OL1:95'));
  assert.match(s.verdict!.text, /supply is good at Terminal strip TB1, 24\+S terminals but missing at OL1.*terminal 95/);
  assert.equal(s.verdict!.wire, '24+S');
  const c = byFault(circEx, w, 'output-dead', open(circEx, 'SR1:13', 'SR1:14')).s.verdict!;
  assert.match(c.text, /contact SR1 13-14 does not close/);
});

test('Sealing Head down solenoid: both sides of the two-hand relay contact are read before it is blamed', () => {
  const w = shPaths.find((x) => x.type === 'output' && /down solenoid/i.test(x.description))!;
  assert.ok(w.signal.some((h) => h.node === 'SR3:13') && w.signal.some((h) => h.node === 'SR3:14'));
  assert.match(w.signal.find((h) => h.kind === 'contact')!.note!, /closed only when/);
  const contact = byFault(circSh, w, 'output-dead', open(circSh, 'SR3:13', 'SR3:14')).s.verdict!;
  assert.match(contact.text, /contact SR3 13-14 does not close/);
  const wire = byFault(circSh, w, 'output-dead', open(circSh, 'SR3:14', 'TB3-1')).s.verdict!;
  assert.match(wire.text, /Open connection on wire Y001A between SR3.*terminal 14 and Terminal strip TB3, terminal 1/);
  assert.doesNotMatch(wire.text, /does not close/);
});

test('input ON all the time: 0 V at TB2-1 with the sensor OFF → a short to 24 V before TB2-1', () => {
  const { s } = play(wiringPath(ex, 'X004')!, 'always-on', ['yes', 'no', 'yes']);
  assert.match(s.verdict!.text, /short to 24 V between PLC terminal X004 and Terminal strip TB2, terminal 1/);
});

test('flickers: wiggle steps along the path, a flicker names the spot', () => {
  const { s, asked } = play(wiringPath(ex, 'X004')!, 'flickers', ['yes', 'no', 'no', 'yes']);
  assert.deepEqual(asked, ['prepare', 'wiggle:TB2', 'wiggle:W002', 'wiggle:JB1']);
  assert.match(s.verdict!.text, /Loose connection at Junction box JB1/);
});

test('skipped steps are not evidence', () => {
  const { s } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'no', 'skip', 'yes']);
  assert.match(s.verdict!.text, /between PLC terminal X004 and Junction box JB1, terminal 1/);
});

test('always-on, 24 V out at the device: take the wire off — still ON → the wire is shorted, OFF → the device', () => {
  const w = wiringPath(ex, 'X004')!;
  const n = startSession(w, 'always-on').steps.length;
  const toDevice: Answer[] = ['yes', ...Array(n - 1).fill('no')];
  const wire = play(w, 'always-on', [...toDevice, 'yes']).s;
  assert.match(wire.verdict!.text, /Wire X004 is shorted to 24 V between the PLC and PE1/);
  assert.equal(wire.verdict!.wire, 'X004');
  assert.match(play(w, 'always-on', [...toDevice, 'no']).s.verdict!.text, /PE1 gives 24 V \(ON\) while it should be OFF/);
});

test('Sealing Head X103 (VFD1 fault relay R1O): fed from 24+ through the relay common R1', () => {
  const w = shPaths.find((x) => x.address === 'X103')!;
  assert.ok(w.supply.length > 0, 'a supply chain');
  assert.equal(w.supply.find((h) => h.kind === 'source')?.tag, 'PS1');
  assert.ok(partnerPins('R1O').includes('R1'));
});

test('Sealing Head X101 on IO1: the common is IO1:COM, its own module; no place twice in one chain', () => {
  const w = shPaths.find((x) => x.address === 'X101')!;
  assert.equal(`${w.ret[0].tag}:${w.ret[0].terminal}`, 'IO1:COM');
  for (const p of shPaths) {
    const ch = chains(p);
    for (const list of [ch.feed, ch.ret, ch.common]) {
      const keys = list.filter((h) => h.node && h.kind !== 'source').map((h) => `${h.node}|${h.measure?.nodes?.join('~') ?? ''}`);
      assert.equal(new Set(keys).size, keys.length, `${p.address}: ${keys.join(' ')}`);
    }
  }
});

// The reviewer's earlier misses, answered with the readings worked out by hand from the circuit.
const npnSh = wiringPaths(sealingHead(false, true));
const npnPt = (a: string) => npnSh.find((x) => x.address === a)!;
test('review case 1: NPN input X101 (common on 24+), input common IO1:COM open → found on the common, no "24 V" wording', () => {
  // Sensor ON pulls X101 to 0 V: 0 V at the PLC terminal reads right. IO1:COM: 0 V (open, floats down
  // through the input) — wrong; TB1 24+: 24 V — right.
  const w = npnPt('X101');
  const { s, asked } = play(w, 'never-on', ['yes', 'yes', 'no', 'yes']);
  assert.deepEqual(asked, ['prepare', 'signal:PLC', 'common:IO1', 'common:TB1']);
  assert.match(s.verdict!.text, /module common is good at Terminal strip TB1, 24\+ .*missing at .*IO1.*COM/);
  assert.equal(s.verdict!.wire, '24+');
  const ok = play(w, 'never-on', ['yes', 'yes', 'yes']).s.verdict!.text;
  assert.match(ok, /reads 0 V \(ON\)/);
  assert.doesNotMatch(ok, /24 V reaches/);
});
test('review case 1b: NPN input X008 on the CPU: common PLC:COM on 24+ open → found', () => {
  const { s } = play(npnPt('X008'), 'never-on', ['yes', 'yes', 'no', 'yes']);
  assert.match(s.verdict!.text, /module common is good .* missing at .*PLC.*COM/);
});
test('review case 2: NPN input shorted to 0 V → "short to 0 V", never "24 V"', () => {
  const w = npnPt('X101');
  const n = startSession(w, 'always-on').steps.length;
  const { s } = play(w, 'always-on', ['yes', ...Array(n - 1).fill('no'), 'yes']);
  assert.match(s.verdict!.text, /Wire X101 is shorted to 0 V between the PLC and LS2/);
  assert.match(startSession(w, 'always-on').steps[1].say, /Do you read 24 VDC\?/);
});
test('review case 3: thermocouple open between TBA-1 and IO2:CH1+ → mV good at TBA, missing at the module', () => {
  const tc = shPaths.find((w) => w.analog)!;
  const { s, asked } = play(tc, 'analog-wrong', ['yes', 'yes', 'no']);
  assert.deepEqual(asked, ['prepare', 'analog:IO2', 'analog:IO2']);
  assert.match(s.steps[2].say, /at the module itself/);
  assert.match(s.verdict!.text, /reaches .*TBA-1.* but not the module/);
  assert.match(s.verdict!.fix, /^Switch off and lock out first/);
});
test('review case 4: 4-20 mA open cable core → 0 V across TT1 at the transmitter itself, 24 V at TBA-1 → loop open', () => {
  const t = wiringPaths(sealingHead(true)).find((w) => w.analog)!;
  const s0 = startSession(t, 'analog-wrong');
  assert.match(s0.steps[1].say, /Measure between TT1 \+ and TT1 −, at the transmitter itself/);
  const { s } = play(t, 'analog-wrong', ['yes', 'no', 'yes']);
  assert.match(s.verdict!.text, /loop is open between TT1 and the PLC module/);
});
test('review safety: lock-out in the thermocouple, transmitter and power-supply repairs; keep clear BEFORE forcing', () => {
  const tc = shPaths.find((w) => w.analog)!;
  assert.match(play(tc, 'analog-wrong', ['yes', 'no', 'no']).s.verdict!.fix, /^Switch off and lock out first/);
  const t = wiringPaths(sealingHead(true)).find((w) => w.analog)!;
  assert.match(play(t, 'analog-wrong', ['yes', 'yes', 'no']).s.verdict!.fix, /switch off and lock out first/i);
  const x = wiringPath(ex, 'X004')!;
  const dead = playBy(x, 'never-on', () => 'no').s.verdict!;
  assert.match(dead.text, /No output from PS1/);
  assert.match(dead.fix, /lock out first/i);
  const say = startSession(wiringPath(ex, 'Y002')!, 'output-dead').steps[0].say;
  assert.ok(say.indexOf('Keep everyone clear') < say.indexOf('force'), say);
});

test('dry contacts on an NPN common (+24 V): ON reads 0 V, the contact is fed from 0 V through its partner pin', () => {
  const pb = npnPt('X002');
  assert.equal(pb.signal[0].measure!.expect, 'about 0 V', 'a pushbutton on the NPN group switches 0 V');
  assert.equal(chains(pb).ret[0].node, 'PB1L:C', 'its 0 V feed is the contact common');
  assert.ok(chains(pb).feed.length === 0, 'no 24 V feed: the only 24 V is the module common');
  const vfd = npnPt('X103');
  assert.equal(vfd.signal[0].measure!.expect, 'about 0 V');
  assert.equal(chains(vfd).ret[0].node, 'VFD1:R1', 'the fault relay is fed through its common R1, not DCM');
  const ok = playBy(pb, 'never-on', (st) => (st.part === 'signal' ? 'no' : 'yes')).s.verdict!.text;
  assert.match(ok, /PB1L has 24 V and 0 V but gives no signal/);
  const circNpn = circuitOf(sealingHead(false, true));
  const feed = chains(pb).ret[1].node!;
  const v = byFault(circNpn, pb, 'never-on', open(circNpn, 'PB1L:C', feed)).s.verdict!;
  assert.match(v.text, /0 V return is good at .* but missing at PB1L/);
  const n = startSession(pb, 'always-on').steps.length;
  assert.match(play(pb, 'always-on', ['yes', ...Array(n - 1).fill('no'), 'yes']).s.verdict!.text, /shorted to 0 V/);
});

test('practice faults in the simulator: one broken conductor only affects the points that use it', () => {
  const paths = wiringPaths(ex);
  // The sensor feed core of PE1 only: X004 dead, the other sensors on the same 24+ wire still work.
  const pe1 = circuitFaultEffects(circEx.model, circEx.circuit, paths, open(circEx, 'JB1:2', 'PE1:BN'));
  assert.deepEqual(pe1.map((e) => `${e.address}:${e.reads}`), ['X004:false']);
  // The trunk core feeding the junction box: every sensor in it.
  const trunk = circuitFaultEffects(circEx.model, circEx.circuit, paths, open(circEx, 'TB2-4', 'JB1:2'));
  assert.deepEqual(trunk.map((e) => e.address).sort(), ['X004', 'X005', 'X006']);
  // A signal shorted to 24 V: that input ON whatever the sensor does.
  const short = circuitFaultEffects(circEx.model, circEx.circuit, paths, { short: { node: 'JB1:4', to: 24 }, label: 'JB1:4 shorted to 24 V' });
  assert.deepEqual(short.map((e) => `${e.address}:${e.reads}`), ['X005:true']);
  // The output's load feed: the valve dead.
  const sol = circuitFaultEffects(circEx.model, circEx.circuit, paths, open(circEx, 'JB1:11', 'SOL1:A2'));
  assert.deepEqual(sol.map((e) => `${e.address}:${e.type}`), ['Y002:output']);
});

test('relays: a contact is not blamed before the relay\'s own coil / supply is read (SR3 on the down solenoid, SR1 on X001)', () => {
  const w = shPaths.find((x) => x.type === 'output' && /down solenoid/i.test(x.description))!;
  assert.ok(w.coils?.SR3, 'SR3 coil chains on the path');
  // Hand-worked: Y001 ON, 24 V at SR3:13, none at SR3:14; nothing across SR3 A1–A2; A1 dead, TB1 24+ live.
  const good = new Set(['PLC:Y001', 'SR3:13', 'TB1 24+', 'PS1:+V']);
  const { s, asked } = playBy(w, 'output-dead', (st) => (st.part === 'coil' ? 'no' : good.has(st.hop?.node ?? '') ? 'yes' : 'no'));
  assert.ok(asked.includes('coil:SR3:A1'), asked.join(' '));
  assert.match(s.verdict!.text, /coil supply is good at Terminal strip TB1, 24\+ terminals but missing at SR3.*Open connection on wire 24\+ between/);
  // Coil supplied: then the contact itself is the fault.
  const fed = playBy(w, 'output-dead', (st) => (st.part === 'coil' ? 'yes' : good.has(st.hop?.node ?? '') ? 'yes' : 'no')).s.verdict!;
  assert.match(fed.text, /contact SR3 13-14 does not close/);
  // A relay-driven input: SR1 for X001 is read across its supply before "gives no signal".
  const x1 = wiringPath(ex, 'X001')!;
  const r = playBy(x1, 'never-on', (st) => (st.part === 'signal' ? 'no' : st.part === 'coil' ? 'yes' : 'yes'));
  assert.ok(r.asked.some((a) => a.startsWith('coil:SR1')), r.asked.join(' '));
  assert.match(r.s.verdict!.text, /SR1 has its supply and its contact is fed, but it gives no signal/);
});

// Strict fault sweep: every discrete point × every conductor its steps walk past (each wire end, cable core,
// jumper, contact and fuse), plus a short on every signal place, answered with the voltages the circuit solver
// works out. Correct only when the verdict names the exact conductor (its wire and one of its ends).
test('strict fault sweep: every conductor of every point is found (example + Sealing Head + NPN)', () => {
  let total = 0;
  const miss: string[] = [];
  for (const [name, ctx] of [['example', ex], ['Sealing Head', sh], ['Sealing Head NPN', sealingHead(false, true)]] as const) {
    const cc = circuitOf(ctx);
    for (const w of wiringPaths(ctx).filter((p) => !p.analog && !p.noWire)) {
      const sym: Parameters<typeof startSession>[1] = w.type === 'input' ? 'never-on' : 'output-dead';
      const faults: [CircuitFault, Parameters<typeof startSession>[1]][] = linksOf(cc.circuit, w).map((l) => [{ link: l.id, label: l.text }, sym]);
      if (w.type === 'input') for (const h of w.signal) if (h.node && h.kind !== 'cable') faults.push([{ short: { node: h.node, to: chains(w).npn ? 0 : 24 }, label: `short at ${h.node}` }, 'always-on']);
      for (const [f, s] of faults) {
        if (!showsSymptom(cc.model, cc.circuit, w, f, s)) continue;
        const o = oracleFor(cc.model, cc.circuit, w, f, s)!;
        total++;
        const v = playBy(w, s, (st) => (o.answer(st, s).yes ? 'yes' : 'no')).s.verdict!;
        if (!verdictNames(cc.circuit, v, f)) miss.push(`${name} ${w.address} ${f.label}: ${v.text}`);
      }
    }
  }
  const pct = ((total - miss.length) / total) * 100;
  console.log(`       ${total - miss.length}/${total} = ${pct.toFixed(1)} % found`);
  for (const m of miss.slice(0, 30)) console.log(`       miss: ${m}`);
  assert.ok(total > 300, `${total} faults swept`);
  assert.ok(pct >= 97, `${pct.toFixed(1)} % found`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
