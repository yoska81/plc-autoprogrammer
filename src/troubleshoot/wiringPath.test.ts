/// <reference types="node" />
/**
 * Wiring path engine. Run with:  npx tsx src/troubleshoot/wiringPath.test.ts
 * The example conveyor (sample project) and the user's Sealing Head (CLICK C0-11DD2E-D + C0-08ND3 + C0-04THM,
 * NEMA 4X, VFD unwinder, heater with thermocouple, two-hand, light curtain, guard door).
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { generateDefaultDesign } from '../electrical/engine';
import { getPart } from '../electrical/catalog';
import { buildModel, type DrawingContext } from '../electrical/derive';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { analogSetup } from '../plc/core/analog';
import type { IOPoint } from '../types/io';
import { partnerPins, prepareWiring, wiringPath, wiringPaths, type PathHop, type WiringPath } from './wiringPath';
import { withDrawingOptions } from '../standards/drawingOptions';
import { faultEffects, faultableWires } from './faults';
import { FlickerWatch, wiggleResult, wiggleSpots } from './watch';
import { answer, currentStep, startSession, type Answer } from './steps';

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

// --- the user's Sealing Head --------------------------------------------------------------------------
const pt = (description: string, type: 'input' | 'output', deviceType: string, extra: Partial<IOPoint> = {}): Omit<IOPoint, 'id'> =>
  ({ description, type, category: 'Operator/HMI', deviceType, reason: 'spec', ...extra }) as Omit<IOPoint, 'id'>;
const SEAL = [
  pt('Safety relay OK (E-stop, guard door, light curtain)', 'input', 'safety-relay-output'),
  pt('Two-hand start button left', 'input', 'pushbutton-no'), pt('Two-hand start button right', 'input', 'pushbutton-no'),
  pt('Light curtain clear (OSSD)', 'input', 'other'), pt('Guard door closed', 'input', 'limit-switch'),
  pt('Stop button', 'input', 'pushbutton-nc'), pt('Fault reset button', 'input', 'pushbutton-no'),
  pt('Sealing head up', 'input', 'sensor-pnp'), pt('Sealing head down', 'input', 'sensor-pnp'),
  pt('Heater over-temperature limit tripped', 'input', 'other'), pt('Unwinder VFD fault', 'input', 'vfd-input'),
  pt('Seal bar temperature (thermocouple)', 'input', 'other', { signal: 'analog', analog: { range: 'thermocouple', min: 0, max: 300, units: '°C' } } as Partial<IOPoint>),
  pt('Sealing head down solenoid', 'output', 'solenoid'), pt('Sealing head up solenoid', 'output', 'solenoid'),
  pt('Seal heater on (SSR)', 'output', 'other'), pt('Unwinder VFD run', 'output', 'vfd-input'), pt('Running light', 'output', 'pilot-light'),
];
/** The user's Sealing Head; `transmitter` swaps the thermocouple for a 2-wire 4-20 mA transmitter on a C0-04AD-1. */
function sealingHead(transmitter = false): DrawingContext {
  const points = transmitter
    ? SEAL.map((p) => (/thermocouple/.test(p.description) ? { ...p, description: 'Seal bar temperature (4-20 mA transmitter)', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } } as Omit<IOPoint, 'id'> : p))
    : SEAL;
  const io = points.map((p, i) => ({ ...p, id: `s${i + 1}` })) as IOPoint[];
  const profile = getProfile('click');
  const cpu = getCpu(profile, 'C0-11DD2E-D');
  const modules = transmitter ? ['C0-08ND3', 'C0-04AD-1'] : ['C0-08ND3', 'C0-04THM'];
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label };
  const spec = 'Sealing head: two-hand start, light curtain, interlocked guard door, E-stop. Heated seal bar with a type J thermocouple read by the PLC and a separate over-temperature limit. Film unwinder 0.5 HP on a VFD. NEMA 4X stainless panel, 480 V 3-phase.';
  const r = generateDefaultDesign({
    io, addresses, spec, inputs: { supply: '480VAC-3PH', enclosureRating: 'NEMA 4X', notes: '', motors: [{ tag: 'M1', description: 'Film unwinder', hp: 0.5, voltage: '480VAC-3PH', starter: 'vfd', reversing: false }], requiredParts: [] },
    plc, modules, region: 'US', getPart, hmiPartNumber: 'CM5-T7W', now: '2026-01-01T00:00:00.000Z', projectName: 'Sealing Head',
  });
  return {
    projectName: 'Sealing Head', design: r.design, getPart, plc, region: 'US', hmiPartNumber: 'CM5-T7W',
    io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    analog: analogSetup(profile, cpu, moduleSlots(modules), io.map((p) => ({ ...p, address: addresses.get(p.id) }))),
  } as DrawingContext;
}

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
  assert.deepEqual(tags(w.supply), ['TB2', 'PS1', 'CB2', 'DS1', 'SUPPLY']);
  assert.equal(w.supply[0].terminal, '4');
  assert.equal(w.supply[1].measure!.expect.startsWith('24 VDC'), true);
  assert.match(w.supply[2].measure!.expect, /480 VAC/);
  assert.deepEqual(tags(w.ret), ['PLC', 'TB1', 'TB2', 'PS1']);
  assert.equal(w.ret[0].terminal, 'COM', 'the input common first');
  assert.match(w.ret[0].note!, /common/);
  assert.equal(w.ret[2].terminal, '5');
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
  assert.equal(w.signal[0].measure!.expect, 'about 0 V');
  assert.match(w.signal[0].measure!.when, /sinking/);
  assert.deepEqual(tags(w.supply).slice(0, 3), ['OL1', 'SR1', 'PS1']);
  assert.match(w.supply[0].measure!.expect, /24 VDC/, 'a reading at the overload contact');
  assert.ok(!w.supply.some((h) => /^M1-/.test(h.wire ?? '')), 'no motor power poles in the coil supply');
});

test('example: solenoid output Y002 into JB1, return on 24+S at TB3-2', () => {
  const w = wiringPath(ex, 'Y002')!;
  assert.deepEqual(tags(w.signal), ['PLC', 'TB3', 'W002', 'JB1', 'W006', 'SOL1']);
  assert.equal(w.supply[0].tag, 'TB3');
  assert.equal(w.supply[0].terminal, '2');
  assert.equal(w.supply[0].wire, '24+S');
  assert.match(w.supply[0].measure!.when, /safety circuit is OK/);
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
  assert.equal(w.supply[1].tag, 'PS1');
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

test('photo-eye never ON: good at the sensor, bad at TB2 → open between TB2-1 and PE1 on wire X004', () => {
  const { s, asked } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'no', 'no', 'yes']);
  assert.deepEqual(asked, ['prepare', 'signal:PLC', 'signal:TB2', 'signal:PE1']);
  assert.match(s.verdict!.text, /Open connection on wire X004 between Terminal strip TB2, terminal 1 and PE1/);
  assert.equal(s.verdict!.wire, 'X004');
});

test('photo-eye never ON: no signal anywhere, supply good at TB2-4 → the sensor is not switching', () => {
  const { s, asked } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'no', 'no', 'no', 'yes']);
  assert.equal(asked[4], 'supply:TB2');
  assert.match(s.verdict!.text, /PE1 has its supply but gives no signal/);
});

test('photo-eye never ON: supply missing at TB2-4, good at PS1 → open on 24+ between them', () => {
  const { s } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'no', 'no', 'no', 'no', 'yes']);
  assert.match(s.verdict!.text, /supply is good at PS1.*missing at Terminal strip TB2, terminal 4/);
});

test('24 V at the PLC terminal → the wiring is good, check the PLC side', () => {
  const { s } = play(wiringPath(ex, 'X004')!, 'never-on', ['yes', 'yes']);
  assert.match(s.verdict!.text, /field wiring is good/);
});

test('solenoid Y002 dead: output good out to SOL1, 24+S good at TB3-2 → the valve itself', () => {
  const { s, asked } = play(wiringPath(ex, 'Y002')!, 'output-dead', ['yes', 'yes', 'yes', 'yes', 'yes']);
  assert.deepEqual(asked, ['prepare', 'signal:PLC', 'signal:TB3', 'signal:SOL1', 'supply:TB3']);
  assert.match(s.verdict!.text, /SOL1 has power on both sides but does not work/);
});

test('solenoid Y002 dead: good at TB3-1, bad at the valve → open on Y002 between them', () => {
  const { s } = play(wiringPath(ex, 'Y002')!, 'output-dead', ['yes', 'yes', 'yes', 'no']);
  assert.match(s.verdict!.text, /Open connection on wire Y002 between Terminal strip TB3, terminal 1 and SOL1/);
});

test('Sealing Head: down solenoid dead behind the two-hand relay contact → the contact blocks it', () => {
  const w = shPaths.find((x) => x.type === 'output' && /down solenoid/i.test(x.description))!;
  const { s } = play(w, 'output-dead', ['yes', 'yes', 'yes', 'no']);
  assert.match(s.verdict!.text, /SR\d blocks the signal/);
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
  assert.match(s.verdict!.text, /between PLC terminal X004 and PE1/);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
