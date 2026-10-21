/// <reference types="node" />
/**
 * TIA Portal ladder export (siemensLad.ts): the example project and a synthetic S7-1500 + ET 200SP project as
 * SimaticML blocks. The XML has the shape TIA Portal reads (Document › Engineering version, SW.Blocks.FC / OB /
 * GlobalDB, a CompileUnit per network with a LAD FlgNet, unique IDs per document and UIds per network), and read
 * back with the app's own TIA importer (import/tiaXml.ts) every LAD network gives the same logic: for each output,
 * the same set of AND-branches over the same operands. What LAD cannot hold goes to SCL helpers, said by rung.
 *   npx tsx src/plc/core/profiles/siemensLad.test.ts
 */
import assert from 'node:assert/strict';
import { TIA_VERSIONS, buildTiaLad, tiaLadFiles, tiaPlcTags, type TiaVersion } from './siemensLad';
import { readTiaXml } from '../../import/tiaXml';
import { all, kid, kids, parseXml, textOf } from '../../import/xml';
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../ladder';
import type { ExportContext } from '../profile';
import { seedSampleProject } from '../../../preview/sampleProject';
import { collectProject } from '../../../deliverables/collect';
import { exportContext } from '../../../deliverables/exportContext';
import { useProjectStore } from '../../../store/useProjectStore';
import { withIoRemap } from '../ioChange';
import '../../../hmi/ioParticipant';

const UNIT: Record<string, number> = { ms: 1, sec: 1000, min: 60_000, hour: 3_600_000, day: 86_400_000 };

/** Each output → the set of its AND-branches (sorted element texts), in the export's names. */
function logic(rungs: Rung[], name: (a: string) => string, units: Map<string, number>, preset: (timer: string, p: string) => string = (_t, p) => name(p)): Map<string, Set<string>> {
  const el = (e: LadderElement): string | null => {
    if (e.type === 'RAW') return `RAW`;
    if (e.type === 'CMP') {
      const tdUnit = (a: string) => units.get(a.toUpperCase()) ?? 1;
      const side = (a: string, other: string) => (/^-?\d/.test(a.trim()) ? String(Number(a) * (/^TD\d/i.test(other) ? tdUnit(other) : 1)) : name(a));
      return `${side(e.left, e.right)} ${e.op} ${side(e.right, e.left)}`;
    }
    if (/^SC1$/i.test(e.address)) return null; // always ON: the wire
    return `${e.type} ${name(e.address)}`;
  };
  const out = (o: LadderOutput): string => {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': return `${o.type} ${name(o.address)}`;
      case 'TMR': return `TMR ${o.mode} ${o.accumulate ? 'RTO ' : ''}${name(o.address).replace(/\.Q$/, '')} ${/^\d+$/.test(o.preset) ? Number(o.preset) * (UNIT[o.unit] ?? 1000) : preset(o.address, o.preset)}`;
      case 'CNT': return `CNT ${o.direction} ${name(o.address).replace(/\.Q$/, '')} ${/^\d/.test(o.preset) ? o.preset : name(o.preset)}${o.resetAddress ? ` R ${name(o.resetAddress)}` : ''}`;
      case 'COPY': return `COPY ${/^-?\d/.test(o.source) ? o.source : name(o.source)} ${name(o.dest)}`;
      default: return o.type;
    }
  };
  const m = new Map<string, Set<string>>();
  for (const r of rungs) for (const o of r.outputs) {
    const k = out(o);
    const s = m.get(k) ?? new Set<string>();
    for (const b of r.branches.length ? r.branches : [[]]) s.add(b.map(el).filter((x): x is string => x !== null).sort().join(' & '));
    m.set(k, s);
  }
  return m;
}

function check(label: string, program: LadderProgram, ctx: ExportContext, version: TiaVersion = 'V17') {
  const x = buildTiaLad(program, ctx, 'Machine', version);
  label = `${label} ${version}`;
  const names = x.files.map((f) => f.name);
  assert.ok(names.includes('Machine_DB.xml') && names.includes('Main.xml') && names.some((n) => n.endsWith('_tia_helpers.scl')), `${label}: DB, OB 1 and the SCL helpers`);
  for (const f of x.files.filter((y) => y.name.endsWith('.xml'))) {
    assert.ok(f.content.startsWith(`<?xml version="1.0" encoding="utf-8"?>\n<Document>\n  <Engineering version="${version}" />`), `${label} ${f.name}: Document and Engineering version ${version}`);
    // The namespaces of that version (one table in siemensLad.ts).
    const iface = version === 'V16' ? 'v4' : 'v5', flg = version === 'V19' || version === 'V20' ? 'v5' : 'v4';
    assert.ok(f.content.includes(`Openness/SW/Interface/${iface}"`), `${label} ${f.name}: Interface/${iface}`);
    if (/<FlgNet/.test(f.content)) assert.ok(!new RegExp(`FlgNet/v(?!${flg.slice(1)}")`).test(f.content), `${label} ${f.name}: FlgNet/${flg} only`);
    const doc = parseXml(f.content);
    const blocks = [...all(doc, 'SW.Blocks.FC'), ...all(doc, 'SW.Blocks.OB'), ...all(doc, 'SW.Blocks.GlobalDB')];
    assert.equal(blocks.length, 1, `${label} ${f.name}: one block`);
    // IDs unique in the document; UIds unique in each network.
    const idsSeen: string[] = [];
    const walk = (n: typeof doc) => { if (n.attrs.ID) idsSeen.push(n.attrs.ID); n.children.forEach(walk); };
    walk(doc);
    assert.ok(idsSeen.length > 2, `${label} ${f.name}: IDs present`);
    assert.equal(new Set(idsSeen).size, idsSeen.length, `${label} ${f.name}: unique IDs`);
    for (const cu of all(doc, 'SW.Blocks.CompileUnit')) {
      const flg = all(cu, 'FlgNet')[0];
      assert.ok(flg, `${label} ${f.name}: a FlgNet in every network`);
      assert.equal(textOf(kid(kid(cu, 'AttributeList'), 'ProgrammingLanguage')).trim(), 'LAD', `${label} ${f.name}: a LAD network`);
      const uids = [...all(flg, 'Access'), ...all(flg, 'Part'), ...all(flg, 'Call'), ...all(flg, 'Wire'), ...all(flg, 'Instance')].map((n) => n.attrs.UId);
      assert.equal(new Set(uids).size, uids.length, `${label} ${f.name}: unique UIds in a network`);
      assert.ok(kids(kid(flg, 'Wires'), 'Wire').length > 0, `${label} ${f.name}: wired`);
    }
  }
  // Round trip, block by block: the LAD networks read back as the same logic.
  const units = new Map<string, number>();
  for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'TMR') units.set(`TD${o.address.toUpperCase().slice(1)}`, UNIT[o.unit] ?? 1000);
  const viaScl = new Set(x.viaScl.map((v) => `${v.block}#${v.rung}`));
  const order = [...new Set(program.rungs.map((r) => r.block ?? ''))];
  let compared = 0;
  for (const b of order) {
    const block = program.blocks?.find((y) => y.id === b)?.name ?? 'Machine';
    const file = x.files.find((f) => f.name === `${block.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')}.xml`);
    assert.ok(file, `${label}: a block file for ${block}`);
    const back = readTiaXml(file!.content).routines.flatMap((r) => r.rungs).filter((r) => !r.outputs.some((o) => o.type === 'RAW'));
    const mine = program.rungs.filter((r) => (r.block ?? '') === b).filter((_, i) => !viaScl.has(`${file!.name.replace(/\.xml$/, '')}#${i + 1}`));
    // A preset held in a register is the timer's own Time member (<timer>_PT), set by the start helper.
    const want = logic(mine, (a) => x.nameOf(a) ?? `?${a}`, units, (t) => `${(x.nameOf(t) ?? t).replace(/\.Q$/, '')}_PT`);
    const got = logic(back, (a) => a.replace(/^"|"$/g, ''), new Map());
    // The importer reads a Time constant as ms: the same numbers as `want`.
    assert.deepEqual(new Map([...got].map(([k, v]) => [k, [...v].sort()])), new Map([...want].map(([k, v]) => [k, [...v].sort()])), `${label} ${block}: same logic`);
    compared += mine.length;
  }
  assert.equal(compared + x.viaScl.length, program.rungs.length, `${label}: every rung is a LAD network or an SCL helper`);
  assert.ok(x.lad >= program.rungs.length * 0.8, `${label}: mostly LAD (${x.lad} of ${program.rungs.length})`);
  for (const v of x.viaScl) assert.match(v.why, /math|kept|compare|copy|coil|operand/, `${label}: rung ${v.rung} says why it is SCL`);
  return x;
}

// The example project on an S7-1200, for every TIA Portal version.
seedSampleProject();
useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
const p = collectProject();
for (const v of TIA_VERSIONS) check('example S7-1200', p.ladder, exportContext(p), v);
const ex = check('example S7-1200', p.ladder, exportContext(p));
// Each network's comment names its rung (TIA Portal reports compile errors by block and network).
assert.match(ex.files.find((f) => f.name === 'Safety_modes.xml')!.content, /CompositionName="Comment"><ObjectList><MultilingualTextItem ID="\w+" CompositionName="Items"><AttributeList><Culture>en-US<\/Culture><Text>rung r_/);
// The download: one folder per version, each with its README, and a README at the top saying which to take.
const files = tiaLadFiles(p.ladder, exportContext(p), 'Cell');
for (const v of TIA_VERSIONS) {
  assert.ok(files.some((f) => f.name === `Cell_TIA_LAD/${v}/Main.xml`) && files.some((f) => f.name === `Cell_TIA_LAD/${v}/README.txt`), `a ${v} folder`);
  assert.match(files.find((f) => f.name === `Cell_TIA_LAD/${v}/README.txt`)!.content, new RegExp(`TIA Portal ${v} as ladder[\\s\\S]*Version control interface[\\s\\S]*Openness`));
}
assert.match(files.find((f) => f.name === 'Cell_TIA_LAD/README.txt')!.content, /folder of YOUR TIA Portal version[\s\S]*V16\/[\s\S]*V20\//);
assert.ok(files.reduce((n, f) => n + f.content.length, 0) < 3_000_000, 'five versions stay small');
// The PLC tags for an Openness import: the same as the tag table.
assert.ok(tiaPlcTags(p.ladder, exportContext(p)).some((t) => t.name === 'E_Stop_OK_safety_relay' && t.logicalAddress === '%I0.0' && t.dataType === 'Bool'));
assert.ok(ex.viaScl.every((v) => /^math/.test(v.why)), 'only the math rungs need SCL on the example');
const helpers = ex.files.find((f) => f.name.endsWith('.scl'))!.content;
assert.match(helpers, /FUNCTION "Machine_Start" : Void[\s\S]*"Machine_DB"\.FirstScan := NOT "Machine_DB"\.Initialized;/);
assert.match(helpers, /"Machine_DB"\.Push_Timeout_PT := DINT_TO_TIME\("Machine_DB"\.SP_Pusher_Timeout \* 1000\);/, 'a register preset as a Time member');
assert.doesNotMatch(helpers, /(^|[^\w"])#\w/m, 'no FB-local #names in the helpers');
const db = ex.files.find((f) => f.name === 'Machine_DB.xml')!.content;
assert.match(db, /<Member Name="Safety_OK" Datatype="Bool" Remanence="NonRetain"/);
assert.match(db, /<Member Name="SP_Pusher_Timeout" Datatype="DInt" Remanence="Retain"/, 'setpoints retentive, as CLICK keeps them');
assert.match(db, /<Member Name="Push_Timeout" Datatype="TON_TIME" Version="1.0"/);
const main = ex.files.find((f) => f.name === 'Main.xml')!.content;
assert.match(main, /<SW\.Blocks\.OB [\s\S]*<Name>Main<\/Name>[\s\S]*<SecondaryType>ProgramCycle<\/SecondaryType>/);
assert.ok(main.indexOf('"Machine_Start"') < main.indexOf('"Safety_modes"') || /CallInfo Name="Machine_Start"[\s\S]*CallInfo Name="Safety_modes"/.test(main), 'the start helper before the blocks');

// Rungs LAD cannot draw go to SCL instead of stopping the export: NC on the always-ON bit (the S7-1200 sealing head) and an operand with no name.
{
  const block = p.ladder.rungs[0].block;
  const odd: Rung[] = [
    { id: 'r_nc_on', block, comment: '', branches: [[{ type: 'NC', address: 'SC1' } as LadderElement]], outputs: [{ type: 'OUT', address: 'C1' } as LadderOutput] },
    { id: 'r_unnamed', block, comment: '', branches: [[{ type: 'NO', address: 'ZZ7' } as LadderElement]], outputs: [{ type: 'OUT', address: 'C1' } as LadderOutput] },
  ];
  const x = buildTiaLad({ ...p.ladder, rungs: [...p.ladder.rungs, ...odd] }, exportContext(p));
  const why = x.viaScl.map((v) => v.why);
  assert.ok(why.includes('NC on the always-ON bit'), `NC SC1 via SCL: ${why.join('; ')}`);
  assert.ok(why.some((w) => /^operand ZZ7$/.test(w)), `the unnamed operand via SCL: ${why.join('; ')}`);
}

// A synthetic S7-1500 + ET 200SP project (the example's I/O on modules, X101…).
withIoRemap(() => useProjectStore.setState({ plcId: 'siemens-s7', cpuId: '6ES7511-1AL03-0AB0', modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'] }));
const q = collectProject();
assert.ok([...q.addresses.values()].includes('X101'));
for (const v of ['V16', 'V20'] as const) check('S7-1500 + ET 200SP', q.ladder, exportContext(q), v);

console.log('siemens LAD export tests passed');
