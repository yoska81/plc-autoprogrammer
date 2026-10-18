/// <reference types="node" />
/**
 * Rule-based electrical engine: golden designs for the example and test machines, and the design
 * checks every generated design must pass. Run with:  npx tsx src/electrical/engine/engine.test.ts
 * Regenerate the goldens after an intended change:  UPDATE=1 npx tsx src/electrical/engine/engine.test.ts
 */
import { missingOperatorIo } from '../../spec/operatorIo';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDefaultDesign, type EngineResult } from './index';
import { defaultMachineModel, drivesFromIo, type MachineModel } from './machineModel';
import { CATALOG, getPart } from '../catalog';
import { bomCsv, buildModel, cableSchedule, chooseEnclosure, designWarnings, doorDrilling, enclosureFitProblem, enclosureSize, enclosuresFor, layoutFits, panelLayout, plcRack, spareSpace, SPARE_RULE, vendorTerminal, withEnclosure, type DrawingContext } from '../derive';
import { cabinetHeat } from '../thermal';
import { fanAirflowM3h } from '../cooling';
import { engineerChecks } from '../../engineer/checks';

const IO0 = { inputs: 0, outputs: 0, capInputs: 0, capOutputs: 0 };
import { panelSccr } from '../sccr';
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
  /** Largest catalog enclosure is still under the spare-space rule: everything must fit, spare may be lower. */
  tight?: boolean;
  /** Parts the designer chose (equipment list). */
  required?: DesignInputs['requiredParts'];
  /** Enclosure the designer picked (Electrical page "Enclosure"). */
  enclosure?: string;
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
  const inputs: DesignInputs = { supply: s.supply, enclosureRating: s.rating ?? 'NEMA 12', notes: '', motors: s.motors ?? [], requiredParts: s.required ?? [], ...(s.enclosure ? { enclosurePreference: s.enclosure } : {}) };
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
    assert.ok(r.layoutOk || s.tight, `${s.name}: panel layout does not fit with the spare-space rule`);
    assert.ok(spareSpace(ctx).panel >= (s.tight ? 0.1 : SPARE_RULE), `${s.name}: spare space`);
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
  // NEMA 4X needs stainless: the larger stainless enclosures (up to 36x30) hold the big machine; the engine
  // never leaves parts off when a stainless enclosure fits.
  const ss = run({ ...big, name: 'big-4x', rating: 'NEMA 4X' });
  const ssEnc = getPart(ss.r.design.components.find((c) => c.tag === 'ENC1')!.partNumber)!;
  assert.match(String(ssEnc.ratings.material), /stainless/, 'big-4x: a stainless enclosure');
  assert.ok(ss.r.layoutOk || (layoutFits(ss.ctx) && ss.r.design.notes.some((n) => /% spare/.test(n))), `big-4x: everything fits in ${ssEnc.partNumber}`);
  assert.equal(enclosureFitProblem(ss.ctx), null, 'big-4x: no fit problem');

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

// The user's Sealing Head: NEMA 4X, CPU changed on the PLC page after the equipment choice (the old CPU still in
// the required parts), modules C0-08ND3 + C0-04AD-1. One CPU only, and an enclosure that holds everything.
{
  const seal = SCENARIOS.find((x) => x.name === 'sealing-head')!;
  const s4 = { ...seal, name: 'seal-4x', rating: 'NEMA 4X' as const, cpu: 'C0-10DD1E-D', modules: ['C0-08ND3', 'C0-04AD-1'],
    required: [{ partNumber: 'C0-10DD2E-D', quantity: 1 }, { partNumber: 'C0-08ND3', quantity: 1 }, { partNumber: 'C0-04AD-1', quantity: 1 }] };
  const { r, ctx } = run(s4);
  const cpus = r.design.components.filter((c) => getPart(c.partNumber)?.category === 'plc');
  assert.deepEqual(cpus.map((c) => `${c.tag} ${c.partNumber}`), ['PLC C0-10DD1E-D'], 'one CPU: the project\'s');
  assert.equal(r.design.components.filter((c) => c.partNumber === 'C0-08ND3').length, 1, 'each module once');
  assert.ok(r.design.notes.some((n) => /C0-10DD2E-D from the equipment list is not used/.test(n)), 'the stale CPU is reported');
  assert.ok(!designWarnings(ctx).some((w) => /PLC CPUs in the design/.test(w)));
  const enc = getPart(r.design.components.find((c) => c.tag === 'ENC1')!.partNumber)!;
  assert.match(String(enc.ratings.material), /stainless/);
  assert.ok(layoutFits(ctx), `seal-4x: everything fits in ${enc.partNumber}`);
  assert.equal(enclosureFitProblem(ctx), null);

  // A saved design with the 20x16 stainless (what the user had): the problem and the ways out.
  const small = { ...ctx, design: withEnclosure(ctx.design, getPart, 'SCE-20EL1608SSLP', 'SCE-20P16') };
  const pr = enclosureFitProblem(small)!;
  assert.ok(pr && (pr.notFit.length > 0 || pr.door), 'the 20x16 is too small');
  const kinds = pr.options.map((o) => o.kind);
  assert.equal(kinds[0], 'larger');
  assert.match(String(getPart(pr.options[0].fit!.enclosure)!.ratings.material), /stainless/, 'larger: stainless stays stainless');
  assert.ok(layoutFits({ ...small, design: withEnclosure(small.design, getPart, pr.options[0].fit!.enclosure, pr.options[0].fit!.subpanel) }), 'the larger option fits');
  assert.ok(kinds.includes('rating') && kinds.includes('split'), `options ${kinds.join(', ')}`);
  const fg = pr.options.find((o) => o.kind === 'material');
  if (fg) assert.ok(!/stainless/i.test(String(getPart(fg.fit!.enclosure)!.ratings.material)) && /4X/.test(String(getPart(fg.fit!.enclosure)!.ratings.nema)), 'material: a non-stainless 4X');
  // A design that already has two CPUs (made before the fix) is flagged.
  const two = { ...ctx, design: { ...ctx.design, components: [...ctx.design.components, { tag: 'X1', partNumber: 'C0-10DD2E-D', quantity: 1, function: 'Required by the designer', motorTag: null }] } };
  assert.ok(designWarnings(two).some((w) => /2 PLC CPUs in the design \(PLC C0-10DD1E-D, X1 C0-10DD2E-D\)/.test(w)), 'two CPUs flagged');
}

// The designer's enclosure pick (Electrical page "Enclosure"): the sealing head in stainless.
{
  const seal = SCENARIOS.find((x) => x.name === 'sealing-head')!;
  const base = { ...seal, rating: 'NEMA 4X' as const };
  const encOf = (r: EngineResult) => r.design.components.find((c) => c.tag === 'ENC1')!.partNumber;
  // Recommended: a sensibly sized wall-mount single-door stainless box (not the giant one), no note.
  const rec = run({ ...base, name: 'seal-4x-rec' });
  const recPart = getPart(encOf(rec.r))!;
  assert.equal(rec.r.design.enclosureChoice?.status, 'recommended');
  assert.equal(rec.r.design.enclosureChoice?.note, undefined);
  assert.equal(rec.r.design.enclosureChoice?.recommended, recPart.partNumber);
  assert.match(String(recPart.ratings.material), /stainless/); assert.doesNotMatch(String(recPart.ratings.material), /316/, "304 before 316");
  assert.ok(recPart.ratings.mounting !== 'floor' && (recPart.ratings.doors ?? 1) === 1, `${recPart.partNumber}: wall-mount, one door`);
  assert.ok((recPart.ratings.heightIn as number) <= 36 && (recPart.ratings.widthIn as number) <= 30, `${recPart.partNumber}: not oversized`);
  const sp = spareSpace(rec.ctx).panel;
  assert.ok(sp >= SPARE_RULE && sp < 0.5, `spare ${Math.round(sp * 100)} %`);
  // Too small (the user's 20x16): the smallest stainless that works, a note, the pick stays recorded.
  const small = run({ ...base, name: 'seal-4x-small', enclosure: 'SCE-20EL1608SSLP' });
  assert.equal(small.r.design.enclosureChoice?.status, 'tooSmall');
  assert.equal(small.r.design.inputs.enclosurePreference, 'SCE-20EL1608SSLP', 'the pick stays recorded');
  assert.ok(layoutFits(small.ctx), `fits in ${encOf(small.r)}`);
  assert.match(String(getPart(encOf(small.r))!.ratings.material), /stainless/);
  assert.ok(small.r.design.notes.some((n) => /^Your size \(20x16x8\) was too small for the parts; we use \d+x\d+x\d+ \(SCE-/.test(n)), 'too-small note');
  // Too big: kept, with a note naming the recommended size; never changed by itself.
  const big = run({ ...base, name: 'seal-4x-big', enclosure: 'SCE-48EL3612SSLP' });
  assert.equal(encOf(big.r), 'SCE-48EL3612SSLP', 'a larger pick is kept');
  assert.equal(big.r.design.enclosureChoice?.status, 'larger');
  assert.ok(big.r.design.notes.some((n) => n === `This cabinet is bigger than needed — the recommended size is ${enclosureSize(recPart)} (${recPart.partNumber}).`), 'bigger-than-needed note');
  // Picking the recommended one: no note.
  const same = run({ ...base, name: 'seal-4x-same', enclosure: recPart.partNumber });
  assert.equal(encOf(same.r), recPart.partNumber);
  assert.equal(same.r.design.enclosureChoice?.status, 'recommended');
  assert.ok(!same.r.design.notes.some((n) => /bigger than needed|too small for the parts/.test(n)));
  // Regeneration (Update design / Update all) keeps the pick: the inputs carry it.
  const again = run({ ...base, name: 'seal-4x-again', enclosure: big.r.design.inputs.enclosurePreference! });
  assert.equal(encOf(again.r), 'SCE-48EL3612SSLP');
  // The same rules on an existing design (the Electrical page pick and the AI path).
  const kept = chooseEnclosure(rec.ctx, 'SCE-48EL3612SSLP');
  assert.equal(kept.choice.status, 'larger');
  assert.equal(kept.design.components.find((c) => c.tag === 'ENC1')!.partNumber, 'SCE-48EL3612SSLP');
  const bumped = chooseEnclosure(rec.ctx, 'SCE-20EL1608SSLP');
  assert.equal(bumped.choice.status, 'tooSmall');
  assert.ok(layoutFits({ ...rec.ctx, design: bumped.design }), 'bumped design fits');
  assert.equal(bumped.design.inputs.enclosurePreference, 'SCE-20EL1608SSLP');
  assert.equal(chooseEnclosure(rec.ctx, null).choice.used, recPart.partNumber, 'no pick: the recommended one');
  // The list for the picker: wall-mount single-door first, sorted by size.
  const list = enclosuresFor('NEMA 4X', 'stainless');
  const firstFloor = list.findIndex((p) => /floor|free/i.test(`${p.ratings.mounting ?? ''} ${p.ratings.floorStand ?? ''}`));
  assert.ok(firstFloor < 0 || list.slice(firstFloor).every((p) => /floor|free/i.test(`${p.ratings.mounting ?? ''} ${p.ratings.floorStand ?? ''}`) || Number(p.ratings.doors ?? 1) > 1), 'floor-standing after wall-mount');
}

// Drive branches use the drive's own Class T fuses (its SCCR condition) in a Class T block; above 60 A AutomationDirect has
// no orderable Class T block, so the branch keeps a breaker and the design review says so.
{
  const v = SCENARIOS.find((x) => x.name === 'vfd')!;
  const { r, ctx } = run({ ...v, name: 'vfd-classT' });
  const m = buildModel(ctx);
  const drive = m.motors.find((x) => x.vfd)!;
  const fusePn = String(drive.vfd!.part!.ratings.fusePart);
  assert.equal(drive.protection?.category, 'fuse', `${drive.motor.tag}: fuse-protected`);
  assert.match(String(drive.protection?.part?.ratings.fuseClass), /^T$/, 'a Class T block');
  assert.ok([fusePn, `${fusePn}-1`].includes(String(drive.protection?.fuse?.partNumber)), `${fusePn} in it`);
  assert.ok(r.design.components.some((c) => c.partNumber.startsWith(fusePn) && c.quantity === 3), 'three cartridges');
  assert.ok(panelSccr(ctx).unmet.every((u) => u.tag !== drive.vfd!.tag), 'the drive SCCR condition is met');
  assert.ok(!designWarnings(ctx).some((w) => /Class T/.test(w)), 'no Class T finding');
  // 5 HP at 230 V: GS23-25P0 needs TJN80 — no orderable Class T block that size.
  const big = run({ ...v, name: 'vfd-classT-80A', supply: '240VAC-3PH', motors: [motor('M1', 'Infeed conveyor', 5, '240VAC-3PH', 'vfd')] });
  const bm = buildModel(big.ctx).motors.find((x) => x.vfd)!;
  if (bm.vfd!.partNumber === 'GS23-25P0') {
    assert.equal(bm.protection?.category, 'breaker', 'breaker kept');
    assert.ok(big.r.design.notes.some((n) => /needs Class T TJN80 \(80 A\).*no orderable Class T fuse block/.test(n)), 'engine note');
    assert.ok(designWarnings(big.ctx).some((w) => w.startsWith(`No orderable Class T fuse holder above 60 A for ${bm.vfd!.tag} (GS23-25P0 needs Class T TJN80, 80 A`)), 'review finding');
  } else assert.fail(`expected GS23-25P0 for 5 HP 230 V, got ${bm.vfd!.partNumber}`);
}

// "VFD1 run" belongs to drive VFD1, not to motor M1's contactor: one PLC output per coil (rules-big drew Y004 "VFD1 run"
// as a second coil rung for K1 while the wire list sent it to the drive).
{
  const { r, ctx } = run({
    name: 'vfd-numbers', supply: '480VAC-3PH', hmi: null, modules: ['C0-08TD1'],
    motors: [motor('M1', 'Conveyor motor', 1, '480VAC-3PH'), motor('M2', 'Pump motor', 3, '480VAC-3PH'), motor('M3', 'Belt 1 motor', 5, '480VAC-3PH', 'vfd'), motor('M4', 'Belt 2 motor', 5, '480VAC-3PH', 'vfd')],
    points: [pt('E-stop OK', 'input'), pt('Start PB', 'input'), pt('Stop PB', 'input'), pt('Conveyor motor contactor', 'output'), pt('Pump motor contactor', 'output'), pt('VFD1 run', 'output', { deviceType: 'vfd-input' }), pt('VFD2 run', 'output', { deviceType: 'vfd-input' })],
  });
  const w = r.design.ioWiring;
  for (const d of ['VFD1 run', 'VFD2 run']) assert.equal(w.find((x) => x.description === d)?.deviceType, 'vfd-input', `${d}: a drive input`);
  const coils = w.filter((x) => x.deviceType === 'contactor-coil').map((x) => x.deviceTag);
  assert.equal(new Set(coils).size, coils.length, `one output per contactor coil: ${coils.join(', ')}`);
  const vfdTags = buildModel(ctx).motors.filter((x) => x.vfd).map((x) => x.vfd!.tag);
  assert.equal(vfdTags.length, 2, `the two declared drives, no extra motors for "VFD1 run" / "VFD2 run": ${vfdTags.join(', ')}`);
  assert.deepEqual(w.filter((x) => /^VFD\d run$/.test(x.description)).map((x) => x.deviceTag).sort(), [...vfdTags].sort(), 'each run output on its own drive');
}

// Cooling: heat the walls cannot shed (15 °C rise) leaves through a 24 VDC filter fan with its exhaust filter and a
// thermostat (NEMA 12); a sealed NEMA 4X enclosure takes no fan: a larger enclosure, else a heat exchanger / air conditioner.
{
  const big = SCENARIOS.find((x) => x.name === 'big')!;
  const kindOf = (pn: string) => String(getPart(pn)?.ratings.kind ?? '');
  const heatOf = (ctx: DrawingContext) => cabinetHeat(ctx.design.components, getPart, { partNumber: 'CM5-T10W', sizeIn: 10 });
  const { r, ctx } = run({ ...big, name: 'big-cooling' });
  const fan = r.design.components.find((c) => kindOf(c.partNumber) === 'filter fan')!;
  assert.ok(fan, 'hot cabinet: a filter fan');
  assert.ok(r.design.components.some((c) => kindOf(c.partNumber) === 'exhaust filter'), 'its exhaust filter');
  assert.ok(r.design.components.some((c) => kindOf(c.partNumber) === 'thermostat'), 'a thermostat');
  assert.ok(fanAirflowM3h(getPart(fan.partNumber)!)! >= heatOf(ctx).ventilation!.airflowM3h, 'enough air flow with filters');
  const m = buildModel(ctx);
  assert.equal(m.fan?.tag, fan.tag);
  assert.ok(m.fan?.dc && m.wires.some((w) => w.wire === fan.tag && w.to === `${fan.tag}:+`), '24 VDC fan wired through the thermostat');
  assert.ok(!designWarnings(ctx).some((w) => /Cabinet cooling missing/.test(w)));
  // the cool example cabinet: nothing added
  const ex = run(SCENARIOS[0]);
  assert.ok(!ex.r.design.components.some((c) => ['filter fan', 'heat exchanger', 'air conditioner'].includes(kindOf(c.partNumber))), 'no cooling when the walls shed the heat');
  // NEMA 4X: no fan (it breaks the seal) — a larger stainless enclosure that sheds the heat, or closed-loop cooling
  const ss = run({ ...big, name: 'big-4x-cooling', rating: 'NEMA 4X' });
  assert.ok(!ss.r.design.components.some((c) => kindOf(c.partNumber) === 'filter fan'), '4X: no filter fan');
  const closed = ss.r.design.components.some((c) => ['heat exchanger', 'air conditioner'].includes(kindOf(c.partNumber)));
  assert.ok(closed || !heatOf(ss.ctx).ventilation, `4X: cooled (${ss.r.design.components.find((c) => c.tag === 'ENC1')!.partNumber})`);
  assert.ok(!designWarnings(ss.ctx).some((w) => /Cabinet cooling missing/.test(w)));
  // a review finding when a hot design has no cooling (e.g. the fan removed by hand)
  const bare = { ...ctx, design: { ...ctx.design, components: ctx.design.components.filter((c) => !['filter fan', 'exhaust filter', 'thermostat'].includes(kindOf(c.partNumber))) } };
  assert.ok(designWarnings(bare).some((w) => /^Cabinet cooling missing/.test(w)), 'missing cooling flagged');
  assert.ok(engineerChecks({ ctx: bare, io: IO0 }).some((f) => f.id === 'eng:heat' && /above ambient/.test(f.title)), 'review: hot cabinet without cooling');
  assert.ok(!engineerChecks({ ctx, io: IO0 }).some((f) => f.id === 'eng:heat'), 'review: no heat finding once the fan carries the heat');
  // a fan too small for the heat: flagged, not taken as cooled
  const small = CATALOG.filter((p) => p.ratings.kind === 'filter fan' && (fanAirflowM3h(p) ?? 0) > 0).sort((a, b) => fanAirflowM3h(a)! - fanAirflowM3h(b)!)[0];
  assert.ok(fanAirflowM3h(small)! < heatOf(ctx).ventilation!.airflowM3h);
  const weak = { ...ctx, design: { ...ctx.design, components: ctx.design.components.map((c) => (c.partNumber === fan.partNumber ? { ...c, partNumber: small.partNumber } : c)) } };
  assert.ok(designWarnings(weak).some((w) => /^Cabinet cooling too small/.test(w)), 'undersized fan flagged');
  assert.ok(engineerChecks({ ctx: weak, io: IO0 }).some((f) => f.id === 'eng:heat' && /too small/.test(f.title)), 'review: undersized fan');
}

// Field wiring from the wiring-path engine's findings (Sealing Head): each two-hand button has its own tag, terminal
// and cable core; no field-device terminal carries two signal wire numbers; a trunk core and the device cable it
// continues into carry the same number (a coil behind a safety contact: Y001A on both).
{
  const { ctx } = run(SCENARIOS.find((x) => x.name === 'sealing-head')!);
  const m = buildModel(ctx);
  const th = m.io.filter((p) => /two-hand/i.test(p.description));
  assert.equal(new Set(th.map((p) => p.deviceTag)).size, th.length, `two-hand buttons: ${th.map((p) => p.deviceTag).join(', ')}`);
  const strips = /^(TB|JB|PLC|IO|GB|PS|SR|CB|K|CR|SSR|VFD|FU)/;
  const onPin = new Map<string, Set<string>>();
  for (const w of m.wires) for (const e of [w.from, w.to]) {
    if (!/:/.test(e) || strips.test(e) || ['24+', '24+S', '0V', 'PE'].includes(w.wire)) continue;
    onPin.set(e, new Set([...(onPin.get(e) ?? []), w.wire]));
  }
  for (const [pin, ws] of onPin) assert.ok(ws.size <= 1, `${pin}: wires ${[...ws].join(', ')} on one terminal`);
  const cables = cableSchedule(ctx);
  for (const p of th) assert.ok(cables.some((c) => c.kind === 'device' && c.cores.some((k) => k.wire === p.address)), `${p.address}: a device cable core`);
  const trunkAt = new Map(cables.filter((c) => c.kind === 'trunk').flatMap((c) => c.cores.map((k) => [k.to, k.wire] as const)));
  for (const c of cables.filter((x) => x.kind === 'device')) for (const k of c.cores) {
    const t = trunkAt.get(k.from);
    if (t && !['PE'].includes(k.wire)) assert.equal(t, k.wire, `${c.tag} core ${k.core} (${k.from}): trunk ${t}, device cable ${k.wire}`);
  }
}

// NPN sensors put their input group's common on +24V (sourcing inputs): a pushbutton, limit switch or relay contact
// in the same group must switch 0V into its input, or it can never turn ON. An input turns ON when its device
// pulls it away from the common: to +24V on a 0V common, to 0V on a +24V common.
{
  const npn: Scenario = {
    name: 'npn-mixed', supply: '480VAC-3PH',
    points: [pt('Safety relay OK', 'input', { deviceType: 'safety-relay-output' }), pt('Start PB', 'input', { deviceType: 'pushbutton-no' }), pt('Stop PB', 'input', { deviceType: 'pushbutton-nc' }),
      pt('Part present NPN', 'input', { deviceType: 'sensor-npn' }), pt('Guard closed limit switch', 'input', { deviceType: 'limit-switch' }),
      pt('Conveyor run', 'output', { deviceType: 'contactor-coil' })],
    motors: [motor('M1', 'Conveyor', 1, '480VAC-3PH')],
  };
  const { ctx } = run(npn);
  const m = buildModel(ctx);
  const g = m.groups.find((x) => x.type === 'input' && x.points.some((p) => p.deviceType === 'sensor-npn'))!;
  assert.equal(g.commonTo, '24+', 'NPN group: common to +24V');
  for (const p of g.points) {
    if (p.deviceType === 'sensor-npn') continue;
    assert.equal(p.supplyWire, '0V', `${p.address} ${p.description}: switches 0V`);
    // the wire on the contact's feed terminal, as derive wired it (C, 23 on the safety relay, R1 on a drive)
    assert.ok(p.feedTo, `${p.address} ${p.deviceTag}: has a feed terminal`);
    const feed = m.wires.filter((w) => w.to === p.feedTo && w.wire !== p.address);
    assert.ok(feed.length && feed.every((w) => w.wire === '0V' && w.color === 'WH/BU'), `${p.address} ${p.feedTo}: fed ${feed.map((w) => `${w.wire} ${w.color}`).join(', ') || 'nothing'} — must be 0V (WH/BU) to turn ON`);
  }
  // a PNP-only design keeps 0V commons and +24V-fed contacts
  const pnp = buildModel(run({ ...npn, name: 'pnp-mixed', points: npn.points.map((p) => (p.deviceType === 'sensor-npn' ? { ...p, deviceType: 'sensor-pnp' as const } : p)) }).ctx);
  assert.ok(pnp.groups.filter((x) => x.type === 'input').every((x) => x.commonTo === '0V' && x.points.every((p) => p.supplyWire === '24+')));
}

// An E-stop's PLC status input is read N.C. (ON = released): it is wired through the E-stop's own N.C. block — 31-32
// (a third block) beside the safety relay's two channels on 11-12 / 21-22 — never the C / NO terminals of a button.
for (const s of SCENARIOS) {
  const { r, ctx } = run(s);
  const m = buildModel(ctx);
  for (const p of m.io.filter((q) => q.type === 'input' && q.deviceType === 'estop-contact')) {
    const sig = m.wires.find((w) => w.wire === p.address && w.from.startsWith(`${p.deviceTag}:`));
    assert.ok(sig && /:(12|22|32)$/.test(sig.from), `${s.name} ${p.address}: the PLC status from an N.C. block (${sig?.from})`);
    if (m.safety.relay) assert.ok(r.design.components.some((c) => c.tag === `${p.deviceTag}D`), `${s.name}: ${p.deviceTag} has its third N.C. block`);
  }
}

// One pin, one wire number, generator-wide: a series contact has its in and out on different pins (the over-
// temperature limit feeding a safety contactor's coil once took 24+S and K1A1 on the same R1 pin, so the limit
// never broke the coil). Strip terminals and bus bars ("TB1 24+", "GB1") and free-text ends are not device pins.
const multiNet = (wires: { wire: string; from: string; to: string }[]) => {
  const nets = new Map<string, Set<string>>();
  for (const w of wires) for (const e of [w.from, w.to]) {
    if (!/^[A-Z][A-Z0-9-]*:[^\s]+$/.test(e) || w.wire === 'PE') continue;
    nets.set(e, new Set([...(nets.get(e) ?? []), w.wire]));
  }
  return [...nets].filter(([, ws]) => ws.size > 1).map(([pin, ws]) => `${pin} = ${[...ws].join(' / ')}`);
};
// the wire list and the cable schedule agree: a field wire leaving a strip terminal rides a cable core of the same
// number from that terminal (SOL1's 0V from TB3-2 was routed on the sensors' 0V core from TB2-9)
const offCable = (m: ReturnType<typeof buildModel>) => {
  const strip = /^TB[A-Z0-9]*-\d+$/;
  const cores = m.machine.cables.flatMap((c) => c.cores).filter((k) => strip.test(k.from) && k.wire !== 'PE');
  const at = new Set(cores.map((k) => `${k.wire}@${k.from}`));
  const field = (e: string) => /^JB\d/.test(e);
  return m.wires.filter((w) => w.wire !== 'PE').flatMap((w) => [[w.from, w.to], [w.to, w.from]].filter(([t, o]) => strip.test(t) && field(o) && !at.has(`${w.wire}@${t}`)).map(([t, o]) => `${w.wire} ${t} → ${o}`));
};
for (const s of SCENARIOS) {
  const { ctx } = run(s);
  const m = buildModel(ctx);
  assert.deepEqual(multiNet(m.wires), [], `${s.name}: a device pin carries two wire numbers`);
  assert.deepEqual(offCable(m), [], `${s.name}: wire-list field wires with no cable core at their terminal`);
}
{
  // the over-temperature limit breaks the heater contactor's coil: 24+S in on one side of its relay, the coil out on the other
  const m = buildModel(run(SCENARIOS.find((x) => x.name === 'sealing-head')!).ctx);
  const lim = m.rc.find((c) => c.part?.ratings.kind === 'limitAlarm')!;
  const into = m.wires.find((w) => w.to.startsWith(`${lim.tag}:`) && w.wire === '24+S')!;
  const out = m.wires.find((w) => w.from.startsWith(`${lim.tag}:`) && /A1$/.test(w.wire))!;
  assert.ok(into && out && into.to !== out.from, `${lim.tag}: in ${into?.to}, out ${out?.from}`);
  // a reversing starter on sourcing outputs: two PLC outputs never meet on the shared overload contact
  const rev = SCENARIOS.find((x) => x.name === 'reversing240')!;
  const src = buildModel(run({ ...rev, name: 'reversing240-sourcing', cpu: 'C0-10DD2E-D' }).ctx);
  assert.deepEqual(multiNet(src.wires), [], 'sourcing reversing: one wire number per pin');
  const coils = src.io.filter((q) => q.coilChain);
  assert.ok(coils.every((q) => q.coilChain!.returnVia?.tag === 'OL1' && !q.coilChain!.devices.some((d) => d.kind === 'ol')), 'the shared overload is in the coil return');
  assert.ok(src.wires.some((w) => w.from === 'OL1:96' && w.wire === '0V'));
  // its interlocks use the second N.C. (71-72): the first N.C. is in the safety relay's feedback loop
  assert.ok(coils.every((q) => q.coilChain!.devices.some((d) => d.kind === 'interlock' && d.terminals === '71-72')));
}

// Acceptance (pump skid): two 10 HP pumps on GS20 drives at 480 V heat a NEMA 12 cabinet far above 15 °C; the engine
// fits a filter fan, its exhaust filter and a thermostat, and the review comes out without a heat finding.
{
  const pump: Scenario = {
    name: 'pump-skid', supply: '480VAC-3PH', spec: 'Pump skid: two 10 HP pumps on GS20 VFDs, 480 V 3-phase.',
    points: [pt('E-stop OK', 'input'), pt('Start PB', 'input'), pt('Stop PB', 'input'), pt('Pump 1 VFD fault', 'input'), pt('Pump 2 VFD fault', 'input'),
      pt('Low level switch', 'input'), pt('Pump 1 VFD run', 'output'), pt('Pump 2 VFD run', 'output'), pt('Running light', 'output'), pt('Fault light', 'output')],
    motors: [motor('M1', 'Pump 1', 10, '480VAC-3PH', 'vfd'), motor('M2', 'Pump 2', 10, '480VAC-3PH', 'vfd')],
  };
  const { r, ctx } = run(pump);
  const kinds = r.design.components.map((c) => String(getPart(c.partNumber)?.ratings.kind ?? ''));
  assert.ok(cabinetHeat(ctx.design.components, getPart).ventilation, 'pump skid: needs cooling');
  for (const k of ['filter fan', 'exhaust filter', 'thermostat']) assert.ok(kinds.includes(k), `pump skid: ${k}`);
  assert.ok(!designWarnings(ctx).some((w) => /Cabinet cooling (missing|too small)/.test(w)), 'pump skid: cooling covers the heat');
  assert.deepEqual(engineerChecks({ ctx, io: IO0 }).filter((f) => f.id === 'eng:heat').map((f) => f.title), [], 'pump skid: no heat finding in the review');
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

// No touch panel: the operator devices the I/O list gets (src/spec/operatorIo.ts) are on the door — Start, Stop,
// Reset, the Auto/Manual selector, the lamps and the E-stop — with no HMI on the door, in the BOM or on the network.
{
  const points: P[] = [pt('Part at end photo-eye', 'input', { deviceType: 'sensor-pnp' }), pt('Conveyor motor contactor', 'output', { deviceType: 'contactor-coil' }),
    ...missingOperatorIo([]).map((g) => pt(g.description, g.type, { deviceType: g.deviceType, category: g.category }))];
  const { r, ctx } = run({ name: 'no-panel', supply: '120VAC-1PH', hmi: null, points, motors: [motor('M1', 'Conveyor motor', 0.5, '120VAC-1PH')] });
  const L = panelLayout(ctx);
  assert.deepEqual(L.door.items.map((d) => `${d.kind} ${d.tag}`), ['pilot PL1', 'pilot PL2', 'selector SS1', 'pushbutton PB1', 'pushbutton PB2', 'pushbutton PB3', 'pushbutton PB4', 'estop ES1'], 'no-panel: the operator devices on the door, no HMI');
  const look = (tag: string) => { const c = r.design.components.find((x) => x.tag === tag); return `${c?.function} | ${getPart(c?.partNumber ?? '')?.description}`; };
  for (const [tag, re] of [['PB1', /^Start \| .*green.*N\.O\./], ['PB2', /^Stop \(NC\) \| .*red.*N\.C\./], ['PB3', /^Reset \| .*black.*N\.O\./], ['SS1', /^Auto\/Manual \(ON = Manual\) \| .*2-position/],
    ['PL1', /^Running \(green\) \| .*green, 24/], ['PL2', /^Fault \(red\) \| .*red, 24/], ['PB4', /^Safety reset .*blue/]] as const) assert.match(look(tag), re, `no-panel: ${tag}`);
  assert.equal(r.design.components.filter((c) => getPart(c.partNumber)?.category === 'hmi').length, 0, 'no-panel: no HMI in the BOM');
  assert.equal(buildModel(ctx).hmi, undefined, 'no-panel: no HMI feed / link');
  assert.deepEqual(r.design.ioWiring.filter((w) => /^(PB|SS|PL)/.test(w.deviceTag)).map((w) => `${w.address} ${w.deviceTag}`), ['X003 PB1', 'X004 PB2', 'X005 PB3', 'X006 SS1', 'Y002 PL1', 'Y003 PL2'], 'no-panel: wired to the PLC');
}

// The converted roll former: outputs that switch the servo drive U2's inputs (DI1 SON, DI7 CAM) and the VFD's MI1 are
// signals to drives already on the machine — never a 1 HP motor on a drive of their own.
{
  const io = [
    { ...pt('U2 DI1 SON servo enable', 'output'), deviceType: 'vfd-input' },
    { ...pt('U2 DI7 CAM engage servo drive', 'output'), deviceType: 'vfd-input' },
    { ...pt('VFD1 MI1 forward run drive', 'output'), deviceType: 'vfd-input' },
    pt('Servo ready (U2 DO1 SRDY)', 'input'),
  ].map((p, i) => ({ category: 'Process', ...p, id: `r${i}` })) as IOPoint[];
  const base = { motors: [{ tag: 'M1', description: 'Main forming motor', hp: 7.5, start: 'vfd' as const }], safety: { estops: 0, guardDoors: [], lightCurtains: [] }, zones: ['Machine'], interfaces: [], assumptions: [] };
  const m = drivesFromIo(base as MachineModel, io);
  assert.deepEqual(m.motors.map((x) => x.tag), ['M1'], `drive inputs are not motors: ${m.motors.map((x) => x.description).join(', ')}`);
  assert.ok(!m.assumptions.some((a) => /no motor in the motor list/.test(a)));
  // a real drive run output with no matching motor still gets its motor
  const run = drivesFromIo(base as MachineModel, [...([pt('Coiler VFD run', 'output'), pt('Unwinder VFD run', 'output')].map((p, i) => ({ category: 'Process', ...p, id: `c${i}` })) as IOPoint[]), ...io]);
  assert.deepEqual(run.motors.map((x) => x.description), ['Main forming motor', 'Coiler motor', 'Unwinder motor'], 'drive run outputs still add their motors');
}

// The side manager's roll-former cases through the whole engine: drive inputs on drives the I/O list names (U1 MI3,
// U2 DI7) never get a motor or a contactor, and each is wired to that drive's own terminal. (U2 DI1 SON is a servo
// enable motion.ts reads as a servo axis — the drivesFromIo test above covers it here.)
{
  const points: P[] = [
    pt('E-Stop OK (safety relay)', 'input'), pt('Start Button', 'input'),
    pt('U2 DI7 CAM engage', 'output', { deviceType: 'vfd-input' }),
    pt('U1 MI3 VFD jog speed', 'output', { deviceType: 'vfd-input' }),
    pt('U1 MI1 VFD forward run', 'output', { deviceType: 'vfd-input' }),
  ];
  const { r, ctx } = run({ name: 'roll-former-drive-inputs', supply: '480VAC-3PH', points, motors: [motor('M1', 'Main forming motor', 7.5, '480VAC-3PH', 'vfd')] });
  const by = (d: string) => r.design.ioWiring.find((w) => ctx.io.find((q) => q.address === w.address)?.description === d);
  for (const [d, drive] of [['U2 DI7 CAM engage', 'U2'], ['U1 MI3 VFD jog speed', 'VFD1'], ['U1 MI1 VFD forward run', 'VFD1']] as const) {
    assert.equal(by(d)?.deviceTag, drive, `${d}: on ${drive}`);
  }
  assert.ok(!r.design.components.some((c) => /^K\d/.test(c.tag)), `no contactor for a drive input: ${r.design.components.filter((c) => /^K\d/.test(c.tag)).map((c) => c.function).join(', ')}`);
  assert.ok(!r.design.components.some((c) => /^VFD[2-9]/.test(c.tag)), 'no invented second drive');
  assert.ok(!(r.design.askUser ?? []).some((q) => /not in the motor list|assumed/i.test(q) && /U[12]/.test(q)), 'no invented-load question');
  const m = buildModel(ctx);
  // U2 (the servo drive) on its DI7; U1 is the design's one VFD (VFD1): jog on a preset DI, run on FWD/DI1
  for (const t of ['U2:DI7', 'VFD1:DI3', 'VFD1:DI1']) assert.ok(m.wires.some((w) => w.to === t), `wired to ${t}`);
}

// Dev 4's probe: the converted roll former's own I/O and motors. The oil pump contactor output drives M2's contactor
// (not the forming drive), the forming run output the drive, and no motor is invented.
{
  const { convertMachine } = await import('../../convert/convert');
  const { ROLL_FORMER } = await import('../../convert/__fixtures__/rollFormer');
  const conv = convertMachine(ROLL_FORMER);
  const { r } = run({ name: 'roll-former-converted', supply: conv.supply, points: conv.io.map((p) => ({ description: p.description, type: p.type, category: p.category, deviceType: p.deviceType })) as P[], motors: conv.motors });
  const dev = (re: RegExp) => r.design.ioWiring.find((w) => re.test(w.description))?.deviceTag;
  const m2k = r.design.components.find((c) => c.motorTag === 'M2' && /contactor/i.test(getPart(c.partNumber)?.category ?? ''))?.tag;
  assert.ok(m2k && dev(/Oil pump contactor/) === m2k, `oil pump output on M2's contactor ${m2k}, not ${dev(/Oil pump contactor/)}`);
  assert.equal(dev(/Forming motor run/), 'VFD1');
  assert.deepEqual(r.design.inputs.motors.map((x) => x.tag), conv.motors.map((x) => x.tag), 'no invented motor');
}

if (failures) { console.error(`${failures} scenario(s) failed`); process.exit(1); }
console.log('engine tests passed');
