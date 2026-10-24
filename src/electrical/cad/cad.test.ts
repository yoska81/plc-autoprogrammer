/// <reference types="node" />
/**
 * CAD exports: the SVG → DXF converter (layers, y flip, device / wire-number blocks with attributes, one
 * SEQEND per insert) and the EPLAN package (AML links and tags, PLC assignment list, parts XML).
 * The full drawing set (TSX sheets) is checked by tools/check_cad.py.
 * Run with:  npx tsx src/electrical/cad/cad.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../../preview/sampleProject';
import { getPart } from '../catalog';
import type { DrawingContext } from '../derive';
import { parseSvg, textOf } from './svgTree';
import { flattenPath, parseTransform, svgToDxf } from './svgToDxf';
import { amlDocument, endpointOf, eplanPackage, symbolOf, symbolTable, uuidOf } from './eplan';

// ---- svgTree
const t = parseSvg('<svg viewBox="0 0 100 50"><!-- c --><g data-cad="TAGS"><text x="1" y="2">A &amp; B<tspan>&#x3A9;</tspan></text></g><line x1="0" y1="0" x2="10" y2="0"/></svg>');
assert.equal(t.tag, 'svg');
assert.equal(t.children.length, 2);
assert.equal(textOf(t.children[0].children[0]), 'A & BΩ');
assert.equal(t.children[1].attrs.x2, '10');

// ---- transforms and paths
const m = parseTransform('translate(10 20) rotate(90)');
assert.ok(Math.abs(m[0]) < 1e-9 && Math.abs(m[1] - 1) < 1e-9 && m[4] === 10 && m[5] === 20);
const sq = flattenPath('M0 0 H10 V10 H0 Z');
assert.equal(sq.length, 1);
assert.deepEqual(sq[0].pts.map(([x, y]) => [Math.round(x), Math.round(y)]), [[0, 0], [10, 0], [10, 10], [0, 10]]);
assert.ok(sq[0].closed);
assert.ok(flattenPath('M0 0 C 0 10 10 10 10 0')[0].pts.length > 4, 'curves are sampled');

// ---- svg → dxf
const devices = new Map([['K1', { tag: 'K1', desc: 'Motor contactor', part: 'XTCE009B10TD', mfr: 'Eaton' }]]);
const svg = parseSvg(`<svg viewBox="0 0 200 100" data-cad="BORDER"><rect x="0" y="0" width="200" height="100"/>
  <g data-cad="GRAPHICS"><g data-cad-sheet="control">
    <g data-cad="SYMS"><circle cx="50" cy="10" r="3"/></g>
    <line x1="10" y1="10" x2="90" y2="10" data-cad="WIRES"/>
    <text x="50" y="20">K1</text>
    <g data-cad="WIRENO"><text x="30" y="8">Y001</text></g>
    <text x="5" y="95">Notes</text>
  </g></g></svg>`);
const { dxf, stats } = svgToDxf(svg, { devices });
assert.equal(stats.devices, 1);
assert.equal(stats.wireNumbers, 1);
assert.match(dxf, /\$INSUNITS\s+70\s+4/);
for (const l of ['BORDER', 'SYMS', 'WIRES', 'WIRENO', 'TAGS', 'TEXT', 'GRAPHICS']) assert.match(dxf, new RegExp(`\\n${l}\\r?\\n`), `layer ${l}`);
for (const a of ['TAG1', 'DESC1', 'MFG', 'CAT', 'WIRENO']) assert.match(dxf, new RegExp(`\\n${a}\\r?\\n`), `attribute ${a}`);
assert.match(dxf, /\nXTCE009B10TD\r?\n/);
// one SEQEND per insert with attributes (2 inserts) — not one per attribute
const entities = dxf.slice(dxf.indexOf('ENTITIES'));
assert.equal((entities.match(/\n\s*0\r?\nSEQEND\r?\n/g) ?? []).length, 2);
// y flipped: the wire at svg y 10 lies at DXF y 90
assert.match(entities, /\n\s*20\r?\n90(\.0+)?\r?\n/);
// a tag on a sheet that is not a device sheet stays text
assert.equal(svgToDxf(parseSvg('<svg viewBox="0 0 10 10"><g data-cad-sheet="cover"><text x="1" y="1">K1</text></g></svg>'), { devices }).stats.devices, 0);

// ---- EPLAN helpers
assert.deepEqual(endpointOf('K1:A1'), { device: 'K1', point: 'A1' });
assert.deepEqual(endpointOf('TB2-4'), { device: 'TB2', point: '4' });
assert.deepEqual(endpointOf('TB1 24+'), { device: 'TB1', point: '24+' });
assert.equal(symbolOf('X001', 'Start PB (green)'), 'Start_PB_green');
assert.equal(symbolOf('X001', '1st sensor'), '_1st_sensor');
assert.equal(uuidOf('a'), uuidOf('a'));
// long descriptions cut to 24 characters stay unique tag names (the address is appended)
{
  const long = 'Pouch present at sealing station';
  const pts = [1, 2, 3].map((i) => ({ address: `X00${i}`, description: `${long} ${i}` }));
  const model = { groups: [{ points: pts }] } as unknown as Parameters<typeof symbolTable>[0];
  const t = symbolTable(model, { analog: [] } as unknown as DrawingContext);
  assert.equal(new Set(t.values()).size, 3, [...t.values()].join(' '));
  assert.ok([...t.values()].every((n) => n.length <= 24));
}
assert.notEqual(uuidOf('a'), uuidOf('b'));
assert.match(uuidOf('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

// ---- EPLAN package on the sample design
const ctx: DrawingContext = {
  projectName: 'Test cell', design: DESIGN, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
};
const { xml, stats: as } = amlDocument(ctx, { now: '2026-01-01T00:00:00Z' });
assert.match(xml, /^<\?xml[^>]*\?>\s*<CAEXFile SchemaVersion="3\.0"/);
assert.equal(as.tags, new Set(DESIGN.ioWiring.map((w) => w.address)).size, 'one tag per I/O point');
assert.equal(as.tags, as.channels);
const ids = [...xml.matchAll(/ ID="([^"]+)"/g)].map((x) => x[1]);
assert.equal(new Set(ids).size, ids.length, 'unique IDs');
const ifaceIds = new Set([...xml.matchAll(/<ExternalInterface [^>]*ID="([^"]+)"/g)].map((x) => x[1]));
for (const l of xml.matchAll(/RefPartnerSideA="([^"]+)" RefPartnerSideB="([^"]+)"/g)) assert.ok(ifaceIds.has(l[1]) && ifaceIds.has(l[2]), 'link partners are interfaces');
assert.equal(amlDocument(ctx, { now: '2026-01-01T00:00:00Z' }).xml, xml, 'deterministic');

const pkg = eplanPackage(ctx, { now: '2026-01-01T00:00:00Z' }, 3);
for (const f of ['Test_cell.aml', 'plc_assignment_list.csv', 'parts_eplan.xml', 'device_list.csv', 'terminal_plan.csv', 'cable_schedule.csv', 'connection_list.csv', 'README.txt']) assert.ok(pkg.files[f], f);
assert.equal(pkg.files['plc_assignment_list.csv'].trim().split('\r\n').length - 1, as.tags);
const parts = [...pkg.files['parts_eplan.xml'].matchAll(/P_ARTICLE_PARTNR="([^"]+)"/g)].map((x) => x[1]);
assert.equal(new Set(parts).size, parts.length, 'one part element per part number');
assert.ok(parts.includes('C0-10DD1E-D'));
assert.match(pkg.files['README.txt'], /cannot be written/);

console.log('cad.test: ok');
