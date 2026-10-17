/// <reference types="node" />
/**
 * Rule-based electrical engine: golden designs for the example and test machines, and the design
 * checks every generated design must pass. Run with:  npx tsx src/electrical/engine/engine.test.ts
 * Regenerate the goldens after an intended change:  UPDATE=1 npx tsx src/electrical/engine/engine.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDefaultDesign, type EngineResult } from './index';
import { defaultMachineModel } from './machineModel';
import { getPart } from '../catalog';
import { bomCsv, buildModel, designWarnings, doorDrilling, panelLayout, plcRack, spareSpace, vendorTerminal, type DrawingContext } from '../derive';
import { cabinetHeat } from '../thermal';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { SPEC } from '../../preview/sampleProject';
import { specToText } from '../../spec/types';
import type { IOPoint } from '../../types/io';
import type { DesignInputs, MotorSpec, SupplyVoltage } from '../types';
import type { Region } from '../../standards/regions';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
type P = Omit<IOPoint, 'id' | 'category'> & { category?: IOPoint['category'] };
const pt = (description: string, type: 'input' | 'output', extra: Partial<P> = {}): P => ({ description, type, ...extra });

interface Scenario {
  name: string; points: P[]; supply: SupplyVoltage; region?: Region; motors?: MotorSpec[];
  cpu?: string; modules?: string[]; hmi?: string | null; spec?: string; rating?: DesignInputs['enclosureRating'];
  /** PLC profile (default CLICK). */
  profile?: string;
  /** Largest catalog enclosure is still under 25% spare: everything must fit, spare may be lower. */
  tight?: boolean;
}

const EXAMPLE: P[] = [
  pt('E-Stop OK (safety relay)', 'input'), pt('Start Button', 'input'), pt('Stop Button', 'input'),
  pt('Part at end photo-eye', 'input'), pt('Pusher extended', 'input'), pt('Pusher retracted', 'input'),
  pt('Conveyor motor contactor', 'output'), pt('Pusher solenoid', 'output'), pt('Main air dump valve', 'output'),
];
const motor = (tag: string, description: string, hp: number, voltage: SupplyVoltage, starter: MotorSpec['starter'] = 'contactor-overload', reversing = false): MotorSpec => ({ tag, description, hp, voltage, starter, reversing });

const BIG: P[] = [
  ...EXAMPLE.filter((p) => p.type === 'input'),
  pt('Auto/Manual selector', 'input'), pt('Reset PB', 'input'),
  ...Array.from({ length: 24 }, (_, i) => pt(`${i < 12 ? 'Infeed' : 'Outfeed'} part present ${i + 1}`, 'input', { deviceType: 'sensor-pnp' })),
  ...[1, 2, 3, 4].map((n) => pt(`Belt ${n} VFD fault`, 'input')),
  ...EXAMPLE.filter((p) => p.type === 'output'),
  pt('Pump motor contactor', 'output'),
  ...[1, 2, 3, 4].map((n) => pt(`Belt ${n} VFD run`, 'output')),
  ...Array.from({ length: 8 }, (_, i) => pt(`${i < 4 ? 'Infeed' : 'Outfeed'} diverter ${i + 2} solenoid`, 'output')),
  pt('Running light', 'output'), pt('Fault light', 'output'), pt('Stack light red', 'output'), pt('Stack light green', 'output'),
];

const SCENARIOS: Scenario[] = [
  { name: 'example', points: EXAMPLE, supply: '480VAC-3PH', motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH')], hmi: 'CM5-T7W', spec: specToText(SPEC) },
  {
    name: 'big', tight: true, points: BIG, supply: '480VAC-3PH', cpu: 'C0-11DD1E-D', modules: ['C0-16ND3', 'C0-16ND3', 'C0-16TD1'], hmi: 'CM5-T10W',
    motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH'), motor('M2', 'Pump motor', 3, '480VAC-3PH'), ...[1, 2, 3, 4].map((n) => motor(`M${n + 2}`, `Belt ${n} motor`, 5, '480VAC-3PH', 'vfd'))],
    spec: 'Sorter line: infeed and outfeed conveyors, belts on drives, diverters.',
  },
  {
    name: 'analog', supply: '480VAC-3PH', modules: ['C0-04AD-1', 'C0-04DA-1'], motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH')], hmi: 'CM5-T7W',
    points: [...EXAMPLE,
      pt('Tank level', 'input', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }),
      pt('Tank temperature', 'input', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 150, units: 'C' } }),
      pt('Pump speed reference', 'output', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 60, units: 'Hz' } })],
  },
  { name: 'eu400', points: EXAMPLE, supply: '400VAC-3PH', region: 'EU', motors: [motor('M1', 'Conveyor motor', 1.5, '400VAC-3PH')], spec: specToText(SPEC) },
  {
    // No motor list: the motors come from the I/O list; a reversing drive, a DOL lift, a guard door and a light curtain.
    name: 'vfd', supply: '480VAC-3PH', hmi: null, modules: ['C0-08TD1'],
    spec: 'Infeed conveyor on a VFD that can reverse. Lift motor 2 HP. Interlocked guard door on the lift. Light curtain at the infeed.',
    points: [
      pt('E-stop pressed', 'input'), pt('Safety OK', 'input'), pt('Start PB', 'input'), pt('Stop PB', 'input'),
      pt('Infeed conveyor VFD fault', 'input'), pt('Lift up limit switch', 'input'), pt('Lift down limit switch', 'input'), pt('Air pressure switch', 'input'),
      pt('Infeed conveyor VFD run', 'output'), pt('Infeed conveyor VFD reverse', 'output'), pt('Lift motor 2 HP run', 'output'),
      pt('Gripper clamp solenoid', 'output'), pt('Gripper unclamp solenoid', 'output'), pt('Ready signal to robot', 'output'), pt('Fault light', 'output'),
    ],
  },
  { name: 'ca600', points: EXAMPLE, supply: '600VAC-3PH', region: 'Canada', motors: [motor('M1', 'Conveyor motor', 2, '600VAC-3PH')] },
  { name: 'us120', points: EXAMPLE, supply: '120VAC-1PH', motors: [motor('M1', 'Conveyor motor', 0.5, '120VAC-1PH')], hmi: null },
  {
    // A project copied from the example: the motor list still has the example's conveyor motor, the new spec has none.
    name: 'sealing-head-from-example', supply: '480VAC-3PH', hmi: null, modules: ['C0-08TD1'],
    spec: 'Sealing head: film comes off an unwinder (small gear motor, run output), a heated sealing bar (heater on a contactor, temperature switch) is closed by a pneumatic head cylinder. The operator presses both palm buttons, the head comes down, seals for the dwell time and opens.',
    motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH')],
    points: [pt('Safety OK', 'input'), pt('Left palm button', 'input', { deviceType: 'pushbutton-no' }), pt('Right palm button', 'input', { deviceType: 'pushbutton-no' }),
      pt('Head up sensor', 'input'), pt('Head down sensor', 'input'), pt('Sealing bar temperature OK', 'input'),
      pt('Unwinder motor run', 'output'), pt('Heater contactor', 'output'), pt('Head down solenoid', 'output'), pt('Head up solenoid', 'output')],
  },
  {
    // The harness's sealing head (tools/harness/variants.ts rules-sealing): two-hand start, light curtain, heater on an SSR with a thermocouple.
    name: 'sealing-head', supply: '480VAC-3PH', cpu: 'C0-12DD1E-D', modules: ['C0-16ND3', 'C0-08TD1'],
    spec: 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple. The film comes off an unwinder driven by a 0.5 HP motor on a VFD. CLICK PLC with a C-more 7" touch panel; the operator sets the seal temperature and the dwell time on the HMI. 480 V 3-phase supply.',
    points: [
      pt('Safety relay OK (E-stop and light curtain)', 'input', { deviceType: 'safety-relay-output' }), pt('Two-hand start button left', 'input', { deviceType: 'pushbutton-no' }),
      pt('Two-hand start button right', 'input', { deviceType: 'pushbutton-no' }), pt('Light curtain clear (OSSD)', 'input', { deviceType: 'other' }),
      pt('Stop button', 'input', { deviceType: 'pushbutton-nc' }), pt('Fault reset button', 'input', { deviceType: 'pushbutton-no' }),
      pt('Sealing head up (retracted)', 'input', { deviceType: 'sensor-pnp' }), pt('Sealing head down (sealing position)', 'input', { deviceType: 'sensor-pnp' }),
      pt('Air pressure OK', 'input', { deviceType: 'pressure-switch' }), pt('Heater over-temperature limit tripped', 'input', { deviceType: 'other' }),
      pt('Unwinder VFD fault', 'input', { deviceType: 'vfd-input' }), pt('Film roll low sensor', 'input', { deviceType: 'sensor-pnp' }),
      pt('Seal heater temperature (thermocouple transmitter)', 'input', { deviceType: 'other', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } }),
      pt('Sealing head down solenoid', 'output', { deviceType: 'solenoid' }), pt('Sealing head up solenoid', 'output', { deviceType: 'solenoid' }),
      pt('Seal heater on (SSR)', 'output', { deviceType: 'other' }), pt('Unwinder VFD run', 'output', { deviceType: 'vfd-input' }),
      pt('Machine running light', 'output', { deviceType: 'pilot-light' }), pt('Fault light', 'output', { deviceType: 'pilot-light' }),
      pt('Unwinder speed reference', 'output', { deviceType: 'other', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }),
    ],
  },
  {
    // Unitronics all-in-one: V700 (7" screen, no on-board I/O) with a V200-18-E3XB snap-in; the screen is the HMI.
    name: 'unitronics-v700', supply: '480VAC-3PH', profile: 'unitronics-vision', cpu: 'V700-T20BJ', modules: ['V200-18-E3XB'], hmi: 'V700-T20BJ',
    spec: 'Sealing head with a Unitronics V700 PLC + HMI: two-hand start, light curtain, heater with thermocouple, unwinder 0.5 HP on a VFD. 480 V 3-phase supply.',
    points: [] as P[],
  },
  {
    // UniStream US7 with on-board I/O (10 DI, 8 relay + 2 npn, 2 AI) running the example conveyor.
    name: 'unitronics-us7', supply: '480VAC-3PH', profile: 'unitronics-unistream', cpu: 'US7-B10-TR22', hmi: 'US7-B10-TR22',
    motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH')], spec: specToText(SPEC), points: EXAMPLE,
  },
  {
    name: 'reversing240', supply: '240VAC-3PH', hmi: null, rating: 'NEMA 4',
    points: [pt('E-stop OK', 'input'), pt('Open PB', 'input'), pt('Close PB', 'input'), pt('Stop PB', 'input'), pt('Gate open limit switch', 'input'), pt('Gate closed limit switch', 'input'),
      pt('Gate motor forward', 'output'), pt('Gate motor reverse', 'output'), pt('Gate moving light', 'output')],
    motors: [motor('M1', 'Gate motor', 3, '240VAC-3PH', 'contactor-overload', true)],
  },
];

SCENARIOS.find((x) => x.name === 'unitronics-v700')!.points = SCENARIOS.find((x) => x.name === 'sealing-head')!.points;

function run(s: Scenario): { r: EngineResult; ctx: DrawingContext } {
  const io = s.points.map((p, i) => ({ category: 'Operator/HMI', ...p, id: `p${i + 1}` })) as IOPoint[];
  const profile = getProfile(s.profile ?? 'click');
  const cpu = getCpu(profile, s.cpu ?? 'C0-10DD1E-D');
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(s.modules ?? []));
  const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label };
  const inputs: DesignInputs = { supply: s.supply, enclosureRating: s.rating ?? 'NEMA 12', notes: '', motors: s.motors ?? [], requiredParts: [] };
  const hmi = s.hmi === undefined ? 'CM5-T7W' : s.hmi;
  const r = generateDefaultDesign({ io, addresses, spec: s.spec ?? '', inputs, plc, modules: s.modules ?? [], region: s.region ?? 'US', getPart, hmiPartNumber: hmi, now: '2026-01-01T00:00:00.000Z', projectName: s.name });
  const ctx: DrawingContext = { projectName: s.name, design: r.design, getPart, plc, io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })), region: s.region ?? 'US', hmiPartNumber: hmi };
  return { r, ctx };
}

function golden(r: EngineResult): string {
  const d = r.design;
  return [
    `supply ${d.inputs.supply} | ${d.inputs.enclosureRating}`,
    ...d.inputs.motors.map((m) => `motor ${m.tag} ${m.hp} HP ${m.starter}${m.reversing ? ' reversing' : ''} — ${m.description}`),
    '', ...d.components.map((c) => `${c.tag.padEnd(8)} ${c.partNumber.padEnd(18)} x${String(c.quantity).padEnd(4)} ${c.function}${c.motorTag ? ` [${c.motorTag}]` : ''}`),
    '', ...d.ioWiring.map((w) => `${w.address.padEnd(6)} ${w.deviceTag.padEnd(6)} ${w.deviceType.padEnd(20)} ${(w.location ?? '').padEnd(14)} ${w.description}`),
    '', `zones ${JSON.stringify(d.machine?.zones)}`, `junctionBoxes ${JSON.stringify(d.machine?.junctionBoxes)}`, `motorLocations ${JSON.stringify(d.machine?.motorLocations)}`, `routing ${JSON.stringify(d.machine?.routing)}`,
    '', ...d.notes.map((n) => `note: ${n}`), '', `explanation: ${r.explanation}`, '',
  ].join('\n');
}

/** Design-warning texts that flag a real gap (the rest are standing reminders: SCCR, wire sizes, cable lengths…). */
const GAP = /no (main disconnect|enclosure|24VDC|branch|contactor|overload|ground bar|safety relay|PLC output|reset)|not found in the catalog|over capacity|below the motor|differs from supply|without wiring|not in the project I\/O|needs two contactors|does not fit|overflow|input rated|primary rated/i;

let failures = 0;
for (const s of SCENARIOS) {
  const { r, ctx } = run(s);
  const g = golden(r);
  const file = path.join(FIX, `engine-${s.name}.txt`);
  if (process.env.UPDATE) { fs.mkdirSync(FIX, { recursive: true }); fs.writeFileSync(file, g); }
  try {
    assert.equal(g, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), `${s.name}: golden differs (UPDATE=1 to regenerate after an intended change)`);
    const gaps = designWarnings(ctx).filter((w) => GAP.test(w));
    assert.deepEqual(gaps, [], `${s.name}: design gaps`);
    assert.ok(r.layoutOk || s.tight, `${s.name}: panel layout does not fit with 25% spare`);
    assert.ok(spareSpace(ctx).panel >= (s.tight ? 0.1 : 0.25), `${s.name}: spare space`);
    // Every discrete PLC point is wired to a device.
    const discrete = ctx.io.filter((p) => p.address && !/^DF/.test(p.address));
    assert.equal(r.design.ioWiring.length, discrete.length, `${s.name}: ioWiring per I/O point`);
    assert.ok(r.design.ioWiring.every((w) => w.deviceTag), `${s.name}: device tags`);
  } catch (e) { failures++; console.error(String(e instanceof Error ? e.message : e)); }
}

// Specific engineering rules
{
  const ex = run(SCENARIOS[0]).r.design;
  const pn = (tag: string) => ex.components.find((c) => c.tag === tag)?.partNumber;
  // Same choices as the hand-made example design (whose 24x20 panel no longer fits the terminal strips: 30x24 here).
  assert.deepEqual(['ENC1', 'DS1', 'CB1', 'CB2', 'PS1', 'K1', 'OL1', 'K1-AUX', 'SR1', 'ES1', 'PB1', 'PB2', 'PB3'].map(pn),
    ['SCE-30EL2410LP', '22013003', 'GMCBU-3C-5', 'GMCBU-3C-3', 'PSR-24-120-3', 'SC-E02PG-24VDC', 'TK-E02-220', 'SZ-A11T', 'LG5925-48-61-24', 'GCX1131', 'GCX1102', 'GCX1101', 'GCX1104']);
  assert.match(ex.components.find((c) => c.tag === 'PB3')?.function ?? '', /^Safety reset — /);
  // Every rule-picked power / safety part says why it was chosen.
  for (const t of ['ENC1', 'DS1', 'CB1', 'CB2', 'PS1', 'K1', 'OL1', 'K1-AUX', 'SR1', 'ES1']) assert.match(ex.components.find((c) => c.tag === t)?.function ?? '', / — /, `${t}: no reason in its function`);

  const vfd = run(SCENARIOS.find((s) => s.name === 'vfd')!).r.design;
  const drive = vfd.components.find((c) => c.tag === 'VFD1')!;
  assert.match(drive.function, /STO from safety relay/);
  assert.match(drive.partNumber, /^GS23-4/);
  assert.ok(vfd.inputs.motors.find((m) => m.starter === 'vfd')?.reversing, 'drive with a reverse output runs both ways');
  assert.equal(vfd.ioWiring.filter((w) => w.deviceTag === 'VFD1').length, 3, 'run, reverse and fault on VFD1');
  const clamp = vfd.ioWiring.filter((w) => /clamp/i.test(w.description));
  assert.equal(new Set(clamp.map((w) => w.deviceTag)).size, 1, 'clamp / unclamp coils on one double-solenoid valve');
  assert.equal(vfd.components.find((c) => c.tag === clamp[0].deviceTag)?.partNumber, '100222016324002');
  assert.ok(vfd.ioWiring.some((w) => w.deviceType === 'relay-coil' && /robot/i.test(w.description) && /^CR/.test(w.deviceTag)), 'robot handshake through an interposing relay');
  // The guard door is a real interlock switch with its actuator, not a note.
  assert.ok(vfd.components.some((c) => /^GS\d$/.test(c.tag) && c.partNumber === 'KM-203002') && vfd.notes.some((n) => /^GS\d: confirm the guard door/.test(n)));
  // The light curtain is a real part with its OSSD relay and cables, not a note.
  assert.ok(vfd.components.some((c) => /^LC\d/.test(c.tag) && /^SH4-14-/.test(c.partNumber)) && vfd.components.some((c) => c.partNumber === 'LG5925-48-900-61'), 'light curtain + OSSD relay');
  assert.equal(vfd.components.find((c) => /^LC\dW$/.test(c.tag))?.quantity, 2, 'two cables per curtain');
  assert.equal(vfd.components.find((c) => c.tag === 'SR1')?.partNumber, 'LG5925-48-61-24', 'SR1 stays the E-stop relay');

  const ca = run(SCENARIOS.find((s) => s.name === 'ca600')!).r.design;
  assert.ok(ca.components.some((c) => c.partNumber === 'EHCC3DU' && c.motorTag === 'M1'), 'Canada: motor branch on Class CC fuses');
  assert.ok(ca.components.some((c) => /^CT-\d+-060-12/.test(c.partNumber)), '600 V: 600 V-primary control transformer');

  const rev = run(SCENARIOS.find((s) => s.name === 'reversing240')!).r.design;
  assert.ok(rev.components.some((c) => c.partNumber === 'SZ-RM'), 'reversing: mechanical interlock');
  assert.deepEqual(rev.ioWiring.filter((w) => w.deviceType === 'contactor-coil').map((w) => w.deviceTag), ['K1', 'K2']);
  assert.equal(rev.components.find((c) => c.tag === 'DS1H')?.partNumber, '148D1111', 'NEMA 4: NEMA 4 handle');

  const eu = run(SCENARIOS.find((s) => s.name === 'eu400')!).r.design;
  assert.ok(eu.components.some((c) => /^PSR-24-\d+-3$/.test(c.partNumber)), '400 V: 3-phase supply');
}

// Unitronics all-in-ones: the PLC is the door's panel (its own cutout, no second HMI, not on the back panel);
// the I/O columns carry the maker's terminal names; relay outputs drawn as relay, the npn points named.
{
  for (const [name, pn, cut] of [['unitronics-v700', 'V700-T20BJ', [193, 125]], ['unitronics-us7', 'US7-B10-TR22', [196, 134]]] as const) {
    const { r, ctx } = run(SCENARIOS.find((x) => x.name === name)!);
    const L = panelLayout(ctx);
    const panels = L.door.items.filter((d) => d.kind === 'hmi');
    assert.deepEqual(panels.map((d) => `${d.tag} ${d.partNumber} ${d.cutout?.w}x${d.cutout?.h}`), [`PLC ${pn} ${cut[0]}x${cut[1]}`], `${name}: the PLC is the one door panel`);
    assert.ok(!L.door.items.some((d) => d.kind !== 'hmi' && d.tag === 'PLC') && !L.items.some((i) => i.tag === 'PLC'), `${name}: PLC not also an operator or on the back panel`);
    assert.equal(bomCsv(ctx).split('\n').filter((l) => l.includes(pn)).length, 1, `${name}: one BOM line for PLC + screen`);
    assert.equal(buildModel(ctx).hmi, undefined, `${name}: no separate panel feed / link`);
    assert.equal(r.design.ioWiring.length, ctx.io.filter((p) => p.address && !/^DF/.test(p.address)).length);
  }
  const us7 = run(SCENARIOS.find((x) => x.name === 'unitronics-us7')!);
  assert.deepEqual(plcRack(us7.ctx).map((s) => `${s.partNumber} ${s.inputs}/${s.outputs} ${s.outputStyle}`), ['US7-B10-TR22 10/10 relay'], 'TR22: relay outputs (O8 / O9 npn named in the notes)');
  assert.equal(vendorTerminal(getPart('US7-B10-TR22'), 'X001'), 'I0');
  assert.equal(vendorTerminal(getPart('V200-18-E3XB'), 'Y103'), 'O2');
  assert.equal(vendorTerminal(getPart('C0-10DD1E-D'), 'X001'), null, 'CLICK keeps its own addresses');
  assert.ok(us7.r.design.notes.some((n) => /US7-B10-TR22 inputs .*wired sinking for the pnp sensors/.test(n)));
  const v7 = run(SCENARIOS.find((x) => x.name === 'unitronics-v700')!);
  assert.deepEqual(plcRack(v7.ctx).map((s) => `${s.slot} ${s.partNumber} ${s.inputs}/${s.outputs} ${s.outputStyle}`), ['0 V700-T20BJ 0/0 sourcing', '1 V200-18-E3XB 18/17 relay']);
  assert.ok(v7.r.design.components.some((c) => c.tag === 'IO1' && /^Snap-in I\/O module/.test(c.function)));
  // Twelve outputs on a V350-35-TR34: the 8 relays first, then the npn O0–O3 — named as such.
  const v350 = run({ ...SCENARIOS.find((x) => x.name === 'unitronics-v700')!, name: 'v350', cpu: 'V350-35-TR34', modules: [], hmi: 'V350-35-TR34',
    points: [...EXAMPLE, ...Array.from({ length: 7 }, (_, i) => pt(`Diverter ${i + 1} solenoid`, 'output'))] });
  assert.ok(v350.r.design.notes.some((n) => /V350-35-TR34: Y001 \(O0\) Diverter 6 solenoid, Y002 \(O1\) Diverter 7 solenoid on npn transistor outputs \(0\.1 A max/.test(n)), v350.r.design.notes.join('\n'));
}

// A project copied from the example: the example's conveyor motor is left out and asked about; the unwinder comes from the I/O list.
{
  const r = run(SCENARIOS.find((x) => x.name === 'sealing-head-from-example')!).r;
  const d = r.design;
  assert.deepEqual(d.inputs.motors.map((m) => m.description), ['Unwinder motor'], 'only the unwinder');
  assert.ok(!d.components.some((c) => /conveyor/i.test(c.function)), 'nothing from the example conveyor');
  assert.ok(d.askUser?.some((q) => /M1 Conveyor motor .* not in the machine description/.test(q)), 'left-over motor asked about');
  assert.ok(!/example/i.test(r.explanation));
  const heater = d.ioWiring.find((w) => w.description === 'Heater contactor')!;
  assert.equal(heater.deviceType, 'contactor-coil');
  const unwinderK = d.ioWiring.find((w) => w.description === 'Unwinder motor run')!.deviceTag;
  assert.notEqual(heater.deviceTag, unwinderK, 'the heater contactor is its own, not the unwinder motor\'s');
  assert.ok(d.askUser?.some((q) => /^Heater contactor: heater power not given/.test(q)), 'its load is asked about');
  assert.ok(d.components.some((c) => c.tag === heater.deviceTag && /^Heater|HTR1/.test(c.function) && /AC-1/.test(c.function)), 'an AC-1 rated heater contactor');
  // An overload input without "trip" / "fault" in its text is the motor's overload contact.
  const ol = run({ ...SCENARIOS.find((x) => x.name === 'sealing-head-from-example')!, name: 'ol', points: [...SCENARIOS.find((x) => x.name === 'sealing-head-from-example')!.points, pt('Unwinder motor overload', 'input')] }).r.design;
  const olW = ol.ioWiring.find((w) => w.description === 'Unwinder motor overload')!;
  assert.ok(ol.components.some((c) => c.tag === olW.deviceTag && /overload/i.test(c.function)), `overload input wired to the unwinder's overload relay (got ${olW.deviceTag})`);
  // The motor list says contactor, the I/O list runs it on a drive: the drive is a real component (no orphan VFD tag).
  const seal = SCENARIOS.find((x) => x.name === 'sealing-head')!;
  const sd = run({ ...seal, name: 'seal-motor-list', motors: [motor('M1', 'Unwinder motor', 1, '480VAC-3PH')] }).r.design;
  const vfdTags = new Set(sd.ioWiring.filter((w) => w.deviceType === 'vfd-input').map((w) => w.deviceTag));
  assert.ok(vfdTags.size === 1 && [...vfdTags].every((t) => sd.components.some((c) => c.tag === t && /GS2/.test(c.partNumber))), `drive component for ${[...vfdTags].join(', ')}`);
  assert.ok(sd.askUser?.some((q) => /runs it through a VFD/.test(q)), 'the starter change is asked about');
  // The example itself keeps its motor (the spec mentions the conveyor motor).
  assert.equal(run(SCENARIOS[0]).r.design.inputs.motors.length, 1);
}

// No catalog enclosure fits the back panel: the closest one is used (fewest parts left out, a door that holds the
// HMI and operators clear of its edges), not the smallest.
{
  const big = SCENARIOS.find((x) => x.name === 'big')!;
  const over = { ...big, name: 'big-overflow', motors: [...big.motors!, ...[5, 6, 7, 8, 9, 10].map((n) => motor(`M${n + 2}`, `Belt ${n} motor`, 5, '480VAC-3PH', 'vfd'))] };
  const { r, ctx } = run(over);
  const L = panelLayout(ctx);
  const enc = r.design.components.find((c) => c.tag === 'ENC1')!;
  // With the large catalog enclosures (Dev 1, 72x72 double door) this machine may now fit; either way the
  // choice must not fall back to the smallest enclosure and the door must hold the HMI and operators.
  assert.notEqual(enc.partNumber, 'SCE-16EL1206LP', 'not the smallest enclosure');
  assert.ok(!L.door.overflow, `big-overflow: door fits (${enc.partNumber})`);
  assert.ok(L.door.items.every((d) => d.cx - d.w / 2 >= 25 && d.cx + d.w / 2 <= L.enclosure.w - 25 && d.cy - d.h / 2 >= 25 && d.cy + d.h / 2 <= L.enclosure.h - 25), 'door items 25 mm clear of the edges');
  // The door check itself: the 10" HMI on a 16x12 door does not fit.
  const small = { ...ctx, design: { ...ctx.design, components: ctx.design.components.map((c) => (c.tag === 'ENC1' ? { ...c, partNumber: 'SCE-16EL1206LP' } : c)) } };
  assert.ok(panelLayout(small).door.overflow, '16x12 door too small for CM5-T10W and the operators');
  // A real overflow: NEMA 4X needs stainless, and the catalog's stainless enclosures stop at 20x16.
  // The closest one is used (fewest parts left out), not the smallest, and the layout says it does not fit.
  const ss = run({ ...big, name: 'big-4x', rating: 'NEMA 4X' });
  const ssEnc = ss.r.design.components.find((c) => c.tag === 'ENC1')!;
  assert.ok(!ss.r.layoutOk, 'big-4x: no stainless enclosure fits');
  assert.equal(ssEnc.partNumber, 'SCE-20EL1608SSLP', 'big-4x: the largest stainless enclosure, not the 16x12');
  assert.ok(panelLayout(ss.ctx).notFit.length > 0 || panelLayout(ss.ctx).overflow, 'big-4x: the layout reports what does not fit');

  // Floor-standing double door on 12in stands: devices on one leaf (never across the split), 0.6–1.7 m above
  // the floor; the door plan is that leaf; the thermal area leaves out the bottom.
  const sub = getPart(enc.partNumber)?.ratings.subpanel;
  const fl = { ...ctx, design: { ...ctx.design, components: ctx.design.components.map((c) => (c.tag === 'ENC1' ? { ...c, partNumber: 'SCE-72EL7218LPPL' } : c.partNumber === sub ? { ...c, partNumber: 'SCE-72P72' } : c)) } };
  const F = panelLayout(fl).door;
  assert.equal(F.leaves.length, 2, 'two door leaves');
  assert.ok(Math.abs((F.plinth ?? 0) - 304.8) < 0.1, '12in floor stands');
  const lf = F.leaves[F.leaf];
  assert.ok(F.items.every((d) => d.cx - d.w / 2 >= lf.x0 + 25 && d.cx + d.w / 2 <= lf.x1 - 25), 'door devices on one leaf, clear of the split');
  assert.ok(!F.handle || (F.handle.cx > lf.x0 && F.handle.cx < lf.x1), 'handle on the same leaf');
  const above = (y: number) => F.h + F.plinth! - y;
  assert.ok(F.items.every((d) => above(d.cy - d.h / 2) <= 1700.5 && (d.kind === 'hmi' || above(d.cy) >= 600)), 'devices 0.6–1.7 m above the floor');
  const dd = doorDrilling(fl);
  assert.ok(Math.abs(dd.w - (lf.x1 - lf.x0)) < 0.1 && dd.cutouts.every((c) => c.x > 0 && c.x < dd.w), 'door plan = the leaf, leaf-relative X');
  const heat = (pn: string) => cabinetHeat([{ tag: 'ENC1', partNumber: pn, quantity: 1 }], getPart).area!;
  assert.ok(heat('SCE-72EL7218LPPL') < 1.83 * 1.83 + 2 * 1.83 * 0.457 + 2 * 1.83 * 0.457 - 0.5, 'floor-standing: bottom not in the cooling area');
}

// Guard doors and pressure switches come from the catalog: the interlock (+ actuator) in series with the E-stops
// in both channels of SR1, its N.O. 33-34 to a "door closed" input; the pressure switch on its DIN pins C=1 / NO=3.
{
  const v = SCENARIOS.find((x) => x.name === 'vfd')!;
  const { r, ctx } = run({ ...v, name: 'vfd-guard', points: v.points.map((q) => (q.description === 'Lift down limit switch' ? pt('Lift guard door closed', 'input') : q)) });
  const d = r.design;
  const gs = d.components.find((c) => /^GS\d/.test(c.tag))!;
  assert.equal(gs?.partNumber, 'KM-203002', 'guard interlock from the catalog');
  assert.ok(d.components.some((c) => c.tag === `${gs.tag}A` && c.partNumber === '140107'), 'its actuator');
  assert.ok(!d.askUser?.some((q) => /not drawn yet/.test(q)), 'no "not drawn" question');
  assert.equal(d.ioWiring.find((w) => /guard door closed/i.test(w.description))?.deviceTag, gs.tag, 'door-closed input on the interlock');
  const m = buildModel(ctx);
  assert.deepEqual(m.safety.guards, [gs.tag]);
  for (const [a, b] of [['S11', '11'], ['S21', '21']]) assert.ok(m.wires.some((w) => w.wire.startsWith(a) && w.to === `${gs.tag}:${b}`), `${a} channel through ${gs.tag}`);
  assert.ok(m.wires.some((w) => w.from === `${gs.tag}:12` && w.to.endsWith(':S12')), 'channel 1 back to the relay after the guard');
  const door = m.io.find((p) => /guard door closed/i.test(p.description))!;
  assert.ok(m.wires.some((w) => w.wire === door.address && w.from === `${gs.tag}:34`), 'monitoring contact 33-34 to the PLC');
  const prs = d.components.find((c) => /^PRS\d/.test(c.tag))!;
  assert.equal(prs?.partNumber, 'MPS25-1C-D100D', 'mechanical pressure switch');
  assert.ok(m.wires.some((w) => w.from === `${prs.tag}:3`) && m.wires.some((w) => w.to === `${prs.tag}:1`), 'pressure switch wired on its DIN pins (C=1, NO=3)');
}

// The default model reads motors from the I/O list when there is no motor list.
{
  const io = [pt('Mixer motor 7.5 kW run', 'output'), pt('Pump run', 'output')].map((p, i) => ({ category: 'Process', ...p, id: `x${i}` })) as IOPoint[];
  const m = defaultMachineModel(io, { supply: '400VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] });
  assert.equal(m.motors.length, 2);
  assert.ok(Math.abs(m.motors[0].hp - 10.06) < 0.1, 'kW converted to HP');
  assert.ok(m.assumptions.some((a) => /Pump.*assumed 1 HP/.test(a)));
}

if (failures) { console.error(`${failures} scenario(s) failed`); process.exit(1); }
console.log('engine tests passed');
