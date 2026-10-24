/// <reference types="node" />
/**
 * Bug-finding rules on imported programs (AB-1 missing seal-in, AB-2 interlock on another station's sensor),
 * and a property test of the Logix export's branch factoring (random rungs: same truth table after export).
 * Run with:  npx tsx src/plc/import/findings.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramText } from './index';
import { planUpgrade } from './upgrade';
import { programFindings } from './findings';
import { convertLogixRung } from './logixText';
import { toBranches } from './cond';
import { toLogix } from '../core/profiles/logixExport';
import type { LadderElement, LadderProgram } from '../core/ladder';

const here = dirname(fileURLToPath(import.meta.url));
const pallet = readFileSync(join(here, '__fixtures__', 'palletizer.L5K'), 'utf8');
const findingsOf = (text: string) => { const plan = planUpgrade(importProgramText('p.L5K', text), 'logix'); return { f: programFindings(plan.program), plan }; };

// The palletizer as it is: nothing to say.
assert.deepEqual(findingsOf(pallet).f, []);

// AB-1: Auto_Run driven by Start_PB with no seal-in, used as the running state elsewhere.
{
  const { f, plan } = findingsOf(pallet.replace('N: [XIC(Start_PB) ,XIC(Auto_Run) ]XIC(Stop_PB)', 'N: XIC(Start_PB)XIC(Stop_PB)'));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'seal-in');
  assert.match(f[0].message, /^Auto_Run is switched on by the Start_PB pushbutton but has no seal-in/);
  assert.ok(plan.questions.includes(f[0].message), 'asked on the Machine description page');
  assert.match(plan.questions[plan.questions.length - 1], /What problems/, 'before the general question');
}
// A latch (OTL) is not a missing seal-in.
assert.deepEqual(findingsOf(pallet.replace('N: [XIC(Start_PB) ,XIC(Auto_Run) ]XIC(Stop_PB)XIC(Safety_OK)OTE(Auto_Run);', 'N: XIC(Start_PB)XIC(Safety_OK)OTL(Auto_Run);\n\t\t\t\tN: XIO(Stop_PB)OTU(Auto_Run);')).f, []);

// AB-2: the pusher checks the box eye at the stacker instead of the layer-full eye.
{
  const { f } = findingsOf(pallet.replace('XIC(Auto_Run)XIC(Layer_Full_PE)XIC(Elev_Top_LS)', 'XIC(Auto_Run)XIC(Box_PE)XIC(Elev_Top_LS)'));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'interlock');
  assert.match(f[0].message, /^Pusher_SV waits for Box_PE .*Should it check Layer_Full_PE\? \(Other interlocks/);
  assert.ok(!/Elev_/.test(f[0].message), 'only a sensor of the same kind (photo eye) is offered');
}

/** A small L5X: alias tags on module points (with their descriptions) and one routine. */
const l5x = (tags: [string, string, string][], routine: string, rungs: [string, string][]) => `<?xml version="1.0"?><RSLogix5000Content><Controller Name="T" ProcessorType="1769-L33ER"><Tags>${tags.map(([n, a, d]) => `<Tag Name="${n}" TagType="Alias" AliasFor="${a}"><Description><![CDATA[${d}]]></Description></Tag>`).join('')}</Tags><Programs><Program Name="MainProgram" MainRoutineName="${routine}"><Routines><Routine Name="${routine}" Type="RLL"><RLLContent>${rungs.map(([c, t], i) => `<Rung Number="${i}" Type="N">${c ? `<Comment><![CDATA[${c}]]></Comment>` : ''}<Text><![CDATA[${t}]]></Text></Rung>`).join('')}</RLLContent></Routine></Routines></Program></Programs></Controller></RSLogix5000Content>`;
const PALLET_IO: [string, string, string][] = [
  ['Infeed_Case_PE', 'Local:1:I.Data.0', 'Case at infeed (PE-101)'],
  ['Case_Stop_Up_PX', 'Local:1:I.Data.1', 'Case stop up (PX-102)'],
  ['Pallet_Present_PE', 'Local:1:I.Data.2', 'Pallet on the elevator (PE-103)'],
  ['Auto_Mode_SS', 'Local:1:I.Data.3', 'Auto selector'],
  ['Pusher_Extend_Sol', 'Local:2:O.Data.0', 'Layer pusher extend solenoid'],
];
const real = (sensor: string) => programFindings(planUpgrade(importProgramText('p.L5X', l5x(PALLET_IO, 'LayerForm', [
  ['', 'XIC(Infeed_Case_PE)XIC(Auto_Mode_SS)OTE(Case_Stop_Down);'],
  ['', 'XIC(Pallet_Present_PE)OTE(Layer_Ready);'],
  ['Push the layer: only with case stop up and a pallet on the elevator', `XIC(Auto_Mode_SS)XIC(Case_Stop_Up_PX)XIC(${sensor})OTE(Pusher_Extend_Sol);`],
])), 'logix').program);

// AB-2 as in the real palletizer (LayerForm rung 4): "case" in the comment is the case stop's, not the infeed's.
{
  const f = real('Infeed_Case_PE');
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.match(f[0].message, /^Pusher_Extend_Sol waits for Infeed_Case_PE .*Should it check Pallet_Present_PE\?/);
  assert.deepEqual(real('Pallet_Present_PE'), [], 'fixed: nothing to say');
}

// A guard on purpose is never questioned (real mixer: the agitator waits for the lid).
{
  const f = programFindings(planUpgrade(importProgramText('m.L5X', l5x([
    ['Lid_Closed', 'Local:1:I.Data.0', 'Mixer lid closed'],
    ['Agitator_Running', 'Local:1:I.Data.1', 'Agitator contactor feedback'],
    ['Level_Low_PE', 'Local:1:I.Data.2', 'Mixer level low'],
    ['Agitator_Run', 'Local:2:O.Data.0', 'Agitator motor'],
  ], 'Agitator', [['Agitator: runs with the lid closed', 'XIC(Mix_Step)XIC(Lid_Closed)XIO(Level_Low_PE)OTE(Agitator_Run);'], ['', 'XIC(Agitator_Running)OTE(Agit_Fb);']])), 'logix').program);
  assert.deepEqual(f, []);
}

// ── Property: the Logix export's branch factoring keeps every rung's logic ──
{
  let seed = 7;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const VARS = ['C1', 'C2', 'C3', 'C4', 'C5'];
  const names = new Map(VARS.map((v, i) => [v, `B${i + 1}`]));
  const evalDnf = (br: LadderElement[][], val: Map<string, boolean>) => br.length === 0 || br.some((b) => b.every((e) => (e.type === 'NO' ? val.get(e.address)! : e.type === 'NC' ? !val.get(e.address)! : true)));
  for (let t = 0; t < 300; t++) {
    const shared = Array.from({ length: rnd(3) }, () => ({ type: rnd(2) ? 'NO' : 'NC', address: VARS[rnd(5)] }) as LadderElement);
    const branches = Array.from({ length: 1 + rnd(4) }, () => {
      const own = Array.from({ length: rnd(3) }, () => ({ type: rnd(2) ? 'NO' : 'NC', address: VARS[rnd(5)] }) as LadderElement);
      return rnd(2) ? [...shared, ...own] : [...own, ...shared];
    });
    const program: LadderProgram = { rungs: [{ id: 'r', comment: '', branches, outputs: [{ type: 'OUT', address: 'C9' }] }], tags: [...VARS.map((v) => ({ address: v, nickname: names.get(v)!, comment: '' })), { address: 'C9', nickname: 'Q', comment: '' }] };
    const lx = toLogix(program, { io: [], addresses: new Map(), labels: new Map(), header: '', extraTags: [] }, () => null);
    const text = lx.routines.find((r) => r.name !== 'MainRoutine')!.rungs[0].text;
    const back = toBranches(convertLogixRung(text).driven.find((d) => d.out.type === 'OUT')?.cond ?? { k: 'false' }) ?? [];
    const backNeutral = back.map((b) => b.map((e) => ('address' in e ? { ...e, address: VARS[Number(e.address.slice(1)) - 1] } : e)));
    for (let m = 0; m < 32; m++) {
      const val = new Map(VARS.map((v, i) => [v, Boolean(m & (1 << i))]));
      assert.equal(evalDnf(backNeutral, val), evalDnf(branches, val), `rung ${t} (${text}), inputs ${m.toString(2)}`);
    }
  }
}

console.log('findings.test: all passed');
