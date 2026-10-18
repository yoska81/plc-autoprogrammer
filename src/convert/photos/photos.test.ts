/// <reference types="node" />
/**
 * Cabinet photos → drawing, first slice: a recorded reading of 3 photos of one small cabinet →
 * merge (the same device seen twice is ONE device) → review → as-built design: panel layout in the
 * photographed rail order and a BOM; what the photos can't show becomes Machine description questions.
 * Run with:  npx tsx src/convert/photos/photos.test.ts
 */
import assert from 'node:assert/strict';
import { getPart } from '../../electrical/catalog';
import { DEFAULT_INPUTS } from '../../store/useElectricalStore';
import { billOfMaterials, panelLayout, type DrawingContext } from '../../electrical/derive';
import { planDrawings, wireClass } from '../../electrical/drawings/plan';
import { clampReading, PHOTO_EDGE, PHOTO_SCHEMA, photoBlocks, recogniseCabinet } from './recognise';
import { mergeDevices, mergeReading } from './merge';
import { asBuiltDesign, matchPart, nameplateRatings, photosToMachine, reviewItems, tracedPoints, type ReviewItem } from './toDesign';
import { plcAddress, traceAll, traceNets } from './trace';
import { RELAY_CABINET } from './__fixtures__/relayCabinet';
import { rollformerReading } from './__fixtures__/rollformerCabinet';
import { readFileSync } from 'node:fs';
import { convertMachine, NA_TARGET } from '../convert';
import { toRelayLogic } from '../relayLogic';
import { tagger } from './toDesign';
import { wiringText } from './wiringText';
import { SMALL_CABINET } from './__fixtures__/smallCabinet';
import type { PhotoDevice } from './recognise';
import { setClaudeInterceptor } from '../../lib/ai/anthropic';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

// ── Merge: one device per real device ──
const merged = mergeReading(SMALL_CABINET);
const tags = merged.devices.map((d) => d.tag || `(${d.category})`);
assert.deepEqual(tags, ['CB1', 'CB2', 'PS1', 'PLC1', '(plcModule)', 'K1', 'OL1', '(relay)'], 'rail order, each device once');
const cb1 = merged.devices.find((d) => d.tag === 'CB1')!;
assert.equal(cb1.partNumber, 'GMCBU-1C-5', 'the close-up nameplate fills in the overview sighting');
assert.equal(cb1.confidence, 'high');
assert.equal(cb1.seen.length, 2, 'both photos kept for the review crop');
assert.equal(merged.devices.find((d) => d.tag === 'K1')!.seen.length, 2, 'the unlabelled overview contactor and the K1 close-up are one device (same rail position, same kind)');
assert.equal(merged.strips.length, 1);
assert.deepEqual(merged.strips[0].terminals.map((t) => t.wire), ['24+', '0V', '1001', '1101']);
// Never merged: different tags, or different readable part numbers.
// A row of identical relays stays a row (the roll former has KA1–KA10, all the same relay).
const relay = (i: number, tag: string, photo: number, pn = 'RXM2AB2BD'): PhotoDevice => ({ tag, category: 'relay', manufacturer: 'Schneider', partNumber: pn, ratings: '24 VDC coil', rail: 3, order: i, confidence: 'high', seen: [{ photo, x: 0.05 + i * 0.08, y: 0.6, w: 0.06, h: 0.12 }], wires: [] });
const ten = (f: (i: number) => PhotoDevice) => Array.from({ length: 10 }, (_, k) => f(k + 1));
assert.equal(mergeDevices(ten((i) => relay(i, `KA${i}`, 0))).length, 10, 'KA1–KA10 tagged: ten relays');
assert.equal(mergeDevices(ten((i) => relay(i, '', 0))).length, 10, 'ten unlabelled identical relays in one photo: ten relays');
assert.equal(mergeDevices([relay(1, 'KA1', 0), relay(2, '', 0)]).length, 2, 'tagged KA1 next to an unlabelled identical relay: two relays');
assert.equal(mergeDevices([...ten((i) => relay(i, '', 0, '')), ...ten((i) => relay(i, `KA${i}`, 1))]).map((d) => d.tag).join(), 'KA1,KA2,KA3,KA4,KA5,KA6,KA7,KA8,KA9,KA10', 'overview (unlabelled) + close-up (tagged) of the same row: each relay once, tagged');
assert.equal(mergeDevices([relay(1, 'KA1', 0), { ...relay(1, 'KA1', 0), seen: [{ photo: 0, x: 0.7, y: 0.1, w: 0.06, h: 0.12 }] }]).length, 2, 'the same tag twice in one photo at two places: two devices (a misread tag), never merged');
assert.equal(mergeDevices([relay(1, 'KA1', 0), { ...relay(1, 'KA1', 1), partNumber: 'RXM4AB2BD' }]).length, 2, 'same tag, different readable part numbers: two devices');
assert.equal(mergeDevices([
  { ...cb1, tag: 'CB1' }, { ...cb1, tag: 'CB3' },
  { ...cb1, tag: '', partNumber: 'GMCBU-1C-5', rail: 4, order: 1 }, { ...cb1, tag: '', partNumber: 'GMCBU-1C-10', rail: 4, order: 2 },
]).length, 4, 'different tags / part numbers stay apart');

// ── Review: sure readings start confirmed, the rest wait for the user ──
let items = reviewItems(merged);
const status = (re: RegExp) => items.find((it) => re.test(`${it.device?.tag ?? it.strip?.tag} ${it.device?.category ?? 'strip'}`))!.status;
assert.equal(status(/^CB1 /), 'confirmed');
assert.equal(status(/^OL1 /), 'pending', 'medium confidence: the user confirms');
assert.equal(status(/ relay$/), 'pending');
// The user confirms OL1 and the strip, corrects nothing, leaves the hidden relay unconfirmed.
items = items.map((it): ReviewItem => (it.device?.tag === 'OL1' || it.kind === 'strip' ? { ...it, status: 'confirmed' } : it));

// ── As-built design ──
const r = asBuiltDesign(items, merged, DEFAULT_INPUTS, getPart, '2026-10-18T00:00:00.000Z');
const comp = (t: string) => r.design.components.find((c) => c.tag === t);
assert.equal(comp('CB1')?.partNumber, 'GMCBU-1C-5');
assert.equal(comp('IO1')?.partNumber, 'C0-08ND3', 'an unlabelled device gets a tag of its kind');
assert.match(comp('K1')!.function, /as-built from photos — verify/);
assert.ok(!r.design.components.some((c) => /relay/i.test(c.function)), 'the unconfirmed relay is not in the design');
assert.deepEqual(r.design.asBuilt?.rails, [['CB1', 'CB2', 'PS1'], ['PLC1', 'IO1', 'K1', 'OL1'], ['TB1']]);
assert.match(r.design.notes[0], /As-built from photos — verify/);
assert.ok(r.questions.some((q) => /behind the left duct/.test(q)) && r.questions.some((q) => /on rail 2 could not be confirmed/.test(q)), 'hidden wiring and the unconfirmed relay become questions');
assert.deepEqual(r.design.askUser, r.questions, 'asked on the Machine description page (the electrical stage registers askUser there)');
assert.equal(matchPart('gmcbu-1c-5', getPart)?.partNumber, 'GMCBU-1C-5', 'nameplate case does not matter');
assert.equal(matchPart('SCE02PG 24VDC', getPart)?.partNumber, 'SC-E02PG-24VDC', 'dashes and spaces as printed do not matter');
assert.equal(matchPart('', getPart), undefined);

// Off-catalog part: kept as read, with the photographed kind.
const odd = asBuiltDesign([{ key: 'x', kind: 'device', status: 'confirmed', device: { ...cb1, tag: 'Q9', partNumber: 'ACME-123', category: 'breaker' } }], { ...merged, unseen: [] }, DEFAULT_INPUTS, getPart);
assert.deepEqual(odd.notInCatalog, ['Q9 ACME-123']);
assert.equal(odd.design.components[0].category, 'breaker');

// ── Panel layout in the photographed order + BOM ──
const ctx: DrawingContext = {
  projectName: 'As-built', design: r.design, getPart, plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: 'CLICK' },
  io: [], region: 'US', hmiPartNumber: null,
};
const lay = panelLayout(ctx);
const at = (t: string) => lay.items.find((i) => i.tag === t || i.sub?.some((s) => s.tag === t))!;
assert.ok(lay.warnings.some((w) => /As-built from photos/.test(w)), JSON.stringify(lay.warnings));
// Devices sit centred on their rail: the same rail = overlapping vertical spans.
const sameRail = (a: string, b: string) => at(a).y < at(b).y + at(b).h && at(b).y < at(a).y + at(a).h;
assert.ok(sameRail('CB1', 'PS1') && at('CB1').x < at('CB2').x && at('CB2').x < at('PS1').x, 'top rail: CB1, CB2, PS1 left to right');
assert.ok(sameRail('PLC1', 'K1') && !sameRail('CB1', 'PLC1'), 'the PLC rail is its own rail');
assert.ok(at('PLC1').y > at('CB1').y && at('PLC1').x < at('IO1').x && at('IO1').x < at('K1').x, 'second rail: PLC, module, starter');
assert.ok(at('K1').y > at('PS1').y, 'rails top to bottom as photographed');
const bom = billOfMaterials(ctx).flatMap((g) => g.lines);
for (const pn of ['GMCBU-1C-5', 'GMCBU-1C-2', 'PSL-24-030', 'C0-10DD1E-D', 'C0-08ND3', 'SC-E02PG-24VDC', 'TK-E02-72']) assert.ok(bom.some((l) => l.partNumber === pn), `BOM has ${pn}`);
assert.ok(bom.filter((l) => l.partNumber === 'SC-E02PG-24VDC').every((l) => /— from photo, verify$/.test(l.description)), 'the BOM says by the part number that it was read from a photo');
// As-built power distribution sheet: the traced supply / branch wires (PLC I/O wires are on the I/O sheets).
const plan = planDrawings(ctx);
const ab = plan.sheets.filter((sh) => sh.spec.kind === 'asbuilt');
assert.equal(ab.length, 1);
assert.equal(ab[0].title, 'AS-BUILT POWER DISTRIBUTION (FROM PHOTOS)');
assert.ok(plan.sheets.findIndex((sh) => sh.spec.kind === 'asbuilt') === plan.sheets.findIndex((sh) => sh.spec.kind === 'power') + 1, 'right after POWER DISTRIBUTION');
const abSpec = ab[0].spec as Extract<typeof ab[0]['spec'], { kind: 'asbuilt' }>;
assert.deepEqual(abSpec.nets.map((n) => `${n.wire}(${n.cls}): ${n.ends.map((e) => `${e.tag}:${e.terminal}`).join(' ')}`), ['0V(dc): PS1:-V TB1:2', '24+(dc): PS1:+V TB1:1', '101(branch): CB1:2 PS1:L'], 'supply wires first, then branch circuits; 1001 / 1101 / 2001 are PLC I/O');
assert.equal(abSpec.nets[0].ends[0].what, 'power supply PSL-24-030');
assert.deepEqual(abSpec.single.map((x) => `${x.wire}@${x.at}`), ['102@CB2:2', '1002@PLC1:X2', 'L1@CB1:1'], 'wire numbers read at one end only');
assert.deepEqual(['L1', 'N', 'PE', '24+', '0V', '+24V', '101', '1001', 'L2-480VAC'].map(wireClass), ['ac', 'ac', 'pe', 'dc', 'dc', 'dc', 'branch', 'branch', 'ac']);
assert.ok(!planDrawings({ ...ctx, design: { ...r.design, asBuilt: undefined } }).sheets.some((sh) => sh.spec.kind === 'asbuilt'), 'no as-built sheet for a designed panel');

// Without as-built rails the normal packing runs (nothing changes for designed panels).
assert.ok(!panelLayout({ ...ctx, design: { ...r.design, asBuilt: undefined } }).warnings.some((w) => /As-built/.test(w)));

// ── The same reviewed photos as an existing machine, for the shared review → conversion path ──
const machine = photosToMachine(items, merged, 'Line 3 starter panel', getPart);
assert.equal(machine.components.length, 8, 'every device not rejected (the unconfirmed relay too: the shared review asks about it)');
assert.equal(new Set(machine.components.map((c) => c.tag)).size, 8, 'every device has its own tag (unlabelled ones get one of their kind)');
const mk1 = machine.components.find((c) => c.tag === 'K1')!;
assert.equal(mk1.source, 'photo 3, rail 2, position 3', 'where the close-up shows it');
assert.equal(mk1.photos?.length, 2, 'every sighting handed over, not only the first');
assert.deepEqual(mk1.wires, [{ terminal: 'A1', wire: '2001' }], 'the wire numbers at its terminals are kept');
assert.deepEqual(machine.terminals?.map((t) => `${t.strip}-${t.terminal}:${t.wire}`), ['TB1-1:24+', 'TB1-2:0V', 'TB1-3:1001', 'TB1-4:1101'], 'terminal strips as data, not text');
assert.deepEqual(machine.wiring?.map((w) => w.wire), ['0V', '24+', '101', '102', '1001', '1002', '1101', '2001', 'L1'], 'one-ended wires kept as open ends');
assert.deepEqual(machine.wiring?.find((w) => w.wire === '102')?.ends, ['CB2:2']);
assert.deepEqual(machine.circuits, [], 'the only coil (K1) is driven by the PLC: no relay circuit');
assert.equal(machine.controller, 'plc');
assert.equal(machine.spec.utilities, 'Line 3 starter panel');
// …and shown on the machine description when the reading is applied (convertedSpec).
const wt = wiringText(machine);
assert.match(wt, /TB1: 1 = wire 24\+, 2 = wire 0V, 3 = wire 1001, 4 = wire 1101/);
assert.match(wt, /2001: PLC1:Y1 – K1:A1/);
assert.match(wt, /102: CB2:2 – \(other end not in the photos\)/);
assert.equal(wiringText({ terminals: [], wiring: [] }), '');
assert.ok(machine.components.some((c) => c.tag === 'IO1') && r.design.components.some((c) => c.tag === 'IO1'), 'the unlabelled module has the same tag in both outputs');
assert.equal(mk1.confidence, 'high', 'confirmed in the photo review');
assert.equal(mk1.ratings.coilVoltage, '24VDC');
assert.equal(machine.components.find((c) => c.tag === 'CB1')!.ratings.curve, 'C');
assert.equal(machine.components.find((c) => c.tag === 'CB1')!.ratings.amps, 5);
assert.deepEqual([machine.components.find((c) => c.tag === 'OL1')!.ratings.minAmps, machine.components.find((c) => c.tag === 'OL1')!.ratings.maxAmps], [5, 8]);
assert.equal(machine.plc?.cpuPartNumber, 'C0-10DD1E-D');
assert.deepEqual(machine.modules.map((m) => m.partNumber), ['C0-08ND3']);
assert.ok(machine.questions.some((q) => /behind the left duct/.test(q.text)));
assert.deepEqual(machine.io.map((p) => `${p.address}:${p.deviceTag ?? ''}`), ['X1:', 'X2:', 'X101:', 'Y1:K1'], 'the shared review gets the traced I/O');
assert.equal(nameplateRatings('24 VDC 3 A').amps, 3);

// ── Wiring from wire numbers: a number read at two places is one wire; the PLC's wires are the I/O list ──
const wires = r.design.asBuilt!.wires!;
assert.deepEqual(wires.map((w) => `${w.wire}: ${w.ends.join(' – ')}`), [
  '0V: PS1:-V – TB1:2', '24+: PS1:+V – TB1:1', '101: CB1:2 – PS1:L', '1001: PLC1:X1 – TB1:3', '1101: IO1:1 – TB1:4', '2001: PLC1:Y1 – K1:A1',
], 'wires seen at two places (1002 is seen only at the PLC)');
const ioOf = (a: string) => r.io.find((p) => p.address === a)!;
assert.deepEqual(r.io.map((p) => p.address), ['X1', 'X2', 'X101', 'Y1'], 'CPU addresses as read; slot 1 point 1 → X101 (guessed from the rail)');
assert.equal(ioOf('Y1').deviceTag, 'K1');
assert.equal(ioOf('Y1').deviceType, 'contactor-coil');
assert.equal(ioOf('Y1').confidence, 'high');
assert.equal(ioOf('X1').via, 'TB1-3', 'a field input: out through the terminal strip');
assert.equal(ioOf('X1').confidence, 'medium');
assert.equal(ioOf('X2').confidence, 'low', 'seen at one end only');
assert.equal(ioOf('X101').guessed, true);
assert.match(ioOf('X101').description, /address guessed from the module's slot/);
assert.equal(ioOf('X1').guessed, false);
assert.ok(r.questions.includes('Cabinet photos: TB1: what is wired to terminals 3 (wire 1001 → PLC input X1) and 4 (wire 1101 → PLC input X101) outside the cabinet?'), 'one question per strip, supply terminals left out');
assert.ok(r.questions.includes('Cabinet photos: the other end of wire 1002 (PLC input X2) is not in the photos — where does it go?'));
assert.ok(r.questions.includes('Cabinet photos: IO1 (C0-08ND3) is taken as I/O slot 1 from its place on the rail, so its points are numbered X101 — check the slot and the addresses in the PLC program.'));
assert.deepEqual(r.design.ioWiring.find((w) => w.address === 'Y1'), { address: 'Y1', deviceTag: 'K1', deviceType: 'contactor-coil', description: 'K1 contactor coil (wire 2001)', location: 'Cabinet' });
assert.deepEqual(tracedPoints(r.io).map((p) => [p.plcAddress, p.type]), [['X1', 'input'], ['X2', 'input'], ['X101', 'input'], ['Y1', 'output']]);
assert.deepEqual(plcAddress('Y12', 'plc', 0, null), { address: 'Y12', type: 'output', guessed: false }, 'kept as read');
assert.deepEqual(plcAddress('%I0.3', 'plc', 0, null), { address: '%I0.3', type: 'input', guessed: false }, 'Siemens / IEC addresses kept');
assert.deepEqual(plcAddress('I0.3', 'plc', 0, null), { address: 'I0.3', type: 'input', guessed: false });
assert.deepEqual(plcAddress('Q0.1', 'plc', 0, null), { address: 'Q0.1', type: 'output', guessed: false });
assert.deepEqual(plcAddress('%IX1.0', 'plc', 0, null), { address: '%IX1.0', type: 'input', guessed: false });
assert.deepEqual(plcAddress('I2.5', 'plcModule', 1, null), { address: 'I2.5', type: 'input', guessed: false }, 'a full address on a module is kept');
assert.deepEqual(plcAddress('3', 'plcModule', 2, 'output'), { address: 'Y203', type: 'output', guessed: true });
assert.deepEqual(plcAddress('X3', 'plcModule', 1, null), { address: 'X103', type: 'input', guessed: true }, 'a short X3 on a module would repeat the CPU\'s X3');
assert.equal(plcAddress('C1', 'plc', 0, null), null, 'a common terminal is not an I/O point');
assert.equal(plcAddress('1', 'plcModule', 1, null), null, 'module of unknown kind: no address guessed');

// ── Wire numbers that look alike, two numbers on one terminal, a wire reaching two points ──
const dev = (tag: string, category: PhotoDevice['category'], wires: [string, string][], partNumber = '', ratings = ''): PhotoDevice =>
  ({ tag, category, manufacturer: '', partNumber, ratings, rail: 1, order: 1, confidence: 'high', seen: [], wires: wires.map(([terminal, wire]) => ({ terminal, wire })) });
const asItems = (devices: PhotoDevice[], strips: [string, [string, string][]][] = []): ReviewItem[] => [
  ...devices.map((d, i): ReviewItem => ({ key: `d${i}`, kind: 'device', device: d, status: 'confirmed' })),
  ...strips.map(([tag, ts], i): ReviewItem => ({ key: `s${i}`, kind: 'strip', strip: { tag, rail: 3, order: 1, confidence: 'high', seen: [], terminals: ts.map(([terminal, wire]) => ({ terminal, wire })) }, status: 'confirmed' })),
];
const tagOfIt = (it: ReviewItem) => it.device?.tag ?? it.strip!.tag;
const nearItems = asItems([dev('PLC1', 'plc', [['Y1', '2001'], ['Y2', '-2002'], ['Y3', '20 03']]), dev('KA1', 'relay', [['A1', '2OO1']]), dev('KA2', 'relay', [['A1', '2002']]), dev('KA3', 'relay', [['A1', '2003']])]);
const nn = traceNets(nearItems, tagOfIt);
assert.deepEqual(nn.near.map((m) => m.numbers.map((n) => n.wire).join('~')), ['2001~2OO1', '-2002~2002', '20 03~2003'], 'look-alike numbers flagged');
assert.ok(nn.nets.every((n) => n.ends.length === 1), '…and never merged');
const nq = traceAll(nearItems, tagOfIt, () => undefined).questions;
assert.ok(nq.includes('Cabinet photos: wire numbers "2001" (at PLC1:Y1) and "2OO1" (at KA1:A1) look alike — one wire misread, or different wires?'));
// three spellings of one number: one question, not one per pair
const three = traceAll(asItems([dev('KA1', 'relay', [['A1', '2001']]), dev('KA2', 'relay', [['A1', '2OO1']]), dev('KA3', 'relay', [['A1', '20 01']])]), tagOfIt, () => undefined).questions.filter((q) => /look alike/.test(q));
assert.deepEqual(three, ['Cabinet photos: wire numbers "2001" (at KA1:A1), "2OO1" (at KA2:A1) and "20 01" (at KA3:A1) look alike — one wire misread, or different wires?']);
// two numbers on one terminal are one conductor: a coil with two wires, a strip's feed-through
const joined = traceNets(asItems([dev('PLC1', 'plc', [['Y1', '2001'], ['Y2', '2002']]), dev('KA1', 'relay', [['A1', '2001'], ['A1', '2002']]), dev('KA4', 'relay', [['13', '1004']])], [['XT2', [['6', '1004'], ['6', 'F1004']]]]), tagOfIt);
const j2001 = joined.nets.find((n) => n.numbers.includes('2001'))!;
assert.deepEqual([j2001.wire, j2001.ends.map((e) => `${e.tag}:${e.terminal}`), j2001.joinedAt], ['2001 / 2002', ['PLC1:Y1', 'PLC1:Y2', 'KA1:A1'], ['KA1:A1']]);
const f1004 = joined.nets.find((n) => n.numbers.includes('F1004'))!;
assert.deepEqual([f1004.wire, f1004.ends.map((e) => `${e.tag}:${e.terminal}`)], ['1004 / F1004', ['KA4:13', 'XT2:6']], 'feed-through: inside and outside numbers are one conductor');
// conflicts: one wire at two PLC points, or at two devices → low confidence and asked, never picked
const conf = traceAll(asItems([dev('PLC1', 'plc', [['X3', '1003'], ['X4', '1003'], ['X5', '1005']]), dev('SB1', 'pushbutton', [['14', '1005']]), dev('SQ1', 'sensor', [['4', '1005']])]), tagOfIt, () => undefined);
const cio = (a: string) => conf.io.find((p) => p.address === a)!;
assert.deepEqual([cio('X3').confidence, cio('X3').deviceTag, cio('X4').confidence], ['low', '', 'low']);
assert.equal(cio('X5').deviceTag, '', 'SB1 or SQ1: not picked');
assert.equal(cio('X5').confidence, 'low');
assert.match(cio('X5').description, /SB1 or SQ1 \(wire 1005\): check on the cabinet/);
assert.equal(conf.questions.filter((q) => /wire 1003/.test(q)).join(), 'Cabinet photos: wire 1003 is read at both X3 and X4 — which is right?', 'asked once, not once per point');
assert.ok(conf.questions.includes('Cabinet photos: wire 1005 from X5 is read at SB1 and SQ1 — which is right?'));
// a long strip: one question with the terminal ranges
const long = traceAll(asItems([], [['XT2', Array.from({ length: 12 }, (_, i): [string, string] => [String(i + 1), `F${i + 1}`])]]), tagOfIt, () => undefined);
assert.deepEqual(long.questions, ['Cabinet photos: XT2: what is wired to terminals 1–12 outside the cabinet?']);

// ── A relay cabinet without a PLC: the coils' circuits from the wire numbers, kept as ladder rungs ──
const relayItems = reviewItems(RELAY_CABINET);
const rt = traceAll(relayItems, tagger(relayItems), () => undefined);
assert.deepEqual(rt.io, []);
assert.deepEqual(rt.circuits.map((c) => `${c.id} ${c.output}: ${c.conditions.join(' → ')} [${c.kind}, ${c.confidence}]`), [
  'C1 KM1: SB1 11-12 (NC) → SB2 13-14 (NO) ∥ KM1 13-14 (NO) → FR1 95-96 (NC) [start-stop, medium]',
  'C2 KA2:  [other, low]',
  'C3 KT1: KM1 23-24 (NO) [timer, medium]',
  'C4 VFD1: KA2 23-24 (NO) [interlock, medium]',
  'C5 HL1: KT1 15-18 (NO) [interlock, medium]',
]);
const c1 = rt.circuits[0];
assert.deepEqual(c1.path, [
  { t: 'contact', tag: 'SB1', nc: true, terms: '11-12', kind: 'pb' },
  { t: 'branch', paths: [[{ t: 'contact', tag: 'SB2', nc: false, terms: '13-14', kind: 'pb' }], [{ t: 'contact', tag: 'KM1', nc: false, terms: '13-14', kind: 'relay' }]] },
  { t: 'contact', tag: 'FR1', nc: true, terms: '95-96', kind: 'ol' },
  { t: 'coil', tag: 'KM1', kind: 'contactor', preset: null, terms: null },
], 'stop, start ∥ seal-in, overload, coil');
assert.equal(c1.sealIn, 'KM1 13-14');
assert.deepEqual(rt.circuits.find((c) => c.output === 'KT1')!.path!.at(-1), { t: 'coil', tag: 'KT1', kind: 'timer-on', preset: null, terms: null });
assert.deepEqual(rt.circuits.find((c) => c.output === 'VFD1')!.path!.at(-1), { t: 'coil', tag: 'VFD1', kind: 'drive-input', preset: null, terms: 'MI1' });
assert.ok(rt.questions.includes('Cabinet photos: KA2 relay coil (C2): no contact feeding wire 9 was read, which leaves the cabinet on XT1-3 — what switches it?'));
assert.ok(rt.questions.includes('Cabinet photos: XT1: what is wired to terminals 3 (wire 9 → KA2:A1), 4 (wire T1) and 5 (wire T2) outside the cabinet?'), 'field terminals asked per strip (24+ / 0V left out)');
const relayMachine = photosToMachine(relayItems, RELAY_CABINET, '', () => undefined);
assert.equal(relayMachine.controller, 'relays');
assert.equal(relayMachine.circuits.length, 5);
assert.ok(relayMachine.questions.some((q) => /^XT1: what is wired/.test(q.text)));
const kept = toRelayLogic(relayMachine, convertMachine(relayMachine, { ...NA_TARGET, logic: 'keep-relays' }));
assert.equal(kept.logic!.rungs.length, 5, 'every traced circuit becomes a ladder rung');
assert.deepEqual(kept.notDrawn, []);
const pumpRung = kept.logic!.rungs.find((x) => x.id === 'C1')!;
assert.equal(pumpRung.path.filter((e) => e.t === 'branch').length, 1, 'the seal-in stays a parallel branch');
assert.equal(pumpRung.description, 'KM1 CONTACTOR COIL');

// ── The approved fixture cn-rollformer-01 (no PLC) as photographed: its relay logic from the wire numbers ──
const rfExpected = JSON.parse(readFileSync(new URL('../../../fixtures/import/cn-rollformer-01/expected.json', import.meta.url), 'utf8')) as { terminals: { strip: string; no: number; wire: string }[]; relayLogic: { id: string; coil: string; description: string }[] };
const rfReading = rollformerReading(rfExpected.terminals);
const rfItems = reviewItems(rfReading);
const rf = traceAll(rfItems, tagger(rfItems), () => undefined);
assert.deepEqual(rf.io, [], 'no PLC: no I/O list from the wires');
const rfCircuit = (coil: string, terms?: string) => rf.circuits.find((c) => c.output === coil && (!terms || c.path!.at(-1)!.t === 'coil' && (c.path!.at(-1) as { terms: string | null }).terms === terms))!;
const tagsOf = (c: typeof rf.circuits[number]) => (c.path ?? []).flatMap((e) => (e.t === 'branch' ? e.paths.flat().map((x) => x.tag) : e.t === 'contact' ? [e.tag] : []));
const DEVICE = /\b(K[AMT]\d+|SB\d+|SA\d+|FR\d+|U\d|H7CX)\b/g;
// every traced contact appears, in the same order, in the fixture's own description of the circuit
for (const [id, coil, terms] of [['C1', 'KM1'], ['C2', 'KA1'], ['C3', 'KA2'], ['C3', 'KA3'], ['C4', 'KA4'], ['C11', 'U1', 'MI1'], ['C11', 'U1', 'MI2'], ['C11', 'U1', 'MI3']] as const) {
  const want = rfExpected.relayLogic.find((x) => x.id === id)!.description.match(DEVICE)!;
  const got = tagsOf(rfCircuit(coil, terms));
  let k = 0;
  for (const t of got) { k = want.indexOf(t, k); assert.ok(k >= 0, `${id} ${coil}${terms ? ` ${terms}` : ''}: ${got.join(' ')} follows "${want.join(' ')}"`); }
}
assert.deepEqual(rfCircuit('KM1').conditions, ['KA0 13-14 (NO)', 'SB2 11-12 (NC)', 'SB1 13-14 (NO) ∥ KM1 13-14 (NO)', 'FR1 95-96 (NC)'], 'pump: safety, stop, start ∥ seal-in, overload');
assert.equal(rfCircuit('KA1').conditions.length, 10, 'line run: the nine permissives in series and start ∥ seal-in');
assert.equal(rfCircuit('KA1').sealIn, 'KA1 11-14');
assert.ok(rfCircuit('KA1').conditions.includes('U1 RB-RC (NC)') && rfCircuit('KA1').conditions.includes('H7CX OUT-NC (NC)'), 'the VFD fault relay and the counter output, by their named pins');
assert.deepEqual(rfCircuit('KA2').conditions, ['KA1 41-42 (NC)', 'SB5 13-14 (NO)', 'KA3 11-12 (NC)'], 'jog forward, no sneak path back through the manual-cut button');
assert.deepEqual(rfCircuit('U1', 'MI1').conditions, ['KA1 21-24 (NO) ∥ KA2 21-24 (NO)'], 'the drive input from its common (DCM)');
assert.deepEqual(rfCircuit('KT1').conditions, ['KA7 11-14 (NO) ∥ KA1 41-42 (NC) + SB7 13-14 (NO)', 'KA8 11-12 (NC)'], 'two wires on KA8:11 (361 and 341) are one node: servo cut or manual cut');
assert.ok(rf.nets.some((n) => n.wire === '341 / 361' && n.joinedAt.includes('KA8:11')));
assert.equal(rfCircuit('KA9').confidence, 'low');
assert.ok(rf.questions.includes('Cabinet photos: KA9 relay coil (C10) is switched on its A2 side by wire 332, which leaves the cabinet on XT2-11 — what switches it?'), 'the NPN sensor relays are asked');
assert.ok(rf.questions.includes('Cabinet photos: KA8 relay coil (C9): no contact feeding wire 364 was read, which leaves the cabinet on XT2-18 — what switches it?'), 'the shear limit switches are in the field');
assert.ok(rf.questions.some((q) => /^Cabinet photos: XT2: what is wired to terminals 1–8, 11, 14–15, 18–21 outside the cabinet\?$/.test(q)), 'one question for XT2, its 24VS / 0V terminals left out');
const rfMachine = photosToMachine(rfItems, rfReading, '', () => undefined);
assert.equal(rfMachine.controller, 'relays');
const rfKept = toRelayLogic(rfMachine, convertMachine(rfMachine, { ...NA_TARGET, logic: 'keep-relays' }));
assert.equal(rfKept.logic!.rungs.length, rf.circuits.length, 'every traced circuit is a ladder rung');
assert.deepEqual(rfKept.notDrawn, []);

// ── Addresses as read: the siemens-mixer-01 fixture's S7 terminals (%I0.0 …, %Q0.0 …) stay as printed ──
const s7 = readFileSync(new URL('../../../fixtures/import/siemens-mixer-01/PLC_Tags_MT01.csv', import.meta.url), 'utf8').split(/\r?\n/)
  .map((l) => /,(%[IQ]\d+\.\d+),/.exec(l)?.[1]).filter((x): x is string => Boolean(x));
const s7io = traceAll(asItems([dev('A1', 'plc', s7.map((a, i): [string, string] => [a, `W${i + 1}`]), '6ES7214-1AG40-0XB0')]), tagOfIt, () => undefined).io;
assert.deepEqual(s7io.map((p) => p.address).sort(), [...s7].sort(), 'every S7 address kept as read');
assert.ok(s7io.every((p) => !p.guessed && p.type === (p.address.startsWith('%I') ? 'input' : 'output')));
assert.equal(new Set(s7io.map((p) => p.address)).size, s7.length, 'no two points collide');

// ── Recogniser: one AI call with every photo labelled; boxes kept inside their photo ──
assert.ok(JSON.stringify(PHOTO_SCHEMA).includes('"seen"'));
const clamped = clampReading({ ...SMALL_CABINET, devices: [{ ...cb1, seen: [{ photo: 0, x: 0.9, y: -0.2, w: 0.5, h: 0.5 }, { photo: 7, x: 0, y: 0, w: 1, h: 1 }] }] }, 3);
assert.deepEqual(clamped.devices[0].seen, [{ photo: 0, x: 0.9, y: 0, w: 0.09999999999999998, h: 0.5 }], 'box clamped, unknown photo dropped');
let sent = '';
setClaudeInterceptor(async (o) => { sent = JSON.stringify(o.messages); return { reasoning: null, text: JSON.stringify(SMALL_CABINET) }; });
// No image decoding in node: the photos go through a stub of the image path.
const fakePhoto = (name: string) => ({ name, type: 'image/jpeg' }) as File;
const toBlocks = async (fs: File[]) => fs.map((f) => ({ type: 'text' as const, text: `[image ${f.name}]` }));
const got = await recogniseCabinet({ apiKey: 'k', model: 'm', effort: 'low', toBlocks, photos: [fakePhoto('overview.jpg'), fakePhoto('rail1.jpg'), fakePhoto('plc.jpg')], note: 'Line 3 starter panel' });
assert.equal(got.reading.devices.length, SMALL_CABINET.devices.length);
assert.ok(/Photo 0 \(overview\.jpg\)/.test(sent) && /Photo 2 \(plc\.jpg\)/.test(sent) && sent.indexOf('[image plc.jpg]') > sent.indexOf('Photo 2') && /Line 3 starter panel/.test(sent), 'every photo labelled with its index');
await assert.rejects(recogniseCabinet({ apiKey: 'k', model: 'm', effort: 'low', photos: [], note: '' }), /at least one photo/);
// Request size: photos sent at most 1568 px; a set over the budget is sent smaller, then refused with a plain message.
const edges: number[] = [];
const enc = (size: (edge: number) => number) => async (_f: File, edge: number) => { edges.push(edge); return 'x'.repeat(size(edge)); };
await photoBlocks([fakePhoto('a'), fakePhoto('b')], enc(() => 1000), 5000);
assert.deepEqual(edges, [PHOTO_EDGE, PHOTO_EDGE], 'small enough: sent at 1568 px');
edges.length = 0;
const blocks = await photoBlocks([fakePhoto('a'), fakePhoto('b')], enc((e) => (e > 1000 ? 4000 : 2000)), 5000);
assert.deepEqual([edges.at(-1), blocks.length], [1000, 2], 'over the budget: sent smaller');
await assert.rejects(photoBlocks([fakePhoto('a'), fakePhoto('b')], enc(() => 4000), 5000), /too large to send together/);
await assert.rejects(photoBlocks(Array.from({ length: 21 }, (_, i) => fakePhoto(`p${i}`)), enc(() => 1)), /At most 20 photos/);

console.log(`photos tests passed (${merged.devices.length} devices, ${lay.items.length} placed)`);
