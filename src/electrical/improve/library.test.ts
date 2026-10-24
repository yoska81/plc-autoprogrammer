/// <reference types="node" />
/** Standard-panel library. Run with:  npx tsx src/electrical/improve/library.test.ts */
import assert from 'node:assert/strict';
import { insertSection, libraryFile, makePanel, makeSection, mergeLibrary, parseLibrary, sectionComponents } from './library';
import { exampleCtx } from './testDesign';
import { getPart } from '../catalog';
import { designWarnings } from '../derive';

const ctx = exampleCtx();
const d = ctx.design;

// Sections pick the right parts.
const starter = sectionComponents(d, 'motor-starter', getPart, 'M1').map((c) => c.tag);
assert.deepEqual(starter.sort(), ['CB1', 'K1', 'K1-AUX', 'OL1'].sort(), 'motor starter M1');
const safety = sectionComponents(d, 'safety', getPart).map((c) => c.tag);
assert.ok(safety.includes('SR1') && safety.includes('ES1'), `safety circuit: ${safety}`);
const psu = sectionComponents(d, 'psu', getPart).map((c) => c.tag);
assert.ok(psu.includes('PS1') && psu.includes('CB2') && !psu.includes('CB1'), `PSU section: ${psu}`);

// A motor starter added to the same design: tags and motor renumbered, nothing clashes, drawings still build.
const item = makeSection(d, 'motor-starter', '1 HP DOL starter 480 V', 'example', getPart, 'M1')!;
assert.match(item.summary, /^1 HP contactor overload at 480 V 3-phase/);
const r = insertSection(d, item);
assert.equal(r.motorTag, 'M2');
assert.equal(r.tags.get('K1'), 'K2');
assert.equal(r.tags.get('K1-AUX'), 'K2-AUX');
assert.equal(r.tags.get('CB1'), 'CB3', 'CB1 and CB2 are taken');
const tags = r.design.components.map((c) => c.tag);
assert.equal(new Set(tags).size, tags.length, 'unique tags');
assert.ok(r.design.components.filter((c) => c.motorTag === 'M2').length === 4);
assert.ok(r.design.inputs.motors.some((m) => m.tag === 'M2' && m.hp === 1));
assert.match(r.design.components.find((c) => c.tag === 'K2-AUX')!.function, /^K2 aux contact/, 'function text follows the new tag');
assert.ok(r.design.notes.some((n) => /panel library/.test(n)));
designWarnings({ ...ctx, design: r.design }); // builds without throwing

// Into an empty design the section keeps its tags.
const empty = insertSection({ ...d, components: [], inputs: { ...d.inputs, motors: [] } }, item);
assert.equal(empty.tags.get('K1'), 'K1');
assert.equal(empty.motorTag, 'M1');

// Whole panel + file round trip; foreign and broken files are refused in plain words.
const panel = makePanel(d, { io: [{ id: 'p1', description: 'Start', type: 'input', category: 'Operator/HMI' } as never], plcId: 'click', cpuId: 'C0-10DD1E-D', modules: [], hmiPartNumber: 'CM5-T7W', region: 'US' }, 'Conveyor standard', 'example');
const file = libraryFile([panel, item]);
const back = parseLibrary(file);
assert.equal(back.length, 2);
assert.deepEqual(back[0].design?.components, d.components);
assert.throws(() => parseLibrary('not json'), /not a panel library/);
assert.throws(() => parseLibrary(JSON.stringify({ format: 'other', items: [] })), /not a panel library/);
assert.throws(() => parseLibrary(JSON.stringify({ format: 'isa-panel-library', version: 99, items: [] })), /newer version/);
assert.equal(parseLibrary(JSON.stringify({ format: 'isa-panel-library', version: 1, items: [{ name: 'x', kind: 'safety', components: [{ tag: 1 }] }] })).length, 0, 'broken item skipped');

// Importing the same file twice adds nothing; a changed item with the same id is kept as a copy.
const m1 = mergeLibrary([], back);
assert.equal(m1.added, 2);
assert.equal(mergeLibrary(m1.items, back).added, 0);
const m3 = mergeLibrary(m1.items, [{ ...item, name: 'renamed' }]);
assert.equal(m3.added, 1);
assert.notEqual(m3.items[2].id, item.id);

console.log('library tests passed');
