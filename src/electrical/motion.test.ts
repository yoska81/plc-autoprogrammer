/// <reference types="node" />
/**
 * Motion end to end on the servo fixture: one SureServo2 axis (power, STO, pulse/direction and drive I/O to
 * the PLC), one encoder on the high-speed inputs, one 4-20 mA ultrasonic level sensor.
 * Run with:  npx tsx src/electrical/motion.test.ts
 */
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { planDrawings } from './drawings/plan';
import { ServoSheet } from './drawings/sheets/ServoSheet';
import { generateDefaultDesign } from './engine';
import { getPart as catalogPart } from './catalog';
import { billOfMaterials, buildModel, cableSchedule, designWarnings, panelLayout, terminalPlan, wireNumbers, type DrawingContext } from './derive';
import { analogSetup } from '../plc/core/analog';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { axisKey, encoderChannel, motionDesign, servoRole } from './motion';
import { SERVO_IO } from './motion.fixture';
import { cabinetHeat } from './thermal';
import type { IOPoint } from '../types/io';
import type { DesignInputs } from './types';

// Classification
assert.equal(servoRole({ type: 'output', description: 'Axis 1 pulse' }), 'pulse');
assert.equal(servoRole({ type: 'output', description: 'Axis 1 direction' }), 'direction');
assert.equal(servoRole({ type: 'output', description: 'Axis 1 alarm reset' }), 'reset');
assert.equal(servoRole({ type: 'input', description: 'Axis 1 servo alarm' }), 'alarm');
assert.equal(servoRole({ type: 'input', description: 'Axis 2 in position' }), 'inPosition');
assert.equal(axisKey('Axis 2 servo ready'), '2');
assert.equal(encoderChannel('Line encoder B'), 'B');
assert.equal(encoderChannel('Encoder Z index'), 'Z');

const getPart = catalogPart;
const io = SERVO_IO.map(([description, type, category, signal], i) => ({
  id: `p${i + 1}`, description, type, category, ...(signal ? { signal, analog: { range: '4-20mA', min: 0, max: 100, units: '%' } } : {}),
})) as IOPoint[];
const profile = getProfile('click');
const cpu = getCpu(profile, 'C0-10DD1E-D');
const modules = ['C0-04AD-1', 'C0-16TD1'];
const slots = moduleSlots(modules);
const addresses = resolveAddresses(profile, cpu, io, slots);
const analog = analogSetup(profile, cpu, slots, io);
const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label };
const inputs: DesignInputs = { supply: '240VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] };

// Motion alone: what it claims and picks.
const m = motionDesign({ io, addresses, supply: '240VAC-3PH', nextTag: (() => { const n = new Map<string, number>(); return (p: string) => { n.set(p, (n.get(p) ?? 0) + 1); return `${p}${n.get(p)}`; }; })() });
assert.equal(m.axes.length, 1);
const pns = m.components.map((c) => c.partNumber);
// 400 W at 240 V: the SV2A-2040 drive, its 400 W motor without brake (horizontal axis), 3 m non-flex cables.
for (const pn of ['SV2A-2040', 'SV2L-204N', 'SV2C-PA18-03NN', 'SV2C-E122-03NN']) assert.ok(pns.includes(pn), `${pn} picked (${pns.join(', ')})`);
const encPart = m.components.map((c) => catalogPart(c.partNumber)).find((p) => p?.category === 'encoder');
assert.ok(encPart && /push-pull/.test(String(encPart.ratings.outputType)) && encPart.ratings.ppr === 1000, `a 1000 PPR 24 V push-pull encoder (${encPart?.partNumber})`);
const usPart = m.components.map((c) => catalogPart(c.partNumber)).find((p) => p?.ratings.type === 'ultrasonic');
assert.ok(usPart && /4-20 mA/.test(String(usPart.ratings.output)), `a 4-20 mA ultrasonic sensor (${usPart?.partNumber})`);
assert.equal(m.claimed.size, 10, 'servo signals, encoder channels and the ultrasonic are claimed');
assert.ok(m.askUser.some((q) => /Axis 1: servo sized for 400 W/.test(q)), 'assumed size is a question');

// Through the engine and the drawings.
const r = generateDefaultDesign({ io, addresses, spec: 'Filler: a servo indexes the cups (axis 1), a line encoder measures the conveyor, an ultrasonic sensor reads the hopper level.', inputs, plc, modules, region: 'US', getPart, hmiPartNumber: null, analog, now: '2026-01-01T00:00:00.000Z', projectName: 'servo' });
const ctx: DrawingContext = { projectName: 'servo', design: r.design, getPart, plc, region: 'US', hmiPartNumber: null, analog, io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })) };
const tag = (pn: string) => r.design.components.find((c) => c.partNumber === pn)?.tag;
const drive = tag('SV2A-2040')!;
assert.ok(drive && /^SVD\d$/.test(drive));
assert.ok(!r.design.inputs.motors.length, 'no DOL / VFD motor made up from the servo signals');
assert.ok(r.design.components.some((c) => c.motorTag === 'AX1' && /branch protection — 5 A >= 3\.5 A \(1\.25 x drive input current\)/.test(c.function)), 'drive breaker from the 2.8 A 3-phase input current');

const model = buildModel(ctx);
assert.equal(model.servos.length, 1);
const ax = model.servos[0];
const wires = model.wires;
const has = (from: RegExp, to: RegExp) => wires.some((w) => from.test(w.from) && to.test(w.to));
const addr = (d: string) => addresses.get(io.find((p) => p.description === d)!.id)!;
// Power: breaker → R/S/T, L1C/L2C jumpered, U/V/W to the motor.
assert.ok(has(new RegExp(`^${ax.protection!.tag}:T1$`), new RegExp(`^${drive}:R$`)) && has(new RegExp(`^${drive}:R$`), new RegExp(`^${drive}:L1C$`)));
assert.ok(has(new RegExp(`^${drive}:U$`), new RegExp(`^${ax.motor!.tag}:U$`)));
// Pulse / direction from sinking outputs: PULL HI to 24 V, the output on /PULSE (CN1-41) and /SIGN (CN1-37).
assert.ok(has(/^TB1 24\+$/, new RegExp(`^${drive}:CN1-39$`)) && has(new RegExp(`:${addr('Axis 1 pulse')}$`), new RegExp(`^${drive}:CN1-41$`)));
assert.ok(has(new RegExp(`:${addr('Axis 1 direction')}$`), new RegExp(`^${drive}:CN1-37$`)));
assert.ok(has(new RegExp(`:${addr('Axis 1 servo on')}$`), new RegExp(`^${drive}:CN1-9$`)), 'SON on DI1');
assert.ok(has(new RegExp(`^${drive}:CN1-27$`), new RegExp(`:${addr('Axis 1 servo alarm')}$`)), 'ALRM DO5- to the PLC input');
// STO: both channels from the safety-switched 24 V.
assert.ok(has(/^TB1 24\+S$/, new RegExp(`^${drive}:CN10-3$`)) && has(/^TB1 24\+S$/, new RegExp(`^${drive}:CN10-5$`)), 'STO from the safety relay output');
// Encoder: A/B on TB2 from the encoder, one supply pair and the shield.
const tb2 = terminalPlan(ctx).find((s) => s.tag === 'TB2')!;
const enc = tag(encPart!.partNumber)!;
assert.ok(tb2.terminals.some((t) => t.external === `${enc}:A`) && tb2.terminals.some((t) => t.external === `${enc}:B`));
assert.equal(tb2.terminals.filter((t) => t.external === `${enc}:+V`).length, 1, 'one supply per encoder');
assert.ok(tb2.terminals.some((t) => /cable shield/.test(t.external)));
// Ultrasonic on the analog card, tagged as in the BOM.
const lt = tag(usPart!.partNumber)!;
assert.ok(model.analog.circuits.some((c) => c.deviceTag === lt), `ultrasonic ${lt} on the analog sheet`);
// BOM, wire numbers, cables.
const bom = billOfMaterials(ctx).flatMap((g) => g.lines).map((l) => l.partNumber);
for (const pn of ['SV2A-2040', 'SV2L-204N', 'SV2C-PA18-03NN', 'SV2C-E122-03NN', encPart!.partNumber, usPart!.partNumber]) assert.ok(bom.includes(pn), `${pn} in the BOM`);
// Heat: the servo drive counts for the cabinet temperature (cooling is sized from it).
assert.ok(cabinetHeat(r.design.components, getPart).lines.some((l) => l.item.startsWith(`${drive} SV2A-2040`) && parseFloat(l.value) > 0), 'servo drive heat');
// Layout: no two back-panel parts overlap (the servo drive once ran 1 mm into the right-justified disconnect).
const L = panelLayout(ctx);
const parts = L.items.filter((i) => !i.sub);
for (const a of parts) for (const b of parts) {
  if (a === b) continue;
  const overlap = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
  assert.ok(!overlap, `${a.label} overlaps ${b.label}`);
}
assert.ok(wireNumbers(ctx).length > 0);
assert.ok(cableSchedule(ctx).length > 0);
const warns = designWarnings(ctx);
assert.ok(!warns.some((w) => /encoder channel not on a high-speed input/.test(w)), 'encoder on X001/X002');
assert.ok(warns.some((w) => /has no pulse-train output — use a CLICK PLUS CPU with a C2-14D1/.test(w)), 'CLICK C0 has no pulse output: said so');
const gaps = designWarnings(ctx).filter((w) => /no PLC output drives|not found in the catalog|without wiring|over capacity/i.test(w));
assert.deepEqual(gaps, [], 'no design gaps');
// Drawings: one servo sheet that renders the drive's terminals; the encoder on an I/O sheet.
// tsx compiles the sheet's JSX with the classic runtime: React in scope.
(globalThis as { React?: unknown }).React = React;
const plan = planDrawings(ctx);
const sheet = plan.sheets.find((x) => x.spec.kind === 'servo');
assert.ok(sheet, 'servo axis sheet planned');
const svg = renderToStaticMarkup(createElement('svg', null, createElement(ServoSheet, { plan, sheet: sheet! })));
for (const t of ['CN1-41', 'CN1-37', 'CN1-9', 'CN10-3', 'CN10-5', 'STO_A+', 'SAFETY STOP: STO']) assert.ok(svg.includes(t), `servo sheet shows ${t}`);
console.log(`motion tests passed (${r.design.components.length} parts, ${wires.length} wires; notes: ${r.design.notes.filter((n) => /Axis|SVD|SE\d|LT\d/.test(n)).length})`);
if (process.env.SHOW) {
  console.log(designWarnings(ctx).join('\n'));
  console.log('--- notes\n' + r.design.notes.join('\n'));
  console.log('--- cables'); for (const c of cableSchedule(ctx)) console.log(c.tag, c.from, '→', c.to, c.type);
  console.log('--- comps'); for (const c of r.design.components) console.log(c.tag, c.partNumber, c.motorTag ?? '', c.function.slice(0, 90));
}
if (process.env.LAYOUT) {
  const L = panelLayout(ctx);
  for (const it of L.items) console.log(it.tag, it.category, Math.round(it.x), Math.round(it.y), Math.round(it.w), Math.round(it.h));
  console.log('rails', JSON.stringify(L.rails.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)])));
}
