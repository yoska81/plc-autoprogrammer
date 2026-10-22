/// <reference types="node" />
/**
 * Read from TIA Portal: the blocks the bridge exports (one SimaticML file each) and the PLC tags become one
 * document and a tag CSV the program import reads: every block's rungs, the I/O with addresses and comments.
 * Run with:  npx tsx src/plc/tia/tiaReadBack.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { useProjectStore } from '../../store/useProjectStore';
import { buildTiaLad } from '../core/profiles/siemensLad';
import { importProgramFiles } from '../import';
import { tiaTagRows } from './tiaSend';
import { oneDocument, readBackFiles } from './tiaReadBack';

seedSampleProject();
useProjectStore.getState().setPlc('siemens-s7', '6ES7214-1AG40-0XB0');
useProjectStore.setState({ modules: [] });
const p = collectProject();
const lad = buildTiaLad(p.ladder, exportContext(p), 'Machine', 'V19');
// what TIA Portal exports: one file per block, each its own document (with a byte-order mark)
const blocks = lad.files.filter((f) => f.name.endsWith('.xml')).map((f) => ({ name: f.name.replace(/\.xml$/, ''), xml: `\uFEFF${f.content}` }));
const tags = tiaTagRows(p).map((t) => ({ name: t.name, dataType: t.dataType, address: t.logicalAddress, comment: t.comment }));

const doc = oneDocument(blocks.map((b) => b.xml));
assert.equal((doc.match(/<Document>/g) ?? []).length, 1, 'one document');
assert.equal((doc.match(/<Engineering\b/g) ?? []).length, 1, 'one Engineering version');
assert.equal((doc.match(/<SW\.Blocks\.(FC|OB|GlobalDB)\b/g) ?? []).length, blocks.length, 'every block');

const files = readBackFiles({ plc: null, blocks, failed: [], tags: [...tags, { name: 'Speed, "set"', dataType: 'Int', address: '%MW10', comment: 'a, b' }] }, 'C:\\Lines\\Conveyor cell.ap19');
assert.deepEqual(files.map((f) => f.name), ['Conveyor_cell_blocks.xml', 'Conveyor_cell_PLC_tags.csv']);
assert.match(files[1].text, /"Speed, ""set""",Int,%MW10,"a, b"/);

const { program } = importProgramFiles(files);
const fcs = blocks.filter((b) => !/^(Machine_DB|Main)$/.test(b.name)).length;
assert.ok((program.program.blocks ?? []).length >= fcs, `${(program.program.blocks ?? []).length} program parts for ${fcs} FCs`);
const mainNetworks = (lad.files.find((f) => f.name === 'Main.xml')!.content.match(/<SW\.Blocks\.CompileUnit\b/g) ?? []).length;
assert.equal(program.report.rungs, p.ladder.rungs.length + mainNetworks, 'every rung of the FCs, and OB 1\'s call networks');
assert.ok(program.report.converted >= lad.lad, `${program.report.converted} converted, ${lad.lad} were ladder`);
const inputs = program.io.filter((x) => x.type === 'input');
assert.ok(inputs.length > 3 && inputs.every((x) => /^%I/.test(x.original ?? '')) && inputs.some((x) => x.description === 'Start Button'), JSON.stringify(inputs.slice(0, 2)));
console.log('tiaReadBack.test: all passed');
