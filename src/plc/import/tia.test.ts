/// <reference types="node" />
/**
 * TIA Portal Openness block XML: LAD networks walked from the coils and boxes back to the power rail.
 * Run with:  npx tsx src/plc/import/tia.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, importProgramText } from './index';
import { readTiaXml } from './tiaXml';
import type { Rung } from '../core/ladder';

const here = dirname(fileURLToPath(import.meta.url));
const text = readFileSync(join(here, '__fixtures__', 'FB_Filler_tia.xml'), 'utf8');
assert.equal(detectFormat('FB_Filler.xml', text), 'siemens-xml');
const p = importProgramText('FB_Filler.xml', text);
const nick = new Map(p.program.tags.map((t) => [t.nickname, t.address]));
const r = p.program.rungs;

// Network 1: (Start_PB OR Running) AND Stop_PB → Running (parallel contacts on one wire).
assert.equal(r[0].comment, 'Run latch');
assert.equal(r[0].branches.length, 2);
assert.deepEqual(r[0].outputs, [{ type: 'OUT', address: nick.get('Running') }]);
assert.ok(r[0].branches.every((b) => b[b.length - 1].type === 'NO'), 'Stop_PB in series after the branch');
// Network 2: TON with its instance and T#4S500MS; the negated coil after Q.
assert.deepEqual(r[1].outputs[0], { type: 'TMR', address: nick.get('Fill_Tmr'), mode: 'ON_DELAY', preset: '4500', unit: 'ms', accumulate: false, resetAddress: null });
assert.deepEqual(r[2].branches, [[{ type: 'NC', address: nick.get('Fill_Tmr') }]]);
// Network 3: Ge compare box → set coil.
assert.deepEqual(r[3].branches, [[{ type: 'CMP', left: nick.get('Fill_Count'), op: '>=', right: '500' }]]);
assert.equal(r[3].outputs[0].type, 'SET');
// Network 4: an instruction the ladder has no form for → kept as a pointer to the original network.
assert.deepEqual(r[4].outputs, [{ type: 'RAW', vendor: 'siemens-lad', text: 'FB_Filler network 4 (Calculate): edit it in TIA Portal' }]);
// Network 5: SCL → kept as a pointer to the original network (a rung in the program, not only a note).
assert.deepEqual(r[5].outputs, [{ type: 'RAW', vendor: 'siemens-lad', text: 'FB_Filler network 5 (SCL network): edit it in TIA Portal' }]);
assert.ok(p.report.notConverted.some((n) => n.kept && /SCL network/.test(n.text)));
// Interface members give names and comments.
assert.equal(p.program.tags.find((t) => t.nickname === 'Fill_Count')?.comment, 'Bottles filled');

// ── One-network blocks for the review's counter-examples ──
const block = (parts: string, wires: string) => readTiaXml(`<?xml version="1.0"?><Document><SW.Blocks.FC ID="0"><AttributeList><Name>FC_T</Name></AttributeList><ObjectList>
  <SW.Blocks.CompileUnit ID="1"><AttributeList><NetworkSource><FlgNet><Parts>${parts}</Parts><Wires>${wires}</Wires></FlgNet></NetworkSource><ProgrammingLanguage>LAD</ProgrammingLanguage></AttributeList></SW.Blocks.CompileUnit>
</ObjectList></SW.Blocks.FC></Document>`).routines[0].rungs;
const sym = (uid: number, name: string) => `<Access Scope="GlobalVariable" UId="${uid}"><Symbol><Component Name="${name}" /></Symbol></Access>`;
const kept = (rungs: Rung[]) => rungs.length === 1 && rungs[0].outputs.length === 1 && rungs[0].outputs[0].type === 'RAW';
// #3: Contact → FB call → coil: the network is kept whole, not dropped.
{
  const rungs = block(`${sym(1, 'Start')}${sym(2, 'Done')}<Part Name="Contact" UId="3" /><Call UId="4"><CallInfo Name="FB_Motor" BlockType="FB" /></Call><Part Name="Coil" UId="5" />`,
    `<Wire><Powerrail /><NameCon UId="3" Name="in" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="3" Name="operand" /></Wire><Wire><NameCon UId="3" Name="out" /><NameCon UId="4" Name="en" /></Wire><Wire><NameCon UId="4" Name="eno" /><NameCon UId="5" Name="in" /></Wire><Wire><IdentCon UId="2" /><NameCon UId="5" Name="operand" /></Wire>`);
  assert.ok(kept(rungs), JSON.stringify(rungs));
  assert.match((rungs[0].outputs[0] as { text: string }).text, /call FB_Motor/);
}
// #4: box pins wired to tags or logic: TON ET → a tag, CTU CV → a tag, CTU R from a contact, Move out2.
{
  const ton = (extra: string, extraParts = '') => block(`${sym(1, 'Go')}${sym(2, 'T#5S')}${sym(3, 'Elapsed')}<Part Name="Contact" UId="4" /><Part Name="TON" UId="5"><Instance Scope="GlobalVariable"><Component Name="T1" /></Instance></Part>${extraParts}`,
    `<Wire><Powerrail /><NameCon UId="4" Name="in" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="4" Name="operand" /></Wire><Wire><NameCon UId="4" Name="out" /><NameCon UId="5" Name="IN" /></Wire><Wire><IdentCon UId="2" /><NameCon UId="5" Name="PT" /></Wire>${extra}`);
  assert.ok(!kept(ton('')), 'a plain TON converts');
  assert.ok(kept(ton('<Wire><NameCon UId="5" Name="ET" /><IdentCon UId="3" /></Wire>')), 'TON ET to a tag');
  const ctu = (extra: string, extraParts = '') => block(`${sym(1, 'Pulse')}${sym(2, '10')}${sym(3, 'Count')}${sym(6, 'Clear')}<Part Name="Contact" UId="4" /><Part Name="CTU" UId="5"><Instance Scope="GlobalVariable"><Component Name="C1" /></Instance></Part>${extraParts}`,
    `<Wire><Powerrail /><NameCon UId="4" Name="in" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="4" Name="operand" /></Wire><Wire><NameCon UId="4" Name="out" /><NameCon UId="5" Name="CU" /></Wire><Wire><IdentCon UId="2" /><NameCon UId="5" Name="PV" /></Wire>${extra}`);
  assert.ok(!kept(ctu('')), 'a plain CTU converts');
  assert.ok(kept(ctu('<Wire><NameCon UId="5" Name="CV" /><IdentCon UId="3" /></Wire>')), 'CTU CV to a tag');
  assert.ok(kept(ctu('<Wire><Powerrail /><NameCon UId="7" Name="in" /></Wire><Wire><IdentCon UId="6" /><NameCon UId="7" Name="operand" /></Wire><Wire><NameCon UId="7" Name="out" /><NameCon UId="5" Name="R" /></Wire>', '<Part Name="Contact" UId="7" />')), 'CTU R from a contact');
  const mv = block(`${sym(1, 'A')}${sym(2, 'B')}${sym(3, 'C')}<Part Name="Move" UId="4" />`,
    `<Wire><Powerrail /><NameCon UId="4" Name="en" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="4" Name="in" /></Wire><Wire><NameCon UId="4" Name="out1" /><IdentCon UId="2" /></Wire><Wire><NameCon UId="4" Name="out2" /><IdentCon UId="3" /></Wire>`);
  assert.ok(kept(mv), 'Move with two outputs');
}
// #5: absolute addresses with their width: memory bit 10.1, a Real at byte 20, an input word.
{
  const addr = (area: string, type: string, bit: number) => `<Access Scope="Address" UId="1"><Address Area="${area}" Type="${type}" BitOffset="${bit}" /></Access>`;
  const coil = (a: string) => block(`${a}<Part Name="Coil" UId="2" />`, `<Wire><Powerrail /><NameCon UId="2" Name="in" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="2" Name="operand" /></Wire>`)[0].outputs[0];
  assert.deepEqual(coil(addr('Memory', 'Bool', 81)), { type: 'OUT', address: '%MX10.1' });
  const mv = (a: string) => block(`${sym(1, 'Src')}${a.replace('UId="1"', 'UId="3"')}<Part Name="Move" UId="2" />`, `<Wire><Powerrail /><NameCon UId="2" Name="en" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="2" Name="in" /></Wire><Wire><NameCon UId="2" Name="out1" /><IdentCon UId="3" /></Wire>`)[0].outputs[0];
  assert.deepEqual(mv(addr('Memory', 'Real', 160)), { type: 'COPY', source: 'Src', dest: '%MD20' });
  assert.deepEqual(mv(addr('Output', 'Int', 512)), { type: 'COPY', source: 'Src', dest: '%QW64' });
  assert.ok(kept(block(`${addr('DB', 'Int', 0)}<Part Name="Coil" UId="2" />`, `<Wire><Powerrail /><NameCon UId="2" Name="in" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="2" Name="operand" /></Wire>`)), 'an address it cannot read keeps the network');
}

// Review: an absolute Real (%MD20) stays Real through the import (a DF register, exported as Real), never an Int.
{
  const xml = `<?xml version="1.0"?><Document><SW.Blocks.FC ID="0"><AttributeList><Name>FC_R</Name></AttributeList><ObjectList>
  <SW.Blocks.CompileUnit ID="1"><AttributeList><NetworkSource><FlgNet><Parts>${sym(1, 'Src')}<Access Scope="Address" UId="3"><Address Area="Memory" Type="Real" BitOffset="160" /></Access><Access Scope="Address" UId="5"><Address Area="Memory" Type="DInt" BitOffset="320" /></Access><Part Name="Move" UId="2" /><Part Name="Move" UId="4" /></Parts>
  <Wires><Wire><Powerrail /><NameCon UId="2" Name="en" /><NameCon UId="4" Name="en" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="2" Name="in" /></Wire><Wire><NameCon UId="2" Name="out1" /><IdentCon UId="3" /></Wire><Wire><IdentCon UId="1" /><NameCon UId="4" Name="in" /></Wire><Wire><NameCon UId="4" Name="out1" /><IdentCon UId="5" /></Wire></Wires></FlgNet></NetworkSource><ProgrammingLanguage>LAD</ProgrammingLanguage></AttributeList></SW.Blocks.CompileUnit>
</ObjectList></SW.Blocks.FC></Document>`;
  const imp = importProgramText('FC_R.xml', xml);
  const at = (n: string) => imp.program.tags.find((t) => t.nickname === n)?.address ?? '';
  assert.match(at('%MD20'), /^DF\d+$/, `a Real is a DF register (${at('%MD20')})`);
  assert.match(at('%MD40'), /^DD\d+$/, `a DInt is a DD register (${at('%MD40')})`);
}

console.log('tia.test: all passed');
