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
import { clampReading, PHOTO_SCHEMA, recogniseCabinet } from './recognise';
import { mergeDevices, mergeReading } from './merge';
import { asBuiltDesign, matchPart, nameplateRatings, photosToMachine, reviewItems, type ReviewItem } from './toDesign';
import { SMALL_CABINET } from './__fixtures__/smallCabinet';
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
assert.deepEqual(merged.strips[0].terminals.map((t) => t.wire), ['24+', '0V', '1001']);
// Never merged: different tags, or different readable part numbers.
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
assert.ok(r.questions.some((q) => /wire 2001/.test(q)) && r.questions.some((q) => /on rail 2 could not be confirmed/.test(q)), 'hidden wiring and the unconfirmed relay become questions');
assert.deepEqual(r.design.askUser, r.questions, 'asked on the Machine description page (the electrical stage registers askUser there)');
assert.equal(matchPart('gmcbu-1c-5', getPart)?.partNumber, 'GMCBU-1C-5', 'nameplate case does not matter');

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
// Without as-built rails the normal packing runs (nothing changes for designed panels).
assert.ok(!panelLayout({ ...ctx, design: { ...r.design, asBuilt: undefined } }).warnings.some((w) => /As-built/.test(w)));

// ── The same reviewed photos as an existing machine, for the shared review → conversion path ──
const machine = photosToMachine(items, merged, 'Line 3 starter panel');
assert.equal(machine.components.length, 8, 'every device not rejected (the unconfirmed relay too: the shared review asks about it)');
const mk1 = machine.components.find((c) => c.tag === 'K1')!;
assert.equal(mk1.source, 'photo 1, rail 2, position 3');
assert.equal(mk1.confidence, 'high', 'confirmed in the photo review');
assert.equal(mk1.ratings.coilVoltage, '24VDC');
assert.equal(machine.components.find((c) => c.tag === 'CB1')!.ratings.curve, 'C');
assert.equal(machine.components.find((c) => c.tag === 'CB1')!.ratings.amps, 5);
assert.deepEqual([machine.components.find((c) => c.tag === 'OL1')!.ratings.minAmps, machine.components.find((c) => c.tag === 'OL1')!.ratings.maxAmps], [5, 8]);
assert.equal(machine.plc?.cpuPartNumber, 'C0-10DD1E-D');
assert.deepEqual(machine.modules.map((m) => m.partNumber), ['C0-08ND3']);
assert.match(machine.spec.utilities, /TB1: 1 = wire 24\+, 2 = wire 0V, 3 = wire 1001/);
assert.ok(machine.questions.some((q) => /wire 2001/.test(q.text)));
assert.equal(nameplateRatings('24 VDC 3 A').amps, 3);

// ── Recogniser: one AI call with every photo labelled; boxes kept inside their photo ──
assert.ok(JSON.stringify(PHOTO_SCHEMA).includes('"seen"'));
const clamped = clampReading({ ...SMALL_CABINET, devices: [{ ...cb1, seen: [{ photo: 0, x: 0.9, y: -0.2, w: 0.5, h: 0.5 }, { photo: 7, x: 0, y: 0, w: 1, h: 1 }] }] }, 3);
assert.deepEqual(clamped.devices[0].seen, [{ photo: 0, x: 0.9, y: 0, w: 0.09999999999999998, h: 0.5 }], 'box clamped, unknown photo dropped');
let sent = '';
setClaudeInterceptor(async (o) => { sent = JSON.stringify(o.messages); return { reasoning: null, text: JSON.stringify(SMALL_CABINET) }; });
// No image decoding in node: the photos go through a stub of the image path.
const fakePhoto = (name: string) => ({ name, type: 'image/jpeg' }) as File;
const toBlock = async (f: File) => ({ type: 'text' as const, text: `[image ${f.name}]` });
const got = await recogniseCabinet({ apiKey: 'k', model: 'm', effort: 'low', toBlock, photos: [fakePhoto('overview.jpg'), fakePhoto('rail1.jpg'), fakePhoto('plc.jpg')], note: 'Line 3 starter panel' });
assert.equal(got.reading.devices.length, SMALL_CABINET.devices.length);
assert.ok(/Photo 0 \(overview\.jpg\)/.test(sent) && /Photo 2 \(plc\.jpg\)/.test(sent) && sent.indexOf('[image plc.jpg]') > sent.indexOf('Photo 2') && /Line 3 starter panel/.test(sent), 'every photo labelled with its index');
await assert.rejects(recogniseCabinet({ apiKey: 'k', model: 'm', effort: 'low', photos: [], note: '' }), /at least one photo/);

console.log(`photos tests passed (${merged.devices.length} devices, ${lay.items.length} placed)`);
