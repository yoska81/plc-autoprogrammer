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
import { designWarnings, spareSpace, type DrawingContext } from '../derive';
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
    name: 'reversing240', supply: '240VAC-3PH', hmi: null, rating: 'NEMA 4',
    points: [pt('E-stop OK', 'input'), pt('Open PB', 'input'), pt('Close PB', 'input'), pt('Stop PB', 'input'), pt('Gate open limit switch', 'input'), pt('Gate closed limit switch', 'input'),
      pt('Gate motor forward', 'output'), pt('Gate motor reverse', 'output'), pt('Gate moving light', 'output')],
    motors: [motor('M1', 'Gate motor', 3, '240VAC-3PH', 'contactor-overload', true)],
  },
];

function run(s: Scenario): { r: EngineResult; ctx: DrawingContext } {
  const io = s.points.map((p, i) => ({ category: 'Operator/HMI', ...p, id: `p${i + 1}` })) as IOPoint[];
  const profile = getProfile('click');
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
  assert.ok(vfd.notes.some((n) => /Guard door/.test(n)) && vfd.notes.some((n) => /Light curtain/.test(n)));

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
  assert.ok(d.askUser?.some((q) => q.startsWith(`${heater.deviceTag} (Heater contactor)`)), 'its load is asked about');
  // An overload input without "trip" / "fault" in its text is the motor's overload contact.
  const ol = run({ ...SCENARIOS.find((x) => x.name === 'sealing-head-from-example')!, name: 'ol', points: [...SCENARIOS.find((x) => x.name === 'sealing-head-from-example')!.points, pt('Unwinder motor overload', 'input')] }).r.design;
  const olW = ol.ioWiring.find((w) => w.description === 'Unwinder motor overload')!;
  assert.ok(ol.components.some((c) => c.tag === olW.deviceTag && /overload/i.test(c.function)), `overload input wired to the unwinder's overload relay (got ${olW.deviceTag})`);
  // The example itself keeps its motor (the spec mentions the conveyor motor).
  assert.equal(run(SCENARIOS[0]).r.design.inputs.motors.length, 1);
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
