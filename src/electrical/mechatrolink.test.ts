/// <reference types="node" />
/**
 * A Yaskawa MP3300 project: servo axes over MECHATROLINK-III (no pulse / direction), two-axis SGD7W SERVOPACKs,
 * safe torque off (HWBB on CN8) from the safety relay with EDM1 in its feedback loop, the daisy chain without a
 * terminator, the base unit with the power supply, and virtual axes without hardware.
 * Run with:  npx tsx src/electrical/mechatrolink.test.ts
 */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './engine';
import { exampleInput, ctxFor } from './improve/testDesign';
import { getPart } from './catalog';
import { billOfMaterials, buildModel, designWarnings, panelLayout } from './derive';
import { axesFromSpec, builtIntoCpu } from './mechatrolink';

// Axes from the spec: the program reader's summary lines, "Axis N … W", a virtual axis, and a bare count.
const ax = axesFromSpec('axis 1 (line 1): SGD7W-2R8A20A700 with motor SGM7J-04AFA6C\nAxis 3 feed roll 400 W\naxis 5 virtual master (SVR)');
assert.deepEqual(ax.map((a) => [a.key, a.drivePartNumber, a.motorPartNumber, a.watts, a.kind]),
  [['ax1', 'SGD7W-2R8A20A700', 'SGM7J-04AFA6C', undefined, 'servo'], ['ax3', undefined, undefined, 400, 'servo'], ['ax5', undefined, undefined, undefined, 'virtual']]);
assert.equal(axesFromSpec('The machine has 8 servo axes.').length, 8);
assert.equal(axesFromSpec('No motion here.').length, 0);

// The user's machine shape: axes 1-2 on the named SGD7W, axes 3-4 sized from the spec, a virtual master.
const base = exampleInput('240VAC-3PH');
const spec = `${base.spec}\naxis 1 (line 1): SGD7W-2R8A20A700 with motor SGM7J-04AFA6C\naxis 2 (line 1): SGD7W-2R8A20A700 with motor SGM7J-04AFA61\nAxis 3 feed roll 400 W\nAxis 4 400 W\naxis 5 virtual master (SVR)`;
const input = { ...base, spec, modules: ['JAPMC-IO2300-E'], plc: { vendor: 'Yaskawa', name: 'MP3300', cpuPartNumber: 'JAPMC-CP3301-1-E', cpuLabel: 'CPU-301' } };
const d = generateDefaultDesign(input).design;
const pnOf = (tag: string) => d.components.find((c) => c.tag === tag)?.partNumber;
const drives = d.components.filter((c) => getPart(c.partNumber)?.category === 'servoDrive');
assert.deepEqual(drives.map((c) => [c.tag, c.partNumber, c.motorTag]), [['SVD1', 'SGD7W-2R8A20A700', 'AX1+2'], ['SVD2', 'SGD7W-2R8A20A700', 'AX3+4']], 'two SGD7W, two axes each');
const motors = d.components.filter((c) => getPart(c.partNumber)?.category === 'servoMotor');
assert.equal(motors.length, 4, 'four motors (axis 5 is virtual)');
assert.deepEqual(motors.slice(0, 2).map((c) => c.partNumber), ['SGM7J-04AFA6C', 'SGM7J-04AFA61'], 'the motors the axis list names');
// Power cable with brake wires for the brake motor; encoder cable for the incremental encoder.
const cablesOf = (motorTag: string) => d.components.filter((c) => c.motorTag === motorTag && /^JZSP-/.test(c.partNumber)).map((c) => c.partNumber);
assert.deepEqual(cablesOf('AX1+2'), ['JZSP-C7M23F-03-E', 'JZSP-C7PI0D-03-E', 'JZSP-C7M20F-03-E', 'JZSP-C7PI0D-03-E']);
// One MECHATROLINK-III cable per link, no terminator part (JEPMC-W6022-E is MECHATROLINK-II only).
assert.deepEqual(d.components.filter((c) => /^NW\d/.test(c.tag)).map((c) => c.partNumber), ['JEPMC-W6012-01-E', 'JEPMC-W6012-01-E']);
assert.ok(!d.components.some((c) => c.partNumber === 'JEPMC-W6022-E'));
assert.ok(d.notes.some((n) => /needs no terminator/.test(n)));
assert.ok(d.notes.some((n) => /Axis 5: virtual axis/.test(n)));
// Base unit: 24 VDC MBU with one option slot for the LIO-01.
assert.equal(pnOf('PLCB1'), 'JEPMC-BU3304-E');

const ctx = { ...ctxFor(input, d), plc: input.plc };
const m = buildModel(ctx);
const s1 = m.servos.find((s) => s.drive.tag === 'SVD1')!;
assert.ok(s1.sto, 'HWBB wired');
assert.deepEqual(s1.motors?.map((x) => x.tag), ['SM1', 'SM2']);
const wire = (from: string, to: string) => m.wires.some((w) => w.from === from && w.to === to);
assert.ok(wire('SVD1:UB', 'SM2:U') && wire('SVD1:UA', 'SM1:U'), 'axis A / B motor power');
assert.ok(m.wires.some((w) => w.to === 'SVD1:CN8-4') && m.wires.some((w) => w.to === 'SVD1:CN8-6'), '/HWBB1+ and /HWBB2+ from two safety outputs');
assert.ok(wire('SVD1:CN8-3', 'TB1 0V') && wire('SVD1:CN8-5', 'TB1 0V'));
// EDM1 in the S33-S34 feedback loop, EDM1+ (CN8-8) on the S33 side, the drives in series.
assert.ok(m.wires.some((w) => w.to === 'SVD1:CN8-8') && wire('SVD1:CN8-7', 'SVD2:CN8-8'), 'EDM1 loop');
assert.equal(s1.link?.in, 'PLC:M-III PORT1');
assert.equal(m.servos.find((s) => s.drive.tag === 'SVD2')!.link?.out, null, 'last station: CN6B open');
// Layout: the base unit takes the space; CPU and LIO-01 sit in its slots.
const L = panelLayout(ctx);
assert.ok(L.items.some((i) => i.tag === 'PLCB1'));
assert.deepEqual(L.unplaced.filter((u) => /base unit/.test(u.reason)).map((u) => u.tag), ['PLC', 'IO1']);
// BOM: real parts only; no servo warnings.
const bom = billOfMaterials(ctx).flatMap((g) => g.lines).map((l) => l.partNumber);
for (const pn of ['JAPMC-CP3301-1-E', 'JEPMC-BU3304-E', 'JAPMC-IO2300-E', 'SGD7W-2R8A20A700', 'JEPMC-W6012-01-E']) assert.ok(bom.includes(pn), `BOM ${pn}`);
assert.deepEqual(designWarnings(ctx).filter((w) => /SVD|servo|STO|HWBB|EDM|MECHATROLINK/i.test(w)), []);

// A 480 V supply: the 200 V Sigma-7 SERVOPACKs need a transformer — said, not hidden.
const d480 = generateDefaultDesign({ ...input, inputs: { ...input.inputs, supply: '480VAC-3PH' } }).design;
assert.ok(d480.notes.some((n) => /SVD1 SGD7W-2R8A20A700: takes 200-240 VAC/.test(n) && /transformer/.test(n)));

// Without axes: a note, no hardware.
const none = generateDefaultDesign({ ...input, spec: base.spec }).design;
assert.ok(!none.components.some((c) => getPart(c.partNumber)?.category === 'servoDrive'));
assert.ok(none.notes.some((n) => /no servo axes/.test(n)));
// Built-in CPU functions an imported program lists as modules: no part.
assert.match(builtIntoCpu('SVC32') ?? '', /built into CPU-301/);
assert.match(builtIntoCpu(' 218ifd ') ?? '', /Ethernet/);
assert.equal(builtIntoCpu('LIO-01'), null);

// Legacy SGDV: kept when the axis list names it (the user's machine), never chosen for a new axis.
const sgdv = generateDefaultDesign({ ...input, inputs: { ...input.inputs, supply: '480VAC-3PH' }, spec: `${base.spec}\naxis 1 (line 1): SGDV-280D21A with motor SGMGV-1ADDA61` }).design;
assert.equal(sgdv.components.find((c) => c.tag === 'SVD1')?.partNumber, 'SGDV-280D21A');
assert.ok(sgdv.notes.some((n) => /SGDV-280D21A: legacy/.test(n) && /no 1:1 replacement/.test(n)));
assert.ok(sgdv.notes.some((n) => /SGDV-280D21A: catalog data not fully verified/.test(n)), 'unverified: said');
const big = generateDefaultDesign({ ...input, inputs: { ...input.inputs, supply: '480VAC-3PH' }, spec: `${base.spec}\nAxis 1 11 kW` }).design;
assert.ok(!big.components.some((c) => c.partNumber === 'SGDV-280D21A'), 'legacy drive never generated for a new axis');
assert.ok(big.notes.some((n) => /Axis 1: no MECHATROLINK-III SERVOPACK/.test(n)));

// The user's machine (report on project 1317: 13 VFDs, no SERVOPACK): 8 axes from the imported program's axis list
// (2 SGDV stations kept, 3 SGD7W stations of 2 axes), the CPU named as the profile names it ("CPU-301"), no AC motors,
// and I/O comments that say "drive": 5 SERVOPACKs, no VFD, no starter, the CPU-301 on its base unit, remote I/O.
const nax = (axis: number, drive: string, motor: string) => ({ key: `ax${axis}`, name: `Axis ${axis}`, circuit: 1, axis, kind: 'servo' as const, drivePartNumber: drive, motorPartNumber: motor, source: 'import' as const });
const networkAxes = [nax(1, 'SGDV-280D21A', 'SGMGV-1ADDA61'), nax(2, 'SGDV-280D21A', 'SGMGV-1ADDA61'),
  ...[3, 4, 5, 6, 7, 8].map((n) => nax(n, 'SGD7W-2R8A20A700', n === 3 ? 'SGM7J-04AFA6C' : 'SGM7J-04AFA61'))];
const driveIo = ['Servo drive 1 enable', 'Servo drive 2 enable', 'Axis 3 drive ready', 'Main drive run', 'SGD7W alarm reset']
  .map((description, i) => ({ id: `nd${i}`, category: 'Operator/HMI', description, type: 'output' })) as typeof base.io;
const addr = new Map(base.addresses); driveIo.forEach((p, i) => addr.set(p.id, `OB0001${i}`));
const user = { ...base, io: [...base.io.filter((p) => !/conveyor/i.test(p.description)), ...driveIo], addresses: addr, inputs: { ...base.inputs, supply: '480VAC-3PH' as const, motors: [] }, spec: 'Roll forming line, 8 servo axes on MECHATROLINK-III.',
  modules: [], networkAxes, plc: { vendor: 'Yaskawa', name: 'MP2000 / MP3000 (MPE720)', cpuPartNumber: 'CPU-301', cpuLabel: 'CPU-301' } };
const ud = generateDefaultDesign(user).design;
const ofCat = (c: string) => ud.components.filter((x) => getPart(x.partNumber)?.category === c);
assert.deepEqual(ofCat('servoDrive').map((c) => c.partNumber), ['SGDV-280D21A', 'SGDV-280D21A', 'SGD7W-2R8A20A700', 'SGD7W-2R8A20A700', 'SGD7W-2R8A20A700'], '5 SERVOPACKs');
assert.equal(ofCat('vfd').length, 0, 'no VFD for a servo axis');
assert.equal(ofCat('contactor').filter((c) => c.motorTag).length, 0, 'no motor starter');
assert.equal(ofCat('servoMotor').length, 8);
assert.equal(ud.components.find((c) => c.tag === 'PLC')?.partNumber, 'JAPMC-CP3301-1-E', 'CPU-301 is its catalog part');
assert.match(ud.components.find((c) => c.tag === 'PLC')!.function, /built in: 218IFD/);
assert.ok(ud.components.some((c) => getPart(c.partNumber)?.ratings.kind === 'plc-base-unit'), 'on its MP3300 base unit');
assert.equal(ud.components.filter((c) => /^NW\d/.test(c.tag)).length, 5, 'one MECHATROLINK-III cable per station');
assert.ok(ud.notes.some((n) => /Main drive run/.test(n) && /never a VFD/.test(n)));
const uctx = { ...ctxFor(user, ud), plc: user.plc };
const uw = designWarnings(uctx);
assert.ok(uw.some((w) => /existing remote I\/O \(not identified\)/.test(w)) && !uw.some((w) => /over capacity/.test(w)), 'remote I/O, no "add a module"');
assert.ok(!panelLayout(uctx).items.some((i) => /^IO\d/.test(i.tag)), 'no rack I/O modules drawn');
// A motor the motor list has under an axis's name ("Feed roll" = axis 3's name) is that servo axis, not a VFD motor;
// a real AC motor (hydraulic pump) keeps its starter.
const named = { ...user, spec: `${user.spec} Hydraulic pump motor 5 HP on a starter.`, networkAxes: networkAxes.map((a) => (a.axis === 3 ? { ...a, name: 'Feed roll' } : a)),
  inputs: { ...user.inputs, motors: [{ tag: 'M1', description: 'Feed roll motor', hp: 1, voltage: '480VAC-3PH' as const, starter: 'vfd' as const, reversing: false }, { tag: 'M2', description: 'Hydraulic pump motor', hp: 5, voltage: '480VAC-3PH' as const, starter: 'contactor-overload' as const, reversing: false }] } };
const nd = generateDefaultDesign(named).design;
assert.equal(nd.components.filter((x) => getPart(x.partNumber)?.category === 'vfd').length, 0, 'Feed roll is a servo axis');
assert.ok(nd.components.some((x) => x.motorTag === 'M2' && getPart(x.partNumber)?.category === 'contactor'), 'the pump keeps its starter');

// Stations from the program ($SVP), as on the user's file: 13 SGDV, 23 (2 axes), 43 (axes 4 and 8!), 53 SGDV, 63 (2 axes):
// the axes on one station are one SGD7W wherever they sit in the list — 5 SERVOPACKs, 3 of them SGD7W.
const st = (axis: number, station: string, stationAxis = 0, drive = 'SGD7W-2R8A20A700', motor = 'SGM7J-04AFA61') => ({ ...nax(axis, drive, motor), station, stationAxis });
const stations = [st(1, '13', 0, 'SGDV-280D21A', 'SGMGV-1ADDA61'), st(2, '23'), st(3, '23', 1), st(4, '43'), st(5, '53', 0, 'SGDV-280D21A', 'SGMGV-1ADDA61'), st(6, '63'), st(7, '63', 1), st(8, '43', 1)];
const sd = generateDefaultDesign({ ...user, networkAxes: stations }).design;
const sdrv = sd.components.filter((x) => getPart(x.partNumber)?.category === 'servoDrive');
assert.deepEqual(sdrv.map((c) => `${c.partNumber} ${c.motorTag}`), ['SGDV-280D21A AX1', 'SGD7W-2R8A20A700 AX2+3', 'SGD7W-2R8A20A700 AX4+8', 'SGDV-280D21A AX5', 'SGD7W-2R8A20A700 AX6+7'], 'paired by station');
assert.equal(sd.components.filter((x) => getPart(x.partNumber)?.category === 'servoMotor').length, 8);
console.log('mechatrolink tests passed');
